import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let searchMenuFactory;

beforeAll(async () => {
  ({ createSearchMenu: searchMenuFactory } = await loadEsmModuleForTest(
    new URL("./searchMenu.js", import.meta.url),
    import.meta.url,
  ));
});

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

class MockElement {
  constructor(id, className, tagName = "div") {
    this.id = id || "";
    this.className = className || "";
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.listeners = {};
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
      getPropertyValue(name) {
        return this[name] || "";
      },
    };
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
    if (name === "id") {
      this.id = String(value);
    }
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
        const set = new Set(
          (self.className || "").split(/\s+/).filter(Boolean),
        );
        set.add(cls);
        self.className = Array.from(set).join(" ");
      },
      remove(cls) {
        const set = new Set(
          (self.className || "").split(/\s+/).filter(Boolean),
        );
        set.delete(cls);
        self.className = Array.from(set).join(" ");
      },
      contains(cls) {
        return (self.className || "").split(/\s+/).includes(cls);
      },
    };
  }

  click() {
    this.dispatchEvent({
      type: "click",
      target: this,
      stopPropagation: () => {},
    });
  }

  appendChild(child) {
    if (child) {
      if (child.parentNode && child.parentNode.children) {
        const currentIndex = child.parentNode.children.indexOf(child);
        if (currentIndex !== -1) {
          child.parentNode.children.splice(currentIndex, 1);
        }
      }
      this.children.push(child);
      child.parentNode = this;
    }
    return child;
  }

  set textContent(value) {
    this.children = [];
    this.ownText = String(value);
  }

  get textContent() {
    return (
      (this.ownText ?? "") +
      this.children.map((child) => child.textContent).join("")
    );
  }

  set innerHTML(value) {
    this.assignedMarkup = value;
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

  createTextNode(text) {
    return { nodeType: 3, textContent: String(text) };
  }

  getElementById(id) {
    return this.elements[id] || null;
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
      this.listeners[type].forEach((fn) => fn.call(this, event));
    }
    return !prevented;
  }
}

