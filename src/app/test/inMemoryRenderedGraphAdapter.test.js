import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let assertRenderedGraphRuntimeContract;
let createInMemoryRenderedGraphAdapter;

const WEB_VOWL_CONTROLLER_CONTRACTS_MODULE_URL = new URL(
  "../js/controller/webVowlControllerContracts.js",
  import.meta.url,
);
const RENDERED_GRAPH_RUNTIME_CONTRACTS_MODULE_URL = new URL(
  "../js/controller/renderedGraphRuntimeContracts.js",
  import.meta.url,
);
const IN_MEMORY_RENDERED_GRAPH_ADAPTER_MODULE_URL = new URL(
  "./inMemoryRenderedGraphAdapter.js",
  import.meta.url,
);
const RENDERED_GRAPH_RUNTIME_CONTRACT_MODULE_URL = new URL(
  "./renderedGraphRuntimeContract.js",
  import.meta.url,
);

function createSourceTextModule(moduleUrl) {
  return new SourceTextModule(readFileSync(fileURLToPath(moduleUrl), "utf8"), {
    identifier: moduleUrl.href,
  });
}

beforeAll(async () => {
  const webVowlControllerContractsModule = createSourceTextModule(
    WEB_VOWL_CONTROLLER_CONTRACTS_MODULE_URL,
  );
  await webVowlControllerContractsModule.link((specifier) => {
    throw new Error(`Unexpected controller-contract dependency: ${specifier}`);
  });
  await webVowlControllerContractsModule.evaluate();

  const renderedGraphRuntimeContractsModule = createSourceTextModule(
    RENDERED_GRAPH_RUNTIME_CONTRACTS_MODULE_URL,
  );
  await renderedGraphRuntimeContractsModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlControllerContractsModule;
    }
    throw new Error(`Unexpected rendered-graph dependency: ${specifier}`);
  });
  await renderedGraphRuntimeContractsModule.evaluate();

  const inMemoryRenderedGraphAdapterModule = createSourceTextModule(
    IN_MEMORY_RENDERED_GRAPH_ADAPTER_MODULE_URL,
  );
  const renderedGraphRuntimeContractModule = createSourceTextModule(
    RENDERED_GRAPH_RUNTIME_CONTRACT_MODULE_URL,
  );
  const linkTaskFourTestModule = (specifier) => {
    if (specifier === "../js/controller/renderedGraphRuntimeContracts.js") {
      return renderedGraphRuntimeContractsModule;
    }
    throw new Error(`Unexpected Task 4 test dependency: ${specifier}`);
  };
  await Promise.all([
    inMemoryRenderedGraphAdapterModule.link(linkTaskFourTestModule),
    renderedGraphRuntimeContractModule.link(linkTaskFourTestModule),
  ]);
  await Promise.all([
    inMemoryRenderedGraphAdapterModule.evaluate(),
    renderedGraphRuntimeContractModule.evaluate(),
  ]);

  ({ createInMemoryRenderedGraphAdapter } =
    inMemoryRenderedGraphAdapterModule.namespace);
  ({ assertRenderedGraphRuntimeContract } =
    renderedGraphRuntimeContractModule.namespace);
});

function createReplacementRequest(loadGeneration) {
  return {
    loadGeneration,
    vowlModel: {
      class: [{ id: String(loadGeneration), type: "owl:Class" }],
      header: { iri: `https://example.test/ontology/${loadGeneration}` },
    },
  };
}

async function completeLoad(adapterHarness, loadGeneration) {
  const loadPromise = adapterHarness.renderedGraphRuntime.replaceVowlModel(
    createReplacementRequest(loadGeneration),
    { signal: new AbortController().signal },
  );
  adapterHarness.renderedGraphTestHarness.completeInitialPaint(loadGeneration);
  await loadPromise;
}

function createVisibleRenderedGraphSnapshotSource(loadGeneration) {
  return {
    loadGeneration,
    visibleElementReferences: [
      { kind: "class", iri: "https://example.test/Person" },
      { kind: "datatype", iri: "http://www.w3.org/2001/XMLSchema#string" },
    ],
    visibleRelationshipReferences: [
      { kind: "property", iri: "https://example.test/name" },
    ],
    visibleGraphCounts: { visibleNodeCount: 2, visiblePropertyCount: 1 },
  };
}

