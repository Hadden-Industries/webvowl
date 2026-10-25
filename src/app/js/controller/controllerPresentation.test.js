import { jest } from "@jest/globals";
import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";
import { createWebMcpToolDispatch } from "../webmcp/webMcpToolContracts.js";

test("two throwing subscribers cannot fail a committed load or edit or block later listeners", async () => {
  const h = await canonicalControllerHarness();
  const broken = jest.fn(() => {
    throw new Error("Presenter failed");
  });
  const warningBroken = jest.fn((_state, fields) => {
    if (fields.includes("warnings")) {
      throw new Error("Warning presenter failed");
    }
  });
  const healthy = jest.fn();
  h.controller.subscribeToState(broken);
  h.controller.subscribeToState(() => {
    throw new Error("Second presenter failed");
  });
  h.controller.subscribeToState(warningBroken);
  h.controller.subscribeToState(healthy);
  try {
    await expect(h.load("urn:subscribers")).resolves.toMatchObject({
      status: "ready",
      loadGeneration: 2,
    });
    await expect(h.edit()).resolves.toMatchObject({ documentRevision: 1 });
    expect(healthy).toHaveBeenCalledWith(
      expect.objectContaining({ documentRevision: 1 }),
      expect.any(Array),
    );
    expect(h.controller.getState().warnings).toContain(
      "A presentation subscriber failed. The document remains available.",
    );
    expect(h.controller.getState().warnings.length).toBeLessThanOrEqual(10);
    // Reporting failures must not recursively notify a failing listener.
    expect(broken.mock.calls.length).toBeLessThan(10);
    expect(warningBroken.mock.calls.length).toBeLessThan(15);
    expect(h.session.identity()).toEqual({
      loadGeneration: 2,
      documentRevision: 1,
    });
  } finally {
    h.controller.dispose();
  }
});

test("human and agent neighborhood actions publish the same bounded temporary state", async () => {
  const h = await canonicalControllerHarness();
  const dispatch = createWebMcpToolDispatch({
    webVowlController: h.controller,
  });
  try {
    await h.controller.setVisualizationView({
      nodesShown: { mode: "exact", requestedCount: 0 },
    });
    const ordinary = await h.session.capture();
    await h.controller.revealOntologyNeighborhood({
      ontologyElementReferences: [h.reference()],
    });
    const human = h.controller.getState().temporaryPresentation;
    expect(human).toMatchObject({
      kind: "neighborhood",
      loadGeneration: 1,
      documentRevision: 0,
      counts: { nodes: 2 },
    });
    expect(await h.session.capture()).toEqual(ordinary);
    await h.controller.clearOntologyNeighborhood();
    expect(h.controller.getState().temporaryPresentation).toBeNull();
    const result = await dispatch.callWebMcpTool(
      "reveal_ontology_neighborhood",
      { ontologyElementReferences: [h.reference()] },
    );
    expect(result.isSuccess).toBe(true);
    expect(h.controller.getState().temporaryPresentation).toEqual(human);
    const state = await dispatch.callWebMcpTool("get_visualization_state", {});
    expect(state.toolResult.temporaryPresentation).toEqual(human);
    expect(JSON.stringify(state).length).toBeLessThanOrEqual(1500);
    expect(await h.session.capture()).toEqual(ordinary);
  } finally {
    h.controller.dispose();
  }
});

test.each([
  ["clear", (h) => h.controller.clearOntologyNeighborhood()],
  [
    "view",
    (h) => h.controller.setVisualizationView({ nodesShown: { mode: "all" } }),
  ],
  [
    "filters",
    (h) =>
      h.controller.setVisualizationView({ filters: { subclasses: "hide" } }),
  ],
  ["language", (h) => h.controller.setVisualizationView({ language: "de" })],
  ["layout", (h) => h.controller.setVisualizationView({ layout: "pause" })],
  [
    "modes",
    (h) => h.controller.setVisualizationModes({ compactNotation: true }),
  ],
  [
    "distances",
    (h) => h.controller.setForceLayoutDistances({ classDistancePx: 180 }),
  ],
  ["reset", (h) => h.controller.resetVisualization()],
  ["edit", (h) => h.edit()],
  ["replacement", (h) => h.load("urn:replacement")],
])(
  "%s retires the published neighborhood and restores ordinary session ownership",
  async (_name, operation) => {
    const h = await canonicalControllerHarness();
    try {
      await h.controller.revealOntologyNeighborhood({
        ontologyElementReferences: [h.reference()],
      });
      expect(h.controller.getState().temporaryPresentation).not.toBeNull();
      await operation(h);
      expect(h.controller.getState().temporaryPresentation).toBeNull();
      expect(h.session.hasNeighborhood()).toBe(false);
    } finally {
      h.controller.dispose();
    }
  },
);

test("ordinary share links survive temporary camera/focus changes, and disposal clears the status", async () => {
  const h = await canonicalControllerHarness({
    resolver: {
      async loadBytes(documentIri) {
        return {
          documentIri,
          bytes: new TextEncoder().encode(
            "Ontology(<https://example.test/model> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) SubClassOf(<urn:A> <urn:B>))",
          ),
        };
      },
    },
  });
  try {
    await h.controller.loadOntology({
      source: {
        kind: "ontology-document-iri",
        documentIri: "https://example.test/model",
        format: "functional",
      },
    });
    const ordinary = h.controller.getVisualizationShareLink();
    await h.controller.revealOntologyNeighborhood({
      ontologyElementReferences: [h.reference()],
    });
    await h.controller.setVisualizationView({
      zoomScale: 2,
      translation: { xPx: 100, yPx: -50 },
    });
    expect(h.controller.getVisualizationShareLink()).toEqual(ordinary);
    h.controller.dispose();
    expect(h.controller.getState().temporaryPresentation).toBeNull();
  } finally {
    h.controller.dispose();
  }
});

test("temporary status is visible before paint and a failed reveal clears it", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.double.deferPaint();
  try {
    const pending = h.controller.revealOntologyNeighborhood({
      ontologyElementReferences: [h.reference()],
    });
    const outcome = expect(pending).rejects.toThrow("paint failed");
    expect(h.controller.getState().temporaryPresentation).not.toBeNull();
    gate.reject(new Error("paint failed"));
    await outcome;
    expect(h.controller.getState().temporaryPresentation).toBeNull();
    expect(h.session.hasNeighborhood()).toBe(false);
  } finally {
    gate.resolve();
    h.controller.dispose();
  }
});

test("WebMCP retains LOAD_PENDING retryability while loading state remains readable", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("open-owl-model");
  const pending = h.load("urn:pending");
  await gate.started.promise;
  try {
    const dispatch = createWebMcpToolDispatch({
      webVowlController: h.controller,
    });
    const state = await dispatch.callWebMcpTool("get_visualization_state", {});
    expect(state).toMatchObject({
      isSuccess: true,
      toolResult: { status: "loading" },
    });
    for (const [tool, input] of [
      ["get_ontology_summary", {}],
      ["set_visualization_view", { nodesShown: { mode: "auto" } }],
      ["export_visualization", { format: "svg" }],
    ]) {
      expect(await dispatch.callWebMcpTool(tool, input)).toMatchObject({
        isSuccess: false,
        error: { code: "LOAD_PENDING", isRetryable: true },
      });
    }
  } finally {
    gate.resolve();
    await pending;
    h.controller.dispose();
  }
});
