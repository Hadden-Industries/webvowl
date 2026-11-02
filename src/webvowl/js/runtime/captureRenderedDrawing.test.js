import { expect, test } from "@jest/globals";
import { serializeRenderedDrawingAsTikz } from "../../../app/js/controller/tikzSerializer.js";
import { captureRenderedDrawing } from "./captureRenderedDrawing.js";

test.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "exports only visible inverse label glyphs (hidden=%s,%s)",
  (primaryHidden, inverseHidden) => {
    const property = (name, hidden) => ({
      labelForCurrentLanguage: () => name,
      labelVisible: () => !hidden,
      type: () => "owl:ObjectProperty",
      attributes: () => [],
      backgroundColor: () => "#aaf",
      textWidth: () => 80,
    });
    const primary = property("forward label", primaryHidden);
    const inverse = property("reverse label", inverseHidden);
    primary.inverse = () => inverse;
    const drawing = captureRenderedDrawing({
      nodes: [],
      propertyLabels: [{ x: 50, y: 40, property: () => primary }],
      links: [],
      math: {},
      compactNotation: false,
      viewport: {
        widthPx: 400,
        heightPx: 300,
        zoomScale: 1,
        translationXPx: 0,
        translationYPx: 0,
      },
      svgRoot: {
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        querySelectorAll: () => [],
      },
      readComputedStyle: () => ({}),
    });
    const names = drawing.propertyLabels.flatMap((row) => [
      row.label,
      ...(row.inverse ? [row.inverse.label] : []),
    ]);
    expect(names).toEqual([
      ...(primaryHidden ? [] : ["forward label"]),
      ...(inverseHidden ? [] : ["reverse label"]),
    ]);
    expect(drawing.propertyLabels).toHaveLength(
      primaryHidden && inverseHidden ? 0 : 1,
    );
    if (!primaryHidden || !inverseHidden) {
      expect(drawing.propertyLabels[0]).toMatchObject({ x: 50, y: 40 });
    }
    expect(() => structuredClone(drawing)).not.toThrow();
    const tex = serializeRenderedDrawingAsTikz({
      loadGeneration: 1,
      ...drawing,
    });
    expect(tex.includes("forward label")).toBe(!primaryHidden);
    expect(tex.includes("reverse label")).toBe(!inverseHidden);
  },
);

test("keeps a small visible drawing within TeX dimensions at minimum zoom", () => {
  const drawing = captureRenderedDrawing({
    nodes: [],
    propertyLabels: [],
    links: [],
    math: {},
    compactNotation: false,
    viewport: {
      widthPx: 400,
      heightPx: 300,
      zoomScale: 0.01,
      translationXPx: 0,
      translationYPx: 0,
    },
    svgRoot: {
      getBoundingClientRect: () => ({ left: 100, top: 40 }),
      querySelectorAll: () => [
        {
          closest: () => null,
          getBoundingClientRect: () => ({
            left: 100.5,
            top: 40.5,
            right: 101.5,
            bottom: 41.5,
          }),
        },
      ],
    },
    readComputedStyle: () => ({}),
  });
  // A 100-pixel drawing occupies one screen pixel at 0.01 magnification.
  expect(drawing.bounds).toEqual({
    leftPx: 50,
    topPx: 50,
    rightPx: 150,
    bottomPx: 150,
  });
  const tex = serializeRenderedDrawingAsTikz({ loadGeneration: 1, ...drawing });
  expect(tex).toContain("\\clip (50pt , -150pt ) rectangle (150pt , -50pt);");
  expect(tex).not.toContain("40000pt");
});

test("captures native color, exact text and viewport measurements without renderer objects", () => {
  const textElement = {
    children: [
      { textContent: "Fish & Person", innerHTML: "Fish &amp; Person" },
    ],
  };
  const node = {
    x: 20,
    y: 30,
    labelForCurrentLanguage: () => "Fish & Person",
    type: () => "owl:Class",
    attributes: () => ["external"],
    backgroundColor: () => "rgb(51, 102, 204)",
    actualRadius: () => 50,
    individuals: () => [],
    textBlock: () => ({ _textBlock: () => ({ node: () => textElement }) }),
  };
  const drawing = captureRenderedDrawing({
    nodes: [node],
    propertyLabels: [],
    links: [],
    math: {},
    compactNotation: false,
    viewport: {
      widthPx: 400,
      heightPx: 300,
      zoomScale: 0.5,
      translationXPx: 40,
      translationYPx: -20,
    },
    readComputedStyle: () => ({ fill: "rgb(255, 255, 255)" }),
    svgRoot: {
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
      querySelectorAll: () => [
        {
          closest: () => null,
          getBoundingClientRect: () => ({
            left: 25,
            top: -30,
            right: 75,
            bottom: 20,
          }),
        },
      ],
    },
  });
  expect(drawing.bounds).toEqual({
    leftPx: -30,
    topPx: 40,
    rightPx: 70,
    bottomPx: 80,
  });
  expect(drawing.nodes[0]).toMatchObject({
    x: 20,
    y: 30,
    widthPx: 100,
    backgroundColor: "#3366cc",
    label: "Fish & Person",
    textLines: ["Fish & Person"],
    textColor: "rgb(255, 255, 255)",
  });
  node.x = 900;
  textElement.children[0].textContent = "Changed";
  expect(drawing.nodes[0].x).toBe(20);
  expect(drawing.nodes[0].textLines).toEqual(["Fish & Person"]);
  expect(() => structuredClone(drawing)).not.toThrow();
});
