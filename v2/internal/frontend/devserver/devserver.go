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
    "runtime"
    "strconv"
    "strings"
    "sync"

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

type WebsocketInfo struct {
    locker     sync.Mutex
    eventCache sync.Map
    user       *options.WebSocketUser
}

// connUserMap 映射 goroutineID → *websocket.Conn，用于从消息处理 goroutine 查找对应连接的用户
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
            d.logger.Error("WebSocket auth failed: missing token")
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

    d.socketMutex.Lock()
    d.websocketClients[conn] = &WebsocketInfo{user: wsUser}
    info := d.websocketClients[conn]
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
                    return err
                }
                buffer.Write(msg)
            }
        }
        wg.Add(1)
        fullMsg = buffer.Bytes()
        buffer.Reset()

        go func(m string, conn *websocket.Conn) {
            defer wg.Done()

            // 标记当前 goroutine 对应的连接，用于 GetCurrentUser 查找用户
            gid := devCurGoroutineID()
            connUserMap.Store(gid, conn)
            defer connUserMap.Delete(gid)

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
                    //d.logger.Debug("Bind Event: %s", m[2:])
                    info.eventCache.Store(m[2:], true)
                    return
                case "EX":
                    //d.logger.Debug("Release Event: %s", m[2:])
                    info.eventCache.Delete(m[2:])
                }
            }

            // dispatcher.ProcessMessage 内部自动调用 sender.(UserProvider).GetCurrentUser()
            result, err := d.dispatcher.ProcessMessage(m, d)
            if err != nil {
                d.logger.Error(err.Error())
            }

            if result != "" {
                info.locker.Lock()
                defer info.locker.Unlock()
                if err := conn.WriteMessage(websocket.TextMessage, []byte(result)); err != nil {
                    d.logger.Error("Websocket write message failed %v", err)
                }
            }
        }(string(fullMsg), conn)
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
                //d.logger.Debug("Emit Event: %s",name)
                if _, ok := info.eventCache.Load(name); !ok {
                    return
                }
                //d.logger.Debug("Found Event: %s",name)
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

// GetCurrentUser 实现 dispatcher.UserProvider 接口
// 通过当前 goroutineID 查找对应的 websocket 连接，返回连接关联的用户信息
func (d *DevWebServer) GetCurrentUser() *options.WebSocketUser {
    gid := devCurGoroutineID()
    if v, ok := connUserMap.Load(gid); ok {
        conn := v.(*websocket.Conn)
        d.socketMutex.Lock()
        info := d.websocketClients[conn]
        d.socketMutex.Unlock()
        if info != nil {
            return info.user
        }
    }
    return nil
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
