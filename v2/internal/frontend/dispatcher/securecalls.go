package dispatcher

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/internal/frontend"
	"github.com/wailsapp/wails/v2/pkg/options"
)

type secureCallMessage struct {
	ID         int               `json:"id"`
	Args       []json.RawMessage `json:"args"`
	CallbackID string            `json:"callbackID"`
}

func (d *Dispatcher) processSecureCallMessage(message string, sender frontend.Frontend) (string, error) {
	var payload secureCallMessage
	err := json.Unmarshal([]byte(message[1:]), &payload)
	if err != nil {
		return "", err
	}

	var result interface{}

	// Lookup method
	registeredMethod := d.bindingsDB.GetObfuscatedMethod(payload.ID)
	methodName := fmt.Sprintf("obfuscated:%d", payload.ID)
	if registeredMethod != nil && registeredMethod.Path != nil {
		methodName = registeredMethod.Path.FullName()
	}
	startedAt := time.Now()
	var auditResult interface{}
	var auditErr error
	defer func() {
		if recovered := recover(); recovered != nil {
			d.emitWebSocketAudit(sender, options.WebSocketAuditEvent{
				Timestamp:  startedAt,
				Duration:   time.Since(startedAt),
				Method:     methodName,
				Arguments:  payload.Args,
				CallbackID: payload.CallbackID,
				Err:        fmt.Errorf("panic: %v", recovered),
			})
			panic(recovered)
		}
		d.emitWebSocketAudit(sender, options.WebSocketAuditEvent{
			Timestamp:  startedAt,
			Duration:   time.Since(startedAt),
			Method:     methodName,
			Arguments:  payload.Args,
			CallbackID: payload.CallbackID,
			Result:     auditResult,
			Err:        auditErr,
		})
	}()

	// Check we have it
	if registeredMethod == nil {
		auditErr = fmt.Errorf("method '%d' not registered", payload.ID)
		return "", auditErr
	}

	args, err2 := registeredMethod.ParseArgs(payload.Args)
	if err2 != nil {
		errmsg := fmt.Errorf("error parsing arguments: %s", err2.Error())
		auditErr = errmsg
		result, _ := d.NewErrorCallback(errmsg.Error(), payload.CallbackID)
		return result, errmsg
	}
	result, err = registeredMethod.Call(args)
	auditResult = result
	auditErr = err

	callbackMessage := &CallbackMessage{
		CallbackID: payload.CallbackID,
	}
	if err != nil {
		callbackMessage.Err = err.Error()
	} else {
		callbackMessage.Result = result
	}
	messageData, err := json.Marshal(callbackMessage)
	d.log.Trace("json call result data: %+v\n", string(messageData))
	if err != nil {
		// what now?
		d.log.Fatal(err.Error())
	}

	return "c" + string(messageData), nil
}
