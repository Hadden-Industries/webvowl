import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { createRequire } from "node:module";
import { jest } from "@jest/globals";

const require = createRequire(import.meta.url);
const ArrowLink = require("./ArrowLink");

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createNode(cssClass) {
  return {
    cssClassOfNode: () => cssClass,
    equals: (other) => other === this,
  };
}

function createProperty(overrides = {}) {
  return {
    inverse: () => null,
    linkGroup: jest.fn(),
    linkType: () => "normal",
    markerElement: jest.fn(),
    markerId: () => "marker-property-1",
    markerType: () => "filled",
    ...overrides,
  };
}

function drawLink(property) {
  const document = new DOMImplementation().createDocument(
    SVG_NAMESPACE,
    "svg",
    null,
  );
  const svg = d3.select(document.documentElement);
  const defs = svg.append("defs");
  const group = svg.append("g");
  const link = new ArrowLink(
    createNode("domain"),
    createNode("range"),
    property,
  );

  link.draw(group, defs);

  const path = d3.select(group.node().getElementsByTagName("path")[0]);
  return { defs, group, path };
}

describe("arrow links", () => {
  test("attach an explicit, automatically oriented end marker to the rendered path", () => {
    const { defs, group, path } = drawLink(createProperty());
    const marker = d3.select(defs.node().getElementsByTagName("marker")[0]);
    const markerPath = d3.select(marker.node().getElementsByTagName("path")[0]);

    expect(path.attr("marker-end")).toBe("url(#marker-property-1)");
    expect(group.attr("marker-end")).toBeNull();
    expect(marker.attr("orient")).toBe("auto");
    expect(marker.attr("refX")).toBe("0");
    expect(marker.attr("refY")).toBe("0");
    expect(markerPath.attr("d")).toBe("M0,0L-12,8L-12,-8Z");
  });

  test("attach inverse-property markers to the start of the same rendered path", () => {
    const inverse = createProperty({
      markerId: () => "marker-property-inverse",
      markerType: () => "white",
    });
    const property = createProperty({ inverse: () => inverse });
    const { defs, group, path } = drawLink(property);
    const markers = defs.node().getElementsByTagName("marker");
    const inverseMarker = d3.select(markers[1]);
    const inversePath = d3.select(
      inverseMarker.node().getElementsByTagName("path")[0],
    );

    expect(path.attr("marker-start")).toBe("url(#marker-property-inverse)");
    expect(group.attr("marker-start")).toBeNull();
    expect(inversePath.attr("class")).toContain("white");
    expect(inversePath.attr("d")).toBe("M0,0L12,-8L12,8Z");
  });
});
