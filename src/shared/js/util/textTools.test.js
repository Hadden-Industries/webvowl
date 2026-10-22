import { beforeAll } from "@jest/globals";

let textToolsFactory;

beforeAll(async () => {
  ({ createTextTools: textToolsFactory } = await import("./textTools.js"));
});

describe("native width batches", () => {
  function measurementDocument(factor = 5) {
    const events = [];
    const probes = new Set();
    const documentObject = {
      factor,
      body: {
        appendChild: (probe) => {
          events.push(`append:${probe.textContent}`);
          probes.add(probe);
        },
      },
      createElement() {
        let style;
        return {
          textContent: "",
          setAttribute: (_name, value) => {
            style = value;
          },
          remove() {
            events.push(`remove:${this.textContent}`);
            probes.delete(this);
          },
          get offsetWidth() {
            events.push(`read:${this.textContent}`);
            if (documentObject.fail) {
              throw new Error("measurement failed");
            }
            return (
              this.textContent.length *
              documentObject.factor *
              (style.startsWith("subtext ") ? 0.5 : 1)
            );
          },
        };
      },
    };
    return { documentObject, events, probes };
  }

  test("prepares native widths together and reuses only exact text/style requests", () => {
    const tools = textToolsFactory();
    const { documentObject, events, probes } = measurementDocument();
    const result = tools.withMeasurementBatch(
      [
        { text: "Alpha", textStyle: "text" },
        { text: "Beta", textStyle: "subtext" },
        { text: "Alpha", textStyle: "text" },
      ],
      () => {
        expect(tools.measureTextWidth("Alpha", "text", documentObject)).toBe(
          25,
        );
        expect(tools.measureTextWidth("Beta", "subtext", documentObject)).toBe(
          10,
        );
        expect(tools.measureTextWidth("Alpha", "text", documentObject)).toBe(
          25,
        );
        expect(tools.truncate("Alpha", 100, "text", 0, documentObject)).toBe(
          "Alpha",
        );
        return 42;
      },
      documentObject,
    );
    expect(result).toBe(42);
    expect(events).toEqual([
      "append:Alpha",
      "append:Beta",
      "read:Alpha",
      "read:Beta",
      "remove:Alpha",
      "remove:Beta",
    ]);
    expect(probes.size).toBe(0);
  });

  test("misses use the native oracle; documents and later font/style epochs cannot reuse widths", () => {
    const tools = textToolsFactory();
    const first = measurementDocument(5);
    const second = measurementDocument(9);
    const request = [{ text: "Alpha", textStyle: "text" }];
    tools.withMeasurementBatch(
      request,
      () => {
        expect(
          tools.measureTextWidth("Alpha", "text", first.documentObject),
        ).toBe(25);
        expect(
          tools.measureTextWidth("Alpha", "subtext", first.documentObject),
        ).toBe(12.5);
        expect(
          tools.measureTextWidth("Beta", "text", first.documentObject),
        ).toBe(20);
        expect(
          tools.measureTextWidth("Alpha", "text", second.documentObject),
        ).toBe(45);
      },
      first.documentObject,
    );
    first.documentObject.factor = 7;
    tools.withMeasurementBatch(
      request,
      () => {
        expect(
          tools.measureTextWidth("Alpha", "text", first.documentObject),
        ).toBe(35);
      },
      first.documentObject,
    );
    first.documentObject.factor = 8;
    expect(tools.measureTextWidth("Alpha", "text", first.documentObject)).toBe(
      40,
    );
  });

  test("draw and measurement failures release probes and their epoch", () => {
    const tools = textToolsFactory();
    const { documentObject, probes } = measurementDocument();
    const request = [
      { text: "Alpha", textStyle: "text" },
      { text: "Beta", textStyle: "text" },
    ];
    expect(() =>
      tools.withMeasurementBatch(
        request,
        () => {
          throw new Error("draw failed");
        },
        documentObject,
      ),
    ).toThrow("draw failed");
    documentObject.fail = true;
    expect(() =>
      tools.withMeasurementBatch(
        request,
        () => {
          throw new Error("draw must not start");
        },
        documentObject,
      ),
    ).toThrow("measurement failed");
    expect(probes.size).toBe(0);
    documentObject.fail = false;
    documentObject.factor = 8;
    expect(tools.measureTextWidth("Alpha", "text", documentObject)).toBe(40);
  });
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
