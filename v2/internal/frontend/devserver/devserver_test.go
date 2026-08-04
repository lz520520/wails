//go:build dev
// +build dev

package devserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/wailsapp/wails/v2/internal/frontend"
	internallogger "github.com/wailsapp/wails/v2/internal/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
)

type orderedEventDispatcher struct {
	server    *DevWebServer
	eventName string
	count     int
}

func (d *orderedEventDispatcher) ProcessMessage(message string, _ frontend.Frontend) (string, error) {
	if !strings.HasPrefix(message, "C") {
		return "", nil
	}
	for index := 0; index < d.count; index++ {
		d.server.notify(d.eventName, index)
	}
	return "", nil
}

func TestHandleRuntimeReadyTriggersDomReady(t *testing.T) {
	runtimeCtx := context.WithValue(context.Background(), "frontend", "headless")
	domReadyCtx := make(chan context.Context, 1)
	server := &DevWebServer{
		ctx: runtimeCtx,
		appoptions: &options.App{
			OnDomReady: func(ctx context.Context) {
				domReadyCtx <- ctx
			},
		},
	}

	if !server.handleRuntimeMessage("runtime:ready") {
		t.Fatal("runtime:ready was not handled as a runtime message")
	}

	select {
	case got := <-domReadyCtx:
		if got != runtimeCtx {
			t.Fatal("OnDomReady did not receive the runtime context")
		}
	case <-time.After(time.Second):
		t.Fatal("OnDomReady was not called")
	}
}

func TestHandleRuntimeMessageIgnoresUnknownMessages(t *testing.T) {
	server := &DevWebServer{}
	if server.handleRuntimeMessage("C{}") {
		t.Fatal("call messages must continue through the dispatcher")
	}
}

func TestConnectionControlMessagesUpdateEventFilterSynchronously(t *testing.T) {
	server := &DevWebServer{}
	info := newWebsocketInfo(nil, nil)
	defer info.close()

	if !server.handleConnectionControlMessage("EBresult-event", info) {
		t.Fatal("event binding must be handled in the websocket reader")
	}
	if _, ok := info.eventCache.Load("result-event"); !ok {
		t.Fatal("event binding was not visible when control handling returned")
	}

	if server.handleConnectionControlMessage("EXresult-event", info) {
		t.Fatal("event release must continue to the dispatcher for Go listeners")
	}
	if _, ok := info.eventCache.Load("result-event"); ok {
		t.Fatal("event release was not visible when control handling returned")
	}
}

func TestWebsocketSendQueueIsOrderedAndBounded(t *testing.T) {
	info := &WebsocketInfo{
		send: make(chan websocketMessage, 2),
		done: make(chan struct{}),
	}
	defer info.close()

	first := []byte("first")
	if err := info.enqueue(websocket.TextMessage, first); err != nil {
		t.Fatalf("enqueue first message: %v", err)
	}
	first[0] = 'X'
	if err := info.enqueue(websocket.TextMessage, []byte("second")); err != nil {
		t.Fatalf("enqueue second message: %v", err)
	}
	if err := info.enqueue(websocket.TextMessage, []byte("third")); !errors.Is(err, errWebsocketBackpressure) {
		t.Fatalf("enqueue beyond capacity error = %v, want %v", err, errWebsocketBackpressure)
	}

	if got := string((<-info.send).payload); got != "first" {
		t.Fatalf("first queued payload = %q", got)
	}
	if got := string((<-info.send).payload); got != "second" {
		t.Fatalf("second queued payload = %q", got)
	}
}

func TestBindThenImmediateCallDeliversEventsInOrder(t *testing.T) {
	const (
		eventName  = "ordered-result"
		eventCount = 64
	)

	echoServer := echo.New()
	server := &DevWebServer{
		ctx:              context.Background(),
		appoptions:       &options.App{},
		logger:           internallogger.New(nil),
		server:           echoServer,
		websocketClients: make(map[*websocket.Conn]*WebsocketInfo),
	}
	server.dispatcher = &orderedEventDispatcher{
		server:    server,
		eventName: eventName,
		count:     eventCount,
	}
	echoServer.GET("/wails/ipc", server.handleIPCWebSocket)

	httpServer := httptest.NewServer(echoServer)
	defer httpServer.Close()

	websocketURL := "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/wails/ipc"
	client, _, err := websocket.DefaultDialer.Dial(websocketURL, nil)
	if err != nil {
		t.Fatalf("dial websocket: %v", err)
	}
	defer client.Close()

	if err := client.WriteMessage(websocket.TextMessage, []byte("EB"+eventName)); err != nil {
		t.Fatalf("bind event: %v", err)
	}
	if err := client.WriteMessage(websocket.TextMessage, []byte(`C{}`)); err != nil {
		t.Fatalf("send immediate call: %v", err)
	}
	if err := client.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}

	for want := 0; want < eventCount; want++ {
		messageType, payload, err := client.ReadMessage()
		if err != nil {
			t.Fatalf("read event %d: %v", want, err)
		}
		if messageType != websocket.TextMessage || len(payload) == 0 || payload[0] != 'n' {
			t.Fatalf("event %d frame = type %d payload %q", want, messageType, payload)
		}

		var notification EventNotify
		if err := json.Unmarshal(payload[1:], &notification); err != nil {
			t.Fatalf("decode event %d: %v", want, err)
		}
		if notification.Name != eventName || len(notification.Data) != 1 {
			t.Fatalf("event %d notification = %+v", want, notification)
		}
		got, ok := notification.Data[0].(float64)
		if !ok || int(got) != want {
			t.Fatalf("event order = %v at index %d", notification.Data[0], want)
		}
	}
}
