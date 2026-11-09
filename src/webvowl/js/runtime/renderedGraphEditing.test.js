import * as d3 from "d3";
import { createLegacyForceSimulation } from "./legacyForceSimulation.js";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import { beforeAll, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { canonicalControllerHarness } from "../../../app/test/canonicalControllerHarness.js";
import { createCanonicalDrawingRequest } from "../../../app/js/controller/renderedGraphRuntimeContracts.js";
import { createMath } from "../../../shared/js/util/math.js";

const createdDragBehaviours = [];
const createdSimulations = [];
jest.unstable_mockModule("d3", () => ({
  ...d3,
  drag: () => {
    const behaviour = d3.drag();
    createdDragBehaviours.push(behaviour);
    return behaviour;
  },
}));

jest.unstable_mockModule("./legacyForceSimulation.js", () => ({
  createLegacyForceSimulation: (...args) => {
    const simulation = createLegacyForceSimulation(...args);
    createdSimulations.push(simulation);
    return simulation;
  },
}));

let createRenderedGraphInternals;
beforeAll(async () => {
  ({ createRenderedGraphInternals } =
    await import("./renderedGraphInternals.js"));
});

// Real D3, canonical constructors and SVG elements; only browser layout metrics and event
// installation are supplied here. The tests replay the installed drag callbacks.
function mountGraph(canonicalDrawing) {
  const metrics = { created: 0, widths: 0, boxes: 0 };
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
    // xmldom has no DOMTokenList. Model the browser's ASCII class tokens for
    // real D3 joins; native browser coverage owns SVG classList behavior.
    const classTokens = () =>
      new Set((element.getAttribute("class") ?? "").match(/[^\t\n\f\r ]+/gu));
    element.classList = {
      contains: (token) => classTokens().has(token),
      add(...tokens) {
        element.setAttribute(
          "class",
          [...new Set([...classTokens(), ...tokens])].join(" "),
        );
      },
      remove(...tokens) {
        element.setAttribute(
          "class",
          [...classTokens()]
            .filter((token) => !tokens.includes(token))
            .join(" "),
        );
      },
    };
    // Match DOM pre-insert's node === reference step; xmldom otherwise corrupts
    // its child list. See https://dom.spec.whatwg.org/#concept-node-pre-insert.
    const prototype = document.documentElement.constructor.prototype;
    const insertBefore = prototype.insertBefore.bind(element);
    element.insertBefore = (node, reference) =>
      insertBefore(node, reference === node ? node.nextSibling : reference);
    // Native clones copy markup, not expando methods bound to the source.
    // xmldom copies those methods while walking, which can mutate its source
    // through our insertBefore shim. Clone markup into fresh fixture elements.
    element.cloneNode = function (deep) {
      const clone = document.createElementNS(this.namespaceURI, this.nodeName);
      for (const attribute of this.attributes) {
        clone.setAttributeNS(
          attribute.namespaceURI,
          attribute.name,
          attribute.value,
        );
      }
      if (deep) {
        for (const child of this.childNodes) {
          clone.appendChild(child.cloneNode(true));
        }
      }
      return clone;
    };
    if (element.localName === "svg") {
      element.width = { baseVal: { value: 800 } };
      element.height = { baseVal: { value: 600 } };
    }
    element.querySelectorAll = (selector) => descendants(element, selector);
    element.querySelector = (selector) =>
      element.querySelectorAll(selector)[0] ?? null;
    element.addEventListener = jest.fn();
    element.removeEventListener = () => {};
    element.remove = () => element.parentNode?.removeChild(element);
    element.contains = (candidate) =>
      candidate === element || descendants(element, "*").includes(candidate);
    element.getBBox = () => {
      metrics.boxes++;
      return { x: 0, y: 0, width: 50, height: 14 };
    };
    Object.defineProperty(element, "childElementCount", {
      get: () =>
        Array.from(element.childNodes).filter((node) => node.nodeType === 1)
          .length,
    });
    Object.defineProperty(element, "offsetWidth", {
      get: () => {
        metrics.widths++;
        return element.textContent.length * 7;
      },
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
  document.createElementNS = (...args) => {
    metrics.created++;
    return enhance(createElementNS(...args));
  };
  document.createElement = (name) =>
    document.createElementNS("http://www.w3.org/1999/xhtml", name);
  enhance(document.documentElement);
  document.body = document.documentElement;
  document.querySelectorAll = (selector) =>
    descendants(document.documentElement, selector);
  document.querySelector = (selector) =>
    document.querySelectorAll(selector)[0] ?? null;
  const window = {
    document,
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({
      getPropertyValue: (name) => (name === "font-size" ? "12px" : ""),
    }),
  };
  document.defaultView = window;
  createdDragBehaviours.length = 0;
  const moduleGlobals = globalThis;
  const suppliedGlobals = {
    document,
    SVGElement: document.documentElement.constructor,
    window,
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
    if (canonicalDrawing !== undefined) {
      graph.load(1, {
        canonicalDrawing: structuredClone(canonicalDrawing),
        isPaused: true,
      });
    }
    graph.editorMode(true);
    return {
      graph,
      document,
      metrics,
      drag: createdDragBehaviours.at(-1),
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

test("real renderer tick and end status do not request coordinate snapshots", () => {
  const { graph, dispose } = mountCanonicalGraph();
  try {
    const simulation = createdSimulations.at(-1);
    const events = [];
    graph.setRenderedGraphEventPort({
      publishGraphLayoutState: (generation, payload) =>
        events.push({ generation, payload }),
    });
    const before = graph.readLayoutState();
    graph.readLayoutState = jest.fn(() => {
      throw new Error("unexpected full snapshot");
    });
    simulation.alpha(0.02);
    simulation.on("tick.runtimeLayout")();
    simulation.alpha(0);
    simulation.on("end.runtimeLayout")();
    expect(events).toEqual([
      {
        generation: 1,
        payload: { forceAlpha: 0.02, hasEnded: false, isPaused: true },
      },
      {
        generation: 1,
        payload: { forceAlpha: 0, hasEnded: true, isPaused: true },
      },
    ]);
    expect(graph.readLayoutState).not.toHaveBeenCalled();
    expect(before.layoutElementPositions).toEqual([
      { stableLayoutElementKey: "node:a", x: 30, y: 40 },
    ]);
  } finally {
    dispose();
  }
});

// Independently authored occurrence rows; no legacy model or migration supplies these expectations.
const CANONICAL_DRAWING = {
  nodes: [
    {
      occurrence: "a",
      targets: ["record:a"],
      principal: {
        record: "record:a",
        kind: "class",
        iri: "https://example.test/A",
        name: "A",
        externalStyle: false,
      },
      aliases: [],
      position: { x: 30, y: 40 },
      pinned: true,
      radiusFactor: 1,
      hidden: false,
    },
  ],
  edges: [],
  labels: [],
  display: {
    compactNotation: false,
    externalColoring: true,
    nodeScaling: "uniform",
  },
  camera: { center: { x: 400, y: 300 }, zoom: 1 },
};
function mountCanonicalGraph(drawing = CANONICAL_DRAWING) {
  return mountGraph(drawing);
}

test.each(["paused", "running", "settled"])(
  "viewport notifications preserve the %s simulation and arrangement",
  (mode) => {
    const h = mountCanonicalGraph();
    try {
      h.graph.setRenderedGraphEventPort({ publishGraphLayoutState: jest.fn() });
      h.graph.editorMode(false);
      const drawing = structuredClone(CANONICAL_DRAWING);
      drawing.nodes[0].pinned = false;
      h.graph.load(1, {
        canonicalDrawing: drawing,
        isPaused: mode === "paused",
      });
      const simulation = createdSimulations.at(-1);
      if (mode === "settled") {
        simulation.alpha(0);
      }
      const snapshot = h.graph.readLayoutState();
      const before = {
        forceAlpha: snapshot.forceAlpha,
        hasEnded: snapshot.hasEnded,
        isPaused: snapshot.isPaused,
        layoutElementPositions: snapshot.layoutElementPositions,
      };
      const start = jest.spyOn(simulation, "start");
      const stop = jest.spyOn(simulation, "stop");
      for (const widthPx of [800, 440, 800]) {
        h.graph.resizeViewport({
          widthPx,
          heightPx: 600,
          occludedLeftWidthPx: 0,
          isTouchDevice: false,
        });
        expect(h.graph.readLayoutState()).toEqual(
          expect.objectContaining({ ...before, widthPx, heightPx: 600 }),
        );
        expect(simulation.size()).toEqual([widthPx, 600]);
        expect(h.document.querySelector("svg").getAttribute("width")).toBe(
          String(widthPx),
        );
      }
      expect(start).not.toHaveBeenCalled();
      expect(stop).not.toHaveBeenCalled();
      if (mode !== "running") {
        d3.timerFlush();
        expect(h.graph.readLayoutState()).toEqual(
          expect.objectContaining(before),
        );
      }
    } finally {
      h.dispose();
    }
  },
);

test("a fresh running drawing keeps its prepared geometry until initial paint", () => {
  const h = mountCanonicalGraph();
  try {
    h.graph.setRenderedGraphEventPort({ publishGraphLayoutState: jest.fn() });
    h.graph.editorMode(false);
    const drawing = structuredClone(CANONICAL_DRAWING);
    drawing.nodes[0].pinned = false;
    const completeInitialPaint = h.graph.load(1, {
      canonicalDrawing: drawing,
      isPaused: false,
      prepareInitialDrawing: true,
    });
    const before = h.graph.readLayoutState().layoutElementPositions;
    d3.timerFlush();
    expect(h.graph.readLayoutState().layoutElementPositions).toEqual(before);
    expect(h.graph.readLayoutState().isPaused).toBe(false);
    expect(h.graph.readLayoutState().hasEnded).toBe(false);
    completeInitialPaint();
    d3.timerFlush();
    expect(h.graph.readLayoutState().layoutElementPositions).not.toEqual(
      before,
    );
    const resume = jest.spyOn(createdSimulations.at(-1), "resume");
    completeInitialPaint();
    expect(resume).not.toHaveBeenCalled();
  } finally {
    h.dispose();
  }
});

test.each(["pause", "retire", "replace"])(
  "%s before initial paint prevents the old drawing from starting layout",
  (action) => {
    const h = mountCanonicalGraph();
    try {
      h.graph.editorMode(false);
      const drawing = structuredClone(CANONICAL_DRAWING);
      drawing.nodes[0].pinned = false;
      const completeInitialPaint = h.graph.load(1, {
        canonicalDrawing: drawing,
        isPaused: false,
        prepareInitialDrawing: true,
      });
      if (action === "pause") {
        h.graph.paused(true);
      }
      if (action === "retire") {
        h.graph.retireRenderGeneration();
      }
      if (action === "replace") {
        h.graph.load(2, {
          canonicalDrawing: structuredClone(CANONICAL_DRAWING),
          isPaused: true,
        });
      }
      const resume = jest.spyOn(createdSimulations.at(-1), "resume");
      completeInitialPaint();
      expect(resume).not.toHaveBeenCalled();
    } finally {
      h.dispose();
    }
  },
);

test("fresh placement leaves the requested class distance outside actual glyph radii", () => {
  const h = mountCanonicalGraph();
  try {
    const drawing = structuredClone(CANONICAL_DRAWING);
    drawing.nodes[0].pinned = false;
    drawing.nodes.push({
      ...structuredClone(drawing.nodes[0]),
      occurrence: "b",
      targets: ["record:b"],
      principal: {
        ...drawing.nodes[0].principal,
        record: "record:b",
        name: "B",
      },
      position: { x: 130, y: 40 },
    });
    h.graph.setForceLayoutDistances({ classDistancePx: 200 });
    h.graph.load(2, {
      canonicalDrawing: drawing,
      isPaused: true,
      prepareInitialDrawing: true,
    });
    const [a, b] = h.graph.readLayoutState().layoutElementPositions;
    expect(Math.hypot(a.x - b.x, a.y - b.y) - 50 - 50).toBeGreaterThanOrEqual(
      200,
    );
  } finally {
    h.dispose();
  }
});

test("owned drawing admission survives runtime changes without another full copy", () => {
  const source = reuseDrawing();
  const admitted = createCanonicalDrawingRequest({
    loadGeneration: 1,
    documentRevision: 0,
    layout: "pause",
    drawing: source,
  });
  const h = mountGraph();
  const clone = jest.spyOn(globalThis, "structuredClone");
  const drawingCopies = () =>
    clone.mock.calls.filter(
      ([value]) => value?.camera && Array.isArray(value.nodes),
    );
  try {
    h.graph.load(1, { canonicalDrawing: admitted.drawing, isPaused: true });
    expect(drawingCopies()).toHaveLength(0);
    source.nodes[0].position.x = 9999;
    source.labels[0].name = "caller mutation";
    expect(admitted.drawing.nodes[0].position.x).toBe(30);
    expect(h.graph.readCanonicalDrawingState().placements).toContainEqual({
      occurrence: "a",
      position: { x: 30, y: 40 },
      pinned: true,
    });

    const revision = createCanonicalDrawingRequest(
      {
        loadGeneration: 1,
        documentRevision: 0,
        baseRevision: 0,
        drawing: withoutOccurrences(admitted.drawing, ["c"]),
      },
      { revision: true },
    );
    clone.mockClear();
    h.graph.applyCanonicalDrawingRevision(revision.drawing, {
      sameRevision: true,
    });
    expect(drawingCopies()).toHaveLength(0);
    h.graph.applyArrangement([
      { rendererKey: "node:a", xPx: 75, yPx: -90, isPinned: true },
    ]);
    expect(revision.drawing.nodes[0].position).toEqual({ x: 30, y: 40 });
    const previous = h.graph.readCanonicalDrawingState();
    const transform = jest
      .spyOn(h.graph, "setViewportTransform")
      .mockImplementationOnce(() => {
        throw new Error("owned drawing publication failed");
      });
    clone.mockClear();
    expect(() =>
      h.graph.applyCanonicalDrawingRevision(admitted.drawing, {
        sameRevision: true,
      }),
    ).toThrow("owned drawing publication failed");
    expect(drawingCopies()).toHaveLength(1);
    expect(h.graph.readCanonicalDrawingState()).toEqual(previous);
    expect(revision.drawing.nodes[0].position).toEqual({ x: 30, y: 40 });
    transform.mockRestore();
  } finally {
    clone.mockRestore();
    h.dispose();
  }
});

test("a visibility-only revision retains unaffected primitives, DOM and force references", () => {
  const drawing = {
    ...CANONICAL_DRAWING,
    nodes: ["a", "b"].map((id, index) => ({
      ...CANONICAL_DRAWING.nodes[0],
      occurrence: id,
      targets: [id],
      principal: {
        ...CANONICAL_DRAWING.nodes[0].principal,
        record: id,
        iri: `urn:${id}`,
        name: id,
      },
      position: { x: 30 + index * 200, y: 40 },
    })),
  };
  const { graph, document, dispose } = mountCanonicalGraph(drawing);
  try {
    const node = graph.getUnfilteredData().nodes[0];
    const dom = document.querySelector("#a");
    const text = dom.querySelector("text");
    const next = structuredClone(drawing);
    next.nodes[1].hidden = true;
    graph.applyCanonicalDrawingRevision(next, { sameRevision: true });
    expect(graph.getUnfilteredData().nodes).toEqual([node]);
    expect(graph.getUnfilteredData().nodes[0]).toBe(node);
    expect(document.querySelector("#a")).toBe(dom);
    expect(dom.querySelector("text")).toBe(text);
    expect(document.querySelector("#b")).toBeNull();
    expect(createdSimulations.at(-1).nodes()).toEqual([node]);
  } finally {
    dispose();
  }
});

function reuseDrawing() {
  const nodes = ["a", "b", "c"].map((id, index) => ({
    ...CANONICAL_DRAWING.nodes[0],
    occurrence: id,
    targets: [id],
    pinned: index === 0,
    principal: {
      ...CANONICAL_DRAWING.nodes[0].principal,
      record: id,
      iri: `urn:${id}`,
      name: id,
    },
    position: { x: 30 + index * 200, y: 40 + index * 20 },
  }));
  const pairs = [
    ["ab", "a", "b"],
    ["parallel", "b", "a"],
    ["loop", "b", "b"],
    ["bc", "b", "c"],
  ];
  return {
    ...CANONICAL_DRAWING,
    nodes,
    edges: pairs.map(([id, from, to]) => ({
      occurrence: id,
      from,
      to,
      kind: "object-edge",
      records: [id],
      hidden: false,
    })),
    labels: pairs.map(([id], index) => ({
      occurrence: `label:${id}`,
      edge: id,
      direction: "forward",
      records: [id],
      principal: {
        record: id,
        kind: "object-property",
        iri: `urn:${id}`,
        name: id,
        externalStyle: false,
      },
      name: id,
      aliases: [],
      characteristics: [],
      cardinality: index === 0 ? "1..*" : undefined,
      position: { x: 70 + index * 71, y: -50 + index * 33 },
      pinned: false,
      hidden: false,
    })),
  };
}
function withoutOccurrences(drawing, ids) {
  const next = structuredClone(drawing);
  for (const row of [...next.nodes, ...next.edges, ...next.labels]) {
    row.hidden =
      ids.includes(row.occurrence) ||
      ids.includes(row.edge) ||
      ids.includes(row.from) ||
      ids.includes(row.to);
  }
  return next;
}

const LEGACY_PROPERTY_CASES = [
  ["object property", "property-edge", "object-property", "class"],
  ["datatype property", "property-edge", "data-property", "datatype"],
  ["RDF property", "property-edge", "rdf-property", "class"],
  ["subclass", "subclass-edge", "object-property", "class"],
  ["restriction", "restriction-edge", "object-property", "class"],
  ["disjointness", "disjoint-edge", "object-property", "class"],
  ["set operator", "operator-edge", "object-property", "class"],
];

function legacyPropertyDrawing(edgeKind, propertyKind, rangeKind = "class") {
  const drawing = reuseDrawing();
  drawing.nodes = drawing.nodes.slice(0, 2);
  drawing.nodes[1].principal.kind = rangeKind;
  if (rangeKind === "datatype") {
    drawing.nodes[1].principal.iri = "http://www.w3.org/2001/XMLSchema#string";
    delete drawing.nodes[1].radiusFactor;
  }
  drawing.edges = [{ ...drawing.edges[0], kind: edgeKind }];
  drawing.labels = [
    {
      ...drawing.labels[0],
      principal: { ...drawing.labels[0].principal, kind: propertyKind },
    },
  ];
  return drawing;
}

function dragPrimitive(h, primitive, dx, dy) {
  const element = primitive.property
    ? h.document
        .querySelectorAll(".labelGroup")
        .find((group) => group.__data__ === primitive)
    : h.graph
        .graphNodeElements()
        .nodes()
        .find((group) => group.__data__ === primitive);
  const initial = { x: primitive.x, y: primitive.y };
  const event = (type, x = 0, y = 0) => ({
    identifier: "mouse",
    button: 0,
    x: initial.x + x,
    y: initial.y + y,
    sourceEvent: {
      type,
      clientX: 100 + x,
      clientY: 100 + y,
      view: h.document.defaultView,
      stopPropagation() {},
    },
  });
  if (!h.drag.filter().call(element, event("mousedown"), primitive)) {
    return false;
  }
  h.drag.on("start").call(element, event("mousedown"), primitive);
  h.drag.on("drag").call(element, event("mousemove", dx, dy), primitive);
  h.drag.on("end").call(element, event("mouseup", dx, dy), primitive);
  return primitive.x !== initial.x || primitive.y !== initial.y;
}

function expectLegacyMidpoint(label) {
  // WebVOWL 1.1.7 graph.js: single-layer, non-loop links use the midpoint
  // between the endpoint borders. This oracle does not call the runtime's eligibility helper.
  const math = createMath();
  const link = label.link();
  const a = math.calculateIntersection(link.range(), link.domain(), 0);
  const b = math.calculateIntersection(link.domain(), link.range(), 0);
  expect(label.x).toBeCloseTo((a.x + b.x) / 2, 8);
  expect(label.y).toBeCloseTo((a.y + b.y) / 2, 8);
  expect(link.pathObj().node().getAttribute("d")).toMatch(/^M[^ ]+ L[^ ]+$/);
}

function inversePropertyDrawing() {
  const drawing = legacyPropertyDrawing("inverse-edge", "object-property");
  drawing.labels.push({
    ...drawing.labels[0],
    occurrence: "reverse",
    direction: "reverse",
    position: { x: 9, y: 200 },
    name: "reverse",
    principal: {
      ...drawing.labels[0].principal,
      record: "reverse",
      iri: "urn:reverse",
    },
    records: ["reverse"],
  });
  return drawing;
}

test.each(
  LEGACY_PROPERTY_CASES.flatMap((entry) =>
    [false, true].flatMap((editor) =>
      [false, true].map((paused) => [...entry, editor, paused]),
    ),
  ),
)(
  "legacy 1.1.7 single %s routing (edge=%s, property=%s, range=%s, editor=%s, paused=%s)",
  (_name, edgeKind, propertyKind, rangeKind, editor, paused) => {
    const h = mountCanonicalGraph(
      legacyPropertyDrawing(edgeKind, propertyKind, rangeKind),
    );
    try {
      h.graph.setRenderedGraphEventPort({ publishGraphLayoutState() {} });
      h.graph.editorMode(editor);
      h.graph.paused(paused);
      const simulation = createdSimulations.at(-1);
      simulation.stop();
      const label = h.graph.graphLabelElements()[0];
      expectLegacyMidpoint(label);
      const group = h.document.querySelectorAll(".labelGroup")[0];
      expect(h.drag.filter().call(group, { button: 0 }, label)).toBe(true);
      const alpha = simulation.alpha();
      const camera = h.graph.readCanonicalDrawingState().camera;
      expect(dragPrimitive(h, label, 40, 90)).toBe(false);
      expect(simulation.alpha()).toBe(alpha);
      expect(h.graph.readCanonicalDrawingState().camera).toEqual(camera);
      expectLegacyMidpoint(label);
      const range = label.link().range();
      const initial = { x: range.x, y: range.y };
      expect(dragPrimitive(h, range, 40, 90)).toBe(true);
      expect(range.x).toBeCloseTo(initial.x + 40, 8);
      expect(range.y).toBeCloseTo(initial.y + 90, 8);
      if (!paused) {
        simulation.tick();
        simulation.stop();
      }
      expectLegacyMidpoint(label);
      expect(h.graph.paused()).toBe(paused);
      const arrangement = h.graph.readArrangement();
      expect(
        arrangement.find((row) => row.kind === "property-label"),
      ).toMatchObject({ canMove: false, canPin: false });
      const before = h.graph.readCanonicalDrawingState();
      expect(() =>
        h.graph.applyArrangement([
          { rendererKey: arrangement[0].rendererKey, xPx: 999, yPx: 888 },
          {
            rendererKey: arrangement.find(
              (row) => row.kind === "property-label",
            ).rendererKey,
            xPx: 333,
            yPx: 222,
          },
        ]),
      ).toThrow("cannot accept");
      expect(h.graph.readCanonicalDrawingState()).toEqual(before);
    } finally {
      h.dispose();
    }
  },
);

test("legacy 1.1.7 inverse properties share one straight connection and a stacked label group", () => {
  const drawing = inversePropertyDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const labels = h.graph.graphLabelElements();
    expect(labels).toHaveLength(1);
    expect(createdSimulations.at(-1).nodes()).toHaveLength(3);
    expect(createdSimulations.at(-1).links()).toHaveLength(2);
    expect(h.document.querySelectorAll(".labelGroup")).toHaveLength(1);
    expect(labels[0].inverse()).toBeDefined();
    const path = labels[0].link().pathObj().node();
    expect(path.getAttribute("marker-start")).toContain("reverse");
    expect(path.getAttribute("marker-end")).toContain(
      drawing.labels[0].occurrence,
    );
    expect(labels[0].property().labelElement().attr("transform")).toBe(
      "translate(0,-15)",
    );
    expect(labels[0].inverse().labelElement().attr("transform")).toBe(
      "translate(0,15)",
    );
    expectLegacyMidpoint(labels[0]);
    const placements = h.graph.readCanonicalDrawingState().placements;
    expect(placements.map((row) => row.occurrence)).toEqual(
      expect.arrayContaining([drawing.labels[0].occurrence, "reverse"]),
    );
    expect(
      placements.find((row) => row.occurrence === "reverse").position,
    ).toEqual(
      placements.find((row) => row.occurrence === drawing.labels[0].occurrence)
        .position,
    );
  } finally {
    h.dispose();
  }
});

test.each([
  [false, false],
  [false, true],
  [true, false],
  [true, true],
])(
  "inverse visibility stays correct through retained revisions (hidden=%s,%s)",
  (primaryHidden, inverseHidden) => {
    const drawing = inversePropertyDrawing();
    const h = mountCanonicalGraph(drawing);
    try {
      const before = h.graph.graphLabelElements()[0];
      drawing.labels[0].hidden = primaryHidden;
      drawing.labels[1].hidden = inverseHidden;
      h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
      expect(h.graph.graphLabelElements()[0]).toBe(before);
      expect(
        h.document
          .querySelectorAll(".label")
          .map((element) => element.__data__.id()),
      ).toEqual(
        drawing.labels
          .filter((row) => !row.hidden)
          .map((row) => row.occurrence),
      );
      expect(h.document.querySelectorAll(".labelGroup")).toHaveLength(
        primaryHidden && inverseHidden ? 0 : 1,
      );
      if (!primaryHidden || !inverseHidden) {
        expectLegacyMidpoint(before);
      }
      drawing.labels.forEach((row) => {
        row.hidden = false;
      });
      h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
      expect(h.document.querySelectorAll(".label")).toHaveLength(2);
      expectLegacyMidpoint(before);
      expect(h.graph.readCanonicalDrawingState().placements).toHaveLength(4);
    } finally {
      h.dispose();
    }
  },
);

test("legacy parallel labels and loops retain their curved routes and native drag permissions", () => {
  const h = mountCanonicalGraph(reuseDrawing());
  try {
    const labels = h.graph.graphLabelElements();
    for (const id of ["label:ab", "label:parallel", "label:loop"]) {
      const label = labels.find((item) => item.property().id() === id);
      const before = { x: label.x, y: label.y };
      expect(dragPrimitive(h, label, 40, 90)).toBe(true);
      expect(label.x).toBeCloseTo(before.x + 40, 8);
      expect(label.y).toBeCloseTo(before.y + 90, 8);
      expect(label.link().pathObj().node().getAttribute("d")).toMatch(/[QC]/);
      expect(
        h.graph
          .readArrangement()
          .find((row) => row.rendererKey === `label:${id}`),
      ).toMatchObject({ canMove: true, canPin: true });
    }
    expectLegacyMidpoint(
      labels.find((item) => item.property().id() === "label:bc"),
    );
  } finally {
    h.dispose();
  }
});

test("a connection switches between parallel routing and a constrained midpoint without stale drag authority", () => {
  const drawing = reuseDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const label = h.graph
      .graphLabelElements()
      .find((item) => item.property().id() === "label:ab");
    expect(dragPrimitive(h, label, 10, 20)).toBe(true);
    h.graph.applyCanonicalDrawingRevision(
      withoutOccurrences(drawing, ["parallel"]),
      { sameRevision: true },
    );
    expect(
      h.graph
        .graphLabelElements()
        .find((item) => item.property().id() === "label:ab"),
    ).toBe(label);
    expectLegacyMidpoint(label);
    expect(
      dragPrimitive(
        { ...h, drag: createdDragBehaviours.at(-1) },
        label,
        10,
        20,
      ),
    ).toBe(false);
    h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
    expect(
      dragPrimitive(
        { ...h, drag: createdDragBehaviours.at(-1) },
        label,
        10,
        20,
      ),
    ).toBe(true);
    expect(label.link().pathObj().node().getAttribute("d")).toMatch(/Q/);
  } finally {
    h.dispose();
  }
});

test.each(["isolated", "incident edge", "second loop"])(
  "self-loop arrangement pinning agrees with native 1.1.7 eligibility (%s)",
  (topology) => {
    const drawing = reuseDrawing();
    drawing.nodes = drawing.nodes.filter(
      (row) =>
        row.occurrence === "b" ||
        (topology === "incident edge" && row.occurrence === "a"),
    );
    drawing.edges = drawing.edges.filter(
      (row) =>
        row.occurrence === "loop" ||
        (topology === "incident edge" && row.occurrence === "ab"),
    );
    drawing.labels = drawing.labels.filter((row) =>
      drawing.edges.some((edge) => edge.occurrence === row.edge),
    );
    if (topology === "second loop") {
      drawing.edges.push({ ...drawing.edges[0], occurrence: "second loop" });
      drawing.labels.push({
        ...drawing.labels[0],
        occurrence: "second loop label",
        edge: "second loop",
      });
    }
    const h = mountCanonicalGraph(drawing);
    try {
      const property = h.graph
        .graphLabelElements()
        .find((label) => label.property().id() === "label:loop")
        .property();
      const arrangement = h.graph
        .readArrangement()
        .find((row) => row.rendererElementIds.includes(property.id()));
      const canPin = topology !== "isolated";
      expect(arrangement).toMatchObject({ canMove: true, canPin });
      const native = h.graph.options().pickAndPinModule();
      native.enabled(true);
      native.handle(undefined, property, true);
      expect(property.pinned()).toBe(canPin);
      h.graph.applyArrangement([
        { rendererKey: arrangement.rendererKey, isPinned: false },
      ]);
      const pin = () =>
        h.graph.applyArrangement([
          { rendererKey: arrangement.rendererKey, isPinned: true },
        ]);
      if (canPin) {
        expect(pin).not.toThrow();
        expect(property.pinned()).toBe(true);
      } else {
        expect(pin).toThrow("cannot accept");
      }
    } finally {
      h.dispose();
    }
  },
);

test("inverse membership changes rebuild the pair without mutating retained primitives during preparation", () => {
  const drawing = inversePropertyDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const before = h.graph.graphLabelElements()[0];
    const inverse = before.inverse();
    const single = {
      ...drawing,
      edges: [{ ...drawing.edges[0], kind: "property-edge" }],
      labels: [drawing.labels[0]],
    };
    h.graph.applyCanonicalDrawingRevision(single, { sameRevision: true });
    const label = h.graph.graphLabelElements()[0];
    expect(label).not.toBe(before);
    expect(label.inverse()).toBeUndefined();
    expect(before.inverse()).toBe(inverse);
    expect(inverse.inverse()).toBe(before.property());
    expectLegacyMidpoint(label);
    h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
    expect(h.graph.graphLabelElements()).toHaveLength(1);
    expect(h.graph.graphLabelElements()[0].inverse().id()).toBe("reverse");
  } finally {
    h.dispose();
  }
});

test("saved inverse arrangements reopen with both identities at the shared legacy anchor", () => {
  const drawing = inversePropertyDrawing();
  let h = mountCanonicalGraph(drawing);
  try {
    const before = h.graph.readCanonicalDrawingState();
    for (const row of [...drawing.nodes, ...drawing.labels]) {
      const saved = before.placements.find(
        (placement) => placement.occurrence === row.occurrence,
      );
      row.position = saved.position;
      row.pinned = saved.pinned;
    }
    h.dispose();
    h = mountCanonicalGraph(drawing);
    expect(h.graph.readCanonicalDrawingState()).toEqual(before);
    expectLegacyMidpoint(h.graph.graphLabelElements()[0]);
  } finally {
    h.dispose();
  }
});

test("stacked inverse labels keep separate selection and highlight geometry", () => {
  const h = mountCanonicalGraph(inversePropertyDrawing());
  try {
    h.graph.editorMode(false);
    const selections = [];
    h.graph.setRenderedGraphEventPort({
      publishRenderedElementSelection: (ids) => selections.push(ids),
    });
    const label = h.graph.graphLabelElements()[0];
    for (const property of [label.property(), label.inverse()]) {
      const group = property.labelElement();
      group
        .on("click")
        .call(group.node(), { defaultPrevented: false }, property);
      expect(selections.at(-1)).toEqual([property.id()]);
      expect(property.focused()).toBe(true);
    }
    expect(label.property().focused()).toBe(false);
    const primaryGeometry = h.graph.readOccurrenceGeometry(
      label.property().id(),
    );
    const inverseGeometry = h.graph.readOccurrenceGeometry(
      label.inverse().id(),
    );
    expect(primaryGeometry.xPx).toBe(inverseGeometry.xPx);
    expect(inverseGeometry.yPx - primaryGeometry.yPx).toBe(
      30 * h.graph.scaleFactor(),
    );
  } finally {
    h.dispose();
  }
});

test("parallel inverse properties share one movable and pinnable arrangement", () => {
  const drawing = inversePropertyDrawing();
  drawing.edges.push({
    ...drawing.edges[0],
    occurrence: "parallel",
    kind: "property-edge",
  });
  drawing.labels.push({
    ...drawing.labels[0],
    occurrence: "parallel:label",
    edge: "parallel",
    position: { x: 150, y: 120 },
  });
  const h = mountCanonicalGraph(drawing);
  try {
    const arrangement = h.graph
      .readArrangement()
      .find((row) => row.rendererElementIds.includes("reverse"));
    expect(arrangement).toMatchObject({
      canMove: true,
      canPin: true,
      rendererElementIds: [drawing.labels[0].occurrence, "reverse"],
    });
    h.graph.applyArrangement([
      {
        rendererKey: arrangement.rendererKey,
        xPx: 160,
        yPx: -90,
        isPinned: true,
      },
    ]);
    for (const id of arrangement.rendererElementIds) {
      expect(
        h.graph
          .readCanonicalDrawingState()
          .placements.find((row) => row.occurrence === id),
      ).toMatchObject({ position: { x: 160, y: -90 }, pinned: true });
    }
    h.graph.applyArrangement([
      { rendererKey: arrangement.rendererKey, isPinned: false },
    ]);
    for (const id of arrangement.rendererElementIds) {
      expect(
        h.graph
          .readCanonicalDrawingState()
          .placements.find((row) => row.occurrence === id).pinned,
      ).toBe(false);
    }
  } finally {
    h.dispose();
  }
});

test.each(
  [false, true].flatMap((primaryHidden) =>
    [false, true].flatMap((inverseHidden) =>
      ["primary", "inverse", "both"].map((selected) => [
        primaryHidden,
        inverseHidden,
        selected,
      ]),
    ),
  ),
)(
  "public highlighting follows inverse semantic identities after retained visibility changes (hidden=%s,%s; selected=%s)",
  (primaryHidden, inverseHidden, selected) => {
    const drawing = inversePropertyDrawing();
    const h = mountCanonicalGraph(drawing);
    try {
      drawing.labels[0].hidden = primaryHidden;
      drawing.labels[1].hidden = inverseHidden;
      h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
      const label = h.graph.graphLabelElements()[0];
      const members = [label.property(), label.inverse()];
      const ids = (
        selected === "both"
          ? members
          : [members[selected === "primary" ? 0 : 1]]
      ).map((property) => property.id());
      expect(() => h.graph.highLightNodes(ids)).not.toThrow();
      for (const property of members) {
        const halo = property.getHalos()?.node();
        expect(Boolean(halo?.parentNode)).toBe(
          property.labelVisible() && ids.includes(property.id()),
        );
      }
      drawing.labels.forEach((row) => {
        row.hidden = false;
      });
      h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
      for (const property of members) {
        const halo = property.getHalos()?.node();
        expect(Boolean(halo?.parentNode)).toBe(ids.includes(property.id()));
      }
      h.graph.resetSearchHighlight();
      expect(h.document.querySelectorAll(".searchResultA")).toHaveLength(0);
    } finally {
      h.dispose();
    }
  },
);

test.each(
  [false, true].flatMap((primaryHidden) =>
    [false, true].flatMap((inverseHidden) =>
      [0, 1].map((pinnedIndex) => [primaryHidden, inverseHidden, pinnedIndex]),
    ),
  ),
)(
  "inverse pins belong to the shared label across visibility states (hidden=%s,%s; pinned member=%s)",
  (primaryHidden, inverseHidden, pinnedIndex) => {
    const drawing = inversePropertyDrawing();
    drawing.nodes.forEach((row) => {
      row.pinned = false;
    });
    drawing.edges.push({
      ...drawing.edges[0],
      occurrence: "parallel",
      kind: "property-edge",
    });
    drawing.labels.push({
      ...drawing.labels[0],
      occurrence: "parallel:label",
      edge: "parallel",
      position: { x: 150, y: 120 },
    });
    drawing.labels[0].hidden = primaryHidden;
    drawing.labels[1].hidden = inverseHidden;
    drawing.labels[pinnedIndex].pinned = true;
    const h = mountCanonicalGraph(drawing);
    try {
      const label = h.graph.graphLabelElements()[0];
      const arrangement = h.graph
        .readArrangement()
        .find((row) => row.rendererElementIds.includes("reverse"));
      expect(arrangement.isPinned).toBe(true);
      expect(label.property().pinned()).toBe(true);
      expect(label.inverse().pinned()).toBe(true);
      expect(h.document.querySelectorAll(".pin")).toHaveLength(
        primaryHidden && inverseHidden ? 0 : 1,
      );
      for (const property of [label.property(), label.inverse()]) {
        if (property.labelVisible()) {
          expect(() => property.drawHalo(false)).not.toThrow();
        }
      }
      h.graph.applyArrangement([
        { rendererKey: arrangement.rendererKey, isPinned: false },
      ]);
      expect(h.document.querySelectorAll(".pin")).toHaveLength(0);
      expect(label.property().pinned()).toBe(false);
      expect(label.inverse().pinned()).toBe(false);
    } finally {
      h.dispose();
    }
  },
);

test("joins retain delimiter-rich occurrence IDs and ignore nested and non-element children", () => {
  const drawing = reuseDrawing();
  const names = new Map([
    ["a", 'type:9:["quoted"]'],
    ["b", "type:9:colon:雪"],
    ["c", "type:09:colon:雪"],
  ]);
  for (const node of drawing.nodes) {
    node.occurrence = names.get(node.occurrence);
  }
  for (const edge of drawing.edges) {
    edge.from = names.get(edge.from);
    edge.to = names.get(edge.to);
  }
  const h = mountCanonicalGraph(drawing);
  try {
    const container = h.document.querySelector(".nodeContainer");
    const groups = Array.from(container.childNodes);
    expect(groups).toHaveLength(3);
    groups[0].setAttribute("class", " extra\t node\nother ");
    const nested = h.document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    nested.setAttribute("class", "node");
    groups[0].appendChild(nested);
    container.appendChild(h.document.createTextNode("ignored text"));
    h.graph.applyCanonicalDrawingRevision(structuredClone(drawing), {
      sameRevision: true,
    });
    const retained = Array.from(container.childNodes).filter(
      (node) => node.nodeType === 1,
    );
    expect(retained).toHaveLength(3);
    retained.forEach((group, index) => expect(group).toBe(groups[index]));
    expect(nested.parentNode).toBe(groups[0]);
    expect(retained.map((group) => d3.select(group).datum().id())).toEqual([
      'type:9:["quoted"]',
      "type:9:colon:雪",
      "type:09:colon:雪",
    ]);
  } finally {
    h.dispose();
  }
});
function rendererObservation(graph, document, simulation) {
  const links = [...new Set(simulation.links().map((part) => part.link()))];
  const serializer = new XMLSerializer();
  return {
    state: graph.readCanonicalDrawingState(),
    bindings: [...graph.readCanonicalDrawingBindings()],
    layers: links.map((link) => ({
      id: link.property().id(),
      layers: link.layers().map((item) => item.property().id()),
      index: link.layerIndex(),
      loops: link.loops()?.map((item) => item.property().id()),
      loopIndex: link.loopIndex(),
    })),
    points: simulation.nodes().map((node) => ({
      id: node.property ? node.property().id() : node.id(),
      x: node.x,
      y: node.y,
      px: node.px,
      py: node.py,
      fixed: node.fixed,
      weight: node.weight,
    })),
    svg: [
      "nodeContainer",
      "labelContainer",
      "cardinalityContainer",
      "linkContainer",
    ].map((name) =>
      serializer.serializeToString(document.querySelector(`.${name}`)),
    ),
  };
}

test.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  "batched drawing preserves projection and SVG in editor mode %s with invisible labels %s",
  (editor, invisibleLabels) => {
    const run = (batched) => {
      const drawing = reuseDrawing();
      if (invisibleLabels) {
        drawing.edges = drawing.edges
          .filter((edge) => edge.occurrence === "bc")
          .map((edge) => ({ ...edge, kind: "operator-edge" }));
        drawing.labels = [];
      }
      const h = mountCanonicalGraph(drawing);
      const simulation = createdSimulations.at(-1);
      const clock = jest.spyOn(performance, "now").mockReturnValue(0);
      let steps = 0;
      let drawings = 0;
      try {
        h.graph.setRenderedGraphEventPort({ publishGraphLayoutState() {} });
        h.graph.editorMode(editor);
        h.graph.paused(false);
        simulation.on("step.proof", () => steps++);
        simulation.on("tick.proof", () => {
          drawings++;
          if (batched) {
            simulation.stop();
          }
        });
        if (batched) {
          d3.timerFlush();
        } else {
          simulation.stop();
          if (invisibleLabels) {
            // Legacy drawing never projected labels without a rendered group.
            expect(h.document.querySelectorAll(".labelGroup")).toHaveLength(0);
            simulation.on("step", null);
          }
          for (let i = 0; i < 2; i++) {
            simulation.tick();
          }
        }
        expect(steps).toBe(2);
        expect(drawings).toBe(batched ? 1 : 2);
        return rendererObservation(h.graph, h.document, simulation);
      } finally {
        clock.mockRestore();
        h.dispose();
      }
    };
    expect(run(true)).toEqual(run(false));
  },
);

test.each(["paused", "running", "settled"])(
  "%s visibility changes agree with full rebuilding, including parallel links, loops and force ticks",
  (mode) => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0.37);
    const drawing = reuseDrawing();
    const next = withoutOccurrences(drawing, ["c", "parallel"]);
    function run(sameRevision) {
      const h = mountCanonicalGraph(drawing);
      try {
        h.graph.setRenderedGraphEventPort({ publishGraphLayoutState() {} });
        const simulation = createdSimulations.at(-1);
        if (mode !== "paused") {
          h.graph.paused(false);
        }
        simulation.stop();
        if (mode === "settled") {
          simulation.alpha(0);
        }
        const initialLabels = new Map(
          h.graph
            .graphLabelElements()
            .map((label) => [label.property().id(), label]),
        );
        Object.assign(h.metrics, { created: 0, widths: 0, boxes: 0 });
        h.graph.applyCanonicalDrawingRevision(next, { sameRevision });
        simulation.stop();
        const work = { ...h.metrics };
        if (sameRevision) {
          for (const label of h.graph.graphLabelElements()) {
            expect(label).toBe(initialLabels.get(label.property().id()));
            expect(label.link()).toBe(label.property().link());
            for (const part of label.link().linkParts()) {
              expect(simulation.nodes()).toContain(part.source);
              expect(simulation.nodes()).toContain(part.target);
            }
          }
        }
        const installed = rendererObservation(h.graph, h.document, simulation);
        if (mode !== "paused") {
          for (let index = 0; index < 8; index++) {
            simulation.tick();
          }
        }
        const advanced = rendererObservation(h.graph, h.document, simulation);
        h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision });
        simulation.stop();
        const restored = rendererObservation(h.graph, h.document, simulation);
        return { installed, advanced, restored, work };
      } finally {
        h.dispose();
      }
    }
    try {
      const reference = run(false);
      const reused = run(true);
      expect(reused.installed).toEqual(reference.installed);
      expect(reused.advanced).toEqual(reference.advanced);
      expect(reused.restored).toEqual(reference.restored);
      expect(reused.work.created).toBeLessThan(reference.work.created);
      expect(reused.work.widths).toBe(0);
      expect(reused.work.boxes).toBe(0);
    } finally {
      random.mockRestore();
    }
  },
);

