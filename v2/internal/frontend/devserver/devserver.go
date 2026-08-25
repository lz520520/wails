//go:build dev
// +build dev

// Package devserver provides a web-based frontend so that
// it is possible to run a Wails app in a browsers.
package devserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/assetserver"

	wailsruntime "github.com/wailsapp/wails/v2/internal/frontend/runtime"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/wailsapp/wails/v2/internal/binding"
	"github.com/wailsapp/wails/v2/internal/frontend"
	"github.com/wailsapp/wails/v2/internal/logger"
	"github.com/wailsapp/wails/v2/internal/menumanager"
	"github.com/wailsapp/wails/v2/pkg/options"
)

type Screen = frontend.Screen

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

const (
	websocketWriteWait     = 10 * time.Second
	websocketPongWait      = 60 * time.Second
	websocketPingPeriod    = websocketPongWait * 9 / 10
	websocketSendQueueSize = 256
)

var (
	errWebsocketClosed       = errors.New("websocket connection is closed")
	errWebsocketBackpressure = errors.New("websocket send queue is full")
)

type websocketMessage struct {
	messageType int
	payload     []byte
}

type WebsocketInfo struct {
	eventCache sync.Map
	user       *options.WebSocketUser
	request    options.WebSocketRequestMetadata
	conn       *websocket.Conn
	send       chan websocketMessage
	done       chan struct{}
	closeOnce  sync.Once
}

func newWebsocketInfo(conn *websocket.Conn, user *options.WebSocketUser, request *http.Request) *WebsocketInfo {
	info := &WebsocketInfo{
		user: user,
		conn: conn,
		send: make(chan websocketMessage, websocketSendQueueSize),
		done: make(chan struct{}),
	}
	info.request.User = user
	if request != nil {
		info.request.SourceIP = websocketPeerIP(request.RemoteAddr)
		info.request.ForwardedFor = strings.TrimSpace(request.Header.Get("X-Forwarded-For"))
		info.request.UserAgent = strings.TrimSpace(request.UserAgent())
	}
	return info
}

func websocketPeerIP(remoteAddr string) string {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return strings.TrimSpace(host)
	}
	return remoteAddr
}

func (i *WebsocketInfo) close() {
	i.closeOnce.Do(func() {
		close(i.done)
		if i.conn != nil {
			_ = i.conn.Close()
		}
	})
}

func (i *WebsocketInfo) enqueue(messageType int, payload []byte) error {
	message := websocketMessage{
		messageType: messageType,
		payload:     append([]byte(nil), payload...),
	}

	select {
	case <-i.done:
		return errWebsocketClosed
	default:
	}

	select {
	case <-i.done:
		return errWebsocketClosed
	case i.send <- message:
		return nil
	default:
		return errWebsocketBackpressure
	}
}

// connUserMap 映射 goroutineID → *WebsocketInfo，用于从消息处理 goroutine 查找对应连接的用户
var connUserMap sync.Map

type DevWebServer struct {
	server           *echo.Echo
	ctx              context.Context
	appoptions       *options.App
	logger           *logger.Logger
	appBindings      *binding.Bindings
	dispatcher       frontend.Dispatcher
	socketMutex      sync.Mutex
	websocketClients map[*websocket.Conn]*WebsocketInfo
	menuManager      *menumanager.Manager
	starttime        string

	// Desktop frontend
	frontend.Frontend

	devServerAddr string
}

