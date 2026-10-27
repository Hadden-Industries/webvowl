import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";

const exact = (requestedCount) => ({ mode: "exact", requestedCount });
const microtasks = async () => {
  for (let index = 0; index < 20; index++) {
    await Promise.resolve();
  }
};
async function setup() {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const h = await canonicalControllerHarness({
    nodeCountAdjustmentClock: {
      now: () => now,
      setTimeout(callback, delay) {
        const id = ++nextTimer;
        timers.set(id, { callback, due: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  return {
    ...h,
    timers,
    async advance(ms) {
      now += ms;
      for (const [id, entry] of [...timers]) {
        if (entry.due <= now) {
          timers.delete(id);
          entry.callback();
        }
      }
      await microtasks();
    },
  };
}

test("a running graph holds while a count is pending, then installs the final scene and resumes", async () => {
  const h = await setup();
  try {
    expect(h.double.observe().paused).toBe(false);
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(2);
    const before = h.double.observe().mounted;
    h.controller.stageNodeCountAdjustment(exact(0));
    await h.advance(16);
    h.controller.stageNodeCountAdjustment(exact(1));
    await h.advance(49);
    expect(h.double.observe().mounted).toEqual(before);
    expect(h.double.observe().paused).toBe(true);
    expect(h.controller.getState().layout).toEqual({
      status: "paused",
      requestedIsPaused: false,
    });
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(2);
    expect(
      h.controller.getState().nodeCountAdjustment.requestedNodesShown,
    ).toEqual(exact(1));
    await h.advance(1);
    expect(h.controller.getState().nodeCountAdjustment?.status).not.toBe(
      "pending",
    );
    await h.controller.flushNodeCountAdjustment();
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(1);
    expect(
      h.double.runtime.readVisibleRenderedGraphSnapshot().visibleGraphCounts
        .visibleNodeCount,
    ).toBe(1);
    expect(h.double.observe().paused).toBe(false);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.timers.size).toBe(0);
  } finally {
    h.controller.dispose();
  }
});

test("a subscriber staging a newer count during pause publication cannot create a second hold", async () => {
  const h = await setup();
  let staged = false;
  const unsubscribe = h.controller.subscribeToState((state) => {
    if (!staged && state.layout?.requestedIsPaused === false) {
      staged = true;
      h.controller.stageNodeCountAdjustment(exact(1));
    }
  });
  try {
    h.controller.stageNodeCountAdjustment(exact(0));
    await h.controller.flushNodeCountAdjustment();
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(1);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.double.observe().paused).toBe(false);
    expect(h.controller.getState().layout).toEqual({ status: "relaxing" });
  } finally {
    unsubscribe();
    h.controller.dispose();
  }
});

test.each([
  [true, undefined, true],
  [false, true, true],
  [true, false, false],
  [false, false, false],
])(
  "initial pause %s and later choice %s ends with pause %s",
  async (initial, later, expected) => {
    const h = await setup();
    try {
      h.controller.setGraphLayoutPaused({ isPaused: initial });
      h.controller.stageNodeCountAdjustment(exact(1));
      if (later !== undefined) {
        h.controller.setGraphLayoutPaused({ isPaused: later });
      }
      await h.controller.flushNodeCountAdjustment();
      expect(h.double.observe().paused).toBe(expected);
      expect(h.controller.getState().layout.status).toBe(
        expected ? "paused" : "relaxing",
      );
    } finally {
      h.controller.dispose();
    }
  },
);

test("a replacement load retires a pending count without changing the new document", async () => {
  const h = await setup();
  try {
    h.controller.stageNodeCountAdjustment(exact(0));
    const stale = [...h.timers.values()][0].callback;
    await h.load("urn:replacement");
    const replacement = h.double.observe();
    stale();
    await h.advance(3000);
    expect(h.double.observe()).toEqual(replacement);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(2);
  } finally {
    h.controller.dispose();
  }
});

test("an adjustment begun during an edit retires before the new semantic revision installs", async () => {
  const h = await setup();
  try {
    const worker = h.deferWorker("edit-model");
    const edit = h.edit();
    await worker.started.promise;
    h.controller.stageNodeCountAdjustment(exact(0));
    expect(h.double.observe().paused).toBe(true);
    worker.resolve();
    await edit;
    await h.advance(3000);
    expect(h.controller.getState().documentRevision).toBe(1);
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(2);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.double.observe().paused).toBe(false);
  } finally {
    h.controller.dispose();
  }
});

test("capture waits for count installation and its paint before acquiring the scene", async () => {
  const h = await setup();
  try {
    const paint = h.double.deferPaint();
    h.controller.stageNodeCountAdjustment(exact(1));
    const capture = h.controller.exportVisualization({ format: "vowl-json" });
    await microtasks();
    expect(h.artifacts).toHaveLength(0);
    expect(h.double.observe().paused).toBe(true);
    paint.resolve();
    await capture;
    expect(h.artifacts).toHaveLength(1);
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(1);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.double.observe().paused).toBe(false);
  } finally {
    h.controller.dispose();
  }
});

test("explicit count supersedes a draft; a filter request consumes the latest draft once", async () => {
  const h = await setup();
  try {
    h.controller.stageNodeCountAdjustment(exact(0));
    await h.controller.setVisualizationView({ nodesShown: exact(1) });
    await h.advance(3000);
    expect(h.controller.getState().view.nodesShown).toEqual(exact(1));
    h.controller.stageNodeCountAdjustment(exact(0));
    await h.controller.setVisualizationView({
      filters: { objectProperties: "hide" },
    });
    expect(h.controller.getState().view.nodesShown).toEqual(exact(0));
    expect(h.controller.getState().view.filters.objectProperties).toBe("hide");
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(0);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.timers.size).toBe(0);
  } finally {
    h.controller.dispose();
  }
});

test("failed installation recovers the accepted count and releases the automatic hold", async () => {
  const h = await setup();
  try {
    const accepted = h.double.observe().mounted;
    h.controller.stageNodeCountAdjustment(exact(1));
    h.double.failNextMutation(new Error("Count installation failed"));
    await expect(h.controller.flushNodeCountAdjustment()).rejects.toThrow(
      "Count installation failed",
    );
    expect(h.double.observe().mounted).toEqual(accepted);
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(2);
    expect(h.controller.getState().nodeCountAdjustment).toBeNull();
    expect(h.double.observe().paused).toBe(false);
  } finally {
    h.controller.dispose();
  }
});

test("an invalid or pre-aborted request cannot discard a valid draft", async () => {
  const h = await setup();
  try {
    h.controller.stageNodeCountAdjustment(exact(1));
    const state = h.controller.getState();
    await expect(
      h.controller.setVisualizationView({ nodesShown: exact(-1) }),
    ).rejects.toThrow();
    await expect(
      h.controller.setVisualizationView(
        { nodesShown: exact(0) },
        { signal: AbortSignal.abort() },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(h.controller.getState()).toBe(state);
    await h.controller.flushNodeCountAdjustment();
    expect(h.controller.getState().nodeCountStatus.shownNodeCount).toBe(1);
  } finally {
    h.controller.dispose();
  }
});
