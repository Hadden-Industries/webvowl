import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let createRenderedSvgExportClone;

beforeAll(async () => {
  ({ createRenderedSvgExportClone } = await loadEsmModuleForTest(
    new URL("./renderedSvgExportClone.js", import.meta.url),
    import.meta.url,
  ));
});

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
    if (selector.startsWith(".")) {
      const className = selector.slice(1);
      return descendants.filter((element) =>
        element.classNames.includes(className),
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

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
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

    const exportedSvg = createRenderedSvgExportClone(liveSvg, (element) => ({
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

    const exportedSvg = createRenderedSvgExportClone(liveSvg, (element) => ({
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

  test("frames the clone on what the reader is looking at", () => {
    // An exported view is the view on screen. Framing the clone to a different
    // canvas would clip a graph the reader can see, because the drawn content
    // is positioned for the live viewport.
    const liveSvg = new FakeElement({ children: [] });
    liveSvg.setAttribute("width", "1600");
    liveSvg.setAttribute("height", "845");

    const exportedSvg = createRenderedSvgExportClone(
      liveSvg,
      (element) => ({
        getPropertyValue: (name) => element.computed[name] || "",
      }),
      { widthPx: 1600, heightPx: 845 },
    );

    expect(exportedSvg.attributes.width).toBe("1600");
    expect(exportedSvg.attributes.height).toBe("845");
    expect(exportedSvg.attributes.viewBox).toBe("0 0 1600 845");
  });

  test("removes interaction-only content along with export-hidden content", () => {
    // Neither belongs in a file: one exists only to catch a pointer, the other
    // is marked as not for export.
    const interactionOnly = new FakeElement({
      classNames: ["vowl-interaction-only"],
    });
    const hidden = new FakeElement({ classNames: ["hidden-in-export"] });
    const liveSvg = new FakeElement({ children: [interactionOnly, hidden] });

    const exportedSvg = createRenderedSvgExportClone(
      liveSvg,
      (element) => ({
        getPropertyValue: (name) => element.computed[name] || "",
      }),
      { widthPx: 800, heightPx: 600 },
    );

    expect(exportedSvg.querySelectorAll(".vowl-interaction-only")).toHaveLength(
      0,
    );
    expect(exportedSvg.querySelectorAll(".hidden-in-export")).toHaveLength(0);
    expect(liveSvg.querySelectorAll(".vowl-interaction-only")).toHaveLength(1);
  });
});
