import { placeEntityPreview } from "./previewPlacement.js";

/** One frame-coalesced observer. Only HTML boxes are measured, on resize. */
export function createSelectedOccurrencePreview({
  controller,
  documentObject = document,
  windowObject = window,
}) {
  const doc = documentObject;
  const preview = doc.getElementById("entity-preview");
  const host = doc.getElementById("graph");
  const canvas = doc.getElementById("canvasArea");
  const note = doc.getElementById("entity-preview-visibility");
  const lifecycle = new AbortController();
  const reduced = windowObject.matchMedia("(prefers-reduced-motion: reduce)");
  let frame;
  let observation;
  let position;
  let animation;
  let dimensions;
  let shouldMeasure = true;
  let previousOccurrence;
  let shown = false;
  function suspend() {
    if (frame !== undefined) {
      windowObject.cancelAnimationFrame(frame);
      frame = undefined;
    }
    animation?.cancel();
    animation = undefined;
    shown = false;
    position = undefined;
  }
  function schedule() {
    if (doc.hidden || preview.hidden || lifecycle.signal.aborted) {
      suspend();
      return;
    }
    if (frame === undefined) {
      frame = windowObject.requestAnimationFrame(update);
    }
  }
  function measure() {
    const graph = host.getBoundingClientRect();
    const parent = canvas.getBoundingClientRect();
    const viewport = windowObject.visualViewport;
    const top = Math.max(0, (viewport?.offsetTop ?? 0) - graph.top);
    const controls = [
      doc.getElementById("zoomSlider"),
      doc.activeElement,
    ].filter(
      (element) =>
        element &&
        element !== doc.body &&
        element !== doc.documentElement &&
        !preview.contains(element),
    );
    const obstacles = controls
      .filter((element) => element.getClientRects().length)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.left - graph.left,
          y: box.top - graph.top,
          width: box.width,
          height: box.height,
        };
      });
    dimensions = {
      width: Math.min(graph.width, viewport?.width ?? graph.width),
      height: Math.min(graph.height, (viewport?.height ?? graph.height) + top),
      cardWidth: preview.offsetWidth,
      cardHeight: preview.offsetHeight,
      left: graph.left - parent.left,
      top: graph.top - parent.top,
      topInset: Math.max(64, top + 12),
      obstacles,
    };
    shouldMeasure = false;
  }
  function update() {
    frame = undefined;
    if (doc.hidden || preview.hidden) {
      suspend();
      return;
    }
    const state = controller.getState();
    const anchor =
      observation?.loadGeneration === state.loadGeneration &&
      observation?.documentRevision === state.documentRevision &&
      state.selection.length
        ? observation
        : null;
    if (shouldMeasure || !dimensions) {
      measure();
    }
    const changed = previousOccurrence !== anchor?.reference.occurrenceId;
    if (changed) {
      position = undefined;
    }
    previousOccurrence = anchor?.reference.occurrenceId;
    const next = placeEntityPreview({
      ...dimensions,
      anchor,
      compact: windowObject.innerWidth <= 1024,
      previous: position,
    });
    const message = !anchor
      ? "Not shown in the current view"
      : next.offscreen
        ? "Selected item is outside the visible graph"
        : next.overlapsAnchor
          ? "At this zoom the preview may overlap the item. Open Details for more room."
          : anchor.occurrenceCount > 1
            ? `Drawn ${anchor.occurrenceCount} times`
            : "";
    if (note.textContent !== message) {
      note.textContent = message;
      shouldMeasure = true;
    }
    if (anchor) {
      preview.dataset.shape =
        anchor.shape === "ellipse" ? "round" : "rectangle";
    }
    const canAnimate =
      anchor &&
      !next.offscreen &&
      !next.overlapsAnchor &&
      !reduced.matches &&
      typeof preview.animate === "function" &&
      !preview.contains(doc.activeElement);
    if (!canAnimate) {
      animation?.cancel();
      animation = undefined;
    }
    const moved = !position || position.x !== next.x || position.y !== next.y;
    if (moved || !shown) {
      const target = `translate(${next.x + dimensions.left}px, ${next.y + dimensions.top}px)`;
      const from = shown
        ? windowObject.getComputedStyle(preview).transform
        : target + " scale(0.97)";
      animation?.cancel();
      preview.style.setProperty("--entity-preview-transform", target);
      if (canAnimate) {
        animation = preview.animate(
          [
            { transform: from, opacity: shown ? 1 : 0 },
            { transform: target, opacity: 1 },
          ],
          { duration: 200, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
      }
      position = next;
      shown = true;
    }
  }
  function refresh() {
    shouldMeasure = true;
    if (doc.hidden || preview.hidden) {
      suspend();
      return;
    }
    try {
      observation = controller.getSelectedVisualizationOccurrence();
    } catch (error) {
      if (!["LOAD_PENDING", "NO_ONTOLOGY"].includes(error.code)) {
        throw error;
      }
      observation = null;
    }
    schedule();
  }
  const unsubscribe = controller.subscribeToSelectedVisualizationOccurrence(
    (value) => {
      observation = value;
      schedule();
    },
  );
  const resizeObserver = new windowObject.ResizeObserver(() => {
    shouldMeasure = true;
    schedule();
  });
  resizeObserver.observe(host);
  resizeObserver.observe(preview);
  const on = (target, event, listener) =>
    target.addEventListener(event, listener, { signal: lifecycle.signal });
  on(windowObject, "resize", refresh);
  on(doc, "focusin", () => {
    shouldMeasure = true;
    schedule();
  });
  if (windowObject.visualViewport) {
    on(windowObject.visualViewport, "resize", refresh);
    on(windowObject.visualViewport, "scroll", refresh);
  }
  on(reduced, "change", () => {
    animation?.cancel();
    schedule();
  });
  on(doc, "visibilitychange", () => {
    if (doc.hidden) {
      suspend();
    } else {
      refresh();
    }
  });
  return Object.freeze({
    refresh,
    dispose() {
      lifecycle.abort();
      unsubscribe();
      resizeObserver.disconnect();
      suspend();
      observation = undefined;
      position = undefined;
    },
  });
}
