import { buildRenderedSvgPanSnapshot } from "./renderedSvgPanSnapshot.js";

// One mount owns one cache. Geometry/appearance changes retire its generation;
// asynchronous completion can publish only into that exact live generation.
export function createRenderedGraphPanCache({
  svg,
  scene,
  isStable,
  readViewport,
  buildSnapshot = buildRenderedSvgPanSnapshot,
}) {
  const document = svg.ownerDocument;
  const view = document?.defaultView;
  const inert = {
    refresh() {},
    invalidate() {},
    beginPan() {},
    viewportChanged() {},
    endPan() {},
    dispose() {},
    withLiveDrawing: (callback) => callback(),
  };
  if (
    !view?.MutationObserver ||
    !view.Image?.prototype.decode ||
    !view.URL?.createObjectURL ||
    !view.AbortController ||
    !view.CSS?.supports?.("clip-path", "inset(50%) view-box")
  ) {
    return inert;
  }

  let disposed = false,
    panning = false,
    timer,
    job,
    ready,
    attemptedViewport,
    hidingSvg = false;
  let revision = 0,
    failedRevision = -1,
    observing = false;
  const cleanups = [];
  const parent = svg.parentElement;
  const positioned = view.getComputedStyle(parent).position === "static";
  if (positioned) {
    parent.classList.add("vowl-pan-cache-host");
  }

  const sceneObserver = new view.MutationObserver(onSceneMutation);
  const appearanceObserver = new view.MutationObserver(invalidate);
  for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
    appearanceObserver.observe(ancestor, { attributes: true, childList: true });
  }
  if (document.head) {
    appearanceObserver.observe(document.head, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    cleanups.push(() => target?.removeEventListener?.(type, listener, options));
  }
  for (const type of ["pointerover", "pointerout"]) {
    listen(
      svg,
      type,
      (event) => {
        // Background entry has no scene hover appearance. In particular, a
        // touch pointer enters the viewport immediately before starting a pan.
        if (!panning && event.target !== svg) {
          invalidate();
        }
      },
      true,
    );
  }
  // Pressing the viewport focuses the SVG itself. Its outer focus decoration
  // remains live; only focus changes within the cached drawing retire it.
  for (const type of ["focusin", "focusout"]) {
    listen(
      svg,
      type,
      (event) => {
        if (event.target !== svg) {
          invalidate();
        }
      },
      true,
    );
  }
  for (const type of [
    "animationstart",
    "animationend",
    "animationcancel",
    "transitionrun",
    "transitionend",
    "transitioncancel",
  ]) {
    listen(svg, type, invalidate, true);
  }
  listen(document, "visibilitychange", invalidate);
  listen(
    document,
    "load",
    (event) => {
      if (event.target?.localName === "link") {
        invalidate();
      }
    },
    true,
  );
  for (const type of ["loading", "loadingdone", "loadingerror"]) {
    listen(document.fonts, type, invalidate);
  }
  listen(view, "resize", invalidate);
  listen(view, "pagehide", invalidate);
  listen(view, "beforeprint", invalidate);
  const resizeObserver = view.ResizeObserver
    ? new view.ResizeObserver(invalidate)
    : undefined;
  resizeObserver?.observe(svg);
  for (const query of [
    "(prefers-color-scheme: dark)",
    "(forced-colors: active)",
    "(prefers-contrast: more)",
  ]) {
    listen(view.matchMedia?.(query), "change", invalidate);
  }
  let resolution;
  function resolutionChanged() {
    resolution?.removeEventListener("change", resolutionChanged);
    resolution = view.matchMedia?.(
      `(resolution: ${view.devicePixelRatio}dppx)`,
    );
    resolution?.addEventListener("change", resolutionChanged);
    invalidate();
  }
  resolutionChanged();

  function eligible() {
    return (
      !disposed &&
      svg.isConnected &&
      document.visibilityState !== "hidden" &&
      document.fonts?.status !== "loading" &&
      isStable()
    );
  }
  function hasAnimation() {
    return svg
      .getAnimations?.({ subtree: true })
      .some(
        (animation) =>
          animation.playState === "running" ||
          animation.playState === "pending",
      );
  }
  function viewport() {
    return {
      ...readViewport(),
      width: Number(svg.getAttribute("width")),
      height: Number(svg.getAttribute("height")),
      dpr: view.devicePixelRatio || 1,
    };
  }
  function sameRasterViewport(base, current) {
    return (
      current.width === base.width &&
      current.height === base.height &&
      current.dpr === base.dpr &&
      Math.fround(current.k) === Math.fround(base.k)
    );
  }
  function fits(snapshot, current) {
    const base = snapshot.viewport;
    return (
      sameRasterViewport(base, current) &&
      Math.abs(current.x - base.x) <= snapshot.padding &&
      Math.abs(current.y - base.y) <= snapshot.padding
    );
  }
  function cancelBuild() {
    if (timer !== undefined) {
      view.clearTimeout(timer);
    }
    timer = undefined;
    const previous = job;
    job = undefined;
    if (previous) {
      view.clearTimeout(previous.timeout);
    }
    previous?.controller.abort();
  }
  function restoreSvg() {
    if (ready) {
      ready.canvas.hidden = true;
    }
    if (hidingSvg) {
      scene.classList.remove("vowl-pan-cache-active");
      hidingSvg = false;
      // Only this synchronous write is owned here; earlier records are flushed
      // before showing/exporting, so a user mutation cannot be discarded here.
      sceneObserver.takeRecords();
    }
  }
  function clearReady() {
    restoreSvg();
    ready?.dispose();
    ready = undefined;
    appearanceObserver.takeRecords(); // removal of our own sibling canvas
  }
  function invalidate() {
    if (disposed) {
      return;
    }
    revision++;
    cancelBuild();
    clearReady();
    refresh();
  }
  function onSceneMutation(records) {
    const changed = records.filter(
      (record) =>
        record.type !== "attributes" ||
        record.target.getAttribute(record.attributeName) !== record.oldValue,
    );
    if (
      changed.some(
        (record) =>
          record.target !== scene || record.attributeName !== "transform",
      )
    ) {
      invalidate();
    } else if (changed.length) {
      viewportChanged();
    }
  }
  function flush() {
    const appearance = appearanceObserver.takeRecords();
    if (appearance.length) {
      invalidate();
    }
    const records = sceneObserver.takeRecords();
    if (records.length) {
      onSceneMutation(records);
    }
  }
  function refresh() {
    if (!eligible()) {
      cancelBuild();
      clearReady();
      sceneObserver.disconnect();
      observing = false;
      return;
    }
    if (!observing) {
      sceneObserver.observe(svg, {
        attributes: true,
        attributeOldValue: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
      observing = true;
    }
    if (
      !panning &&
      !ready &&
      !job &&
      timer === undefined &&
      failedRevision !== revision
    ) {
      timer = view.setTimeout(prepare, 200);
    }
  }
  async function prepare() {
    timer = undefined;
    flush();
    if (!eligible() || panning || hasAnimation() || job || ready) {
      return;
    }
    const current = {
      controller: new view.AbortController(),
      revision,
      viewport: viewport(),
    };
    job = current;
    attemptedViewport = current.viewport;
    current.timeout = view.setTimeout(() => {
      if (job === current) {
        current.controller.abort();
        failedRevision = revision;
        job = undefined;
      }
    }, 10_000);
    let snapshot;
    try {
      snapshot = await buildSnapshot({
        svg,
        scene,
        viewport: current.viewport,
        signal: current.controller.signal,
      });
      flush();
      if (
        disposed ||
        job !== current ||
        current.revision !== revision ||
        !eligible() ||
        hasAnimation() ||
        !fits(snapshot, viewport())
      ) {
        return;
      }
      const canvas = snapshot.canvas;
      canvas.hidden = true;
      canvas.setAttribute("aria-hidden", "true");
      canvas.setAttribute("data-vowl-pan-cache", "");
      canvas.classList.add("vowl-pan-cache");
      // SVG roots do not have HTMLElement.offsetLeft/offsetTop. Resolve their
      // position relative to the canvas's containing block once at publication.
      const svgBounds = svg.getBoundingClientRect();
      const parentBounds = parent.getBoundingClientRect();
      canvas.style.setProperty(
        "--vowl-pan-left",
        `${svgBounds.left - parentBounds.left + parent.scrollLeft - parent.clientLeft - snapshot.padding}px`,
      );
      canvas.style.setProperty(
        "--vowl-pan-top",
        `${svgBounds.top - parentBounds.top + parent.scrollTop - parent.clientTop - snapshot.padding}px`,
      );
      canvas.style.setProperty(
        "--vowl-pan-width",
        `${snapshot.viewport.width + snapshot.padding * 2}px`,
      );
      canvas.style.setProperty(
        "--vowl-pan-height",
        `${snapshot.viewport.height + snapshot.padding * 2}px`,
      );
      parent.append(canvas);
      appearanceObserver.takeRecords(); // our own sibling insertion
      ready = snapshot;
    } catch {
      // A failed optional acceleration must leave the ordinary drawing usable.
      // Retry only after a new scene/viewport revision, never a failure loop.
      if (job === current && !current.controller.signal.aborted) {
        failedRevision = revision;
      }
    } finally {
      if (snapshot && ready !== snapshot) {
        snapshot.dispose();
      }
      view.clearTimeout(current.timeout);
      if (job === current) {
        job = undefined;
      }
    }
  }
  function show() {
    if (!panning || !ready || !eligible() || !fits(ready, viewport())) {
      restoreSvg();
      return;
    }
    if (!hidingSvg) {
      scene.classList.add("vowl-pan-cache-active");
      hidingSvg = true;
      sceneObserver.takeRecords();
    }
    const current = viewport();
    ready.canvas.style.setProperty(
      "--vowl-pan-x",
      `${current.x - ready.viewport.x}px`,
    );
    ready.canvas.style.setProperty(
      "--vowl-pan-y",
      `${current.y - ready.viewport.y}px`,
    );
    ready.canvas.hidden = false;
  }
  function viewportChanged() {
    flush();
    if (
      job ||
      (ready && !fits(ready, viewport())) ||
      (attemptedViewport && !sameRasterViewport(attemptedViewport, viewport()))
    ) {
      invalidate();
    }
    show();
    refresh();
  }
  function beginPan() {
    flush();
    cancelBuild();
    panning = true;
    if (
      !eligible() ||
      hasAnimation() ||
      (ready && !fits(ready, viewport())) ||
      (attemptedViewport && !sameRasterViewport(attemptedViewport, viewport()))
    ) {
      invalidate();
    }
  }
  function endPan() {
    flush();
    panning = false;
    restoreSvg();
    refresh();
  }
  function withLiveDrawing(callback) {
    flush();
    restoreSvg();
    try {
      return callback();
    } finally {
      flush();
      show();
    }
  }
  function dispose() {
    if (disposed) {
      return;
    }
    disposed = true;
    cancelBuild();
    clearReady();
    sceneObserver.disconnect();
    appearanceObserver.disconnect();
    resizeObserver?.disconnect();
    resolution?.removeEventListener("change", resolutionChanged);
    for (const cleanup of cleanups) {
      cleanup();
    }
    if (positioned) {
      parent.classList.remove("vowl-pan-cache-host");
    }
  }
  refresh();
  return {
    refresh,
    invalidate,
    beginPan,
    viewportChanged,
    endPan,
    withLiveDrawing,
    dispose,
  };
}
