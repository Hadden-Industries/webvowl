const { describe, test, expect, beforeEach } = require("@jest/globals");
const d3 = require("d3");
const zoomSliderFactory = require("./zoomSlider");

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "div") {
    this.id = id || "";
    this.className = className || "";
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    this.style = {};
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this.scrollLeft = 0;
    this.namespaceURI = HTML_NAMESPACE;
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) { this.listeners[type] = []; }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== fn);
    }
  }

  dispatchEvent(evt) {
    evt.target = this;
    const handlers = (this.listeners[evt.type] || []).slice();
    for (const h of handlers) {
      h.call(this, evt, this.__data__);
    }
    return !evt.defaultPrevented;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
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

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 };
  }
}

class MockCustomEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.cancelable = opts.cancelable !== undefined ? opts.cancelable : true;
    this.bubbles = opts.bubbles || false;
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

describe("zoomSlider real DOM element event listeners", () => {
  let elementMap;

  const getOrCreateElement = (idKey) => {
    const cleanId = idKey.startsWith("#") ? idKey.slice(1) : idKey;
    if (!elementMap[cleanId]) {
      elementMap[cleanId] = new MockElement(cleanId);
    }
    return elementMap[cleanId];
  };

  beforeEach(() => {
    elementMap = {};

    global.CustomEvent = MockCustomEvent;
    global.document = {
      body: new MockElement("body"),
      documentElement: { namespaceURI: HTML_NAMESPACE },
      defaultView: null,
      getElementById: (id) => getOrCreateElement(id),
      querySelector: (selector) => getOrCreateElement(selector),
      querySelectorAll: () => [],
      createElement: (tag) => new MockElement("", "", tag),
      createElementNS: (ns, tag) => new MockElement("", "", tag),
    };

    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      document: global.document,
    };
    global.document.defaultView = global.window;

    global.d3 = d3;
    global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  test("dispatches touchstart and contextmenu on #zoomInButton and #zoomOutButton to verify preventDefault is executed", () => {
    const forceRelocationEventMock = jest.fn();
    const mockGraph = {
      options: () => ({
        minMagnification: () => 0.1,
        maxMagnification: () => 4.0,
        width: () => 800,
        height: () => 600,
        navigationMenu: () => ({ hideAllMenus: () => {} }),
      }),
      scaleFactor: () => 1.0,
      setSliderZoom: () => {},
      forceRelocationEvent: forceRelocationEventMock,
    };

    const zoomSlider = zoomSliderFactory(mockGraph);
    zoomSlider.setup();

    const zoomInBtn = document.getElementById("zoomInButton");
    const zoomOutBtn = document.getElementById("zoomOutButton");
    const centerBtn = document.getElementById("centerGraphButton");

    // Test #zoomInButton touchstart
    const touchEventIn = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    zoomInBtn.dispatchEvent(touchEventIn);
    expect(touchEventIn.defaultPrevented).toBe(true);

    // Test #zoomInButton contextmenu
    const contextEventIn = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    zoomInBtn.dispatchEvent(contextEventIn);
    expect(contextEventIn.defaultPrevented).toBe(true);

    // Test #zoomOutButton touchstart
    const touchEventOut = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    zoomOutBtn.dispatchEvent(touchEventOut);
    expect(touchEventOut.defaultPrevented).toBe(true);

    // Test #zoomOutButton contextmenu
    const contextEventOut = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    zoomOutBtn.dispatchEvent(contextEventOut);
    expect(contextEventOut.defaultPrevented).toBe(true);

    // Test #centerGraphButton click triggers relocation
    const clickEventCenter = new CustomEvent("click", { cancelable: true, bubbles: true });
    centerBtn.dispatchEvent(clickEventCenter);
    expect(forceRelocationEventMock).toHaveBeenCalledTimes(1);
  });
});
