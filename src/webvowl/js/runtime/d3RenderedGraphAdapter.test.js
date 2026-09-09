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
    this.style = {
      cssText: "",
      properties: {},
      setProperty(propertyName, propertyValue) {
        this.properties[propertyName] = propertyValue;
      },
    };
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

  // ChildNode.remove, which every real element has.
  remove() {
    this.ownParentNode?.removeChild(this);
  }

  cloneNode(includeDescendants) {
    const clonedElement = new SvgElementFixture(
      this.documentObject,
      this.localName,
      this.namespaceURI,
    );
    clonedElement.attributes = new Map(this.attributes);
    clonedElement.textContent = this.textContent;
    clonedElement.style = {
      cssText: this.style.cssText,
      properties: { ...this.style.properties },
      setProperty(propertyName, propertyValue) {
        this.properties[propertyName] = propertyValue;
      },
    };
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
      if (eventName === "end") {
        alphaValue = 0;
      }
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

function createRendererSimulationFixture() {
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
  const rendererSimulationFixture = createRendererSimulationFixture();
  // The adapter owns the renderer implementation; the test supplies a
  // deterministic stand-in rather than a live D3 graph.
  function createFilterModuleFixture(initialEnabled = false) {
    let enabledState = initialEnabled;
    let colorMode = "same";
    return {
      enabled(nextEnabledState) {
        if (nextEnabledState === undefined) {
          return enabledState;
        }
        enabledState = nextEnabledState;
        return undefined;
      },
      colorModeType(value) {
        if (value !== undefined) {
          colorMode = value;
        }
        return colorMode;
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
          if (nextEnabledState === undefined) {
            return this.enabledStates.at(-1) ?? false;
          }
          this.enabledStates.push(nextEnabledState);
          return undefined;
        },
        minDegree(value) {
          if (value === undefined) {
            return this.minDegreeValues.at(-1) ?? 0;
          }
          this.minDegreeValues.push(value);
          return undefined;
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
      colorExternalsModule: () =>
        renderedGraphInternalsFixture.modeModules.colorExternals,
      compactNotationModule: () =>
        renderedGraphInternalsFixture.modeModules.compactNotation,
      nodeScalingModule: () =>
        renderedGraphInternalsFixture.modeModules.nodeScaling,
      pickAndPinModule: () =>
        renderedGraphInternalsFixture.modeModules.pickAndPin,
      classDistance: () =>
        renderedGraphInternalsFixture.forceDistances.classDistancePx,
      datatypeDistance: () =>
        renderedGraphInternalsFixture.forceDistances.datatypeDistancePx,
      dynamicLabelWidth(nextDynamicLabelWidth) {
        if (!arguments.length) {
          return renderedGraphInternalsFixture.isDynamicLabelWidth;
        }
        renderedGraphInternalsFixture.isDynamicLabelWidth =
          nextDynamicLabelWidth;
        renderedGraphInternalsFixture.dynamicLabelWidths.push(
          nextDynamicLabelWidth,
        );
        return undefined;
      },
      maxLabelWidth(nextMaxLabelWidthPx) {
        if (nextMaxLabelWidthPx === undefined) {
          return renderedGraphInternalsFixture.maxLabelWidths.at(-1) ?? 120;
        }
        renderedGraphInternalsFixture.maxLabelWidths.push(nextMaxLabelWidthPx);
      },
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
    load(loadGeneration) {
      renderedGraphInternalsFixture.callOrder.push("load");
      renderedGraphInternalsFixture.loadCallCount += 1;
      const simulation = rendererSimulationFixture.forceSimulation();
      const model = renderedGraphInternalsFixture.suppliedVowlModels.at(-1);
      simulation.nodes([
        ...(model.class ?? []).map(({ id }, index) => ({
          stableLayoutElementKey: `node:${id}`,
          x: 30 + index * 7,
          y: 41 - index * 5,
        })),
        ...(model.property ?? []).map(({ id }, index) => ({
          stableLayoutElementKey: `label:${id}`,
          x: 44 + index * 6,
          y: 29,
        })),
      ]);
      const publish = () =>
        renderedGraphInternalsFixture.installedEventPort.publishGraphLayoutState(
          loadGeneration,
          renderedGraphInternalsFixture.readLayoutState(),
        );
      simulation.on("end", publish).on("tick", publish);
      renderedGraphInternalsFixture.isPaused = false;
    },
    paused(isPaused) {
      renderedGraphInternalsFixture.pauseStates.push(isPaused);
      renderedGraphInternalsFixture.isPaused = isPaused;
      const simulation = rendererSimulationFixture.createdSimulations.at(-1);
      if (isPaused) {
        simulation.stop();
      } else {
        simulation.alpha(1).restart();
      }
    },
    readLayoutState() {
      const simulation = rendererSimulationFixture.createdSimulations.at(-1);
      return {
        forceAlpha: simulation.alpha(),
        hasEnded: simulation.alpha() === 0,
        isPaused: renderedGraphInternalsFixture.isPaused,
        widthPx: 800,
        heightPx: 600,
        observedAtMs: 123,
        layoutElementPositions: simulation.nodes().map((node) => ({ ...node })),
      };
    },
    readVisibleElementIds() {
      const model = renderedGraphInternalsFixture.suppliedVowlModels.at(-1);
      return {
        nodeIds: (model.class ?? []).map(({ id }) => id),
        propertyIds: (model.property ?? []).map(({ id }) => id),
      };
    },
    isReadyForPaint: () => true,
    clearRenderedGraph() {
      graphContainerElement.replaceChildren();
    },
    dispose() {},
    retireRenderGeneration() {
      rendererSimulationFixture.createdSimulations
        .at(-1)
        ?.on("tick", null)
        .on("end", null)
        .stop();
    },
    setRenderedGraphEventPort(nextPort) {
      renderedGraphInternalsFixture.installedEventPort = nextPort;
    },
    installedEventPort: undefined,
    appliedLanguages: [],
    updateCallCount: 0,
    relocationRequests: 0,
    language(nextLanguage) {
      if (nextLanguage === undefined) {
        return (
          renderedGraphInternalsFixture.appliedLanguages.at(-1) ?? "default"
        );
      }
      renderedGraphInternalsFixture.appliedLanguages.push(nextLanguage);
      return undefined;
    },
    update() {
      renderedGraphInternalsFixture.updateCallCount += 1;
    },
    zoomAndCenterGraph() {
      renderedGraphInternalsFixture.relocationRequests += 1;
    },
    requestedZoomScales: [],
    setSliderZoom(zoomScale) {
      renderedGraphInternalsFixture.requestedZoomScales.push(zoomScale);
    },
    modeModules: {
      colorExternals: createFilterModuleFixture(true),
      compactNotation: createFilterModuleFixture(),
      nodeScaling: createFilterModuleFixture(true),
      pickAndPin: createFilterModuleFixture(),
    },
    isDynamicLabelWidth: true,
    dynamicLabelWidths: [],
    maxLabelWidths: [],
    modeExecutions: [],
    labelWidthAnimations: 0,
    lazyRefreshes: 0,
    executeColorExternalsModule() {
      renderedGraphInternalsFixture.modeExecutions.push("colorExternals");
    },
    executeCompactNotationModule() {
      renderedGraphInternalsFixture.modeExecutions.push("compactNotation");
    },
    executeNodeScalingModule() {
      renderedGraphInternalsFixture.modeExecutions.push("nodeScaling");
    },
    animateDynamicLabelWidth() {
      renderedGraphInternalsFixture.labelWidthAnimations += 1;
    },
    lazyRefresh() {
      renderedGraphInternalsFixture.lazyRefreshes += 1;
    },
    requestedForceLayoutDistances: [],
    forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
    setForceLayoutDistances(requestedDistances) {
      Object.assign(
        renderedGraphInternalsFixture.forceDistances,
        requestedDistances,
      );
      renderedGraphInternalsFixture.requestedForceLayoutDistances.push(
        requestedDistances,
      );
    },
    continuousZoomDirections: [],
    startContinuousZoom(zoomDirection) {
      renderedGraphInternalsFixture.continuousZoomDirections.push(
        zoomDirection,
      );
      return true;
    },
    stopContinuousZoom() {
      renderedGraphInternalsFixture.continuousZoomDirections.push(0);
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
    visualizationResets: 0,
    resetVisualization() {
      renderedGraphInternalsFixture.visualizationResets += 1;
    },
  };
  const pendingPaintObservations = [];

  const { renderedGraphRuntime, renderedGraphInteractionPort } =
    createD3RenderedGraphAdapter({
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
    rendererSimulationFixture,
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
    const retiredSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations[0];

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

  test("does not complete a load while the renderer still hides its initial geometry", async () => {
    const adapterHarness = createAdapterHarness();
    let isReadyForPaint = false;
    adapterHarness.renderedGraphInternalsFixture.isReadyForPaint = () =>
      isReadyForPaint;
    const replacement = adapterHarness.renderedGraphRuntime.replaceVowlModel(
      replacementRequest(1),
      {},
    );
    let hasCompleted = false;
    void replacement.then(() => {
      hasCompleted = true;
    });
    adapterHarness.renderedGraphTestHarness.completeInitialPaint(1);
    for (let turn = 0; turn < 6; turn += 1) {
      await Promise.resolve();
    }
    expect(hasCompleted).toBe(false);
    isReadyForPaint = true;
    expect(
      adapterHarness.renderedGraphTestHarness.completeInitialPaint(1),
    ).toBe(true);
    for (let turn = 0; turn < 6; turn += 1) {
      await Promise.resolve();
    }
    expect(hasCompleted).toBe(false);
    expect(
      adapterHarness.renderedGraphTestHarness.completeInitialPaint(1),
    ).toBe(true);
    await replacement;
  });

  test("publishes no event from a retired generation's force end", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const retiredSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations[0];
    const publishedEvents = [];
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (event) => publishedEvents.push(event.kind),
    );

    await loadGeneration(adapterHarness, 2);
    retiredSimulation.emit("end");

    expect(publishedEvents).toEqual([]);
  });

  test("retires the actual renderer when its caller cancels before first paint", async () => {
    const harness = createAdapterHarness();
    const caller = new AbortController();
    const events = [];
    harness.renderedGraphRuntime.subscribeToRenderedGraphEvents((event) =>
      events.push(event),
    );
    const replacement = harness.renderedGraphRuntime.replaceVowlModel(
      replacementRequest(1),
      { signal: caller.signal },
    );
    const simulation =
      harness.rendererSimulationFixture.createdSimulations.at(-1);
    expect(simulation.isStopped).toBe(false);
    caller.abort();
    await expect(replacement).rejects.toMatchObject({ name: "AbortError" });
    expect(simulation.isStopped).toBe(true);
    expect(simulation.listenerCount()).toBe(0);
    harness.renderedGraphInternalsFixture.installedEventPort.publishGraphLayoutState(
      1,
      { forceAlpha: 0.1, hasEnded: false, isPaused: false },
    );
    expect(events).toEqual([]);
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

  test("retires native drawing when model mounting throws synchronously", async () => {
    const harness = createAdapterHarness();
    const nativeLoad = harness.renderedGraphInternalsFixture.load;
    harness.renderedGraphInternalsFixture.load = (generation) => {
      nativeLoad(generation);
      throw new Error("The native renderer failed while drawing.");
    };
    await expect(
      harness.renderedGraphRuntime.replaceVowlModel(replacementRequest(1)),
    ).rejects.toThrow("The native renderer failed while drawing.");
    const simulation =
      harness.rendererSimulationFixture.createdSimulations.at(-1);
    expect(simulation.isStopped).toBe(true);
    expect(simulation.listenerCount()).toBe(0);
    expect(() =>
      harness.renderedGraphRuntime.readGraphLayoutSnapshot(),
    ).toThrow("No completed graph layout snapshot exists.");
  });

  test("resumes a layout that had not finished", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const forceSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations.at(-1);

    adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
      loadGeneration: 1,
      isPaused: true,
    });
    expect(forceSimulation.isStopped).toBe(true);

    adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
      loadGeneration: 1,
      isPaused: false,
    });

    // A reader who pauses mid-layout and resumes expects it to carry on.
    expect(forceSimulation.isStopped).toBe(false);
  });

  test("reheats a finished layout when the reader resumes it", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const forceSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations.at(-1);
    // The layout reaches its own end, as it does once a graph settles.
    forceSimulation.emit("end");

    adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
      loadGeneration: 1,
      isPaused: true,
    });
    const resumeResult =
      adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
        loadGeneration: 1,
        isPaused: false,
      });

    // Resume means the same action after natural settlement as during motion.
    // Export avoids asking for resume when the layout had already ended.
    expect(forceSimulation.isStopped).toBe(false);
    expect(resumeResult.layoutStatus).toBe("relaxing");
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot(),
    ).toMatchObject({
      isPaused: false,
      hasEnded: false,
      forceAlpha: 1,
    });
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

  test("observes the drawing's positions, energy and measured viewport", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    adapterHarness.renderedGraphInternalsFixture.readLayoutState = () => ({
      forceAlpha: 0.27,
      hasEnded: false,
      isPaused: false,
      widthPx: 1234,
      heightPx: 567,
      observedAtMs: 321,
      layoutElementPositions: [
        { stableLayoutElementKey: "node:Person", x: 37, y: -81 },
        { stableLayoutElementKey: "label:knows", x: 101, y: 42 },
      ],
    });
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot(),
    ).toEqual({
      loadGeneration: 1,
      forceAlpha: 0.27,
      hasEnded: false,
      isPaused: false,
      widthPx: 1234,
      heightPx: 567,
      observedAtMs: 321,
      layoutElementPositions: [
        { stableLayoutElementKey: "node:Person", x: 37, y: -81 },
        { stableLayoutElementKey: "label:knows", x: 101, y: 42 },
      ],
    });
  });

  test("pans without reheating the force and waits for its visible result", async () => {
    const harness = createAdapterHarness();
    await loadGeneration(harness, 1);
    const translations = [];
    harness.renderedGraphInternalsFixture.panViewport = (translation) =>
      translations.push({ ...translation });
    const before = harness.renderedGraphRuntime.readGraphLayoutSnapshot();
    let completed = false;
    const view = harness.renderedGraphRuntime
      .applyVisualizationView({
        loadGeneration: 1,
        translation: { xPx: -180.5, yPx: 72 },
      })
      .then((value) => {
        completed = true;
        return value;
      });
    const outcome = view.catch((error) => error);
    harness.renderedGraphTestHarness.completeVisualizationViewApplication(1);
    for (let turn = 0; turn < 8; turn++) {
      await Promise.resolve();
    }
    expect(translations).toEqual([{ xPx: -180.5, yPx: 72 }]);
    expect(completed).toBe(false);
    expect(
      harness.renderedGraphTestHarness.completeVisualizationViewApplication(1),
    ).toBe(true);
    const result = await outcome;
    expect(result.appliedVisualizationView).not.toHaveProperty("translation");
    expect(harness.renderedGraphRuntime.readGraphLayoutSnapshot()).toEqual(
      before,
    );
  });

  test("counts the current rendered projection rather than every model record", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    adapterHarness.renderedGraphInternalsFixture.readVisibleElementIds =
      () => ({
        nodeIds: ["Person"],
        propertyIds: [],
      });
    expect(
      adapterHarness.renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
    ).toMatchObject({
      visibleGraphCounts: { visibleNodeCount: 1, visiblePropertyCount: 0 },
      visibleElementReferences: [
        { kind: "class", iri: "https://example.test/Person" },
      ],
      visibleRelationshipReferences: [],
    });
  });

  test("reports label width only after the native animation and paint finish", async () => {
    const harness = createAdapterHarness();
    await loadGeneration(harness, 1);
    let finishAnimation;
    harness.renderedGraphInternalsFixture.animateDynamicLabelWidth = () =>
      new Promise((resolve) => {
        finishAnimation = resolve;
      });
    let completed = false;
    const operation = Promise.resolve(
      harness.renderedGraphRuntime.setVisualizationModes({
        maxLabelWidthPx: 20,
      }),
    ).then((result) => {
      completed = true;
      return result;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    finishAnimation(true);
    for (let turn = 0; turn < 6; turn++) {
      await Promise.resolve();
    }
    expect(completed).toBe(false);
    expect(
      harness.renderedGraphTestHarness.completeVisualizationViewApplication(1),
    ).toBe(true);
    expect(await operation).toMatchObject({ modes: { maxLabelWidthPx: 20 } });
  });

  test("applies each requested display mode and refreshes once", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;

    const modeApplication =
      adapterHarness.renderedGraphRuntime.setVisualizationModes({
        colorExternals: true,
        nodeScaling: true,
        maxLabelWidthPx: 180,
      });

    expect(internals.modeExecutions).toEqual(["colorExternals", "nodeScaling"]);
    expect(internals.modeModules.colorExternals.enabled()).toBe(true);
    expect(internals.modeModules.nodeScaling.enabled()).toBe(true);
    expect(internals.maxLabelWidths).toEqual([180]);
    expect(internals.labelWidthAnimations).toBe(1);
    expect(internals.lazyRefreshes).toBe(1);
    await Promise.resolve();
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await modeApplication;
  });

  test("publishes actual display choices after caller cancellation finishes native geometry", async () => {
    const harness = createAdapterHarness();
    await loadGeneration(harness, 1);
    const events = [];
    harness.renderedGraphRuntime.subscribeToRenderedGraphEvents((event) =>
      events.push(event),
    );
    harness.renderedGraphInternalsFixture.animateDynamicLabelWidth = ({
      signal,
    }) =>
      new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve(false), { once: true }),
      );
    const caller = new AbortController();
    const action = harness.renderedGraphRuntime.setVisualizationModes(
      { maxLabelWidthPx: 20 },
      { signal: caller.signal },
    );
    caller.abort(new DOMException("Cancelled", "AbortError"));
    await expect(action).rejects.toMatchObject({ name: "AbortError" });
    expect(events).toContainEqual(
      expect.objectContaining({
        kind: "visualization-view-changed",
        loadGeneration: 1,
        payload: expect.objectContaining({
          appliedVisualizationView: expect.objectContaining({
            modes: expect.objectContaining({ maxLabelWidthPx: 20 }),
          }),
        }),
      }),
    );
  });

  test.each([
    ["zoomAndCenterGraph", { viewport: "zoom-and-center" }],
    ["locateSearchResult", { viewport: "focus-next" }],
    ["setSliderZoom", { zoomScale: 2 }],
  ])(
    "waits for %s to finish before reporting the view applied",
    async (method, request) => {
      const adapterHarness = createAdapterHarness();
      await loadGeneration(adapterHarness, 1);
      let finishTransition;
      adapterHarness.renderedGraphInternalsFixture[method] = () =>
        new Promise((resolve) => {
          finishTransition = resolve;
        });
      const application =
        adapterHarness.renderedGraphRuntime.applyVisualizationView({
          loadGeneration: 1,
          ...request,
        });
      let hasCompleted = false;
      void application.then(() => {
        hasCompleted = true;
      });
      adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
        1,
      );
      for (let turn = 0; turn < 6; turn += 1) {
        await Promise.resolve();
      }
      expect(typeof finishTransition).toBe("function");
      expect(hasCompleted).toBe(false);
      finishTransition(true);
      await application;
    },
  );

  test.each(["caller", "replacement", "newer-view", "disposal"])(
    "cancels a viewport transition on %s retirement",
    async (retirement) => {
      const harness = createAdapterHarness();
      await loadGeneration(harness, 1);
      const caller = new AbortController();
      let transitionSignal;
      harness.renderedGraphInternalsFixture.zoomAndCenterGraph = (
        _dynamic,
        options,
      ) => {
        transitionSignal = options?.signal;
        return new Promise((resolve) => {
          transitionSignal?.addEventListener("abort", () => resolve(false), {
            once: true,
          });
        });
      };
      const application = harness.renderedGraphRuntime.applyVisualizationView(
        { loadGeneration: 1, viewport: "zoom-and-center" },
        { signal: caller.signal },
      );
      const outcome = application.then(
        () => "completed",
        (error) => error.name,
      );
      harness.renderedGraphTestHarness.completeVisualizationViewApplication(1);
      for (let turn = 0; turn < 6; turn += 1) {
        await Promise.resolve();
      }
      expect(transitionSignal).toBeInstanceOf(AbortSignal);
      if (retirement === "caller") {
        caller.abort();
      }
      if (retirement === "replacement") {
        await loadGeneration(harness, 2);
      }
      if (retirement === "disposal") {
        harness.renderedGraphRuntime.dispose();
      }
      if (retirement === "newer-view") {
        const nextView = harness.renderedGraphRuntime.applyVisualizationView({
          loadGeneration: 1,
          focus: [],
        });
        harness.renderedGraphTestHarness.completeVisualizationViewApplication(
          1,
        );
        await nextView;
      }
      expect(transitionSignal.aborted).toBe(true);
      expect(await outcome).toBe("AbortError");
    },
  );

  test("reports the renderer's retained view choices after a replacement", async () => {
    const harness = createAdapterHarness();
    await loadGeneration(harness, 1);
    harness.renderedGraphInternalsFixture.filterModules.datatypes.enabled(true);
    harness.renderedGraphInternalsFixture.filterModules.minDegree.enabled(true);
    harness.renderedGraphInternalsFixture.filterModules.minDegree.minDegree(3);
    harness.renderedGraphInternalsFixture.language("en");
    await loadGeneration(harness, 2);
    const application = harness.renderedGraphRuntime.applyVisualizationView({
      loadGeneration: 2,
    });
    harness.renderedGraphTestHarness.completeVisualizationViewApplication(2);
    const { appliedVisualizationView } = await application;
    expect(appliedVisualizationView.language).toBe("en");
    expect(appliedVisualizationView.filters.datatypes).toBe("hide");
    expect(appliedVisualizationView.filters.minDegree).toBe(3);
  });

  test("animates labels back when dynamic label width is switched off", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;

    // Labels already clamped to a maximum have to be animated back to their
    // full width, so switching the mode off animates just as switching it on
    // does. Skipping it would leave them clamped until something else redrew.
    const modeApplication =
      adapterHarness.renderedGraphRuntime.setVisualizationModes({
        dynamicLabelWidth: false,
      });

    expect(internals.labelWidthAnimations).toBe(1);
    await Promise.resolve();
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await modeApplication;
  });

  test("leaves labels alone when a width changes while the mode is off", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const internals = adapterHarness.renderedGraphInternalsFixture;
    const modeApplication =
      adapterHarness.renderedGraphRuntime.setVisualizationModes({
        dynamicLabelWidth: false,
      });
    await Promise.resolve();
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await modeApplication;
    internals.labelWidthAnimations = 0;

    // A width that no label is sizing itself to is not visible, so there is
    // nothing to animate into place.
    const widthApplication =
      adapterHarness.renderedGraphRuntime.setVisualizationModes({
        maxLabelWidthPx: 200,
      });

    expect(internals.maxLabelWidths).toEqual([200]);
    expect(internals.labelWidthAnimations).toBe(0);
    await Promise.resolve();
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await widthApplication;
  });

  test("holds the layout still when a view asks it to pause", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const forceSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations.at(-1);

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        layout: "pause",
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    // An agent asking to pause reaches the simulation the same way the
    // reader's own control does, so a held graph is held whoever asked.
    expect(forceSimulation.isStopped).toBe(true);
    expect(adapterHarness.renderedGraphInternalsFixture.pauseStates).toContain(
      true,
    );
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot().isPaused,
    ).toBe(true);
  });

  test("sets the layout running again when a view asks it to resume", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const forceSimulation =
      adapterHarness.rendererSimulationFixture.createdSimulations.at(-1);
    adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
      loadGeneration: 1,
      isPaused: true,
    });

    const viewApplication =
      adapterHarness.renderedGraphRuntime.applyVisualizationView({
        loadGeneration: 1,
        layout: "resume",
      });
    adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
      1,
    );
    await viewApplication;

    expect(forceSimulation.isStopped).toBe(false);
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot().isPaused,
    ).toBe(false);
  });

  test("exports a styled clone framed on what the reader is looking at", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);
    const liveSvgRoot =
      adapterHarness.graphContainerElement.querySelector("svg");
    liveSvgRoot.setAttribute("width", "1600");
    liveSvgRoot.setAttribute("height", "845");

    const renderedSvgSnapshot =
      adapterHarness.renderedGraphRuntime.createRenderedSvgSnapshot({
        loadGeneration: 1,
      });

    // A bare clone of the live SVG carries no appearance, because the
    // visualization is styled by a stylesheet. The export resolves those
    // styles and frames the clone on the viewport the reader is looking at.
    expect(renderedSvgSnapshot.detachedSvgRoot.getAttribute("viewBox")).toBe(
      "0 0 1600 845",
    );
    expect(renderedSvgSnapshot.detachedSvgRoot.getAttribute("width")).toBe(
      "1600",
    );
    expect(renderedSvgSnapshot.widthPx).toBe(1600);
    expect(renderedSvgSnapshot.heightPx).toBe(845);
    // The live SVG is never touched.
    expect(liveSvgRoot.getAttribute("viewBox")).toBeNull();
  });

  test("asks the renderer to return the visualization to its defaults", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    adapterHarness.renderedGraphRuntime.resetVisualization();

    // A reader asking for a reset states an intent. Which settings go back to
    // which values, and the restyle that follows, are the renderer's business,
    // so the adapter carries the intent across and decides nothing.
    expect(
      adapterHarness.renderedGraphInternalsFixture.visualizationResets,
    ).toBe(1);
  });

  test("hands requested force distances to the renderer in pixels", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    adapterHarness.renderedGraphRuntime.setForceLayoutDistances({
      classDistancePx: 240,
    });

    expect(
      adapterHarness.renderedGraphInternalsFixture
        .requestedForceLayoutDistances,
    ).toEqual([{ classDistancePx: 240 }]);
  });

  test("hands a held zoom gesture to the renderer as start and stop", async () => {
    const adapterHarness = createAdapterHarness();
    await loadGeneration(adapterHarness, 1);

    adapterHarness.renderedGraphRuntime.setContinuousZoom({
      zoomDirection: "out",
    });
    adapterHarness.renderedGraphRuntime.setContinuousZoom({
      zoomDirection: "none",
    });

    expect(
      adapterHarness.renderedGraphInternalsFixture.continuousZoomDirections,
    ).toEqual([-1, 0]);
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
        viewport: "zoom-and-center",
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
