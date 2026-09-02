import { createRenderedGraphConfiguration } from "./renderedGraphConfiguration.js";
import {
  createGraphLayoutPauseRequest,
  createGraphLayoutPauseResult,
  createGraphLayoutSnapshot,
  createOntologyInspectionSnapshot,
  createRenderedGraphEvent,
  createRenderedSvgSnapshot,
  createRenderedSvgSnapshotRequest,
  createVisibleRenderedGraphSnapshot,
  createVisualizationViewApplicationRequest,
  createVisualizationViewApplicationResult,
  createVowlModelReplacementRequest,
  createVowlModelReplacementResult,
} from "../../../app/js/controller/renderedGraphRuntimeContracts.js";

const INTERACTION_ONLY_ELEMENT_CLASS = "vowl-interaction-only";

const D3_RENDERED_GRAPH_ADAPTER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "renderedGraphInternals",
  "graphContainerElement",
  "observeNextPaint",
  "renderedGraphConfiguration",
]);

const DEFAULT_APPLIED_VISUALIZATION_VIEW = Object.freeze({
  filters: Object.freeze({
    datatypes: "show",
    disjointness: "show",
    minDegree: 0,
    objectProperties: "show",
    setOperators: "show",
    subclasses: "show",
  }),
  focus: Object.freeze([]),
  language: "default",
  layout: "preserve",
  viewport: "preserve",
});

function assertPlainRecord(candidate, description) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactDependencyFieldNames(dependencies) {
  assertPlainRecord(dependencies, "D3 rendered graph adapter dependencies");
  // The renderer resolves its own D3 value so no application module names it.
  const actualFieldNames = Object.keys(dependencies)
    .filter((fieldName) => fieldName !== "d3")
    .sort();
  const expectedFieldNames = [
    ...D3_RENDERED_GRAPH_ADAPTER_DEPENDENCY_FIELD_NAMES,
  ].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "D3 rendered graph adapter dependencies have an invalid dependency field set.",
    );
  }
}

function createAbortError(message) {
  return new DOMException(message, "AbortError");
}

function vowlBaseRecords(vowlModelCollection) {
  return Array.isArray(vowlModelCollection) ? vowlModelCollection : [];
}

function ontologyElementReferenceForVowlRecord(
  vowlRecord,
  kind,
  loadGeneration,
) {
  if (typeof vowlRecord.iri === "string" && vowlRecord.iri.length > 0) {
    return { kind, iri: vowlRecord.iri };
  }
  return {
    kind,
    loadGeneration,
    localId: String(vowlRecord.id ?? "anonymous"),
  };
}

function localizedTextRecords(vowlLabelValue) {
  // VOWL writes a label either as a language-keyed object or, for elements
  // with no language information, as a bare string.
  if (typeof vowlLabelValue === "string") {
    return vowlLabelValue.length > 0
      ? [{ languageTag: null, text: vowlLabelValue }]
      : [];
  }
  if (vowlLabelValue === null || typeof vowlLabelValue !== "object") {
    return [];
  }
  return Object.entries(vowlLabelValue)
    .filter(([, text]) => typeof text === "string" && text.length > 0)
    .map(([languageTag, text]) => ({
      languageTag: languageTag === "undefined" ? null : languageTag,
      text,
    }));
}

// VOWL JSON splits every element in two: a bare entry in `class`, `property`
// or `datatype` carrying the id and type, and an entry in the matching
// `*Attribute` collection carrying the IRI, labels and comments. An inspection
// record needs both, so they are merged by id before projection.
function mergeVowlAttributes(baseCollection, attributeCollection) {
  const attributesById = new Map(
    vowlBaseRecords(attributeCollection).map((attributeRecord) => [
      String(attributeRecord.id),
      attributeRecord,
    ]),
  );
  return vowlBaseRecords(baseCollection).map((baseRecord) => ({
    ...baseRecord,
    ...(attributesById.get(String(baseRecord.id)) ?? {}),
  }));
}

