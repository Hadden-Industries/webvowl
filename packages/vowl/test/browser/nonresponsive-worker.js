// Deliberately faulty test peer, never imported by the application worker.
self.onmessage = ({ data }) => {
  const { requestId, loadGeneration, baseRevision } = data;
  const context = { requestId, loadGeneration, baseRevision };
  self.postMessage({ type: "probe-ready" });
  if (self.name === "stale") {
    self.postMessage({
      type: "result",
      ...context,
      loadGeneration: loadGeneration - 1,
      result: { marker: "stale" },
    });
    setTimeout(
      () =>
        self.postMessage({
          type: "result",
          ...context,
          result: { marker: "current" },
        }),
      50,
    );
  } else {
    const until = performance.now() + 5000;
    while (performance.now() < until) {
      /* Deliberately blocks this worker's event loop. */
    }
    self.postMessage({
      type: "result",
      ...context,
      result: { marker: "late" },
    });
  }
};
