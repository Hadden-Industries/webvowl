import { describe, expect, test, jest } from "@jest/globals";
import sidebarFactory from "./sidebar.js";

class MockElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.attributes = {};
    this.children = [];
    this.textContent = "";
    this._classList = new Set();
    this.listeners = {};
  }
  setAttribute(name, val) {
    this.attributes[name] = val;
  }
  appendChild(child) {
    this.children.push(child);
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }
  get classList() {
    return {
      add: (c) => this._classList.add(c),
      remove: (c) => this._classList.delete(c),
      toggle: (c, state) =>
        state ? this._classList.add(c) : this._classList.delete(c),
      contains: (c) => this._classList.has(c),
    };
  }
}

global.document = {
  createElement: (tag) => new MockElement(tag),
  querySelector: jest.fn().mockReturnValue(new MockElement()),
  querySelectorAll: jest.fn().mockReturnValue([]),
};
global.window = {
  innerWidth: 1024,
  event: null,
};

// Mock webvowl global structure which sidebar relies on
global.webvowl = {
  util: {
    languageTools: () => ({}),
    elementTools: () => ({}),
  },
};
global.requestAnimationFrame = jest.fn((cb) => cb());

describe("sidebar ontology IRI links", () => {
  test.each([
    ["http://example.org/ontology", "http://example.org/ontology"],
    ["https://example.org/ontology", "https://example.org/ontology"],
    ["urn:isbn:9780141036144", "urn:isbn:9780141036144"],
    ["  urn:example:ontology  ", "urn:example:ontology"],
  ])("allows an explicitly supported IRI scheme for %p", (iri, expected) => {
    expect(sidebarFactory.navigableIri(iri)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///tmp/ontology.owl",
    "ftp://example.org/ontology",
    "//example.org/ontology",
    "/relative/ontology",
    "not an IRI",
    "",
    "   ",
    null,
    undefined,
  ])("rejects unsupported or invalid IRI %p", (iri) => {
    expect(sidebarFactory.navigableIri(iri)).toBeUndefined();
  });

  test("replaces placeholder text with a link for an allowed IRI", () => {
    const container = new MockElement("p");
    container.textContent = "not given";

    sidebarFactory.renderOntologyIri(container, "urn:example:ontology");

    expect(container.textContent).toBe("");
    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toMatchObject({
      attributes: {
        href: "urn:example:ontology",
        target: "_blank",
        title: "urn:example:ontology",
      },
      tag: "a",
      textContent: "urn:example:ontology",
    });
    expect(container.children[0].attributes.rel).toBeUndefined();
  });

  test("renders unsupported IRIs as plain text", () => {
    const container = new MockElement("p");
    container.textContent = "not given";

    sidebarFactory.renderOntologyIri(container, "javascript:alert(1)");

    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toMatchObject({
      attributes: {},
      tag: "span",
      textContent: "javascript:alert(1)",
    });
  });
});

describe("sidebar initialization", () => {
  test("setup() executes without throwing errors from improper DOM event chaining", () => {
    const mockGraph = {
      updateCanvasContainerSize: jest.fn(),
      options: () => ({
        sidebar: () => ({
          showSidebar: jest.fn(),
        }),
      }),
    };
    const sidebar = sidebarFactory(mockGraph);
    expect(() => sidebar.setup()).not.toThrow();
  });
});