func (d *DevWebServer) Run(ctx context.Context) error {
	d.ctx = ctx

	d.server.GET("/wails/reload", d.handleReload)
	d.server.GET("/wails/ipc", d.handleIPCWebSocket)

	assetServerConfig, err := assetserver.BuildAssetServerConfig(d.appoptions)
	if err != nil {
		return err
	}

	var myLogger assetserver.Logger
	if _logger := ctx.Value("logger"); _logger != nil {
		myLogger = _logger.(*logger.Logger)
	}

	var wsHandler http.Handler

	_fronendDevServerURL, _ := ctx.Value("frontenddevserverurl").(string)
	if _fronendDevServerURL == "" {
		assetdir, _ := ctx.Value("assetdir").(string)
		d.server.GET("/wails/assetdir", func(c echo.Context) error {
			return c.String(http.StatusOK, assetdir)
		})

	} else {
		externalURL, err := url.Parse(_fronendDevServerURL)
		if err != nil {
			return err
		}

		// WebSockets aren't currently supported in prod mode, so a WebSocket connection is the result of the
		// FrontendDevServer e.g. Vite to support auto reloads.
		// Therefore we direct WebSockets directly to the FrontendDevServer instead of returning a NotImplementedStatus.
		wsHandler = httputil.NewSingleHostReverseProxy(externalURL)
	}

	assetHandler, err := assetserver.NewAssetHandler(assetServerConfig, myLogger)
	if err != nil {
		log.Fatal(err)
	}

	// Setup internal dev server
	bindingsJSON, err := d.appBindings.ToJSON()
	if err != nil {
		log.Fatal(err)
	}

	assetServer, err := assetserver.NewDevAssetServer(assetHandler, bindingsJSON, ctx.Value("assetdir") != nil, myLogger, wailsruntime.RuntimeAssetsBundle)
	if err != nil {
		log.Fatal(err)
	}

	d.server.Any("/*", func(c echo.Context) error {
		if c.IsWebSocket() {
			wsHandler.ServeHTTP(c.Response(), c.Request())
		} else {
			assetServer.ServeHTTP(c.Response(), c.Request())
		}
		return nil
	})

	if devServerAddr := d.devServerAddr; devServerAddr != "" {
		// Start server
		d.server.StdLogger = log.New(io.Discard, "", 0)

		go func(server *echo.Echo, log *logger.Logger) {
			var err2 error
			if d.appoptions.WebSocket.Server != nil {
				err2 = server.StartServer(d.appoptions.WebSocket.Server)
			} else {
				err2 = server.Start(devServerAddr)
			}
			if err2 != nil {
				log.Error("%s", err2.Error())
			}
			d.LogDebug("Shutdown completed")
		}(d.server, d.logger)

		d.LogDebug("Serving DevServer at http://%s", devServerAddr)
	}

	// Launch desktop app
	err = d.Frontend.Run(ctx)

	return err
}

func (d *DevWebServer) WindowReload() {
	d.broadcast("reload", "")
	d.Frontend.WindowReload()
}

func (d *DevWebServer) WindowReloadApp() {
	d.broadcast("reloadapp", "")
	d.Frontend.WindowReloadApp()
}

func (d *DevWebServer) Notify(name string, data ...interface{}) {
	d.notify(name, data...)
}

func (d *DevWebServer) handleReload(c echo.Context) error {
	d.WindowReload()
	return c.NoContent(http.StatusNoContent)
}

func (d *DevWebServer) handleReloadApp(c echo.Context) error {
	d.WindowReloadApp()
	return c.NoContent(http.StatusNoContent)
}

func (d *DevWebServer) handleIPCWebSocket(c echo.Context) error {
	// 先完成 WebSocket upgrade，再做认证
	// 原因：浏览器 WebSocket API 在握手失败时拿不到 HTTP 响应体，
	// 只有 upgrade 成功后通过 CloseMessage 发送的 reason 才能被前端 onclose 读取
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		d.logger.Error("WebSocket upgrade failed %v", err)
		return err
	}

	// WebSocket 认证
	var wsUser *options.WebSocketUser
	if d.appoptions.WebSocket.AuthHandler != nil {
		token := c.QueryParam("token")
		if token == "" {
			d.logger.Debug("WebSocket auth failed: missing token")
			conn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(4001, "missing token"))
			conn.Close()
			return nil
		}
		u, err := d.appoptions.WebSocket.AuthHandler(token)
		if err != nil {
			d.logger.Error("WebSocket auth failed: invalid token")
			conn.WriteMessage(websocket.CloseMessage,
				websocket.FormatCloseMessage(4001, "invalid token"))
			conn.Close()
			return nil
		}
		wsUser = u
	}

	d.LogDebug(fmt.Sprintf("WebSocket client %p connected", conn))

	info := newWebsocketInfo(conn, wsUser, c.Request())
	_ = conn.SetReadDeadline(time.Now().Add(websocketPongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(websocketPongWait))
	})

	d.socketMutex.Lock()
	d.websocketClients[conn] = info
	d.socketMutex.Unlock()

	go d.runWebsocketWriter(info)

	defer func() {
		d.removeWebsocketClient(conn, info)
		d.LogDebug(fmt.Sprintf("WebSocket client %p disconnected", conn))
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		message := string(msg)
		if d.handleConnectionControlMessage(message, info) {
			continue
		}

		go d.processWebsocketMessage(message, info)
	}

	return nil
}