describe("InMemoryRenderedGraphAdapter", () => {
  test("satisfies the reusable rendered-graph runtime contract", async () => {
    await assertRenderedGraphRuntimeContract({
      createAdapterHarness: createInMemoryRenderedGraphAdapter,
      expect,
    });
  });

  test("caller abort prevents a pending view application from completing", async () => {
    const adapterHarness = createInMemoryRenderedGraphAdapter();
    await completeLoad(adapterHarness, 1);
    const abortController = new AbortController();
    const abortReason = new DOMException(
      "The caller cancelled the view change.",
      "AbortError",
    );
    const viewApplicationPromise =
      adapterHarness.renderedGraphRuntime.applyVisualizationView(
        { language: "fr", loadGeneration: 1 },
        { signal: abortController.signal },
      );

    abortController.abort(abortReason);

    await expect(viewApplicationPromise).rejects.toBe(abortReason);
    expect(
      adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
        1,
      ),
    ).toBe(false);
    adapterHarness.renderedGraphRuntime.dispose();
  });

  test("an already-aborted replacement returns a rejected promise", async () => {
    const adapterHarness = createInMemoryRenderedGraphAdapter();
    const abortController = new AbortController();
    const abortReason = new DOMException(
      "Rendering was cancelled before it started.",
      "AbortError",
    );
    abortController.abort(abortReason);
    let replacementPromise;

    expect(() => {
      replacementPromise = adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(1),
        { signal: abortController.signal },
      );
    }).not.toThrow();

    await expect(replacementPromise).rejects.toBe(abortReason);
    await completeLoad(adapterHarness, 1);
    adapterHarness.renderedGraphRuntime.dispose();
  });

  test("events from a superseded generation never reach subscribers", async () => {
    const adapterHarness = createInMemoryRenderedGraphAdapter();
    await completeLoad(adapterHarness, 1);
    const publishedEvents = [];
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (event) => publishedEvents.push(event),
    );
    const nextLoadPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(2),
        { signal: new AbortController().signal },
      );

    expect(
      adapterHarness.renderedGraphTestHarness.publishRenderedGraphEvent({
        kind: "render-progress-changed",
        loadGeneration: 1,
        payload: {
          completedRenderedElementCount: 1,
          totalRenderedElementCount: 2,
        },
      }),
    ).toBe(false);
    expect(publishedEvents).toEqual([]);

    adapterHarness.renderedGraphTestHarness.completeInitialPaint(2);
    await nextLoadPromise;
    adapterHarness.renderedGraphRuntime.dispose();
  });

  test("completion snapshots do not retain adapter-harness records", async () => {
    const adapterHarness = createInMemoryRenderedGraphAdapter();
    const visibleRenderedGraphSnapshotSource =
      createVisibleRenderedGraphSnapshotSource(1);
    const loadPromise = adapterHarness.renderedGraphRuntime.replaceVowlModel(
      createReplacementRequest(1),
      { signal: new AbortController().signal },
    );

    adapterHarness.renderedGraphTestHarness.completeInitialPaint(1, {
      visibleRenderedGraphSnapshot: visibleRenderedGraphSnapshotSource,
    });
    await loadPromise;
    visibleRenderedGraphSnapshotSource.visibleElementReferences[0].iri =
      "https://example.test/Mutated";
    visibleRenderedGraphSnapshotSource.visibleRelationshipReferences.length = 0;

    expect(
      adapterHarness.renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
    ).toEqual(createVisibleRenderedGraphSnapshotSource(1));
    adapterHarness.renderedGraphRuntime.dispose();
  });

  test("manual first-paint completion is deterministic across microtasks", async () => {
    const adapterHarness = createInMemoryRenderedGraphAdapter();
    let hasResolved = false;
    const loadPromise = adapterHarness.renderedGraphRuntime.replaceVowlModel(
      createReplacementRequest(1),
      { signal: new AbortController().signal },
    );
    void loadPromise.then(() => {
      hasResolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(hasResolved).toBe(false);

    adapterHarness.renderedGraphTestHarness.completeInitialPaint(1);
    await loadPromise;
    expect(hasResolved).toBe(true);
    adapterHarness.renderedGraphRuntime.dispose();
  });
});
