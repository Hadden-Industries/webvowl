import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let assertRenderedGraphRuntimeContract;
let createD3RenderedGraphAdapter;
let createRenderedGraphConfiguration;

const ADAPTER_MODULE_URL = new URL(
  "./d3RenderedGraphAdapter.js",
  import.meta.url,
);
const CONTRACT_SUITE_MODULE_URL = new URL(
  "../../../app/test/renderedGraphRuntimeContract.js",
  import.meta.url,
);
const CONFIGURATION_MODULE_URL = new URL(
  "./renderedGraphConfiguration.js",
  import.meta.url,
);

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";

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
  ({ createRenderedGraphConfiguration } = (
    await loadRepositoryModule(CONFIGURATION_MODULE_URL)
  ).namespace);
  ({ assertRenderedGraphRuntimeContract } = (
    await loadRepositoryModule(CONTRACT_SUITE_MODULE_URL)
  ).namespace);
  ({ createD3RenderedGraphAdapter } = (
    await loadRepositoryModule(ADAPTER_MODULE_URL)
  ).namespace);
});

class SvgElementFixture {
  constructor(documentObject, localName, namespaceIri) {
    this.attributes = new Map();
    this.childNodes = [];
    this.documentObject = documentObject;
    this.localName = localName;
    this.namespaceURI = namespaceIri;
    // parentNode is read-only on real DOM nodes. The double enforces that so
    // an assignment cannot pass here and throw in a browser.
    this.ownParentNode = null;
    this.style = { cssText: "" };
    this.textContent = "";
  }

  get tagName() {
    return this.localName;
  }

  get parentNode() {
    return this.ownParentNode;
  }

  appendChild(childElement) {
    childElement.ownParentNode = this;
    this.childNodes.push(childElement);
    return childElement;
  }

  cloneNode(includeDescendants) {
    const clonedElement = new SvgElementFixture(
      this.documentObject,
      this.localName,
      this.namespaceURI,
    );
    clonedElement.attributes = new Map(this.attributes);
    clonedElement.textContent = this.textContent;
    clonedElement.style = { cssText: this.style.cssText };
    if (includeDescendants) {
      for (const childElement of this.childNodes) {
        clonedElement.appendChild(childElement.cloneNode(true));
      }
    }
    return clonedElement;
  }

  getAttribute(attributeName) {
    return this.attributes.get(attributeName) ?? null;
  }

  setAttribute(attributeName, attributeValue) {
    this.attributes.set(attributeName, String(attributeValue));
  }

  removeChild(childElement) {
    const childIndex = this.childNodes.indexOf(childElement);
    if (childIndex !== -1) {
      this.childNodes.splice(childIndex, 1);
      childElement.ownParentNode = null;
    }
    return childElement;
  }

  replaceChildren(...childElements) {
    for (const childElement of this.childNodes) {
      childElement.ownParentNode = null;
    }
    this.childNodes = [];
    for (const childElement of childElements) {
      this.appendChild(childElement);
    }
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matched = [];
    const visit = (element) => {
      for (const childElement of element.childNodes) {
        const isClassSelector = selector.startsWith(".");
        if (
          selector === "*" ||
          (isClassSelector &&
            (childElement.getAttribute("class") ?? "").includes(
              selector.slice(1),
            )) ||
          (!isClassSelector && childElement.localName === selector)
        ) {
          matched.push(childElement);
        }
        visit(childElement);
      }
    };
    visit(this);
    return matched;
  }
}

class SvgDocumentFixture {
  constructor() {
    this.createdElements = [];
  }

  createElementNS(namespaceIri, localName) {
    const createdElement = new SvgElementFixture(this, localName, namespaceIri);
    this.createdElements.push(createdElement);
    return createdElement;
  }
}

function createForceSimulationFixture() {
  const registeredListeners = new Map();
  let simulationNodes = [];
  let alphaValue = 1;
  let isStopped = false;

  const forceSimulation = {
    alpha(nextAlpha) {
      if (nextAlpha === undefined) {
        return alphaValue;
      }
      alphaValue = nextAlpha;
      return forceSimulation;
    },
    alphaTarget() {
      return forceSimulation;
    },
    force() {
      return forceSimulation;
    },
    nodes(nextNodes) {
      if (nextNodes === undefined) {
        return simulationNodes;
      }
      simulationNodes = nextNodes;
      return forceSimulation;
    },
    on(eventName, listener) {
      registeredListeners.set(eventName, listener);
      return forceSimulation;
    },
    restart() {
      isStopped = false;
      return forceSimulation;
    },
    stop() {
      isStopped = true;
      return forceSimulation;
    },
    get isStopped() {
      return isStopped;
    },
    emit(eventName) {
      registeredListeners.get(eventName)?.();
    },
    listenerCount() {
      return [...registeredListeners.values()].filter(
        (listener) => typeof listener === "function",
      ).length;
    },
  };
  return forceSimulation;
}