func (d *DevWebServer) handleConnectionControlMessage(message string, info *WebsocketInfo) bool {
	if d.handleRuntimeMessage(message) {
		return true
	}

	if len(message) <= 2 {
		return false
	}

	switch message[:2] {
	case "EB":
		// Binding must be applied in the reader goroutine before a following RPC
		// is dispatched. Otherwise a synchronous EventsEmit from that RPC can be
		// filtered out before this connection's subscription becomes visible.
		info.eventCache.Store(message[2:], true)
		return true
	case "EX":
		// Keep the connection-local filter ordered with surrounding messages.
		// The dispatcher still processes EX asynchronously for Go listeners.
		info.eventCache.Delete(message[2:])
	}

	return false
}

func (d *DevWebServer) processWebsocketMessage(message string, info *WebsocketInfo) {
	// 标记当前 goroutine 对应的连接，用于 GetCurrentUser 查找用户
	gid := devCurGoroutineID()
	connUserMap.Store(gid, info)
	defer connUserMap.Delete(gid)

	// Notify the other browsers of "EventEmit".
	if len(message) > 2 && message[:2] == "EE" {
		d.notifyExcludingSender([]byte(message), info.conn)
	}

	// dispatcher.ProcessMessage 内部自动调用 sender.(UserProvider).GetCurrentUser()
	result, err := d.dispatcher.ProcessMessage(message, d)
	if err != nil {
		d.logger.Error("%s", err.Error())
	}

	if result == "" {
		return
	}
	if err := d.sendWebsocketMessage(info, websocket.TextMessage, []byte(result)); err != nil && !errors.Is(err, errWebsocketClosed) && !errors.Is(err, errWebsocketBackpressure) {
		d.logger.Error("Websocket write message failed: %v", err)
	}
}

func (d *DevWebServer) runWebsocketWriter(info *WebsocketInfo) {
	pingTicker := time.NewTicker(websocketPingPeriod)
	defer pingTicker.Stop()
	defer info.close()

	for {
		select {
		case message := <-info.send:
			_ = info.conn.SetWriteDeadline(time.Now().Add(websocketWriteWait))
			if err := info.conn.WriteMessage(message.messageType, message.payload); err != nil {
				d.logger.Error("Websocket write message failed: %v", err)
				return
			}
		case <-pingTicker.C:
			_ = info.conn.SetWriteDeadline(time.Now().Add(websocketWriteWait))
			if err := info.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				d.logger.Error("Websocket ping failed: %v", err)
				return
			}
		case <-info.done:
			return
		}
	}
}

func (d *DevWebServer) sendWebsocketMessage(info *WebsocketInfo, messageType int, payload []byte) error {
	err := info.enqueue(messageType, payload)
	if errors.Is(err, errWebsocketBackpressure) {
		d.logger.Error("Closing slow websocket client %p: %v", info.conn, err)
		d.removeWebsocketClient(info.conn, info)
	}
	return err
}

func (d *DevWebServer) removeWebsocketClient(conn *websocket.Conn, info *WebsocketInfo) {
	d.socketMutex.Lock()
	if current, ok := d.websocketClients[conn]; ok && current == info {
		delete(d.websocketClients, conn)
	}
	d.socketMutex.Unlock()
	info.close()
}

func (d *DevWebServer) handleRuntimeMessage(message string) bool {
	switch message {
	case "drag":
		return true
	case "runtime:ready":
		if d.appoptions != nil && d.appoptions.OnDomReady != nil {
			go d.appoptions.OnDomReady(d.ctx)
		}
		return true
	default:
		return false
	}
}

func (d *DevWebServer) LogDebug(message string, args ...interface{}) {
	d.logger.Debug("[DevWebServer] "+message, args...)
}

