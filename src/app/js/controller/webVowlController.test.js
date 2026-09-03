import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let createInMemoryRenderedGraphAdapter;
let createOntologyInspector;
let vowlModelInspectionProjector;
let createWebVowlController;

const CONTROLLER_MODULE_URL = new URL(
  "./webVowlController.js",
  import.meta.url,
);
const INSPECTOR_MODULE_URL = new URL("./ontologyInspector.js", import.meta.url);
const IN_MEMORY_ADAPTER_MODULE_URL = new URL(
  "../../test/inMemoryRenderedGraphAdapter.js",
  import.meta.url,
);

const DOCUMENT_IRI = "https://example.test/ontology.owl";
const SOURCE_REQUEST = Object.freeze({
  source: Object.freeze({
    kind: "ontology-document-iri",
    documentIri: DOCUMENT_IRI,
  }),
});

const repositoryModulesByUrl = new Map();

function instantiateRepositoryModule(moduleUrl) {
  const moduleIdentifier = moduleUrl.href;
  if (repositoryModulesByUrl.has(moduleIdentifier)) {
    return repositoryModulesByUrl.get(moduleIdentifier);
  }
  const repositoryModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleIdentifier },
  );
  repositoryModulesByUrl.set(moduleIdentifier, repositoryModule);
  return repositoryModule;
}

async function loadRepositoryModule(moduleUrl) {
  const rootModule = instantiateRepositoryModule(moduleUrl);
  await rootModule.link((specifier, referencingModule) =>
    instantiateRepositoryModule(
      new URL(specifier, referencingModule.identifier),
    ),
  );
  await rootModule.evaluate();
  return rootModule;
}

beforeAll(async () => {
  ({ createOntologyInspector } = (
    await loadRepositoryModule(INSPECTOR_MODULE_URL)
  ).namespace);
  ({ createInMemoryRenderedGraphAdapter } = (
    await loadRepositoryModule(IN_MEMORY_ADAPTER_MODULE_URL)
  ).namespace);
  ({ vowlModelInspectionProjector } = (
    await loadRepositoryModule(
      new URL("./vowlModelInspectionProjector.js", import.meta.url),
    )
  ).namespace);
  ({ createWebVowlController } = (
    await loadRepositoryModule(CONTROLLER_MODULE_URL)
  ).namespace);
});

function createSourceLoadRecord(overrides = {}) {
  return {
    vowlModel: {
      header: { title: { en: "Example" } },
      class: [],
      property: [],
    },
    diagnostics: [],
    sourceProvenance: {
      kind: "ontology-document-iri",
      identity: DOCUMENT_IRI,
      sha256Hex: "a".repeat(64),
    },
    structuralCounts: {
      classCount: 0,
      datatypeCount: 0,
      individualCount: 0,
      propertyCount: 0,
    },
    ...overrides,
  };
}

async function flushMicrotasks(turnCount = 6) {
  for (let turn = 0; turn < turnCount; turn += 1) {
    await Promise.resolve();
  }
}

