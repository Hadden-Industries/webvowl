const textToolsFactory = require("./textTools");

describe("Truncating of text", () => {
  let tools;

  beforeEach(() => {
    const mockElement = { offsetWidth: 20 };
    global.d3 = {
      select: () => ({
        append: () => ({
          attr: function () {
            return this;
          },
          text: function (txt) {
            mockElement.offsetWidth = txt.length * 5;
            return this;
          },
          remove: () => {},
        }),
      }),
    };
    global.document = {
      getElementById: () => mockElement,
    };

    tools = textToolsFactory();
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
