import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let createGraphLayoutSettler;
let createGraphLayoutSnapshot;

const SETTLER_MODULE_URL = new URL("./graphLayoutSettler.js", import.meta.url);
const RENDERED_GRAPH_CONTRACTS_MODULE_URL = new URL(
  "./renderedGraphRuntimeContracts.js",
  import.meta.url,
);
const WEB_VOWL_CONTRACTS_MODULE_URL = new URL(
  "./webVowlControllerContracts.js",
  import.meta.url,
);

const LOAD_GENERATION = 3;
const SETTLE_TIMEOUT_MS = 12000;
const REQUIRED_STABLE_FRAME_COUNT = 8;

beforeAll(async () => {
  const webVowlContractsModule = new SourceTextModule(
    readFileSync(fileURLToPath(WEB_VOWL_CONTRACTS_MODULE_URL), "utf8"),
    { identifier: WEB_VOWL_CONTRACTS_MODULE_URL.href },
  );
  await webVowlContractsModule.link((specifier) => {
    throw new Error(`Unexpected layout contract dependency: ${specifier}`);
  });
  await webVowlContractsModule.evaluate();

  const renderedGraphContractsModule = new SourceTextModule(
    readFileSync(fileURLToPath(RENDERED_GRAPH_CONTRACTS_MODULE_URL), "utf8"),
    { identifier: RENDERED_GRAPH_CONTRACTS_MODULE_URL.href },
  );
  await renderedGraphContractsModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected rendered-graph dependency: ${specifier}`);
  });
  await renderedGraphContractsModule.evaluate();

  const settlerModule = new SourceTextModule(
    readFileSync(fileURLToPath(SETTLER_MODULE_URL), "utf8"),
    { identifier: SETTLER_MODULE_URL.href },
  );
  await settlerModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected graph layout settler dependency: ${specifier}`);
  });
  await settlerModule.evaluate();

  ({ createGraphLayoutSnapshot } = renderedGraphContractsModule.namespace);
  ({ createGraphLayoutSettler } = settlerModule.namespace);
});

function layoutSnapshot({
  loadGeneration = LOAD_GENERATION,
  forceAlpha = 0.004,
  hasEnded = false,
  isPaused = false,
  positions = [
    { stableLayoutElementKey: "class:Person", x: 10, y: 20 },
    { stableLayoutElementKey: "class:Organisation", x: 40, y: 60 },
  ],
  observedAtMs = 0,
} = {}) {
  return createGraphLayoutSnapshot({
    loadGeneration,
    observedAtMs,
    forceAlpha,
    hasEnded,
    isPaused,
    widthPx: 960,
    heightPx: 640,
    layoutElementPositions: positions,
  });
}

function createFrameSchedulerFixture() {
  let nextFrameHandle = 1;
  const pendingFrameCallbacks = new Map();
  const cancelledFrameHandles = [];

  return {
    cancelledFrameHandles,
    requestAnimationFrame(frameCallback) {
      const frameHandle = nextFrameHandle;
      nextFrameHandle += 1;
      pendingFrameCallbacks.set(frameHandle, frameCallback);
      return frameHandle;
    },
    cancelAnimationFrame(frameHandle) {
      cancelledFrameHandles.push(frameHandle);
      pendingFrameCallbacks.delete(frameHandle);
    },
    get pendingFrameCount() {
      return pendingFrameCallbacks.size;
    },
    runNextFrame() {
      const [frameHandle, frameCallback] = [
        ...pendingFrameCallbacks.entries(),
      ][0];
      pendingFrameCallbacks.delete(frameHandle);
      frameCallback();
    },
    async runFrames(frameCount) {
      for (
        let executedFrameCount = 0;
        executedFrameCount < frameCount;
        executedFrameCount += 1
      ) {
        if (this.pendingFrameCount === 0) {
          return;
        }
        this.runNextFrame();
        await Promise.resolve();
      }
    },
  };
}

