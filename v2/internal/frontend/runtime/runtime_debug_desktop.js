(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // desktop/log.js
  var log_exports = {};
  __export(log_exports, {
    LogDebug: () => LogDebug,
    LogError: () => LogError,
    LogFatal: () => LogFatal,
    LogInfo: () => LogInfo,
    LogLevel: () => LogLevel,
    LogPrint: () => LogPrint,
    LogTrace: () => LogTrace,
    LogWarning: () => LogWarning,
    SetLogLevel: () => SetLogLevel
  });
  function sendLogMessage(level, message) {
    window.WailsInvoke("L" + level + message);
  }
  function LogTrace(message) {
    sendLogMessage("T", message);
  }
  function LogPrint(message) {
    sendLogMessage("P", message);
  }
  function LogDebug(message) {
    sendLogMessage("D", message);
  }
  function LogInfo(message) {
    sendLogMessage("I", message);
  }
  function LogWarning(message) {
    sendLogMessage("W", message);
  }
  function LogError(message) {
    sendLogMessage("E", message);
  }
  function LogFatal(message) {
    sendLogMessage("F", message);
  }
  function SetLogLevel(loglevel) {
    sendLogMessage("S", loglevel);
  }
  var LogLevel = {
    TRACE: 1,
    DEBUG: 2,
    INFO: 3,
    WARNING: 4,
    ERROR: 5
  };

  // desktop/events.js
  var Listener = class {
    constructor(eventName, callback, maxCallbacks) {
      this.eventName = eventName;
      this.maxCallbacks = maxCallbacks || -1;
      this.Callback = (data) => {
        callback.apply(null, data);
        if (this.maxCallbacks === -1) {
          return false;
        }
        this.maxCallbacks -= 1;
        return this.maxCallbacks === 0;
      };
    }
  };
  var eventListeners = {};
  function EventsOnMultiple(eventName, callback, maxCallbacks) {
    eventListeners[eventName] = eventListeners[eventName] || [];
    const thisListener = new Listener(eventName, callback, maxCallbacks);
    eventListeners[eventName].push(thisListener);
    window.WailsInvoke("EB" + eventName);
    return () => listenerOff(thisListener);
  }
  function EventsRebind() {
    for (let key in eventListeners) {
      window.WailsInvoke("EB" + key);
    }
  }
  function EventsOn(eventName, callback) {
    return EventsOnMultiple(eventName, callback, -1);
  }
  function EventsOnce(eventName, callback) {
    return EventsOnMultiple(eventName, callback, 1);
  }
  function notifyListeners(eventData) {
    let eventName = eventData.name;
    const newEventListenerList = eventListeners[eventName]?.slice() || [];
    if (newEventListenerList.length) {
      for (let count = newEventListenerList.length - 1; count >= 0; count -= 1) {
        const listener = newEventListenerList[count];
        let data = eventData.data;
        const destroy = listener.Callback(data);
        if (destroy) {
          newEventListenerList.splice(count, 1);
        }
      }
      if (newEventListenerList.length === 0) {
        removeListener(eventName);
      } else {
        eventListeners[eventName] = newEventListenerList;
      }
    }
  }
  function EventsNotify(notifyMessage) {
    let message;
    try {
      message = JSON.parse(notifyMessage);
    } catch (e) {
      const error = "Invalid JSON passed to Notify: " + notifyMessage;
      throw new Error(error);
    }
    notifyListeners(message);
  }
  function EventsEmit(eventName) {
    const payload = {
      name: eventName,
      data: [].slice.apply(arguments).slice(1)
    };
    notifyListeners(payload);
    window.WailsInvoke("EE" + JSON.stringify(payload));
  }
  function removeListener(eventName) {
    delete eventListeners[eventName];
    window.WailsInvoke("EX" + eventName);
  }
  function EventsOff(eventName, ...additionalEventNames) {
    removeListener(eventName);
    if (additionalEventNames.length > 0) {
      additionalEventNames.forEach((eventName2) => {
        removeListener(eventName2);
      });
    }
  }
  function EventsOffAll() {
    const eventNames = Object.keys(eventListeners);
    eventNames.forEach((eventName) => {
      removeListener(eventName);
    });
  }
  function listenerOff(listener) {
    const eventName = listener.eventName;
    if (eventListeners[eventName] === void 0)
      return;
    eventListeners[eventName] = eventListeners[eventName].filter((l) => l !== listener);
    if (eventListeners[eventName].length === 0) {
      removeListener(eventName);
    }
  }

  // desktop/calls.js
  var callbacks = {};
  function cryptoRandom() {
    var array = new Uint32Array(1);
    return window.crypto.getRandomValues(array)[0];
  }
  function basicRandom() {
    return Math.random() * 9007199254740991;
  }
  var randomFunc;
  if (window.crypto) {
    randomFunc = cryptoRandom;
  } else {
    randomFunc = basicRandom;
  }
  function Call(name, args, timeout) {
    if (timeout == null) {
      timeout = 0;
    }
    return new Promise(function(resolve, reject) {
      var callbackID;
      do {
        callbackID = name + "-" + randomFunc();
      } while (callbacks[callbackID]);
      var timeoutHandle;
      if (timeout > 0) {
        timeoutHandle = setTimeout(function() {
          reject(Error("Call to " + name + " timed out. Request ID: " + callbackID));
        }, timeout);
      }
      callbacks[callbackID] = {
        timeoutHandle,
        reject,
        resolve
      };
      try {
        const payload = {
          name,
          args,
          callbackID
        };
        window.WailsInvoke("C" + JSON.stringify(payload));
      } catch (e) {
        console.error(e);
      }
    });
  }
  window.ObfuscatedCall = (id, args, timeout) => {
    if (timeout == null) {
      timeout = 0;
    }
    return new Promise(function(resolve, reject) {
      var callbackID;
      do {
        callbackID = id + "-" + randomFunc();
      } while (callbacks[callbackID]);
      var timeoutHandle;
      if (timeout > 0) {
        timeoutHandle = setTimeout(function() {
          reject(Error("Call to method " + id + " timed out. Request ID: " + callbackID));
        }, timeout);
      }
      callbacks[callbackID] = {
        timeoutHandle,
        reject,
        resolve
      };
      try {
        const payload = {
          id,
          args,
          callbackID
        };
        window.WailsInvoke("c" + JSON.stringify(payload));
      } catch (e) {
        console.error(e);
      }
    });
  };
  function Callback(incomingMessage) {
    let message;
    try {
      message = JSON.parse(incomingMessage);
    } catch (e) {
      const error = `Invalid JSON passed to callback: ${e.message}. Message: ${incomingMessage}`;
      runtime.LogDebug(error);
      throw new Error(error);
    }
    let callbackID = message.callbackid;
    let callbackData = callbacks[callbackID];
    if (!callbackData) {
      const error = `Callback '${callbackID}' not registered!!!`;
      console.error(error);
      throw new Error(error);
    }
    clearTimeout(callbackData.timeoutHandle);
    delete callbacks[callbackID];
    if (message.error) {
      callbackData.reject(message.error);
    } else {
      callbackData.resolve(message.result);
    }
  }

  // desktop/bindings.js
  window.go = {};
  function SetBindings(bindingsMap) {
    try {
      bindingsMap = JSON.parse(bindingsMap);
    } catch (e) {
      console.error(e);
    }
    window.go = window.go || {};
    Object.keys(bindingsMap).forEach((packageName) => {
      window.go[packageName] = window.go[packageName] || {};
      Object.keys(bindingsMap[packageName]).forEach((structName) => {
        window.go[packageName][structName] = window.go[packageName][structName] || {};
        Object.keys(bindingsMap[packageName][structName]).forEach((methodName) => {
          window.go[packageName][structName][methodName] = function() {
            let timeout = 0;
            function dynamic() {
              const args = [].slice.call(arguments);
              return Call([packageName, structName, methodName].join("."), args, timeout);
            }
            dynamic.setTimeout = function(newTimeout) {
              timeout = newTimeout;
            };
            dynamic.getTimeout = function() {
              return timeout;
            };
            return dynamic;
          }();
        });
      });
    });
  }

  // desktop/window.js
  var window_exports = {};
  __export(window_exports, {
    WindowCenter: () => WindowCenter,
    WindowFullscreen: () => WindowFullscreen,
    WindowGetPosition: () => WindowGetPosition,
    WindowGetSize: () => WindowGetSize,
    WindowHide: () => WindowHide,
    WindowIsFullscreen: () => WindowIsFullscreen,
    WindowIsMaximised: () => WindowIsMaximised,
    WindowIsMinimised: () => WindowIsMinimised,
    WindowIsNormal: () => WindowIsNormal,
    WindowMaximise: () => WindowMaximise,
    WindowMinimise: () => WindowMinimise,
    WindowReload: () => WindowReload,
    WindowReloadApp: () => WindowReloadApp,
    WindowSetAlwaysOnTop: () => WindowSetAlwaysOnTop,
    WindowSetBackgroundColour: () => WindowSetBackgroundColour,
    WindowSetDarkTheme: () => WindowSetDarkTheme,
    WindowSetLightTheme: () => WindowSetLightTheme,
    WindowSetMaxSize: () => WindowSetMaxSize,
    WindowSetMinSize: () => WindowSetMinSize,
    WindowSetPosition: () => WindowSetPosition,
    WindowSetSize: () => WindowSetSize,
    WindowSetSystemDefaultTheme: () => WindowSetSystemDefaultTheme,
    WindowSetTitle: () => WindowSetTitle,
    WindowShow: () => WindowShow,
    WindowToggleMaximise: () => WindowToggleMaximise,
    WindowUnfullscreen: () => WindowUnfullscreen,
    WindowUnmaximise: () => WindowUnmaximise,
    WindowUnminimise: () => WindowUnminimise
  });
  function WindowReload() {
    window.location.reload();
  }
  function WindowReloadApp() {
    window.WailsInvoke("WR");
  }
  function WindowSetSystemDefaultTheme() {
    window.WailsInvoke("WASDT");
  }
  function WindowSetLightTheme() {
    window.WailsInvoke("WALT");
  }
  function WindowSetDarkTheme() {
    window.WailsInvoke("WADT");
  }
  function WindowCenter() {
    window.WailsInvoke("Wc");
  }
  function WindowSetTitle(title) {
    window.WailsInvoke("WT" + title);
  }
  function WindowFullscreen() {
    window.WailsInvoke("WF");
  }
  function WindowUnfullscreen() {
    window.WailsInvoke("Wf");
  }
  function WindowIsFullscreen() {
    return Call(":wails:WindowIsFullscreen");
  }
  function WindowSetSize(width, height) {
    window.WailsInvoke("Ws:" + width + ":" + height);
  }
  function WindowGetSize() {
    return Call(":wails:WindowGetSize");
  }
  function WindowSetMaxSize(width, height) {
    window.WailsInvoke("WZ:" + width + ":" + height);
  }
  function WindowSetMinSize(width, height) {
    window.WailsInvoke("Wz:" + width + ":" + height);
  }
  function WindowSetAlwaysOnTop(b) {
    window.WailsInvoke("WATP:" + (b ? "1" : "0"));
  }
  function WindowSetPosition(x, y) {
    window.WailsInvoke("Wp:" + x + ":" + y);
  }
  function WindowGetPosition() {
    return Call(":wails:WindowGetPos");
  }
  function WindowHide() {
    window.WailsInvoke("WH");
  }
  function WindowShow() {
    window.WailsInvoke("WS");
  }
  function WindowMaximise() {
    window.WailsInvoke("WM");
  }
  function WindowToggleMaximise() {
    window.WailsInvoke("Wt");
  }
  function WindowUnmaximise() {
    window.WailsInvoke("WU");
  }
  function WindowIsMaximised() {
    return Call(":wails:WindowIsMaximised");
  }
  function WindowMinimise() {
    window.WailsInvoke("Wm");
  }
  function WindowUnminimise() {
    window.WailsInvoke("Wu");
  }
  function WindowIsMinimised() {
    return Call(":wails:WindowIsMinimised");
  }
  function WindowIsNormal() {
    return Call(":wails:WindowIsNormal");
  }
  function WindowSetBackgroundColour(R, G, B, A) {
    let rgba = JSON.stringify({ r: R || 0, g: G || 0, b: B || 0, a: A || 255 });
    window.WailsInvoke("Wr:" + rgba);
  }

  // desktop/screen.js
  var screen_exports = {};
  __export(screen_exports, {
    ScreenGetAll: () => ScreenGetAll
  });
  function ScreenGetAll() {
    return Call(":wails:ScreenGetAll");
  }

  // desktop/browser.js
  var browser_exports = {};
  __export(browser_exports, {
    BrowserOpenURL: () => BrowserOpenURL
  });
  function BrowserOpenURL(url) {
    window.WailsInvoke("BO:" + url);
  }

  // desktop/clipboard.js
  var clipboard_exports = {};
  __export(clipboard_exports, {
    ClipboardGetText: () => ClipboardGetText,
    ClipboardSetText: () => ClipboardSetText
  });
  function ClipboardSetText(text) {
    return Call(":wails:ClipboardSetText", [text]);
  }
  function ClipboardGetText() {
    return Call(":wails:ClipboardGetText");
  }

  // desktop/draganddrop.js
  var draganddrop_exports = {};
  __export(draganddrop_exports, {
    CanResolveFilePaths: () => CanResolveFilePaths,
    OnFileDrop: () => OnFileDrop,
    OnFileDropOff: () => OnFileDropOff,
    ResolveFilePaths: () => ResolveFilePaths
  });
  var flags = {
    registered: false,
    defaultUseDropTarget: true,
    useDropTarget: true,
    nextDeactivate: null,
    nextDeactivateTimeout: null
  };
  var DROP_TARGET_ACTIVE = "wails-drop-target-active";
  function checkStyleDropTarget(style) {
    const cssDropValue = style.getPropertyValue(window.wails.flags.cssDropProperty).trim();
    if (cssDropValue) {
      if (cssDropValue === window.wails.flags.cssDropValue) {
        return true;
      }
      return false;
    }
    return false;
  }
  function onDragOver(e) {
    const isFileDrop = e.dataTransfer.types.includes("Files");
    if (!isFileDrop) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!window.wails.flags.enableWailsDragAndDrop) {
      return;
    }
    if (!flags.useDropTarget) {
      return;
    }
    const element = e.target;
    if (flags.nextDeactivate)
      flags.nextDeactivate();
    if (!element || !checkStyleDropTarget(getComputedStyle(element))) {
      return;
    }
    let currentElement = element;
    while (currentElement) {
      if (checkStyleDropTarget(getComputedStyle(currentElement))) {
        currentElement.classList.add(DROP_TARGET_ACTIVE);
      }
      currentElement = currentElement.parentElement;
    }
  }
  function onDragLeave(e) {
    const isFileDrop = e.dataTransfer.types.includes("Files");
    if (!isFileDrop) {
      return;
    }
    e.preventDefault();
    if (!window.wails.flags.enableWailsDragAndDrop) {
      return;
    }
    if (!flags.useDropTarget) {
      return;
    }
    if (!e.target || !checkStyleDropTarget(getComputedStyle(e.target))) {
      return null;
    }
    if (flags.nextDeactivate)
      flags.nextDeactivate();
    flags.nextDeactivate = () => {
      Array.from(document.getElementsByClassName(DROP_TARGET_ACTIVE)).forEach((el) => el.classList.remove(DROP_TARGET_ACTIVE));
      flags.nextDeactivate = null;
      if (flags.nextDeactivateTimeout) {
        clearTimeout(flags.nextDeactivateTimeout);
        flags.nextDeactivateTimeout = null;
      }
    };
    flags.nextDeactivateTimeout = setTimeout(() => {
      if (flags.nextDeactivate)
        flags.nextDeactivate();
    }, 50);
  }
  function onDrop(e) {
    const isFileDrop = e.dataTransfer.types.includes("Files");
    if (!isFileDrop) {
      return;
    }
    e.preventDefault();
    if (!window.wails.flags.enableWailsDragAndDrop) {
      return;
    }
    if (CanResolveFilePaths()) {
      let files = [];
      if (e.dataTransfer.items) {
        files = [...e.dataTransfer.items].map((item, i) => {
          if (item.kind === "file") {
            return item.getAsFile();
          }
        });
      } else {
        files = [...e.dataTransfer.files];
      }
      window.runtime.ResolveFilePaths(e.x, e.y, files);
    }
    if (!flags.useDropTarget) {
      return;
    }
    if (flags.nextDeactivate)
      flags.nextDeactivate();
    Array.from(document.getElementsByClassName(DROP_TARGET_ACTIVE)).forEach((el) => el.classList.remove(DROP_TARGET_ACTIVE));
  }
  function CanResolveFilePaths() {
    return window.chrome?.webview?.postMessageWithAdditionalObjects != null;
  }
  function ResolveFilePaths(x, y, files) {
    if (window.chrome?.webview?.postMessageWithAdditionalObjects) {
      chrome.webview.postMessageWithAdditionalObjects(`file:drop:${x}:${y}`, files);
    }
  }
  function OnFileDrop(callback, useDropTarget) {
    if (typeof callback !== "function") {
      console.error("DragAndDropCallback is not a function");
      return;
    }
    if (flags.registered) {
      return;
    }
    flags.registered = true;
    const uDTPT = typeof useDropTarget;
    flags.useDropTarget = uDTPT === "undefined" || uDTPT !== "boolean" ? flags.defaultUseDropTarget : useDropTarget;
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    let cb = callback;
    if (flags.useDropTarget) {
      cb = function(x, y, paths) {
        const element = document.elementFromPoint(x, y);
        if (!element || !checkStyleDropTarget(getComputedStyle(element))) {
          return null;
        }
        callback(x, y, paths);
      };
    }
    EventsOn("wails:file-drop", cb);
  }
  function OnFileDropOff() {
    window.removeEventListener("dragover", onDragOver);
    window.removeEventListener("dragleave", onDragLeave);
    window.removeEventListener("drop", onDrop);
    EventsOff("wails:file-drop");
    flags.registered = false;
  }

  // desktop/contextmenu.js
  function processDefaultContextMenu(event) {
    const element = event.target;
    const computedStyle = window.getComputedStyle(element);
    const defaultContextMenuAction = computedStyle.getPropertyValue("--default-contextmenu").trim();
    switch (defaultContextMenuAction) {
      case "show":
        return;
      case "hide":
        event.preventDefault();
        return;
      default:
        if (element.isContentEditable) {
          return;
        }
        const selection = window.getSelection();
        const hasSelection = selection.toString().length > 0;
        if (hasSelection) {
          for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const rects = range.getClientRects();
            for (let j = 0; j < rects.length; j++) {
              const rect = rects[j];
              if (document.elementFromPoint(rect.left, rect.top) === element) {
                return;
              }
            }
          }
        }
        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
          if (hasSelection || !element.readOnly && !element.disabled) {
            return;
          }
        }
        event.preventDefault();
    }
  }

  // desktop/main.js
  function Quit() {
    window.WailsInvoke("Q");
  }
  function Show() {
    window.WailsInvoke("S");
  }
  function Hide() {
    window.WailsInvoke("H");
  }
  function Environment() {
    return Call(":wails:Environment");
  }
  window.runtime = {
    ...log_exports,
    ...window_exports,
    ...browser_exports,
    ...screen_exports,
    ...clipboard_exports,
    ...draganddrop_exports,
    EventsOn,
    EventsOnce,
    EventsOnMultiple,
    EventsEmit,
    EventsOff,
    EventsOffAll,
    Environment,
    Show,
    Hide,
    Quit,
    EventsRebind
  };
  window.wails = {
    Callback,
    EventsNotify,
    SetBindings,
    eventListeners,
    callbacks,
    flags: {
      disableScrollbarDrag: false,
      disableDefaultContextMenu: false,
      enableResize: false,
      defaultCursor: null,
      borderThickness: 6,
      shouldDrag: false,
      deferDragToMouseMove: true,
      cssDragProperty: "--wails-draggable",
      cssDragValue: "drag",
      cssDropProperty: "--wails-drop-target",
      cssDropValue: "drop",
      enableWailsDragAndDrop: false
    }
  };
  if (window.wailsbindings) {
    window.wails.SetBindings(window.wailsbindings);
    delete window.wails.SetBindings;
  }
  if (false) {
    delete window.wailsbindings;
  }
  var dragTest = function(e) {
    var val = window.getComputedStyle(e.target).getPropertyValue(window.wails.flags.cssDragProperty);
    if (val) {
      val = val.trim();
    }
    if (val !== window.wails.flags.cssDragValue) {
      return false;
    }
    if (e.buttons !== 1) {
      return false;
    }
    if (e.detail !== 1) {
      return false;
    }
    return true;
  };
  window.wails.setCSSDragProperties = function(property, value) {
    window.wails.flags.cssDragProperty = property;
    window.wails.flags.cssDragValue = value;
  };
  window.wails.setCSSDropProperties = function(property, value) {
    window.wails.flags.cssDropProperty = property;
    window.wails.flags.cssDropValue = value;
  };
  window.addEventListener("mousedown", (e) => {
    if (window.wails.flags.resizeEdge) {
      window.WailsInvoke("resize:" + window.wails.flags.resizeEdge);
      e.preventDefault();
      return;
    }
    if (dragTest(e)) {
      if (window.wails.flags.disableScrollbarDrag) {
        if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) {
          return;
        }
      }
      if (window.wails.flags.deferDragToMouseMove) {
        window.wails.flags.shouldDrag = true;
      } else {
        e.preventDefault();
        window.WailsInvoke("drag");
      }
      return;
    } else {
      window.wails.flags.shouldDrag = false;
    }
  });
  window.addEventListener("mouseup", () => {
    window.wails.flags.shouldDrag = false;
  });
  function setResize(cursor) {
    document.documentElement.style.cursor = cursor || window.wails.flags.defaultCursor;
    window.wails.flags.resizeEdge = cursor;
  }
  window.addEventListener("mousemove", function(e) {
    if (window.wails.flags.shouldDrag) {
      window.wails.flags.shouldDrag = false;
      let mousePressed = e.buttons !== void 0 ? e.buttons : e.which;
      if (mousePressed > 0) {
        window.WailsInvoke("drag");
        return;
      }
    }
    if (!window.wails.flags.enableResize) {
      return;
    }
    if (window.wails.flags.defaultCursor == null) {
      window.wails.flags.defaultCursor = document.documentElement.style.cursor;
    }
    if (window.outerWidth - e.clientX < window.wails.flags.borderThickness && window.outerHeight - e.clientY < window.wails.flags.borderThickness) {
      document.documentElement.style.cursor = "se-resize";
    }
    let rightBorder = window.outerWidth - e.clientX < window.wails.flags.borderThickness;
    let leftBorder = e.clientX < window.wails.flags.borderThickness;
    let topBorder = e.clientY < window.wails.flags.borderThickness;
    let bottomBorder = window.outerHeight - e.clientY < window.wails.flags.borderThickness;
    if (!leftBorder && !rightBorder && !topBorder && !bottomBorder && window.wails.flags.resizeEdge !== void 0) {
      setResize();
    } else if (rightBorder && bottomBorder)
      setResize("se-resize");
    else if (leftBorder && bottomBorder)
      setResize("sw-resize");
    else if (leftBorder && topBorder)
      setResize("nw-resize");
    else if (topBorder && rightBorder)
      setResize("ne-resize");
    else if (leftBorder)
      setResize("w-resize");
    else if (topBorder)
      setResize("n-resize");
    else if (bottomBorder)
      setResize("s-resize");
    else if (rightBorder)
      setResize("e-resize");
  });
  window.addEventListener("contextmenu", function(e) {
    if (true)
      return;
    if (window.wails.flags.disableDefaultContextMenu) {
      e.preventDefault();
    } else {
      processDefaultContextMenu(e);
    }
  });
  window.WailsInvoke("runtime:ready");
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZGVza3RvcC9sb2cuanMiLCAiZGVza3RvcC9ldmVudHMuanMiLCAiZGVza3RvcC9jYWxscy5qcyIsICJkZXNrdG9wL2JpbmRpbmdzLmpzIiwgImRlc2t0b3Avd2luZG93LmpzIiwgImRlc2t0b3Avc2NyZWVuLmpzIiwgImRlc2t0b3AvYnJvd3Nlci5qcyIsICJkZXNrdG9wL2NsaXBib2FyZC5qcyIsICJkZXNrdG9wL2RyYWdhbmRkcm9wLmpzIiwgImRlc2t0b3AvY29udGV4dG1lbnUuanMiLCAiZGVza3RvcC9tYWluLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKlxyXG4gXyAgICAgICBfXyAgICAgIF8gX19cclxufCB8ICAgICAvIC9fX18gXyhfKSAvX19fX1xyXG58IHwgL3wgLyAvIF9fIGAvIC8gLyBfX18vXHJcbnwgfC8gfC8gLyAvXy8gLyAvIChfXyAgKVxyXG58X18vfF9fL1xcX18sXy9fL18vX19fXy9cclxuVGhlIGVsZWN0cm9uIGFsdGVybmF0aXZlIGZvciBHb1xyXG4oYykgTGVhIEFudGhvbnkgMjAxOS1wcmVzZW50XHJcbiovXHJcblxyXG4vKiBqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcblxyXG4vKipcclxuICogU2VuZHMgYSBsb2cgbWVzc2FnZSB0byB0aGUgYmFja2VuZCB3aXRoIHRoZSBnaXZlbiBsZXZlbCArIG1lc3NhZ2VcclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGxldmVsXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlXHJcbiAqL1xyXG5mdW5jdGlvbiBzZW5kTG9nTWVzc2FnZShsZXZlbCwgbWVzc2FnZSkge1xyXG5cclxuXHQvLyBMb2cgTWVzc2FnZSBmb3JtYXQ6XHJcblx0Ly8gbFt0eXBlXVttZXNzYWdlXVxyXG5cdHdpbmRvdy5XYWlsc0ludm9rZSgnTCcgKyBsZXZlbCArIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiB0cmFjZSBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ1RyYWNlKG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnVCcsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ1ByaW50KG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnUCcsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiBkZWJ1ZyBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ0RlYnVnKG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnRCcsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiBpbmZvIG1lc3NhZ2Ugd2l0aCB0aGUgYmFja2VuZFxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gTG9nSW5mbyhtZXNzYWdlKSB7XHJcblx0c2VuZExvZ01lc3NhZ2UoJ0knLCBtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIExvZyB0aGUgZ2l2ZW4gd2FybmluZyBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ1dhcm5pbmcobWVzc2FnZSkge1xyXG5cdHNlbmRMb2dNZXNzYWdlKCdXJywgbWVzc2FnZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMb2cgdGhlIGdpdmVuIGVycm9yIG1lc3NhZ2Ugd2l0aCB0aGUgYmFja2VuZFxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gTG9nRXJyb3IobWVzc2FnZSkge1xyXG5cdHNlbmRMb2dNZXNzYWdlKCdFJywgbWVzc2FnZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMb2cgdGhlIGdpdmVuIGZhdGFsIG1lc3NhZ2Ugd2l0aCB0aGUgYmFja2VuZFxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gTG9nRmF0YWwobWVzc2FnZSkge1xyXG5cdHNlbmRMb2dNZXNzYWdlKCdGJywgbWVzc2FnZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXRzIHRoZSBMb2cgbGV2ZWwgdG8gdGhlIGdpdmVuIGxvZyBsZXZlbFxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBsb2dsZXZlbFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFNldExvZ0xldmVsKGxvZ2xldmVsKSB7XHJcblx0c2VuZExvZ01lc3NhZ2UoJ1MnLCBsb2dsZXZlbCk7XHJcbn1cclxuXHJcbi8vIExvZyBsZXZlbHNcclxuZXhwb3J0IGNvbnN0IExvZ0xldmVsID0ge1xyXG5cdFRSQUNFOiAxLFxyXG5cdERFQlVHOiAyLFxyXG5cdElORk86IDMsXHJcblx0V0FSTklORzogNCxcclxuXHRFUlJPUjogNSxcclxufTtcclxuIiwgIi8qXHJcbiBfICAgICAgIF9fICAgICAgXyBfX1xyXG58IHwgICAgIC8gL19fXyBfKF8pIC9fX19fXHJcbnwgfCAvfCAvIC8gX18gYC8gLyAvIF9fXy9cclxufCB8LyB8LyAvIC9fLyAvIC8gKF9fICApXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fL1xyXG5UaGUgZWxlY3Ryb24gYWx0ZXJuYXRpdmUgZm9yIEdvXHJcbihjKSBMZWEgQW50aG9ueSAyMDE5LXByZXNlbnRcclxuKi9cclxuLyoganNoaW50IGVzdmVyc2lvbjogNiAqL1xyXG5cclxuLy8gRGVmaW5lcyBhIHNpbmdsZSBsaXN0ZW5lciB3aXRoIGEgbWF4aW11bSBudW1iZXIgb2YgdGltZXMgdG8gY2FsbGJhY2tcclxuXHJcbi8qKlxyXG4gKiBUaGUgTGlzdGVuZXIgY2xhc3MgZGVmaW5lcyBhIGxpc3RlbmVyISA6LSlcclxuICpcclxuICogQGNsYXNzIExpc3RlbmVyXHJcbiAqL1xyXG5jbGFzcyBMaXN0ZW5lciB7XHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgTGlzdGVuZXIuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heENhbGxiYWNrc1xyXG4gICAgICogQG1lbWJlcm9mIExpc3RlbmVyXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKGV2ZW50TmFtZSwgY2FsbGJhY2ssIG1heENhbGxiYWNrcykge1xyXG4gICAgICAgIHRoaXMuZXZlbnROYW1lID0gZXZlbnROYW1lO1xyXG4gICAgICAgIC8vIERlZmF1bHQgb2YgLTEgbWVhbnMgaW5maW5pdGVcclxuICAgICAgICB0aGlzLm1heENhbGxiYWNrcyA9IG1heENhbGxiYWNrcyB8fCAtMTtcclxuICAgICAgICAvLyBDYWxsYmFjayBpbnZva2VzIHRoZSBjYWxsYmFjayB3aXRoIHRoZSBnaXZlbiBkYXRhXHJcbiAgICAgICAgLy8gUmV0dXJucyB0cnVlIGlmIHRoaXMgbGlzdGVuZXIgc2hvdWxkIGJlIGRlc3Ryb3llZFxyXG4gICAgICAgIHRoaXMuQ2FsbGJhY2sgPSAoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBkYXRhKTtcclxuICAgICAgICAgICAgLy8gSWYgbWF4Q2FsbGJhY2tzIGlzIGluZmluaXRlLCByZXR1cm4gZmFsc2UgKGRvIG5vdCBkZXN0cm95KVxyXG4gICAgICAgICAgICBpZiAodGhpcy5tYXhDYWxsYmFja3MgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gRGVjcmVtZW50IG1heENhbGxiYWNrcy4gUmV0dXJuIHRydWUgaWYgbm93IDAsIG90aGVyd2lzZSBmYWxzZVxyXG4gICAgICAgICAgICB0aGlzLm1heENhbGxiYWNrcyAtPSAxO1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhDYWxsYmFja3MgPT09IDA7XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGV2ZW50TGlzdGVuZXJzID0ge307XHJcblxyXG4vKipcclxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGBtYXhDYWxsYmFja3NgIHRpbWVzIGJlZm9yZSBiZWluZyBkZXN0cm95ZWRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBtYXhDYWxsYmFja3NcclxuICogQHJldHVybnMge2Z1bmN0aW9ufSBBIGZ1bmN0aW9uIHRvIGNhbmNlbCB0aGUgbGlzdGVuZXJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNPbk11bHRpcGxlKGV2ZW50TmFtZSwgY2FsbGJhY2ssIG1heENhbGxiYWNrcykge1xyXG4gICAgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSA9IGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW107XHJcbiAgICBjb25zdCB0aGlzTGlzdGVuZXIgPSBuZXcgTGlzdGVuZXIoZXZlbnROYW1lLCBjYWxsYmFjaywgbWF4Q2FsbGJhY2tzKTtcclxuICAgIGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0ucHVzaCh0aGlzTGlzdGVuZXIpO1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKFwiRUJcIiArIGV2ZW50TmFtZSk7XHJcbiAgICByZXR1cm4gKCkgPT4gbGlzdGVuZXJPZmYodGhpc0xpc3RlbmVyKTtcclxufVxyXG5cclxuXHJcblxyXG5leHBvcnQgZnVuY3Rpb24gRXZlbnRzUmViaW5kKCkge1xyXG4gICAgZm9yIChsZXQga2V5IGluIGV2ZW50TGlzdGVuZXJzKSB7XHJcbiAgICAgICAgd2luZG93LldhaWxzSW52b2tlKFwiRUJcIiArIGtleSk7XHJcbiAgICB9XHJcbn1cclxuLyoqXHJcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBldmVyeSB0aW1lIHRoZSBldmVudCBpcyBlbWl0dGVkXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xyXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IEEgZnVuY3Rpb24gdG8gY2FuY2VsIHRoZSBsaXN0ZW5lclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEV2ZW50c09uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcclxuICAgIHJldHVybiBFdmVudHNPbk11bHRpcGxlKGV2ZW50TmFtZSwgY2FsbGJhY2ssIC0xKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBvbmNlIHRoZW4gZGVzdHJveWVkXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xyXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IEEgZnVuY3Rpb24gdG8gY2FuY2VsIHRoZSBsaXN0ZW5lclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEV2ZW50c09uY2UoZXZlbnROYW1lLCBjYWxsYmFjaykge1xyXG4gICAgcmV0dXJuIEV2ZW50c09uTXVsdGlwbGUoZXZlbnROYW1lLCBjYWxsYmFjaywgMSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG5vdGlmeUxpc3RlbmVycyhldmVudERhdGEpIHtcclxuXHJcbiAgICAvLyBHZXQgdGhlIGV2ZW50IG5hbWVcclxuICAgIGxldCBldmVudE5hbWUgPSBldmVudERhdGEubmFtZTtcclxuXHJcbiAgICAvLyBLZWVwIGEgbGlzdCBvZiBsaXN0ZW5lciBpbmRleGVzIHRvIGRlc3Ryb3lcclxuICAgIGNvbnN0IG5ld0V2ZW50TGlzdGVuZXJMaXN0ID0gZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXT8uc2xpY2UoKSB8fCBbXTtcclxuXHJcbiAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFueSBsaXN0ZW5lcnMgZm9yIHRoaXMgZXZlbnRcclxuICAgIGlmIChuZXdFdmVudExpc3RlbmVyTGlzdC5sZW5ndGgpIHtcclxuXHJcbiAgICAgICAgLy8gSXRlcmF0ZSBsaXN0ZW5lcnNcclxuICAgICAgICBmb3IgKGxldCBjb3VudCA9IG5ld0V2ZW50TGlzdGVuZXJMaXN0Lmxlbmd0aCAtIDE7IGNvdW50ID49IDA7IGNvdW50IC09IDEpIHtcclxuXHJcbiAgICAgICAgICAgIC8vIEdldCBuZXh0IGxpc3RlbmVyXHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gbmV3RXZlbnRMaXN0ZW5lckxpc3RbY291bnRdO1xyXG5cclxuICAgICAgICAgICAgbGV0IGRhdGEgPSBldmVudERhdGEuZGF0YTtcclxuXHJcbiAgICAgICAgICAgIC8vIERvIHRoZSBjYWxsYmFja1xyXG4gICAgICAgICAgICBjb25zdCBkZXN0cm95ID0gbGlzdGVuZXIuQ2FsbGJhY2soZGF0YSk7XHJcbiAgICAgICAgICAgIGlmIChkZXN0cm95KSB7XHJcbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGlzdGVuZXIgaW5kaWNhdGVkIHRvIGRlc3Ryb3kgaXRzZWxmLCBhZGQgaXQgdG8gdGhlIGRlc3Ryb3kgbGlzdFxyXG4gICAgICAgICAgICAgICAgbmV3RXZlbnRMaXN0ZW5lckxpc3Quc3BsaWNlKGNvdW50LCAxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gVXBkYXRlIGNhbGxiYWNrcyB3aXRoIG5ldyBsaXN0IG9mIGxpc3RlbmVyc1xyXG4gICAgICAgIGlmIChuZXdFdmVudExpc3RlbmVyTGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBldmVudExpc3RlbmVyc1tldmVudE5hbWVdID0gbmV3RXZlbnRMaXN0ZW5lckxpc3Q7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogTm90aWZ5IGluZm9ybXMgZnJvbnRlbmQgbGlzdGVuZXJzIHRoYXQgYW4gZXZlbnQgd2FzIGVtaXR0ZWQgd2l0aCB0aGUgZ2l2ZW4gZGF0YVxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBub3RpZnlNZXNzYWdlIC0gZW5jb2RlZCBub3RpZmljYXRpb24gbWVzc2FnZVxyXG5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNOb3RpZnkobm90aWZ5TWVzc2FnZSkge1xyXG4gICAgLy8gUGFyc2UgdGhlIG1lc3NhZ2VcclxuICAgIGxldCBtZXNzYWdlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBtZXNzYWdlID0gSlNPTi5wYXJzZShub3RpZnlNZXNzYWdlKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zdCBlcnJvciA9ICdJbnZhbGlkIEpTT04gcGFzc2VkIHRvIE5vdGlmeTogJyArIG5vdGlmeU1lc3NhZ2U7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yKTtcclxuICAgIH1cclxuICAgIG5vdGlmeUxpc3RlbmVycyhtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEVtaXQgYW4gZXZlbnQgd2l0aCB0aGUgZ2l2ZW4gbmFtZSBhbmQgZGF0YVxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNFbWl0KGV2ZW50TmFtZSkge1xyXG5cclxuICAgIGNvbnN0IHBheWxvYWQgPSB7XHJcbiAgICAgICAgbmFtZTogZXZlbnROYW1lLFxyXG4gICAgICAgIGRhdGE6IFtdLnNsaWNlLmFwcGx5KGFyZ3VtZW50cykuc2xpY2UoMSksXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIE5vdGlmeSBKUyBsaXN0ZW5lcnNcclxuICAgIG5vdGlmeUxpc3RlbmVycyhwYXlsb2FkKTtcclxuXHJcbiAgICAvLyBOb3RpZnkgR28gbGlzdGVuZXJzXHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ0VFJyArIEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lKSB7XHJcbiAgICAvLyBSZW1vdmUgbG9jYWwgbGlzdGVuZXJzXHJcbiAgICBkZWxldGUgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXTtcclxuXHJcbiAgICAvLyBOb3RpZnkgR28gbGlzdGVuZXJzXHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ0VYJyArIGV2ZW50TmFtZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPZmYgdW5yZWdpc3RlcnMgYSBsaXN0ZW5lciBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgd2l0aCBPbixcclxuICogb3B0aW9uYWxseSBtdWx0aXBsZSBsaXN0ZW5lcmVzIGNhbiBiZSB1bnJlZ2lzdGVyZWQgdmlhIGBhZGRpdGlvbmFsRXZlbnROYW1lc2BcclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG4gKiBAcGFyYW0gIHsuLi5zdHJpbmd9IGFkZGl0aW9uYWxFdmVudE5hbWVzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gRXZlbnRzT2ZmKGV2ZW50TmFtZSwgLi4uYWRkaXRpb25hbEV2ZW50TmFtZXMpIHtcclxuICAgIHJlbW92ZUxpc3RlbmVyKGV2ZW50TmFtZSlcclxuXHJcbiAgICBpZiAoYWRkaXRpb25hbEV2ZW50TmFtZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGFkZGl0aW9uYWxFdmVudE5hbWVzLmZvckVhY2goZXZlbnROYW1lID0+IHtcclxuICAgICAgICAgICAgcmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lKVxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPZmYgdW5yZWdpc3RlcnMgYWxsIGV2ZW50IGxpc3RlbmVycyBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgd2l0aCBPblxyXG4gKi9cclxuIGV4cG9ydCBmdW5jdGlvbiBFdmVudHNPZmZBbGwoKSB7XHJcbiAgICBjb25zdCBldmVudE5hbWVzID0gT2JqZWN0LmtleXMoZXZlbnRMaXN0ZW5lcnMpO1xyXG4gICAgZXZlbnROYW1lcy5mb3JFYWNoKGV2ZW50TmFtZSA9PiB7XHJcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lKVxyXG4gICAgfSlcclxufVxyXG5cclxuLyoqXHJcbiAqIGxpc3RlbmVyT2ZmIHVucmVnaXN0ZXJzIGEgbGlzdGVuZXIgcHJldmlvdXNseSByZWdpc3RlcmVkIHdpdGggRXZlbnRzT25cclxuICpcclxuICogQHBhcmFtIHtMaXN0ZW5lcn0gbGlzdGVuZXJcclxuICovXHJcbiBmdW5jdGlvbiBsaXN0ZW5lck9mZihsaXN0ZW5lcikge1xyXG4gICAgY29uc3QgZXZlbnROYW1lID0gbGlzdGVuZXIuZXZlbnROYW1lO1xyXG4gICAgaWYgKGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0gPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIFJlbW92ZSBsb2NhbCBsaXN0ZW5lclxyXG4gICAgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSA9IGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0uZmlsdGVyKGwgPT4gbCAhPT0gbGlzdGVuZXIpO1xyXG5cclxuICAgIC8vIENsZWFuIHVwIGlmIHRoZXJlIGFyZSBubyBldmVudCBsaXN0ZW5lcnMgbGVmdFxyXG4gICAgaWYgKGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0ubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXIoZXZlbnROYW1lKTtcclxuICAgIH1cclxufVxyXG4iLCAiLypcclxuIF8gICAgICAgX18gICAgICBfIF9fXHJcbnwgfCAgICAgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG4vKiBqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcblxyXG5leHBvcnQgY29uc3QgY2FsbGJhY2tzID0ge307XHJcblxyXG4vKipcclxuICogUmV0dXJucyBhIG51bWJlciBmcm9tIHRoZSBuYXRpdmUgYnJvd3NlciByYW5kb20gZnVuY3Rpb25cclxuICpcclxuICogQHJldHVybnMgbnVtYmVyXHJcbiAqL1xyXG5mdW5jdGlvbiBjcnlwdG9SYW5kb20oKSB7XHJcblx0dmFyIGFycmF5ID0gbmV3IFVpbnQzMkFycmF5KDEpO1xyXG5cdHJldHVybiB3aW5kb3cuY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhhcnJheSlbMF07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgbnVtYmVyIHVzaW5nIGRhIG9sZC1za29vbCBNYXRoLlJhbmRvbVxyXG4gKiBJIGxpa2VzIHRvIGNhbGwgaXQgTE9MUmFuZG9tXHJcbiAqXHJcbiAqIEByZXR1cm5zIG51bWJlclxyXG4gKi9cclxuZnVuY3Rpb24gYmFzaWNSYW5kb20oKSB7XHJcblx0cmV0dXJuIE1hdGgucmFuZG9tKCkgKiA5MDA3MTk5MjU0NzQwOTkxO1xyXG59XHJcblxyXG4vLyBQaWNrIGEgcmFuZG9tIG51bWJlciBmdW5jdGlvbiBiYXNlZCBvbiBicm93c2VyIGNhcGFiaWxpdHlcclxudmFyIHJhbmRvbUZ1bmM7XHJcbmlmICh3aW5kb3cuY3J5cHRvKSB7XHJcblx0cmFuZG9tRnVuYyA9IGNyeXB0b1JhbmRvbTtcclxufSBlbHNlIHtcclxuXHRyYW5kb21GdW5jID0gYmFzaWNSYW5kb207XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2FsbCBzZW5kcyBhIG1lc3NhZ2UgdG8gdGhlIGJhY2tlbmQgdG8gY2FsbCB0aGUgYmluZGluZyB3aXRoIHRoZVxyXG4gKiBnaXZlbiBkYXRhLiBBIHByb21pc2UgaXMgcmV0dXJuZWQgYW5kIHdpbGwgYmUgY29tcGxldGVkIHdoZW4gdGhlXHJcbiAqIGJhY2tlbmQgcmVzcG9uZHMuIFRoaXMgd2lsbCBiZSByZXNvbHZlZCB3aGVuIHRoZSBjYWxsIHdhcyBzdWNjZXNzZnVsXHJcbiAqIG9yIHJlamVjdGVkIGlmIGFuIGVycm9yIGlzIHBhc3NlZCBiYWNrLlxyXG4gKiBUaGVyZSBpcyBhIHRpbWVvdXQgbWVjaGFuaXNtLiBJZiB0aGUgY2FsbCBkb2Vzbid0IHJlc3BvbmQgaW4gdGhlIGdpdmVuXHJcbiAqIHRpbWUgKGluIG1pbGxpc2Vjb25kcykgdGhlbiB0aGUgcHJvbWlzZSBpcyByZWplY3RlZC5cclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZVxyXG4gKiBAcGFyYW0ge2FueT19IGFyZ3NcclxuICogQHBhcmFtIHtudW1iZXI9fSB0aW1lb3V0XHJcbiAqIEByZXR1cm5zXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gQ2FsbChuYW1lLCBhcmdzLCB0aW1lb3V0KSB7XHJcblxyXG5cdC8vIFRpbWVvdXQgaW5maW5pdGUgYnkgZGVmYXVsdFxyXG5cdGlmICh0aW1lb3V0ID09IG51bGwpIHtcclxuXHRcdHRpbWVvdXQgPSAwO1xyXG5cdH1cclxuXHJcblx0Ly8gQ3JlYXRlIGEgcHJvbWlzZVxyXG5cdHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcblxyXG5cdFx0Ly8gQ3JlYXRlIGEgdW5pcXVlIGNhbGxiYWNrSURcclxuXHRcdHZhciBjYWxsYmFja0lEO1xyXG5cdFx0ZG8ge1xyXG5cdFx0XHRjYWxsYmFja0lEID0gbmFtZSArICctJyArIHJhbmRvbUZ1bmMoKTtcclxuXHRcdH0gd2hpbGUgKGNhbGxiYWNrc1tjYWxsYmFja0lEXSk7XHJcblxyXG5cdFx0dmFyIHRpbWVvdXRIYW5kbGU7XHJcblx0XHQvLyBTZXQgdGltZW91dFxyXG5cdFx0aWYgKHRpbWVvdXQgPiAwKSB7XHJcblx0XHRcdHRpbWVvdXRIYW5kbGUgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRyZWplY3QoRXJyb3IoJ0NhbGwgdG8gJyArIG5hbWUgKyAnIHRpbWVkIG91dC4gUmVxdWVzdCBJRDogJyArIGNhbGxiYWNrSUQpKTtcclxuXHRcdFx0fSwgdGltZW91dCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RvcmUgY2FsbGJhY2tcclxuXHRcdGNhbGxiYWNrc1tjYWxsYmFja0lEXSA9IHtcclxuXHRcdFx0dGltZW91dEhhbmRsZTogdGltZW91dEhhbmRsZSxcclxuXHRcdFx0cmVqZWN0OiByZWplY3QsXHJcblx0XHRcdHJlc29sdmU6IHJlc29sdmVcclxuXHRcdH07XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgcGF5bG9hZCA9IHtcclxuXHRcdFx0XHRuYW1lLFxyXG5cdFx0XHRcdGFyZ3MsXHJcblx0XHRcdFx0Y2FsbGJhY2tJRCxcclxuXHRcdFx0fTtcclxuXHJcbiAgICAgICAgICAgIC8vIE1ha2UgdGhlIGNhbGxcclxuICAgICAgICAgICAgd2luZG93LldhaWxzSW52b2tlKCdDJyArIEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG53aW5kb3cuT2JmdXNjYXRlZENhbGwgPSAoaWQsIGFyZ3MsIHRpbWVvdXQpID0+IHtcclxuXHJcbiAgICAvLyBUaW1lb3V0IGluZmluaXRlIGJ5IGRlZmF1bHRcclxuICAgIGlmICh0aW1lb3V0ID09IG51bGwpIHtcclxuICAgICAgICB0aW1lb3V0ID0gMDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDcmVhdGUgYSBwcm9taXNlXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG5cclxuICAgICAgICAvLyBDcmVhdGUgYSB1bmlxdWUgY2FsbGJhY2tJRFxyXG4gICAgICAgIHZhciBjYWxsYmFja0lEO1xyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgY2FsbGJhY2tJRCA9IGlkICsgJy0nICsgcmFuZG9tRnVuYygpO1xyXG4gICAgICAgIH0gd2hpbGUgKGNhbGxiYWNrc1tjYWxsYmFja0lEXSk7XHJcblxyXG4gICAgICAgIHZhciB0aW1lb3V0SGFuZGxlO1xyXG4gICAgICAgIC8vIFNldCB0aW1lb3V0XHJcbiAgICAgICAgaWYgKHRpbWVvdXQgPiAwKSB7XHJcbiAgICAgICAgICAgIHRpbWVvdXRIYW5kbGUgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHJlamVjdChFcnJvcignQ2FsbCB0byBtZXRob2QgJyArIGlkICsgJyB0aW1lZCBvdXQuIFJlcXVlc3QgSUQ6ICcgKyBjYWxsYmFja0lEKSk7XHJcbiAgICAgICAgICAgIH0sIHRpbWVvdXQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gU3RvcmUgY2FsbGJhY2tcclxuICAgICAgICBjYWxsYmFja3NbY2FsbGJhY2tJRF0gPSB7XHJcbiAgICAgICAgICAgIHRpbWVvdXRIYW5kbGU6IHRpbWVvdXRIYW5kbGUsXHJcbiAgICAgICAgICAgIHJlamVjdDogcmVqZWN0LFxyXG4gICAgICAgICAgICByZXNvbHZlOiByZXNvbHZlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGF5bG9hZCA9IHtcclxuXHRcdFx0XHRpZCxcclxuXHRcdFx0XHRhcmdzLFxyXG5cdFx0XHRcdGNhbGxiYWNrSUQsXHJcblx0XHRcdH07XHJcblxyXG4gICAgICAgICAgICAvLyBNYWtlIHRoZSBjYWxsXHJcbiAgICAgICAgICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnYycgKyBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufTtcclxuXHJcblxyXG4vKipcclxuICogQ2FsbGVkIGJ5IHRoZSBiYWNrZW5kIHRvIHJldHVybiBkYXRhIHRvIGEgcHJldmlvdXNseSBjYWxsZWRcclxuICogYmluZGluZyBpbnZvY2F0aW9uXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IGluY29taW5nTWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIENhbGxiYWNrKGluY29taW5nTWVzc2FnZSkge1xyXG5cdC8vIFBhcnNlIHRoZSBtZXNzYWdlXHJcblx0bGV0IG1lc3NhZ2U7XHJcblx0dHJ5IHtcclxuXHRcdG1lc3NhZ2UgPSBKU09OLnBhcnNlKGluY29taW5nTWVzc2FnZSk7XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0Y29uc3QgZXJyb3IgPSBgSW52YWxpZCBKU09OIHBhc3NlZCB0byBjYWxsYmFjazogJHtlLm1lc3NhZ2V9LiBNZXNzYWdlOiAke2luY29taW5nTWVzc2FnZX1gO1xyXG5cdFx0cnVudGltZS5Mb2dEZWJ1ZyhlcnJvcik7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xyXG5cdH1cclxuXHRsZXQgY2FsbGJhY2tJRCA9IG1lc3NhZ2UuY2FsbGJhY2tpZDtcclxuXHRsZXQgY2FsbGJhY2tEYXRhID0gY2FsbGJhY2tzW2NhbGxiYWNrSURdO1xyXG5cdGlmICghY2FsbGJhY2tEYXRhKSB7XHJcblx0XHRjb25zdCBlcnJvciA9IGBDYWxsYmFjayAnJHtjYWxsYmFja0lEfScgbm90IHJlZ2lzdGVyZWQhISFgO1xyXG5cdFx0Y29uc29sZS5lcnJvcihlcnJvcik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcclxuXHRcdHRocm93IG5ldyBFcnJvcihlcnJvcik7XHJcblx0fVxyXG5cdGNsZWFyVGltZW91dChjYWxsYmFja0RhdGEudGltZW91dEhhbmRsZSk7XHJcblxyXG5cdGRlbGV0ZSBjYWxsYmFja3NbY2FsbGJhY2tJRF07XHJcblxyXG5cdGlmIChtZXNzYWdlLmVycm9yKSB7XHJcblx0XHRjYWxsYmFja0RhdGEucmVqZWN0KG1lc3NhZ2UuZXJyb3IpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRjYWxsYmFja0RhdGEucmVzb2x2ZShtZXNzYWdlLnJlc3VsdCk7XHJcblx0fVxyXG59XHJcbiIsICIvKlxyXG4gXyAgICAgICBfXyAgICAgIF8gX18gICAgXHJcbnwgfCAgICAgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gICkgXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fLyAgXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG4vKiBqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcblxyXG5pbXBvcnQge0NhbGx9IGZyb20gJy4vY2FsbHMnO1xyXG5cclxuLy8gVGhpcyBpcyB3aGVyZSB3ZSBiaW5kIGdvIG1ldGhvZCB3cmFwcGVyc1xyXG53aW5kb3cuZ28gPSB7fTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBTZXRCaW5kaW5ncyhiaW5kaW5nc01hcCkge1xyXG5cdHRyeSB7XHJcblx0XHRiaW5kaW5nc01hcCA9IEpTT04ucGFyc2UoYmluZGluZ3NNYXApO1xyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoZSk7XHJcblx0fVxyXG5cclxuXHQvLyBJbml0aWFsaXNlIHRoZSBiaW5kaW5ncyBtYXBcclxuXHR3aW5kb3cuZ28gPSB3aW5kb3cuZ28gfHwge307XHJcblxyXG5cdC8vIEl0ZXJhdGUgcGFja2FnZSBuYW1lc1xyXG5cdE9iamVjdC5rZXlzKGJpbmRpbmdzTWFwKS5mb3JFYWNoKChwYWNrYWdlTmFtZSkgPT4ge1xyXG5cclxuXHRcdC8vIENyZWF0ZSBpbm5lciBtYXAgaWYgaXQgZG9lc24ndCBleGlzdFxyXG5cdFx0d2luZG93LmdvW3BhY2thZ2VOYW1lXSA9IHdpbmRvdy5nb1twYWNrYWdlTmFtZV0gfHwge307XHJcblxyXG5cdFx0Ly8gSXRlcmF0ZSBzdHJ1Y3QgbmFtZXNcclxuXHRcdE9iamVjdC5rZXlzKGJpbmRpbmdzTWFwW3BhY2thZ2VOYW1lXSkuZm9yRWFjaCgoc3RydWN0TmFtZSkgPT4ge1xyXG5cclxuXHRcdFx0Ly8gQ3JlYXRlIGlubmVyIG1hcCBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcblx0XHRcdHdpbmRvdy5nb1twYWNrYWdlTmFtZV1bc3RydWN0TmFtZV0gPSB3aW5kb3cuZ29bcGFja2FnZU5hbWVdW3N0cnVjdE5hbWVdIHx8IHt9O1xyXG5cclxuXHRcdFx0T2JqZWN0LmtleXMoYmluZGluZ3NNYXBbcGFja2FnZU5hbWVdW3N0cnVjdE5hbWVdKS5mb3JFYWNoKChtZXRob2ROYW1lKSA9PiB7XHJcblxyXG5cdFx0XHRcdHdpbmRvdy5nb1twYWNrYWdlTmFtZV1bc3RydWN0TmFtZV1bbWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gTm8gdGltZW91dCBieSBkZWZhdWx0XHJcblx0XHRcdFx0XHRsZXQgdGltZW91dCA9IDA7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWN0dWFsIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRmdW5jdGlvbiBkeW5hbWljKCkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gQ2FsbChbcGFja2FnZU5hbWUsIHN0cnVjdE5hbWUsIG1ldGhvZE5hbWVdLmpvaW4oJy4nKSwgYXJncywgdGltZW91dCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWxsb3cgc2V0dGluZyB0aW1lb3V0IHRvIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRkeW5hbWljLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAobmV3VGltZW91dCkge1xyXG5cdFx0XHRcdFx0XHR0aW1lb3V0ID0gbmV3VGltZW91dDtcclxuXHRcdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWxsb3cgZ2V0dGluZyB0aW1lb3V0IHRvIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRkeW5hbWljLmdldFRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0aW1lb3V0O1xyXG5cdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gZHluYW1pYztcclxuXHRcdFx0XHR9KCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn1cclxuIiwgIi8qXHJcbiBfXHQgICBfX1x0ICBfIF9fXHJcbnwgfFx0IC8gL19fXyBfKF8pIC9fX19fXHJcbnwgfCAvfCAvIC8gX18gYC8gLyAvIF9fXy9cclxufCB8LyB8LyAvIC9fLyAvIC8gKF9fICApXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fL1xyXG5UaGUgZWxlY3Ryb24gYWx0ZXJuYXRpdmUgZm9yIEdvXHJcbihjKSBMZWEgQW50aG9ueSAyMDE5LXByZXNlbnRcclxuKi9cclxuXHJcbi8qIGpzaGludCBlc3ZlcnNpb246IDkgKi9cclxuXHJcblxyXG5pbXBvcnQge0NhbGx9IGZyb20gXCIuL2NhbGxzXCI7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93UmVsb2FkKCkge1xyXG4gICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93UmVsb2FkQXBwKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXUicpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0U3lzdGVtRGVmYXVsdFRoZW1lKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXQVNEVCcpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0TGlnaHRUaGVtZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV0FMVCcpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0RGFya1RoZW1lKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXQURUJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQbGFjZSB0aGUgd2luZG93IGluIHRoZSBjZW50ZXIgb2YgdGhlIHNjcmVlblxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93Q2VudGVyKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXYycpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0cyB0aGUgd2luZG93IHRpdGxlXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0aXRsZVxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0VGl0bGUodGl0bGUpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV1QnICsgdGl0bGUpO1xyXG59XHJcblxyXG4vKipcclxuICogTWFrZXMgdGhlIHdpbmRvdyBnbyBmdWxsc2NyZWVuXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dGdWxsc2NyZWVuKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXRicpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV2ZXJ0cyB0aGUgd2luZG93IGZyb20gZnVsbHNjcmVlblxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93VW5mdWxsc2NyZWVuKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXZicpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgc3RhdGUgb2YgdGhlIHdpbmRvdywgaS5lLiB3aGV0aGVyIHRoZSB3aW5kb3cgaXMgaW4gZnVsbCBzY3JlZW4gbW9kZSBvciBub3QuXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gVGhlIHN0YXRlIG9mIHRoZSB3aW5kb3dcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dJc0Z1bGxzY3JlZW4oKSB7XHJcbiAgICByZXR1cm4gQ2FsbChcIjp3YWlsczpXaW5kb3dJc0Z1bGxzY3JlZW5cIik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIFNpemUgb2YgdGhlIHdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aFxyXG4gKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0U2l6ZSh3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1dzOicgKyB3aWR0aCArICc6JyArIGhlaWdodCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgdGhlIFNpemUgb2YgdGhlIHdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEByZXR1cm4ge1Byb21pc2U8e3c6IG51bWJlciwgaDogbnVtYmVyfT59IFRoZSBzaXplIG9mIHRoZSB3aW5kb3dcclxuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93R2V0U2l6ZSgpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOldpbmRvd0dldFNpemVcIik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIG1heGltdW0gc2l6ZSBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTZXRNYXhTaXplKHdpZHRoLCBoZWlnaHQpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV1o6JyArIHdpZHRoICsgJzonICsgaGVpZ2h0KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCB0aGUgbWluaW11bSBzaXplIG9mIHRoZSB3aW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge251bWJlcn0gd2lkdGhcclxuICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd1NldE1pblNpemUod2lkdGgsIGhlaWdodCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXejonICsgd2lkdGggKyAnOicgKyBoZWlnaHQpO1xyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIHdpbmRvdyBBbHdheXNPblRvcCBvciBub3Qgb24gdG9wXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTZXRBbHdheXNPblRvcChiKSB7XHJcblxyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXQVRQOicgKyAoYiA/ICcxJyA6ICcwJykpO1xyXG59XHJcblxyXG5cclxuXHJcblxyXG4vKipcclxuICogU2V0IHRoZSBQb3NpdGlvbiBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtudW1iZXJ9IHhcclxuICogQHBhcmFtIHtudW1iZXJ9IHlcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTZXRQb3NpdGlvbih4LCB5KSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1dwOicgKyB4ICsgJzonICsgeSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgdGhlIFBvc2l0aW9uIG9mIHRoZSB3aW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPHt4OiBudW1iZXIsIHk6IG51bWJlcn0+fSBUaGUgcG9zaXRpb24gb2YgdGhlIHdpbmRvd1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd0dldFBvc2l0aW9uKCkge1xyXG4gICAgcmV0dXJuIENhbGwoXCI6d2FpbHM6V2luZG93R2V0UG9zXCIpO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dIaWRlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXSCcpO1xyXG59XHJcblxyXG4vKipcclxuICogU2hvdyB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTaG93KCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXUycpO1xyXG59XHJcblxyXG4vKipcclxuICogTWF4aW1pc2UgdGhlIFdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93TWF4aW1pc2UoKSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1dNJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUb2dnbGUgdGhlIE1heGltaXNlIG9mIHRoZSBXaW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd1RvZ2dsZU1heGltaXNlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXdCcpO1xyXG59XHJcblxyXG4vKipcclxuICogVW5tYXhpbWlzZSB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dVbm1heGltaXNlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXVScpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgc3RhdGUgb2YgdGhlIHdpbmRvdywgaS5lLiB3aGV0aGVyIHRoZSB3aW5kb3cgaXMgbWF4aW1pc2VkIG9yIG5vdC5cclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPGJvb2xlYW4+fSBUaGUgc3RhdGUgb2YgdGhlIHdpbmRvd1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd0lzTWF4aW1pc2VkKCkge1xyXG4gICAgcmV0dXJuIENhbGwoXCI6d2FpbHM6V2luZG93SXNNYXhpbWlzZWRcIik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNaW5pbWlzZSB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dNaW5pbWlzZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV20nKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVubWluaW1pc2UgdGhlIFdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93VW5taW5pbWlzZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV3UnKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgdGhlIHN0YXRlIG9mIHRoZSB3aW5kb3csIGkuZS4gd2hldGhlciB0aGUgd2luZG93IGlzIG1pbmltaXNlZCBvciBub3QuXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHJldHVybiB7UHJvbWlzZTxib29sZWFuPn0gVGhlIHN0YXRlIG9mIHRoZSB3aW5kb3dcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dJc01pbmltaXNlZCgpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOldpbmRvd0lzTWluaW1pc2VkXCIpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0aGUgc3RhdGUgb2YgdGhlIHdpbmRvdywgaS5lLiB3aGV0aGVyIHRoZSB3aW5kb3cgaXMgbm9ybWFsIG9yIG5vdC5cclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPGJvb2xlYW4+fSBUaGUgc3RhdGUgb2YgdGhlIHdpbmRvd1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd0lzTm9ybWFsKCkge1xyXG4gICAgcmV0dXJuIENhbGwoXCI6d2FpbHM6V2luZG93SXNOb3JtYWxcIik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXRzIHRoZSBiYWNrZ3JvdW5kIGNvbG91ciBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtudW1iZXJ9IFIgUmVkXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBHIEdyZWVuXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBCIEJsdWVcclxuICogQHBhcmFtIHtudW1iZXJ9IEEgQWxwaGFcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTZXRCYWNrZ3JvdW5kQ29sb3VyKFIsIEcsIEIsIEEpIHtcclxuICAgIGxldCByZ2JhID0gSlNPTi5zdHJpbmdpZnkoe3I6IFIgfHwgMCwgZzogRyB8fCAwLCBiOiBCIHx8IDAsIGE6IEEgfHwgMjU1fSk7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1dyOicgKyByZ2JhKTtcclxufVxyXG5cclxuIiwgIi8qXHJcbiBfXHQgICBfX1x0ICBfIF9fXHJcbnwgfFx0IC8gL19fXyBfKF8pIC9fX19fXHJcbnwgfCAvfCAvIC8gX18gYC8gLyAvIF9fXy9cclxufCB8LyB8LyAvIC9fLyAvIC8gKF9fICApXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fL1xyXG5UaGUgZWxlY3Ryb24gYWx0ZXJuYXRpdmUgZm9yIEdvXHJcbihjKSBMZWEgQW50aG9ueSAyMDE5LXByZXNlbnRcclxuKi9cclxuXHJcbi8qIGpzaGludCBlc3ZlcnNpb246IDkgKi9cclxuXHJcblxyXG5pbXBvcnQge0NhbGx9IGZyb20gXCIuL2NhbGxzXCI7XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldHMgdGhlIGFsbCBzY3JlZW5zLiBDYWxsIHRoaXMgYW5ldyBlYWNoIHRpbWUgeW91IHdhbnQgdG8gcmVmcmVzaCBkYXRhIGZyb20gdGhlIHVuZGVybHlpbmcgd2luZG93aW5nIHN5c3RlbS5cclxuICogQGV4cG9ydFxyXG4gKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi93cmFwcGVyL3J1bnRpbWUnKS5TY3JlZW59IFNjcmVlblxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPHtTY3JlZW5bXX0+fSBUaGUgc2NyZWVuc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFNjcmVlbkdldEFsbCgpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOlNjcmVlbkdldEFsbFwiKTtcclxufVxyXG4iLCAiLyoqXHJcbiAqIEBkZXNjcmlwdGlvbjogVXNlIHRoZSBzeXN0ZW0gZGVmYXVsdCBicm93c2VyIHRvIG9wZW4gdGhlIHVybFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEJyb3dzZXJPcGVuVVJMKHVybCkge1xyXG4gIHdpbmRvdy5XYWlsc0ludm9rZSgnQk86JyArIHVybCk7XHJcbn0iLCAiLypcclxuIF9cdCAgIF9fXHQgIF8gX19cclxufCB8XHQgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG5cclxuLyoganNoaW50IGVzdmVyc2lvbjogOSAqL1xyXG5cclxuaW1wb3J0IHtDYWxsfSBmcm9tIFwiLi9jYWxsc1wiO1xyXG5cclxuLyoqXHJcbiAqIFNldCB0aGUgU2l6ZSBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IHRleHRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBDbGlwYm9hcmRTZXRUZXh0KHRleHQpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOkNsaXBib2FyZFNldFRleHRcIiwgW3RleHRdKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEdldCB0aGUgdGV4dCBjb250ZW50IG9mIHRoZSBjbGlwYm9hcmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPHtzdHJpbmd9Pn0gVGV4dCBjb250ZW50IG9mIHRoZSBjbGlwYm9hcmRcclxuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gQ2xpcGJvYXJkR2V0VGV4dCgpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOkNsaXBib2FyZEdldFRleHRcIik7XHJcbn0iLCAiLypcclxuIF9cdCAgIF9fXHQgIF8gX19cclxufCB8XHQgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG5cclxuLyoganNoaW50IGVzdmVyc2lvbjogOSAqL1xyXG5cclxuaW1wb3J0IHtFdmVudHNPbiwgRXZlbnRzT2ZmfSBmcm9tIFwiLi9ldmVudHNcIjtcclxuXHJcbmNvbnN0IGZsYWdzID0ge1xyXG4gICAgcmVnaXN0ZXJlZDogZmFsc2UsXHJcbiAgICBkZWZhdWx0VXNlRHJvcFRhcmdldDogdHJ1ZSxcclxuICAgIHVzZURyb3BUYXJnZXQ6IHRydWUsXHJcbiAgICBuZXh0RGVhY3RpdmF0ZTogbnVsbCxcclxuICAgIG5leHREZWFjdGl2YXRlVGltZW91dDogbnVsbCxcclxufTtcclxuXHJcbmNvbnN0IERST1BfVEFSR0VUX0FDVElWRSA9IFwid2FpbHMtZHJvcC10YXJnZXQtYWN0aXZlXCI7XHJcblxyXG4vKipcclxuICogY2hlY2tTdHlsZURyb3BUYXJnZXQgY2hlY2tzIGlmIHRoZSBzdHlsZSBoYXMgdGhlIGRyb3AgdGFyZ2V0IGF0dHJpYnV0ZVxyXG4gKiBcclxuICogQHBhcmFtIHtDU1NTdHlsZURlY2xhcmF0aW9ufSBzdHlsZSBcclxuICogQHJldHVybnMgXHJcbiAqL1xyXG5mdW5jdGlvbiBjaGVja1N0eWxlRHJvcFRhcmdldChzdHlsZSkge1xyXG4gICAgY29uc3QgY3NzRHJvcFZhbHVlID0gc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSh3aW5kb3cud2FpbHMuZmxhZ3MuY3NzRHJvcFByb3BlcnR5KS50cmltKCk7XHJcbiAgICBpZiAoY3NzRHJvcFZhbHVlKSB7XHJcbiAgICAgICAgaWYgKGNzc0Ryb3BWYWx1ZSA9PT0gd2luZG93LndhaWxzLmZsYWdzLmNzc0Ryb3BWYWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gaWYgdGhlIGVsZW1lbnQgaGFzIHRoZSBkcm9wIHRhcmdldCBhdHRyaWJ1dGUsIGJ1dCBcclxuICAgICAgICAvLyB0aGUgdmFsdWUgaXMgbm90IGNvcnJlY3QsIHRlcm1pbmF0ZSBmaW5kaW5nIHByb2Nlc3MuXHJcbiAgICAgICAgLy8gVGhpcyBjYW4gYmUgdXNlZnVsIHRvIGJsb2NrIHNvbWUgY2hpbGQgZWxlbWVudHMgZnJvbSBiZWluZyBkcm9wIHRhcmdldHMuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogb25EcmFnT3ZlciBpcyBjYWxsZWQgd2hlbiB0aGUgZHJhZ292ZXIgZXZlbnQgaXMgZW1pdHRlZC5cclxuICogQHBhcmFtIHtEcmFnRXZlbnR9IGVcclxuICogQHJldHVybnNcclxuICovXHJcbmZ1bmN0aW9uIG9uRHJhZ092ZXIoZSkge1xyXG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhbiBleHRlcm5hbCBmaWxlIGRyb3Agb3IgaW50ZXJuYWwgSFRNTCBkcmFnXHJcbiAgICAvLyBFeHRlcm5hbCBmaWxlIGRyb3BzIHdpbGwgaGF2ZSBcIkZpbGVzXCIgaW4gdGhlIHR5cGVzIGFycmF5XHJcbiAgICAvLyBJbnRlcm5hbCBIVE1MIGRyYWdzIHR5cGljYWxseSBoYXZlIFwidGV4dC9wbGFpblwiLCBcInRleHQvaHRtbFwiIG9yIGN1c3RvbSB0eXBlc1xyXG4gICAgY29uc3QgaXNGaWxlRHJvcCA9IGUuZGF0YVRyYW5zZmVyLnR5cGVzLmluY2x1ZGVzKFwiRmlsZXNcIik7XHJcblxyXG4gICAgLy8gT25seSBoYW5kbGUgZXh0ZXJuYWwgZmlsZSBkcm9wcywgbGV0IGludGVybmFsIEhUTUw1IGRyYWctYW5kLWRyb3Agd29yayBub3JtYWxseVxyXG4gICAgaWYgKCFpc0ZpbGVEcm9wKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFMV0FZUyBwcmV2ZW50IGRlZmF1bHQgZm9yIGZpbGUgZHJvcHMgdG8gc3RvcCBicm93c2VyIG5hdmlnYXRpb25cclxuICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XHJcblxyXG4gICAgaWYgKCF3aW5kb3cud2FpbHMuZmxhZ3MuZW5hYmxlV2FpbHNEcmFnQW5kRHJvcCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWZsYWdzLnVzZURyb3BUYXJnZXQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZWxlbWVudCA9IGUudGFyZ2V0O1xyXG5cclxuICAgIC8vIFRyaWdnZXIgZGVib3VuY2UgZnVuY3Rpb24gdG8gZGVhY3RpdmF0ZSBkcm9wIHRhcmdldHNcclxuICAgIGlmKGZsYWdzLm5leHREZWFjdGl2YXRlKSBmbGFncy5uZXh0RGVhY3RpdmF0ZSgpO1xyXG5cclxuICAgIC8vIGlmIHRoZSBlbGVtZW50IGlzIG51bGwgb3IgZWxlbWVudCBpcyBub3QgY2hpbGQgb2YgZHJvcCB0YXJnZXQgZWxlbWVudFxyXG4gICAgaWYgKCFlbGVtZW50IHx8ICFjaGVja1N0eWxlRHJvcFRhcmdldChnZXRDb21wdXRlZFN0eWxlKGVsZW1lbnQpKSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgY3VycmVudEVsZW1lbnQgPSBlbGVtZW50O1xyXG4gICAgd2hpbGUgKGN1cnJlbnRFbGVtZW50KSB7XHJcbiAgICAgICAgLy8gY2hlY2sgaWYgY3VycmVudEVsZW1lbnQgaXMgZHJvcCB0YXJnZXQgZWxlbWVudFxyXG4gICAgICAgIGlmIChjaGVja1N0eWxlRHJvcFRhcmdldChnZXRDb21wdXRlZFN0eWxlKGN1cnJlbnRFbGVtZW50KSkpIHtcclxuICAgICAgICAgICAgY3VycmVudEVsZW1lbnQuY2xhc3NMaXN0LmFkZChEUk9QX1RBUkdFVF9BQ1RJVkUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQ7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBvbkRyYWdMZWF2ZSBpcyBjYWxsZWQgd2hlbiB0aGUgZHJhZ2xlYXZlIGV2ZW50IGlzIGVtaXR0ZWQuXHJcbiAqIEBwYXJhbSB7RHJhZ0V2ZW50fSBlXHJcbiAqIEByZXR1cm5zXHJcbiAqL1xyXG5mdW5jdGlvbiBvbkRyYWdMZWF2ZShlKSB7XHJcbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGFuIGV4dGVybmFsIGZpbGUgZHJvcCBvciBpbnRlcm5hbCBIVE1MIGRyYWdcclxuICAgIGNvbnN0IGlzRmlsZURyb3AgPSBlLmRhdGFUcmFuc2Zlci50eXBlcy5pbmNsdWRlcyhcIkZpbGVzXCIpO1xyXG5cclxuICAgIC8vIE9ubHkgaGFuZGxlIGV4dGVybmFsIGZpbGUgZHJvcHMsIGxldCBpbnRlcm5hbCBIVE1MNSBkcmFnLWFuZC1kcm9wIHdvcmsgbm9ybWFsbHlcclxuICAgIGlmICghaXNGaWxlRHJvcCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBTFdBWVMgcHJldmVudCBkZWZhdWx0IGZvciBmaWxlIGRyb3BzIHRvIHN0b3AgYnJvd3NlciBuYXZpZ2F0aW9uXHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgaWYgKCF3aW5kb3cud2FpbHMuZmxhZ3MuZW5hYmxlV2FpbHNEcmFnQW5kRHJvcCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWZsYWdzLnVzZURyb3BUYXJnZXQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmluZCB0aGUgY2xvc2UgZHJvcCB0YXJnZXQgZWxlbWVudFxyXG4gICAgaWYgKCFlLnRhcmdldCB8fCAhY2hlY2tTdHlsZURyb3BUYXJnZXQoZ2V0Q29tcHV0ZWRTdHlsZShlLnRhcmdldCkpKSB7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVHJpZ2dlciBkZWJvdW5jZSBmdW5jdGlvbiB0byBkZWFjdGl2YXRlIGRyb3AgdGFyZ2V0c1xyXG4gICAgaWYoZmxhZ3MubmV4dERlYWN0aXZhdGUpIGZsYWdzLm5leHREZWFjdGl2YXRlKCk7XHJcbiAgICBcclxuICAgIC8vIFVzZSBkZWJvdW5jZSB0ZWNobmlxdWUgdG8gdGFjbGUgZHJhZ2xlYXZlIGV2ZW50cyBvbiBvdmVybGFwcGluZyBlbGVtZW50cyBhbmQgZHJvcCB0YXJnZXQgZWxlbWVudHNcclxuICAgIGZsYWdzLm5leHREZWFjdGl2YXRlID0gKCkgPT4ge1xyXG4gICAgICAgIC8vIERlYWN0aXZhdGUgYWxsIGRyb3AgdGFyZ2V0cywgbmV3IGRyb3AgdGFyZ2V0IHdpbGwgYmUgYWN0aXZhdGVkIG9uIG5leHQgZHJhZ292ZXIgZXZlbnRcclxuICAgICAgICBBcnJheS5mcm9tKGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoRFJPUF9UQVJHRVRfQUNUSVZFKSkuZm9yRWFjaChlbCA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKERST1BfVEFSR0VUX0FDVElWRSkpO1xyXG4gICAgICAgIC8vIFJlc2V0IG5leHREZWFjdGl2YXRlXHJcbiAgICAgICAgZmxhZ3MubmV4dERlYWN0aXZhdGUgPSBudWxsO1xyXG4gICAgICAgIC8vIENsZWFyIHRpbWVvdXRcclxuICAgICAgICBpZiAoZmxhZ3MubmV4dERlYWN0aXZhdGVUaW1lb3V0KSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChmbGFncy5uZXh0RGVhY3RpdmF0ZVRpbWVvdXQpO1xyXG4gICAgICAgICAgICBmbGFncy5uZXh0RGVhY3RpdmF0ZVRpbWVvdXQgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBTZXQgdGltZW91dCB0byBkZWFjdGl2YXRlIGRyb3AgdGFyZ2V0cyBpZiBub3QgdHJpZ2dlcmVkIGJ5IG5leHQgZHJhZyBldmVudFxyXG4gICAgZmxhZ3MubmV4dERlYWN0aXZhdGVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgaWYoZmxhZ3MubmV4dERlYWN0aXZhdGUpIGZsYWdzLm5leHREZWFjdGl2YXRlKCk7XHJcbiAgICB9LCA1MCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBvbkRyb3AgaXMgY2FsbGVkIHdoZW4gdGhlIGRyb3AgZXZlbnQgaXMgZW1pdHRlZC5cclxuICogQHBhcmFtIHtEcmFnRXZlbnR9IGVcclxuICogQHJldHVybnNcclxuICovXHJcbmZ1bmN0aW9uIG9uRHJvcChlKSB7XHJcbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGFuIGV4dGVybmFsIGZpbGUgZHJvcCBvciBpbnRlcm5hbCBIVE1MIGRyYWdcclxuICAgIGNvbnN0IGlzRmlsZURyb3AgPSBlLmRhdGFUcmFuc2Zlci50eXBlcy5pbmNsdWRlcyhcIkZpbGVzXCIpO1xyXG5cclxuICAgIC8vIE9ubHkgaGFuZGxlIGV4dGVybmFsIGZpbGUgZHJvcHMsIGxldCBpbnRlcm5hbCBIVE1MNSBkcmFnLWFuZC1kcm9wIHdvcmsgbm9ybWFsbHlcclxuICAgIGlmICghaXNGaWxlRHJvcCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBTFdBWVMgcHJldmVudCBkZWZhdWx0IGZvciBmaWxlIGRyb3BzIHRvIHN0b3AgYnJvd3NlciBuYXZpZ2F0aW9uXHJcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG4gICAgaWYgKCF3aW5kb3cud2FpbHMuZmxhZ3MuZW5hYmxlV2FpbHNEcmFnQW5kRHJvcCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoQ2FuUmVzb2x2ZUZpbGVQYXRocygpKSB7XHJcbiAgICAgICAgLy8gcHJvY2VzcyBmaWxlc1xyXG4gICAgICAgIGxldCBmaWxlcyA9IFtdO1xyXG4gICAgICAgIGlmIChlLmRhdGFUcmFuc2Zlci5pdGVtcykge1xyXG4gICAgICAgICAgICBmaWxlcyA9IFsuLi5lLmRhdGFUcmFuc2Zlci5pdGVtc10ubWFwKChpdGVtLCBpKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXRlbS5raW5kID09PSAnZmlsZScpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5nZXRBc0ZpbGUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZmlsZXMgPSBbLi4uZS5kYXRhVHJhbnNmZXIuZmlsZXNdO1xyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cucnVudGltZS5SZXNvbHZlRmlsZVBhdGhzKGUueCwgZS55LCBmaWxlcyk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFmbGFncy51c2VEcm9wVGFyZ2V0KSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFRyaWdnZXIgZGVib3VuY2UgZnVuY3Rpb24gdG8gZGVhY3RpdmF0ZSBkcm9wIHRhcmdldHNcclxuICAgIGlmKGZsYWdzLm5leHREZWFjdGl2YXRlKSBmbGFncy5uZXh0RGVhY3RpdmF0ZSgpO1xyXG5cclxuICAgIC8vIERlYWN0aXZhdGUgYWxsIGRyb3AgdGFyZ2V0c1xyXG4gICAgQXJyYXkuZnJvbShkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKERST1BfVEFSR0VUX0FDVElWRSkpLmZvckVhY2goZWwgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShEUk9QX1RBUkdFVF9BQ1RJVkUpKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIHBvc3RNZXNzYWdlV2l0aEFkZGl0aW9uYWxPYmplY3RzIGNoZWNrcyB0aGUgYnJvd3NlcidzIGNhcGFiaWxpdHkgb2Ygc2VuZGluZyBwb3N0TWVzc2FnZVdpdGhBZGRpdGlvbmFsT2JqZWN0c1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gQ2FuUmVzb2x2ZUZpbGVQYXRocygpIHtcclxuICAgIHJldHVybiB3aW5kb3cuY2hyb21lPy53ZWJ2aWV3Py5wb3N0TWVzc2FnZVdpdGhBZGRpdGlvbmFsT2JqZWN0cyAhPSBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogUmVzb2x2ZUZpbGVQYXRocyBzZW5kcyBkcm9wIGV2ZW50cyB0byB0aGUgR08gc2lkZSB0byByZXNvbHZlIGZpbGUgcGF0aHMgb24gd2luZG93cy5cclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IHhcclxuICogQHBhcmFtIHtudW1iZXJ9IHlcclxuICogQHBhcmFtIHthbnlbXX0gZmlsZXNcclxuICogQGNvbnN0cnVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gUmVzb2x2ZUZpbGVQYXRocyh4LCB5LCBmaWxlcykge1xyXG4gICAgLy8gT25seSBmb3Igd2luZG93cyB3ZWJ2aWV3MiA+PSAxLjAuMTc3NC4zMFxyXG4gICAgLy8gaHR0cHM6Ly9sZWFybi5taWNyb3NvZnQuY29tL2VuLXVzL21pY3Jvc29mdC1lZGdlL3dlYnZpZXcyL3JlZmVyZW5jZS93aW4zMi9pY29yZXdlYnZpZXcyd2VibWVzc2FnZXJlY2VpdmVkZXZlbnRhcmdzMj92aWV3PXdlYnZpZXcyLTEuMC4xODIzLjMyI2FwcGxpZXMtdG9cclxuICAgIGlmICh3aW5kb3cuY2hyb21lPy53ZWJ2aWV3Py5wb3N0TWVzc2FnZVdpdGhBZGRpdGlvbmFsT2JqZWN0cykge1xyXG4gICAgICAgIGNocm9tZS53ZWJ2aWV3LnBvc3RNZXNzYWdlV2l0aEFkZGl0aW9uYWxPYmplY3RzKGBmaWxlOmRyb3A6JHt4fToke3l9YCwgZmlsZXMpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ2FsbGJhY2sgZm9yIE9uRmlsZURyb3AgcmV0dXJucyBhIHNsaWNlIG9mIGZpbGUgcGF0aCBzdHJpbmdzIHdoZW4gYSBkcm9wIGlzIGZpbmlzaGVkLlxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBjYWxsYmFjayBPbkZpbGVEcm9wQ2FsbGJhY2tcclxuICogQHBhcmFtIHtudW1iZXJ9IHggLSB4IGNvb3JkaW5hdGUgb2YgdGhlIGRyb3BcclxuICogQHBhcmFtIHtudW1iZXJ9IHkgLSB5IGNvb3JkaW5hdGUgb2YgdGhlIGRyb3BcclxuICogQHBhcmFtIHtzdHJpbmdbXX0gcGF0aHMgLSBBIGxpc3Qgb2YgZmlsZSBwYXRocy5cclxuICovXHJcblxyXG4vKipcclxuICogT25GaWxlRHJvcCBsaXN0ZW5zIHRvIGRyYWcgYW5kIGRyb3AgZXZlbnRzIGFuZCBjYWxscyB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgY29vcmRpbmF0ZXMgb2YgdGhlIGRyb3AgYW5kIGFuIGFycmF5IG9mIHBhdGggc3RyaW5ncy5cclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge09uRmlsZURyb3BDYWxsYmFja30gY2FsbGJhY2sgLSBDYWxsYmFjayBmb3IgT25GaWxlRHJvcCByZXR1cm5zIGEgc2xpY2Ugb2YgZmlsZSBwYXRoIHN0cmluZ3Mgd2hlbiBhIGRyb3AgaXMgZmluaXNoZWQuXHJcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW3VzZURyb3BUYXJnZXQ9dHJ1ZV0gLSBPbmx5IGNhbGwgdGhlIGNhbGxiYWNrIHdoZW4gdGhlIGRyb3AgZmluaXNoZWQgb24gYW4gZWxlbWVudCB0aGF0IGhhcyB0aGUgZHJvcCB0YXJnZXQgc3R5bGUuICgtLXdhaWxzLWRyb3AtdGFyZ2V0KVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIE9uRmlsZURyb3AoY2FsbGJhY2ssIHVzZURyb3BUYXJnZXQpIHtcclxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT09IFwiZnVuY3Rpb25cIikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJEcmFnQW5kRHJvcENhbGxiYWNrIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZmxhZ3MucmVnaXN0ZXJlZCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGZsYWdzLnJlZ2lzdGVyZWQgPSB0cnVlO1xyXG5cclxuICAgIGNvbnN0IHVEVFBUID0gdHlwZW9mIHVzZURyb3BUYXJnZXQ7XHJcbiAgICBmbGFncy51c2VEcm9wVGFyZ2V0ID0gdURUUFQgPT09IFwidW5kZWZpbmVkXCIgfHwgdURUUFQgIT09IFwiYm9vbGVhblwiID8gZmxhZ3MuZGVmYXVsdFVzZURyb3BUYXJnZXQgOiB1c2VEcm9wVGFyZ2V0O1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgb25EcmFnT3Zlcik7XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgb25EcmFnTGVhdmUpO1xyXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBvbkRyb3ApO1xyXG5cclxuICAgIGxldCBjYiA9IGNhbGxiYWNrO1xyXG4gICAgaWYgKGZsYWdzLnVzZURyb3BUYXJnZXQpIHtcclxuICAgICAgICBjYiA9IGZ1bmN0aW9uICh4LCB5LCBwYXRocykge1xyXG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCh4LCB5KVxyXG4gICAgICAgICAgICAvLyBpZiB0aGUgZWxlbWVudCBpcyBudWxsIG9yIGVsZW1lbnQgaXMgbm90IGNoaWxkIG9mIGRyb3AgdGFyZ2V0IGVsZW1lbnQsIHJldHVybiBudWxsXHJcbiAgICAgICAgICAgIGlmICghZWxlbWVudCB8fCAhY2hlY2tTdHlsZURyb3BUYXJnZXQoZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKHgsIHksIHBhdGhzKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgRXZlbnRzT24oXCJ3YWlsczpmaWxlLWRyb3BcIiwgY2IpO1xyXG59XHJcblxyXG4vKipcclxuICogT25GaWxlRHJvcE9mZiByZW1vdmVzIHRoZSBkcmFnIGFuZCBkcm9wIGxpc3RlbmVycyBhbmQgaGFuZGxlcnMuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gT25GaWxlRHJvcE9mZigpIHtcclxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIG9uRHJhZ092ZXIpO1xyXG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIG9uRHJhZ0xlYXZlKTtcclxuICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdkcm9wJywgb25Ecm9wKTtcclxuICAgIEV2ZW50c09mZihcIndhaWxzOmZpbGUtZHJvcFwiKTtcclxuICAgIGZsYWdzLnJlZ2lzdGVyZWQgPSBmYWxzZTtcclxufVxyXG4iLCAiLypcclxuLS1kZWZhdWx0LWNvbnRleHRtZW51OiBhdXRvOyAoZGVmYXVsdCkgd2lsbCBzaG93IHRoZSBkZWZhdWx0IGNvbnRleHQgbWVudSBpZiBjb250ZW50RWRpdGFibGUgaXMgdHJ1ZSBPUiB0ZXh0IGhhcyBiZWVuIHNlbGVjdGVkIE9SIGVsZW1lbnQgaXMgaW5wdXQgb3IgdGV4dGFyZWFcclxuLS1kZWZhdWx0LWNvbnRleHRtZW51OiBzaG93OyB3aWxsIGFsd2F5cyBzaG93IHRoZSBkZWZhdWx0IGNvbnRleHQgbWVudVxyXG4tLWRlZmF1bHQtY29udGV4dG1lbnU6IGhpZGU7IHdpbGwgYWx3YXlzIGhpZGUgdGhlIGRlZmF1bHQgY29udGV4dCBtZW51XHJcblxyXG5UaGlzIHJ1bGUgaXMgaW5oZXJpdGVkIGxpa2Ugbm9ybWFsIENTUyBydWxlcywgc28gbmVzdGluZyB3b3JrcyBhcyBleHBlY3RlZFxyXG4qL1xyXG5leHBvcnQgZnVuY3Rpb24gcHJvY2Vzc0RlZmF1bHRDb250ZXh0TWVudShldmVudCkge1xyXG4gICAgLy8gUHJvY2VzcyBkZWZhdWx0IGNvbnRleHQgbWVudVxyXG4gICAgY29uc3QgZWxlbWVudCA9IGV2ZW50LnRhcmdldDtcclxuICAgIGNvbnN0IGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KTtcclxuICAgIGNvbnN0IGRlZmF1bHRDb250ZXh0TWVudUFjdGlvbiA9IGNvbXB1dGVkU3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShcIi0tZGVmYXVsdC1jb250ZXh0bWVudVwiKS50cmltKCk7XHJcbiAgICBzd2l0Y2ggKGRlZmF1bHRDb250ZXh0TWVudUFjdGlvbikge1xyXG4gICAgICAgIGNhc2UgXCJzaG93XCI6XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICBjYXNlIFwiaGlkZVwiOlxyXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgY29udGVudEVkaXRhYmxlIGlzIHRydWVcclxuICAgICAgICAgICAgaWYgKGVsZW1lbnQuaXNDb250ZW50RWRpdGFibGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGV4dCBoYXMgYmVlbiBzZWxlY3RlZCBhbmQgYWN0aW9uIGlzIG9uIHRoZSBzZWxlY3RlZCBlbGVtZW50c1xyXG4gICAgICAgICAgICBjb25zdCBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGhhc1NlbGVjdGlvbiA9IChzZWxlY3Rpb24udG9TdHJpbmcoKS5sZW5ndGggPiAwKVxyXG4gICAgICAgICAgICBpZiAoaGFzU2VsZWN0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdGlvbi5yYW5nZUNvdW50OyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByYW5nZSA9IHNlbGVjdGlvbi5nZXRSYW5nZUF0KGkpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3RzID0gcmFuZ2UuZ2V0Q2xpZW50UmVjdHMoKTtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJlY3RzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3QgPSByZWN0c1tqXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQocmVjdC5sZWZ0LCByZWN0LnRvcCkgPT09IGVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0YWduYW1lIGlzIGlucHV0IG9yIHRleHRhcmVhXHJcbiAgICAgICAgICAgIGlmIChlbGVtZW50LnRhZ05hbWUgPT09IFwiSU5QVVRcIiB8fCBlbGVtZW50LnRhZ05hbWUgPT09IFwiVEVYVEFSRUFcIikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGhhc1NlbGVjdGlvbiB8fCAoIWVsZW1lbnQucmVhZE9ubHkgJiYgIWVsZW1lbnQuZGlzYWJsZWQpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBoaWRlIGRlZmF1bHQgY29udGV4dCBtZW51XHJcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB9XHJcbn1cclxuIiwgIi8qXHJcbiBfXHQgICBfX1x0ICBfIF9fXHJcbnwgfFx0IC8gL19fXyBfKF8pIC9fX19fXHJcbnwgfCAvfCAvIC8gX18gYC8gLyAvIF9fXy9cclxufCB8LyB8LyAvIC9fLyAvIC8gKF9fICApXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fL1xyXG5UaGUgZWxlY3Ryb24gYWx0ZXJuYXRpdmUgZm9yIEdvXHJcbihjKSBMZWEgQW50aG9ueSAyMDE5LXByZXNlbnRcclxuKi9cclxuLyoganNoaW50IGVzdmVyc2lvbjogOSAqL1xyXG5pbXBvcnQgKiBhcyBMb2cgZnJvbSAnLi9sb2cnO1xyXG5pbXBvcnQge1xyXG4gICAgZXZlbnRMaXN0ZW5lcnMsXHJcbiAgICBFdmVudHNFbWl0LFxyXG4gICAgRXZlbnRzTm90aWZ5LFxyXG4gICAgRXZlbnRzT2ZmLFxyXG4gICAgRXZlbnRzT2ZmQWxsLFxyXG4gICAgRXZlbnRzT24sXHJcbiAgICBFdmVudHNPbmNlLFxyXG4gICAgRXZlbnRzT25NdWx0aXBsZSxcclxuICAgIEV2ZW50c1JlYmluZCxcclxufSBmcm9tICcuL2V2ZW50cyc7XHJcbmltcG9ydCB7Q2FsbCwgQ2FsbGJhY2ssIGNhbGxiYWNrc30gZnJvbSAnLi9jYWxscyc7XHJcbmltcG9ydCB7U2V0QmluZGluZ3N9IGZyb20gXCIuL2JpbmRpbmdzXCI7XHJcbmltcG9ydCAqIGFzIFdpbmRvdyBmcm9tIFwiLi93aW5kb3dcIjtcclxuaW1wb3J0ICogYXMgU2NyZWVuIGZyb20gXCIuL3NjcmVlblwiO1xyXG5pbXBvcnQgKiBhcyBCcm93c2VyIGZyb20gXCIuL2Jyb3dzZXJcIjtcclxuaW1wb3J0ICogYXMgQ2xpcGJvYXJkIGZyb20gXCIuL2NsaXBib2FyZFwiO1xyXG5pbXBvcnQgKiBhcyBEcmFnQW5kRHJvcCBmcm9tIFwiLi9kcmFnYW5kZHJvcFwiO1xyXG5pbXBvcnQgKiBhcyBDb250ZXh0TWVudSBmcm9tIFwiLi9jb250ZXh0bWVudVwiO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIFF1aXQoKSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1EnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIFNob3coKSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1MnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIEhpZGUoKSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ0gnKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIEVudmlyb25tZW50KCkge1xyXG4gICAgcmV0dXJuIENhbGwoXCI6d2FpbHM6RW52aXJvbm1lbnRcIik7XHJcbn1cclxuXHJcbi8vIFRoZSBKUyBydW50aW1lXHJcbndpbmRvdy5ydW50aW1lID0ge1xyXG4gICAgLi4uTG9nLFxyXG4gICAgLi4uV2luZG93LFxyXG4gICAgLi4uQnJvd3NlcixcclxuICAgIC4uLlNjcmVlbixcclxuICAgIC4uLkNsaXBib2FyZCxcclxuICAgIC4uLkRyYWdBbmREcm9wLFxyXG4gICAgRXZlbnRzT24sXHJcbiAgICBFdmVudHNPbmNlLFxyXG4gICAgRXZlbnRzT25NdWx0aXBsZSxcclxuICAgIEV2ZW50c0VtaXQsXHJcbiAgICBFdmVudHNPZmYsXHJcbiAgICBFdmVudHNPZmZBbGwsXHJcbiAgICBFbnZpcm9ubWVudCxcclxuICAgIFNob3csXHJcbiAgICBIaWRlLFxyXG4gICAgUXVpdCxcclxuICAgIEV2ZW50c1JlYmluZCxcclxufTtcclxuXHJcbi8vIEludGVybmFsIHdhaWxzIGVuZHBvaW50c1xyXG53aW5kb3cud2FpbHMgPSB7XHJcbiAgICBDYWxsYmFjayxcclxuICAgIEV2ZW50c05vdGlmeSxcclxuICAgIFNldEJpbmRpbmdzLFxyXG4gICAgZXZlbnRMaXN0ZW5lcnMsXHJcbiAgICBjYWxsYmFja3MsXHJcbiAgICBmbGFnczoge1xyXG4gICAgICAgIGRpc2FibGVTY3JvbGxiYXJEcmFnOiBmYWxzZSxcclxuICAgICAgICBkaXNhYmxlRGVmYXVsdENvbnRleHRNZW51OiBmYWxzZSxcclxuICAgICAgICBlbmFibGVSZXNpemU6IGZhbHNlLFxyXG4gICAgICAgIGRlZmF1bHRDdXJzb3I6IG51bGwsXHJcbiAgICAgICAgYm9yZGVyVGhpY2tuZXNzOiA2LFxyXG4gICAgICAgIHNob3VsZERyYWc6IGZhbHNlLFxyXG4gICAgICAgIGRlZmVyRHJhZ1RvTW91c2VNb3ZlOiB0cnVlLFxyXG4gICAgICAgIGNzc0RyYWdQcm9wZXJ0eTogXCItLXdhaWxzLWRyYWdnYWJsZVwiLFxyXG4gICAgICAgIGNzc0RyYWdWYWx1ZTogXCJkcmFnXCIsXHJcbiAgICAgICAgY3NzRHJvcFByb3BlcnR5OiBcIi0td2FpbHMtZHJvcC10YXJnZXRcIixcclxuICAgICAgICBjc3NEcm9wVmFsdWU6IFwiZHJvcFwiLFxyXG4gICAgICAgIGVuYWJsZVdhaWxzRHJhZ0FuZERyb3A6IGZhbHNlLFxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gU2V0IHRoZSBiaW5kaW5nc1xyXG5pZiAod2luZG93LndhaWxzYmluZGluZ3MpIHtcclxuICAgIHdpbmRvdy53YWlscy5TZXRCaW5kaW5ncyh3aW5kb3cud2FpbHNiaW5kaW5ncyk7XHJcbiAgICBkZWxldGUgd2luZG93LndhaWxzLlNldEJpbmRpbmdzO1xyXG59XHJcblxyXG4vLyAoYm9vbCkgVGhpcyBpcyBldmFsdWF0ZWQgYXQgYnVpbGQgdGltZSBpbiBwYWNrYWdlLmpzb25cclxuaWYgKCFERUJVRykge1xyXG4gICAgZGVsZXRlIHdpbmRvdy53YWlsc2JpbmRpbmdzO1xyXG59XHJcblxyXG5sZXQgZHJhZ1Rlc3QgPSBmdW5jdGlvbihlKSB7XHJcbiAgICB2YXIgdmFsID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZS50YXJnZXQpLmdldFByb3BlcnR5VmFsdWUod2luZG93LndhaWxzLmZsYWdzLmNzc0RyYWdQcm9wZXJ0eSk7XHJcbiAgICBpZiAodmFsKSB7XHJcbiAgICAgICAgdmFsID0gdmFsLnRyaW0oKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodmFsICE9PSB3aW5kb3cud2FpbHMuZmxhZ3MuY3NzRHJhZ1ZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChlLmJ1dHRvbnMgIT09IDEpIHtcclxuICAgICAgICAvLyBEbyBub3Qgc3RhcnQgZHJhZ2dpbmcgaWYgbm90IHRoZSBwcmltYXJ5IGJ1dHRvbiBoYXMgYmVlbiBjbGlja2VkLlxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZS5kZXRhaWwgIT09IDEpIHtcclxuICAgICAgICAvLyBEbyBub3Qgc3RhcnQgZHJhZ2dpbmcgaWYgbW9yZSB0aGFuIG9uY2UgaGFzIGJlZW4gY2xpY2tlZCwgZS5nLiB3aGVuIGRvdWJsZSBjbGlja2luZ1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxufTtcclxuXHJcbndpbmRvdy53YWlscy5zZXRDU1NEcmFnUHJvcGVydGllcyA9IGZ1bmN0aW9uKHByb3BlcnR5LCB2YWx1ZSkge1xyXG4gICAgd2luZG93LndhaWxzLmZsYWdzLmNzc0RyYWdQcm9wZXJ0eSA9IHByb3BlcnR5O1xyXG4gICAgd2luZG93LndhaWxzLmZsYWdzLmNzc0RyYWdWYWx1ZSA9IHZhbHVlO1xyXG59XHJcblxyXG53aW5kb3cud2FpbHMuc2V0Q1NTRHJvcFByb3BlcnRpZXMgPSBmdW5jdGlvbihwcm9wZXJ0eSwgdmFsdWUpIHtcclxuICAgIHdpbmRvdy53YWlscy5mbGFncy5jc3NEcm9wUHJvcGVydHkgPSBwcm9wZXJ0eTtcclxuICAgIHdpbmRvdy53YWlscy5mbGFncy5jc3NEcm9wVmFsdWUgPSB2YWx1ZTtcclxufVxyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIChlKSA9PiB7XHJcbiAgICAvLyBDaGVjayBmb3IgcmVzaXppbmdcclxuICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MucmVzaXplRWRnZSkge1xyXG4gICAgICAgIHdpbmRvdy5XYWlsc0ludm9rZShcInJlc2l6ZTpcIiArIHdpbmRvdy53YWlscy5mbGFncy5yZXNpemVFZGdlKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChkcmFnVGVzdChlKSkge1xyXG4gICAgICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MuZGlzYWJsZVNjcm9sbGJhckRyYWcpIHtcclxuICAgICAgICAgICAgLy8gVGhpcyBjaGVja3MgZm9yIGNsaWNrcyBvbiB0aGUgc2Nyb2xsIGJhclxyXG4gICAgICAgICAgICBpZiAoZS5vZmZzZXRYID4gZS50YXJnZXQuY2xpZW50V2lkdGggfHwgZS5vZmZzZXRZID4gZS50YXJnZXQuY2xpZW50SGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHdpbmRvdy53YWlscy5mbGFncy5kZWZlckRyYWdUb01vdXNlTW92ZSkge1xyXG4gICAgICAgICAgICB3aW5kb3cud2FpbHMuZmxhZ3Muc2hvdWxkRHJhZyA9IHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXHJcbiAgICAgICAgICAgIHdpbmRvdy5XYWlsc0ludm9rZShcImRyYWdcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgd2luZG93LndhaWxzLmZsYWdzLnNob3VsZERyYWcgPSBmYWxzZTtcclxuICAgIH1cclxufSk7XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsICgpID0+IHtcclxuICAgIHdpbmRvdy53YWlscy5mbGFncy5zaG91bGREcmFnID0gZmFsc2U7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gc2V0UmVzaXplKGN1cnNvcikge1xyXG4gICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLmN1cnNvciA9IGN1cnNvciB8fCB3aW5kb3cud2FpbHMuZmxhZ3MuZGVmYXVsdEN1cnNvcjtcclxuICAgIHdpbmRvdy53YWlscy5mbGFncy5yZXNpemVFZGdlID0gY3Vyc29yO1xyXG59XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgZnVuY3Rpb24oZSkge1xyXG4gICAgaWYgKHdpbmRvdy53YWlscy5mbGFncy5zaG91bGREcmFnKSB7XHJcbiAgICAgICAgd2luZG93LndhaWxzLmZsYWdzLnNob3VsZERyYWcgPSBmYWxzZTtcclxuICAgICAgICBsZXQgbW91c2VQcmVzc2VkID0gZS5idXR0b25zICE9PSB1bmRlZmluZWQgPyBlLmJ1dHRvbnMgOiBlLndoaWNoO1xyXG4gICAgICAgIGlmIChtb3VzZVByZXNzZWQgPiAwKSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5XYWlsc0ludm9rZShcImRyYWdcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBpZiAoIXdpbmRvdy53YWlscy5mbGFncy5lbmFibGVSZXNpemUpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZiAod2luZG93LndhaWxzLmZsYWdzLmRlZmF1bHRDdXJzb3IgPT0gbnVsbCkge1xyXG4gICAgICAgIHdpbmRvdy53YWlscy5mbGFncy5kZWZhdWx0Q3Vyc29yID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnN0eWxlLmN1cnNvcjtcclxuICAgIH1cclxuICAgIGlmICh3aW5kb3cub3V0ZXJXaWR0aCAtIGUuY2xpZW50WCA8IHdpbmRvdy53YWlscy5mbGFncy5ib3JkZXJUaGlja25lc3MgJiYgd2luZG93Lm91dGVySGVpZ2h0IC0gZS5jbGllbnRZIDwgd2luZG93LndhaWxzLmZsYWdzLmJvcmRlclRoaWNrbmVzcykge1xyXG4gICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZS5jdXJzb3IgPSBcInNlLXJlc2l6ZVwiO1xyXG4gICAgfVxyXG4gICAgbGV0IHJpZ2h0Qm9yZGVyID0gd2luZG93Lm91dGVyV2lkdGggLSBlLmNsaWVudFggPCB3aW5kb3cud2FpbHMuZmxhZ3MuYm9yZGVyVGhpY2tuZXNzO1xyXG4gICAgbGV0IGxlZnRCb3JkZXIgPSBlLmNsaWVudFggPCB3aW5kb3cud2FpbHMuZmxhZ3MuYm9yZGVyVGhpY2tuZXNzO1xyXG4gICAgbGV0IHRvcEJvcmRlciA9IGUuY2xpZW50WSA8IHdpbmRvdy53YWlscy5mbGFncy5ib3JkZXJUaGlja25lc3M7XHJcbiAgICBsZXQgYm90dG9tQm9yZGVyID0gd2luZG93Lm91dGVySGVpZ2h0IC0gZS5jbGllbnRZIDwgd2luZG93LndhaWxzLmZsYWdzLmJvcmRlclRoaWNrbmVzcztcclxuXHJcbiAgICAvLyBJZiB3ZSBhcmVuJ3Qgb24gYW4gZWRnZSwgYnV0IHdlcmUsIHJlc2V0IHRoZSBjdXJzb3IgdG8gZGVmYXVsdFxyXG4gICAgaWYgKCFsZWZ0Qm9yZGVyICYmICFyaWdodEJvcmRlciAmJiAhdG9wQm9yZGVyICYmICFib3R0b21Cb3JkZXIgJiYgd2luZG93LndhaWxzLmZsYWdzLnJlc2l6ZUVkZ2UgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHNldFJlc2l6ZSgpO1xyXG4gICAgfSBlbHNlIGlmIChyaWdodEJvcmRlciAmJiBib3R0b21Cb3JkZXIpIHNldFJlc2l6ZShcInNlLXJlc2l6ZVwiKTtcclxuICAgIGVsc2UgaWYgKGxlZnRCb3JkZXIgJiYgYm90dG9tQm9yZGVyKSBzZXRSZXNpemUoXCJzdy1yZXNpemVcIik7XHJcbiAgICBlbHNlIGlmIChsZWZ0Qm9yZGVyICYmIHRvcEJvcmRlcikgc2V0UmVzaXplKFwibnctcmVzaXplXCIpO1xyXG4gICAgZWxzZSBpZiAodG9wQm9yZGVyICYmIHJpZ2h0Qm9yZGVyKSBzZXRSZXNpemUoXCJuZS1yZXNpemVcIik7XHJcbiAgICBlbHNlIGlmIChsZWZ0Qm9yZGVyKSBzZXRSZXNpemUoXCJ3LXJlc2l6ZVwiKTtcclxuICAgIGVsc2UgaWYgKHRvcEJvcmRlcikgc2V0UmVzaXplKFwibi1yZXNpemVcIik7XHJcbiAgICBlbHNlIGlmIChib3R0b21Cb3JkZXIpIHNldFJlc2l6ZShcInMtcmVzaXplXCIpO1xyXG4gICAgZWxzZSBpZiAocmlnaHRCb3JkZXIpIHNldFJlc2l6ZShcImUtcmVzaXplXCIpO1xyXG5cclxufSk7XHJcblxyXG4vLyBTZXR1cCBjb250ZXh0IG1lbnUgaG9va1xyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBmdW5jdGlvbihlKSB7XHJcbiAgICAvLyBhbHdheXMgc2hvdyB0aGUgY29udGV4dG1lbnUgaW4gZGVidWcgJiBkZXZcclxuICAgIGlmIChERUJVRykgcmV0dXJuO1xyXG5cclxuICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MuZGlzYWJsZURlZmF1bHRDb250ZXh0TWVudSkge1xyXG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgQ29udGV4dE1lbnUucHJvY2Vzc0RlZmF1bHRDb250ZXh0TWVudShlKTtcclxuICAgIH1cclxufSk7XHJcblxyXG53aW5kb3cuV2FpbHNJbnZva2UoXCJydW50aW1lOnJlYWR5XCIpOyJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBa0JBLFdBQVMsZUFBZSxPQUFPLFNBQVM7QUFJdkMsV0FBTyxZQUFZLE1BQU0sUUFBUSxPQUFPO0FBQUEsRUFDekM7QUFRTyxXQUFTLFNBQVMsU0FBUztBQUNqQyxtQkFBZSxLQUFLLE9BQU87QUFBQSxFQUM1QjtBQVFPLFdBQVMsU0FBUyxTQUFTO0FBQ2pDLG1CQUFlLEtBQUssT0FBTztBQUFBLEVBQzVCO0FBUU8sV0FBUyxTQUFTLFNBQVM7QUFDakMsbUJBQWUsS0FBSyxPQUFPO0FBQUEsRUFDNUI7QUFRTyxXQUFTLFFBQVEsU0FBUztBQUNoQyxtQkFBZSxLQUFLLE9BQU87QUFBQSxFQUM1QjtBQVFPLFdBQVMsV0FBVyxTQUFTO0FBQ25DLG1CQUFlLEtBQUssT0FBTztBQUFBLEVBQzVCO0FBUU8sV0FBUyxTQUFTLFNBQVM7QUFDakMsbUJBQWUsS0FBSyxPQUFPO0FBQUEsRUFDNUI7QUFRTyxXQUFTLFNBQVMsU0FBUztBQUNqQyxtQkFBZSxLQUFLLE9BQU87QUFBQSxFQUM1QjtBQVFP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QkFBaUIsYUFBYSxTQUFTLEdBQUc7QUFDN0MsUUFBSSxPQUFPLE1BQU0sTUFBTSxZQUFZO0FBQy9CLGFBQU8sTUFBTSxNQUFNLGFBQWE7QUFDaEMsVUFBSSxlQUFlLEVBQUUsWUFBWSxTQUFZLEVBQUUsVUFBVSxFQUFFO0FBQzNELFVBQUksZUFBZSxHQUFHO0FBQ2xCLGVBQU8sWUFBWSxNQUFNO0FBQ3pCO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFDQSxRQUFJLENBQUMsT0FBTyxNQUFNLE1BQU0sY0FBYztBQUNsQztBQUFBLElBQ0o7QUFDQSxRQUFJLE9BQU8sTUFBTSxNQUFNLGlCQUFpQixNQUFNO0FBQzFDLGFBQU8sTUFBTSxNQUFNLGdCQUFnQixTQUFTLGdCQUFnQixNQUFNO0FBQUEsSUFDdEU7QUFDQSxRQUFJLE9BQU8sYUFBYSxFQUFFLFVBQVUsT0FBTyxNQUFNLE1BQU0sbUJBQW1CLE9BQU8sY0FBYyxFQUFFLFVBQVUsT0FBTyxNQUFNLE1BQU0saUJBQWlCO0FBQzNJLGVBQVMsZ0JBQWdCLE1BQU0sU0FBUztBQUFBLElBQzVDO0FBQ0EsUUFBSSxjQUFjLE9BQU8sYUFBYSxFQUFFLFVBQVUsT0FBTyxNQUFNLE1BQU07QUFDckUsUUFBSSxhQUFhLEVBQUUsVUFBVSxPQUFPLE1BQU0sTUFBTTtBQUNoRCxRQUFJLFlBQVksRUFBRSxVQUFVLE9BQU8sTUFBTSxNQUFNO0FBQy9DLFFBQUksZUFBZSxPQUFPLGNBQWMsRUFBRSxVQUFVLE9BQU8sTUFBTSxNQUFNO0FBR3ZFLFFBQUksQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsT0FBTyxNQUFNLE1BQU0sZUFBZSxRQUFXO0FBQzNHLGdCQUFVO0FBQUEsSUFDZCxXQUFXLGVBQWU7QUFBYyxnQkFBVSxXQUFXO0FBQUEsYUFDcEQsY0FBYztBQUFjLGdCQUFVLFdBQVc7QUFBQSxhQUNqRCxjQUFjO0FBQVcsZ0JBQVUsV0FBVztBQUFBLGFBQzlDLGFBQWE7QUFBYSxnQkFBVSxXQUFXO0FBQUEsYUFDL0M7QUFBWSxnQkFBVSxVQUFVO0FBQUEsYUFDaEM7QUFBVyxnQkFBVSxVQUFVO0FBQUEsYUFDL0I7QUFBYyxnQkFBVSxVQUFVO0FBQUEsYUFDbEM7QUFBYSxnQkFBVSxVQUFVO0FBQUEsRUFFOUMsQ0FBQztBQUdELFNBQU8saUJBQWlCLGVBQWUsU0FBUyxHQUFHO0FBRS9DLFFBQUk7QUFBTztBQUVYLFFBQUksT0FBTyxNQUFNLE1BQU0sMkJBQTJCO0FBQzlDLFFBQUUsZUFBZTtBQUFBLElBQ3JCLE9BQU87QUFDSCxNQUFZLDBCQUEwQixDQUFDO0FBQUEsSUFDM0M7QUFBQSxFQUNKLENBQUM7QUFFRCxTQUFPLFlBQVksZUFBZTsiLAogICJuYW1lcyI6IFsiZXZlbnROYW1lIl0KfQo=
