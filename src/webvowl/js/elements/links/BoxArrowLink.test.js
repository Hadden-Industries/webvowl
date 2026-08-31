import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { createRequire } from "node:module";
import { jest } from "@jest/globals";

const require = createRequire(import.meta.url);
const BoxArrowLink = require("./BoxArrowLink");

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createProperty() {
  return {
    inverse: () => null,
    linkGroup: jest.fn(),
    linkType: () => "dashed",
    markerElement: jest.fn(),
    markerId: () => "marker-set-operator",
    markerType: () => "white",
  };
}

describe("box-arrow links", () => {
  test("attach their marker directly to the rendered path", () => {
    const document = new DOMImplementation().createDocument(
      SVG_NAMESPACE,
      "svg",
      null,
    );
    const svg = d3.select(document.documentElement);
    const defs = svg.append("defs");
    const group = svg.append("g");
    const node = { cssClassOfNode: () => "node", equals: () => false };
    const link = new BoxArrowLink(node, node, createProperty());

    link.draw(group, defs);

    const path = d3.select(group.node().getElementsByTagName("path")[0]);
    const marker = d3.select(defs.node().getElementsByTagName("marker")[0]);
    const markerPath = d3.select(marker.node().getElementsByTagName("path")[0]);
    expect(path.attr("marker-start")).toBe("url(#marker-set-operator)");
    expect(group.attr("marker-start")).toBeNull();
    expect(marker.attr("refY")).toBe("0");
    expect(markerPath.attr("d")).toBe("M0,-8L8,0L0,8L-8,0Z");
  });
});