describe("WebVOWL controller orchestration", () => {
  let controller;
  let deferredSourceLoads;
  let graphLayoutSettler;
  let ontologySourceLoader;
  let publishedStates;
  let publishedChangeSets;
  let renderedGraphRuntime;
  let renderedGraphTestHarness;
  let settlementRequests;
  let svgArtifactService;
  let waitForBrowserPaint;
  let waitForDocumentFonts;

  beforeEach(() => {
    const inMemoryAdapter = createInMemoryRenderedGraphAdapter();
    renderedGraphRuntime = inMemoryAdapter.renderedGraphRuntime;
    renderedGraphTestHarness = inMemoryAdapter.renderedGraphTestHarness;

    deferredSourceLoads = [];
    ontologySourceLoader = {
      loadOntologySource: jest.fn(
        (request, { onPhaseChange, signal } = {}) =>
          new Promise((resolve, reject) => {
            deferredSourceLoads.push({
              onPhaseChange,
              reject,
              request,
              resolve,
              signal,
            });
          }),
      ),
    };

    settlementRequests = [];
    graphLayoutSettler = {
      waitForSettledGraphLayout: jest.fn(
        (settlementRequest, options = {}) =>
          new Promise((resolve, reject) => {
            settlementRequests.push({
              options,
              reject,
              resolve,
              settlementRequest,
            });
          }),
      ),
    };

    svgArtifactService = {
      createSvgArtifact: jest.fn(async ({ filename, viewRecipe }) => ({
        pageLocalArtifactId: "svg-artifact-1-1",
        filename,
        mediaType: "image/svg+xml",
        byteLength: 128,
        sha256Hex: "b".repeat(64),
        pageLocalViewRecipeId: "svg-view-recipe-1-1",
        viewRecipe,
      })),
    };

    waitForDocumentFonts = jest.fn(async () => undefined);
    waitForBrowserPaint = jest.fn(async () => undefined);

    controller = createWebVowlController({
      ontologySourceLoader,
      vowlModelInspectionProjector,
      renderedGraphRuntime,
      ontologyInspector: createOntologyInspector(),
      graphLayoutSettler,
      svgArtifactService,
      waitForDocumentFonts,
      waitForBrowserPaint,
    });

    publishedStates = [];
    publishedChangeSets = [];
    controller.subscribeToState((controllerState, changedFieldNames) => {
      publishedStates.push(controllerState);
      publishedChangeSets.push(changedFieldNames);
    });
  });

  async function completeLoad(loadGeneration = 1, loadOptions = {}) {
    const loadPromise = controller.loadOntology(SOURCE_REQUEST, loadOptions);
    await flushMicrotasks(2);
    const deferredLoad = deferredSourceLoads.at(-1);
    deferredLoad.onPhaseChange?.("parsing");
    deferredLoad.resolve(createSourceLoadRecord());
    await flushMicrotasks(3);
    renderedGraphTestHarness.completeInitialPaint(loadGeneration);
    await flushMicrotasks(3);
    renderedGraphTestHarness.completeVisualizationViewApplication(
      loadGeneration,
    );
    await flushMicrotasks(3);
    return loadPromise;
  }

  describe("load lifecycle and state machine", () => {
    test("starts idle with a frozen empty state", () => {
      const controllerState = controller.getState();

      expect(controllerState).toEqual({
        status: "idle",
        loadGeneration: 0,
        source: null,
        warnings: [],
        view: null,
        zoomScale: null,
        translation: null,
        layout: { status: "unavailable" },
        selection: [],
        renderProgress: null,
        editorMode: null,
        error: null,
      });
      expect(Object.isFrozen(controllerState)).toBe(true);
      expect(Object.isFrozen(controllerState.layout)).toBe(true);
    });

    test("advances through loading, parsing, rendering, and relaxing", async () => {
      await completeLoad();

      expect(publishedStates.map(({ status }) => status)).toEqual([
        "loading",
        "parsing",
        "rendering",
        "relaxing",
      ]);
      expect(controller.getState().loadGeneration).toBe(1);
      expect(controller.getState().source).toEqual({
        kind: "ontology-document-iri",
        identity: DOCUMENT_IRI,
        sha256Hex: "a".repeat(64),
      });
    });

    test("reaches ready when background settlement reports a settled layout", async () => {
      await completeLoad();
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks();

      expect(controller.getState().status).toBe("ready");
      expect(controller.getState().layout).toEqual({ status: "settled" });
    });

    test("observes layout in the background without blocking the load", async () => {
      await completeLoad();

      expect(
        graphLayoutSettler.waitForSettledGraphLayout,
      ).toHaveBeenCalledTimes(1);
      const { settlementRequest } = settlementRequests.at(-1);
      expect(settlementRequest.loadGeneration).toBe(1);
      expect(settlementRequest.settleTimeoutMs).toBe(30000);
      expect(settlementRequest.onTimeout).toBe("best-effort");
    });

    test("publishes a bounded expected error and enters the error status", async () => {
      const loadPromise = controller.loadOntology(SOURCE_REQUEST);
      await flushMicrotasks(2);
      deferredSourceLoads.at(-1).reject(
        Object.assign(new Error("bad ontology"), {
          code: "PARSE_FAILED",
          isRetryable: false,
          details: {},
        }),
      );

      await expect(loadPromise).rejects.toEqual(
        expect.objectContaining({ code: "PARSE_FAILED" }),
      );
      expect(controller.getState().status).toBe("error");
      expect(controller.getState().error).toEqual(
        expect.objectContaining({ code: "PARSE_FAILED" }),
      );
    });

    test("tells a subscriber which fields it wrote, narrowed to real changes", async () => {
      await completeLoad();
      const changeSetsDuringLoad = publishedChangeSets.slice();

      expect(changeSetsDuringLoad[0]).toEqual(
        expect.arrayContaining(["status", "loadGeneration"]),
      );
      // A publication reports only the fields it wrote, never the whole shape.
      for (const changedFieldNames of changeSetsDuringLoad) {
        expect(Array.isArray(changedFieldNames)).toBe(true);
        expect(changedFieldNames).not.toContain("editorMode");
      }

      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: 1,
        payload: {
          selectedOntologyElementReferences: [
            { kind: "class", iri: "https://example.test/Person" },
          ],
        },
      });
      await flushMicrotasks();

      expect(publishedChangeSets.at(-1)).toEqual(["selection"]);
    });

    test("omits a written field whose value did not actually change", async () => {
      await completeLoad();
      const publicationCount = publishedChangeSets.length;

      // Selecting nothing when nothing is selected writes the field without
      // changing it, so no subscriber is told anything changed.
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: 1,
        payload: { selectedOntologyElementReferences: [] },
      });
      await flushMicrotasks();

      expect(publishedChangeSets.length).toBe(publicationCount + 1);
      expect(publishedChangeSets.at(-1)).toEqual([]);
    });

    test("notifies subscribers in order and stops after unsubscribe", async () => {
      const secondSubscriberStates = [];
      const unsubscribe = controller.subscribeToState((controllerState) => {
        secondSubscriberStates.push(controllerState.status);
      });

      await completeLoad();
      const observedBeforeUnsubscribe = secondSubscriberStates.length;
      unsubscribe();
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks();

      expect(observedBeforeUnsubscribe).toBeGreaterThan(0);
      expect(secondSubscriberStates).toHaveLength(observedBeforeUnsubscribe);
    });

    test("disposes idempotently and stops publishing state", async () => {
      await completeLoad();
      const publishedStateCount = publishedStates.length;

      controller.dispose();
      controller.dispose();

      expect(publishedStates).toHaveLength(publishedStateCount);
    });
  });

  describe("load generation fencing", () => {
    test("rejects a superseded generation and never overwrites newer state", async () => {
      const firstLoadPromise = controller.loadOntology(SOURCE_REQUEST);
      await flushMicrotasks(2);
      const firstLoad = deferredSourceLoads.at(-1);

      const secondLoadPromise = controller.loadOntology(SOURCE_REQUEST);
      await flushMicrotasks(2);
      const secondLoad = deferredSourceLoads.at(-1);

      firstLoad.onPhaseChange?.("parsing");
      firstLoad.resolve(createSourceLoadRecord());
      await flushMicrotasks(3);

      await expect(firstLoadPromise).rejects.toEqual(
        expect.objectContaining({ code: "LOAD_ABORTED" }),
      );

      secondLoad.resolve(createSourceLoadRecord());
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeInitialPaint(2);
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeVisualizationViewApplication(2);
      await flushMicrotasks(3);
      await secondLoadPromise;

      expect(controller.getState().loadGeneration).toBe(2);
      expect(controller.getState().status).toBe("relaxing");
    });

    test("aborts the previous generation source load before starting a newer one", async () => {
      controller.loadOntology(SOURCE_REQUEST).catch(() => undefined);
      await flushMicrotasks(2);
      const firstLoad = deferredSourceLoads.at(-1);

      controller.loadOntology(SOURCE_REQUEST).catch(() => undefined);
      await flushMicrotasks(2);

      expect(firstLoad.signal.aborted).toBe(true);
    });

    test("ignores a rendered graph event published for a stale generation", async () => {
      await completeLoad();
      const publishedStateCount = publishedStates.length;

      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-warning-raised",
        loadGeneration: 99,
        payload: { warningCode: "STALE_WARNING", message: "stale" },
      });
      await flushMicrotasks();

      expect(publishedStates).toHaveLength(publishedStateCount);
    });
  });

  describe("caller cancellation", () => {
    test("returns to idle when the first load is cancelled", async () => {
      const cancellationController = new AbortController();
      const loadPromise = controller.loadOntology(SOURCE_REQUEST, {
        signal: cancellationController.signal,
      });
      await flushMicrotasks(2);
      cancellationController.abort();
      deferredSourceLoads.at(-1).reject(
        Object.assign(new Error("aborted"), {
          code: "LOAD_ABORTED",
          isRetryable: false,
          details: {},
        }),
      );

      await expect(loadPromise).rejects.toEqual(
        expect.objectContaining({ code: "LOAD_ABORTED" }),
      );
      expect(controller.getState().status).toBe("idle");
      expect(controller.getState().loadGeneration).toBe(0);
    });

    test("restores the previous valid state when a replacement load is cancelled", async () => {
      await completeLoad();
      const validState = controller.getState();

      const cancellationController = new AbortController();
      const replacementPromise = controller.loadOntology(SOURCE_REQUEST, {
        signal: cancellationController.signal,
      });
      await flushMicrotasks(2);
      cancellationController.abort();
      deferredSourceLoads.at(-1).reject(
        Object.assign(new Error("aborted"), {
          code: "LOAD_ABORTED",
          isRetryable: false,
          details: {},
        }),
      );

      await expect(replacementPromise).rejects.toEqual(
        expect.objectContaining({ code: "LOAD_ABORTED" }),
      );
      expect(controller.getState().loadGeneration).toBe(
        validState.loadGeneration,
      );
      expect(controller.getState().status).toBe(validState.status);
    });
  });

  describe("ontology inspection and view control", () => {
    test("rejects inspection before an ontology exists", () => {
      expect(() => controller.getOntologySummary()).toThrow(
        expect.objectContaining({ code: "NO_ONTOLOGY" }),
      );
      expect(() =>
        controller.findOntologyElements({ query: "person" }),
      ).toThrow(expect.objectContaining({ code: "NO_ONTOLOGY" }));
    });

    test("summarises from fresh runtime snapshots", async () => {
      await completeLoad();
      const summary = controller.getOntologySummary();

      expect(summary.loadGeneration).toBe(1);
      expect(summary.source).toEqual({
        kind: "ontology-document-iri",
        identity: DOCUMENT_IRI,
        sha256Hex: "a".repeat(64),
      });
      expect(summary.selectedLanguage).toBe("default");
    });

    test("applies one runtime view request and preserves omitted fields", async () => {
      await completeLoad();
      const viewPromise = controller.setVisualizationView({ language: "de" });
      await flushMicrotasks(2);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await viewPromise;

      const appliedView = controller.getState().view;
      expect(appliedView.language).toBe("de");
      expect(appliedView.filters.minDegree).toBe(0);
      expect(appliedView.viewport).toBe("preserve");
    });

    test("returns to relaxing and restarts observation on a relax view change", async () => {
      await completeLoad();
      const backgroundSettlement = settlementRequests.at(-1);
      const viewPromise = controller.setVisualizationView({ layout: "relax" });
      await flushMicrotasks(2);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await viewPromise;
      await flushMicrotasks();

      expect(backgroundSettlement.options.signal.aborted).toBe(true);
      expect(
        graphLayoutSettler.waitForSettledGraphLayout,
      ).toHaveBeenCalledTimes(2);
      expect(controller.getState().status).toBe("relaxing");
    });

    test("pauses and resumes layout as a controller-owned operation", async () => {
      await completeLoad();

      const pauseResult = controller.setGraphLayoutPaused({ isPaused: true });
      expect(pauseResult).toEqual({
        loadGeneration: 1,
        isPaused: true,
        layoutStatus: "paused",
      });
      expect(controller.getState().layout).toEqual({ status: "paused" });

      const resumeResult = controller.setGraphLayoutPaused({ isPaused: false });
      expect(resumeResult.isPaused).toBe(false);
    });

    test("reduces a rendered graph warning event into controller state", async () => {
      await completeLoad();
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-warning-raised",
        loadGeneration: 1,
        payload: {
          warningCode: "LABEL_TRUNCATED",
          message: "One label was truncated.",
        },
      });
      await flushMicrotasks();

      expect(controller.getState().warnings).toContain(
        "One label was truncated.",
      );
    });

    test("reduces render progress published while the load is still in flight", async () => {
      const loadPromise = controller.loadOntology(SOURCE_REQUEST);
      await flushMicrotasks(2);
      const deferredLoad = deferredSourceLoads.at(-1);
      deferredLoad.resolve(createSourceLoadRecord());
      await flushMicrotasks(3);

      // The renderer reports layout progress before the first paint resolves.
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-progress-changed",
        loadGeneration: 1,
        payload: {
          completedRenderedElementCount: 60,
          totalRenderedElementCount: 100,
        },
      });
      await flushMicrotasks();

      expect(controller.getState().renderProgress).toEqual({
        completedRenderedElementCount: 60,
        totalRenderedElementCount: 100,
      });

      renderedGraphTestHarness.completeInitialPaint(1);
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await flushMicrotasks(3);
      await loadPromise;
    });

    test("reduces a rendered element selection into controller state", async () => {
      await completeLoad();
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: 1,
        payload: {
          selectedOntologyElementReferences: [
            { kind: "class", iri: "https://example.test/Person" },
          ],
        },
      });
      await flushMicrotasks();

      expect(controller.getState().selection).toEqual([
        { kind: "class", iri: "https://example.test/Person" },
      ]);

      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: 1,
        payload: { selectedOntologyElementReferences: [] },
      });
      await flushMicrotasks();

      expect(controller.getState().selection).toEqual([]);
    });

    test("clears a selection made in a superseded load generation", async () => {
      await completeLoad(1);
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: 1,
        payload: {
          selectedOntologyElementReferences: [
            { kind: "class", iri: "https://example.test/Person" },
          ],
        },
      });
      await flushMicrotasks();
      expect(controller.getState().selection).toHaveLength(1);

      await completeLoad(2);

      expect(controller.getState().loadGeneration).toBe(2);
      expect(controller.getState().selection).toEqual([]);
    });

    test("clears in-flight render progress when a new load begins", async () => {
      await completeLoad(1);
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-progress-changed",
        loadGeneration: 1,
        payload: {
          completedRenderedElementCount: 40,
          totalRenderedElementCount: 100,
        },
      });
      await flushMicrotasks();
      expect(controller.getState().renderProgress).not.toBeNull();

      const loadPromise = controller.loadOntology(SOURCE_REQUEST);
      await flushMicrotasks(2);

      expect(controller.getState().status).toBe("loading");
      expect(controller.getState().renderProgress).toBeNull();

      deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeInitialPaint(2);
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeVisualizationViewApplication(2);
      await flushMicrotasks(3);
      await loadPromise;
    });

    test("describes the elements state reports as selected", async () => {
      await completeLoad();
      const descriptionResult = controller.describeOntologyElements({
        ontologyElementReferences: [],
      });

      expect(descriptionResult.loadGeneration).toBe(1);
      expect(descriptionResult.elementDescriptions).toEqual([]);
    });

    test("passes a requested display mode to the runtime", async () => {
      await completeLoad();

      expect(controller.setVisualizationMode({ nodeScaling: true })).toEqual({
        nodeScaling: true,
      });
    });

    test("passes requested force distances to the runtime", async () => {
      await completeLoad();

      expect(
        controller.setForceLayoutDistances({ classDistancePx: 240 }),
      ).toEqual({ classDistancePx: 240 });
    });

    test("passes a held zoom gesture to the runtime rather than a magnification", async () => {
      await completeLoad();

      expect(controller.setContinuousZoom({ zoomDirection: "in" })).toBe("in");
      expect(controller.setContinuousZoom({ zoomDirection: "none" })).toBe(
        "none",
      );
    });

    test("reduces a viewport change into controller state", async () => {
      await completeLoad();
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "viewport-changed",
        loadGeneration: 1,
        payload: { zoomScale: 1.75, translationXPx: -40, translationYPx: 12 },
      });
      await flushMicrotasks();

      expect(controller.getState().zoomScale).toBe(1.75);
      expect(controller.getState().translation).toEqual({
        xPx: -40,
        yPx: 12,
      });
    });

    test("reduces an editor mode change into controller state", async () => {
      await completeLoad();
      expect(controller.getState().editorMode).toBeNull();

      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "editor-mode-changed",
        loadGeneration: 1,
        payload: { isEditorMode: true },
      });
      await flushMicrotasks();

      expect(controller.getState().editorMode).toEqual({ isEditorMode: true });
    });

    test("reduces a render progress event into controller state", async () => {
      await completeLoad();
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-progress-changed",
        loadGeneration: 1,
        payload: {
          completedRenderedElementCount: 40,
          totalRenderedElementCount: 100,
        },
      });
      await flushMicrotasks();

      expect(controller.getState().renderProgress).toEqual({
        completedRenderedElementCount: 40,
        totalRenderedElementCount: 100,
      });
    });
  });

  describe("export orchestration", () => {
    async function exportVisualization(exportRequest = {}, options = {}) {
      const exportPromise = controller.exportVisualization(
        exportRequest,
        options,
      );
      await flushMicrotasks(2);
      return exportPromise;
    }

    test("settles strictly, pauses, awaits paint, and restores the prior pause state", async () => {
      await completeLoad();
      const exportPromise = exportVisualization({ filename: "diagram.svg" });
      await flushMicrotasks(2);

      const strictSettlement = settlementRequests.at(-1);
      expect(strictSettlement.settlementRequest.onTimeout).toBe("fail");
      strictSettlement.resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks(6);

      const artifactMetadata = await exportPromise;
      expect(artifactMetadata.filename).toBe("diagram.svg");
      expect(waitForDocumentFonts).toHaveBeenCalledTimes(1);
      expect(waitForBrowserPaint).toHaveBeenCalledTimes(2);
      expect(controller.getState().layout.status).not.toBe("paused");
    });

    test("builds a view recipe from provenance, generation, view, and settlement", async () => {
      await completeLoad();
      const exportPromise = exportVisualization();
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "stable-frames",
      });
      await flushMicrotasks(6);
      await exportPromise;

      const { viewRecipe } =
        svgArtifactService.createSvgArtifact.mock.calls[0][0];
      expect(viewRecipe.loadGeneration).toBe(1);
      expect(viewRecipe.source).toEqual({
        kind: "ontology-document-iri",
        identity: DOCUMENT_IRI,
        sha256Hex: "a".repeat(64),
      });
      expect(viewRecipe.viewportDimensions).toEqual({
        widthPx: 800,
        heightPx: 600,
      });
      expect(viewRecipe.layoutOutcome).toEqual({
        status: "settled",
        reason: "stable-frames",
      });
    });

    test("accepts an explicit best-effort settlement outcome", async () => {
      await completeLoad();
      const exportPromise = exportVisualization({ onTimeout: "best-effort" });
      await flushMicrotasks(2);
      expect(settlementRequests.at(-1).settlementRequest.onTimeout).toBe(
        "best-effort",
      );
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "best-effort",
        reason: "timeout",
      });
      await flushMicrotasks(6);

      const artifactMetadata = await exportPromise;
      expect(artifactMetadata.viewRecipe.layoutOutcome).toEqual({
        status: "best-effort",
        reason: "timeout",
      });
    });

    test("restores a previously paused layout after export", async () => {
      await completeLoad();
      controller.setGraphLayoutPaused({ isPaused: true });

      const exportPromise = exportVisualization();
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks(6);
      await exportPromise;

      expect(controller.getState().layout).toEqual({ status: "paused" });
    });

    test("reports a bounded EXPORT_FAILED when artifact creation rejects", async () => {
      await completeLoad();
      svgArtifactService.createSvgArtifact.mockRejectedValueOnce(
        Object.assign(new Error("no blob"), {
          code: "EXPORT_FAILED",
          isRetryable: false,
          details: { exportStage: "blob-creation" },
        }),
      );

      const exportPromise = exportVisualization();
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });

      await expect(exportPromise).rejects.toEqual(
        expect.objectContaining({ code: "EXPORT_FAILED" }),
      );
      expect(controller.getState().layout.status).not.toBe("paused");
    });

    test("fails the export when strict settlement times out", async () => {
      await completeLoad();
      const exportPromise = exportVisualization({ onTimeout: "fail" });
      await flushMicrotasks(2);
      settlementRequests.at(-1).reject(
        Object.assign(new Error("layout timeout"), {
          code: "LAYOUT_TIMEOUT",
          isRetryable: false,
          details: { settleTimeoutMs: 12000 },
        }),
      );

      await expect(exportPromise).rejects.toEqual(
        expect.objectContaining({ code: "LAYOUT_TIMEOUT" }),
      );
    });

    test("stops the export when the caller cancels during settlement", async () => {
      await completeLoad();
      const cancellationController = new AbortController();
      const exportPromise = controller.exportVisualization(
        {},
        { signal: cancellationController.signal },
      );
      await flushMicrotasks(2);
      cancellationController.abort();
      settlementRequests.at(-1).reject(
        Object.assign(new Error("cancelled"), {
          code: "LOAD_ABORTED",
          isRetryable: false,
          details: {},
        }),
      );

      await expect(exportPromise).rejects.toEqual(
        expect.objectContaining({ code: "LOAD_ABORTED" }),
      );
      expect(controller.getState().layout.status).not.toBe("paused");
    });

    test("never restores pause state into a newer load generation", async () => {
      await completeLoad();
      let resolveArtifactCreation;
      svgArtifactService.createSvgArtifact.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveArtifactCreation = resolve;
        }),
      );

      const exportPromise = controller.exportVisualization({});
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks(6);

      const replacementLoadPromise = controller
        .loadOntology(SOURCE_REQUEST)
        .catch(() => undefined);
      await flushMicrotasks(2);
      resolveArtifactCreation({ pageLocalArtifactId: "svg-artifact-1-1" });

      await expect(exportPromise).rejects.toEqual(
        expect.objectContaining({ code: "LOAD_ABORTED" }),
      );

      deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeInitialPaint(2);
      await flushMicrotasks(3);
      renderedGraphTestHarness.completeVisualizationViewApplication(2);
      await flushMicrotasks(3);
      await replacementLoadPromise;

      expect(controller.getState().loadGeneration).toBe(2);
      expect(controller.getState().layout.status).not.toBe("paused");
    });

    test("re-throws a programming defect instead of normalising it", async () => {
      await completeLoad();
      const programmingDefect = new TypeError("waitForDocumentFonts is broken");
      waitForDocumentFonts.mockRejectedValueOnce(programmingDefect);

      const exportPromise = controller.exportVisualization({});
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });

      await expect(exportPromise).rejects.toBe(programmingDefect);
      expect(controller.getState().layout.status).not.toBe("paused");
    });

    test("rejects an export request field outside the documented surface", async () => {
      await completeLoad();

      await expect(
        controller.exportVisualization({ scaleFactor: 2 }),
      ).rejects.toThrow("scaleFactor");
    });

    test("rejects export before an ontology exists", async () => {
      await expect(controller.exportVisualization({})).rejects.toEqual(
        expect.objectContaining({ code: "NO_ONTOLOGY" }),
      );
    });
  });

  describe("controller boundary", () => {
    test("rejects dependencies outside the documented module surface", () => {
      expect(() =>
        createWebVowlController({
          ontologySourceLoader,
          renderedGraphRuntime,
          ontologyInspector: createOntologyInspector(),
          graphLayoutSettler,
          svgArtifactService,
          waitForDocumentFonts,
          waitForBrowserPaint,
          graph: { load: () => undefined },
        }),
      ).toThrow("invalid dependency field set");
    });

    test("exposes exactly the documented controller operations", () => {
      expect(Object.keys(controller).sort()).toEqual([
        "describeOntologyElements",
        "dispose",
        "exportVisualization",
        "findOntologyElements",
        "getOntologySummary",
        "getState",
        "loadOntology",
        "setContinuousZoom",
        "setForceLayoutDistances",
        "setGraphLayoutPaused",
        "setVisualizationMode",
        "setVisualizationView",
        "subscribeToState",
      ]);
    });

    test("never exposes source text, models, graphs, or object URLs in state", async () => {
      await completeLoad();
      const serialisedState = JSON.stringify(controller.getState());

      for (const forbiddenFragment of [
        "vowlModel",
        "objectUrl",
        "blob:",
        "detachedSvgRoot",
        "<svg",
        "stack",
      ]) {
        expect(serialisedState).not.toContain(forbiddenFragment);
      }
    });

    test("names no D3, WebMCP, or legacy operation identifier in its source", () => {
      const controllerSource = readFileSync(
        fileURLToPath(CONTROLLER_MODULE_URL),
        "utf8",
      );

      for (const forbiddenIdentifier of [
        "d3",
        "modelContext",
        "registerTool",
        "load_ontology",
        "export_visualization",
        "loadOntologyFromText",
        "exportSvg",
      ]) {
        expect(controllerSource).not.toMatch(
          new RegExp(
            `(?<![A-Za-z0-9_$])${forbiddenIdentifier}(?![A-Za-z0-9_$])`,
            "u",
          ),
        );
      }
    });
  });
});
