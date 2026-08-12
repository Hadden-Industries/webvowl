/** @jest-environment jsdom */
import { describe, expect, test } from "@jest/globals";
import sidebarFactory from "./sidebar.js";

class MockSelection {
  constructor(tag = "container", text = "") {
    this.attributes = {};
    this.children = [];
    this.tag = tag;
    this.textValue = text;
  }

  append(tag) {
    const child = new MockSelection(tag);
    this.children.push(child);
    return child;
  }

  attr(name, value) {
    this.attributes[name] = value;
    return this;
  }

  text(value) {
    this.textValue = value;
    return this;
  }
}

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
    const container = new MockSelection("p", "not given");

    sidebarFactory.renderOntologyIri(container, "urn:example:ontology");

    expect(container.textValue).toBe("");
    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toMatchObject({
      attributes: {
        href: "urn:example:ontology",
        target: "_blank",
        title: "urn:example:ontology",
      },
      tag: "a",
      textValue: "urn:example:ontology",
    });
    expect(container.children[0].attributes.rel).toBeUndefined();
  });

  test("renders unsupported IRIs as plain text", () => {
    const container = new MockSelection("p", "not given");

    sidebarFactory.renderOntologyIri(container, "javascript:alert(1)");

    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toMatchObject({
      attributes: {},
      tag: "span",
      textValue: "javascript:alert(1)",
    });
  });
});
