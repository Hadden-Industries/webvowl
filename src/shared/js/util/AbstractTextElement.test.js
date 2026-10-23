import { beforeAll } from "@jest/globals";
import { select } from "d3";
import { DOMImplementation } from "@xmldom/xmldom";

let AbstractTextElement;

beforeAll(async () => {
  ({ AbstractTextElement } = await import("./AbstractTextElement.js"));
});

function createContainer() {
  const document = new DOMImplementation().createDocument(
    "http://www.w3.org/2000/svg",
    "g",
  );
  return select(document.documentElement);
}

describe("AbstractTextElement contrast state", () => {
  test("uses a semantic light-text class on dark backgrounds", () => {
    const container = createContainer();

    const textElement = new AbstractTextElement(container, "#000");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textElement._textBlock().classed("text-on-dark")).toBe(true);
    expect(textElement._textBlock().classed("text-on-light")).toBe(false);
  });

  test("uses a semantic dark-text class on light backgrounds", () => {
    const container = createContainer();

    const textElement = new AbstractTextElement(container, "#fff");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textElement._textBlock().classed("text-on-dark")).toBe(false);
    expect(textElement._textBlock().classed("text-on-light")).toBe(true);
  });
});