function createD3Fixture() {
  const createdSimulations = [];
  return {
    createdSimulations,
    forceSimulation() {
      const forceSimulation = createForceSimulationFixture();
      createdSimulations.push(forceSimulation);
      return forceSimulation;
    },
    forceLink: () => ({ id: () => ({ distance: () => undefined }) }),
    forceManyBody: () => ({ strength: () => undefined }),
    forceCenter: () => ({}),
    forceCollide: () => ({ radius: () => undefined }),
  };
}

function createAdapterHarness() {
  const documentObject = new SvgDocumentFixture();
  const graphContainerElement = documentObject.createElementNS(
    SVG_NAMESPACE_IRI,
    "svg",
  );
  const d3Fixture = createD3Fixture();
  // The adapter owns the renderer implementation; the test supplies a
  // deterministic stand-in rather than a live D3 graph.
  function createFilterModuleFixture() {
    let enabledState = true;
    return {
      enabled(nextEnabledState) {
        if (nextEnabledState === undefined) {
          return enabledState;
        }
        enabledState = nextEnabledState;
        return undefined;
      },
    };
  }

  const renderedGraphInternalsFixture = {
    focuserModule: { handle: () => undefined },
    filterModules: {
      datatypes: createFilterModuleFixture(),
      disjointness: createFilterModuleFixture(),
      minDegree: {
        enabledStates: [],
        minDegreeValues: [],
        enabled(nextEnabledState) {
          this.enabledStates.push(nextEnabledState);
        },
        minDegree(value) {
          this.minDegreeValues.push(value);
        },
      },
      objectProperties: createFilterModuleFixture(),
      setOperators: createFilterModuleFixture(),
      subclasses: createFilterModuleFixture(),
    },
    callOrder: [],
    loadCallCount: 0,
    pauseStates: [],
    suppliedVowlModels: [],
    options: () => ({
      datatypeFilter: () =>
        renderedGraphInternalsFixture.filterModules.datatypes,
      objectPropertyFilter: () =>
        renderedGraphInternalsFixture.filterModules.objectProperties,
      subclassFilter: () =>
        renderedGraphInternalsFixture.filterModules.subclasses,
      disjointPropertyFilter: () =>
        renderedGraphInternalsFixture.filterModules.disjointness,
      setOperatorFilter: () =>
        renderedGraphInternalsFixture.filterModules.setOperators,
      nodeDegreeFilter: () =>
        renderedGraphInternalsFixture.filterModules.minDegree,
      focuserModule: () => renderedGraphInternalsFixture.focuserModule,
      data(vowlModel) {
        renderedGraphInternalsFixture.callOrder.push("data");
        renderedGraphInternalsFixture.suppliedVowlModels.push(vowlModel);
      },
    }),
    start() {
      renderedGraphInternalsFixture.callOrder.push("start");
      // The renderer builds its SVG root inside the container.
      graphContainerElement.replaceChildren(
        documentObject.createElementNS(SVG_NAMESPACE_IRI, "svg"),
      );
    },
    load() {
      renderedGraphInternalsFixture.callOrder.push("load");
      renderedGraphInternalsFixture.loadCallCount += 1;
    },
    paused(isPaused) {
      renderedGraphInternalsFixture.pauseStates.push(isPaused);
    },
    setRenderedGraphEventPort(nextPort) {
      renderedGraphInternalsFixture.installedEventPort = nextPort;
    },
    installedEventPort: undefined,
    appliedLanguages: [],
    updateCallCount: 0,
    relocationRequests: 0,
    language(nextLanguage) {
      renderedGraphInternalsFixture.appliedLanguages.push(nextLanguage);
    },
    update() {
      renderedGraphInternalsFixture.updateCallCount += 1;
    },
    forceRelocationEvent() {
      renderedGraphInternalsFixture.relocationRequests += 1;
    },
    requestedZoomScales: [],
    setSliderZoom(zoomScale) {
      renderedGraphInternalsFixture.requestedZoomScales.push(zoomScale);
    },
    highlightedElementIds: [],
    locateRequests: 0,
    highLightNodes(elementIds) {
      renderedGraphInternalsFixture.highlightedElementIds.push(elementIds);
    },
    locateSearchResult() {
      renderedGraphInternalsFixture.locateRequests += 1;
    },
    highlightResets: 0,
    resetSearchHighlight() {
      renderedGraphInternalsFixture.highlightResets += 1;
    },
    restartForceLayout() {
      renderedGraphInternalsFixture.callOrder.push("relax");
    },
  };
  const pendingPaintObservations = [];

  const { renderedGraphRuntime, renderedGraphInteractionPort } =
    createD3RenderedGraphAdapter({
      d3: d3Fixture,
      renderedGraphInternals: renderedGraphInternalsFixture,
      graphContainerElement,
      observeNextPaint: (loadGeneration, { signal } = {}) =>
        new Promise((resolve) => {
          const paintObservation = { loadGeneration, resolve };
          pendingPaintObservations.push(paintObservation);
          signal?.addEventListener(
            "abort",
            () => {
              const observationIndex =
                pendingPaintObservations.indexOf(paintObservation);
              if (observationIndex !== -1) {
                pendingPaintObservations.splice(observationIndex, 1);
              }
            },
            { once: true },
          );
        }),
      renderedGraphConfiguration: createRenderedGraphConfiguration(),
    });

  function resolvePendingPaint(loadGeneration) {
    const observationIndex = pendingPaintObservations.findIndex(
      (observation) => observation.loadGeneration === loadGeneration,
    );
    if (observationIndex === -1) {
      return false;
    }
    const [observation] = pendingPaintObservations.splice(observationIndex, 1);
    observation.resolve();
    return true;
  }

  return {
    d3Fixture,
    documentObject,
    renderedGraphInternalsFixture,
    graphContainerElement,
    renderedGraphRuntime,
    renderedGraphTestHarness: {
      completeInitialPaint: resolvePendingPaint,
      completeVisualizationViewApplication: resolvePendingPaint,
      reportRenderedElementSelection: (selectedElementIds) =>
        renderedGraphInternalsFixture.installedEventPort?.publishRenderedElementSelection(
          selectedElementIds,
        ),
      publishRenderedGraphEvent:
        renderedGraphInteractionPort.publishRenderedGraphEvent,
    },
  };
}

