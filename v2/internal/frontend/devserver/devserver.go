//go:build dev
// +build dev

// Package devserver provides a web-based frontend so that
// it is possible to run a Wails app in a browsers.
package devserver

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "net/http/httputil"
    "net/url"
    "sync"

    "github.com/wailsapp/wails/v2/pkg/assetserver"

    "github.com/wailsapp/wails/v2/internal/frontend/runtime"

    "golang.org/x/net/websocket"
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

type WebsocketInfo struct {
    locker sync.Mutex
    eventCache sync.Map
}
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

    assetServer, err := assetserver.NewDevAssetServer(assetHandler, bindingsJSON, ctx.Value("assetdir") != nil, myLogger, runtime.RuntimeAssetsBundle)
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
                log.Error(err2.Error())
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
    conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
    if err != nil {
        d.logger.Error("WebSocket upgrade failed %v", err)
        return err
    }
    d.LogDebug(fmt.Sprintf("WebSocket client %p connected", conn))

    d.socketMutex.Lock()
    d.websocketClients[conn] = &WebsocketInfo{}
    locker := d.websocketClients[conn]
    d.socketMutex.Unlock()

    var wg sync.WaitGroup

    defer func() {
        wg.Wait()
        d.socketMutex.Lock()
        delete(d.websocketClients, conn)
        d.socketMutex.Unlock()
        d.LogDebug(fmt.Sprintf("WebSocket client %p disconnected", conn))
        conn.Close()
    }()

    for {
        var fullMsg []byte
        var msg []byte
        _, msg, err = conn.ReadMessage()
        if err != nil {
            break
        }
        buffer := bytes.Buffer{}
        buffer.Write(msg)

        // 修复websocket分帧导致数据不完整
        if bytes.HasPrefix(msg, []byte(`C{"`)) {
            for {
                if bytes.HasSuffix(msg, []byte(`"}`)) {
                    break
                }
                msg = make([]byte, 0)
                _, msg, err = conn.ReadMessage()
                if err != nil {
                    return 
                }
                buffer.Write(msg)
            }
        }
        wg.Add(1)
        fullMsg = buffer.Bytes()
        buffer.Reset()

        
        go func(m string) {
            defer wg.Done()

            if m == "drag" {
                return
            }

            // Notify the other browsers of "EventEmit"
            if len(m) > 2 {
                switch m[:2] {
                case "EE":
                    d.notifyExcludingSender([]byte(m), conn)
                    // 2025年3月11日13:49:59
                    // 实现ws连接和事件绑定
                case "EB":
                    info.eventCache.Store(m[2:], true)
                    return
                case "EX":
                    info.eventCache.Delete(m[2:])
                }
            }

            result, err := d.dispatcher.ProcessMessage(m, d)
            if err != nil {
                d.logger.Error(err.Error())
            }

            if result != "" {
                locker.Lock()
                defer locker.Unlock()
                if err := conn.WriteMessage(websocket.TextMessage, []byte(result)); err != nil {
                    d.logger.Error("Websocket write message failed %v", err)
                }
            }
        }(string(fullMsg))
    }

    return nil
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
    defer d.socketMutex.Unlock()
    for client, v := range d.websocketClients {
        go func(client *websocket.Conn, info *WebsocketInfo) {
            if client == nil {
                d.logger.Error("Lost connection to websocket server")
                return
            }
            info.locker.Lock()
            defer info.locker.Unlock()
            // 2025年3月11日13:50:36
            // 完成未监听事件的过滤
            if name != "" {
                if _, ok := info.eventCache.Load(name); !ok {
                    return
                }
            }

            err := client.WriteMessage(websocket.TextMessage, []byte(message))
            if err != nil {
                d.logger.Error(err.Error())
                return
            }
        }(client, v)
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
        d.logger.Error(err.Error())
        return
    }
    d.broadcast("n"+string(payload), name)
}

func (d *DevWebServer) broadcastExcludingSender(message string, sender *websocket.Conn) {
    d.socketMutex.Lock()
    defer d.socketMutex.Unlock()
    for client, v := range d.websocketClients {
        go func(client *websocket.Conn, info *WebsocketInfo) {
            if client == sender {
                return
            }
            info.locker.Lock()
            defer info.locker.Unlock()
            err := client.WriteMessage(websocket.TextMessage, []byte(message))
            if err != nil {
                d.logger.Error(err.Error())
                return
            }
        }(client, v)
    }
}

func (d *DevWebServer) notifyExcludingSender(eventMessage []byte, sender *websocket.Conn) {
    message := "n" + string(eventMessage[2:])
    d.broadcastExcludingSender(message, sender)

    var notifyMessage EventNotify
    err := json.Unmarshal(eventMessage[2:], &notifyMessage)
    if err != nil {
        d.logger.Error(err.Error())
        return
    }
    d.Frontend.Notify(notifyMessage.Name, notifyMessage.Data...)
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