test.each(["before", "enter", "update", "exit", "finish"])(
  "failure at %s recovers through full rebuilding",
  (phase) => {
    const drawing = reuseDrawing();
    const h = mountCanonicalGraph(drawing);
    try {
      const simulation = createdSimulations.at(-1);
      const expected = rendererObservation(h.graph, h.document, simulation);
      let next = withoutOccurrences(drawing, ["c"]);
      let spy;
      if (phase === "before") {
        next.camera.zoom = Infinity;
      }
      if (phase === "enter") {
        h.graph.applyCanonicalDrawingRevision(next, { sameRevision: true });
        // As at the adapter boundary, a later request owns a separate drawing.
        // The accepted drawing remains unchanged while recovery is exercised.
        next = structuredClone(drawing);
        const create = h.document.createElementNS;
        spy = jest
          .spyOn(h.document, "createElementNS")
          .mockImplementationOnce(() => {
            throw new Error("enter failed");
          });
        spy.mockImplementation((...args) => create(...args));
      }
      if (phase === "exit") {
        spy = jest
          .spyOn(h.document.querySelector("#c").parentNode, "removeChild")
          .mockImplementationOnce(() => {
            throw new Error("exit failed");
          });
      }
      if (phase === "update") {
        next.nodes[0].pinned = false;
        spy = jest
          .spyOn(h.graph.getUnfilteredData().nodes[0], "draw")
          .mockImplementationOnce(() => {
            throw new Error("update failed");
          });
      }
      if (phase === "finish") {
        spy = jest
          .spyOn(h.graph, "setViewportTransform")
          .mockImplementationOnce(() => {
            throw new Error("finish failed");
          });
      }
      const before = rendererObservation(h.graph, h.document, simulation);
      expect(() =>
        h.graph.applyCanonicalDrawingRevision(next, { sameRevision: true }),
      ).toThrow();
      expect(rendererObservation(h.graph, h.document, simulation)).toEqual(
        phase === "enter" ? before : expected,
      );
      spy?.mockRestore();
    } finally {
      h.dispose();
    }
  },
);

