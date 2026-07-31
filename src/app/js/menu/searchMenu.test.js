import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import * as d3 from "d3";
import searchMenuFactory from "./searchMenu.js";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "div") {
    this.id = id || "";
    this._classList = new Set(className ? className.split(/\s+/).filter(Boolean) : []);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    const self = this;
    this.style = {
      _props: {},
      setProperty: (k, v) => { self.style._props[k] = v; self.style[k] = v; },
      removeProperty: (k) => { delete self.style._props[k]; delete self.style[k]; },
      getPropertyValue: (k) => self.style._props[k] || "",
    };
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this.value = "";
    this.namespaceURI = HTML_NAMESPACE;
  }

  get className() {
    return Array.from(this._classList).join(" ");
  }

  set className(val) {
    this._classList = new Set(val ? val.split(/\s+/).filter(Boolean) : []);
  }

  get classList() {
    const self = this;
    return {
      add: (...names) => { names.forEach((n) => self._classList.add(n)); },
      remove: (...names) => { names.forEach((n) => self._classList.delete(n)); },
      contains: (name) => self._classList.has(name),
    };
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
    if (!evt.target) { evt.target = this; }
    const handlers = (this.listeners[evt.type] || []).slice();
    for (const h of handlers) {
      h.call(this, evt, this.__data__);
    }
    return !evt.defaultPrevented;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
    if (name === "class") { this.className = val; }
  }

  getAttribute(name) {
    if (name === "class") {return this.className;}
    return this.attributes[name] || "";
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  contains(node) {
    if (node === this) {return true;}
    for (const child of this.children) {
      if (child === node || (child.contains && child.contains(node))) {
        return true;
      }
    }
    return false;
  }

  getBoundingClientRect() {
    return { top: 600, left: 100, width: 200, height: 40, bottom: 640, right: 300 };
  }
}

class MockCustomEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.bubbles = opts.bubbles || false;
    this.target = opts.target || null;
  }
}

describe("searchMenu mobile positioning and light dismiss", () => {
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
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      innerWidth: 480,
      visualViewport: { offsetTop: 10, addEventListener: () => {} },
      document: global.document,
    };
    global.document.defaultView = global.window;
    global.d3 = d3;
  });

  test("shows search listbox by toggling hidden class without inline style mutation", () => {
    const mockGraph = {
      getUpdateDictionary: () => [
        { labelForCurrentLanguage: () => "ClassA", id: () => "1" },
      ],
      locateSearchResult: jest.fn(),
      resetSearchHighlight: jest.fn(),
    };

    const searchMenu = searchMenuFactory(mockGraph);
    searchMenu.setup();

    const listbox = getOrCreateElement("search-results-listbox");
    listbox._classList.add("hidden");
    const option = new MockElement("opt1", "search-option");
    listbox.appendChild(option);

    searchMenu.showSearchEntries();

    expect(listbox.classList.contains("hidden")).toBe(false);
  });
});