describe("D3 rendered graph adapter", () => {
  test("satisfies the reusable rendered graph runtime contract", async () => {
    await assertRenderedGraphRuntimeContract({
      createAdapterHarness,
      expect,
    });
  });

  function replacementRequest(loadGeneration) {
    return {
      displayName: `generation-${loadGeneration}.json`,
      loadGeneration,
      // Real VOWL JSON keeps identity and labels in the *Attribute
      // collections, keyed by the id of the bare element entry.
      vowlModel: {
        class: [
          { id: "Person", type: "owl:Class" },
          { id: "AnonymousClass1", type: "owl:Class" },
        ],
        classAttribute: [
          {
            id: "Person",
            iri: "https://example.test/Person",
            label: { undefined: "Person" },
          },
          { id: "AnonymousClass1" },
        ],
        property: [{ id: "knows", type: "owl:ObjectProperty" }],
        propertyAttribute: [
          {
            id: "knows",
            iri: "https://example.test/knows",
            label: { undefined: "knows" },
          },
        ],
        header: { iri: "https://example.test/ontology" },
      },
    };
  }

  async function loadGeneration(adapterHarness, generation) {
    const replacementPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        replacementRequest(generation),
        {},
      );
    adapterHarness.renderedGraphTestHarness.completeInitialPaint(generation);
    await replacementPromise;
  }

  test("stops the retired generation's simulation when superseded", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const retiredSimulation = adapterHarness.d3Fixture.createdSimulations[0];

    const replacementPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        replacementRequest(2),
        {},
      );
    adapterHarness.renderedGraphTestHarness.completeInitialPaint(2);
    await replacementPromise;

    expect(retiredSimulation.isStopped).toBe(true);
    expect(retiredSimulation.listenerCount()).toBe(0);
  });

  test("publishes no event from a retired generation's force end", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const retiredSimulation = adapterHarness.d3Fixture.createdSimulations[0];
    const publishedEvents = [];
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (event) => publishedEvents.push(event.kind),
    );

    await loadGeneration(adapterHarness, 2);
    retiredSimulation.emit("end");

    expect(publishedEvents).toEqual([]);
  });

  test("rejects a snapshot request for a superseded generation", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    await loadGeneration(adapterHarness, 2);

    expect(() =>
      adapterHarness.renderedGraphRuntime.createRenderedSvgSnapshot({
        loadGeneration: 1,
      }),
    ).toThrow(expect.objectContaining({ name: "AbortError" }));
    expect(() =>
      adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
        loadGeneration: 1,
        isPaused: true,
      }),
    ).toThrow(expect.objectContaining({ name: "AbortError" }));
  });

  test("projects deeply frozen snapshots that no caller can mutate", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    const visibleRenderedGraphSnapshot =
      adapterHarness.renderedGraphRuntime.readVisibleRenderedGraphSnapshot();
    const graphLayoutSnapshot =
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot();

    for (const frozenValue of [
      visibleRenderedGraphSnapshot,
      visibleRenderedGraphSnapshot.visibleElementReferences,
      visibleRenderedGraphSnapshot.visibleElementReferences[0],
      graphLayoutSnapshot.layoutElementPositions,
    ]) {
      expect(Object.isFrozen(frozenValue)).toBe(true);
    }

    expect(() => {
      "use strict";
      visibleRenderedGraphSnapshot.visibleElementReferences.push({
        kind: "class",
        iri: "https://example.test/Injected",
      });
    }).toThrow();
    expect(
      adapterHarness.renderedGraphRuntime.readVisibleRenderedGraphSnapshot()
        .visibleElementReferences.length,
    ).toBe(visibleRenderedGraphSnapshot.visibleElementReferences.length);
  });

  test("applies a requested magnification to the renderer", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        zoomScale: 2.5,
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    expect(
      adapterHarness.renderedGraphInternalsFixture.requestedZoomScales,
    ).toEqual([2.5]);
  });

  test("builds the renderer graph root once and reloads it for later models", async () => {
    const adapterHarness = createAdapterHarness();

    // Only the renderer's start builds its SVG root, and it must run before a
    // model is present so it constructs the container without parsing.
    await loadGeneration(adapterHarness, 1);

    expect(adapterHarness.renderedGraphInternalsFixture.callOrder).toEqual([
      "start",
      "data",
      "load",
    ]);

    await loadGeneration(adapterHarness, 2);

    expect(adapterHarness.renderedGraphInternalsFixture.callOrder).toEqual([
      "start",
      "data",
      "load",
      "data",
      "load",
    ]);
  });

  test("clones the live SVG and strips interaction-only content from the clone", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    // The renderer owns the live tree: an SVG root inside the container that
    // carries interaction-only content the export must drop.
    const liveSvgRoot = adapterHarness.documentObject.createElementNS(
      SVG_NAMESPACE_IRI,
      "svg",
    );
    const interactionOnlyElement =
      adapterHarness.documentObject.createElementNS(SVG_NAMESPACE_IRI, "g");
    interactionOnlyElement.setAttribute("class", "vowl-interaction-only");
    liveSvgRoot.appendChild(interactionOnlyElement);
    adapterHarness.graphContainerElement.replaceChildren(liveSvgRoot);
    const liveChildCountBefore =
      adapterHarness.graphContainerElement.childNodes[0].childNodes.length;

    const renderedSvgSnapshot =
      adapterHarness.renderedGraphRuntime.createRenderedSvgSnapshot({
        loadGeneration: 1,
      });

    // The export serializes an SVG root, not the container that holds it.
    expect(renderedSvgSnapshot.detachedSvgRoot.tagName).toBe("svg");
    expect(renderedSvgSnapshot.detachedSvgRoot).not.toBe(liveSvgRoot);
    expect(renderedSvgSnapshot.detachedSvgRoot.parentNode).toBeNull();
    expect(
      renderedSvgSnapshot.detachedSvgRoot.querySelectorAll(
        ".vowl-interaction-only",
      ),
    ).toEqual([]);
    expect(
      adapterHarness.graphContainerElement.childNodes[0].childNodes.length,
    ).toBe(liveChildCountBefore);
    expect(
      adapterHarness.graphContainerElement.querySelectorAll(
        ".vowl-interaction-only",
      ).length,
    ).toBe(1);
  });

  test("names no user-interface identifier in its source", () => {
    const adapterSource = readFileSync(
      fileURLToPath(ADAPTER_MODULE_URL),
      "utf8",
    );

    for (const forbiddenIdentifier of [
      "sidebar",
      "searchMenu",
      "exportMenu",
      "ontologyMenu",
      "loadingModule",
      "warningModule",
      "directInputModule",
      "zoomSlider",
    ]) {
      expect(adapterSource).not.toMatch(
        new RegExp(
          `(?<![A-Za-z0-9_$])${forbiddenIdentifier}(?![A-Za-z0-9_$])`,
          "u",
        ),
      );
    }
  });

  test("applies a requested view to the renderer as one recomputation", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;
    const updateCountBefore = internals.updateCallCount;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        filters: { datatypes: "hide", minDegree: 3 },
        language: "en",
        viewport: "fit",
        zoomScale: null,
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // "hide" activates the renderer's datatype filter.
    expect(internals.filterModules.datatypes.enabled()).toBe(true);
    expect(internals.filterModules.minDegree.minDegreeValues).toEqual([3]);
    expect(internals.filterModules.minDegree.enabledStates).toEqual([true]);
    expect(internals.appliedLanguages).toEqual(["en"]);
    // Filter, language and degree changes recompute the graph once.
    expect(internals.updateCallCount).toBe(updateCountBefore + 1);
    expect(internals.relocationRequests).toBe(1);
  });

  test("lays out every drawn node when several share one ontology IRI", async () => {
    const adapterHarness = createAdapterHarness();
    // owl:Thing appears once per usage in real VOWL models, so an IRI does not
    // identify a drawn node on its own.
    const replacementPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        {
          displayName: "shared-iri.json",
          loadGeneration: 1,
          vowlModel: {
            class: [
              { id: "1", type: "owl:Thing" },
              { id: "2", type: "owl:Thing" },
            ],
            classAttribute: [
              { id: "1", iri: "http://www.w3.org/2002/07/owl#Thing" },
              { id: "2", iri: "http://www.w3.org/2002/07/owl#Thing" },
            ],
            header: {},
          },
        },
        {},
      );
    adapterHarness.renderedGraphTestHarness.completeInitialPaint(1);
    await replacementPromise;

    const layoutSnapshot =
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot();

    expect(layoutSnapshot.layoutElementPositions).toHaveLength(2);
  });

  test("brings the focused elements into view by their renderer ids", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        focus: [{ kind: "class", iri: "https://example.test/Person" }],
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // The reference names the ontology element; the runtime resolves it to the
    // drawn node the renderer knows. Highlighting does not move the viewport.
    expect(internals.highlightedElementIds).toEqual([["Person"]]);
    expect(internals.locateRequests).toBe(0);
  });

  test("advances the viewport to the next focused element on request", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        viewport: "focus-next",
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // Locating is its own action, so it neither re-highlights nor refits.
    expect(internals.locateRequests).toBe(1);
    expect(internals.relocationRequests).toBe(0);
    expect(internals.highlightedElementIds).toEqual([]);
  });

  test("clears the highlight when the focus becomes empty", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        focus: [],
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // Nothing is selected, so nothing should still be pulsing.
    expect(internals.highlightResets).toBe(1);
    expect(internals.highlightedElementIds).toEqual([]);
    expect(internals.locateRequests).toBe(0);
  });

  test("publishes a renderer selection as ontology element references", async () => {
    const adapterHarness = createAdapterHarness();
    const publishedEvents = [];
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (renderedGraphEvent) => publishedEvents.push(renderedGraphEvent),
    );
    await loadGeneration(adapterHarness, 1);

    adapterHarness.renderedGraphTestHarness.reportRenderedElementSelection([
      "Person",
    ]);

    // The renderer speaks in its own element ids; the runtime translates.
    const selectionEvents = publishedEvents.filter(
      (renderedGraphEvent) =>
        renderedGraphEvent.kind === "rendered-element-selection-changed",
    );
    expect(selectionEvents).toHaveLength(1);
    expect(
      selectionEvents[0].payload.selectedOntologyElementReferences,
    ).toEqual([{ kind: "class", iri: "https://example.test/Person" }]);
  });

  test("publishes an empty selection when the renderer reports none", async () => {
    const adapterHarness = createAdapterHarness();
    const publishedEvents = [];
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (renderedGraphEvent) => publishedEvents.push(renderedGraphEvent),
    );
    await loadGeneration(adapterHarness, 1);

    adapterHarness.renderedGraphTestHarness.reportRenderedElementSelection([]);

    const selectionEvents = publishedEvents.filter(
      (renderedGraphEvent) =>
        renderedGraphEvent.kind === "rendered-element-selection-changed",
    );
    expect(
      selectionEvents[0].payload.selectedOntologyElementReferences,
    ).toEqual([]);
  });

  test("does not recompute the graph when only the focus changes", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;
    const updateCountBefore = internals.updateCallCount;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        focus: [{ kind: "class", iri: "https://example.test/Person" }],
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // Recomputing restarts the force simulation, which would move every node
    // just because the reader highlighted something.
    expect(internals.updateCallCount).toBe(updateCountBefore);
  });

  test("does not recompute the graph when the focus is cleared", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;
    const updateCountBefore = internals.updateCallCount;

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        focus: [],
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    expect(internals.updateCallCount).toBe(updateCountBefore);
    expect(internals.highlightResets).toBe(1);
  });
});
