/** Capture a settled native drawing while its document owner remains current. */
export async function exportCanonicalDrawing({
  runtime,
  artifacts,
  graphLayoutSettler,
  waitForDocumentFonts,
  waitForBrowserPaint,
  request,
  loadGeneration,
  source,
  view,
  signal,
  assertCurrent,
  canRestoreLayout,
}) {
  const {
    format,
    filename,
    settleTimeoutMs = 12000,
    onTimeout = "fail",
  } = request;
  if (!["svg", "latex"].includes(format)) {
    throw new TypeError("Unsupported drawing format.");
  }
  async function wait(work) {
    signal.throwIfAborted();
    let abort;
    const interrupted = new Promise((resolve, reject) => {
      void resolve;
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    });
    try {
      const result = await Promise.race([work, interrupted]);
      signal.throwIfAborted();
      assertCurrent();
      return result;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  let pausedForCapture = false;
  try {
    const outcome = await wait(
      graphLayoutSettler.waitForSettledGraphLayout(
        {
          loadGeneration,
          settleTimeoutMs,
          onTimeout,
          readGraphLayoutSnapshot: () => runtime.readGraphLayoutSnapshot(),
          subscribeToGraphLayoutEvents: (listener) =>
            runtime.subscribeToRenderedGraphEvents(listener),
        },
        { signal },
      ),
    );
    const layout = runtime.readGraphLayoutSnapshot();
    if (!layout.isPaused && !layout.hasEnded) {
      runtime.setGraphLayoutPaused({ loadGeneration, isPaused: true });
      pausedForCapture = true;
    }
    await wait(waitForDocumentFonts());
    for (let index = 0; index < 2; index += 1) {
      await wait(waitForBrowserPaint({ signal }));
    }
    const artifact =
      format === "latex"
        ? {
            format,
            filename,
            source,
            renderedDrawingSnapshot: runtime.createRenderedDrawingSnapshot({
              loadGeneration,
            }),
          }
        : (() => {
            const renderedSvgSnapshot = runtime.createRenderedSvgSnapshot({
              loadGeneration,
            });
            return {
              filename,
              renderedSvgSnapshot,
              viewRecipe: {
                source,
                loadGeneration,
                appliedVisualizationView: view,
                viewportDimensions: {
                  widthPx: renderedSvgSnapshot.widthPx,
                  heightPx: renderedSvgSnapshot.heightPx,
                },
                layoutOutcome: {
                  status: outcome.status,
                  reason: outcome.reason,
                },
              },
            };
          })();
    return await wait(
      artifacts.createVisualizationArtifact(artifact, { signal }),
    );
  } finally {
    if (pausedForCapture && canRestoreLayout()) {
      runtime.setGraphLayoutPaused({ loadGeneration, isPaused: false });
    }
  }
}
