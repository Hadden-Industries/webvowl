import { jest } from "@jest/globals";
import { exportCanonicalDrawing } from "./canonicalVowlDrawingExport.js";

function setup(format = "svg") {
  const owner = new AbortController();
  const runtime = {
    readGraphLayoutSnapshot: () => ({ isPaused: false, hasEnded: false }),
    subscribeToRenderedGraphEvents: () => () => {},
    setGraphLayoutPaused: jest.fn(),
    createRenderedSvgSnapshot: jest.fn(() => ({ widthPx: 640, heightPx: 480 })),
    createRenderedDrawingSnapshot: jest.fn(() => ({ loadGeneration: 3 })),
  };
  const artifacts = {
    createVisualizationArtifact: jest.fn(async () => "artifact"),
  };
  const context = {
    runtime,
    artifacts,
    graphLayoutSettler: {
      waitForSettledGraphLayout: async () => ({
        status: "settled",
        reason: "stable",
      }),
    },
    waitForDocumentFonts: async () => {},
    waitForBrowserPaint: async () => {},
    request: { format },
    loadGeneration: 3,
    source: { kind: "ontology-text" },
    view: {},
    signal: owner.signal,
    assertCurrent: () => {},
    canRestoreLayout: () => true,
  };
  return { context, owner, runtime, artifacts };
}

test.each(["svg", "latex"])(
  "%s captures the native drawing and restores a temporarily paused layout",
  async (format) => {
    const { context, runtime, artifacts } = setup(format);
    await expect(exportCanonicalDrawing(context)).resolves.toBe("artifact");
    expect(runtime.setGraphLayoutPaused.mock.calls).toEqual([
      [{ loadGeneration: 3, isPaused: true }],
      [{ loadGeneration: 3, isPaused: false }],
    ]);
    const request = artifacts.createVisualizationArtifact.mock.calls[0][0];
    if (format === "svg") {
      expect(request.viewRecipe.viewportDimensions).toEqual({
        widthPx: 640,
        heightPx: 480,
      });
    } else {
      expect(request).toMatchObject({
        format: "latex",
        renderedDrawingSnapshot: { loadGeneration: 3 },
      });
    }
  },
);

test("cancellation interrupts unresolved fonts and cannot publish a late artifact", async () => {
  const { context, owner, runtime, artifacts } = setup();
  let fontsStarted;
  const started = new Promise((resolve) => {
    fontsStarted = resolve;
  });
  let finishFonts;
  context.waitForDocumentFonts = () => {
    fontsStarted();
    return new Promise((resolve) => {
      finishFonts = resolve;
    });
  };
  const exporting = exportCanonicalDrawing(context);
  const failure = expect(exporting).rejects.toMatchObject({
    name: "AbortError",
  });
  await started;
  owner.abort();
  await failure;
  finishFonts();
  expect(artifacts.createVisualizationArtifact).not.toHaveBeenCalled();
  expect(runtime.setGraphLayoutPaused).toHaveBeenLastCalledWith({
    loadGeneration: 3,
    isPaused: false,
  });
});

test("replacement or explicit pause ownership prevents an old export from resuming the layout", async () => {
  const { context, runtime } = setup();
  context.canRestoreLayout = () => false;
  context.waitForBrowserPaint = async () => {
    throw new Error("replaced");
  };
  await expect(exportCanonicalDrawing(context)).rejects.toThrow("replaced");
  expect(runtime.setGraphLayoutPaused).toHaveBeenCalledTimes(1);
});

test("already settled layout is never re-energized by export", async () => {
  const { context, runtime } = setup();
  runtime.readGraphLayoutSnapshot = () => ({ isPaused: false, hasEnded: true });
  await exportCanonicalDrawing(context);
  expect(runtime.setGraphLayoutPaused).not.toHaveBeenCalled();
});
