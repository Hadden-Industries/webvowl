import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import fs from "node:fs";
import * as d3 from "d3";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let pauseMenuFactory;

beforeAll(async () => {
  ({ createPauseMenu: pauseMenuFactory } = await loadEsmModuleForTest(
    new URL("./pauseMenu.js", import.meta.url),
    import.meta.url,
  ));
});

const pauseMenuSource = fs.readFileSync(
  new URL("./pauseMenu.js", import.meta.url),
  "utf8",
);

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "button") {
    this.id = id || "";
    this._classList = new Set(
      className ? className.split(/\s+/).filter(Boolean) : [],
    );
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    this.style = {};
    this.ownerDocument = global.document;
    this.nodeType = 1;
    this.attributes = {};
    this.children = [];
    this.childNodes = [];
    this.disabled = false;
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

  dispatchEvent(event) {
    const type = event.type;
    let prevented = false;
    event.preventDefault = () => {
      prevented = true;
      event.defaultPrevented = true;
    };
    if (this.listeners[type]) {
      this.listeners[type].forEach((fn) => fn.call(this, event, this.__data__));
    }
    return !prevented;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") {
      this.className = value;
    }
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className;
    }
    return this.attributes[name] || null;
  }

  click() {
    this.dispatchEvent({
      type: "click",
      target: this,
      stopPropagation: () => {},
    });
  }

  appendChild(child) {
    this.children.push(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(newChild, refChild) {
    const idx = refChild ? this.children.indexOf(refChild) : -1;
    if (idx >= 0) {
      this.children.splice(idx, 0, newChild);
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.children.push(newChild);
      this.childNodes.push(newChild);
    }
    newChild.parentNode = this;
    return newChild;
  }

  querySelector(selector) {
    if (selector === "i") {
      return this.children.find((c) => c.tagName === "I") || null;
    }
    if (selector === "svg") {
      return this.children.find((c) => c.tagName === "SVG") || null;
    }
    if (selector.startsWith(".")) {
      const className = selector.substring(1);
      return this.children.find((c) => c.classList.contains(className)) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    const res = this.querySelector(selector);
    return res ? [res] : [];
  }
}

class MockTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
  }
}

class MockDocument {
  constructor() {
    this.listeners = {};
    this.elements = {};
    this.nodeType = 9;
    this.documentElement = new MockElement("html", "", "html");
  }

  querySelector(selector) {
    if (selector.startsWith("#")) {
      const id = selector.substring(1);
      return this.getElementById(id);
    }
    return null;
  }

  querySelectorAll(selector) {
    const el = this.querySelector(selector);
    return el ? [el] : [];
  }

  createElementNS(ns, tagName) {
    return new MockElement("", "", tagName);
  }

  createElement(tagName) {
    return new MockElement("", "", tagName);
  }

  createTextNode(text) {
    return new MockTextNode(text);
  }

  getElementById(id) {
    return this.elements[id] || null;
  }
}

describe("pauseMenu component", () => {
  let mockDoc;
  let pauseBtnElement;
  let pauseSvgElement;
  let pauseLabelElement;

  beforeEach(() => {
    mockDoc = new MockDocument();
    global.document = mockDoc;
    global.window = {
      document: mockDoc,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    pauseBtnElement = new MockElement(
      "pause-button",
      "navButton action-pill",
      "button",
    );
    pauseSvgElement = new MockElement("", "menuElementSvgElement", "svg");
    pauseSvgElement.setAttribute("aria-hidden", "true");
    pauseLabelElement = new MockElement("", "menuElementLabel", "span");
    pauseLabelElement.textContent = "Pause";
    pauseBtnElement.appendChild(pauseSvgElement);
    pauseBtnElement.appendChild(pauseLabelElement);

    mockDoc.elements["pause-button"] = pauseBtnElement;
    global.d3 = d3;
  });

  test("initializes pause button correctly on setup()", () => {
    const pauseMenu = pauseMenuFactory({
      documentObject: global.document,
    });
    pauseMenu.setup();

    expect(pauseBtnElement.classList.contains("paused")).toBe(false);
    expect(pauseBtnElement.getAttribute("aria-pressed")).toBe("false");
    expect(pauseBtnElement.getAttribute("title")).toBe(
      "Pause graph physics simulation",
    );
    expect(pauseBtnElement.children).toEqual([
      pauseSvgElement,
      pauseLabelElement,
    ]);
    expect(pauseLabelElement.textContent).toBe("Pause");
  });

  test("renders the paused state the controller reports", () => {
    const pauseMenu = pauseMenuFactory({
      documentObject: global.document,
    });
    pauseMenu.setup();

    const originalChildren = [...pauseBtnElement.children];

    pauseMenu.renderGraphLayoutPaused(true);

    expect(pauseMenu.isGraphLayoutPaused()).toBe(true);
    expect(pauseBtnElement.classList.contains("paused")).toBe(true);
    expect(pauseBtnElement.classList.contains("highlighted")).toBe(false);
    expect(pauseBtnElement.getAttribute("aria-pressed")).toBe("true");
    expect(pauseBtnElement.getAttribute("title")).toBe(
      "Resume graph physics simulation",
    );
    expect(pauseBtnElement.children).toEqual(originalChildren);
    expect(pauseLabelElement.textContent).toBe("Resume");

    pauseMenu.renderGraphLayoutPaused(false);

    expect(pauseMenu.isGraphLayoutPaused()).toBe(false);
    expect(pauseBtnElement.classList.contains("paused")).toBe(false);
    expect(pauseBtnElement.classList.contains("highlighted")).toBe(false);
    expect(pauseBtnElement.getAttribute("aria-pressed")).toBe("false");
    expect(pauseBtnElement.getAttribute("title")).toBe(
      "Pause graph physics simulation",
    );
    expect(pauseBtnElement.children).toEqual(originalChildren);
    expect(pauseLabelElement.textContent).toBe("Pause");
  });

  test("does not drive the graph itself", () => {
    // The click reaches the controller through the view-controls adapter.
    expect(pauseMenuSource).not.toMatch(/(?<![A-Za-z0-9_$])graph\./u);
    expect(pauseMenuSource).not.toContain("addEventListener");
  });

  test("setMenuMode enables and disables button element", () => {
    const pauseMenu = pauseMenuFactory({
      documentObject: global.document,
    });
    pauseMenu.setup();

    pauseMenu.setMenuMode(false);
    expect(pauseBtnElement.disabled).toBe(true);

    pauseMenu.setMenuMode(true);
    expect(pauseBtnElement.disabled).toBe(false);
  });

  test("updates state without DOM construction or HTML injection", () => {
    expect(pauseMenuSource).not.toMatch(/\.(?:append|insert|html)\s*\(/);
    expect(pauseMenuSource).not.toMatch(
      /(?:innerHTML|createTextNode|createElement)/,
    );
    expect(pauseMenuSource).not.toContain('.classed("highlighted"');
  });
});
