import { assertCanonicalRenderedGraphRuntime } from "../js/controller/canonicalRenderedGraphRuntimeContract.js";
import { canonicalControllerHarness } from "./canonicalControllerHarness.js";

test("canonical double owns applied revisions, arrangement and read snapshots", async () => {
  const { controller, session, double, edit } =
    await canonicalControllerHarness();
  try {
    expect(assertCanonicalRenderedGraphRuntime(double.runtime)).toBe(
      double.runtime,
    );
    const before = double.runtime.readCanonicalDrawingState();
    before.placements[0].position.x = 99999;
    expect(
      double.runtime.readCanonicalDrawingState().placements[0].position.x,
    ).not.toBe(99999);
    const occurrence = double.runtime.readRenderedArrangement().occurrences[0];
    await controller.setVisualizationArrangement({
      changes: [
        { reference: occurrence.reference, xPx: 101, yPx: 202, isPinned: true },
      ],
    });
    expect(
      double.runtime.readRenderedArrangement().occurrences[0],
    ).toMatchObject({ xPx: 101, yPx: 202, isPinned: true });
    expect(session.scene().snapshot().placements[0]).toMatchObject({
      position: { x: 101, y: 202 },
      pinned: true,
    });
    const obsolete = double.observe().mounted;
    await edit();
    expect(double.runtime.readCanonicalDrawingState().documentRevision).toBe(1);
    expect(() =>
      double.runtime.applyCanonicalDrawingRevision({
        loadGeneration: obsolete.loadGeneration,
        baseRevision: 0,
        documentRevision: 0,
        drawing: obsolete.drawing,
      }),
    ).toThrow("Retired revision");
    expect(() =>
      double.emit({
        kind: "document-record-selection-changed",
        loadGeneration: 1,
        payload: { recordTarget: null, text: "semantic text" },
      }),
    ).toThrow();
  } finally {
    controller.dispose();
  }
  expect(double.observe()).toMatchObject({
    mounted: undefined,
    disposed: true,
    listenerCount: 0,
    pendingPaintCount: 0,
  });
});

test("deferred paint applies choices before waiting and cancellation stops the wait", async () => {
  const { controller, double } = await canonicalControllerHarness();
  try {
    const gate = double.deferPaint();
    const abort = new AbortController();
    const pending = double.runtime.setVisualizationModes(
      { dynamicLabelWidth: true },
      { signal: abort.signal },
    );
    expect(double.runtime.readVisualizationView().modes.dynamicLabelWidth).toBe(
      true,
    );
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(double.runtime.readVisualizationView().modes.dynamicLabelWidth).toBe(
      true,
    );
    gate.resolve();
  } finally {
    controller.dispose();
  }
});
import {
  createCanonicalRenderedGraphRuntimeDouble,
  deferred,
} from "./canonicalRenderedGraphRuntimeDouble.js";
import { assertRenderedGraphRuntimeContract } from "./renderedGraphRuntimeContract.js";

test("the canonical double and native adapter satisfy the same behavioral contract", async () => {
  await assertRenderedGraphRuntimeContract({
    expect,
    createAdapterHarness() {
      const paints = [];
      const double = createCanonicalRenderedGraphRuntimeDouble({
        // Explicit export boundary fixture; no claim of rendered SVG geometry.
        svgSnapshot: {
          detachedSvgRoot: { fixture: "svg" },
          widthPx: 800,
          heightPx: 600,
        },
        observeNextPaint({ loadGeneration, signal }) {
          const paint = { ...deferred(), loadGeneration };
          paints.push(paint);
          signal.addEventListener(
            "abort",
            () => {
              const index = paints.indexOf(paint);
              if (index !== -1) {
                paints.splice(index, 1);
              }
            },
            { once: true },
          );
          return paint.promise;
        },
      });
      const complete = (generation) => {
        const index = paints.findIndex(
          (paint) => paint.loadGeneration === generation,
        );
        if (index === -1) {
          return false;
        }
        paints.splice(index, 1)[0].resolve();
        return true;
      };
      return {
        renderedGraphRuntime: double.runtime,
        renderedGraphTestHarness: {
          completeInitialPaint: complete,
          completeVisualizationViewApplication: complete,
          publishRenderedGraphEvent: double.emit,
        },
      };
    },
  });
});
