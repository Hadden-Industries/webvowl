import { describe, expect, test } from "@jest/globals";
import {
  centerTextBlock,
  positionAbsoluteTextLine,
  positionCenteredTextLine,
  truncateTextLine,
  withTextLayoutBatch,
} from "./textLayoutBatch.js";

function layoutFixture() {
  const events = [];
  const documentObject = {
    body: { appendChild() {} },
    createElement() {
      return {
        textContent: "",
        setAttribute() {},
        remove() {},
        get offsetWidth() {
          events.push(`width:${this.textContent}`);
          return this.textContent.length * 5;
        },
      };
    },
    defaultView: {
      getComputedStyle(node) {
        events.push(`font:${node.name}`);
        return { getPropertyValue: () => `${node.fontSize}px` };
      },
    },
  };
  function element(name, height, fontSize = 12) {
    return {
      name,
      fontSize,
      ownerDocument: documentObject,
      attributes: {},
      setAttribute(attribute, value) {
        events.push(`${attribute}:${name}`);
        this.attributes[attribute] = value;
      },
      getBBox() {
        events.push(`box:${name}`);
        return { height };
      },
    };
  }
  return { events, documentObject, element };
}

describe("synchronous SVG text layout", () => {
  test("batches font and block reads before their writes, preserving coordinates", () => {
    const { documentObject, element, events } = layoutFixture();
    const first = element("first", 16);
    const second = element("second", 23, 9);

    const result = withTextLayoutBatch(documentObject, () => {
      positionCenteredTextLine(first, 0);
      centerTextBlock(first);
      positionCenteredTextLine(second, 1);
      centerTextBlock(second);
      centerTextBlock(first);
      return "drawn";
    });

    expect(result).toBe("drawn");
    expect(first.attributes).toEqual({ dy: "12px", y: "-8px" });
    expect(second.attributes).toEqual({ dy: "10px", y: "-11.5px" });
    expect(events).toEqual([
      "font:first",
      "font:second",
      "dy:first",
      "dy:second",
      "box:first",
      "box:second",
      "y:first",
      "y:second",
    ]);
  });

  test("nested draws share their document queue, while another document stays independent", () => {
    const first = layoutFixture();
    const second = layoutFixture();
    const a = first.element("a", 10);
    const b = first.element("b", 10, 15);
    const separate = second.element("separate", 10, 18);
    withTextLayoutBatch(first.documentObject, () => {
      positionAbsoluteTextLine(a, -2);
      withTextLayoutBatch(first.documentObject, () =>
        positionAbsoluteTextLine(b, 3),
      );
      positionAbsoluteTextLine(separate, 0);
      expect(separate.attributes.y).toBe("6px");
      expect(a.attributes).toEqual({});
      expect(b.attributes).toEqual({});
    });
    expect(a.attributes.y).toBe("2px");
    expect(b.attributes.y).toBe("8px");
  });

  test("failed draws release queued elements without publishing partial placement", () => {
    const { documentObject, element, events } = layoutFixture();
    const abandoned = element("abandoned", 12);
    expect(() =>
      withTextLayoutBatch(documentObject, () => {
        truncateTextLine(
          abandoned,
          { text: "Abandoned", maxWidth: 100 },
          () => {
            events.push("abandoned text");
          },
        );
        positionCenteredTextLine(abandoned, 0);
        centerTextBlock(abandoned);
        throw new Error("drawing failed");
      }),
    ).toThrow("drawing failed");
    expect(events).toEqual([]);
    const next = element("next", 22, 18);
    positionCenteredTextLine(next, 1);
    centerTextBlock(next);
    expect(next.attributes).toEqual({ dy: "19px", y: "-11px" });
    expect(abandoned.attributes).toEqual({});
  });

  test("finishes shortened text before font and box reads; ordinary edits remain immediate", () => {
    const { documentObject, element, events } = layoutFixture();
    const label = element("label", 12);
    const request = {
      text: "abcdefghij",
      maxWidth: 29,
      additionalTextSpace: 0,
    };
    withTextLayoutBatch(documentObject, () => {
      truncateTextLine(label, request, (value) => events.push(`text:${value}`));
      positionCenteredTextLine(label, 0);
      centerTextBlock(label);
      expect(events).toEqual([]);
    });
    expect(events).toEqual([
      "width:abcdefghij",
      "width:abcde",
      "text:ab...",
      "font:label",
      "dy:label",
      "box:label",
      "y:label",
    ]);
    events.length = 0;
    truncateTextLine(label, { text: "Edit", maxWidth: 100 }, (value) =>
      events.push(`text:${value}`),
    );
    expect(events).toEqual(["width:Edit", "text:Edit"]);
  });

  test("fresh styles are measured on every draw, including an ordinary unbatched edit", () => {
    const { documentObject, element } = layoutFixture();
    const label = element("label", 16);
    withTextLayoutBatch(documentObject, () =>
      positionCenteredTextLine(label, 0),
    );
    expect(label.attributes.dy).toBe("12px");
    label.fontSize = 21;
    withTextLayoutBatch(documentObject, () =>
      positionCenteredTextLine(label, 0),
    );
    expect(label.attributes.dy).toBe("21px");
    label.fontSize = 18;
    positionAbsoluteTextLine(label, 2);
    expect(label.attributes.y).toBe("8px");
  });
});
