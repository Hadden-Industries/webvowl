import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";
import { OWLDocumentFormats } from "owlapi/formats";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";
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
let createWebMcpToolDispatch;

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
  ({ createWebMcpToolDispatch } = await loadEsmModuleForTest(
    new URL("../webmcp/webMcpToolContracts.js", import.meta.url),
    import.meta.url,
    { "owlapi/formats": { OWLDocumentFormats } },
  ));
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
    renderedGraphRuntime = {
      ...inMemoryAdapter.renderedGraphRuntime,
      replaceVowlModel: jest.fn(
        inMemoryAdapter.renderedGraphRuntime.replaceVowlModel,
      ),
    };
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

  function createDetachedSvgRootFixture() {
    return {
      localName: "svg",
      namespaceURI: "http://www.w3.org/2000/svg",
      parentNode: null,
      cloneNode(includeDescendants) {
        if (includeDescendants !== true) {
          throw new TypeError("Rendered SVG snapshots require a deep clone.");
        }
        return createDetachedSvgRootFixture();
      },
    };
  }

  async function completeLoad(
    loadGeneration = 1,
    loadOptions = {},
    snapshotOverrides = {},
    sourceLoadRecord = createSourceLoadRecord(),
  ) {
    const loadPromise = controller.loadOntology(SOURCE_REQUEST, loadOptions);
    await flushMicrotasks(2);
    const deferredLoad = deferredSourceLoads.at(-1);
    deferredLoad.onPhaseChange?.("parsing");
    deferredLoad.resolve(sourceLoadRecord);
    await flushMicrotasks(3);
    renderedGraphTestHarness.completeInitialPaint(
      loadGeneration,
      snapshotOverrides,
    );
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
    test.each(["FETCH_FAILED", "SOURCE_REJECTED"])(
      "keeps the accepted graph usable after a coded %s before replacement",
      async (code) => {
        await completeLoad();
        const failed = controller.loadOntology(SOURCE_REQUEST);
        deferredSourceLoads.at(-1).reject(
          Object.assign(new Error("The new source failed."), {
            code,
            isRetryable: false,
            details: {},
          }),
        );
        await expect(failed).rejects.toMatchObject({ code });
        const view = controller.setVisualizationView({
          filters: { datatypes: "hide" },
        });
        await flushMicrotasks(6);
        expect(
          renderedGraphTestHarness.completeVisualizationViewApplication(1),
        ).toBe(true);
        await expect(view).resolves.toMatchObject({ loadGeneration: 1 });
        controller.setGraphLayoutPaused({ isPaused: true });
        expect(controller.getState()).toMatchObject({
          loadGeneration: 1,
          layout: { status: "paused" },
          view: { filters: { datatypes: "hide" } },
        });
      },
    );

    test.each(["first-paint", "initial-view"])(
      "restores the accepted model after cancellation during %s",
      async (phase) => {
        const accepted = createSourceLoadRecord({
          vowlModel: {
            header: { title: { en: "Accepted" } },
            class: [{ id: "person", type: "owl:Class" }],
            classAttribute: [
              { id: "person", iri: "https://example.test/Person" },
            ],
          },
        });
        await completeLoad(1, {}, {}, accepted);
        renderedGraphTestHarness.publishRenderedGraphEvent({
          kind: "viewport-changed",
          loadGeneration: 1,
          payload: { zoomScale: 1.5, translationXPx: 20, translationYPx: -5 },
        });
        const priorState = controller.getState();
        const caller = new AbortController();
        const loading = controller.loadOntology(SOURCE_REQUEST, {
          signal: caller.signal,
        });
        const outcome = loading.catch((error) => error);
        deferredSourceLoads.at(-1).resolve(
          createSourceLoadRecord({
            vowlModel: {
              header: { title: { en: "Cancelled" } },
              class: [{ id: "other", type: "owl:Class" }],
            },
          }),
        );
        await flushMicrotasks(6);
        expect(renderedGraphRuntime.replaceVowlModel).toHaveBeenCalledTimes(2);
        if (phase === "initial-view") {
          expect(renderedGraphTestHarness.completeInitialPaint(2)).toBe(true);
          await flushMicrotasks(6);
        }
        caller.abort();
        await flushMicrotasks(12);
        expect(renderedGraphRuntime.replaceVowlModel).toHaveBeenCalledTimes(3);
        expect(
          renderedGraphRuntime.replaceVowlModel.mock.calls[2][0].vowlModel,
        ).toEqual(accepted.vowlModel);
        expect(renderedGraphTestHarness.completeInitialPaint(3)).toBe(true);
        await flushMicrotasks(6);
        renderedGraphTestHarness.publishRenderedGraphEvent({
          kind: "viewport-changed",
          loadGeneration: 3,
          payload: { zoomScale: 1.5, translationXPx: 40, translationYPx: 50 },
        });
        expect(
          renderedGraphTestHarness.completeVisualizationViewApplication(3),
        ).toBe(true);
        expect(await outcome).toMatchObject({ code: "LOAD_ABORTED" });
        expect(controller.getState().source).toEqual(priorState.source);
        expect(controller.getState().loadGeneration).toBe(3);
        expect(controller.getState().translation).toEqual({ xPx: 40, yPx: 50 });
        expect(
          controller.findOntologyElements({ query: "Person" }).matches,
        ).toHaveLength(1);
        expect(
          renderedGraphRuntime.readGraphLayoutSnapshot().loadGeneration,
        ).toBe(3);
      },
    );

    test("a newer load supersedes recovery without restoring stale ontology state", async () => {
      await completeLoad();
      const caller = new AbortController();
      const cancelled = controller
        .loadOntology(SOURCE_REQUEST, { signal: caller.signal })
        .catch((error) => error);
      deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
      await flushMicrotasks(6);
      caller.abort();
      await flushMicrotasks(12);
      expect(controller.getState().loadGeneration).toBe(3);
      const newestRecord = createSourceLoadRecord({
        sourceProvenance: {
          kind: "ontology-document-iri",
          identity: "https://example.test/newest.owl",
          sha256Hex: "c".repeat(64),
        },
      });
      const newest = completeLoad(4, {}, {}, newestRecord);
      expect(await cancelled).toMatchObject({ code: "LOAD_ABORTED" });
      await newest;
      expect(controller.getState().loadGeneration).toBe(4);
      expect(controller.getState().source.identity).toBe(
        "https://example.test/newest.owl",
      );
      expect(renderedGraphTestHarness.completeInitialPaint(3)).toBe(false);
    });

    test("clears the candidate when the first load is cancelled during its initial view", async () => {
      const caller = new AbortController();
      const loading = controller.loadOntology(SOURCE_REQUEST, {
        signal: caller.signal,
      });
      const outcome = loading.catch((error) => error);
      deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
      await flushMicrotasks(6);
      expect(renderedGraphTestHarness.completeInitialPaint(1)).toBe(true);
      await flushMicrotasks(6);
      caller.abort();
      await outcome;
      expect(controller.getState().status).toBe("idle");
      expect(() =>
        renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
      ).toThrow();
      expect(() => controller.getOntologySummary()).toThrow(
        expect.objectContaining({ code: "NO_ONTOLOGY" }),
      );
    });

    test.each(["cancelled", "failed"])(
      "redraws the accepted ontology when a request that interrupted recovery is %s before mounting",
      async (outcomeKind) => {
        const accepted = createSourceLoadRecord();
        await completeLoad(1, {}, {}, accepted);
        const firstCaller = new AbortController();
        const firstOutcome = controller
          .loadOntology(SOURCE_REQUEST, { signal: firstCaller.signal })
          .catch((error) => error);
        deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
        await flushMicrotasks(6);
        firstCaller.abort();
        await flushMicrotasks(12);
        expect(controller.getState().loadGeneration).toBe(3);

        const nextCaller = new AbortController();
        const nextOutcome = controller
          .loadOntology(SOURCE_REQUEST, { signal: nextCaller.signal })
          .catch((error) => error);
        if (outcomeKind === "cancelled") {
          nextCaller.abort();
        }
        deferredSourceLoads.at(-1).reject(
          outcomeKind === "cancelled"
            ? new DOMException("cancelled", "AbortError")
            : Object.assign(new Error("The source could not be fetched."), {
                code: "FETCH_FAILED",
                isRetryable: false,
                details: {},
              }),
        );
        await flushMicrotasks(16);

        expect(renderedGraphRuntime.replaceVowlModel).toHaveBeenCalledTimes(4);
        expect(
          renderedGraphRuntime.replaceVowlModel.mock.calls[3][0],
        ).toMatchObject({
          loadGeneration: 5,
          vowlModel: accepted.vowlModel,
        });
        expect(renderedGraphTestHarness.completeInitialPaint(5)).toBe(true);
        await flushMicrotasks(6);
        expect(
          renderedGraphTestHarness.completeVisualizationViewApplication(5),
        ).toBe(true);
        expect(await nextOutcome).toMatchObject({
          code: outcomeKind === "cancelled" ? "LOAD_ABORTED" : "FETCH_FAILED",
        });
        await firstOutcome;
        expect(controller.getState()).toMatchObject({
          loadGeneration: 5,
          source: accepted.sourceProvenance,
          status: "relaxing",
        });
        expect(
          renderedGraphRuntime.readVisibleRenderedGraphSnapshot()
            .loadGeneration,
        ).toBe(5);
      },
    );

    test("does not republish an accepted ontology after recovery has failed and cleared it", async () => {
      await completeLoad();
      const caller = new AbortController();
      const outcome = controller
        .loadOntology(SOURCE_REQUEST, { signal: caller.signal })
        .catch((error) => error);
      deferredSourceLoads.at(-1).resolve(createSourceLoadRecord());
      await flushMicrotasks(6);
      renderedGraphRuntime.replaceVowlModel.mockRejectedValueOnce(
        new Error("Recovery rendering failed."),
      );
      caller.abort();
      await outcome;
      expect(controller.getState().status).toBe("error");

      const nextCaller = new AbortController();
      const nextOutcome = controller
        .loadOntology(SOURCE_REQUEST, { signal: nextCaller.signal })
        .catch((error) => error);
      nextCaller.abort();
      deferredSourceLoads
        .at(-1)
        .reject(new DOMException("cancelled", "AbortError"));
      await nextOutcome;
      expect(controller.getState()).toMatchObject({
        status: "idle",
        loadGeneration: 0,
        source: null,
      });
      expect(() => controller.getOntologySummary()).toThrow(
        expect.objectContaining({ code: "NO_ONTOLOGY" }),
      );
    });

    test("never reuses a cancelled request generation", async () => {
      const caller = new AbortController();
      const loading = controller.loadOntology(SOURCE_REQUEST, {
        signal: caller.signal,
      });
      caller.abort();
      deferredSourceLoads
        .at(-1)
        .reject(new DOMException("cancelled", "AbortError"));
      await expect(loading).rejects.toMatchObject({ code: "LOAD_ABORTED" });
      await completeLoad(2);
      expect(controller.getState().loadGeneration).toBe(2);
    });

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
    test("publishes pan independently of the standing view and preserves magnification", async () => {
      await completeLoad();
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "viewport-changed",
        loadGeneration: 1,
        payload: { zoomScale: 1.5, translationXPx: 10, translationYPx: 20 },
      });
      const view = controller.setVisualizationView({
        translation: { xPx: -180.5, yPx: 72 },
      });
      await flushMicrotasks(6);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      expect(await view).toMatchObject({
        zoomScale: 1.5,
        translation: { xPx: -180.5, yPx: 72 },
      });
      expect(controller.getState().view).not.toHaveProperty("translation");
    });

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
      await completeLoad(
        1,
        {},
        {},
        createSourceLoadRecord({
          vowlModel: {
            header: { title: { en: "Example" } },
            class: [{ id: "c1", type: "owl:Class" }],
            classAttribute: [
              {
                id: "c1",
                iri: "https://example.test/Person",
                label: { de: "Person" },
              },
            ],
            property: [],
          },
        }),
      );
      const viewPromise = controller.setVisualizationView({ language: "de" });
      await flushMicrotasks(2);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await viewPromise;

      const appliedView = controller.getState().view;
      expect(appliedView.language).toBe("de");
      expect(appliedView.filters.minDegree).toBe(0);
      expect(appliedView).not.toHaveProperty("viewport");
      expect(appliedView).not.toHaveProperty("layout");
      expect(appliedView).not.toHaveProperty("zoomScale");
    });

    test("returns to relaxing and restarts observation on a relax view change", async () => {
      await completeLoad();
      const backgroundSettlement = settlementRequests.at(-1);
      const viewPromise = controller.setVisualizationView({ layout: "resume" });
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

    test("retains display and distance choices made before loading", async () => {
      // Display modes, force distances and zoom configure how a graph is drawn.
      // They are meaningful for an empty graph and persist across loads, so
      // unlike pausing a layout they do not require an ontology.
      await controller.setVisualizationModes({
        nodeScaling: false,
        maxLabelWidthPx: 80,
      });
      await controller.setForceLayoutDistances({ classDistancePx: 240 });
      expect(controller.getState().view).toMatchObject({
        modes: { nodeScaling: false, maxLabelWidthPx: 80 },
        forceDistances: { classDistancePx: 240 },
      });
      await completeLoad();
      expect(controller.getState().view).toMatchObject({
        modes: { nodeScaling: false, maxLabelWidthPx: 80 },
        forceDistances: { classDistancePx: 240 },
      });
      expect(controller.setContinuousZoom({ zoomDirection: "none" })).toBe(
        "none",
      );
    });

    test("returns the visualization to its defaults without an ontology", () => {
      // Resetting configures how a graph is drawn, so like the other renderer
      // tuning operations it does not require one to be loaded.
      expect(controller.resetVisualization()).toBeUndefined();
      expect(renderedGraphTestHarness.readVisualizationResetCount()).toBe(1);
    });

    test("publishes applied display modes to human and agent observers", async () => {
      await completeLoad();

      const observed = [];
      controller.subscribeToState((state, fields) => {
        if (fields.includes("view")) {
          observed.push(state.view.modes);
        }
      });
      const result = await controller.setVisualizationModes({
        nodeScaling: false,
        compactNotation: true,
      });
      expect(result).toEqual(controller.getState());
      expect(controller.getState().view.modes).toMatchObject({
        nodeScaling: false,
        compactNotation: true,
      });
      expect(observed.at(-1)).toMatchObject({
        nodeScaling: false,
        compactNotation: true,
      });
    });

    test("publishes applied force distances", async () => {
      await completeLoad();

      const result = await controller.setForceLayoutDistances({
        classDistancePx: 240,
      });
      expect(result).toEqual(controller.getState());
      expect(result.view.forceDistances).toEqual({
        classDistancePx: 240,
        datatypeDistancePx: 120,
      });
    });

    test("observes actual standing choices even when their requesting caller cancelled", async () => {
      await completeLoad();
      const view = {
        ...controller.getState().view,
        modes: { ...controller.getState().view.modes, maxLabelWidthPx: 20 },
      };
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "visualization-view-changed",
        loadGeneration: 1,
        payload: { appliedVisualizationView: view },
      });
      expect(controller.getState().view.modes.maxLabelWidthPx).toBe(20);
    });

    test("reports superseded display requests as ordinary cancellation through tool dispatch", async () => {
      await completeLoad();
      const applyModes = renderedGraphRuntime.setVisualizationModes;
      let rejectFirst;
      renderedGraphRuntime.setVisualizationModes = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirst = reject;
            }),
        )
        .mockImplementationOnce((request) => {
          rejectFirst(new DOMException("Newer display choice", "AbortError"));
          return applyModes(request);
        });
      const dispatch = createWebMcpToolDispatch({
        webVowlController: controller,
      });
      const first = dispatch.callWebMcpTool("set_visualization_modes", {
        maxLabelWidthPx: 20,
      });
      const second = await dispatch.callWebMcpTool("set_visualization_modes", {
        maxLabelWidthPx: 80,
      });
      expect(second.isSuccess).toBe(true);
      expect(await first).toMatchObject({
        isSuccess: false,
        error: { code: "LOAD_ABORTED" },
      });
      expect(controller.getState().view.modes.maxLabelWidthPx).toBe(80);
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

  describe("visualization language", () => {
    function createLabelledSourceLoadRecord() {
      return createSourceLoadRecord({
        vowlModel: {
          header: { title: { en: "Example" } },
          class: [{ id: "c1", type: "owl:Class" }],
          classAttribute: [
            {
              id: "c1",
              iri: "https://example.test/Person",
              label: { en: "Person" },
            },
          ],
          property: [],
        },
      });
    }

    test("refuses a language the loaded ontology does not carry", async () => {
      // Accepting it would report a language as selected while every label on
      // screen stayed as it was, so an agent would tell a reader the graph had
      // switched when it had not.
      await completeLoad();
      const viewBefore = controller.getState().view;

      await expect(
        controller.setVisualizationView({ language: "en" }),
      ).rejects.toMatchObject({ code: "VIEW_REJECTED" });

      expect(controller.getState().view).toEqual(viewBefore);
    });

    test("names the languages the ontology does carry", async () => {
      await completeLoad(1, {}, {}, createLabelledSourceLoadRecord());

      await expect(
        controller.setVisualizationView({ language: "fr" }),
      ).rejects.toMatchObject({
        code: "VIEW_REJECTED",
        message: expect.stringContaining("en"),
      });
    });

    test("accepts a language the ontology carries", async () => {
      await completeLoad(1, {}, {}, createLabelledSourceLoadRecord());

      const viewPromise = controller.setVisualizationView({ language: "en" });
      await flushMicrotasks(2);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await viewPromise;

      expect(controller.getState().view.language).toBe("en");
    });

    test("accepts the default language, which names no choice at all", async () => {
      await completeLoad();

      const viewPromise = controller.setVisualizationView({
        language: "default",
      });
      await flushMicrotasks(2);
      renderedGraphTestHarness.completeVisualizationViewApplication(1);
      await viewPromise;

      expect(controller.getState().view.language).toBe("default");
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
      // The recipe states the viewport the artifact was actually framed on,
      // taken from the snapshot itself. Reading it from anywhere else lets the
      // two disagree, which the serializer refuses.
      const { renderedSvgSnapshot } =
        svgArtifactService.createSvgArtifact.mock.calls[0][0];
      expect(viewRecipe.viewportDimensions).toEqual({
        widthPx: renderedSvgSnapshot.widthPx,
        heightPx: renderedSvgSnapshot.heightPx,
      });
      expect(viewRecipe.layoutOutcome).toEqual({
        status: "settled",
        reason: "stable-frames",
      });
    });

    test("states the viewport the artifact was framed on, not the layout's", async () => {
      // The artifact is framed on the viewport the reader is looking at, which
      // need not be the configured canvas the layout reports. The recipe must
      // state the viewport the artifact actually used, or the serializer
      // refuses the pair as inconsistent.
      await completeLoad(
        1,
        {},
        {
          renderedSvgSnapshot: {
            detachedSvgRoot: createDetachedSvgRootFixture(),
            heightPx: 845,
            loadGeneration: 1,
            widthPx: 1600,
          },
        },
      );

      const exportPromise = exportVisualization({ filename: "framed.svg" });
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks(6);
      await exportPromise;

      const { viewRecipe, renderedSvgSnapshot } =
        svgArtifactService.createSvgArtifact.mock.calls.at(-1)[0];

      expect(renderedSvgSnapshot.widthPx).toBe(1600);
      expect(viewRecipe.viewportDimensions).toEqual({
        widthPx: 1600,
        heightPx: 845,
      });
    });

    test("never disturbs a layout that has already come to rest", async () => {
      // Exporting holds the graph still so the snapshot matches what settled.
      // A layout that has ended is already still, so pausing it achieves
      // nothing and the resume afterwards would re-energise it — which is
      // right when a reader resumes, and wrong as a side effect of exporting.
      await completeLoad(
        1,
        {},
        {
          graphLayoutSnapshot: {
            forceAlpha: 0,
            hasEnded: true,
            heightPx: 600,
            isPaused: false,
            layoutElementPositions: [],
            loadGeneration: 1,
            observedAtMs: 1,
            widthPx: 800,
          },
        },
      );
      const pauseStatesBefore =
        renderedGraphTestHarness.readGraphLayoutPauseRequests().length;

      const exportPromise = exportVisualization({ filename: "still.svg" });
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await flushMicrotasks(6);
      await exportPromise;

      expect(
        renderedGraphTestHarness.readGraphLayoutPauseRequests().length,
      ).toBe(pauseStatesBefore);
    });

    test("does not restart a layout that ends while export is settling", async () => {
      await completeLoad();
      const exportPromise = exportVisualization({ filename: "ended.svg" });
      await flushMicrotasks(2);
      renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "graph-layout-state-changed",
        loadGeneration: 1,
        payload: { forceAlpha: 0, hasEnded: true, isPaused: false },
      });
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "native-end",
      });
      await exportPromise;
      expect(renderedGraphTestHarness.readGraphLayoutPauseRequests()).toEqual(
        [],
      );
      expect(renderedGraphRuntime.readGraphLayoutSnapshot()).toMatchObject({
        forceAlpha: 0,
        hasEnded: true,
        isPaused: false,
      });
    });

    test("captures and restores the reader's pause choice made during settlement", async () => {
      await completeLoad();
      controller.setGraphLayoutPaused({ isPaused: true });
      const exportPromise = exportVisualization({ filename: "changed.svg" });
      await flushMicrotasks(2);
      controller.setGraphLayoutPaused({ isPaused: false });
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "stable-frames",
      });
      await exportPromise;
      expect(renderedGraphTestHarness.readGraphLayoutPauseRequests()).toEqual([
        true,
        false,
        true,
        false,
      ]);
      expect(renderedGraphRuntime.readGraphLayoutSnapshot().isPaused).toBe(
        false,
      );
    });

    test("holds a still-relaxing layout still and restores it afterwards", async () => {
      await completeLoad();

      const exportPromise = exportVisualization({ filename: "moving.svg" });
      await flushMicrotasks(2);
      settlementRequests.at(-1).resolve({
        loadGeneration: 1,
        status: "settled",
        reason: "stable-frames",
      });
      await flushMicrotasks(6);
      await exportPromise;

      expect(renderedGraphTestHarness.readGraphLayoutPauseRequests()).toEqual([
        true,
        false,
      ]);
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
        "resetVisualization",
        "setContinuousZoom",
        "setForceLayoutDistances",
        "setGraphLayoutPaused",
        "setVisualizationModes",
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
