import assert from "node:assert/strict";
import { summarizeSamples } from "./productionPerformance.mjs";

// Diagnostic instrumentation only; the uninstrumented click cohort is separate.
export async function measureProductionUiPreview({
  evaluate,
  call,
  events,
  report,
}) {
  const { root } = await call("DOM.getDocument");
  const { nodeId } = await call("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "#entity-preview",
  });
  const { node } = await call("DOM.describeNode", { nodeId });
  const layerIds = new Set();
  const compositing = [];
  events.set("LayerTree.layerTreeDidChange", (event) => {
    for (const layer of event.layers ?? []) {
      if (
        layer.backendNodeId !== node.backendNodeId ||
        layerIds.has(layer.layerId)
      )
        continue;
      layerIds.add(layer.layerId);
      compositing.push(
        call("LayerTree.compositingReasons", { layerId: layer.layerId }).then(
          (reasons) => ({ layerId: layer.layerId, ...reasons }),
          (error) => ({ layerId: layer.layerId, unavailable: error.message }),
        ),
      );
    }
  });
  await call("LayerTree.enable");
  const result = await evaluate(`(${collectPreviewFrames.toString()})()`);
  result.compositing = await Promise.all(compositing);
  await call("LayerTree.disable");
  events.delete("LayerTree.layerTreeDidChange");
  report.uiPreview = result;
  assert(
    result.anchorDurations.length >= 20,
    "Observe actual production preview callbacks",
  );
  result.anchorSummary = summarizeSamples(result.anchorDurations);
  result.anchorSummary.maximumMs = Math.max(...result.anchorDurations);
  result.frameSummary = summarizeSamples(result.frameIntervals);
  assert(result.maximumAnimations <= 1, "Preview animations must not queue");
  assert.equal(
    result.foregroundLost,
    false,
    "Preview diagnostic lost foreground",
  );
  assert(
    result.zoom.after > result.zoom.before,
    "The zoom phase must move the viewport, not remain at its lower bound",
  );
  assert(
    result.anchorDurations.length > result.phases.at(-1).anchorStart,
    "The moving viewport must update preview geometry",
  );
  // Preserve measured misses for disposition; do not relabel them as acceptance.
}

async function collectPreviewFrames() {
  const {
    document,
    performance,
    Element,
    requestAnimationFrame,
    cancelAnimationFrame,
  } = globalThis;
  const c = globalThis.__webvowlMeasuredApplication.getWebVowlController();
  const preview = document.getElementById("entity-preview");
  const graph = document.getElementById("graph");
  const entries = c.getVisualizationArrangement({ limit: 100 }).occurrences;
  const anchorDurations = [];
  const frameIntervals = [];
  const identified = new WeakMap();
  const callbackSources = [];
  const pending = new Set();
  let scheduled = 0;
  let cancelled = 0;
  let previousFrame;
  let phase = "running layout";
  const phases = [];
  const phaseStart = () => ({
    name: phase,
    anchorStart: anchorDurations.length,
    frameStart: frameIntervals.length,
    layoutStatus: c.getState().layout.status,
  });
  let maximumAnimations = 0;
  let occludedFrames = 0;
  const overlaps = [];
  let foregroundLost = false;
  const nativeAnimate = Element.prototype.animate;
  let animationStarts = 0;
  Element.prototype.animate = function (...args) {
    if (this === preview) animationStarts++;
    return nativeAnimate.apply(this, args);
  };
  globalThis.requestAnimationFrame = (callback) => {
    if (!identified.has(callback)) {
      const source = callback.toString();
      callbackSources.push(source);
      identified.set(callback, source.includes("--entity-preview-transform"));
    }
    if (!identified.get(callback))
      return requestAnimationFrame.call(globalThis, callback);
    scheduled++;
    const id = requestAnimationFrame.call(globalThis, (timestamp) => {
      pending.delete(id);
      const start = performance.now();
      callback(timestamp);
      anchorDurations.push(performance.now() - start);
    });
    pending.add(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    if (pending.delete(id)) cancelled++;
    return cancelAnimationFrame.call(globalThis, id);
  };
  function frame() {
    return new Promise((done) =>
      requestAnimationFrame.call(globalThis, (timestamp) => {
        if (previousFrame !== undefined)
          frameIntervals.push(timestamp - previousFrame);
        previousFrame = timestamp;
        foregroundLost ||=
          document.visibilityState !== "visible" || !document.hasFocus();
        maximumAnimations = Math.max(
          maximumAnimations,
          preview.getAnimations().length,
        );
        const anchor = c.getSelectedVisualizationOccurrence();
        if (anchor && !preview.hidden) {
          const card = preview.getBoundingClientRect();
          const host = graph.getBoundingClientRect();
          const left = host.left + anchor.xPx - anchor.widthPx / 2;
          const top = host.top + anchor.yPx - anchor.heightPx / 2;
          if (
            card.left < left + anchor.widthPx &&
            card.right > left &&
            card.top < top + anchor.heightPx &&
            card.bottom > top
          ) {
            occludedFrames++;
            overlaps.push({
              callbackCount: anchorDurations.length,
              phase,
              card: card.toJSON(),
              anchor,
              animations: preview.getAnimations().map((animation) => ({
                currentTime: animation.currentTime,
                playState: animation.playState,
              })),
              note: document.getElementById("entity-preview-visibility")
                .textContent,
            });
          }
        }
        done();
      }),
    );
  }
  try {
    phases.push(phaseStart());
    c.setGraphLayoutPaused({ isPaused: false });
    for (let i = 0; i < 60; i++) await frame();
    c.setGraphLayoutPaused({ isPaused: true });
    phase = "paused rapid selection";
    phases.push(phaseStart());
    for (let i = 0; i < 60; i++) {
      await c.selectVisualizationElement({
        reference: entries[i % entries.length].reference,
      });
      await frame();
      await frame();
      await frame();
    }
    for (let i = 0; i < 20; i++) await frame();
    phase = "paused continuous zoom";
    phases.push(phaseStart());
    // Real viewport notifications exercise the coalesced geometry path even
    // when a semantic presentation places itself immediately before paint.
    const zoomBefore = c.getState().zoomScale;
    c.setContinuousZoom({ zoomDirection: "in" });
    for (let i = 0; i < 60; i++) await frame();
    c.setContinuousZoom({ zoomDirection: "none" });
    for (let i = 0; i < 4; i++) await frame();
    return {
      anchorDurations,
      phases,
      callbackSources,
      scheduled,
      cancelled,
      pending: pending.size,
      previewHidden: preview.hidden,
      frameIntervals,
      maximumAnimations,
      animationStarts,
      occludedFrames,
      overlaps,
      foregroundLost,
      zoom: { before: zoomBefore, after: c.getState().zoomScale },
      limitation:
        "Instrumented coalesced geometry callback wall time; initial semantic presentation is covered by the separate click-to-paint cohort. This observer's geometry reads occur outside the timed callback. Frame intervals include graph work. Layer reasons establish observed compositing, not a general device guarantee.",
    };
  } finally {
    c.setContinuousZoom({ zoomDirection: "none" });
    globalThis.requestAnimationFrame = requestAnimationFrame;
    globalThis.cancelAnimationFrame = cancelAnimationFrame;
    Element.prototype.animate = nativeAnimate;
  }
}