test("a reuse failure and failed full recovery preserve the runtime retirement signal", () => {
  const h = mountCanonicalGraph(reuseDrawing());
  try {
    const spy = jest
      .spyOn(h.graph, "setViewportTransform")
      .mockImplementation(() => {
        throw new Error("viewport unavailable");
      });
    expect(() =>
      h.graph.applyCanonicalDrawingRevision(
        withoutOccurrences(reuseDrawing(), ["c"]),
        { sameRevision: true },
      ),
    ).toThrow(
      expect.objectContaining({ code: "CANONICAL_DRAWING_RECOVERY_FAILED" }),
    );
    spy.mockRestore();
  } finally {
    h.dispose();
  }
});

test.each([
  "semantic revision",
  "label",
  "cardinality",
  "kind",
  "language",
  "notation",
])("%s leaves the bounded visibility reuse route", (change) => {
  const drawing = reuseDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const node = h.graph.getUnfilteredData().nodes[0];
    const dom = h.document.querySelector("#a");
    const next = structuredClone(drawing);
    if (change === "label") {
      next.labels[0].name = "New label";
    }
    if (change === "cardinality") {
      next.labels[0].cardinality = "3";
    }
    if (change === "kind") {
      next.nodes[0].principal.kind = "rdf-class";
    }
    if (change === "language") {
      next.labelSelection = { mode: "language", language: "de" };
    }
    if (change === "notation") {
      next.display.compactNotation = true;
    }
    h.graph.applyCanonicalDrawingRevision(next, {
      sameRevision: change !== "semantic revision",
    });
    expect(h.graph.getUnfilteredData().nodes[0]).not.toBe(node);
    expect(h.document.querySelector("#a")).not.toBe(dom);
    expect(h.graph.readCanonicalDrawingState().placements[0].position).toEqual(
      drawing.nodes[0].position,
    );
  } finally {
    h.dispose();
  }
});