function projectOntologyInspectionSnapshot(vowlModel, loadGeneration) {
  const mergedClasses = mergeVowlAttributes(
    vowlModel.class,
    vowlModel.classAttribute,
  );
  const mergedProperties = mergeVowlAttributes(
    vowlModel.property,
    vowlModel.propertyAttribute,
  );
  const mergedDatatypes = mergeVowlAttributes(
    vowlModel.datatype,
    vowlModel.datatypeAttribute,
  );
  const classRecords = mergedClasses.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "class",
      loadGeneration,
    ),
    labelRecords: localizedTextRecords(vowlRecord.label),
    commentRecords: localizedTextRecords(vowlRecord.comment),
    superclassReferences: [],
    equivalentClassReferences: [],
    disjointClassReferences: [],
  }));
  const propertyRecords = mergedProperties.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "property",
      loadGeneration,
    ),
    labelRecords: localizedTextRecords(vowlRecord.label),
    commentRecords: localizedTextRecords(vowlRecord.comment),
    domainReferences: [],
    rangeReferences: [],
    superpropertyReferences: [],
    inversePropertyReferences: [],
  }));
  const datatypeRecords = mergedDatatypes.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "datatype",
      loadGeneration,
    ),
    labelRecords: localizedTextRecords(vowlRecord.label),
    commentRecords: localizedTextRecords(vowlRecord.comment),
  }));

  const ontologyHeader = vowlModel.header ?? {};
  return createOntologyInspectionSnapshot({
    loadGeneration,
    ontologyHeaderRecord: {
      ontologyIri:
        typeof ontologyHeader.iri === "string" ? ontologyHeader.iri : null,
      versionInformationText:
        typeof ontologyHeader.version === "string"
          ? ontologyHeader.version
          : null,
      titleRecords: localizedTextRecords(ontologyHeader.title),
      descriptionRecords: localizedTextRecords(ontologyHeader.description),
      authorNames: Array.isArray(ontologyHeader.author)
        ? ontologyHeader.author.filter(
            (authorName) =>
              typeof authorName === "string" && authorName.length > 0,
          )
        : [],
    },
    classRecords,
    propertyRecords,
    datatypeRecords,
    individualRecords: [],
    namespaceRecords: Array.isArray(vowlModel.namespace)
      ? vowlModel.namespace
          .filter((namespaceRecord) => namespaceRecord !== null)
          .map((namespaceRecord) => ({
            prefix: String(Object.keys(namespaceRecord)[0] ?? ""),
            namespaceIri: String(Object.values(namespaceRecord)[0] ?? ""),
          }))
          .filter(({ namespaceIri }) => namespaceIri.length > 0)
      : [],
    importRecords: [],
    availableLabelLanguages: [
      ...new Set(
        [...classRecords, ...propertyRecords, ...datatypeRecords]
          .flatMap(({ labelRecords }) => labelRecords)
          .map(({ languageTag }) => languageTag)
          .filter(
            (languageTag) =>
              typeof languageTag === "string" && languageTag.length > 0,
          ),
      ),
    ],
  });
}

function projectVisibleRenderedGraphSnapshot(
  ontologyInspectionSnapshot,
  loadGeneration,
) {
  const visibleElementReferences = [
    ...ontologyInspectionSnapshot.classRecords,
    ...ontologyInspectionSnapshot.datatypeRecords,
    ...ontologyInspectionSnapshot.individualRecords,
  ].map(({ ontologyElementReference }) => ({ ...ontologyElementReference }));
  const visibleRelationshipReferences =
    ontologyInspectionSnapshot.propertyRecords.map(
      ({ ontologyElementReference }) => ({ ...ontologyElementReference }),
    );

  return createVisibleRenderedGraphSnapshot({
    loadGeneration,
    visibleElementReferences,
    visibleRelationshipReferences,
    visibleGraphCounts: {
      visibleNodeCount: visibleElementReferences.length,
      visiblePropertyCount: visibleRelationshipReferences.length,
    },
  });
}

