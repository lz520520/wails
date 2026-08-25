package dispatcher

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/wailsapp/wails/v2/internal/binding"
	"github.com/wailsapp/wails/v2/internal/logger"
	"github.com/wailsapp/wails/v2/pkg/options"
)

type AuditBinding struct{}

func (AuditBinding) Echo(value string) string {
	return value
}

func TestProcessCallMessageEmitsWebSocketAudit(t *testing.T) {
	internalLogger := logger.New(nil)
	bindings := binding.NewBindings(internalLogger, []interface{}{&AuditBinding{}}, nil, false, nil)
	events := make(chan options.WebSocketAuditEvent, 1)
	dispatcher := NewDispatcher(
		context.Background(),
		internalLogger,
		bindings,
		nil,
		nil,
		false,
		func(event options.WebSocketAuditEvent) { events <- event },
	)
	method := "dispatcher.AuditBinding.Echo"
	payload, err := json.Marshal(callMessage{
		Name:       method,
		Args:       []json.RawMessage{json.RawMessage(`"hello"`)},
		CallbackID: "callback-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := dispatcher.ProcessMessage("C"+string(payload), nil); err != nil {
		t.Fatalf("process call: %v", err)
	}
	event := <-events
	if event.Method != method || event.CallbackID != "callback-1" || event.Err != nil {
		t.Fatalf("unexpected audit event: %+v", event)
	}
	if result, ok := event.Result.(string); !ok || result != "hello" {
		t.Fatalf("audit result = %#v", event.Result)
	}
}
