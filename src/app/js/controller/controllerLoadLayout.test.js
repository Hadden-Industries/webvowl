import { jest } from "@jest/globals";
import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";

test("replacement holds the old running drawing until the new drawing is installed", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("open-owl-model");
  const before = h.double.observe().mounted;
  const loading = h.load("urn:replacement");
  try {
    await gate.started.promise;
    expect(h.double.observe().mounted).toEqual(before);
    expect(h.double.observe().paused).toBe(true);
    expect(h.controller.getState().layout.requestedIsPaused).toBe(false);
    gate.resolve();
    await loading;
    expect(h.double.observe().mounted.loadGeneration).not.toBe(
      before.loadGeneration,
    );
    expect(h.double.observe().paused).toBe(false);
    expect(h.controller.getState().layout).toEqual({ status: "relaxing" });
  } finally {
    gate.resolve();
    await loading.catch(() => {});
    h.controller.dispose();
  }
});

test("failed overlapping replacements transfer the hold without resuming the old drawing early", async () => {
  const h = await canonicalControllerHarness();
  const before = h.double.observe().mounted;
  const first = h.deferWorker("open-owl-model");
  const loadingFirst = h.load("urn:first");
  const firstFailure = expect(loadingFirst).rejects.toThrow();
  await first.started.promise;
  const second = h.deferWorker("open-owl-model");
  const loadingSecond = h.load("urn:second");
  const secondFailure = expect(loadingSecond).rejects.toThrow("offline");
  try {
    await second.started.promise;
    first.reject(new Error("superseded"));
    await firstFailure;
    expect(h.double.observe().paused).toBe(true);
    second.reject(new Error("offline"));
    await secondFailure;
    expect(h.double.observe().mounted).toEqual(before);
    expect(h.double.observe().paused).toBe(false);
    expect(h.controller.getState().status).toBe("error");
    expect(h.controller.getState().layout).toEqual({ status: "relaxing" });
  } finally {
    first.resolve();
    second.reject(new Error("offline"));
    await Promise.allSettled([firstFailure, secondFailure]);
    h.controller.dispose();
  }
});

test.each(["paused", "settled"])(
  "failed replacement does not reheat a %s drawing",
  async (status) => {
    const pause = jest.fn();
    const h = await canonicalControllerHarness({
      wrapRuntime: (runtime) => ({
        ...runtime,
        readGraphLayoutSnapshot: () => ({
          ...runtime.readGraphLayoutSnapshot(),
          ...(status === "settled" ? { hasEnded: true, forceAlpha: 0 } : {}),
        }),
        setGraphLayoutPaused(request) {
          pause(request);
          return runtime.setGraphLayoutPaused(request);
        },
      }),
    });
    if (status === "paused") {
      h.controller.setGraphLayoutPaused({ isPaused: true });
    }
    pause.mockClear();
    const gate = h.deferWorker("open-owl-model");
    const loading = h.load("urn:failure");
    const failed = expect(loading).rejects.toThrow("offline");
    try {
      await gate.started.promise;
      gate.reject(new Error("offline"));
      await failed;
      expect(pause).not.toHaveBeenCalled();
    } finally {
      gate.resolve();
      await loading.catch(() => {});
      h.controller.dispose();
    }
  },
);

test("disposal while replacing never resumes the retired renderer", async () => {
  const pause = jest.fn();
  const h = await canonicalControllerHarness({
    wrapRuntime: (runtime) => ({
      ...runtime,
      setGraphLayoutPaused(request) {
        pause(request);
        return runtime.setGraphLayoutPaused(request);
      },
    }),
  });
  const gate = h.deferWorker("open-owl-model");
  const loading = h.load("urn:pending");
  const failed = expect(loading).rejects.toThrow();
  try {
    await gate.started.promise;
    expect(h.double.observe().paused).toBe(true);
    h.controller.dispose();
    pause.mockClear();
    gate.resolve();
    await failed;
    expect(pause).not.toHaveBeenCalled();
  } finally {
    h.controller.dispose();
    gate.resolve();
    await failed;
  }
});

test.each(["cancel", "pause"])(
  "replacement preserves the %s outcome instead of applying an obsolete resume",
  async (outcome) => {
    const h = await canonicalControllerHarness();
    const gate = h.deferWorker("open-owl-model");
    const abort = new AbortController();
    const before = h.controller.getState();
    const loading = h.controller.loadOntology(
      {
        source: {
          kind: "ontology-text",
          documentIri: "urn:replacement",
          format: "functional",
          text: "Ontology(<urn:replacement> Declaration(Class(<urn:New>)))",
        },
      },
      {
        signal: abort.signal,
        initialVisualization: { view: { layout: "pause" } },
      },
    );
    const completion =
      outcome === "cancel" ? expect(loading).rejects.toThrow() : loading;
    try {
      await gate.started.promise;
      expect(h.double.observe().paused).toBe(true);
      if (outcome === "cancel") {
        abort.abort();
      }
      gate.resolve();
      await completion;
      if (outcome === "cancel") {
        expect(h.controller.getState()).toEqual(before);
        expect(h.double.observe().paused).toBe(false);
      } else {
        expect(h.controller.getState().layout.status).toBe("paused");
        expect(h.double.observe().paused).toBe(true);
      }
    } finally {
      gate.resolve();
      await Promise.allSettled([completion]);
      h.controller.dispose();
    }
  },
);