test("adjacency-derived indications dirty their node and coherent links, while other text survives", () => {
  const drawing = reuseDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const old = new Map(
      h.graph.getUnfilteredData().nodes.map((node) => [node.id(), node]),
    );
    const text = h.document.querySelector("#a").querySelector("text");
    const next = structuredClone(drawing);
    next.nodes[1].additionalOperands = ["extra"];
    h.graph.applyCanonicalDrawingRevision(next, { sameRevision: true });
    const current = new Map(
      h.graph.getUnfilteredData().nodes.map((node) => [node.id(), node]),
    );
    expect(current.get("a")).toBe(old.get("a"));
    expect(current.get("b")).not.toBe(old.get("b"));
    expect(h.document.querySelector("#a").querySelector("text")).toBe(text);
    expect(h.document.querySelector("#b").textContent).toContain(
      "(additional...)",
    );
    expect(current.get("b").indications()).toContain(
      "additional operands in details",
    );
    for (const property of h.graph.getUnfilteredData().properties) {
      expect(property.domain()).toBe(current.get(property.domain().id()));
      expect(property.range()).toBe(current.get(property.range().id()));
      expect(property.link().property()).toBe(property);
    }
  } finally {
    h.dispose();
  }
});

test("drawing installs one hover binding per node, then refreshes retained nodes once", () => {
  const drawing = reuseDrawing();
  const h = mountCanonicalGraph(drawing);
  try {
    const bindings = (node) =>
      node.addEventListener.mock.calls.filter(([type]) => type === "mouseover")
        .length;
    const first = h.document.querySelector("#a");
    expect(bindings(first)).toBe(1);
    h.graph.applyCanonicalDrawingRevision(withoutOccurrences(drawing, ["c"]), {
      sameRevision: true,
    });
    expect(h.document.querySelector("#a")).toBe(first);
    expect(bindings(first)).toBe(2);
    h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
    expect(bindings(first)).toBe(3);
    expect(bindings(h.document.querySelector("#c"))).toBe(1);
  } finally {
    h.dispose();
  }
});