describe("searchMenu responsive controls, clear button, and mobile overlay state", () => {
  let sharedSearchController;
  let sharedViewRequests;
  let mockDoc;
  let cSearch;
  let mobileToggleBtn;
  let searchInput;
  let clearBtn;
  let listbox;
  let overlayLayer;

  beforeEach(() => {
    mockDoc = new MockDocument();
    global.document = mockDoc;
    global.window = {
      document: mockDoc,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    global.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    global.cancelAnimationFrame = () => {};

    cSearch = new MockElement("c_search", "inner-addon left-addon", "li");
    mobileToggleBtn = new MockElement(
      "mobile-search-toggle-btn",
      "navButton mobileSearchToggleBtn",
      "button",
    );
    searchInput = new MockElement(
      "search-input-text",
      "searchInputText",
      "input",
    );
    clearBtn = new MockElement(
      "search-clear-btn",
      "searchClearBtn hidden",
      "button",
    );
    listbox = new MockElement(
      "search-results-listbox",
      "search-combobox-popup hidden",
      "ul",
    );
    overlayLayer = new MockElement(
      "applicationOverlayLayer",
      "application-overlay-layer",
    );
    const locateBtn = new MockElement(
      "locateSearchResult",
      "navButton",
      "button",
    );
    const scrollLeft = new MockElement(
      "scrollLeftButton",
      "navButton hidden",
      "button",
    );
    const scrollRight = new MockElement(
      "scrollRightButton",
      "navButton hidden",
      "button",
    );

    cSearch.appendChild(mobileToggleBtn);
    cSearch.appendChild(searchInput);
    cSearch.appendChild(clearBtn);
    cSearch.appendChild(listbox);

    mockDoc.elements["c_search"] = cSearch;
    mockDoc.elements["mobile-search-toggle-btn"] = mobileToggleBtn;
    mockDoc.elements["search-input-text"] = searchInput;
    mockDoc.elements["search-clear-btn"] = clearBtn;
    mockDoc.elements["search-results-listbox"] = listbox;
    mockDoc.elements["applicationOverlayLayer"] = overlayLayer;
    mockDoc.elements["locateSearchResult"] = locateBtn;
    mockDoc.elements["scrollLeftButton"] = scrollLeft;
    mockDoc.elements["scrollRightButton"] = scrollRight;

    sharedViewRequests = [];
    sharedSearchController = {
      findOntologyElements: ({ query }) => ({
        matches: "Person".toLowerCase().includes(String(query).toLowerCase())
          ? [
              {
                displayLabel: "Person",
                isFocusable: true,
                ontologyElementReference: {
                  kind: "class",
                  iri: "http://xmlns.com/foaf/0.1/Person",
                },
              },
            ]
          : [],
      }),
      setVisualizationView: (request) => {
        sharedViewRequests.push(request);
        return Promise.resolve({});
      },
    };
  });

  test.each(["result", "clear", "query", "locate"])(
    "consumes a cancelled focus request from the native %s control",
    async (action) => {
      const status = new MockElement("visualizationActionStatus");
      status.hidden = true;
      mockDoc.elements.visualizationActionStatus = status;
      sharedSearchController.setVisualizationView = (request) => {
        sharedViewRequests.push(request);
        return Promise.reject(
          Object.assign(new Error("superseded"), { code: "LOAD_ABORTED" }),
        );
      };
      const menu = searchMenuFactory({
        documentObject: mockDoc,
        windowObject: global.window,
        webVowlController: sharedSearchController,
      });
      menu.setup();
      if (action !== "result") {
        menu.renderVisualizationFocus({
          focus: [{ kind: "class", iri: "https://example.test/Person" }],
          focusableElementCount: 1,
        });
      }
      if (action === "result" || action === "query") {
        searchInput.value = "Person";
        searchInput.dispatchEvent({ type: "input", target: searchInput });
        if (action === "result") {
          listbox.children[0].onclick({ stopPropagation() {} });
        }
      } else if (action === "clear") {
        clearBtn.click();
      } else {
        mockDoc.elements.locateSearchResult.click();
      }
      await new Promise((resolve) => setImmediate(resolve));
      expect(sharedViewRequests).toHaveLength(1);
      expect(status.hidden).toBe(true);
    },
  );

  test.each([
    '<img src=x onerror="alert(1)">Person',
    "Person & <script>alert(1)</script>",
    "An ordinary Person label",
  ])(
    "renders the literal ontology label and a native query highlight: %s",
    (label) => {
      sharedSearchController.findOntologyElements = () => ({
        matches: [
          {
            displayLabel: label,
            isFocusable: true,
            ontologyElementReference: {
              kind: "class",
              iri: "https://example.test/Person",
            },
          },
        ],
      });
      const menu = searchMenuFactory({
        documentObject: mockDoc,
        windowObject: global.window,
        webVowlController: sharedSearchController,
      });
      menu.setup();
      searchInput.value = "Person";
      searchInput.dispatchEvent({ type: "input", target: searchInput });
      const option = listbox.children[0];
      expect(option.assignedMarkup).toBeUndefined();
      expect(option.textContent).toBe(label);
      expect(
        option.children[0].children.find((child) => child.tagName === "MARK")
          .textContent,
      ).toBe("Person");
    },
  );

  test.each([
    ["  https://example.test/ontology  ", "https://example.test/ontology"],
    [
      "http://localhost:8000/ontology.owl",
      "http://localhost:8000/ontology.owl",
    ],
    ["http://[::1]:8000/ontology.owl", "http://[::1]:8000/ontology.owl"],
  ])(
    "offers an entered ontology URL to the ontology menu: %s",
    (input, expected) => {
      const offeredIris = [];
      const menu = searchMenuFactory({
        documentObject: mockDoc,
        windowObject: global.window,
        webVowlController: sharedSearchController,
        onOntologyIriEntered: (iri) => offeredIris.push(iri),
      });
      menu.setup();
      searchInput.value = input;
      searchInput.dispatchEvent({
        type: "keydown",
        key: "Enter",
        target: searchInput,
      });
      expect(offeredIris).toEqual([expected]);
      expect(searchInput.value).toBe("");
      expect(sharedViewRequests).toEqual([]);
    },
  );

  test("expands mobile search overlay when mobile toggle button is clicked", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    expect(cSearch.classList.contains("search-expanded")).toBe(false);

    mobileToggleBtn.click();

    expect(cSearch.classList.contains("search-expanded")).toBe(true);
  });

  test("allows a human to locate and clear focus applied by another controller caller", () => {
    const menu = searchMenuFactory({
      documentObject: mockDoc,
      windowObject: global.window,
      webVowlController: sharedSearchController,
    });
    menu.setup();
    menu.renderVisualizationFocus({
      focus: [{ kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" }],
      focusableElementCount: 1,
    });
    expect(searchInput.value).toBe("");
    expect(mockDoc.elements.locateSearchResult.disabled).toBe(false);
    expect(clearBtn.classList.contains("hidden")).toBe(false);
    mockDoc.elements.locateSearchResult.click();
    clearBtn.click();
    expect(sharedViewRequests).toEqual([
      { viewport: "focus-next" },
      { focus: [] },
    ]);
    menu.renderVisualizationFocus({ focus: [], focusableElementCount: 0 });
    expect(mockDoc.elements.locateSearchResult.disabled).toBe(true);
    expect(clearBtn.classList.contains("hidden")).toBe(true);
  });

  test("portals search results outside the clipped toolbar before interaction", () => {
    expect(listbox.parentNode).toBe(cSearch);

    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    expect(listbox.parentNode).toBe(overlayLayer);
    expect(cSearch.children).not.toContain(listbox);
  });

  test("publishes visual viewport metrics for keyboard-safe result positioning", () => {
    const listeners = {};
    global.window.visualViewport = {
      height: 420,
      offsetTop: 12,
      addEventListener: (type, callback) => {
        listeners[type] = callback;
      },
    };

    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    expect(
      mockDoc.documentElement.style.getPropertyValue(
        "--visual-viewport-height",
      ),
    ).toBe("420px");
    expect(
      mockDoc.documentElement.style.getPropertyValue(
        "--visual-viewport-offset-top",
      ),
    ).toBe("12px");

    global.window.visualViewport.height = 360;
    global.window.visualViewport.offsetTop = 20;
    listeners.resize();

    expect(
      mockDoc.documentElement.style.getPropertyValue(
        "--visual-viewport-height",
      ),
    ).toBe("360px");
    expect(
      mockDoc.documentElement.style.getPropertyValue(
        "--visual-viewport-offset-top",
      ),
    ).toBe("20px");
  });

  test("disables search and locate controls when no rendered ontology is available", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    searchMenu.setMenuMode(false);

    expect(mobileToggleBtn.disabled).toBe(true);
    expect(searchInput.disabled).toBe(true);
    expect(clearBtn.disabled).toBe(true);
    expect(mockDoc.elements["locateSearchResult"].disabled).toBe(true);

    searchMenu.setMenuMode(true);

    expect(mobileToggleBtn.disabled).toBe(false);
    expect(searchInput.disabled).toBe(false);
    expect(clearBtn.disabled).toBe(false);
  });

  test("shows clear button on user input and clears text when clear button is clicked", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    expect(clearBtn.classList.contains("hidden")).toBe(true);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    expect(clearBtn.classList.contains("hidden")).toBe(false);
    expect(listbox.parentNode).toBe(overlayLayer);
    expect(listbox.children).toHaveLength(1);
    expect(listbox.classList.contains("hidden")).toBe(false);
    expect(searchInput.getAttribute("aria-expanded")).toBe("true");

    clearBtn.click();

    expect(searchInput.value).toBe("");
    expect(clearBtn.classList.contains("hidden")).toBe(true);
  });

  test("keeps portaled results open for option interaction and dismisses them outside", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();
    mobileToggleBtn.click();
    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    const option = listbox.children[0];
    mockDoc.dispatchEvent({ type: "pointerdown", target: option });
    expect(listbox.classList.contains("hidden")).toBe(false);
    expect(cSearch.classList.contains("search-expanded")).toBe(true);

    mockDoc.dispatchEvent({
      type: "pointerdown",
      target: new MockElement("outside"),
    });
    expect(listbox.classList.contains("hidden")).toBe(true);
    expect(cSearch.classList.contains("search-expanded")).toBe(false);
  });

  test("accepts a typing keyup without throwing", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    expect(() =>
      searchInput.dispatchEvent({
        type: "keyup",
        key: "a",
        target: searchInput,
      }),
    ).not.toThrow();
  });

  test("collapses mobile overlay and hides listbox on Escape key press", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    cSearch.classList.add("search-expanded");
    const escapeEvent = { type: "keydown", key: "Escape", target: searchInput };

    searchInput.dispatchEvent(escapeEvent);

    expect(cSearch.classList.contains("search-expanded")).toBe(false);
    expect(escapeEvent.defaultPrevented).toBe(true);
  });

  test("moves through search suggestions with ArrowDown", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();
    searchInput.value = "Per";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    searchInput.dispatchEvent({
      type: "keydown",
      key: "ArrowDown",
      target: searchInput,
    });

    expect(listbox.children[0].getAttribute("aria-selected")).toBe("true");
    expect(searchInput.getAttribute("aria-activedescendant")).toBe(
      "search-option-0",
    );
  });

  test("selects the active search suggestion with Enter", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();
    searchInput.value = "Per";
    searchInput.dispatchEvent({ type: "input", target: searchInput });
    searchInput.dispatchEvent({
      type: "keydown",
      key: "ArrowDown",
      target: searchInput,
    });

    searchInput.dispatchEvent({
      type: "keydown",
      key: "Enter",
      target: searchInput,
    });

    expect(searchInput.value).toBe("Person");
    expect(mockDoc.elements["locateSearchResult"].disabled).toBe(false);
    expect(listbox.classList.contains("hidden")).toBe(true);
  });

  test("synchronizes locate button title, aria-label, and disabled state on search result selection and clearing", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    const locateBtn = mockDoc.elements["locateSearchResult"];

    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");
    expect(locateBtn.classList.contains("highlighted")).toBe(false);

    locateBtn.click();
    expect(
      sharedViewRequests.filter((request) => request.viewport === "focus-next"),
    ).toHaveLength(0);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");

    // Simulate search option selection
    const mockOption = new MockElement("", "search-option", "li");
    mockOption.setAttribute("elementID", "0");
    listbox.appendChild(mockOption);

    listbox.dispatchEvent({
      type: "click",
      target: mockOption,
      stopPropagation: () => {},
    });

    expect(locateBtn.disabled).toBe(false);
    expect(locateBtn.title).toBe("Locate focused element");
    expect(locateBtn.getAttribute("aria-label")).toBe("Locate focused element");
    expect(locateBtn.classList.contains("highlighted")).toBe(true);

    // Locating reports the selection to the controller; it never drives the
    // renderer from here.
    locateBtn.click();
    expect(sharedViewRequests.at(-1)).toEqual({ viewport: "focus-next" });

    // Clear search
    searchMenu.clearText();
    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
    expect(locateBtn.getAttribute("aria-label")).toBe("Nothing to locate");
    expect(locateBtn.classList.contains("highlighted")).toBe(false);
  });

  test("keeps the search term and only highlights when a result is chosen", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    const searchInput = mockDoc.elements["search-input-text"];
    searchInput.value = "Per";
    searchInput.dispatchEvent({ type: "input", target: searchInput });
    const option = listbox.children[0];
    option.onclick({ type: "click", target: option, stopPropagation() {} });

    // The term stays, the graph only highlights, and locating remains a
    // separate action the reader can take.
    expect(searchInput.value).toBe("Person");
    expect(sharedViewRequests).toEqual([
      { focus: [{ kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" }] },
    ]);
    expect(mockDoc.elements["locateSearchResult"].disabled).toBe(false);
  });

  test("clearing search or loading new ontology resets locateAvailable so setMenuMode(true) does not re-highlight locate button", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    const locateBtn = mockDoc.elements["locateSearchResult"];

    searchMenu.setup();
    searchMenu.setMenuMode(true);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    // Select search option
    const mockOption = new MockElement("", "search-option", "li");
    mockOption.setAttribute("elementID", "0");
    listbox.appendChild(mockOption);
    listbox.dispatchEvent({
      type: "click",
      target: mockOption,
      stopPropagation: () => {},
    });

    expect(locateBtn.classList.contains("highlighted")).toBe(true);

    // Simulate loading a new ontology: searchMenu.clearText() is invoked
    searchMenu.clearText();

    expect(locateBtn.classList.contains("highlighted")).toBe(false);

    // When graph finishes loading, setMenuMode(true) is called
    searchMenu.setMenuMode(true);

    // The locate button MUST NOT re-highlight
    expect(locateBtn.classList.contains("highlighted")).toBe(false);
    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.title).toBe("Nothing to locate");
  });

  test("automatically disables and unhighlights locateSearchResult whenever search input text becomes empty", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    const locateBtn = mockDoc.elements["locateSearchResult"];

    searchMenu.setup();
    searchMenu.setMenuMode(true);

    searchInput.value = "Person";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    const mockOption = new MockElement("", "search-option", "li");
    mockOption.setAttribute("elementID", "0");
    listbox.appendChild(mockOption);
    listbox.dispatchEvent({
      type: "click",
      target: mockOption,
      stopPropagation: () => {},
    });

    expect(locateBtn.disabled).toBe(false);
    expect(locateBtn.classList.contains("highlighted")).toBe(true);

    // User deletes search text via backspace/typing
    searchInput.value = "";
    searchInput.dispatchEvent({ type: "input", target: searchInput });

    expect(locateBtn.disabled).toBe(true);
    expect(locateBtn.classList.contains("highlighted")).toBe(false);
    expect(locateBtn.title).toBe("Nothing to locate");
  });

  test("clearing search text completely removes all items from listbox", () => {
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: sharedSearchController,
    });
    searchMenu.setup();

    for (let i = 0; i < 10; i++) {
      const opt = new MockElement("opt_" + i, "search-option", "li");
      listbox.appendChild(opt);
    }
    expect(listbox.children.length).toBe(10);

    searchMenu.clearText();
    expect(listbox.children.length).toBe(0);
  });
});

