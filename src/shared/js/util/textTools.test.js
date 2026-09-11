import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let textToolsFactory;

beforeAll(async () => {
  ({ createTextTools: textToolsFactory } = await loadEsmModuleForTest(
    new URL("./textTools.js", import.meta.url),
    import.meta.url,
  ));
});

describe("Truncating of text", () => {
  let tools;
  let attributes;

  beforeEach(() => {
    attributes = {};
    const appendedProbes = [];
    global.document = {
      body: {
        appendChild(probeElement) {
          appendedProbes.push(probeElement);
          return probeElement;
        },
      },
      createElement() {
        const probeElement = {
          textContent: "",
          setAttribute(attributeName, attributeValue) {
            attributes[attributeName] = attributeValue;
          },
          remove() {
            const probeIndex = appendedProbes.indexOf(probeElement);
            if (probeIndex !== -1) {
              appendedProbes.splice(probeIndex, 1);
            }
          },
          get offsetWidth() {
            return probeElement.textContent.length * 5;
          },
        };
        return probeElement;
      },
    };

    tools = textToolsFactory();
  });

  test("uses the shared CSS measurement class without an inline style", () => {
    tools.measureTextWidth("Ontology", "text", global.document);

    expect(attributes.class).toBe("text text-measurement-probe");
    expect(attributes.style).toBeUndefined();
  });

  test("should not truncate too short strings", () => {
    const text = "The text length is OK";
    const maxWidth = 1000;

    const truncatedText = tools.truncate(
      text,
      maxWidth,
      undefined,
      undefined,
      global.document,
    );

    expect(truncatedText).toBe(text);
  });

  test("should truncate too long strings", () => {
    const text = "This text is too long";
    const maxWidth = 4;

    const truncatedText = tools.truncate(
      text,
      maxWidth,
      null,
      0,
      global.document,
    );

    expect(truncatedText).not.toBe(text);
    expect(truncatedText.length).toBeLessThan(text.length);
  });

  test("should append three dots when truncating", () => {
    const text = "This text is waaaaaaaaaay too long";
    const maxWidth = 50;

    const truncatedText = tools.truncate(
      text,
      maxWidth,
      undefined,
      undefined,
      global.document,
    );

    expect(truncatedText).not.toBe(text);
    expect(truncatedText).toMatch(/.+\.\.\.$/);
  });
});
