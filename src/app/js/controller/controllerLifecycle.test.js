import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";

const viewOperations = [
  [
    "view",
    (h, options) =>
      h.controller.setVisualizationView(
        { nodesShown: { mode: "exact", requestedCount: 0 } },
        options,
      ),
  ],
  [
    "modes",
    (h, options) =>
      h.controller.setVisualizationModes({ dynamicLabelWidth: true }, options),
  ],
  ["reset", (h, options) => h.controller.resetVisualization(options)],
  [
    "neighborhood",
    (h, options) =>
      h.controller.revealOntologyNeighborhood(
        { ontologyElementReferences: [h.reference()] },
        options,
      ),
  ],
  [
    "arrangement",
    (h, options) =>
      h.controller.setVisualizationArrangement(
        {
          changes: [
            {
              reference:
                h.double.runtime.readRenderedArrangement().occurrences[0]
                  .reference,
              xPx: 100,
              yPx: 200,
              isPinned: true,
            },
          ],
        },
        options,
      ),
  ],
];

describe.each(viewOperations)("%s lifecycle", (name, operate) => {
  test("an already cancelled caller changes no applied or published state", async () => {
    const h = await canonicalControllerHarness();
    const state = h.controller.getState();
    const applied = h.double.observe();
    try {
      await expect(
        operate(h, { signal: AbortSignal.abort() }),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(h.controller.getState()).toBe(state);
      expect(h.double.observe()).toEqual(applied);
    } finally {
      h.controller.dispose();
    }
  });

  test("standing view changes during a worker edit survive reconciliation; temporary reveal is refused", async () => {
    const h = await canonicalControllerHarness();
    const gate = h.deferWorker("edit-model");
    const edit = h.edit();
    await gate.started.promise;
    try {
      if (name === "neighborhood") {
        await expect(operate(h)).rejects.toMatchObject({
          code: "VIEW_REJECTED",
        });
      } else {
        await operate(h);
      }
      gate.resolve();
      await edit;
      expect(h.controller.getState().documentRevision).toBe(1);
      expect(
        h.double.runtime.readCanonicalDrawingState().documentRevision,
      ).toBe(1);
      expect(h.session.hasNeighborhood()).toBe(false);
      if (name === "view") {
        expect(h.controller.getState().view.nodesShown).toEqual({
          mode: "exact",
          requestedCount: 0,
        });
        expect(
          h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
            .visibleNodeCount,
        ).toBe(0);
      }
      if (name === "arrangement") {
        expect(h.session.scene().snapshot().placements[0]).toMatchObject({
          position: { x: 100, y: 200 },
          pinned: true,
        });
      }
      if (name === "modes") {
        expect(h.controller.getState().view.modes.dynamicLabelWidth).toBe(true);
      }
    } finally {
      gate.resolve();
      await edit;
      h.controller.dispose();
    }
  });

  test.each(["newer view", "replacement load", "disposal"])(
    "retired paint cannot publish or restore after %s",
    async (stimulus) => {
      const h = await canonicalControllerHarness();
      const gate = h.double.deferPaint();
      const changes = [];
      h.controller.subscribeToState((state) => changes.push(state));
      const pending = operate(h);
      const outcome = pending.then(
        () => ({ status: "fulfilled" }),
        (error) => ({ status: "rejected", error }),
      );
      try {
        if (stimulus === "newer view") {
          await h.controller.setVisualizationView({
            nodesShown: { mode: "all" },
            focus: [],
          });
        }
        if (stimulus === "replacement load") {
          await h.load("urn:replacement");
        }
        if (stimulus === "disposal") {
          h.controller.dispose();
        }
        const current = h.controller.getState();
        const applied = h.double.observe();
        const publications = changes.length;
        gate.resolve();
        expect(await outcome).toMatchObject({
          status: "rejected",
          error: { name: "AbortError" },
        });
        expect(h.controller.getState()).toBe(current);
        expect(h.double.observe()).toEqual(applied);
        expect(changes).toHaveLength(publications);
        if (stimulus === "replacement load") {
          expect(current).toMatchObject({
            status: "ready",
            loadGeneration: 2,
            documentRevision: 0,
          });
        }
      } finally {
        h.controller.dispose();
      }
    },
  );

  test("a current renderer paint failure stays observable", async () => {
    const h = await canonicalControllerHarness();
    const gate = h.double.deferPaint();
    const pending = operate(h);
    gate.reject(new Error("paint failed"));
    try {
      await expect(pending).rejects.toThrow("paint failed");
      expect(h.controller.getState()).toMatchObject({
        status: "ready",
        loadGeneration: 1,
        documentRevision: 0,
      });
      if (name === "view" || name === "neighborhood") {
        expect(h.session.hasNeighborhood()).toBe(false);
        expect(h.controller.getState().view.nodesShown).toEqual({
          mode: "auto",
        });
        expect(
          h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
            .visibleNodeCount,
        ).toBe(2);
      }
    } finally {
      h.controller.dispose();
    }
  });
});

test.each([
  [
    "force distances",
    (controller) => controller.setForceLayoutDistances({ classDistancePx: -1 }),
  ],
  [
    "layout pause",
    (controller) => controller.setGraphLayoutPaused({ isPaused: "invalid" }),
  ],
  [
    "continuous zoom",
    (controller) => controller.setContinuousZoom({ zoomDirection: "invalid" }),
  ],
])(
  "invalid %s does not retire an accepted view",
  async (_name, rejectRequest) => {
    const h = await canonicalControllerHarness();
    const gate = h.double.deferPaint();
    const pending = h.controller.setVisualizationView({ focus: [] });
    const outcome = pending.then(
      () => "completed",
      (error) => error.name,
    );
    try {
      await expect(
        Promise.resolve().then(() => rejectRequest(h.controller)),
      ).rejects.toThrow();
      gate.resolve();
      expect(await outcome).toBe("completed");
    } finally {
      gate.resolve();
      await outcome;
      h.controller.dispose();
    }
  },
);

test("failed scene acceptance leaves the preceding view owner alive", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.double.deferPaint();
  const pending = h.controller.setVisualizationView({ focus: [] });
  try {
    h.double.failNextMutation();
    await expect(
      h.controller.setVisualizationView({
        nodesShown: { mode: "exact", requestedCount: 0 },
      }),
    ).rejects.toThrow("Renderer mutation failed");
    gate.resolve();
    await pending;
    expect(h.controller.getState().view.nodesShown).toEqual({ mode: "auto" });
  } finally {
    gate.resolve();
    h.controller.dispose();
  }
});

