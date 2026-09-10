import * as d3 from "d3";
import { DOMImplementation } from "@xmldom/xmldom";
import { beforeAll, expect, jest, test } from "@jest/globals";
import { runInThisContext } from "node:vm";
import { readFileSync } from "node:fs";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let createRenderedGraphInternals;
let createVowlDocumentInsertionRecords;
beforeAll(async () => {
  ({ createRenderedGraphInternals } = await loadEsmModuleForTest(
    new URL("./renderedGraphInternals.js", import.meta.url),
    import.meta.url,
  ));
  ({ createVowlDocumentInsertionRecords } = await loadEsmModuleForTest(
    new URL("../../../app/js/controller/vowlDocument.js", import.meta.url),
    import.meta.url,
  ));
});

// Real D3, parser and SVG elements; only browser layout metrics and event
// installation are supplied here. The tests replay the installed drag callbacks.
function mountGraph(model) {
  const document = new DOMImplementation().createDocument(
    "http://www.w3.org/1999/xhtml",
    "div",
  );
  function descendants(element, selector) {
    return Array.from(element.getElementsByTagName("*")).filter((candidate) => {
      if (selector === "*") {
        return true;
      }
      if (selector.startsWith("#")) {
        return candidate.getAttribute("id") === selector.slice(1);
      }
      if (selector.startsWith(".")) {
        return (candidate.getAttribute("class") ?? "")
          .split(/\s+/)
          .includes(selector.slice(1));
      }
      return candidate.localName === selector;
    });
  }
  function enhance(element) {
    element.querySelectorAll = (selector) => descendants(element, selector);
    element.querySelector = (selector) =>
      element.querySelectorAll(selector)[0] ?? null;
    element.addEventListener = () => {};
    element.removeEventListener = () => {};
    element.remove = () => element.parentNode?.removeChild(element);
    element.contains = (candidate) =>
      candidate === element || descendants(element, "*").includes(candidate);
    element.getBBox = () => ({ x: 0, y: 0, width: 50, height: 14 });
    Object.defineProperty(element, "childElementCount", {
      get: () =>
        Array.from(element.childNodes).filter((node) => node.nodeType === 1)
          .length,
    });
    Object.defineProperty(element, "offsetWidth", {
      get: () => element.textContent.length * 7,
    });
    const properties = new Map();
    element.style = {
      setProperty: (name, value) => properties.set(name, value),
      getPropertyValue: (name) => properties.get(name) ?? "",
      removeProperty: (name) => properties.delete(name),
    };
    return element;
  }
  const createElementNS = document.createElementNS.bind(document);
  document.createElementNS = (...args) => enhance(createElementNS(...args));
  document.createElement = (name) =>
    document.createElementNS("http://www.w3.org/1999/xhtml", name);
  enhance(document.documentElement);
  document.body = document.documentElement;
  document.querySelectorAll = (selector) =>
    descendants(document.documentElement, selector);
  document.querySelector = (selector) =>
    document.querySelectorAll(selector)[0] ?? null;
  const window = {
    getComputedStyle: () => ({
      getPropertyValue: (name) => (name === "font-size" ? "12px" : ""),
    }),
  };
  document.defaultView = window;
  const behaviours = [];
  const moduleGlobals = runInThisContext("globalThis");
  const suppliedGlobals = {
    document,
    window,
    d3: {
      ...d3,
      zoom: () =>
        d3.zoom().extent([
          [0, 0],
          [800, 600],
        ]),
      selectAll: (selector) =>
        d3.selectAll(
          typeof selector === "string"
            ? document.querySelectorAll(selector)
            : selector,
        ),
      drag: () => {
        const behaviour = d3.drag();
        behaviours.push(behaviour);
        return behaviour;
      },
    },
  };
  const originalGlobals = new Map(
    Object.keys(suppliedGlobals).map((name) => [
      name,
      Object.getOwnPropertyDescriptor(moduleGlobals, name),
    ]),
  );
  Object.assign(moduleGlobals, suppliedGlobals);
  let graph;
  const dispose = () => {
    graph?.dispose();
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) {
        Object.defineProperty(moduleGlobals, name, descriptor);
      } else {
        delete moduleGlobals[name];
      }
    }
  };
  try {
    graph = createRenderedGraphInternals(document.documentElement, {
      widthPx: 800,
      heightPx: 600,
    });
    graph.options().data(structuredClone(model));
    graph.load(1, { isPaused: true, centerViewport: false });
    graph.editorMode(true);
    return { graph, document, drag: behaviours.at(-1), dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

const MODEL = {
  header: { iri: "https://example.test/" },
  class: [{ id: "a", type: "owl:Class" }],
  classAttribute: [
    { id: "a", label: "A", iri: "https://example.test/A", pos: [30, 40] },
  ],
};

test("draws the bundled MUTO document on an uncached native mount", () => {
  const model = JSON.parse(
    readFileSync(
      new URL("../../../app/data/muto.json", import.meta.url),
      "utf8",
    ),
  );
  const { graph, dispose } = mountGraph(model);
  try {
    expect(graph.readVisibleElementIds().nodeIds.length).toBeGreaterThan(0);
    expect(graph.isReadyForPaint()).toBe(true);
  } finally {
    dispose();
  }
});

test("accepts records emitted by the native datatype plus on the first editor mount", () => {
  const { graph, document, dispose } = mountGraph(MODEL);
  try {
    const creations = [];
    graph.setRenderedGraphEventPort({
      publishRecordCreation: (payload) =>
        creations.push(createVowlDocumentInsertionRecords(payload.records)),
    });
    graph.activateHoverElements(true, graph.getUnfilteredData().nodes[0]);
    const circle = document.querySelector(".addDataPropertyElement").firstChild;
    d3.select(circle).on("click").call(circle, { stopPropagation: jest.fn() });
    expect(creations).toHaveLength(1);
    expect(creations[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: "property",
          type: "owl:DatatypeProperty",
          domain: "a",
        }),
      ]),
    );
  } finally {
    dispose();
  }
});

