import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlDocumentSession } from "../../../../src/app/js/controller/canonicalVowlDocumentSession.js";
import { createCanonicalWebVowlController } from "../../../../src/app/js/controller/canonicalWebVowlController.js";
import { createOntologyInspector } from "../../../../src/app/js/controller/ontologyInspector.js";
import { createRenderedGraphInternals } from "../../../../src/webvowl/js/runtime/renderedGraphInternals.js";
import { createD3RenderedGraphAdapter } from "../../../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js";
import { createVisualizationArtifactService } from "../../../../src/app/js/controller/visualizationArtifactService.js";
import { createGraphLayoutSettler } from "../../../../src/app/js/controller/graphLayoutSettler.js";
import { createSvgSerializer } from "../../../../src/app/js/controller/svgSerializer.js";
import { createWebMcpToolDispatch } from "../../../../src/app/js/webmcp/webMcpToolContracts.js";

const result = { status: "running", cycles: [], retired: [] };
globalThis.performanceSearchQualification = result;
const heapCheckpoint = new URLSearchParams(location.search).has("heap");
function check(condition, name) {
  if (!condition) {
    throw new Error(name);
  }
}
async function cycle(index) {
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
    observeNextPaint: () =>
      new Promise((resolve) => requestAnimationFrame(resolve)),
  });
  const worker = createCanonicalVowlWorkerClient();
  const session = createCanonicalVowlDocumentSession({ workerClient: worker });
  const inspector = createOntologyInspector();
  const preparations = new WeakSet();
  const controller = createCanonicalWebVowlController({
    renderedGraphRuntime: runtime,
    documentSession: session,
    ontologyInspector: {
      ...inspector,
      findOntologyElements(request, preparation) {
        if (!preparations.has(preparation)) {
          preparations.add(preparation);
          result.retired.push({
            kind: "search-preparation",
            cycle: index,
            reference: new WeakRef(preparation),
          });
        }
        return inspector.findOntologyElements(request, preparation);
      },
    },
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
    graphLayoutSettler: createGraphLayoutSettler({
      requestAnimationFrame,
      cancelAnimationFrame,
      nowMs: () => performance.now(),
    }),
    waitForDocumentFonts: () => document.fonts.ready,
    waitForBrowserPaint: () =>
      new Promise((resolve) => requestAnimationFrame(resolve)),
  });
  try {
    controller.resizeVisualizationViewport({
      widthPx: 800,
      heightPx: 600,
      occludedLeftWidthPx: 0,
      isTouchDevice: false,
    });
    const source = {
      kind: "ontology-text",
      format: "functional",
      documentIri: `urn:cycle:${index}`,
      text: `Ontology(<urn:cycle:${index}>
      Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(Class(<urn:C>))
      SubClassOf(<urn:A> <urn:B>) SubClassOf(<urn:B> <urn:C>))`,
    };
    await controller.loadOntology({ source });
    controller.setGraphLayoutPaused({ isPaused: true });
    await controller.setVisualizationView({
      nodesShown: { mode: "exact", requestedCount: 0 },
    });
    const ordinary = session.scene().snapshot();
    const ordinaryBytes = await session.capture();
    const found = controller.findOntologyElements({
      query: "urn:A",
      limit: 25,
    });
    const reference = found.matches[0]?.ontologyElementReference;
    check(reference, "hidden-search-result");
    const dispatch = createWebMcpToolDispatch({
      webVowlController: controller,
    });
    const revealed = await dispatch.callWebMcpTool(
      "reveal_ontology_neighborhood",
      { ontologyElementReferences: [reference] },
    );
    check(revealed.isSuccess && session.hasNeighborhood(), "webmcp-reveal");
    check(
      runtime.readVisibleRenderedGraphSnapshot().visibleElementReferences
        .length > 0,
      "native-visible-neighborhood",
    );
    if (heapCheckpoint && index === 0) {
      globalThis.performanceSearchHeapCheckpoint = {
        owners: Object.entries({
          session,
          controller,
          runtime,
          graph,
          worker,
          scene: session.scene(),
          preparation: result.retired
            .find((row) => row.kind === "search-preparation")
            .reference.deref(),
        }).map(([kind, owner]) => ({ kind, owner })),
      };
      const button = document.createElement("button");
      button.id = "release-heap-checkpoint";
      button.textContent = "Release live heap checkpoint";
      document.body.prepend(button);
      result.status = "live-heap-checkpoint";
      await new Promise((resolve) => {
        button.addEventListener(
          "click",
          () => {
            delete globalThis.performanceSearchHeapCheckpoint;
            button.remove();
            result.status = "running";
            resolve();
          },
          { once: true },
        );
      });
    }
    check(
      JSON.stringify(await session.capture()) === JSON.stringify(ordinaryBytes),
      "ordinary-export-during-reveal",
    );
    const svg = await controller.exportVisualization({
      format: "svg",
      filename: "Neighborhood",
    });
    check(svg.byteLength > 0, "temporary-svg-export");
    await dispatch.callWebMcpTool("clear_ontology_neighborhood", {});
    check(
      JSON.stringify(session.scene().snapshot()) === JSON.stringify(ordinary),
      "exact-ordinary-restoration",
    );
    await controller.revealOntologyNeighborhood({
      ontologyElementReferences: [reference],
    });
    const record = session
      .snapshot()
      .inspection.records.roles.find((row) => row.kind === "class");
    await controller.editOntologyRecord({
      ...session.identity(),
      recordTarget: session.target(record.id),
      changes: { iri: `urn:Edited${index}` },
    });
    check(!session.hasNeighborhood(), "edit-retires-neighborhood");
    controller.findOntologyElements({ query: "Edited", limit: 25 });
    await controller.loadOntology({ source });
    controller.findOntologyElements({ query: "urn:A", limit: 25 });
    for (const [kind, owner] of Object.entries({
      session,
      controller,
      runtime,
      graph,
      worker,
      scene: session.scene(),
    })) {
      result.retired.push({
        kind,
        cycle: index,
        reference: new WeakRef(owner),
      });
    }
    result.cycles.push({
      index,
      status: "passed",
      checks: [
        "load",
        "search",
        "tool-reveal",
        "canonical-export",
        "svg-export",
        "clear",
        "edit",
        "reload",
        "dispose",
      ],
    });
  } finally {
    controller.dispose();
    container.remove();
  }
}
try {
  for (let index = 0; index < 10; index++) {
    await cycle(index);
  }
  result.status = "passed";
} catch (error) {
  result.status = "failed";
  result.error = { message: error.message, stack: error.stack };
}
document.getElementById("result").textContent = JSON.stringify(
  { status: result.status, cycles: result.cycles, error: result.error },
  null,
  2,
);