test.each(["replacement", "disposal", "caller cancellation"])(
  "canonical capture cannot publish after %s",
  async (stimulus) => {
    const h = await canonicalControllerHarness();
    const caller = new AbortController();
    const gate = h.deferWorker("capture-model");
    const pending = h.controller.exportVisualization(
      { format: "vowl-json" },
      { signal: caller.signal },
    );
    const outcome = pending.then(
      () => "published",
      (error) => error.code,
    );
    await gate.started.promise;
    try {
      if (stimulus === "replacement") {
        await h.load("urn:new");
      }
      if (stimulus === "disposal") {
        h.controller.dispose();
      }
      if (stimulus === "caller cancellation") {
        caller.abort();
      }
      gate.resolve();
      expect(await outcome).toBe("DOCUMENT_CAPTURE_SUPERSEDED");
      expect(h.artifacts).toHaveLength(0);
    } finally {
      gate.resolve();
      h.controller.dispose();
    }
  },
);

test.each(["replacement", "disposal", "caller cancellation"])(
  "edit cannot publish after %s",
  async (stimulus) => {
    const h = await canonicalControllerHarness();
    const caller = new AbortController();
    const gate = h.deferWorker("edit-model");
    const pending = h.edit({ signal: caller.signal });
    const outcome = pending.then(
      () => "published",
      (error) => error.code,
    );
    await gate.started.promise;
    try {
      if (stimulus === "replacement") {
        await h.load("urn:new");
      }
      if (stimulus === "disposal") {
        h.controller.dispose();
      }
      if (stimulus === "caller cancellation") {
        caller.abort();
      }
      const state = h.controller.getState();
      const applied = h.double.observe();
      gate.resolve();
      expect(await outcome).toBe("EDIT_REJECTED");
      expect(h.controller.getState()).toBe(state);
      expect(h.double.observe()).toEqual(applied);
    } finally {
      gate.resolve();
      h.controller.dispose();
    }
  },
);

test.each([
  "newer view",
  "replacement",
  "edit",
  "disposal",
  "caller cancellation",
])(
  "SVG capture cannot publish or restore stale layout after %s",
  async (stimulus) => {
    const h = await canonicalControllerHarness();
    const fonts = h.deferFonts();
    const caller = new AbortController();
    const pending = h.controller.exportVisualization(
      { format: "svg" },
      { signal: caller.signal },
    );
    const outcome = pending.then(
      () => "published",
      (error) => error.name,
    );
    // The test settler has no geometry work. Advance only the explicit promise
    // boundary until the controller pauses the still-running layout for capture.
    for (let turn = 0; turn < 10 && !h.double.observe().paused; turn += 1) {
      await Promise.resolve();
    }
    expect(h.double.observe().paused).toBe(true);
    try {
      if (stimulus === "newer view") {
        await h.controller.setVisualizationView({ layout: "pause" });
      }
      if (stimulus === "replacement") {
        await h.load("urn:new");
      }
      if (stimulus === "edit") {
        await h.edit();
      }
      if (stimulus === "disposal") {
        h.controller.dispose();
      }
      if (stimulus === "caller cancellation") {
        caller.abort();
      }
      await outcome;
      const current = h.controller.getState();
      const applied = h.double.observe();
      fonts.resolve();
      expect(await outcome).toBe("AbortError");
      expect(h.artifacts).toHaveLength(0);
      expect(h.controller.getState()).toBe(current);
      expect(h.double.observe()).toEqual(applied);
      if (stimulus === "newer view") {
        expect(h.double.observe().paused).toBe(true);
      }
    } finally {
      fonts.resolve();
      h.controller.dispose();
    }
  },
);

