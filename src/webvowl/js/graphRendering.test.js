const { DOMImplementation } = require("@xmldom/xmldom");

global.d3 = require("d3");

const graphModule = require("./graph");
const svgRenderingGuard = graphModule.svgRenderingGuard;
const createInvalidGeometryReporter = graphModule.createInvalidGeometryReporter;

function createSvgElement(tagName) {
  const document = new DOMImplementation().createDocument(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

describe("finite SVG rendering guard", () => {
  test("applies a translated point with a finite offset", () => {
    const element = createSvgElement("g");

    expect(
      svgRenderingGuard.setTransform(element, { x: 10, y: 5 }, { x: 3, y: 1 }),
    ).toBe(true);
    expect(element.getAttribute("transform")).toBe("translate(13,6)");
  });

  test.each([
    ["NaN x", { x: Number.NaN, y: 5 }, undefined],
    ["infinite y", { x: 10, y: Number.POSITIVE_INFINITY }, undefined],
    ["infinite offset", { x: 10, y: 5 }, { x: 0, y: -Infinity }],
    [
      "overflowing sum",
      { x: Number.MAX_VALUE, y: 5 },
      { x: Number.MAX_VALUE, y: 0 },
    ],
    ["missing point", undefined, undefined],
    ["coordinate string", { x: "10", y: 5 }, undefined],
  ])("preserves the existing transform for %s", (_name, point, offset) => {
    const element = createSvgElement("g");
    element.setAttribute("transform", "translate(4,8)");

    expect(svgRenderingGuard.setTransform(element, point, offset)).toBe(false);
    expect(element.getAttribute("transform")).toBe("translate(4,8)");
  });

  test("applies a curve when all path coordinates are finite", () => {
    const element = createSvgElement("path");

    expect(
      svgRenderingGuard.setCurvePath(element, [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ]),
    ).toBe(true);
    expect(element.getAttribute("d")).toBe("M0,0 Q40,100 50,100 Q60,100 100,0");
  });

  test.each([
    [
      "NaN coordinate",
      [
        { x: 0, y: 0 },
        { x: Number.NaN, y: 100 },
        { x: 100, y: 0 },
      ],
      undefined,
    ],
    [
      "missing point",
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      undefined,
    ],
    [
      "infinite tension",
      [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 0 },
      ],
      Infinity,
    ],
  ])("preserves the existing path for %s", (_name, points, tension) => {
    const element = createSvgElement("path");
    element.setAttribute("d", "M1,2 L3,4");

    expect(svgRenderingGuard.setCurvePath(element, points, tension)).toBe(
      false,
    );
    expect(element.getAttribute("d")).toBe("M1,2 L3,4");
  });
});

describe("invalid geometry reporting", () => {
  test("dispatches one warning per continuous invalid geometry episode", () => {
    const target = new EventTarget();
    const details = [];
    target.addEventListener("renderingwarning", (event) => {
      details.push(event.detail);
    });
    const report = createInvalidGeometryReporter(target);

    report(2);
    report(3);
    report(0);
    report(1);

    expect(details).toEqual([
      { code: "NON_FINITE_GEOMETRY", skippedUpdates: 2 },
      { code: "NON_FINITE_GEOMETRY", skippedUpdates: 1 },
    ]);
  });
});
