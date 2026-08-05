const { afterEach, beforeEach, describe, expect, test } = require("@jest/globals");
const d3 = require("d3");
const zoomSliderFactory = require("./zoomSlider");

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const originalGlobals = new Map(
  ["CustomEvent", "document", "window", "d3", "performance", "requestAnimationFrame", "cancelAnimationFrame"]
    .map((name) => [name, Object.getOwnPropertyDescriptor(global, name)])
);

class MockEventTarget {
  constructor(){
    this.listeners = {};
  }

  addEventListener(type, fn){
    if ( !this.listeners[type] ) {this.listeners[type] = [];}
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn){
    if ( this.listeners[type] ) {
      this.listeners[type] = this.listeners[type].filter((listener) => listener !== fn);
    }
  }

  dispatchEvent(event){
    event.target = this;
    const handlers = (this.listeners[event.type] || []).slice();
    handlers.forEach((handler) => handler.call(this, event, this.__data__));
    return !event.defaultPrevented;
  }
}

class MockElement extends MockEventTarget {
  constructor(id, className, tagName = "div"){
    super();
    this.id = id || "";
    this.className = className || "";
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.style = {};
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this.capturedPointers = new Set();
    this.namespaceURI = HTML_NAMESPACE;
  }

  setAttribute(name, value){
    this.attributes[name] = value;
  }

  getAttribute(name){
    return this.attributes[name] || "";
  }

  appendChild(child){
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(child){
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  setPointerCapture(pointerId){
    this.capturedPointers.add(pointerId);
  }

  getBoundingClientRect(){
    return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 };
  }
}

class MockEvent {
  constructor(type, options = {}){
    this.type = type;
    this.cancelable = options.cancelable !== undefined ? options.cancelable : true;
    this.bubbles = options.bubbles || false;
    this.defaultPrevented = false;
    Object.assign(this, options);
  }

  preventDefault(){
    if ( this.cancelable ) {
      this.defaultPrevented = true;
    }
  }
}

describe("zoomSlider input handling", () => {
  let elementMap;
  let frameCallbacks;
  let currentTime;
  let nextFrameId;

  function restoreGlobal(name){
    const descriptor = originalGlobals.get(name);
    if ( descriptor ) {
      Object.defineProperty(global, name, descriptor);
    } else {
      delete global[name];
    }
  }

  function getOrCreateElement(idKey){
    const cleanId = idKey.startsWith("#") ? idKey.slice(1) : idKey;
    if ( !elementMap[cleanId] ) {
      elementMap[cleanId] = new MockElement(cleanId);
    }
    return elementMap[cleanId];
  }

  function runAnimationFrame(timestamp){
    currentTime = timestamp;
    const callbacks = Array.from(frameCallbacks.values());
    frameCallbacks.clear();
    callbacks.forEach((callback) => callback(timestamp));
  }

  function pointerEvent(type, options = {}){
    return new MockEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      isPrimary: true,
      detail: 0,
      ...options,
    });
  }

  function keyEvent(type, key, options = {}){
    return new MockEvent(type, { key, repeat: false, detail: 0, ...options });
  }

  function mountZoomSlider(options = {}){
    const minMagnification = options.minMagnification || 0.1;
    const maxMagnification = options.maxMagnification || 4;
    let scale = options.scale || 1;
    const hideAllMenus = jest.fn();
    const setSliderZoom = jest.fn((value) => {
      scale = Number(value);
    });
    const forceRelocationEvent = jest.fn();
    const graph = {
      options: () => ({
        minMagnification: () => minMagnification,
        maxMagnification: () => maxMagnification,
        width: () => 800,
        height: () => 600,
        navigationMenu: () => ({ hideAllMenus }),
      }),
      scaleFactor: () => scale,
      setSliderZoom,
      forceRelocationEvent,
    };

    const zoomParagraph = getOrCreateElement("zoomSliderParagraph");
    const zoomSliderElement = getOrCreateElement("zoomSliderElement", "", "input");
    zoomSliderElement.setAttribute("aria-label", "Zoom level");
    zoomSliderElement.setAttribute("aria-orientation", "vertical");
    zoomSliderElement.setAttribute("title", "Zoom level");
    if (!zoomParagraph.children.includes(zoomSliderElement)) {
      zoomParagraph.appendChild(zoomSliderElement);
    }

    const zoomSlider = zoomSliderFactory(graph);
    zoomSlider.setup();

    return {
      forceRelocationEvent,
      getScale: () => scale,
      hideAllMenus,
      setSliderZoom,
      zoomSlider,
      zoomSliderElement,
      zoomInButton: getOrCreateElement("zoomInButton", "", "button"),
      zoomOutButton: getOrCreateElement("zoomOutButton", "", "button"),
    };
  }

