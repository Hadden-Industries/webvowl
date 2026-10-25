import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { beforeAll, jest } from "@jest/globals";

let ArrowLink;

beforeAll(async () => {
  ({ ArrowLink } = await import("./ArrowLink.js"));
});

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

  test("repeated arrows initialize fixed geometry once but own separate marker state", () => {
    const document = new DOMImplementation().createDocument(
      SVG_NAMESPACE,
      "svg",
      null,
    );
    const svg = d3.select(document.documentElement);
    const defs = svg.append("defs");
    const geometryWrites = [];
    const prototype = document.documentElement.constructor.prototype;
    const set = prototype.setAttribute;
    const spy = jest
      .spyOn(prototype, "setAttribute")
      .mockImplementation(function (name, value) {
        if (name === "viewBox") {
          geometryWrites.push(value);
        }
        return set.call(this, name, value);
      });
    try {
      const first = createProperty();
      const second = createProperty({
        markerId: () => "marker-property-2",
        markerType: () => "white",
      });
      for (const property of [first, second]) {
        const link = new ArrowLink(
          createNode("domain"),
          createNode("range"),
          property,
        );
        link.draw(svg.append("g"), defs);
      }
      const [a, b] = Array.from(defs.node().getElementsByTagName("marker"));
      expect(a).not.toBe(b);
      expect(a.firstChild).not.toBe(b.firstChild);
      expect(a.__data__).toBe(first);
      expect(a.firstChild.__data__).toBe(first);
      expect(b.__data__).toBe(second);
      expect(b.firstChild.__data__).toBe(second);
      a.firstChild.setAttribute("class", "filled hovered");
      a.setAttribute("refX", "99");
      expect(b.firstChild.getAttribute("class")).toBe("white");
      expect(b.getAttribute("refX")).toBe("0");
      expect(first.markerElement.mock.calls[0][0].node()).toBe(a);
      expect(second.markerElement.mock.calls[0][0].node()).toBe(b);
      const third = createProperty({ markerId: () => "marker-property-3" });
      new ArrowLink(createNode("domain"), createNode("range"), third).draw(
        svg.append("g"),
        defs,
      );
      const c = defs.node().lastChild;
      expect(c.getAttribute("refX")).toBe("0");
      expect(c.firstChild.getAttribute("class")).toBe("filled");
      expect(c.firstChild.__data__).toBe(third);
      expect(geometryWrites).toEqual(["-14 -10 28 20"]);
      expect(
        drawLink(createProperty()).defs.node().firstChild.ownerDocument,
      ).not.toBe(document);
    } finally {
      spy.mockRestore();
    }
  });
});