export function createD3RenderedGraphAdapter(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const {
    d3 = globalThis.d3,
    renderedGraphInternals,
    graphContainerElement,
    observeNextPaint,
    renderedGraphConfiguration = createRenderedGraphConfiguration(),
  } = dependencies;

  if (typeof observeNextPaint !== "function") {
    throw new TypeError("observeNextPaint must be a function.");
  }
  if (typeof renderedGraphInternals?.load !== "function") {
    throw new TypeError("renderedGraphInternals.load must be a function.");
  }
  if (typeof d3?.forceSimulation !== "function") {
    throw new TypeError("d3.forceSimulation must be a function.");
  }

  let isDisposed = false;
  let activeLoadGeneration = null;
  let hasBuiltRenderedGraphRoot = false;
  let rendererElementIdsByReferenceKey = new Map();
  let activeForceSimulation = null;
  let ontologyInspectionSnapshot = null;
  let visibleRenderedGraphSnapshot = null;
  let appliedVisualizationView = DEFAULT_APPLIED_VISUALIZATION_VIEW;
  let forceAlpha = 1;
  let hasForceEnded = false;
  let isGraphLayoutPaused = false;
  let activeGenerationAbortController = null;
  const renderedGraphEventSubscribers = new Set();

  function assertNotDisposed() {
    if (isDisposed) {
      throw new Error("The D3 rendered graph runtime is disposed.");
    }
  }

  function retireActiveGeneration(retirementReason) {
    if (activeGenerationAbortController !== null) {
      activeGenerationAbortController.abort(retirementReason);
      activeGenerationAbortController = null;
    }
    if (activeForceSimulation !== null) {
      activeForceSimulation.on("tick", null);
      activeForceSimulation.on("end", null);
      activeForceSimulation.stop();
      activeForceSimulation = null;
    }
  }

  function publishRenderedGraphEvent(candidateEvent) {
    if (
      isDisposed ||
      candidateEvent === null ||
      typeof candidateEvent !== "object" ||
      candidateEvent.loadGeneration !== activeLoadGeneration
    ) {
      return false;
    }
    const renderedGraphEvent = createRenderedGraphEvent(candidateEvent);
    if (renderedGraphEvent.kind === "graph-layout-state-changed") {
      forceAlpha = renderedGraphEvent.payload.forceAlpha;
      hasForceEnded = renderedGraphEvent.payload.hasEnded;
      isGraphLayoutPaused = renderedGraphEvent.payload.isPaused;
    }
    for (const renderedGraphEventSubscriber of [
      ...renderedGraphEventSubscribers,
    ]) {
      renderedGraphEventSubscriber(renderedGraphEvent);
    }
    return true;
  }

  async function awaitObservedPaint(loadGeneration, callerSignal) {
    const generationAbortController = new AbortController();
    activeGenerationAbortController = generationAbortController;

    const abandonmentPromise = new Promise((_resolve, reject) => {
      const rejectWithGenerationRetirement = () => {
        reject(
          generationAbortController.signal.reason ??
            createAbortError("The load generation was retired."),
        );
      };
      const rejectWithCallerAbort = () => reject(callerSignal.reason);

      if (generationAbortController.signal.aborted) {
        rejectWithGenerationRetirement();
        return;
      }
      generationAbortController.signal.addEventListener(
        "abort",
        rejectWithGenerationRetirement,
        { once: true },
      );
      if (callerSignal !== undefined) {
        if (callerSignal.aborted) {
          rejectWithCallerAbort();
          return;
        }
        callerSignal.addEventListener("abort", rejectWithCallerAbort, {
          once: true,
        });
      }
    });

    try {
      await Promise.race([
        observeNextPaint(loadGeneration, {
          signal: generationAbortController.signal,
        }),
        abandonmentPromise,
      ]);
    } catch (abandonmentError) {
      generationAbortController.abort(abandonmentError);
      throw abandonmentError;
    } finally {
      if (activeGenerationAbortController === generationAbortController) {
        activeGenerationAbortController = null;
      }
    }
  }

  // Renderer warnings and progress reach the runtime as structured events.
  renderedGraphInternals.setRenderedGraphEventPort?.({
    // The renderer can report progress before any model has been placed, so a
    // generation-less report is dropped rather than published as generation 0.
    publishRenderProgress: (percentValue) => {
      if (activeLoadGeneration === null) {
        return;
      }
      publishRenderedGraphEvent({
        kind: "render-progress-changed",
        loadGeneration: activeLoadGeneration,
        payload: {
          completedRenderedElementCount: Math.max(
            0,
            Math.min(100, Math.trunc(percentValue)),
          ),
          totalRenderedElementCount: 100,
        },
      });
    },
    publishRenderWarning: (warningCode, message) => {
      if (activeLoadGeneration === null) {
        return;
      }
      publishRenderedGraphEvent({
        kind: "render-warning-raised",
        loadGeneration: activeLoadGeneration,
        payload: { warningCode, message },
      });
    },
  });

  function startForceSimulation(loadGeneration, layoutElementKeys) {
    // A layout element is a drawn node, and several drawn nodes legitimately
    // share one ontology IRI (owl:Thing appears once per usage), so the key
    // comes from the model's own element id rather than the IRI.
    const simulationNodes = layoutElementKeys.map(
      (layoutElementKey, recordIndex) => ({
        stableLayoutElementKey: layoutElementKey,
        x: recordIndex * renderedGraphConfiguration.classDistance,
        y: recordIndex * renderedGraphConfiguration.classDistance,
      }),
    );
    const forceSimulation = d3.forceSimulation();
    forceSimulation.nodes(simulationNodes);
    forceSimulation.on("tick", () => {
      if (loadGeneration !== activeLoadGeneration || isDisposed) {
        return;
      }
      forceAlpha = forceSimulation.alpha();
    });
    forceSimulation.on("end", () => {
      if (loadGeneration !== activeLoadGeneration || isDisposed) {
        return;
      }
      hasForceEnded = true;
      publishRenderedGraphEvent({
        kind: "graph-layout-state-changed",
        loadGeneration,
        payload: { forceAlpha: 0, hasEnded: true, isPaused: false },
      });
    });
    activeForceSimulation = forceSimulation;
  }

  function referenceKey(ontologyElementReference) {
    return typeof ontologyElementReference.iri === "string"
      ? `iri:${ontologyElementReference.iri}`
      : `localId:${ontologyElementReference.localId}`;
  }

  function indexRendererElementIds(vowlModel, loadGeneration) {
    const elementIdsByKey = new Map();
    const indexCollection = (baseCollection, attributeCollection, kind) => {
      for (const mergedRecord of mergeVowlAttributes(
        baseCollection,
        attributeCollection,
      )) {
        const key = referenceKey(
          ontologyElementReferenceForVowlRecord(
            mergedRecord,
            kind,
            loadGeneration,
          ),
        );
        const elementIds = elementIdsByKey.get(key) ?? [];
        elementIds.push(String(mergedRecord.id));
        elementIdsByKey.set(key, elementIds);
      }
    };
    indexCollection(vowlModel.class, vowlModel.classAttribute, "class");
    indexCollection(
      vowlModel.property,
      vowlModel.propertyAttribute,
      "property",
    );
    indexCollection(
      vowlModel.datatype,
      vowlModel.datatypeAttribute,
      "datatype",
    );
    return elementIdsByKey;
  }

  // Each visibility filter the view can address, paired with the renderer
  // module that enforces it.
  const VISIBILITY_FILTER_MODULE_READERS = Object.freeze({
    datatypes: (settings) => settings.datatypeFilter(),
    disjointness: (settings) => settings.disjointPropertyFilter(),
    objectProperties: (settings) => settings.objectPropertyFilter(),
    setOperators: (settings) => settings.setOperatorFilter(),
    subclasses: (settings) => settings.subclassFilter(),
  });

  // One normalized batch: every field the view changed is written to the
  // renderer before a single recomputation runs.
  function applyViewToRenderer(requestedView) {
    const renderedGraphSettings = renderedGraphInternals.options();
    let requiresRecomputation = false;

    for (const [filterName, readFilterModule] of Object.entries(
      VISIBILITY_FILTER_MODULE_READERS,
    )) {
      const requestedVisibility = requestedView.filters?.[filterName];
      if (requestedVisibility === undefined) {
        continue;
      }
      readFilterModule(renderedGraphSettings)?.enabled(
        requestedVisibility === "hide",
      );
      requiresRecomputation = true;
    }

    const requestedMinimumDegree = requestedView.filters?.minDegree;
    if (requestedMinimumDegree !== undefined) {
      const nodeDegreeFilter = renderedGraphSettings.nodeDegreeFilter();
      // A degree of zero is "no degree filtering", not "filter at zero".
      nodeDegreeFilter.enabled(requestedMinimumDegree > 0);
      nodeDegreeFilter.minDegree(requestedMinimumDegree);
      requiresRecomputation = true;
    }

    if (requestedView.language !== undefined) {
      renderedGraphInternals.language(requestedView.language);
      requiresRecomputation = true;
    }

    if (requestedView.focus !== undefined) {
      renderedGraphSettings.focuserModule()?.handle(null, undefined, true);
      requiresRecomputation = true;
    }
    if (requiresRecomputation) {
      renderedGraphInternals.update();
    }
    if (requestedView.layout === "relax") {
      renderedGraphInternals.restartForceLayout();
      forceAlpha = 1;
      hasForceEnded = false;
      activeForceSimulation?.alpha(1).restart();
    }

    // The caller reports which elements were selected; the runtime decides
    // that focusing means highlighting them and moving the viewport there.
    if (requestedView.focus !== undefined && requestedView.focus.length > 0) {
      const focusedElementIds = requestedView.focus.flatMap(
        (ontologyElementReference) =>
          rendererElementIdsByReferenceKey.get(
            referenceKey(ontologyElementReference),
          ) ?? [],
      );
      if (focusedElementIds.length > 0) {
        renderedGraphInternals.highLightNodes(focusedElementIds);
        renderedGraphInternals.locateSearchResult();
      }
    }
  }

  const renderedGraphRuntime = Object.freeze({
    async replaceVowlModel(request, { signal } = {}) {
      assertNotDisposed();
      const replacementRequest = createVowlModelReplacementRequest(request);
      const { loadGeneration } = replacementRequest;
      signal?.throwIfAborted();

      retireActiveGeneration(
        createAbortError(
          "The load generation was superseded by a newer replacement.",
        ),
      );
      activeLoadGeneration = loadGeneration;
      forceAlpha = 1;
      hasForceEnded = false;
      isGraphLayoutPaused = false;
      appliedVisualizationView = DEFAULT_APPLIED_VISUALIZATION_VIEW;

      rendererElementIdsByReferenceKey = indexRendererElementIds(
        replacementRequest.vowlModel,
        loadGeneration,
      );
      ontologyInspectionSnapshot = projectOntologyInspectionSnapshot(
        replacementRequest.vowlModel,
        loadGeneration,
      );
      visibleRenderedGraphSnapshot = projectVisibleRenderedGraphSnapshot(
        ontologyInspectionSnapshot,
        loadGeneration,
      );
      // The renderer draws the graph; the adapter must not touch its container.
      startForceSimulation(
        loadGeneration,
        vowlBaseRecords(replacementRequest.vowlModel.class).map(
          (vowlRecord, recordIndex) =>
            String(vowlRecord.id ?? `anonymous-${recordIndex}`),
        ),
      );

      // The renderer parses and mutates the model as it builds the graph, so it
      // receives its own copy rather than the controller's frozen one.
      // Only the renderer's start builds its SVG root, and it skips parsing
      // while no model is present, so it runs before the model is supplied.
      if (!hasBuiltRenderedGraphRoot) {
        renderedGraphInternals.start();
        hasBuiltRenderedGraphRoot = true;
      }
      renderedGraphInternals
        .options()
        .data(structuredClone(replacementRequest.vowlModel));
      renderedGraphInternals.load();

      await awaitObservedPaint(loadGeneration, signal);
      if (isDisposed) {
        throw createAbortError("The D3 rendered graph runtime was disposed.");
      }
      if (loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The load generation was superseded before its first paint.",
        );
      }

      return createVowlModelReplacementResult({ loadGeneration });
    },

    async applyVisualizationView(request, { signal } = {}) {
      assertNotDisposed();
      const viewApplicationRequest =
        createVisualizationViewApplicationRequest(request);
      const { loadGeneration } = viewApplicationRequest;
      signal?.throwIfAborted();
      if (loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The visualization view targets a superseded load generation.",
        );
      }

      const requestedView = Object.fromEntries(
        Object.entries(viewApplicationRequest).filter(
          ([fieldName]) => fieldName !== "loadGeneration",
        ),
      );
      const nextAppliedVisualizationView = {
        ...appliedVisualizationView,
        ...requestedView,
        filters: {
          ...appliedVisualizationView.filters,
          ...requestedView.filters,
        },
      };

      applyViewToRenderer(requestedView);

      await awaitObservedPaint(loadGeneration, signal);
      if (isDisposed) {
        throw createAbortError("The D3 rendered graph runtime was disposed.");
      }
      if (loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The load generation was superseded during view application.",
        );
      }
      // Fitting the viewport needs the geometry the recomputation produced.
      if (requestedView.viewport === "fit") {
        renderedGraphInternals.forceRelocationEvent();
      }

      const viewApplicationResult = createVisualizationViewApplicationResult({
        appliedVisualizationView: nextAppliedVisualizationView,
        loadGeneration,
        visibleRenderedGraphSnapshot,
      });
      appliedVisualizationView = viewApplicationResult.appliedVisualizationView;
      visibleRenderedGraphSnapshot =
        viewApplicationResult.visibleRenderedGraphSnapshot;
      return viewApplicationResult;
    },

    readOntologyInspectionSnapshot() {
      assertNotDisposed();
      if (ontologyInspectionSnapshot === null) {
        throw new Error("No completed ontology inspection snapshot exists.");
      }
      return createOntologyInspectionSnapshot(ontologyInspectionSnapshot);
    },

    readVisibleRenderedGraphSnapshot() {
      assertNotDisposed();
      if (visibleRenderedGraphSnapshot === null) {
        throw new Error("No completed visible rendered graph snapshot exists.");
      }
      return createVisibleRenderedGraphSnapshot(visibleRenderedGraphSnapshot);
    },

    readGraphLayoutSnapshot() {
      assertNotDisposed();
      if (activeLoadGeneration === null) {
        throw new Error("No completed graph layout snapshot exists.");
      }
      return createGraphLayoutSnapshot({
        loadGeneration: activeLoadGeneration,
        observedAtMs: 0,
        forceAlpha,
        hasEnded: hasForceEnded,
        isPaused: isGraphLayoutPaused,
        widthPx: renderedGraphConfiguration.widthPx,
        heightPx: renderedGraphConfiguration.heightPx,
        layoutElementPositions: (activeForceSimulation?.nodes() ?? []).map(
          (simulationNode) => ({
            stableLayoutElementKey: simulationNode.stableLayoutElementKey,
            x: simulationNode.x,
            y: simulationNode.y,
          }),
        ),
      });
    },

    setGraphLayoutPaused(request) {
      assertNotDisposed();
      const pauseRequest = createGraphLayoutPauseRequest({
        loadGeneration: request?.loadGeneration ?? activeLoadGeneration,
        isPaused: request?.isPaused,
      });
      if (pauseRequest.loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The pause request targets a superseded load generation.",
        );
      }

      isGraphLayoutPaused = pauseRequest.isPaused;
      renderedGraphInternals.paused?.(pauseRequest.isPaused);
      if (pauseRequest.isPaused) {
        activeForceSimulation?.stop();
      } else if (!hasForceEnded) {
        activeForceSimulation?.restart();
      }

      return createGraphLayoutPauseResult({
        loadGeneration: pauseRequest.loadGeneration,
        isPaused: pauseRequest.isPaused,
        layoutStatus: pauseRequest.isPaused
          ? "paused"
          : hasForceEnded
            ? "settled"
            : "relaxing",
      });
    },

    createRenderedSvgSnapshot(request) {
      assertNotDisposed();
      const snapshotRequest = createRenderedSvgSnapshotRequest({
        loadGeneration: request?.loadGeneration ?? activeLoadGeneration,
      });
      if (snapshotRequest.loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The SVG snapshot request targets a superseded load generation.",
        );
      }

      // The renderer draws one SVG root inside its container; the export
      // serializes a detached clone of that root, never the container.
      const liveSvgRoot = graphContainerElement.querySelector("svg");
      if (liveSvgRoot === null) {
        throw createAbortError("The rendered graph has no SVG root to export.");
      }
      const detachedSvgRoot = liveSvgRoot.cloneNode(true);
      for (const interactionOnlyElement of detachedSvgRoot.querySelectorAll(
        `.${INTERACTION_ONLY_ELEMENT_CLASS}`,
      )) {
        interactionOnlyElement.parentNode?.removeChild(interactionOnlyElement);
      }

      return createRenderedSvgSnapshot({
        loadGeneration: snapshotRequest.loadGeneration,
        detachedSvgRoot,
        widthPx: renderedGraphConfiguration.widthPx,
        heightPx: renderedGraphConfiguration.heightPx,
      });
    },

    subscribeToRenderedGraphEvents(onRenderedGraphEvent) {
      assertNotDisposed();
      if (typeof onRenderedGraphEvent !== "function") {
        throw new TypeError(
          "A rendered graph event subscriber must be a function.",
        );
      }
      renderedGraphEventSubscribers.add(onRenderedGraphEvent);
      let isSubscribed = true;
      return () => {
        if (!isSubscribed) {
          return;
        }
        isSubscribed = false;
        renderedGraphEventSubscribers.delete(onRenderedGraphEvent);
      };
    },

    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      retireActiveGeneration(
        createAbortError("The D3 rendered graph runtime was disposed."),
      );
      renderedGraphEventSubscribers.clear();
      activeLoadGeneration = null;
      ontologyInspectionSnapshot = null;
      visibleRenderedGraphSnapshot = null;
    },
  });

  return Object.freeze({
    renderedGraphRuntime,
    renderedGraphInteractionPort: Object.freeze({
      publishRenderedGraphEvent,
    }),
  });
}
