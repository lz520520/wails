package dispatcher

import (
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/options"
)

// UserProvider 由 devserver 实现，桌面端不实现（自动跳过）
type UserProvider interface {
	GetCurrentUser() *options.WebSocketUser
}

var requestUserStore sync.Map // goroutineID → *options.WebSocketUser

func SetRequestUser(user *options.WebSocketUser) {
	if user != nil {
		requestUserStore.Store(curGoroutineID(), user)
	}
}

func ClearRequestUser() {
	requestUserStore.Delete(curGoroutineID())
}

func GetRequestUser() *options.WebSocketUser {
	if v, ok := requestUserStore.Load(curGoroutineID()); ok {
		return v.(*options.WebSocketUser)
	}
	return nil
}

func curGoroutineID() uint64 {
	var buf [64]byte
	n := runtime.Stack(buf[:], false)
	s := strings.TrimPrefix(string(buf[:n]), "goroutine ")
	s = s[:strings.IndexByte(s, ' ')]
	id, _ := strconv.ParseUint(s, 10, 64)
	return id
}

func init() {
	// 注册到 options 公开包，Level6 通过 options.GetRequestUser 调用
	options.GetRequestUser = GetRequestUser
}
