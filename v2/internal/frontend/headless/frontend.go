package headless

import (
	"context"
	"errors"
	"sync"

	"github.com/wailsapp/wails/v2/internal/binding"
	"github.com/wailsapp/wails/v2/internal/frontend"
	"github.com/wailsapp/wails/v2/internal/logger"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/options"
)

var errUnavailable = errors.New("not available in headless mode")

type Frontend struct {
	ctx             context.Context
	frontendOptions *options.App
	done            chan struct{}
	once            sync.Once
}

func NewFrontend(ctx context.Context, frontendOptions *options.App, _ *logger.Logger, _ *binding.Bindings, _ frontend.Dispatcher) *Frontend {
	return &Frontend{
		ctx:             ctx,
		frontendOptions: frontendOptions,
		done:            make(chan struct{}),
	}
}

func (f *Frontend) Run(ctx context.Context) error {
	f.ctx = ctx
	if f.frontendOptions != nil && f.frontendOptions.OnStartup != nil {
		go f.frontendOptions.OnStartup(f.ctx)
	}
	return nil
}

func (f *Frontend) RunMainLoop() {
	<-f.done
}

func (f *Frontend) ExecJS(string) {}

func (f *Frontend) Hide() {}

func (f *Frontend) Show() {}

func (f *Frontend) Quit() {
	f.once.Do(func() {
		close(f.done)
	})
}

func (f *Frontend) OpenFileDialog(frontend.OpenDialogOptions) (string, error) {
	return "", errUnavailable
}

func (f *Frontend) OpenMultipleFilesDialog(frontend.OpenDialogOptions) ([]string, error) {
	return nil, errUnavailable
}

func (f *Frontend) OpenDirectoryDialog(frontend.OpenDialogOptions) (string, error) {
	return "", errUnavailable
}

func (f *Frontend) SaveFileDialog(frontend.SaveDialogOptions) (string, error) {
	return "", errUnavailable
}

func (f *Frontend) MessageDialog(frontend.MessageDialogOptions) (string, error) {
	return "", errUnavailable
}

func (f *Frontend) WindowSetTitle(string) {}

func (f *Frontend) WindowShow() {}

func (f *Frontend) WindowHide() {}

func (f *Frontend) WindowCenter() {}

func (f *Frontend) WindowToggleMaximise() {}

func (f *Frontend) WindowMaximise() {}

func (f *Frontend) WindowUnmaximise() {}

func (f *Frontend) WindowMinimise() {}

func (f *Frontend) WindowUnminimise() {}

func (f *Frontend) WindowSetAlwaysOnTop(bool) {}

func (f *Frontend) WindowSetPosition(int, int) {}

func (f *Frontend) WindowGetPosition() (int, int) {
	return 0, 0
}

func (f *Frontend) WindowSetSize(int, int) {}

func (f *Frontend) WindowGetSize() (int, int) {
	return 0, 0
}

func (f *Frontend) WindowSetMinSize(int, int) {}

func (f *Frontend) WindowSetMaxSize(int, int) {}

func (f *Frontend) WindowFullscreen() {}

func (f *Frontend) WindowUnfullscreen() {}

func (f *Frontend) WindowSetBackgroundColour(*options.RGBA) {}

func (f *Frontend) WindowReload() {}

func (f *Frontend) WindowReloadApp() {}

func (f *Frontend) WindowSetSystemDefaultTheme() {}

func (f *Frontend) WindowSetLightTheme() {}

func (f *Frontend) WindowSetDarkTheme() {}

func (f *Frontend) WindowIsMaximised() bool {
	return false
}

func (f *Frontend) WindowIsMinimised() bool {
	return false
}

func (f *Frontend) WindowIsNormal() bool {
	return true
}

func (f *Frontend) WindowIsFullscreen() bool {
	return false
}

func (f *Frontend) WindowClose() {
	f.Quit()
}

func (f *Frontend) WindowPrint() {}

func (f *Frontend) ScreenGetAll() ([]frontend.Screen, error) {
	return nil, errUnavailable
}

func (f *Frontend) MenuSetApplicationMenu(*menu.Menu) {}

func (f *Frontend) MenuUpdateApplicationMenu() {}

func (f *Frontend) Notify(string, ...interface{}) {}

func (f *Frontend) BrowserOpenURL(string) {}

func (f *Frontend) ClipboardGetText() (string, error) {
	return "", errUnavailable
}

func (f *Frontend) ClipboardSetText(string) error {
	return errUnavailable
}
