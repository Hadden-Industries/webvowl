import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlDocumentSession } from "../../../../src/app/js/controller/canonicalVowlDocumentSession.js";
import { createCanonicalWebVowlController } from "../../../../src/app/js/controller/canonicalWebVowlController.js";
import { createOntologyInspector } from "../../../../src/app/js/controller/ontologyInspector.js";
import { createRenderedGraphInternals } from "../../../../src/webvowl/js/runtime/renderedGraphInternals.js";
import { createD3RenderedGraphAdapter } from "../../../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js";
import { createVisualizationArtifactService } from "../../../../src/app/js/controller/visualizationArtifactService.js";
import { createSvgSerializer } from "../../../../src/app/js/controller/svgSerializer.js";

const result = {
  status: "loading-fixtures",
  samples: [],
  warmups: [],
  answers: [],
};
globalThis.canonicalLatencyQualification = result;
const fixtures = await Promise.all(
  ["foaf", "benchmark"].map(async (name) => {
    const response = await fetch(`/canonical-examples/${name}.json`);
    if (!response.ok) {
      throw new Error(`Fixture ${name}: ${response.status}`);
    }
    return { name, bytes: new Uint8Array(await response.arrayBuffer()) };
  }),
);
const queries = [
  "Person",
  "name",
  "http",
  "no-such-qualification-match",
  "a",
  "é",
];
result.fixtures = await Promise.all(
  fixtures.map(async ({ name, bytes }) => ({
    name,
    byteLength: bytes.byteLength,
    sha256: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (value) => value.toString(16).padStart(2, "0"),
    ).join(""),
  })),
);
const nextPaint = () =>
  new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done)),
  );
async function sample(fixture, measured) {
  const container = document.createElement("div");
  container.style.cssText = "width:800px;height:600px";
  document.body.append(container);
  const graph = createRenderedGraphInternals(container, {
    widthPx: 800,
    heightPx: 600,
  });
  const { renderedGraphRuntime: runtime } = createD3RenderedGraphAdapter({
    graphContainerElement: container,
    renderedGraphConfiguration: undefined,
    createRenderer: () => graph,
    observeNextPaint: nextPaint,
  });
  const session = createCanonicalVowlDocumentSession({
    workerClient: createCanonicalVowlWorkerClient(),
  });
  const controller = createCanonicalWebVowlController({
    renderedGraphRuntime: runtime,
    visualizationArtifactService: createVisualizationArtifactService({
      svgSerializer: createSvgSerializer({
        XMLSerializerConstructor: XMLSerializer,
        documentObject: document,
        webVowlVersion: "qualification",
      }),
      webCrypto: crypto,
      BlobConstructor: Blob,
      objectUrlApi: URL,
      visualizationArtifactPublicationPort: { publishPageLocalArtifact() {} },
    }),
    documentSession: session,
    ontologyInspector: createOntologyInspector(),
    waitForDocumentFonts: () => document.fonts.ready,
    waitForBrowserPaint: nextPaint,
  });
  try {
    controller.resizeVisualizationViewport({
      widthPx: 800,
      heightPx: 600,
      occludedLeftWidthPx: 0,
      isTouchDevice: false,
    });
    const start = performance.now();
    await controller.loadOntology({
      source: { kind: "vowl-json-bytes", bytes: fixture.bytes },
    });
    await nextPaint();
    const loadToNextPaintMs = performance.now() - start;
    controller.setGraphLayoutPaused({ isPaused: true });
    const firstStart = performance.now();
    const first = controller.findOntologyElements({
      query: queries[0],
      limit: 25,
    });
    const firstQueryMs = performance.now() - firstStart;
    const timings = [];
    const answers = [];
    for (let repeat = 0; repeat < 5; repeat++) {
      for (const query of queries) {
        const queryStart = performance.now();
        const answer = controller.findOntologyElements({ query, limit: 25 });
        timings.push(performance.now() - queryStart);
        if (repeat === 0) {
          answers.push(answer);
        }
      }
    }
    const summary = {
      fixture: fixture.name,
      loadToNextPaintMs,
      firstQueryMs,
      querySamplesMs: timings,
      visible:
        runtime.readVisibleRenderedGraphSnapshot().visibleElementReferences
          .length,
    };
    if (measured) {
      result.samples.push(summary);
      result.answers.push({ fixture: fixture.name, first, answers });
    } else {
      result.warmups.push(summary);
    }
  } finally {
    controller.dispose();
    container.remove();
  }
}
result.status = "ready";
document.getElementById("run-cohort").addEventListener("click", async () => {
  if (result.status !== "ready") {
    return;
  }
  result.status = "running";
  try {
    for (const fixture of fixtures) {
      await sample(fixture, false);
    }
    for (let repeat = 0; repeat < 5; repeat++) {
      for (const fixture of fixtures) {
        await sample(fixture, true);
      }
    }
    result.status = "passed";
  } catch (error) {
    result.status = "failed";
    result.error = { message: error.message, stack: error.stack };
  }
  document.getElementById("result").textContent = JSON.stringify(result);
});