test("successful SVG capture resumes only its own temporary pause", async () => {
  const h = await canonicalControllerHarness();
  try {
    expect(h.double.observe().paused).toBe(false);
    const artifact = await h.controller.exportVisualization({ format: "svg" });
    expect(artifact.renderedSvgSnapshot).toMatchObject({
      loadGeneration: 1,
      widthPx: 800,
      heightPx: 600,
    });
    expect(h.artifacts).toHaveLength(1);
    expect(h.double.observe().paused).toBe(false);
  } finally {
    h.controller.dispose();
  }
});

test("application observation and setup controls remain usable during a document load", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("open-owl-model");
  const pending = h.load("urn:new");
  await gate.started.promise;
  try {
    expect(h.controller.getState().status).toBe("loading");
    expect(h.controller.getOntologyEditorOptions()).toBeDefined();
    expect(() =>
      h.controller.resizeVisualizationViewport({
        widthPx: 1000,
        heightPx: 800,
        occludedLeftWidthPx: 0,
        isTouchDevice: false,
      }),
    ).not.toThrow();
    expect(() =>
      h.controller.setRenderingDiagnosticsEnabled(true),
    ).not.toThrow();
    expect(() =>
      h.controller.setOntologyEditorOptions({ isEditorMode: true }),
    ).not.toThrow();
  } finally {
    gate.resolve();
    await pending;
    h.controller.dispose();
  }
});

test.each(viewOperations.filter(([name]) => name !== "view"))(
  "%s caller cancellation preserves its characterized applied outcome",
  async (name, operate) => {
    const h = await canonicalControllerHarness();
    const gate = h.double.deferPaint();
    const caller = new AbortController();
    const pending = operate(h, { signal: caller.signal });
    caller.abort();
    try {
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(h.controller.getState()).toMatchObject({
        status: "ready",
        loadGeneration: 1,
        documentRevision: 0,
      });
      if (name === "neighborhood") {
        expect(h.session.hasNeighborhood()).toBe(false);
        expect(h.double.runtime.readVisualizationView().focus).toEqual([]);
      }
      if (name === "modes") {
        expect(h.controller.getState().view.modes.dynamicLabelWidth).toBe(true);
        expect(
          h.double.runtime.readVisualizationView().modes.dynamicLabelWidth,
        ).toBe(true);
      }
      if (name === "reset") {
        expect(h.controller.getState().view.nodesShown).toEqual({
          mode: "auto",
        });
        expect(h.double.observe().paused).toBe(false);
      }
      if (name === "arrangement") {
        expect(
          h.double.runtime.readRenderedArrangement().occurrences[0],
        ).toMatchObject({ xPx: 100, yPx: 200, isPinned: true });
        await h.controller.exportVisualization({ format: "vowl-json" });
        expect(h.session.scene().snapshot().placements[0]).toMatchObject({
          position: { x: 100, y: 200 },
          pinned: true,
        });
      }
    } finally {
      gate.resolve();
      h.controller.dispose();
    }
  },
);

test("renderer rejection of an edit leaves the accepted document, capture and drawing intact", async () => {
  const h = await canonicalControllerHarness();
  try {
    const before = await h.session.capture();
    const drawing = h.double.runtime.readCanonicalDrawingState();
    h.double.failNextMutation(
      Object.assign(new Error("Renderer mutation failed."), {
        code: "DRAWING_REJECTED",
      }),
    );
    await expect(h.edit()).rejects.toMatchObject({ code: "EDIT_REJECTED" });
    expect(h.controller.getState().documentRevision).toBe(0);
    expect(h.double.runtime.readCanonicalDrawingState()).toEqual(drawing);
    expect(await h.session.capture()).toEqual(before);
  } finally {
    h.controller.dispose();
  }
});