describe("searchMenu selection reporting", () => {
  test("reports the selected element to the controller instead of driving the graph", () => {
    const viewRequests = [];
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: {
        findOntologyElements: () => ({
          matches: [
            {
              displayLabel: "Person",
              isFocusable: true,
              ontologyElementReference: {
                kind: "class",
                iri: "http://xmlns.com/foaf/0.1/Person",
              },
            },
            {
              displayLabel: "Agent",
              isFocusable: true,
              ontologyElementReference: {
                kind: "class",
                iri: "http://xmlns.com/foaf/0.1/Agent",
              },
            },
          ],
        }),
        setVisualizationView: (request) => {
          viewRequests.push(request);
          return Promise.resolve({});
        },
      },
    });

    searchMenu.focusOntologyElements([
      { kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" },
    ]);

    // A fact transfer: the element that was selected, with no instruction
    // about what the graph should do with it.
    expect(viewRequests).toEqual([
      {
        focus: [{ kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" }],
      },
    ]);
  });

  test("reports a cleared selection only when one was reported", () => {
    const viewRequests = [];
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: {
        findOntologyElements: () => ({
          matches: [
            {
              displayLabel: "Person",
              isFocusable: true,
              ontologyElementReference: {
                kind: "class",
                iri: "http://xmlns.com/foaf/0.1/Person",
              },
            },
          ],
        }),
        setVisualizationView: (request) => {
          viewRequests.push(request);
          return Promise.resolve({});
        },
      },
    });

    // With nothing selected there is no change to report.
    searchMenu.clearVisualizationFocus();
    expect(viewRequests).toEqual([]);

    searchMenu.focusOntologyElements([
      { kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" },
    ]);
    searchMenu.clearVisualizationFocus();

    // Clearing after a selection is the fact that nothing is selected now.
    expect(viewRequests.at(-1)).toEqual({ focus: [] });
  });

  test("does not recurse when the runtime clears the search in response", () => {
    const viewRequests = [];
    const searchMenuHolder = {};
    const reentrantController = {
      findOntologyElements: () => ({
        matches: [
          {
            displayLabel: "Person",
            isFocusable: true,
            ontologyElementReference: {
              kind: "class",
              iri: "http://xmlns.com/foaf/0.1/Person",
            },
          },
        ],
      }),
      setVisualizationView: (request) => {
        viewRequests.push(request);
        // Applying a focus change makes the renderer announce that the search
        // was cleared, which the application routes straight back here.
        searchMenuHolder.instance.clearText();
        return Promise.resolve({});
      },
    };
    searchMenuHolder.instance = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: reentrantController,
    });

    expect(() =>
      searchMenuHolder.instance.focusOntologyElements([
        { kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" },
      ]),
    ).not.toThrow();
    expect(viewRequests).toHaveLength(1);
  });

  test("renders a cleared focus without reporting it back to the controller", () => {
    const viewRequests = [];
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: {
        findOntologyElements: () => ({
          matches: [
            {
              displayLabel: "Person",
              isFocusable: true,
              ontologyElementReference: {
                kind: "class",
                iri: "http://xmlns.com/foaf/0.1/Person",
              },
            },
          ],
        }),
        setVisualizationView: (request) => {
          viewRequests.push(request);
          return Promise.resolve({});
        },
      },
    });
    searchMenu.setup();
    searchMenu.focusOntologyElements([
      { kind: "class", iri: "http://xmlns.com/foaf/0.1/Person" },
    ]);
    const reportedRequestCount = viewRequests.length;

    searchMenu.renderVisualizationFocus({
      focus: [],
      focusableElementCount: 0,
    });

    // Rendering state is presentation: it must not report a change back.
    expect(viewRequests).toHaveLength(reportedRequestCount);
    expect(searchMenu.getSearchString()).toBe("");
  });

  test("advances the viewport when the locate control is used", () => {
    const viewRequests = [];
    const searchMenu = searchMenuFactory({
      documentObject: global.document,
      windowObject: global.window,
      locationObject: global.location,
      webVowlController: {
        findOntologyElements: () => ({ matches: [] }),
        setVisualizationView: (request) => {
          viewRequests.push(request);
          return Promise.resolve({});
        },
      },
    });
    searchMenu.setup();

    searchMenu.advanceToNextFocusedElement();

    expect(viewRequests).toEqual([{ viewport: "focus-next" }]);
  });
});