  beforeEach(() => {
    elementMap = {};
    frameCallbacks = new Map();
    currentTime = 0;
    nextFrameId = 1;

    const mockDocument = new MockEventTarget();
    global.document = mockDocument;
    Object.assign(mockDocument, {
      body: new MockElement("body"),
      documentElement: { namespaceURI: HTML_NAMESPACE },
      defaultView: null,
      hidden: false,
      getElementById: (id) => getOrCreateElement(id),
      querySelector: (selector) => getOrCreateElement(selector),
      querySelectorAll: () => [],
      createElement: (tag) => new MockElement("", "", tag),
      createElementNS: (namespace, tag) => new MockElement("", "", tag),
    });

    global.window = new MockEventTarget();
    global.window.document = global.document;
    global.document.defaultView = global.window;
    global.CustomEvent = MockEvent;
    global.d3 = d3;
    global.performance = { now: () => currentTime };
    global.requestAnimationFrame = jest.fn((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(frameId, callback);
      return frameId;
    });
    global.cancelAnimationFrame = jest.fn((frameId) => {
      frameCallbacks.delete(frameId);
    });
  });

  afterEach(() => {
    originalGlobals.forEach((descriptor, name) => restoreGlobal(name));
  });

  test.each(["mouse", "touch", "pen"])("supports %s press-and-hold", (pointerType) => {
    const { setSliderZoom, zoomInButton } = mountZoomSlider();
    const pointerDown = pointerEvent("pointerdown", { pointerId: 7, pointerType });

    zoomInButton.dispatchEvent(pointerDown);

    expect(zoomInButton.capturedPointers.has(7)).toBe(true);
    expect(setSliderZoom).toHaveBeenCalledTimes(1);
    expect(frameCallbacks.size).toBe(1);

    runAnimationFrame(1000 / 60);
    expect(setSliderZoom).toHaveBeenCalledTimes(2);

    window.dispatchEvent(pointerEvent("pointerup", { pointerId: 7, pointerType }));
    expect(frameCallbacks.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  test("a quick pointer activation applies one step without a duplicate click step", () => {
    const { getScale, setSliderZoom, zoomInButton } = mountZoomSlider();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown"));
    zoomInButton.dispatchEvent(pointerEvent("pointerup"));
    zoomInButton.dispatchEvent(new MockEvent("click", { detail: 1 }));

    expect(setSliderZoom).toHaveBeenCalledTimes(1);
    expect(getScale()).toBeCloseTo(1.02);
  });

  test.each([
    ["pointerup", "window"],
    ["pointercancel", "button"],
    ["lostpointercapture", "button"],
  ])("%s on the %s stops an active pointer hold", (eventType, targetName) => {
    const { zoomOutButton } = mountZoomSlider();
    zoomOutButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 9, pointerType: "pen" }));

    const target = targetName === "window" ? window : zoomOutButton;
    target.dispatchEvent(pointerEvent(eventType, { pointerId: 9, pointerType: "pen" }));

    expect(frameCallbacks.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  test("ignores secondary buttons, non-primary pointers, and competing starts", () => {
    const { setSliderZoom, zoomInButton, zoomOutButton } = mountZoomSlider();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { button: 2 }));
    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { isPrimary: false }));
    expect(setSliderZoom).not.toHaveBeenCalled();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1 }));
    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1 }));
    zoomOutButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 2, pointerType: "touch" }));
    zoomOutButton.dispatchEvent(new MockEvent("click", { detail: 0 }));

    expect(setSliderZoom).toHaveBeenCalledTimes(1);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    window.dispatchEvent(pointerEvent("pointerup", { pointerId: 2, pointerType: "touch" }));
    expect(frameCallbacks.size).toBe(1);
    window.dispatchEvent(pointerEvent("pointerup", { pointerId: 1 }));
    expect(frameCallbacks.size).toBe(0);
  });

  test.each(["Enter", " "])("uses native button activation for %p", (key) => {
    const { setSliderZoom, zoomOutButton } = mountZoomSlider();
    const keyDown = keyEvent("keydown", key);

    zoomOutButton.dispatchEvent(keyDown);
    zoomOutButton.dispatchEvent(keyEvent("keyup", key));
    expect(keyDown.defaultPrevented).toBe(false);
    expect(setSliderZoom).not.toHaveBeenCalled();

    zoomOutButton.dispatchEvent(new MockEvent("click", { detail: 0 }));

    expect(setSliderZoom).toHaveBeenCalledTimes(1);
    expect(frameCallbacks.size).toBe(0);
  });

  test("a zero-detail click provides a single assistive-technology activation", () => {
    const { getScale, setSliderZoom, zoomOutButton } = mountZoomSlider();

    zoomOutButton.dispatchEvent(new MockEvent("click", { detail: 0 }));

    expect(setSliderZoom).toHaveBeenCalledTimes(1);
    expect(getScale()).toBeCloseTo(0.98);
    expect(frameCallbacks.size).toBe(0);
  });

  test("exposes the vertical zoom range with an accessible name and value", () => {
    const { zoomSlider, zoomSliderElement } = mountZoomSlider();

    expect(zoomSliderElement.getAttribute("aria-label")).toBe("Zoom level");
    expect(zoomSliderElement.getAttribute("aria-orientation")).toBe("vertical");
    expect(zoomSliderElement.getAttribute("aria-valuetext")).toBe("60%");

    zoomSlider.updateZoomSliderValue(1.25);
    expect(zoomSliderElement.getAttribute("aria-valuetext")).toBe("125%");
  });

  test("disables every zoom control until graph interactions are enabled", () => {
    const { zoomSlider, zoomSliderElement, zoomInButton, zoomOutButton } = mountZoomSlider();
    const centerButton = document.getElementById("centerGraphButton");

    zoomSlider.setMenuMode(false);

    expect(zoomSliderElement.disabled).toBe(true);
    expect(centerButton.disabled).toBe(true);
    expect(zoomInButton.disabled).toBe(true);
    expect(zoomOutButton.disabled).toBe(true);

    zoomSlider.setMenuMode(true);

    expect(zoomSliderElement.disabled).toBe(false);
    expect(centerButton.disabled).toBe(false);
    expect(zoomInButton.disabled).toBe(false);
    expect(zoomOutButton.disabled).toBe(false);
  });

  test.each(["blur", "visibilitychange"])("%s stops the active interaction", (eventType) => {
    const { zoomInButton } = mountZoomSlider();
    zoomInButton.dispatchEvent(pointerEvent("pointerdown"));

    if ( eventType === "visibilitychange" ) {
      document.hidden = true;
      document.dispatchEvent(new MockEvent(eventType));
    } else {
      window.dispatchEvent(new MockEvent(eventType));
    }

    expect(frameCallbacks.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  test.each([60, 120])("uses elapsed time for consistent zooming at %i Hz", (refreshRate) => {
    const { getScale, zoomInButton } = mountZoomSlider();
    zoomInButton.dispatchEvent(pointerEvent("pointerdown"));

    for ( let frame = 1; frame <= refreshRate; frame += 1 ) {
      runAnimationFrame(frame * 1000 / refreshRate);
    }

    expect(getScale()).toBeCloseTo(Math.pow(1.02, 61), 10);
    window.dispatchEvent(pointerEvent("pointerup"));
  });

  test.each([
    ["zoom in", "zoomInButton", 3.99, 4],
    ["zoom out", "zoomOutButton", 0.101, 0.1],
  ])("stops scheduling at the %s boundary", (label, buttonName, scale, expected) => {
    const mounted = mountZoomSlider({ scale });
    mounted[buttonName].dispatchEvent(pointerEvent("pointerdown"));

    expect(mounted.getScale()).toBe(expected);
    expect(frameCallbacks.size).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  test.each([
    ["zoom in", "zoomInButton", 4],
    ["zoom out", "zoomOutButton", 0.1],
  ])("exposes %s as unavailable at its boundary", (label, buttonName, scale) => {
    const mounted = mountZoomSlider({ scale });
    const button = mounted[buttonName];

    expect(button.disabled).toBe(true);
    button.dispatchEvent(new MockEvent("click", { detail: 0 }));
    expect(mounted.setSliderZoom).not.toHaveBeenCalled();
  });

  test("retains context-menu prevention and center-graph behavior", () => {
    const { forceRelocationEvent, zoomInButton, zoomOutButton } = mountZoomSlider();
    const zoomInContext = new MockEvent("contextmenu");
    const zoomOutContext = new MockEvent("contextmenu");

    zoomInButton.dispatchEvent(zoomInContext);
    zoomOutButton.dispatchEvent(zoomOutContext);
    document.getElementById("centerGraphButton").dispatchEvent(new MockEvent("click", { detail: 1 }));

    expect(zoomInContext.defaultPrevented).toBe(true);
    expect(zoomOutContext.defaultPrevented).toBe(true);
    expect(forceRelocationEvent).toHaveBeenCalledTimes(1);
  });
});
