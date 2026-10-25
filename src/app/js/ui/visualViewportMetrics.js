// One application-lifetime producer serves search, chooser and details surfaces.
export function createVisualViewportMetrics({
  windowObject = globalThis.window,
  documentObject = globalThis.document,
} = {}) {
  let frame = null;
  let disposed = false;
  const viewport = windowObject.visualViewport;
  const style = documentObject.documentElement.style;
  function publish() {
    frame = null;
    if (disposed) {
      return;
    }
    style.setProperty(
      "--visual-viewport-height",
      (viewport?.height ?? windowObject.innerHeight) + "px",
    );
    style.setProperty(
      "--visual-viewport-width",
      (viewport?.width ?? windowObject.innerWidth) + "px",
    );
    style.setProperty(
      "--visual-viewport-offset-top",
      (viewport?.offsetTop ?? 0) + "px",
    );
    style.setProperty(
      "--visual-viewport-offset-left",
      (viewport?.offsetLeft ?? 0) + "px",
    );
  }
  function schedule() {
    if (!disposed && frame === null) {
      frame = windowObject.requestAnimationFrame(publish);
    }
  }
  const targets = [
    [windowObject, "resize"],
    [windowObject, "orientationchange"],
  ];
  if (viewport) {
    targets.push([viewport, "resize"], [viewport, "scroll"]);
  }
  for (const [target, event] of targets) {
    target.addEventListener(event, schedule);
  }
  publish();
  return Object.freeze({
    dispose() {
      disposed = true;
      for (const [target, event] of targets) {
        target.removeEventListener(event, schedule);
      }
      if (frame !== null) {
        windowObject.cancelAnimationFrame(frame);
      }
      frame = null;
    },
  });
}