test("an uncoded edit renderer failure preserves its cause and accepted scene", async () => {
  const h = await canonicalControllerHarness();
  try {
    const drawing = h.double.runtime.readCanonicalDrawingState();
    h.double.failNextMutation(new Error("Uncoded renderer failure."));
    await expect(h.edit()).rejects.toMatchObject({
      code: "EDIT_REJECTED",
      message: "Uncoded renderer failure.",
      cause: expect.objectContaining({ message: "Uncoded renderer failure." }),
    });
    expect(h.controller.getState().documentRevision).toBe(0);
    expect(h.double.runtime.readCanonicalDrawingState()).toEqual(drawing);
  } finally {
    h.controller.dispose();
  }
});

test("failed replacement paint restores the last accepted scene and capture", async () => {
  const h = await canonicalControllerHarness();
  try {
    const before = await h.session.capture();
    const drawing = h.double.runtime.readCanonicalDrawingState();
    const gate = h.double.deferPaint();
    const pending = h.load("urn:failed");
    // Attach to the eventual rejection before releasing its explicit paint gate.
    const outcome = pending.then(
      () => "loaded",
      (error) => error.message,
    );
    gate.reject(new Error("replacement paint failed"));
    expect(await outcome).toBe("replacement paint failed");
    expect(h.controller.getState()).toMatchObject({
      status: "error",
      loadGeneration: 1,
      documentRevision: 0,
    });
    expect(h.double.runtime.readCanonicalDrawingState()).toEqual(drawing);
    expect(await h.session.capture()).toEqual(before);
  } finally {
    h.controller.dispose();
  }
});

test("Q1 approved change: caller cancellation retains applied standing visibility", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.double.deferPaint();
  const caller = new AbortController();
  try {
    const pending = h.controller.setVisualizationView(
      { nodesShown: { mode: "exact", requestedCount: 0 } },
      { signal: caller.signal },
    );
    expect(
      h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
        .visibleNodeCount,
    ).toBe(0);
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(h.controller.getState().view.nodesShown).toEqual({
      mode: "exact",
      requestedCount: 0,
    });
    expect(
      h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
        .visibleNodeCount,
    ).toBe(0);
    expect(h.session.scene().snapshot().hidden.length).toBeGreaterThan(0);
  } finally {
    gate.resolve();
    h.controller.dispose();
  }
});

const pendingLoadOperations = [
  ...viewOperations,
  [
    "distances",
    (h) => h.controller.setForceLayoutDistances({ classDistancePx: 160 }),
  ],
  ["clear", (h) => h.controller.clearOntologyNeighborhood()],
  ["read", (h) => h.controller.getOntologySummary()],
  ["facts", (h) => h.controller.getOntologyFacts({})],
  ["svg capture", (h) => h.controller.exportVisualization({ format: "svg" })],
  [
    "canonical capture",
    (h) => h.controller.exportVisualization({ format: "vowl-json" }),
  ],
];
test.each(pendingLoadOperations)(
  "Q2 approved change: %s rejects pending load as retryable LOAD_PENDING",
  async (_name, operate) => {
    const h = await canonicalControllerHarness();
    const gate = h.deferWorker("open-owl-model");
    const pending = h.load("urn:replacement");
    await gate.started.promise;
    try {
      await expect(
        Promise.resolve().then(() => operate(h)),
      ).rejects.toMatchObject({ code: "LOAD_PENDING", isRetryable: true });
    } finally {
      gate.resolve();
      await pending;
      h.controller.dispose();
    }
  },
);

test("pending-load edit retains EDIT_REJECTED", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("open-owl-model");
  const pending = h.load("urn:replacement");
  await gate.started.promise;
  try {
    await expect(Promise.resolve().then(() => h.edit())).rejects.toMatchObject({
      code: "EDIT_REJECTED",
    });
  } finally {
    gate.resolve();
    await pending;
    h.controller.dispose();
  }
});

test("temporary display keeps ordinary canonical capture and clear restores drawing", async () => {
  const h = await canonicalControllerHarness();
  try {
    await h.controller.setVisualizationView({
      nodesShown: { mode: "exact", requestedCount: 0 },
    });
    const ordinary = await h.session.capture();
    const drawing = h.double.runtime.readCanonicalDrawingState();
    await h.controller.revealOntologyNeighborhood({
      ontologyElementReferences: [h.reference()],
    });
    expect(h.session.hasNeighborhood()).toBe(true);
    expect(
      h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
        .visibleNodeCount,
    ).toBe(2);
    const artifact = await h.controller.exportVisualization({
      format: "vowl-json",
    });
    expect(artifact.bytes).toEqual(ordinary);
    await h.controller.clearOntologyNeighborhood();
    expect(h.session.hasNeighborhood()).toBe(false);
    expect(h.double.runtime.readCanonicalDrawingState()).toEqual(drawing);
    expect(
      h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
        .visibleNodeCount,
    ).toBe(0);
  } finally {
    h.controller.dispose();
  }
});
