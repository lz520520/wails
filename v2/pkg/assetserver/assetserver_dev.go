//go:build dev
// +build dev

package assetserver

import (
    "net/http"
    "strings"
)

/*
The assetserver for the dev mode.
Depending on the UserAgent it injects a websocket based IPC script into `index.html` or the default desktop IPC. The
default desktop IPC is injected when the webview accesses the devserver.
*/
func NewDevAssetServer(handler http.Handler, bindingsJSON string, servingFromDisk bool, logger Logger, runtime RuntimeAssets) (*AssetServer, error) {
    result, err := NewAssetServerWithHandler(handler, bindingsJSON, servingFromDisk, logger, runtime)
    if err != nil {
        return nil, err
    }

    result.appendSpinnerToBody = true
    result.ipcJS = func(req *http.Request) []byte {
        if strings.Contains(req.UserAgent(), WailsUserAgentValue) {
            return runtime.DesktopIPC()
        }
        ipc := runtime.WebsocketIPC()

        //if address, ok := os.LookupEnv("websocket_address"); ok {
        //    ipc = bytes.ReplaceAll(ipc, []byte("window.location.host"), []byte(fmt.Sprintf(`"%s"`, address)))
        //}
        //if protocol, ok := os.LookupEnv("websocket_protocol"); ok {
        //    ipc = bytes.ReplaceAll(ipc, []byte(`window.location.protocol.indexOf("https")`), []byte(fmt.Sprintf(`"%s".indexOf("wss")`, protocol)))
        //}

        return ipc
    }

    return result, nil
}
