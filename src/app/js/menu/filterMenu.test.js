import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import * as d3 from "d3";
import filterMenuFactory from "./filterMenu.js";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "div") {
    this.id = id || "";
    this._classList = new Set(
      className ? className.split(/\s+/).filter(Boolean) : [],
    );
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    const self = this;
    this.style = {
      _props: {},
      setProperty: (k, v) => {
        self.style._props[k] = v;
        self.style[k] = v;
      },
      removeProperty: (k) => {
        delete self.style._props[k];
        delete self.style[k];
      },
      getPropertyValue: (k) => self.style._props[k] || "",
    };
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this._value = "0";
    this.namespaceURI = HTML_NAMESPACE;
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = String(v);
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
      add: (...names) => {
        names.forEach((n) => self._classList.add(n));
      },
      remove: (...names) => {
        names.forEach((n) => self._classList.delete(n));
      },
      contains: (name) => self._classList.has(name),
    };
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== fn);
    }
  }

  dispatchEvent(evt) {
    if (!evt.target) {
      evt.target = this;
    }
    const handlers = (this.listeners[evt.type] || []).slice();
    for (const h of handlers) {
      h.call(this, evt, this.__data__);
    }
    return !evt.defaultPrevented;
  }

  setAttribute(name, val) {
    this.attributes[name] = val;
    if (name === "class") {
      this.className = val;
    }
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className;
    }
    return this.attributes[name] || "";
  }

  querySelector(selector) {
    return this.ownerDocument.querySelector(selector);
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
}

class MockCustomEvent {
  constructor(type, opts = {}) {
    this.type = type;
    this.bubbles = opts.bubbles || false;
    this.target = opts.target || null;
  }
}

describe("filterMenu degree slider highlight clearing", () => {
  let elementMap;

  const getOrCreateElement = (idKey, className, tagName) => {
    const cleanId = idKey.startsWith("#") ? idKey.slice(1) : idKey;
    if (!elementMap[cleanId]) {
      elementMap[cleanId] = new MockElement(cleanId, className, tagName);
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
      createElement: (tag) => {
        const el = new MockElement("", "", tag);
        const origSetAttr = el.setAttribute.bind(el);
        el.setAttribute = function (name, val) {
          origSetAttr(name, val);
          if (name === "id" && val) {
            elementMap[val] = this;
          }
        };
        return el;
      },
      createElementNS: (ns, tag) => new MockElement("", "", tag),
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    global.window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      document: global.document,
    };
    global.document.defaultView = global.window;
    global.d3 = d3;
  });

  test("clears highlighted class when nodeDegreeDistanceSlider reaches 0", () => {
    const mockGraph = {
      update: jest.fn(),
      options: () => ({
        searchMenu: () => ({ hideSearchEntries: jest.fn() }),
      }),
    };

    const filterMenu = filterMenuFactory(mockGraph);

    const mockFilter = { enabled: () => false };
    const mockNodeDegreeFilter = {
      setMaxDegreeSetter: jest.fn(),
      setDegreeGetter: jest.fn(),
      setDegreeSetter: jest.fn(),
    };

    const setupFilterItem = (id, identifier) => {
      const container = getOrCreateElement(id, "toggleOption", "li");
      const wrapper = getOrCreateElement(
        id + "_wrapper",
        "checkboxContainer",
        "div",
      );
      const input = getOrCreateElement(
        identifier + "FilterCheckbox",
        "filterCheckbox",
        "input",
      );
      const label = getOrCreateElement(
        identifier + "FilterCheckbox_label",
        "",
        "label",
      );
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    };

    setupFilterItem("datatypeFilteringOption", "datatype");
    setupFilterItem("objectPropertyFilteringOption", "objectProperty");
    setupFilterItem("subclassFilteringOption", "subclass");
    setupFilterItem("disjointFilteringOption", "disjoint");
    setupFilterItem("setOperatorFilteringOption", "setOperator");

    const nodeDegreeContainer = getOrCreateElement(
      "nodeDegreeFilteringOption",
      "",
      "li",
    );
    nodeDegreeContainer.appendChild(
      getOrCreateElement("nodeDegreeDistanceSlider", "", "input"),
    );
    nodeDegreeContainer.appendChild(
      getOrCreateElement("nodeDegreeSliderValue", "", "span"),
    );
    nodeDegreeContainer.appendChild(
      getOrCreateElement(
        "degree-of-collapsing-hint",
        "degree-of-collapsing-hint hidden",
        "span",
      ),
    );
    getOrCreateElement("c_filter", "", "div").appendChild(
      getOrCreateElement("filterBtn", "", "button"),
    );

    filterMenu.setup(
      mockFilter,
      mockFilter,
      mockFilter,
      mockFilter,
      mockFilter,
      mockNodeDegreeFilter,
    );

    // Simulate loader auto-collapse highlighting
    filterMenu.highlightForDegreeSlider(true);
    expect(nodeDegreeContainer.classList.contains("highlighted")).toBe(true);

    const sliderNode = getOrCreateElement("nodeDegreeDistanceSlider");
    sliderNode.value = "0";

    // Dispatch input event (touch drag to 0)
    const inputEvent = new CustomEvent("input", { bubbles: true });
    sliderNode.dispatchEvent(inputEvent);

    expect(nodeDegreeContainer.classList.contains("highlighted")).toBe(false);
  });

  test("toggles degree-of-collapsing-hint hidden class when slider reaches 0", () => {
    const mockGraph = {
      update: jest.fn(),
      options: () => ({
        searchMenu: () => ({ hideSearchEntries: jest.fn() }),
      }),
    };

    const filterMenu = filterMenuFactory(mockGraph);
    const mockFilter = { enabled: () => false };
    const mockNodeDegreeFilter = {
      setMaxDegreeSetter: jest.fn(),
      setDegreeGetter: jest.fn(),
      setDegreeSetter: jest.fn(),
    };

    const hintNode = getOrCreateElement(
      "degree-of-collapsing-hint",
      "degree-of-collapsing-hint hidden",
      "span",
    );
    const sliderNode = getOrCreateElement(
      "nodeDegreeDistanceSlider",
      "",
      "input",
    );
    const nodeDegreeContainer = getOrCreateElement(
      "nodeDegreeFilteringOption",
      "",
      "li",
    );
    nodeDegreeContainer.appendChild(sliderNode);
    nodeDegreeContainer.appendChild(
      getOrCreateElement("nodeDegreeSliderValue", "", "span"),
    );
    nodeDegreeContainer.appendChild(hintNode);
    getOrCreateElement("c_filter", "", "div").appendChild(
      getOrCreateElement("filterBtn", "", "button"),
    );

    filterMenu.setup(
      mockFilter,
      mockFilter,
      mockFilter,
      mockFilter,
      mockFilter,
      mockNodeDegreeFilter,
    );

    // Simulate loader auto-collapse highlighting
    filterMenu.highlightForDegreeSlider(true);
    expect(hintNode.classList.contains("hidden")).toBe(false);

    sliderNode.value = "0";

    // Dispatch input event (touch drag to 0)
    const inputEvent = new CustomEvent("input", { bubbles: true });
    sliderNode.dispatchEvent(inputEvent);

    expect(hintNode.classList.contains("hidden")).toBe(true);
  });
});
