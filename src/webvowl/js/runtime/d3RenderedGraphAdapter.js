import { createRenderedGraphConfiguration } from "./renderedGraphConfiguration.js";
import {
  indexOntologyElementReferencesByVowlElementId,
  ontologyElementReferenceKey,
} from "../../../app/js/controller/vowlModelInspectionProjector.js";
import {
  createContinuousZoomRequest,
  createForceLayoutDistancesRequest,
  createVisualizationModeRequest,
  createGraphLayoutPauseRequest,
  createGraphLayoutPauseResult,
  createGraphLayoutSnapshot,
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
  zoomScale: null,
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

function projectVisibleRenderedGraphSnapshot(
  ontologyElementReferencesByVowlElementId,
  loadGeneration,
) {
  const drawnReferences = [
    ...ontologyElementReferencesByVowlElementId.values(),
  ];
  // Individuals are drawn inside the class that declares them rather than as
  // nodes of their own, so they are not part of the visible element set.
  const visibleElementReferences = drawnReferences
    .filter(({ kind }) => kind === "class" || kind === "datatype")
    .map((ontologyElementReference) => ({ ...ontologyElementReference }));
  const visibleRelationshipReferences = drawnReferences
    .filter(({ kind }) => kind === "property")
    .map((ontologyElementReference) => ({ ...ontologyElementReference }));

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

// One reference key may name several drawn elements, so focus marks every
// occurrence of the entity a caller names.
function groupRendererElementIdsByReferenceKey(
  ontologyElementReferencesByRendererElementId,
) {
  const rendererElementIdsByKey = new Map();
  for (const [
    rendererElementId,
    ontologyElementReference,
  ] of ontologyElementReferencesByRendererElementId) {
    const referenceKey = ontologyElementReferenceKey(ontologyElementReference);
    const rendererElementIds = rendererElementIdsByKey.get(referenceKey) ?? [];
    rendererElementIds.push(rendererElementId);
    rendererElementIdsByKey.set(referenceKey, rendererElementIds);
  }
  return rendererElementIdsByKey;
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
  let rendererElementIdsByOntologyElementReferenceKey = new Map();
  let ontologyElementReferencesByRendererElementId = new Map();
  let activeForceSimulation = null;
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
    publishViewportChange: (zoomScale, translationXPx, translationYPx) => {
      if (activeLoadGeneration === null) {
        return;
      }
      publishRenderedGraphEvent({
        kind: "viewport-changed",
        loadGeneration: activeLoadGeneration,
        payload: { zoomScale, translationXPx, translationYPx },
      });
    },
    publishEditorModeChange: (isEditorMode) => {
      if (activeLoadGeneration === null) {
        return;
      }
      publishRenderedGraphEvent({
        kind: "editor-mode-changed",
        loadGeneration: activeLoadGeneration,
        payload: { isEditorMode },
      });
    },
    // The renderer names drawn nodes by its own ids; the runtime reports the
    // ontology elements they stand for.
    publishRenderedElementSelection: (selectedElementIds) => {
      if (activeLoadGeneration === null) {
        return;
      }
      publishRenderedGraphEvent({
        kind: "rendered-element-selection-changed",
        loadGeneration: activeLoadGeneration,
        payload: {
          selectedOntologyElementReferences: selectedElementIds.flatMap(
            (rendererElementId) => {
              const ontologyElementReference =
                ontologyElementReferencesByRendererElementId.get(
                  String(rendererElementId),
                );
              return ontologyElementReference === undefined
                ? []
                : [ontologyElementReference];
            },
          ),
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

  // Each display mode the interface can address, paired with the renderer
  // module that draws it. Dynamic label width is absent because it is a
  // setting rather than a module.
  const VISUALIZATION_MODE_MODULE_READERS = Object.freeze({
    colorExternals: (settings) => settings.colorExternalsModule(),
    compactNotation: (settings) => settings.compactNotationModule(),
    nodeScaling: (settings) => settings.nodeScalingModule(),
    // Pinning is renderer-local behaviour, but whether it is on is a display
    // mode a reader chooses, so the choice crosses and the behaviour does not.
    pickAndPin: (settings) => settings.pickAndPinModule(),
  });

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
  function applyVisualizationViewToRenderer(requestedView) {
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

    // Focus is purely visual: it marks elements without changing which are
    // present, so it must not recompute and restart the force simulation.
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
    if (requestedView.focus !== undefined) {
      if (requestedView.focus.length === 0) {
        // Nothing is selected, so nothing should still be pulsing.
        renderedGraphInternals.resetSearchHighlight();
      } else {
        const focusedElementIds = requestedView.focus.flatMap(
          (ontologyElementReference) =>
            rendererElementIdsByOntologyElementReferenceKey.get(
              ontologyElementReferenceKey(ontologyElementReference),
            ) ?? [],
        );
        if (focusedElementIds.length > 0) {
          // Highlighting marks the elements; bringing one into view is the
          // separate focus-next directive.
          renderedGraphInternals.highLightNodes(focusedElementIds);
        }
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

      ontologyElementReferencesByRendererElementId =
        indexOntologyElementReferencesByVowlElementId(
          replacementRequest.vowlModel,
          loadGeneration,
        );
      rendererElementIdsByOntologyElementReferenceKey =
        groupRendererElementIdsByReferenceKey(
          ontologyElementReferencesByRendererElementId,
        );
      visibleRenderedGraphSnapshot = projectVisibleRenderedGraphSnapshot(
        ontologyElementReferencesByRendererElementId,
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

      applyVisualizationViewToRenderer(requestedView);

      await awaitObservedPaint(loadGeneration, signal);
      if (isDisposed) {
        throw createAbortError("The D3 rendered graph runtime was disposed.");
      }
      if (loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The load generation was superseded during view application.",
        );
      }
      // A requested magnification is applied before a directive, so a control
      // that writes both gets the directive's framing rather than the level.
      if (requestedView.zoomScale !== undefined) {
        renderedGraphInternals.setSliderZoom(requestedView.zoomScale);
      }
      // Moving the viewport needs the geometry the recomputation produced.
      if (requestedView.viewport === "fit") {
        renderedGraphInternals.forceRelocationEvent();
      } else if (requestedView.viewport === "focus-next") {
        renderedGraphInternals.locateSearchResult();
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

    setContinuousZoom(request) {
      assertNotDisposed();
      const { zoomDirection } = createContinuousZoomRequest(request);
      if (zoomDirection === "none") {
        renderedGraphInternals.stopContinuousZoom();
      } else {
        renderedGraphInternals.startContinuousZoom(
          zoomDirection === "in" ? 1 : -1,
        );
      }
      return zoomDirection;
    },

    setVisualizationMode(request) {
      assertNotDisposed();
      const requestedMode = createVisualizationModeRequest(request);
      const renderedGraphSettings = renderedGraphInternals.options();
      let hasChangedElementRendering = false;
      for (const [modeName, readModeModule] of Object.entries(
        VISUALIZATION_MODE_MODULE_READERS,
      )) {
        if (requestedMode[modeName] === undefined) {
          continue;
        }
        readModeModule(renderedGraphSettings)?.enabled(requestedMode[modeName]);
        hasChangedElementRendering = true;
      }
      if (requestedMode.colorExternalsMode !== undefined) {
        renderedGraphSettings
          .colorExternalsModule()
          ?.colorModeType(requestedMode.colorExternalsMode);
        hasChangedElementRendering = true;
      }
      if (
        requestedMode.colorExternals !== undefined ||
        requestedMode.colorExternalsMode !== undefined
      ) {
        renderedGraphInternals.executeColorExternalsModule();
      }
      if (requestedMode.compactNotation !== undefined) {
        renderedGraphInternals.executeCompactNotationModule();
      }
      if (requestedMode.nodeScaling !== undefined) {
        renderedGraphInternals.executeNodeScalingModule();
      }
      // Label width is a drawing setting rather than a filter module, so it is
      // applied directly and animated into place.
      let hasChangedDynamicLabelWidthMode = false;
      let hasChangedMaxLabelWidth = false;
      if (requestedMode.dynamicLabelWidth !== undefined) {
        renderedGraphSettings.dynamicLabelWidth(
          requestedMode.dynamicLabelWidth,
        );
        hasChangedDynamicLabelWidthMode = true;
      }
      if (requestedMode.maxLabelWidthPx !== undefined) {
        renderedGraphSettings.maxLabelWidth(requestedMode.maxLabelWidthPx);
        hasChangedMaxLabelWidth = true;
      }
      // Switching the mode animates either way, because labels are clamped to
      // the width or released back to their own. A width on its own is only
      // visible while labels are sizing themselves to it.
      if (
        hasChangedDynamicLabelWidthMode ||
        (hasChangedMaxLabelWidth && renderedGraphSettings.dynamicLabelWidth())
      ) {
        renderedGraphInternals.animateDynamicLabelWidth();
      }
      if (hasChangedElementRendering) {
        renderedGraphInternals.lazyRefresh();
      }
      return requestedMode;
    },

    setForceLayoutDistances(request) {
      assertNotDisposed();
      const requestedDistances = createForceLayoutDistancesRequest(request);
      renderedGraphInternals.setForceLayoutDistances(requestedDistances);
      return requestedDistances;
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