describe("generation-scoped graph layout settlement", () => {
  let currentTimeMs;
  let frameScheduler;
  let publishedLayoutEvent;
  let readGraphLayoutSnapshot;
  let snapshotReadCount;
  let unsubscribeCallCount;

  beforeEach(() => {
    currentTimeMs = 1000;
    frameScheduler = createFrameSchedulerFixture();
    snapshotReadCount = 0;
    unsubscribeCallCount = 0;
    publishedLayoutEvent = undefined;
    readGraphLayoutSnapshot = () => {
      snapshotReadCount += 1;
      return layoutSnapshot();
    };
  });

  function createSettler() {
    return createGraphLayoutSettler({
      requestAnimationFrame: frameScheduler.requestAnimationFrame,
      cancelAnimationFrame: frameScheduler.cancelAnimationFrame,
      nowMs: () => currentTimeMs,
    });
  }

  function waitForSettledLayout(overrides = {}, options = {}) {
    return createSettler().waitForSettledGraphLayout(
      {
        loadGeneration: LOAD_GENERATION,
        readGraphLayoutSnapshot: () => readGraphLayoutSnapshot(),
        settleTimeoutMs: SETTLE_TIMEOUT_MS,
        ...overrides,
      },
      options,
    );
  }

  function subscribeToGraphLayoutEvents(onGraphLayoutEvent) {
    publishedLayoutEvent = onGraphLayoutEvent;
    return () => {
      unsubscribeCallCount += 1;
    };
  }

  test("settles immediately when the force reports its native end", async () => {
    readGraphLayoutSnapshot = () => layoutSnapshot({ hasEnded: true });

    const settlementPromise = waitForSettledLayout();
    await frameScheduler.runFrames(1);

    await expect(settlementPromise).resolves.toEqual({
      loadGeneration: LOAD_GENERATION,
      status: "settled",
      reason: "native-end",
    });
  });

  test("settles after exactly eight consecutive stable frames", async () => {
    const settlementPromise = waitForSettledLayout();
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );

    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT);
    expect(isSettled).toBe(false);

    await frameScheduler.runFrames(1);
    await expect(settlementPromise).resolves.toEqual({
      loadGeneration: LOAD_GENERATION,
      status: "settled",
      reason: "stable-frames",
    });
  });

  test("does not count a frame whose force alpha exceeds the threshold", async () => {
    let observedFrameCount = 0;
    readGraphLayoutSnapshot = () => {
      observedFrameCount += 1;
      return layoutSnapshot({
        forceAlpha: observedFrameCount <= 4 ? 0.5 : 0.005,
      });
    };

    const settlementPromise = waitForSettledLayout();
    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT + 3);
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );
    await Promise.resolve();

    expect(isSettled).toBe(false);
    await frameScheduler.runFrames(1);
    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "stable-frames" }),
    );
  });

  test("does not count a frame whose displacement exceeds the threshold", async () => {
    let observedFrameCount = 0;
    readGraphLayoutSnapshot = () => {
      observedFrameCount += 1;
      return layoutSnapshot({
        positions: [
          {
            stableLayoutElementKey: "class:Person",
            x: 10 + observedFrameCount * 2,
            y: 20,
          },
          { stableLayoutElementKey: "class:Organisation", x: 40, y: 60 },
        ],
      });
    };

    const settlementPromise = waitForSettledLayout();
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );
    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT + 6);

    expect(isSettled).toBe(false);
    currentTimeMs += SETTLE_TIMEOUT_MS + 1;
    await frameScheduler.runFrames(1);
    await expect(settlementPromise).rejects.toEqual(
      expect.objectContaining({ code: "LAYOUT_TIMEOUT" }),
    );
  });

  test("accepts displacement at the inclusive half-unit threshold", async () => {
    let observedFrameCount = 0;
    readGraphLayoutSnapshot = () => {
      observedFrameCount += 1;
      return layoutSnapshot({
        positions: [
          {
            stableLayoutElementKey: "class:Person",
            x: 10 + observedFrameCount * 0.5,
            y: 20,
          },
        ],
      });
    };

    const settlementPromise = waitForSettledLayout();
    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT + 1);

    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "stable-frames" }),
    );
  });

  test("resets the stable-frame counter when the layout key set changes", async () => {
    let observedFrameCount = 0;
    readGraphLayoutSnapshot = () => {
      observedFrameCount += 1;
      return layoutSnapshot({
        positions:
          observedFrameCount === 5
            ? [{ stableLayoutElementKey: "class:Person", x: 10, y: 20 }]
            : undefined,
      });
    };

    const settlementPromise = waitForSettledLayout();
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );

    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT);
    expect(isSettled).toBe(false);

    await frameScheduler.runFrames(6);
    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "stable-frames" }),
    );
  });

  test("ignores a stale-generation snapshot instead of counting it", async () => {
    let observedFrameCount = 0;
    readGraphLayoutSnapshot = () => {
      observedFrameCount += 1;
      return layoutSnapshot({
        loadGeneration:
          observedFrameCount <= 3 ? LOAD_GENERATION - 1 : LOAD_GENERATION,
      });
    };

    const settlementPromise = waitForSettledLayout();
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );

    await frameScheduler.runFrames(REQUIRED_STABLE_FRAME_COUNT);
    expect(isSettled).toBe(false);

    await frameScheduler.runFrames(4);
    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "stable-frames" }),
    );
  });

  test("stops waiting when a newer load generation supersedes the request", async () => {
    readGraphLayoutSnapshot = () =>
      layoutSnapshot({ loadGeneration: LOAD_GENERATION + 1 });

    const settlementPromise = waitForSettledLayout();
    await frameScheduler.runFrames(1);

    await expect(settlementPromise).rejects.toEqual(
      expect.objectContaining({ code: "LOAD_ABORTED" }),
    );
    expect(frameScheduler.pendingFrameCount).toBe(0);
  });

  test("stops waiting when the caller aborts", async () => {
    const cancellationController = new AbortController();

    const settlementPromise = waitForSettledLayout(
      {},
      { signal: cancellationController.signal },
    );
    await frameScheduler.runFrames(2);
    cancellationController.abort();
    await Promise.resolve();

    await expect(settlementPromise).rejects.toEqual(
      expect.objectContaining({ code: "LOAD_ABORTED" }),
    );
    expect(frameScheduler.pendingFrameCount).toBe(0);
    expect(frameScheduler.cancelledFrameHandles.length).toBeGreaterThan(0);
  });

  test("rejects an already aborted caller signal before scheduling a frame", async () => {
    const cancellationController = new AbortController();
    cancellationController.abort();

    await expect(
      waitForSettledLayout({}, { signal: cancellationController.signal }),
    ).rejects.toEqual(expect.objectContaining({ code: "LOAD_ABORTED" }));
    expect(frameScheduler.pendingFrameCount).toBe(0);
    expect(snapshotReadCount).toBe(0);
  });

  test("fails with LAYOUT_TIMEOUT once the settle budget elapses", async () => {
    readGraphLayoutSnapshot = () => layoutSnapshot({ forceAlpha: 0.9 });

    const settlementPromise = waitForSettledLayout({ onTimeout: "fail" });
    await frameScheduler.runFrames(2);
    currentTimeMs += SETTLE_TIMEOUT_MS + 1;
    await frameScheduler.runFrames(1);

    await expect(settlementPromise).rejects.toEqual(
      expect.objectContaining({
        code: "LAYOUT_TIMEOUT",
        details: { settleTimeoutMs: SETTLE_TIMEOUT_MS },
      }),
    );
    expect(frameScheduler.pendingFrameCount).toBe(0);
  });

  test("returns an explicit best-effort outcome when the caller allows it", async () => {
    readGraphLayoutSnapshot = () => layoutSnapshot({ forceAlpha: 0.9 });

    const settlementPromise = waitForSettledLayout({
      onTimeout: "best-effort",
    });
    await frameScheduler.runFrames(2);
    currentTimeMs += SETTLE_TIMEOUT_MS + 1;
    await frameScheduler.runFrames(1);

    await expect(settlementPromise).resolves.toEqual({
      loadGeneration: LOAD_GENERATION,
      status: "best-effort",
      reason: "timeout",
    });
  });

  test("settles from a native-end layout event without awaiting a frame", async () => {
    readGraphLayoutSnapshot = () => layoutSnapshot({ hasEnded: false });

    const settlementPromise = waitForSettledLayout({
      subscribeToGraphLayoutEvents,
    });
    readGraphLayoutSnapshot = () => layoutSnapshot({ hasEnded: true });
    publishedLayoutEvent({
      kind: "graph-layout-state-changed",
      loadGeneration: LOAD_GENERATION,
    });

    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "native-end" }),
    );
    expect(unsubscribeCallCount).toBe(1);
    expect(frameScheduler.pendingFrameCount).toBe(0);
  });

  test("releases its frame and listener on every exit path", async () => {
    readGraphLayoutSnapshot = () => layoutSnapshot({ hasEnded: true });

    const settlementPromise = waitForSettledLayout({
      subscribeToGraphLayoutEvents,
    });
    await frameScheduler.runFrames(1);

    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "native-end" }),
    );
    expect(unsubscribeCallCount).toBe(1);
    expect(frameScheduler.pendingFrameCount).toBe(0);
  });

  test("ignores a layout event published for another load generation", async () => {
    const settlementPromise = waitForSettledLayout({
      subscribeToGraphLayoutEvents,
    });
    readGraphLayoutSnapshot = () => layoutSnapshot({ hasEnded: true });
    publishedLayoutEvent({
      kind: "graph-layout-state-changed",
      loadGeneration: LOAD_GENERATION + 1,
    });
    let isSettled = false;
    settlementPromise.then(
      () => {
        isSettled = true;
      },
      () => undefined,
    );
    await Promise.resolve();

    expect(isSettled).toBe(false);
    await frameScheduler.runFrames(1);
    await expect(settlementPromise).resolves.toEqual(
      expect.objectContaining({ reason: "native-end" }),
    );
  });
});

