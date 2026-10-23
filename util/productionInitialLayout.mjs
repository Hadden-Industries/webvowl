import assert from "node:assert/strict";
import { summarizeSamples } from "./productionPerformance.mjs";

export function initialLayoutOutcome(row) {
  assert(
    Number.isFinite(row.seedMs) && row.seedMs >= 0,
    "Missing seed duration",
  );
  assert(
    Number.isFinite(row.usableFrameMs) && row.usableFrameMs >= row.seedMs,
    "Admitted-data boundary must include the seed duration",
  );
  assert(
    row.nodeCount > 0 &&
      ["relaxing", "settled"].includes(row.layoutBefore.status),
    "Ordinary load must have visible nodes and running layout intent",
  );
  assert(
    row.intervals.every(
      (interval) => Number.isFinite(interval) && interval >= 0,
    ),
    "Animation-frame timestamps must be ordered",
  );
  const settled = row.layoutAfter.status === "settled";
  const frameIntervals = row.intervals.length
    ? summarizeSamples(row.intervals)
    : null;
  // Frame count is not the count of independent load runs required for p95
  // acceptance. Keep these useful per-run distributions explicitly separate.
  if (frameIntervals) delete frameIntervals.acceptanceSampleCount;
  return {
    statisticalUnit: "one load run",
    settled,
    naturalEarlyCompletion: settled && row.elapsedMs < 5000,
    observedMovement: row.changedFrames > 0,
    alreadySettledAtFirstFrame: row.layoutBefore.status === "settled",
    frameIntervals,
    withinSettlementTarget: settled && row.settlementMs <= 12000,
  };
}

// This observer never pauses/resumes or reheats the ordinary initial layout.
// It reads transform attributes during activity; glyph bounds are read once.
async function observeInitialLayout() {
  const { document, requestAnimationFrame, cancelAnimationFrame } = globalThis;
  const controller =
    globalThis.__webvowlMeasuredApplication.getWebVowlController();
  const placement = performance
    .getEntriesByName("webvowl.initial-placement")
    .at(-1);
  const usable = performance
    .getEntriesByName("webvowl.initial-usable-drawing")
    .at(-1);
  if (
    !placement ||
    !usable ||
    placement.detail.loadGeneration !== usable.detail.loadGeneration
  ) {
    throw new Error(
      "The candidate must expose the admitted-data and seed boundaries",
    );
  }
  const allNodes = [
    ...document.querySelectorAll("#graph .nodeContainer > .node"),
  ];
  const sampled = allNodes.slice(0, 8);
  const transforms = () =>
    sampled.map((node) => node.getAttribute("transform"));
  const viewport = document.querySelector("#graph svg").getBoundingClientRect();
  const boxes = allNodes.map((node) => node.getBoundingClientRect());
  const initialOutsideViewport = boxes.filter(
    (box) =>
      box.right < viewport.left ||
      box.left > viewport.right ||
      box.bottom < viewport.top ||
      box.top > viewport.bottom,
  ).length;
  let previous = transforms();
  let foregroundLost = false;
  const checkForeground = () => {
    foregroundLost ||=
      document.visibilityState !== "visible" || !document.hasFocus();
  };
  document.addEventListener("visibilitychange", checkForeground);
  globalThis.addEventListener("blur", checkForeground);
  checkForeground();
  const start = performance.now();
  const layoutBefore = controller.getState().layout;
  let layoutAfter = layoutBefore;
  let last;
  let changedFrames = 0;
  const intervals = [];
  let frame;
  let deadline;
  try {
    if (layoutBefore.status !== "settled") {
      await new Promise((resolve) => {
        const readFrame = (at) => {
          // Callback-entry time may be later than its frame's timestamp.
          // Establish a frame baseline before comparing successive frames.
          if (last !== undefined) intervals.push(at - last);
          last = at;
          const current = transforms();
          if (current.some((value, index) => value !== previous[index]))
            changedFrames++;
          previous = current;
          layoutAfter = controller.getState().layout;
          if (
            layoutAfter.status === "settled" ||
            at - usable.startTime >= 12000
          )
            resolve();
          else frame = requestAnimationFrame(readFrame);
        };
        frame = requestAnimationFrame(readFrame);
        deadline = setTimeout(
          resolve,
          Math.max(0, 12000 - (start - usable.startTime)),
        );
      });
    }
    const end = performance.now();
    layoutAfter = controller.getState().layout;
    return {
      seedMs: placement.duration,
      usableFrameMs: usable.duration,
      elapsedMs: end - start,
      settlementMs: end - usable.startTime,
      nodeCount: allNodes.length,
      sampledNodes: sampled.length,
      layoutBefore,
      layoutAfter,
      nodeCountAfter: controller.getState().nodeCountStatus,
      initialNodesRetained:
        allNodes.every((node) => node.isConnected) &&
        document.querySelectorAll("#graph .nodeContainer > .node").length ===
          allNodes.length,
      intervals,
      changedFrames,
      foregroundLost,
      initialOutsideViewport,
      viewport: { width: viewport.width, height: viewport.height },
      seedGeneration: placement.detail.loadGeneration,
    };
  } finally {
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    document.removeEventListener("visibilitychange", checkForeground);
    globalThis.removeEventListener("blur", checkForeground);
  }
}

export async function measureProductionInitialLayout({
  evaluate,
  measure,
  report,
  schedule,
  requireForeground,
  capture,
}) {
  report.operationScope =
    "Ordinary source load with automatic running layout; no pause/resume before observation";
  report.initialLayout = {
    runs: [],
    qualification:
      "Per-run observations; acceptance also requires matched cohorts and foreground admission",
  };
  for (const { label, index, warmup } of schedule) {
    report.activeCohort = { label, index, warmup };
    const load = await measure(
      "initial-running-load",
      "__webvowlMeasurement.load({running:true})",
      label,
      warmup,
    );
    const observation = await evaluate(
      `(${observeInitialLayout.toString()})()`,
    );
    const run = {
      cohort: label,
      index,
      warmup,
      sourceToFrameMs: load.durationMs,
      ...observation,
    };
    report.initialLayout.runs.push(run);
    run.outcome = initialLayoutOutcome(observation);
    if (requireForeground)
      assert(
        !observation.foregroundLost,
        "Foreground changed during initial layout",
      );
    // Stop only after the observed natural settlement or retained deadline result.
    await evaluate(
      "globalThis.__webvowlMeasuredApplication.getWebVowlController().setGraphLayoutPaused({isPaused:true})",
    );
    if (capture) run.diagnosticScreenshotAfterObservation = await capture();
  }
}
