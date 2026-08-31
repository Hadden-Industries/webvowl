const textToolsFactory = require("./textTools");

describe("Truncating of text", () => {
  let tools;
  let attributes;

  beforeEach(() => {
    const mockElement = { offsetWidth: 20 };
    attributes = {};
    global.d3 = {
      select: () => ({
        append: () => ({
          attr: function (name, value) {
            attributes[name] = value;
            return this;
          },
          text: function (txt) {
            mockElement.offsetWidth = txt.length * 5;
            return this;
          },
          node: () => mockElement,
          remove: () => {},
        }),
      }),
    };

    tools = textToolsFactory();
  });

  test("uses the shared CSS measurement class without an inline style", () => {
    tools.measureTextWidth("Ontology", "text");

    expect(attributes.class).toBe("text text-measurement-probe");
    expect(attributes.style).toBeUndefined();
  });

  test("should not truncate too short strings", () => {
    const text = "The text length is OK";
    const maxWidth = 1000;

    const truncatedText = tools.truncate(text, maxWidth);

    expect(truncatedText).toBe(text);
  });

  test("should truncate too long strings", () => {
    const text = "This text is too long";
    const maxWidth = 4;

    const truncatedText = tools.truncate(text, maxWidth, null, 0);

    expect(truncatedText).not.toBe(text);
    expect(truncatedText.length).toBeLessThan(text.length);
  });

  test("should append three dots when truncating", () => {
    const text = "This text is waaaaaaaaaay too long";
    const maxWidth = 50;

    const truncatedText = tools.truncate(text, maxWidth);

    expect(truncatedText).not.toBe(text);
    expect(truncatedText).toMatch(/.+\.\.\.$/);
  });
});
