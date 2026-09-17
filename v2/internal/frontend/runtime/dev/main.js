/*
 _       __      _ __
| |     / /___ _(_) /____
| | /| / / __ `/ / / ___/
| |/ |/ / /_/ / / (__  )
|__/|__/\__,_/_/_/____/
The electron alternative for Go
(c) Lea Anthony 2019-present
*/
/* jshint esversion: 6 */

import {log} from "./log";
import Overlay from "./Overlay.svelte";
import {hideOverlay, showOverlay} from "./store";
import {getBrowserID} from "./browser_id";

let components = {};

let wailsInvokeInternal = null;
let messageQueue = [];

window.WailsInvoke = (message) => {
    if (!wailsInvokeInternal) {
        queueMessage(message);
        return;
    }
    wailsInvokeInternal(message);
};

window.addEventListener('DOMContentLoaded', () => {
    components.overlay = new Overlay({
        target: document.body,
        anchor: document.querySelector('#wails-spinner'),
    });
});

let websocket = null;
let connectTimer;

function isWebSocketOpen() {
    return websocket && websocket.readyState === WebSocket.OPEN;
}

function queueMessage(message) {
    console.log("Queueing: " + message);
    messageQueue.push(message);
}

function resetIPCBridge() {
    wailsInvokeInternal = null;
}

window.onbeforeunload = function () {
    if (websocket) {
        websocket.onclose = function () {
        };
        websocket.close();
        websocket = null;
    }
};

// ...and attempt to connect
connect();

function setupIPCBridge() {
    wailsInvokeInternal = (message) => {
        if (!isWebSocketOpen()) {
            queueMessage(message);
            return;
        }
        websocket.send(message);
    };
}

function flushMessageQueue() {
    const queuedMessages = messageQueue;
    messageQueue = [];
    for (let i = 0; i < queuedMessages.length; i++) {
        console.log("sending queued message: " + queuedMessages[i]);
        window.WailsInvoke(queuedMessages[i]);
    }
}

// Handles incoming websocket connections
function handleConnect() {
    log('Connected to backend');
    hideOverlay();
    setupIPCBridge();
    clearInterval(connectTimer);
    websocket.onclose = handleDisconnect;
    websocket.onmessage = handleMessage;

    // Rebuild the connection-local subscription filter before replaying calls
    // queued while disconnected. The websocket preserves send order, and the
    // backend applies EB/EX in its reader goroutine, so a queued RPC cannot
    // emit its result before its listener is visible.
    window.runtime.EventsRebind();
    flushMessageQueue();
}

// Handles websocket disconnects
function handleDisconnect(e) {
    log('Disconnected from backend');
    websocket = null;
    resetIPCBridge();
    showOverlay();
    // Auth 错误不重连，避免无限循环
    if (e && e.code >= 4000 && e.code < 5000) {
        console.error('[Wails IPC] Auth failed (code ' + e.code + '): ' + e.reason);
        promptForWebSocketToken(e.reason || 'auth failed');
        return;
    }
    connect();
}

function promptForWebSocketToken(reason) {
    if (!window.prompt) {
        return;
    }
    const currentToken = localStorage.getItem('token') || '';
    const token = window.prompt('WebSocket authentication failed: ' + reason + '\nPlease enter SSO token:', currentToken);
    if (!token || !token.trim()) {
        return;
    }
    localStorage.setItem('token', token.trim());
    connect();
}

let protocol = null;
let host = null;

function _connect() {
    if (websocket == null) {
        get_host();
        const token = localStorage.getItem('token') || '';
        const params = new URLSearchParams();
        if (token) {
            params.set('token', token);
        }
        const browserID = getBrowserID();
        if (browserID) {
            params.set('browser_id', browserID);
        }
        const queryString = params.toString();
        const query = queryString ? '?' + queryString : '';
        websocket = new WebSocket((protocol.startsWith("https") ? "wss://" : "ws://") + host + "/wails/ipc" + query);
        websocket.onopen = handleConnect;
        websocket.onerror = function (e) {
            console.error('[Wails IPC] WebSocket error:', e);
            e.stopImmediatePropagation();
            e.stopPropagation();
            e.preventDefault();
            websocket = null;
            resetIPCBridge();
            return false;
        };
    }
}
function get_host() {
    if (host) {
        return
    }
    const currentScript = document.currentScript || (function () {
        const scripts = document.getElementsByTagName('script');
        return scripts[scripts.length - 1];
    })();

    if (currentScript) {
        const scriptSrc = currentScript.src;
        const scriptURL = new URL(scriptSrc);
        host = scriptURL.host; // 获取脚本文件的host
        protocol = scriptURL.protocol;
    } else {
        host = window.location.host;
        protocol = window.location.protocol;
    }
}

// Try to connect to the backend every .5s
function connect() {
    _connect();
    connectTimer = setInterval(_connect, 500);
}

function handleMessage(message) {

    if (message.data === "reload") {
        window.runtime.WindowReload();
        return;
    }
    if (message.data === "reloadapp") {
        window.runtime.WindowReloadApp()
        return;
    }

    // As a bridge we ignore js and css injections
    switch (message.data[0]) {
        // Notifications
        case 'n':
            window.wails.EventsNotify(message.data.slice(1));
            break;
        case 'c':
            const callbackData = message.data.slice(1);
            window.wails.Callback(callbackData);
            break;
        default:
            log('Unknown message: ' + message.data);
    }
}
