//go:build dev
// +build dev

package devserver

import (
	"context"
	"testing"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
)

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