test("visibility reuse retains subclass stacking without moving already ordered labels", () => {
  const drawing = reuseDrawing();
  drawing.edges[0].kind = "subclass-edge";
  drawing.edges[2].kind = "subclass-edge";
  const h = mountCanonicalGraph(drawing);
  try {
    const container = h.document.querySelector(".labelContainer");
    const groups = () => Array.from(container.childNodes);
    const order = () =>
      groups().map((group) => d3.select(group).datum().property().id());
    expect(order()).toEqual([
      "label:loop",
      "label:ab",
      "label:parallel",
      "label:bc",
    ]);
    const retained = groups().slice(0, 3);
    const insert = jest.spyOn(container, "insertBefore");
    h.graph.applyCanonicalDrawingRevision(withoutOccurrences(drawing, ["c"]), {
      sameRevision: true,
    });
    expect(order()).toEqual(["label:loop", "label:ab", "label:parallel"]);
    groups().forEach((group, index) => expect(group).toBe(retained[index]));
    expect(insert).not.toHaveBeenCalled();

    // Hover may foreground a label. The next revision must restore the same
    // subclass-below-property order, including a newly visible property.
    container.appendChild(retained[1]);
    h.graph.applyCanonicalDrawingRevision(drawing, { sameRevision: true });
    expect(order()).toEqual([
      "label:loop",
      "label:ab",
      "label:parallel",
      "label:bc",
    ]);
    groups()
      .slice(0, 3)
      .forEach((group, index) => expect(group).toBe(retained[index]));
  } finally {
    h.dispose();
  }
});

