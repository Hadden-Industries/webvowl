import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import * as d3 from "d3";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let zoomSliderFactory;
let registerApplicationUiModule;

beforeAll(async () => {
  // The registry is loaded first so the slider links the same instance rather
  // than a second copy the test could not reach.
  ({ registerApplicationUiModule } = await loadEsmModuleForTest(
    new URL("../ui/applicationUiRegistry.js", import.meta.url),
    import.meta.url,
  ));
  ({ createZoomSlider: zoomSliderFactory } = await loadEsmModuleForTest(
    new URL("./zoomSlider.js", import.meta.url),
    import.meta.url,
  ));
});

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const originalGlobals = new Map(
  [
    "CustomEvent",
    "document",
    "window",
    "d3",
    "performance",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ].map((name) => [name, Object.getOwnPropertyDescriptor(global, name)]),
);

class MockEventTarget {
  constructor() {
    this.listeners = {};
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(
        (listener) => listener !== fn,
      );
    }
  }

  dispatchEvent(event) {
    event.target = this;
    const handlers = (this.listeners[event.type] || []).slice();
    handlers.forEach((handler) => handler.call(this, event, this.__data__));
    return !event.defaultPrevented;
  }
}

class MockElement extends MockEventTarget {
  constructor(id, className, tagName = "div") {
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

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name] || "";
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  setPointerCapture(pointerId) {
    this.capturedPointers.add(pointerId);
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
    };
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.cancelable =
      options.cancelable !== undefined ? options.cancelable : true;
    this.bubbles = options.bubbles || false;
    this.defaultPrevented = false;
    Object.assign(this, options);
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

describe("zoomSlider input handling", () => {
  let elementMap;
  let frameCallbacks;
  let currentTime;
  let nextFrameId;

  function restoreGlobal(name) {
    const descriptor = originalGlobals.get(name);
    if (descriptor) {
      Object.defineProperty(global, name, descriptor);
    } else {
      delete global[name];
    }
  }

  function getOrCreateElement(idKey) {
    const cleanId = idKey.startsWith("#") ? idKey.slice(1) : idKey;
    if (!elementMap[cleanId]) {
      elementMap[cleanId] = new MockElement(cleanId);
    }
    return elementMap[cleanId];
  }

  function pointerEvent(type, options = {}) {
    return new MockEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      isPrimary: true,
      detail: 0,
      ...options,
    });
  }

  function keyEvent(type, key, options = {}) {
    return new MockEvent(type, { key, repeat: false, detail: 0, ...options });
  }

