import { beforeAll, expect, test } from "@jest/globals";
import { color } from "d3";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let captureRenderedDrawing;
let serializeRenderedDrawingAsTikz;
beforeAll(async () => {
  ({ captureRenderedDrawing } = await loadEsmModuleForTest(
    new URL("./captureRenderedDrawing.js", import.meta.url),
    import.meta.url,
    { d3: { color } },
  ));
  ({ serializeRenderedDrawingAsTikz } = await loadEsmModuleForTest(
    new URL("../../../app/js/controller/tikzSerializer.js", import.meta.url),
    import.meta.url,
  ));
});

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