test.each([0.25, 1, 2])(
  "click jitter does not move or reheat a node at zoom %s",
  (zoom) => {
    const h = mountCanonicalGraph();
    try {
      h.graph.setViewportTransform(zoom, [0, 0]);
      const node = h.graph.getUnfilteredData().nodes[0];
      const element = h.graph.graphNodeElements().node();
      const simulation = createdSimulations.at(-1);
      const resume = jest.spyOn(simulation, "resume");
      const original = [node.x, node.y, node.px, node.py, node.fx, node.fy];
      const event = (phase, dx = 0, dy = 0) => ({
        identifier: "mouse",
        x: original[0] + dx / zoom,
        y: original[1] + dy / zoom,
        sourceEvent: {
          type: phase,
          clientX: 100 + dx,
          clientY: 100 + dy,
          view: h.document.defaultView,
          stopPropagation() {},
        },
      });
      h.drag.on("start").call(element, event("mousedown"), node);
      expect(node.locked()).toBe(false);
      for (const [dx, dy] of [
        [1, 0],
        [4, 3],
        [6, 0],
      ]) {
        h.drag.on("drag").call(element, event("mousemove", dx, dy), node);
        expect([node.x, node.y, node.px, node.py, node.fx, node.fy]).toEqual(
          original,
        );
      }
      h.drag.on("end").call(element, event("mouseup", 6), node);
      expect(node.focused()).toBe(true);
      expect(resume).not.toHaveBeenCalled();
    } finally {
      h.dispose();
    }
  },
);

test("native drag subject preserves the node-to-pointer offset", () => {
  const h = mountCanonicalGraph();
  try {
    const node = h.graph.getUnfilteredData().nodes[0];
    expect(h.drag.subject()({ x: 300, y: 200 }, node)).toBe(node);
  } finally {
    h.dispose();
  }
});

test.each([0.25, 2])(
  "deliberate drag stays active after returning inside the threshold at zoom %s",
  (zoom) => {
    const h = mountCanonicalGraph();
    try {
      h.graph.setViewportTransform(zoom, [0, 0]);
      const node = h.graph.getUnfilteredData().nodes[0];
      const element = h.graph.graphNodeElements().node();
      const original = [node.x, node.y];
      const event = (type, dx) => ({
        identifier: "mouse",
        x: original[0] + dx / zoom,
        y: original[1],
        sourceEvent: {
          type,
          clientX: 100 + dx,
          clientY: 100,
          view: h.document.defaultView,
          stopPropagation() {},
        },
      });
      h.drag.on("start").call(element, event("mousedown", 0), node);
      h.drag.on("drag").call(element, event("mousemove", 7), node);
      expect([node.x, node.y]).toEqual([original[0] + 7 / zoom, original[1]]);
      expect(node.locked()).toBe(true);
      h.drag.on("drag").call(element, event("mousemove", 2), node);
      expect([node.x, node.y]).toEqual([original[0] + 2 / zoom, original[1]]);
      h.drag.on("end").call(element, event("mouseup", 2), node);
      expect(node.focused()).toBe(false);
      expect(node.locked()).toBe(false);
    } finally {
      h.dispose();
    }
  },
);

test("cancelled touch below the threshold neither selects nor moves", () => {
  const h = mountCanonicalGraph();
  try {
    const node = h.graph.getUnfilteredData().nodes[0];
    const element = h.graph.graphNodeElements().node();
    const original = [node.x, node.y];
    const event = (type, x) => ({
      identifier: 7,
      x: original[0] + x - 100,
      y: original[1],
      sourceEvent: {
        type,
        changedTouches: [
          { identifier: 8, clientX: 500, clientY: 500 },
          { identifier: 7, clientX: x, clientY: 100 },
        ],
        stopPropagation() {},
      },
    });
    h.drag.on("start").call(element, event("touchstart", 100), node);
    h.drag.on("drag").call(element, event("touchmove", 102), node);
    h.drag.on("end").call(element, event("touchcancel", 102), node);
    expect([node.x, node.y]).toEqual(original);
    expect(node.focused()).toBe(false);
    expect(node.locked()).toBe(false);
  } finally {
    h.dispose();
  }
});