describe("graph layout settler boundary", () => {
  test("rejects dependencies outside the injected frame and clock interface", () => {
    expect(() =>
      createGraphLayoutSettler({
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => undefined,
        nowMs: () => 0,
        graph: { force: () => undefined },
      }),
    ).toThrow("invalid dependency field set");
  });

  test("rejects an unsupported timeout disposition", () => {
    const frameScheduler = createFrameSchedulerFixture();
    const settler = createGraphLayoutSettler({
      requestAnimationFrame: frameScheduler.requestAnimationFrame,
      cancelAnimationFrame: frameScheduler.cancelAnimationFrame,
      nowMs: () => 0,
    });

    expect(() =>
      settler.waitForSettledGraphLayout({
        loadGeneration: LOAD_GENERATION,
        readGraphLayoutSnapshot: () => layoutSnapshot(),
        settleTimeoutMs: SETTLE_TIMEOUT_MS,
        onTimeout: "retry",
      }),
    ).toThrow("onTimeout");
  });

  test("names no D3 or ambient browser global in its source", () => {
    const settlerSource = readFileSync(
      fileURLToPath(SETTLER_MODULE_URL),
      "utf8",
    );

    for (const forbiddenIdentifier of [
      "d3",
      "window",
      "document",
      "globalThis",
      "setTimeout",
    ]) {
      expect(settlerSource).not.toMatch(
        new RegExp(`(?<![\\w$])${forbiddenIdentifier}(?![\\w$])`, "u"),
      );
    }
  });
});
