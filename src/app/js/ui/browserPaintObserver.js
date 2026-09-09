export function createBrowserPaintObserver({
  requestAnimationFrame,
  cancelAnimationFrame,
}) {
  return ({ signal } = {}) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      let frameHandle;
      const cancelObservation = () => {
        cancelAnimationFrame(frameHandle);
        reject(signal.reason);
      };
      signal?.addEventListener("abort", cancelObservation, { once: true });
      // Animation callbacks precede painting. A second callback observes a
      // frame boundary after the browser had an opportunity to paint the first.
      frameHandle = requestAnimationFrame(() => {
        frameHandle = requestAnimationFrame(() => {
          signal?.removeEventListener("abort", cancelObservation);
          resolve();
        });
      });
    });
}
