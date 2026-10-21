import * as d3 from "d3";
import { createLegacyForceSimulation } from "./legacyForceSimulation.js";
import { DOMImplementation } from "@xmldom/xmldom";
import { beforeAll, expect, jest, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { canonicalControllerHarness } from "../../../app/test/canonicalControllerHarness.js";

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
    // Match DOM pre-insert's node === reference step; xmldom otherwise corrupts
    // its child list. See https://dom.spec.whatwg.org/#concept-node-pre-insert.
    const insertBefore = element.insertBefore.bind(element);
    element.insertBefore = (node, reference) =>
      insertBefore(node, reference === node ? node.nextSibling : reference);
    if (element.localName === "svg") {
      element.width = { baseVal: { value: 800 } };
      element.height = { baseVal: { value: 600 } };
    }
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
        [0, -30],
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
        [0, -30],
        [30, 70],
      ]);
      expect(graph.readVisibleElementIds().nodeIds).toEqual(["c1", "c2"]);
      expect(graph.readCanonicalDrawingState().camera).toEqual(drawing.camera);
      // A single property label is still an independent canonical placement.
      // Legacy rendering would silently force it to the endpoint midpoint.
      graph.load(3, {
        canonicalDrawing: {
          ...drawing,
          edges: [{ ...drawing.edges[0], kind: "object-edge" }],
          labels: [drawing.labels[0]],
          camera: { ...drawing.camera, zoom: 10 },
        },
      });
      const labelArrangement = graph
        .readArrangement()
        .find(({ kind }) => kind === "property-label");
      expect(labelArrangement).toMatchObject({
        xPx: 0,
        yPx: -30,
        canMove: true,
        canPin: true,
      });
      graph.applyArrangement([
        {
          rendererKey: labelArrangement.rendererKey,
          xPx: 75,
          yPx: -90,
          isPinned: true,
        },
      ]);
      graph.update();
      expect(graph.readCanonicalDrawingState().camera).toEqual({
        ...drawing.camera,
        zoom: 10,
      });
      expect(graph.readCanonicalDrawingState().placements).toContainEqual({
        occurrence: "forward",
        position: { x: 75, y: -90 },
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
        position: { x: 0, y: -99 },
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
