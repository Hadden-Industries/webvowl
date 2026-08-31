const AbstractTextElement = require("./AbstractTextElement");

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
    global.d3 = { rgb: () => ({ r: 0, g: 0, b: 0 }) };
    const textSelection = createTextSelection();
    const container = { append: () => textSelection };

    const textElement = new AbstractTextElement(container, "#000");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textSelection.classes["text-on-dark"]).toBe(true);
    expect(textSelection.classes["text-on-light"]).toBe(false);
  });

  test("uses a semantic dark-text class on light backgrounds", () => {
    global.d3 = { rgb: () => ({ r: 255, g: 255, b: 255 }) };
    const textSelection = createTextSelection();
    const container = { append: () => textSelection };

    const textElement = new AbstractTextElement(container, "#fff");

    expect(textElement).toBeInstanceOf(AbstractTextElement);
    expect(textSelection.classes["text-on-dark"]).toBe(false);
    expect(textSelection.classes["text-on-light"]).toBe(true);
  });
});
