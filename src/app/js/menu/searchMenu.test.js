import { describe, test, expect, beforeEach } from "@jest/globals";
import * as d3 from "d3";
import searchMenuFactory from "./searchMenu.js";

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
    this.value = "";
    this.__data__ = {};
    this.namespaceURI = HTML_NAMESPACE;
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) { this.listeners[type] = []; }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== fn);
    }
  }

  dispatchEvent(event) {
    const type = event.type;
    let prevented = false;
    event.preventDefault = () => { prevented = true; event.defaultPrevented = true; };
    if (this.listeners[type]) {
      this.listeners[type].forEach(fn => fn.call(this, event, this.__data__));
    }
    return !prevented;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  focus() {}

  contains(other) {
    return this === other || this.children.includes(other);
  }

  get classList() {
    const self = this;
    return {
      add(cls) {
        const set = new Set((self.className || "").split(/\s+/).filter(Boolean));
        set.add(cls);
        self.className = Array.from(set).join(" ");
      },
      remove(cls) {
        const set = new Set((self.className || "").split(/\s+/).filter(Boolean));
        set.delete(cls);
        self.className = Array.from(set).join(" ");
      },
      contains(cls) {
        return (self.className || "").split(/\s+/).includes(cls);
      }
    };
  }

  click() {
    this.dispatchEvent({ type: "click", target: this, stopPropagation: () => {} });
  }

  appendChild(child) {
    if (child) {
      this.children.push(child);
      child.parentNode = this;
    }
    return child;
  }

  remove() {
    if (this.parentNode && this.parentNode.children) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1);
      }
    }
  }

  createElementNS(ns, tagName) {
    return new MockElement("", "", tagName);
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
    if (selector.startsWith("#")) {
      const el = this.querySelector(selector);
      return el ? [el] : [];
    }
    return [];
  }

  createElementNS(ns, tagName) {
    return new MockElement("", "", tagName);
  }

  createElement(tagName) {
    return new MockElement("", "", tagName);
  }

  getElementById(id) {
    return this.elements[id] || null;
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) { this.listeners[type] = []; }
    this.listeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== fn);
    }
  }

  dispatchEvent(event) {
    const type = event.type;
    let prevented = false;
    event.preventDefault = () => { prevented = true; event.defaultPrevented = true; };
    if (this.listeners[type]) {
      this.listeners[type].forEach(fn => fn(event));
    }
    return !prevented;
  }
}

describe("searchMenu responsive controls, clear button, and mobile overlay state", () => {
  let mockDoc;
  let mockGraph;
  let cSearch;
  let mobileToggleBtn;
  let searchInput;
  let clearBtn;
  let listbox;

  beforeEach(() => {
    mockDoc = new MockDocument();
    global.document = mockDoc;
    global.window = {
      document: mockDoc,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    cSearch = new MockElement("c_search", "inner-addon left-addon", "li");
    mobileToggleBtn = new MockElement("mobile-search-toggle-btn", "navButton mobileSearchToggleBtn", "button");
    searchInput = new MockElement("search-input-text", "searchInputText", "input");
    clearBtn = new MockElement("search-clear-btn", "searchClearBtn hidden", "button");
    listbox = new MockElement("search-results-listbox", "search-combobox-popup hidden", "ul");
    const locateBtn = new MockElement("locateSearchResult", "navButton", "button");

    cSearch.children.push(mobileToggleBtn, searchInput, clearBtn, listbox);

    mockDoc.elements["c_search"] = cSearch;
    mockDoc.elements["mobile-search-toggle-btn"] = mobileToggleBtn;
    mockDoc.elements["search-input-text"] = searchInput;
    mockDoc.elements["search-clear-btn"] = clearBtn;
    mockDoc.elements["search-results-listbox"] = listbox;
    mockDoc.elements["locateSearchResult"] = locateBtn;

    global.d3 = d3;
    mockGraph = {
      getUpdateDictionary: () => [
        {
          labelForCurrentLanguage: () => "Person",
          id: () => "1",
          equivalents: () => [],
          equivalentsString: () => ""
        }
      ],
      locateSearchResult: () => {},
      resetSearchHighlight: () => {},
      highLightNodes: () => {},
      getNodeMapForSearch: () => ({ "1": {} })
    };
  });

  test("expands mobile search overlay when mobile toggle button is clicked", () => {
    const searchMenu = searchMenuFactory(mockGraph);
    searchMenu.setup();

    expect(cSearch.classList.contains("search-expanded")).toBe(false);

    mobileToggleBtn.click();

    expect(cSearch.classList.contains("search-expanded")).toBe(true);
  });

  test("shows clear button on user input and clears text when clear button is clicked", () => {
    const searchMenu = searchMenuFactory(mockGraph);
    searchMenu.setup();

    expect(clearBtn.classList.contains("hidden")).toBe(true);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    expect(clearBtn.classList.contains("hidden")).toBe(false);

    clearBtn.click();

    expect(searchInput.value).toBe("");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
  });

  test("collapses mobile overlay and hides listbox on Escape key press", () => {
    const searchMenu = searchMenuFactory(mockGraph);
    searchMenu.setup();

    cSearch.classList.add("search-expanded");

    searchInput.dispatchEvent({ type: "keydown", keyCode: 27, target: searchInput });

    expect(cSearch.classList.contains("search-expanded")).toBe(false);
  });

  test("synchronizes locate button title, aria-label, and disabled state on search result selection and clearing", () => {
    let locateCount = 0;
    mockGraph.locateSearchResult = () => { locateCount++; };

    const searchMenu = searchMenuFactory(mockGraph);
    searchMenu.setup();

    const locateBtn = mockDoc.elements["locateSearchResult"];

    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");
    expect(locateBtn.classList.contains("highlighted")).toBe(false);

    locateBtn.click();
    expect(locateCount).toBe(0);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");

    // Simulate search option selection
    const mockOption = new MockElement("", "search-option", "li");
    mockOption.setAttribute("elementID", "0");
    listbox.appendChild(mockOption);

    listbox.dispatchEvent({ type: "click", target: mockOption, stopPropagation: () => {} });

    expect(locateBtn.disabled).toBe(false);
    expect(locateBtn.title).toBe("Locate search term");
    expect(locateBtn.getAttribute("aria-label")).toBe("Locate search term");
    expect(locateBtn.classList.contains("highlighted")).toBe(true);

    locateBtn.click();
    expect(locateCount).toBe(1);

    // Clear search
    searchMenu.clearText();
    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");
    expect(locateBtn.classList.contains("highlighted")).toBe(false);
  });
});
