const { describe, test, expect, beforeEach } = require("@jest/globals");
const d3 = require("d3");
const navigationMenuFactory = require("./navigationMenu");

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

describe("navigationMenu and adjacent button event listeners", () => {
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
      querySelectorAll: (selector) => {
        if (selector === ".navButton") {
          return [
            getOrCreateElement("locateSearchResult"),
            getOrCreateElement("reset-button"),
          ];
        }
        return [];
      },
      createElement: (tag) => new MockElement("", "", tag),
      createElementNS: (ns, tag) => new MockElement("", "", tag),
    };

    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      document: global.document,
    };
    global.document.defaultView = global.window;

    const scrollContainer = getOrCreateElement("scrollContainer");
    scrollContainer.children = [
      getOrCreateElement("c_menu1"),
      getOrCreateElement("c_menu2"),
    ];

    global.d3 = d3;
    global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  });

  test("suppresses contextmenu on scroll buttons and navButtons", () => {
    const mockGraph = {
      options: () => ({
        navigationMenu: () => ({ hideAllMenus: () => {} }),
      }),
      scaleFactor: () => 1.0,
    };

    const navMenu = navigationMenuFactory(mockGraph);
    navMenu.setup();

    const scrollRightBtn = document.getElementById("scrollRightButton");
    const scrollLeftBtn = document.getElementById("scrollLeftButton");
    const navBtn = document.getElementById("locateSearchResult");

    const touchEventRight = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    scrollRightBtn.dispatchEvent(touchEventRight);
    expect(touchEventRight.defaultPrevented).toBe(true);

    const contextEventRight = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    scrollRightBtn.dispatchEvent(contextEventRight);
    expect(contextEventRight.defaultPrevented).toBe(true);

    const touchEventLeft = new CustomEvent("touchstart", { cancelable: true, bubbles: true });
    scrollLeftBtn.dispatchEvent(touchEventLeft);
    expect(touchEventLeft.defaultPrevented).toBe(true);

    const contextEventLeft = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    scrollLeftBtn.dispatchEvent(contextEventLeft);
    expect(contextEventLeft.defaultPrevented).toBe(true);

    const contextEventNav = new CustomEvent("contextmenu", { cancelable: true, bubbles: true });
    navBtn.dispatchEvent(contextEventNav);
    expect(contextEventNav.defaultPrevented).toBe(true);
  });
});
