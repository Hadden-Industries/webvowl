import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { beforeAll, jest } from "@jest/globals";

let BoxArrowLink;

beforeAll(async () => {
  ({ BoxArrowLink } = await import("./BoxArrowLink.js"));
});

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createProperty(overrides = {}) {
  return {
    inverse: () => null,
    linkGroup: jest.fn(),
    linkType: () => "dashed",
    markerElement: jest.fn(),
    markerId: () => "marker-set-operator",
    markerType: () => "white",
    ...overrides,
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

  test("inverse diamonds keep separate offsets and property state", () => {
    const document = new DOMImplementation().createDocument(
      SVG_NAMESPACE,
      "svg",
      null,
    );
    const svg = d3.select(document.documentElement);
    const defs = svg.append("defs");
    const group = svg.append("g");
    const node = { cssClassOfNode: () => "node", equals: () => false };
    const inverse = createProperty({
      markerId: () => "marker-inverse",
      markerType: () => "filled",
    });
    const property = createProperty({ inverse: () => inverse });
    new BoxArrowLink(node, node, property).draw(group, defs);

    const path = group.node().firstChild;
    const [start, end] = Array.from(defs.node().childNodes);
    expect(path.getAttribute("marker-start")).toBe("url(#marker-set-operator)");
    expect(path.getAttribute("marker-end")).toBe("url(#marker-inverse)");
    expect(start.getAttribute("refX")).toBe("-8");
    expect(end.getAttribute("refX")).toBe("8");
    expect(start.firstChild.__data__).toBe(property);
    expect(end.firstChild.__data__).toBe(inverse);
    expect(start.firstChild.getAttribute("class")).toBe("white");
    expect(end.firstChild.getAttribute("class")).toBe("filled");
    expect(end.getAttribute("markerUnits")).toBe("userSpaceOnUse");
    expect(end.getAttribute("orient")).toBe("auto");
    expect(end.firstChild.getAttribute("d")).toBe("M0,-8L8,0L0,8L-8,0Z");
    expect(property.markerElement.mock.calls[0][0].node()).toBe(start);
    expect(inverse.markerElement.mock.calls[0][0].node()).toBe(end);
  });
});