test("keeps both editor circles attached while dragging a paused class", () => {
  const { graph, document, drag, dispose } = mountGraph(MODEL);
  try {
    const node = graph.getUnfilteredData().nodes[0];
    const nodeElement = graph.graphNodeElements().node();
    graph.activateHoverElements(true, node);
    const add = document.querySelector(".addDataPropertyElement");
    const remove = document.querySelector(".deleteParentElement");
    const initialTransforms = [add, remove].map((element) =>
      element.getAttribute("transform"),
    );
    drag
      .on("start")
      .call(nodeElement, { sourceEvent: { stopPropagation: jest.fn() } }, node);
    drag.on("drag").call(nodeElement, { x: 130, y: 240 }, node);
    expect(node.x).toBe(130);
    expect(node.y).toBe(240);
    for (const [index, element] of [add, remove].entries()) {
      const [x, y] = initialTransforms[index]
        .match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
      expect(element.getAttribute("transform")).toBe(
        `translate(${x + 100},${y + 200})`,
      );
    }
  } finally {
    dispose();
  }
});

test("draws an in-place document revision without replacing the viewport or starting initial loading", () => {
  const { graph, document, dispose } = mountGraph(MODEL);
  try {
    graph.setViewportTransform(0.5, [12, -20]);
    const svg = document.querySelector("svg");
    const drawing = svg.firstChild;
    const publishRenderProgress = jest.fn();
    graph.setRenderedGraphEventPort({ publishRenderProgress });
    graph.applyVowlModelRevision(
      structuredClone({
        ...MODEL,
        class: [...MODEL.class, { id: "thing", type: "owl:Thing" }],
        classAttribute: [
          ...MODEL.classAttribute,
          {
            id: "thing",
            iri: "http://www.w3.org/2002/07/owl#Thing",
            label: "Thing",
            pos: [300, 220],
          },
        ],
      }),
    );
    expect(document.querySelector("svg")).toBe(svg);
    expect(svg.firstChild).toBe(drawing);
    expect(drawing.getAttribute("transform")).toBe(
      "translate(12,-20)scale(0.5)",
    );
    expect(graph.paused()).toBe(true);
    expect(graph.editorMode()).toBe(true);
    expect(graph.readVisibleElementIds().nodeIds).toEqual(["a", "thing"]);
    expect(graph.getUnfilteredData().nodes.map(({ x, y }) => [x, y])).toEqual([
      [30, 40],
      [300, 220],
    ]);
    expect(publishRenderProgress).not.toHaveBeenCalled();
  } finally {
    dispose();
  }
});

test("expires inline label submissions when their rendered document is revised", () => {
  const { graph, dispose } = mountGraph(MODEL);
  try {
    const previousEpoch = graph.currentRenderInteractionEpoch();
    const publishRecordLabelEdit = jest.fn();
    graph.setRenderedGraphEventPort({ publishRecordLabelEdit });
    graph.applyVowlModelRevision(structuredClone(MODEL));
    expect(
      graph.requestRecordLabelEdit("a", "Obsolete label", false, previousEpoch),
    ).toBe(false);
    expect(publishRecordLabelEdit).not.toHaveBeenCalled();
    graph.requestRecordLabelEdit(
      "a",
      "Current label",
      false,
      graph.currentRenderInteractionEpoch(),
    );
    expect(publishRecordLabelEdit).toHaveBeenCalledWith(
      "a",
      "Current label",
      false,
    );
  } finally {
    dispose();
  }
});

test("retains revised loop label positions instead of overwriting them from the old simulation", () => {
  const model = {
    ...MODEL,
    property: [{ id: "p", type: "owl:ObjectProperty" }],
    propertyAttribute: [
      { id: "p", domain: "a", range: "a", label: "loop", pos: [110, 190] },
    ],
  };
  const { graph, dispose } = mountGraph(model);
  try {
    graph.applyVowlModelRevision(
      structuredClone({
        ...model,
        propertyAttribute: [{ ...model.propertyAttribute[0], pos: [0, -150] }],
      }),
    );
    const label = graph.graphLabelElements()[0];
    expect([label.x, label.y]).toEqual([0, -150]);
  } finally {
    dispose();
  }
});