test("drag scheduling follows overlapping pointers, cancellation and revision ownership", () => {
  const h = mountCanonicalGraph(reuseDrawing());
  const now = jest.spyOn(performance, "now").mockReturnValue(0);
  try {
    h.graph.setRenderedGraphEventPort({ publishGraphLayoutState() {} });
    const simulation = createdSimulations.at(-1);
    const node = h.graph.getUnfilteredData().nodes[0];
    const dom = h.document.querySelector("#a");
    const drag = h.drag;
    let steps = 0;
    simulation.on("step.proof", () => steps++);
    function frameSteps() {
      steps = 0;
      simulation.resume();
      d3.timerFlush();
      simulation.stop();
      return steps;
    }
    function gesture(behaviour, phase, identifier, type) {
      const clientX = phase === "drag" ? 108 : 100;
      behaviour.on(phase).call(
        dom,
        {
          identifier,
          x: node.x + (phase === "drag" ? 8 : 0),
          y: node.y,
          sourceEvent: {
            type,
            clientX,
            clientY: 100,
            ...(typeof identifier === "number"
              ? { changedTouches: [{ identifier, clientX, clientY: 100 }] }
              : {}),
            view: h.document.defaultView,
            stopPropagation() {},
          },
        },
        node,
      );
    }
    expect(frameSteps()).toBe(2);
    gesture(drag, "start", "mouse", "mousedown");
    expect(frameSteps()).toBe(2);
    gesture(drag, "drag", "mouse", "mousemove");
    expect(frameSteps()).toBe(1);
    gesture(drag, "start", 7, "touchstart");
    gesture(drag, "drag", 7, "touchmove");
    gesture(drag, "end", "mouse", "mouseup");
    expect(frameSteps()).toBe(1);
    gesture(drag, "end", 7, "touchcancel");
    expect(frameSteps()).toBe(2);
    gesture(drag, "start", 8, "touchstart");
    gesture(drag, "drag", 8, "touchmove");
    h.graph.applyCanonicalDrawingRevision(reuseDrawing(), {
      sameRevision: true,
    });
    expect(frameSteps()).toBe(2);
    const currentDrag = createdDragBehaviours.at(-1);
    gesture(currentDrag, "start", 8, "touchstart");
    gesture(currentDrag, "drag", 8, "touchmove");
    gesture(drag, "end", 8, "touchend");
    expect(frameSteps()).toBe(1);
    h.graph.retireRenderGeneration();
    expect(frameSteps()).toBe(2);
  } finally {
    now.mockRestore();
    h.dispose();
  }
});

test("old hover, click and drag callbacks expire even when their node survives", () => {
  const h = mountCanonicalGraph(reuseDrawing());
  try {
    const node = h.graph.getUnfilteredData().nodes[0];
    const dom = h.document.querySelector("#a");
    const over = d3.select(dom).on("mouseover");
    const out = d3.select(dom).on("mouseout");
    const click = d3.select(dom).on("click");
    const drag = h.drag;
    h.graph.applyCanonicalDrawingRevision(
      withoutOccurrences(reuseDrawing(), ["c"]),
      { sameRevision: true },
    );
    expect(h.document.querySelector("#a")).toBe(dom);
    const before = h.graph.readCanonicalDrawingState();
    over.call(dom, {});
    click.call(dom, {}, node);
    drag.on("drag").call(dom, { x: 999, y: 999 }, node);
    expect(node.mouseEntered()).toBe(false);
    expect(h.graph.readCanonicalDrawingState()).toEqual(before);
    d3.select(dom).on("mouseover").call(dom, {});
    expect(node.mouseEntered()).toBe(true);
    out.call(dom, {});
    expect(node.mouseEntered()).toBe(true);
    d3.select(dom).on("mouseout").call(dom, {});
    expect(node.mouseEntered()).toBe(false);
  } finally {
    h.dispose();
  }
});

test("retained inverse labels refresh hover callbacks for both directions", () => {
  const drawing = reuseDrawing();
  drawing.edges[0].kind = "inverse-edge";
  drawing.edges[0].records.push("inverse-property");
  drawing.labels.push({
    ...drawing.labels[0],
    occurrence: "reverse:ab",
    direction: "reverse",
    records: ["inverse-property"],
    principal: {
      ...drawing.labels[0].principal,
      record: "inverse-property",
      iri: "urn:inverse-property",
      name: "inverse",
    },
    name: "inverse",
  });
  const h = mountCanonicalGraph(drawing);
  try {
    const inverse = h.graph
      .getUnfilteredData()
      .properties.find((property) => property.id() === "reverse:ab");
    const label = inverse.labelElement();
    const oldOver = label.on("mouseover");
    h.graph.applyCanonicalDrawingRevision(withoutOccurrences(drawing, ["c"]), {
      sameRevision: true,
    });
    expect(inverse.labelElement().node()).toBe(label.node());
    oldOver.call(label.node(), {});
    expect(inverse.mouseEntered()).toBe(false);
    label.on("mouseover").call(label.node(), {});
    expect(inverse.mouseEntered()).toBe(true);
    label.on("mouseout").call(label.node(), {});
    expect(inverse.mouseEntered()).toBe(false);
  } finally {
    h.dispose();
  }
});

