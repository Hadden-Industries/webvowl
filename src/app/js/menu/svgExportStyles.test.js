const createExportSvgClone = require("./svgExportStyles");

class FakeStyle {
  constructor() {
    this.properties = {};
  }

  setProperty(name, value) {
    this.properties[name] = value;
  }
}

class FakeElement {
  constructor(options = {}) {
    this.classNames = options.classNames || [];
    this.computed = options.computed || {};
    this.children = options.children || [];
    this.attributes = {};
    this.style = new FakeStyle();
    this.parentNode = null;
    this.children.forEach((child) => {
      child.parentNode = this;
    });
  }

  descendants() {
    return this.children.reduce(
      (all, child) => all.concat(child, child.descendants()),
      [],
    );
  }

  querySelectorAll(selector) {
    const descendants = this.descendants();
    if (selector === "*") {
      return descendants;
    }
    if (selector === ".hidden-in-export") {
      return descendants.filter((element) =>
        element.classNames.includes("hidden-in-export"),
      );
    }
    return [];
  }

  cloneNode() {
    const clone = new FakeElement({
      classNames: this.classNames.slice(),
      computed: { ...this.computed },
      children: this.children.map((child) => child.cloneNode(true)),
    });
    clone.attributes = { ...this.attributes };
    return clone;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    this.parentNode.children = this.parentNode.children.filter(
      (child) => child !== this,
    );
    this.parentNode = null;
  }
}

describe("detached SVG style materialization", () => {
  test("resolves computed styles on the clone without mutating the live SVG", () => {
    const visible = new FakeElement({
      computed: { fill: "rgb(51, 102, 204)", stroke: "rgb(0, 0, 0)" },
    });
    const hidden = new FakeElement({
      classNames: ["hidden-in-export"],
      computed: { fill: "rgb(255, 0, 0)" },
    });
    const liveSvg = new FakeElement({ children: [visible, hidden] });
    visible.style.setProperty("--vowl-fill", "#36c");

    const exportedSvg = createExportSvgClone(liveSvg, (element) => ({
      getPropertyValue: (name) => element.computed[name] || "",
    }));

    const exportedVisible = exportedSvg.querySelectorAll("*")[0];
    expect(exportedVisible.style.properties.fill).toBe("rgb(51, 102, 204)");
    expect(exportedVisible.style.properties.stroke).toBe("rgb(0, 0, 0)");
    expect(exportedSvg.querySelectorAll(".hidden-in-export")).toHaveLength(0);
    expect(exportedSvg.attributes.version).toBe("1.1");
    expect(exportedSvg.attributes.xmlns).toBe("http://www.w3.org/2000/svg");
    expect(visible.style.properties).toEqual({ "--vowl-fill": "#36c" });
    expect(liveSvg.querySelectorAll(".hidden-in-export")).toHaveLength(1);
  });

  test("preserves marker references and materializes marker fills in the exported SVG", () => {
    const markerPath = new FakeElement({ computed: { fill: "rgb(0, 0, 0)" } });
    const linkPath = new FakeElement({
      computed: { fill: "none", stroke: "rgb(0, 0, 0)" },
    });
    const liveSvg = new FakeElement({ children: [markerPath, linkPath] });
    linkPath.setAttribute("marker-end", "url(#marker-property-1)");

    const exportedSvg = createExportSvgClone(liveSvg, (element) => ({
      getPropertyValue: (name) => element.computed[name] || "",
    }));
    const [exportedMarkerPath, exportedLinkPath] =
      exportedSvg.querySelectorAll("*");

    expect(exportedMarkerPath.style.properties.fill).toBe("rgb(0, 0, 0)");
    expect(exportedLinkPath.attributes["marker-end"]).toBe(
      "url(#marker-property-1)",
    );
    expect(linkPath.attributes["marker-end"]).toBe("url(#marker-property-1)");
  });
});
