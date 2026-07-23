package headless

import (
	"context"
	"testing"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
)

func TestRunMainLoopStopsOnQuit(t *testing.T) {
	f := NewFrontend(context.Background(), nil, nil, nil, nil)
	done := make(chan struct{})

	go func() {
		f.RunMainLoop()
		close(done)
	}()

	select {
	case <-done:
		t.Fatal("RunMainLoop returned before Quit")
	case <-time.After(20 * time.Millisecond):
	}

	f.Quit()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("RunMainLoop did not return after Quit")
	}
}

func TestRunCallsStartupWithRuntimeContext(t *testing.T) {
	runtimeCtx := context.WithValue(context.Background(), "events", "runtime-events")
	startupCtx := make(chan context.Context, 1)
	f := NewFrontend(context.Background(), &options.App{
		OnStartup: func(ctx context.Context) {
			startupCtx <- ctx
		},
	}, nil, nil, nil)

	if err := f.Run(runtimeCtx); err != nil {
		t.Fatalf("Run returned error: %v", err)
	}

	select {
	case got := <-startupCtx:
		if got != runtimeCtx {
			t.Fatal("OnStartup did not receive the runtime context")
		}
	case <-time.After(time.Second):
		t.Fatal("OnStartup was not called")
	}
}