test("canonical revision retains the mounted viewport and never re-enters initial loading", () => {
  const { graph, document, dispose } = mountCanonicalGraph();
  try {
    graph.setViewportTransform(0.5, [12, -20]);
    const svg = document.querySelector("svg");
    const container = svg.firstChild;
    const publishRenderProgress = jest.fn();
    graph.setRenderedGraphEventPort({ publishRenderProgress });
    graph.applyCanonicalDrawingRevision({
      ...CANONICAL_DRAWING,
      nodes: [
        ...CANONICAL_DRAWING.nodes,
        {
          ...CANONICAL_DRAWING.nodes[0],
          occurrence: "thing",
          targets: ["record:thing"],
          principal: {
            record: "record:thing",
            kind: "class",
            iri: "http://www.w3.org/2002/07/owl#Thing",
            name: "Thing",
            externalStyle: false,
          },
          position: { x: 300, y: 220 },
        },
      ],
      camera: graph.readCanonicalDrawingState().camera,
    });
    expect(document.querySelector("svg")).toBe(svg);
    expect(svg.firstChild).toBe(container);
    expect(container.getAttribute("transform")).toBe(
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

test("canonical revision expires old inline label submissions and accepts current ones", () => {
  const { graph, dispose } = mountCanonicalGraph();
  try {
    const previousEpoch = graph.currentRenderInteractionEpoch();
    const publishRecordLabelEdit = jest.fn();
    graph.setRenderedGraphEventPort({ publishRecordLabelEdit });
    graph.applyCanonicalDrawingRevision(structuredClone(CANONICAL_DRAWING));
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

test("canonical revision ends an active pan and subsequent native wheel input changes magnification", () => {
  const { graph, document, dispose } = mountCanonicalGraph();
  try {
    const svg = document.querySelector("svg");
    const window = document.defaultView;
    const event = (type, extra = {}) => ({
      type,
      currentTarget: svg,
      view: window,
      button: 0,
      clientX: 100,
      clientY: 100,
      pageX: 100,
      pageY: 100,
      preventDefault() {},
      stopImmediatePropagation() {},
      ...extra,
    });
    d3.select(svg).on("mousedown.zoom").call(svg, event("mousedown"));
    expect(typeof d3.select(window).on("mouseup.zoom")).toBe("function");
    expect(svg.__zooming).toBeDefined();
    graph.applyCanonicalDrawingRevision(structuredClone(CANONICAL_DRAWING));
    d3.select(window).on("mouseup.zoom")?.call(window, event("mouseup"));
    const panEnded = svg.__zooming === undefined;
    d3.select(svg)
      .on("wheel.zoom")
      .call(svg, event("wheel", { deltaY: -100, deltaMode: 0 }));
    expect(document.querySelector("svg")).toBe(svg);
    expect(svg.__zoom.k).toBeGreaterThan(1);
    expect(graph.scaleFactor()).toBe(svg.__zoom.k);
    expect(graph.translation()).toEqual([svg.__zoom.x, svg.__zoom.y]);
    expect(panEnded).toBe(true);
    expect(d3.select(window).on("mouseup.zoom")).toBeUndefined();
  } finally {
    dispose();
  }
});

test("canonical loop revision retains an explicit zero coordinate instead of the old simulation placement", () => {
  const drawing = {
    ...CANONICAL_DRAWING,
    edges: [
      {
        occurrence: "loop",
        kind: "object-edge",
        from: "a",
        to: "a",
        records: ["record:p"],
        hidden: false,
      },
    ],
    labels: [
      {
        occurrence: "label:p",
        edge: "loop",
        direction: "forward",
        principal: {
          record: "record:p",
          kind: "object-property",
          iri: "urn:p",
          name: "loop",
          externalStyle: false,
        },
        name: "loop",
        aliases: [],
        records: ["record:p"],
        characteristics: [],
        position: { x: 110, y: 190 },
        pinned: true,
        hidden: false,
      },
    ],
  };
  const { graph, dispose } = mountCanonicalGraph(drawing);
  try {
    graph.applyCanonicalDrawingRevision({
      ...drawing,
      labels: [{ ...drawing.labels[0], position: { x: 0, y: -150 } }],
    });
    const label = graph.graphLabelElements()[0];
    expect([label.x, label.y]).toEqual([0, -150]);
    expect(graph.readCanonicalDrawingState().placements).toContainEqual({
      occurrence: "label:p",
      position: { x: 0, y: -150 },
      pinned: true,
    });
  } finally {
    dispose();
  }
});

test.each([
  [CANONICAL_DRAWING, true],
  [undefined, true],
  [CANONICAL_DRAWING, false],
  [undefined, false],
])(
  "canonical native mount preserves topology and camera with prior input %j and paused %j",
  (prior, isPaused) => {
    const { graph, document, dispose } = mountGraph(prior);
    try {
      const member = (id, kind) => ({
        record: id,
        kind,
        iri: `urn:${id}`,
        name: id,
        externalStyle: false,
      });
      const drawing = {
        nodes: ["c1", "c2"].map((id, index) => ({
          occurrence: id,
          targets: [id],
          principal: member(id, "class"),
          aliases: [],
          position: { x: index * 100, y: index * 80 },
          pinned: index === 0,
          radiusFactor: 1,
          hidden: false,
        })),
        edges: [
          {
            occurrence: "pair",
            kind: "inverse-edge",
            from: "c1",
            to: "c2",
            records: ["pair", "p", "q"],
            hidden: false,
          },
        ],
        labels: ["forward", "reverse"].map((direction, index) => ({
          occurrence: direction,
          edge: "pair",
          direction,
          principal: member(index ? "q" : "p", "object-property"),
          name: index ? "q" : "p",
          aliases: [],
          records: [index ? "q" : "p"],
          characteristics: [],
          position: { x: index * 30, y: index ? 70 : -30 },
          pinned: true,
          hidden: false,
        })),
        display: {
          compactNotation: false,
          externalColoring: true,
          nodeScaling: "uniform",
        },
        camera: { center: { x: 10, y: 20 }, zoom: 2 },
      };
      graph.load(2, { canonicalDrawing: drawing, isPaused });
      expect(document.getElementsByTagName("circle").length).toBeGreaterThan(0);
      expect(graph.paused()).toBe(isPaused);
      expect(graph.isReadyForPaint()).toBe(true);
      expect(graph.readVisibleElementIds().nodeIds).toEqual(["c1", "c2"]);
      expect(
        graph.getUnfilteredData().properties.map(({ x, y }) => [x, y]),
      ).toEqual([
        [50, 40],
        [30, 70],
      ]);
      expect(graph.translation()).toEqual([380, 260]);
      expect(graph.scaleFactor()).toBe(2);
      expect(graph.readCanonicalDrawingBindings().get("reverse")).toMatchObject(
        {
          occurrence: "pair",
          label: "reverse",
          positionable: true,
        },
      );
      graph.update();
      expect(
        graph.getUnfilteredData().properties.map(({ x, y }) => [x, y]),
      ).toEqual([
        [50, 40],
        [30, 70],
      ]);
      expect(graph.readVisibleElementIds().nodeIds).toEqual(["c1", "c2"]);
      expect(graph.readCanonicalDrawingState().camera).toEqual(drawing.camera);
      // Canonical label identities survive the legacy midpoint constraint.
      graph.load(3, {
        canonicalDrawing: {
          ...drawing,
          edges: [{ ...drawing.edges[0], kind: "object-edge" }],
          labels: [drawing.labels[0]],
          camera: { ...drawing.camera, zoom: 10 },
        },
      });
      // Eligibility comes from the projected link, without rescanning endpoints.
      const linkReads = graph.getUnfilteredData().nodes.map((node) =>
        jest.spyOn(node, "links").mockImplementation(() => {
          throw new Error("Arrangement must use canonical placement bindings.");
        }),
      );
      try {
        const labelArrangement = graph
          .readArrangement()
          .find(({ kind }) => kind === "property-label");
        expect(labelArrangement).toMatchObject({
          xPx: 50,
          yPx: 40,
          canMove: false,
          canPin: false,
        });
        expect(() =>
          graph.applyArrangement([
            {
              rendererKey: labelArrangement.rendererKey,
              xPx: 75,
              yPx: -90,
              isPinned: true,
            },
          ]),
        ).toThrow("cannot accept");
      } finally {
        linkReads.forEach((read) => read.mockRestore());
      }
      graph.update();
      expect(graph.readCanonicalDrawingState().camera).toEqual({
        ...drawing.camera,
        zoom: 10,
      });
      expect(graph.readCanonicalDrawingState().placements).toContainEqual({
        occurrence: "forward",
        position: { x: 50, y: 40 },
        pinned: true,
      });
      const svg = document.querySelector("svg");
      const prior = graph.readCanonicalDrawingState();
      const epoch = graph.currentRenderInteractionEpoch();
      expect(() =>
        graph.applyCanonicalDrawingRevision({
          ...drawing,
          camera: { center: { x: Number.MAX_VALUE, y: 0 }, zoom: 10 },
        }),
      ).toThrow("Canonical camera");
      expect(graph.currentRenderInteractionEpoch()).toBe(epoch);
      expect(graph.readCanonicalDrawingState()).toEqual(prior);
      const revised = {
        ...drawing,
        edges: [{ ...drawing.edges[0], kind: "object-edge" }],
        labels: [
          {
            ...drawing.labels[0],
            occurrence: "successor",
            name: "renamed",
            position: { x: 0, y: -99 },
          },
        ],
        camera: prior.camera,
      };
      const transform = jest.spyOn(graph, "setViewportTransform");
      transform.mockImplementationOnce(() => {
        throw new Error("Injected viewport drawing failure");
      });
      expect(() => graph.applyCanonicalDrawingRevision(revised)).toThrow(
        "Injected viewport drawing failure",
      );
      expect(document.querySelector("svg")).toBe(svg);
      expect(graph.readCanonicalDrawingState()).toEqual(prior);
      expect(graph.readCanonicalDrawingBindings().has("forward")).toBe(true);
      expect(graph.readCanonicalDrawingBindings().has("successor")).toBe(false);
      transform.mockRestore();
      graph.applyCanonicalDrawingRevision(revised);
      expect(document.querySelector("svg")).toBe(svg);
      expect(graph.paused()).toBe(true);
      expect(graph.currentRenderInteractionEpoch()).toBeGreaterThan(epoch);
      expect(graph.readCanonicalDrawingBindings().has("forward")).toBe(false);
      expect(graph.readCanonicalDrawingState().camera).toEqual(prior.camera);
      expect(graph.readCanonicalDrawingState().placements).toContainEqual({
        occurrence: "successor",
        position: { x: 50, y: 40 },
        pinned: true,
      });
      graph.load(4, {
        canonicalDrawing: structuredClone(CANONICAL_DRAWING),
        isPaused: true,
      });
      expect([...graph.readCanonicalDrawingBindings().keys()]).toEqual(["a"]);
      expect(graph.getUnfilteredData().nodes.map((node) => node.id())).toEqual([
        "a",
      ]);
    } finally {
      dispose();
    }
  },
);

test("draws the canonical bundled MUTO document on an uncached native mount", async () => {
  const h = await canonicalControllerHarness();
  let mounted;
  try {
    const accepted = await h.session.load({
      operation: "open-canonical-model",
      bytes: new Uint8Array(
        readFileSync(
          new URL("../../../canonical-examples/muto.json", import.meta.url),
        ),
      ),
    });
    mounted = mountCanonicalGraph(accepted.projection);
    const { graph } = mounted;
    expect(graph.readVisibleElementIds().nodeIds.length).toBeGreaterThan(0);
    expect(graph.isReadyForPaint()).toBe(true);
    const simulation = createdSimulations.at(-1);
    const nodes = graph.getUnfilteredData().nodes;
    const links = [...new Set(simulation.links().map((part) => part.link()))];
    for (const node of nodes) {
      expect(node.links()).toEqual(
        links.filter((link) => link.domain() === node || link.range() === node),
      );
    }
    const classNodes = simulation.nodes().filter((point) => !point.property);
    expect(simulation.nodes()).toEqual([
      ...classNodes,
      ...links.map((link) => link.label()),
    ]);
    expect(simulation.links()).toHaveLength(links.length * 2);
    links.forEach((link, i) => {
      expect(simulation.links()[2 * i].source).toBe(link.label());
      expect(simulation.links()[2 * i].target).toBe(link.range());
      expect(simulation.links()[2 * i + 1].source).toBe(link.domain());
      expect(simulation.links()[2 * i + 1].target).toBe(link.label());
    });
    expect(
      graph
        .readLayoutState()
        .layoutElementPositions.every(
          ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
        ),
    ).toBe(true);
  } finally {
    mounted?.dispose();
    h.controller.dispose();
  }
});

test("canonical native datatype plus publishes semantic intent on the first editor mount", () => {
  const { graph, document, dispose } = mountCanonicalGraph();
  try {
    const creations = [];
    graph.setRenderedGraphEventPort({
      publishSemanticCreation: (payload) => creations.push(payload),
    });
    graph.activateHoverElements(true, graph.getUnfilteredData().nodes[0]);
    const circle = document.querySelector(".addDataPropertyElement").firstChild;
    d3.select(circle).on("click").call(circle, { stopPropagation: jest.fn() });
    expect(creations).toHaveLength(1);
    expect(creations[0]).toMatchObject({
      type: "owl:datatypeProperty",
      from: "a",
      position: { x: expect.any(Number), y: expect.any(Number) },
    });
  } finally {
    dispose();
  }
});

test("keeps both editor circles attached while dragging a paused class", () => {
  const { graph, document, drag, dispose } = mountCanonicalGraph();
  try {
    const node = graph.getUnfilteredData().nodes[0];
    const nodeElement = graph.graphNodeElements().node();
    graph.activateHoverElements(true, node);
    const add = document.querySelector(".addDataPropertyElement");
    const remove = document.querySelector(".deleteParentElement");
    const initialTransforms = [add, remove].map((element) =>
      element.getAttribute("transform"),
    );
    drag.on("start").call(
      nodeElement,
      {
        sourceEvent: { clientX: 100, clientY: 100, stopPropagation: jest.fn() },
      },
      node,
    );
    drag.on("drag").call(
      nodeElement,
      {
        x: 130,
        y: 240,
        sourceEvent: { clientX: 200, clientY: 300, stopPropagation: jest.fn() },
      },
      node,
    );
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