  function mountZoomSlider(options = {}) {
    const minimumMagnification = options.minMagnification || 0.1;
    const maximumMagnification = options.maxMagnification || 4;
    const hideAllMenus = jest.fn();
    registerApplicationUiModule("navigationMenu", { hideAllMenus });

    // The control reports intent; the controller publishes the magnification
    // the renderer actually reached, which the control then presents.
    const setVisualizationView = jest.fn();
    const setContinuousZoom = jest.fn();
    const webVowlController = { setVisualizationView, setContinuousZoom };

    const zoomParagraph = getOrCreateElement("zoomSliderParagraph");
    const zoomSliderElement = getOrCreateElement(
      "zoomSliderElement",
      "",
      "input",
    );
    zoomSliderElement.setAttribute("aria-label", "Zoom level");
    zoomSliderElement.setAttribute("aria-orientation", "vertical");
    zoomSliderElement.setAttribute("title", "Zoom level");
    if (!zoomParagraph.children.includes(zoomSliderElement)) {
      zoomParagraph.appendChild(zoomSliderElement);
    }

    const zoomSlider = zoomSliderFactory({
      webVowlController,
      minimumMagnification,
      maximumMagnification,
      graphWidthPx: 800,
      graphHeightPx: 600,
      documentObject: global.document,
      windowObject: global.window,
    });
    zoomSlider.setup();
    if (options.scale !== undefined) {
      zoomSlider.renderViewport(options.scale);
    }

    return {
      hideAllMenus,
      setContinuousZoom,
      setVisualizationView,
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

  test.each(["mouse", "touch", "pen"])(
    "reports a held %s gesture rather than a magnification per frame",
    (pointerType) => {
      const { setContinuousZoom, setVisualizationView, zoomInButton } =
        mountZoomSlider();
      const pointerDown = pointerEvent("pointerdown", {
        pointerId: 7,
        pointerType,
      });

      zoomInButton.dispatchEvent(pointerDown);

      expect(zoomInButton.capturedPointers.has(7)).toBe(true);
      expect(setContinuousZoom).toHaveBeenCalledTimes(1);
      expect(setContinuousZoom).toHaveBeenCalledWith({ zoomDirection: "in" });
      // The renderer runs the ramp, so no magnification crosses the seam while
      // the button is held.
      expect(setVisualizationView).not.toHaveBeenCalled();

      window.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 7, pointerType }),
      );

      expect(setContinuousZoom).toHaveBeenCalledTimes(2);
      expect(setContinuousZoom).toHaveBeenLastCalledWith({
        zoomDirection: "none",
      });
    },
  );

  test("a quick pointer activation reports one gesture without a duplicate click step", () => {
    const { setContinuousZoom, setVisualizationView, zoomInButton } =
      mountZoomSlider();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown"));
    zoomInButton.dispatchEvent(pointerEvent("pointerup"));
    zoomInButton.dispatchEvent(new MockEvent("click", { detail: 1 }));

    expect(setContinuousZoom.mock.calls.map(([request]) => request)).toEqual([
      { zoomDirection: "in" },
      { zoomDirection: "none" },
    ]);
    expect(setVisualizationView).not.toHaveBeenCalled();
  });

  test.each([
    ["pointerup", "window"],
    ["pointercancel", "button"],
    ["lostpointercapture", "button"],
  ])("%s on the %s ends an active pointer hold", (eventType, targetName) => {
    const { setContinuousZoom, zoomOutButton } = mountZoomSlider();
    zoomOutButton.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 9, pointerType: "pen" }),
    );

    const target = targetName === "window" ? window : zoomOutButton;
    target.dispatchEvent(
      pointerEvent(eventType, { pointerId: 9, pointerType: "pen" }),
    );

    expect(setContinuousZoom).toHaveBeenLastCalledWith({
      zoomDirection: "none",
    });
  });

  test("ignores secondary buttons, non-primary pointers, and competing starts", () => {
    const { setContinuousZoom, zoomInButton, zoomOutButton } =
      mountZoomSlider();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { button: 2 }));
    zoomInButton.dispatchEvent(
      pointerEvent("pointerdown", { isPrimary: false }),
    );
    expect(setContinuousZoom).not.toHaveBeenCalled();

    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1 }));
    zoomInButton.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1 }));
    zoomOutButton.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, pointerType: "touch" }),
    );

    // One hold is active, so a competing start reports nothing.
    expect(setContinuousZoom).toHaveBeenCalledTimes(1);
  });

  test.each(["Enter", " "])("uses native button activation for %p", (key) => {
    const { setContinuousZoom, setVisualizationView, zoomOutButton } =
      mountZoomSlider();
    const keyDown = keyEvent("keydown", key);

    zoomOutButton.dispatchEvent(keyDown);
    zoomOutButton.dispatchEvent(keyEvent("keyup", key));
    expect(keyDown.defaultPrevented).toBe(false);
    expect(setVisualizationView).not.toHaveBeenCalled();

    zoomOutButton.dispatchEvent(new MockEvent("click", { detail: 0 }));

    expect(setVisualizationView).toHaveBeenCalledTimes(1);
    expect(setContinuousZoom).not.toHaveBeenCalled();
  });

  test("a zero-detail click requests a single discrete magnification", () => {
    const { setVisualizationView, zoomOutButton } = mountZoomSlider({
      scale: 1.2,
    });

    zoomOutButton.dispatchEvent(new MockEvent("click", { detail: 0 }));

    expect(setVisualizationView).toHaveBeenCalledTimes(1);
    const [[viewRequest]] = setVisualizationView.mock.calls;
    expect(viewRequest.zoomScale).toBeCloseTo(1);
  });

  test("requests the magnification a slider drag asks for", () => {
    const { setVisualizationView, zoomSlider, zoomSliderElement } =
      mountZoomSlider();
    zoomSliderElement.value = 2.5;

    zoomSlider.zooming();

    expect(setVisualizationView).toHaveBeenCalledWith({ zoomScale: 2.5 });
  });

  test("exposes the vertical zoom range with an accessible name and value", () => {
    const { zoomSlider, zoomSliderElement } = mountZoomSlider();

    expect(zoomSliderElement.getAttribute("aria-label")).toBe("Zoom level");
    expect(zoomSliderElement.getAttribute("aria-orientation")).toBe("vertical");
    expect(zoomSliderElement.getAttribute("aria-valuetext")).toBe("60%");

    zoomSlider.renderViewport(1.25);
    expect(zoomSliderElement.getAttribute("aria-valuetext")).toBe("125%");
  });

  test("presents a magnification the reader reached by another gesture", () => {
    const { setVisualizationView, zoomSlider, zoomSliderElement } =
      mountZoomSlider();

    // A wheel gesture on the visualization reaches the control as a fact.
    zoomSlider.renderViewport(3);

    expect(Number(zoomSliderElement.value)).toBe(3);
    // Presenting a fact must not send it back as a request.
    expect(setVisualizationView).not.toHaveBeenCalled();
  });

  test("disables every zoom control until graph interactions are enabled", () => {
    const { zoomSlider, zoomSliderElement, zoomInButton, zoomOutButton } =
      mountZoomSlider();
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

  test.each(["blur", "visibilitychange"])(
    "%s ends the active interaction",
    (eventType) => {
      const { setContinuousZoom, zoomInButton } = mountZoomSlider();
      zoomInButton.dispatchEvent(pointerEvent("pointerdown"));

      if (eventType === "visibilitychange") {
        document.hidden = true;
        document.dispatchEvent(new MockEvent(eventType));
      } else {
        window.dispatchEvent(new MockEvent(eventType));
      }

      expect(setContinuousZoom).toHaveBeenLastCalledWith({
        zoomDirection: "none",
      });
    },
  );

  test.each([
    ["zoom in", "zoomInButton", 4],
    ["zoom out", "zoomOutButton", 0.1],
  ])(
    "exposes %s as unavailable at its boundary",
    (label, buttonName, scale) => {
      const mounted = mountZoomSlider({ scale });
      const button = mounted[buttonName];

      expect(button.disabled).toBe(true);
      button.dispatchEvent(new MockEvent("click", { detail: 0 }));
      button.dispatchEvent(pointerEvent("pointerdown"));

      expect(mounted.setVisualizationView).not.toHaveBeenCalled();
      expect(mounted.setContinuousZoom).not.toHaveBeenCalled();
    },
  );

  test("prevents zoom context menus and leaves fitting to the controller", () => {
    const { setVisualizationView, zoomInButton, zoomOutButton } =
      mountZoomSlider();
    const zoomInContext = new MockEvent("contextmenu");
    const zoomOutContext = new MockEvent("contextmenu");

    zoomInButton.dispatchEvent(zoomInContext);
    zoomOutButton.dispatchEvent(zoomOutContext);
    document
      .getElementById("centerGraphButton")
      .dispatchEvent(new MockEvent("click", { detail: 1 }));

    expect(zoomInContext.defaultPrevented).toBe(true);
    expect(zoomOutContext.defaultPrevented).toBe(true);
    // Fitting reaches the controller through the view-controls adapter.
    expect(setVisualizationView).not.toHaveBeenCalled();
  });
});
