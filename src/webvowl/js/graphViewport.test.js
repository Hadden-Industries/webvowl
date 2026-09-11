import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { beforeAll, jest } from "@jest/globals";
import { runInThisContext } from "node:vm";
import loadEsmModuleForTest from "../../app/test/loadEsmModuleForTest.js";

const graphModule = {};

let viewportTransform;
let measureViewportElement;

beforeAll(async () => {
  Object.assign(
    graphModule,
    await loadEsmModuleForTest(
      new URL("./runtime/renderedGraphInternals.js", import.meta.url),
      import.meta.url,
    ),
  );
  viewportTransform = graphModule.viewportTransform;
  measureViewportElement = graphModule.measureViewportElement;
});

globalThis.d3 = d3;

describe("continuous graph zoom rendering", () => {
  test.each([1, -1])(
    "draws the magnification reported for direction %s and retains the viewport center",
    (direction) => {
      const moduleGlobals = runInThisContext("globalThis");
      const originalGlobals = new Map(
        ["d3", "requestAnimationFrame", "cancelAnimationFrame"].map((name) => [
          name,
          Object.getOwnPropertyDescriptor(moduleGlobals, name),
        ]),
      );
      const document = new DOMImplementation().createDocument(
        "http://www.w3.org/1999/xhtml",
        "div",
      );
      const createElementNS = document.createElementNS.bind(document);
      document.createElementNS = (...args) => {
        const element = createElementNS(...args);
        // The XML DOM stores the real SVG tree. Browser event installation is
        // outside this test; the renderer's held-zoom command is invoked below.
        element.addEventListener = () => {};
        element.removeEventListener = () => {};
        return element;
      };
      const frames = new Map();
      let nextFrameId = 0;
      moduleGlobals.d3 = d3;
      moduleGlobals.requestAnimationFrame = (callback) => {
        frames.set(++nextFrameId, callback);
        return nextFrameId;
      };
      moduleGlobals.cancelAnimationFrame = (id) => frames.delete(id);
      let graph;
      try {
        graph = graphModule.createRenderedGraphInternals(
          document.documentElement,
          { widthPx: 800, heightPx: 600 },
        );
        graph.initializeSvgRoot();
        graph.setViewportTransform(1, [100, 50]);
        const svg = document.documentElement.firstChild;
        const drawing = svg.firstChild;
        expect(drawing.getAttribute("transform")).toBe(
          "translate(100,50)scale(1)",
        );
        const publishViewportChange = jest.fn();
        graph.setRenderedGraphEventPort({ publishViewportChange });

        graph.startContinuousZoom(direction);

        const scale = graph.scaleFactor();
        expect(direction > 0 ? scale > 1 : scale < 1).toBe(true);
        const [x, y] = graph.translation();
        expect(drawing.getAttribute("transform")).toBe(
          `translate(${x},${y})scale(${scale})`,
        );
        // At the initial transform, world point (300, 250) is the viewport
        // center (400, 300); changing magnification must keep it there.
        expect(x + 300 * scale).toBeCloseTo(400);
        expect(y + 250 * scale).toBeCloseTo(300);
        expect(svg.__zoom.k).toBe(scale);
        expect(publishViewportChange).toHaveBeenLastCalledWith(scale, x, y);
        expect(frames.size).toBe(1);
      } finally {
        graph?.stopContinuousZoom();
        for (const [name, descriptor] of originalGlobals) {
          if (descriptor) {
            Object.defineProperty(moduleGlobals, name, descriptor);
          } else {
            delete moduleGlobals[name];
          }
        }
        expect(frames.size).toBe(0);
      }
    },
  );
});

describe("graph viewport transform normalization", () => {
  test.each([
    NaN,
    Infinity,
    -Infinity,
    "NaN",
    "Infinity",
    "",
    null,
    undefined,
    true,
    0,
    -1,
  ])("rejects invalid zoom %p", (value) => {
    expect(viewportTransform.normalizeZoom(value, 0.1, 4)).toBeUndefined();
  });

  test("accepts legacy numeric strings and clamps them to the configured extent", () => {
    expect(viewportTransform.normalizeZoom("0.38", 0.1, 4)).toBe(0.38);
    expect(viewportTransform.normalizeZoom("0.01", 0.1, 4)).toBe(0.1);
    expect(viewportTransform.normalizeZoom("12", 0.1, 4)).toBe(4);
  });

  test.each([
    undefined,
    null,
    "10,20",
    [],
    [1],
    [NaN, 2],
    [1, Infinity],
    ["x", 2],
  ])("rejects invalid translation %p", (value) => {
    expect(viewportTransform.normalizeTranslation(value)).toBeUndefined();
  });

  test("normalizes numeric translation strings without retaining string state", () => {
    expect(viewportTransform.normalizeTranslation(["10.5", "-4"])).toEqual([
      10.5, -4,
    ]);
  });

  test("validates zoom and translation atomically", () => {
    expect(
      viewportTransform.normalizeViewport("0.5", ["12", "20"], 0.1, 4),
    ).toEqual({
      zoom: 0.5,
      translation: [12, 20],
    });
    expect(
      viewportTransform.normalizeViewport("NaN", [12, 20], 0.1, 4),
    ).toBeUndefined();
  });

  test("never serializes a non-finite SVG transform", () => {
    expect(viewportTransform.toSvgTransform(0.5, [12, -4])).toBe(
      "translate(12,-4)scale(0.5)",
    );
    expect(viewportTransform.toSvgTransform(NaN, [NaN, NaN])).toBeUndefined();
  });
});

describe("graph viewport element measurement", () => {
  test("uses the rendered client box when it is available", () => {
    const element = {
      clientWidth: 768,
      clientHeight: 512,
      getBoundingClientRect: () => ({ width: 760, height: 500 }),
    };

    expect(measureViewportElement(element, 100, 100)).toEqual({
      width: 768,
      height: 512,
    });
  });

  test("falls back to the bounding box when client dimensions are zero", () => {
    const element = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: 390.5, height: 700.25 }),
    };

    expect(measureViewportElement(element, 100, 100)).toEqual({
      width: 390.5,
      height: 700.25,
    });
  });

  test("retains the current viewport when the host is temporarily unmeasurable", () => {
    const element = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: 0, height: 0 }),
    };

    expect(measureViewportElement(element, 1200, 800)).toEqual({
      width: 1200,
      height: 800,
    });
    expect(measureViewportElement(undefined, -1, "invalid")).toEqual({
      width: 0,
      height: 0,
    });
  });
});
