import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let AbstractTextElement;

beforeAll(async () => {
  ({ AbstractTextElement } = await loadEsmModuleForTest(
    new URL("./AbstractTextElement.js", import.meta.url),
    import.meta.url,
  ));
});

function createTextSelection() {
  const classes = {};
  const selection = {
    classes,
    classed: function (name, value) {
      classes[name] = value;
      return selection;
    },
    attr: function () {
      return selection;
    },
  };
  return selection;
}

describe("AbstractTextElement contrast state", () => {
  test("uses a semantic light-text class on dark backgrounds", () => {
    const textSelection = createTextSelection();
    const container = { append: () => textSelection };

    const textElement = new AbstractTextElement(container, "#000");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textSelection.classes["text-on-dark"]).toBe(true);
    expect(textSelection.classes["text-on-light"]).toBe(false);
  });

  test("uses a semantic dark-text class on light backgrounds", () => {
    const textSelection = createTextSelection();
    const container = { append: () => textSelection };

    const textElement = new AbstractTextElement(container, "#fff");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textSelection.classes["text-on-dark"]).toBe(false);
    expect(textSelection.classes["text-on-light"]).toBe(true);
  });
});
