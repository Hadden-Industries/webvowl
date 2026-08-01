global.d3 = require("d3");
const graphModule = require("./graph");
const viewportTransform = graphModule.viewportTransform;
const measureViewportElement = graphModule.measureViewportElement;

describe("graph viewport transform normalization", () => {
  test.each([NaN, Infinity, -Infinity, "NaN", "Infinity", "", null, undefined, true, 0, -1])(
    "rejects invalid zoom %p",
    ( value ) => {
      expect(viewportTransform.normalizeZoom(value, 0.1, 4)).toBeUndefined();
    }
  );

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
    ["x", 2]
  ])("rejects invalid translation %p", ( value ) => {
    expect(viewportTransform.normalizeTranslation(value)).toBeUndefined();
  });

  test("normalizes numeric translation strings without retaining string state", () => {
    expect(viewportTransform.normalizeTranslation(["10.5", "-4"])).toEqual([10.5, -4]);
  });

  test("validates zoom and translation atomically", () => {
    expect(viewportTransform.normalizeViewport("0.5", ["12", "20"], 0.1, 4)).toEqual({
      zoom: 0.5,
      translation: [12, 20]
    });
    expect(viewportTransform.normalizeViewport("NaN", [12, 20], 0.1, 4)).toBeUndefined();
  });

  test("never serializes a non-finite SVG transform", () => {
    expect(viewportTransform.toSvgTransform(0.5, [12, -4])).toBe("translate(12,-4)scale(0.5)");
    expect(viewportTransform.toSvgTransform(NaN, [NaN, NaN])).toBeUndefined();
  });
});

describe("graph viewport element measurement", () => {
  test("uses the rendered client box when it is available", () => {
    const element = {
      clientWidth: 768,
      clientHeight: 512,
      getBoundingClientRect: () => ({ width: 760, height: 500 })
    };

    expect(measureViewportElement(element, 100, 100)).toEqual({ width: 768, height: 512 });
  });

  test("falls back to the bounding box when client dimensions are zero", () => {
    const element = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: 390.5, height: 700.25 })
    };

    expect(measureViewportElement(element, 100, 100)).toEqual({ width: 390.5, height: 700.25 });
  });

  test("retains the current viewport when the host is temporarily unmeasurable", () => {
    const element = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: 0, height: 0 })
    };

    expect(measureViewportElement(element, 1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(measureViewportElement(undefined, -1, "invalid")).toEqual({ width: 0, height: 0 });
  });
});