type EventNotify struct {
	Name string        `json:"name"`
	Data []interface{} `json:"data"`
}

func (d *DevWebServer) broadcast(message string, name string) {
	d.socketMutex.Lock()
	clients := make([]*WebsocketInfo, 0, len(d.websocketClients))
	for client, v := range d.websocketClients {
		if client != nil && v != nil {
			clients = append(clients, v)
		}
	}
	d.socketMutex.Unlock()

	for _, info := range clients {
		// 完成未监听事件的过滤
		if name != "" {
			if _, ok := info.eventCache.Load(name); !ok {
				continue
			}
		}
		if err := d.sendWebsocketMessage(info, websocket.TextMessage, []byte(message)); err != nil && !errors.Is(err, errWebsocketClosed) && !errors.Is(err, errWebsocketBackpressure) {
			d.logger.Error("%s", err.Error())
		}
	}
}

func (d *DevWebServer) notify(name string, data ...interface{}) {
	// Notify
	notification := EventNotify{
		Name: name,
		Data: data,
	}
	payload, err := json.Marshal(notification)
	if err != nil {
		d.logger.Error("%s", err.Error())
		return
	}
	d.broadcast("n"+string(payload), name)
}

func (d *DevWebServer) broadcastExcludingSender(message string, sender *websocket.Conn) {
	d.socketMutex.Lock()
	clients := make([]*WebsocketInfo, 0, len(d.websocketClients))
	for client, v := range d.websocketClients {
		if client != sender && client != nil && v != nil {
			clients = append(clients, v)
		}
	}
	d.socketMutex.Unlock()

	for _, info := range clients {
		if err := d.sendWebsocketMessage(info, websocket.TextMessage, []byte(message)); err != nil && !errors.Is(err, errWebsocketClosed) && !errors.Is(err, errWebsocketBackpressure) {
			d.logger.Error("%s", err.Error())
		}
	}
}

func (d *DevWebServer) notifyExcludingSender(eventMessage []byte, sender *websocket.Conn) {
	message := "n" + string(eventMessage[2:])
	d.broadcastExcludingSender(message, sender)

	var notifyMessage EventNotify
	err := json.Unmarshal(eventMessage[2:], &notifyMessage)
	if err != nil {
		d.logger.Error("%s", err.Error())
		return
	}
	d.Frontend.Notify(notifyMessage.Name, notifyMessage.Data...)
}

// GetCurrentUser 实现 dispatcher.UserProvider 接口
// 通过当前 goroutineID 查找对应的 websocket 连接，返回连接关联的用户信息
func (d *DevWebServer) GetCurrentUser() *options.WebSocketUser {
	gid := devCurGoroutineID()
	if v, ok := connUserMap.Load(gid); ok {
		return v.(*WebsocketInfo).user
	}
	return nil
}

// GetCurrentRequestMetadata implements dispatcher.RequestMetadataProvider.
func (d *DevWebServer) GetCurrentRequestMetadata() options.WebSocketRequestMetadata {
	gid := devCurGoroutineID()
	if v, ok := connUserMap.Load(gid); ok {
		return v.(*WebsocketInfo).request
	}
	return options.WebSocketRequestMetadata{}
}

func devCurGoroutineID() uint64 {
	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	s := strings.TrimPrefix(string(buf[:n]), "goroutine ")
	s = s[:strings.IndexByte(s, ' ')]
	id, _ := strconv.ParseUint(s, 10, 64)
	return id
}

func NewFrontend(ctx context.Context, appoptions *options.App, myLogger *logger.Logger, appBindings *binding.Bindings, dispatcher frontend.Dispatcher, menuManager *menumanager.Manager, desktopFrontend frontend.Frontend) *DevWebServer {
	result := &DevWebServer{
		ctx:              ctx,
		Frontend:         desktopFrontend,
		appoptions:       appoptions,
		logger:           myLogger,
		appBindings:      appBindings,
		dispatcher:       dispatcher,
		server:           echo.New(),
		menuManager:      menuManager,
		websocketClients: make(map[*websocket.Conn]*WebsocketInfo),
	}

	result.devServerAddr, _ = ctx.Value("devserver").(string)
	result.server.HideBanner = true
	result.server.HidePort = true
	return result
}
