import { createRenderedGraphConfiguration } from "./renderedGraphConfiguration.js";
import { createRenderedSvgExportClone } from "./renderedSvgExportClone.js";
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
  const actualFieldNames = Object.keys(dependencies).sort();
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

// An SVG length attribute may be absent or carry a unit. Only a plain finite
// number is usable as a viewport dimension; anything else falls back to the
// configured canvas.
function readSvgLengthAttribute(svgElement, attributeName) {
  const attributeValue = svgElement.getAttribute(attributeName);
  if (attributeValue === null) {
    return undefined;
  }
  const parsedLength = Number.parseFloat(attributeValue);
  return Number.isFinite(parsedLength) && parsedLength > 0
    ? parsedLength
    : undefined;
}

function createAbortError(message) {
  return new DOMException(message, "AbortError");
}

function projectVisibleRenderedGraphSnapshot(
  ontologyElementReferencesByVowlElementId,
  loadGeneration,
  { nodeIds, propertyIds },
) {
  const resolveDrawnReferences = (ids) =>
    ids.flatMap((id) => {
      const reference = ontologyElementReferencesByVowlElementId.get(
        String(id),
      );
      return reference === undefined ? [] : [{ ...reference }];
    });
  const visibleElementReferences = resolveDrawnReferences(nodeIds);
  const visibleRelationshipReferences = resolveDrawnReferences(propertyIds);

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
  let isDisposed = false;
  let activeLoadGeneration = null;
  let hasBuiltRenderedGraphRoot = false;
  let rendererElementIdsByOntologyElementReferenceKey = new Map();
  let ontologyElementReferencesByRendererElementId = new Map();
  let appliedVisualizationView = DEFAULT_APPLIED_VISUALIZATION_VIEW;
  let activeGenerationAbortController = null;
  let activeViewAbortController = null;
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
    renderedGraphInternals.retireRenderGeneration();
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
    for (const renderedGraphEventSubscriber of [
      ...renderedGraphEventSubscribers,
    ]) {
      renderedGraphEventSubscriber(renderedGraphEvent);
    }
    return true;
  }

  async function awaitObservedPaint(loadGeneration, signal) {
    signal.throwIfAborted();
    let rejectWithAbort;
    const abandonmentPromise = new Promise((_resolve, reject) => {
      rejectWithAbort = () => reject(signal.reason);
      signal.addEventListener("abort", rejectWithAbort, { once: true });
    });

    try {
      await Promise.race([
        observeNextPaint(loadGeneration, { signal }),
        abandonmentPromise,
      ]);
    } finally {
      signal.removeEventListener("abort", rejectWithAbort);
    }
    signal.throwIfAborted();
  }

  // Renderer warnings and progress reach the runtime as structured events.
  renderedGraphInternals.setRenderedGraphEventPort?.({
    publishGraphLayoutState: (
      loadGeneration,
      { forceAlpha, hasEnded, isPaused },
    ) => {
      publishRenderedGraphEvent({
        kind: "graph-layout-state-changed",
        loadGeneration,
        payload: { forceAlpha, hasEnded, isPaused },
      });
    },
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

  function readAppliedVisualizationView() {
    const settings = renderedGraphInternals.options();
    const degreeFilter = settings.nodeDegreeFilter();
    return {
      language: renderedGraphInternals.language(),
      focus: appliedVisualizationView.focus,
      filters: {
        ...Object.fromEntries(
          Object.entries(VISIBILITY_FILTER_MODULE_READERS).map(
            ([name, readModule]) => [
              name,
              readModule(settings).enabled() ? "hide" : "show",
            ],
          ),
        ),
        minDegree: degreeFilter.enabled() ? degreeFilter.minDegree() : 0,
      },
    };
  }

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
    clearRenderedGraph() {
      assertNotDisposed();
      retireActiveGeneration(
        createAbortError("The rendered graph was cleared."),
      );
      activeLoadGeneration = null;
      ontologyElementReferencesByRendererElementId.clear();
      rendererElementIdsByOntologyElementReferenceKey.clear();
      appliedVisualizationView = DEFAULT_APPLIED_VISUALIZATION_VIEW;
      renderedGraphInternals.clearRenderedGraph();
    },

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
      activeGenerationAbortController = new AbortController();
      const replacementSignal = AbortSignal.any([
        activeGenerationAbortController.signal,
        ...(signal === undefined ? [] : [signal]),
      ]);
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
      try {
        // The renderer parses and mutates the model as it builds the graph, so
        // it receives its own copy. Start builds the SVG root before receiving
        // data; a native failure in either step retires this candidate too.
        if (!hasBuiltRenderedGraphRoot) {
          renderedGraphInternals.start();
          hasBuiltRenderedGraphRoot = true;
        }
        renderedGraphInternals
          .options()
          .data(structuredClone(replacementRequest.vowlModel));
        renderedGraphInternals.load(loadGeneration);

        while (!renderedGraphInternals.isReadyForPaint()) {
          await awaitObservedPaint(loadGeneration, replacementSignal);
        }
        // The observer now waits for a paint after geometry is known ready.
        await awaitObservedPaint(loadGeneration, replacementSignal);
      } catch (error) {
        if (loadGeneration === activeLoadGeneration) {
          retireActiveGeneration(error);
          activeLoadGeneration = null;
        }
        throw error;
      }
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

      activeViewAbortController?.abort(
        createAbortError("The view request was superseded by a newer view."),
      );
      activeViewAbortController = new AbortController();
      const viewSignal = AbortSignal.any([
        activeGenerationAbortController.signal,
        activeViewAbortController.signal,
        ...(signal === undefined ? [] : [signal]),
      ]);

      const requestedView = Object.fromEntries(
        Object.entries(viewApplicationRequest).filter(
          ([fieldName]) => fieldName !== "loadGeneration",
        ),
      );
      applyVisualizationViewToRenderer(requestedView);
      appliedVisualizationView = {
        ...readAppliedVisualizationView(),
        focus: requestedView.focus ?? appliedVisualizationView.focus,
      };
      // Both input routes apply the same simulation action.
      if (requestedView.layout !== undefined) {
        renderedGraphRuntime.setGraphLayoutPaused({
          loadGeneration,
          isPaused: requestedView.layout === "pause",
        });
      }

      await awaitObservedPaint(loadGeneration, viewSignal);
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
        const completed = await renderedGraphInternals.setSliderZoom(
          requestedView.zoomScale,
          { signal: viewSignal },
        );
        viewSignal.throwIfAborted();
        if (completed === false) {
          throw createAbortError("The viewport zoom was interrupted.");
        }
      }
      // Moving the viewport needs the geometry the recomputation produced.
      if (requestedView.viewport === "zoom-and-center") {
        const completed = await renderedGraphInternals.zoomAndCenterGraph(
          false,
          { signal: viewSignal },
        );
        if (completed === false) {
          throw createAbortError("Zoom and center was interrupted.");
        }
      } else if (requestedView.viewport === "focus-next") {
        const completed = await renderedGraphInternals.locateSearchResult({
          signal: viewSignal,
        });
        if (completed === false) {
          throw createAbortError("Focus next was interrupted.");
        }
      }
      viewSignal.throwIfAborted();

      const viewApplicationResult = createVisualizationViewApplicationResult({
        appliedVisualizationView: readAppliedVisualizationView(),
        loadGeneration,
        visibleRenderedGraphSnapshot:
          renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
      });
      appliedVisualizationView = viewApplicationResult.appliedVisualizationView;
      return viewApplicationResult;
    },

    readVisibleRenderedGraphSnapshot() {
      assertNotDisposed();
      if (activeLoadGeneration === null) {
        throw new Error("No completed visible rendered graph snapshot exists.");
      }
      return projectVisibleRenderedGraphSnapshot(
        ontologyElementReferencesByRendererElementId,
        activeLoadGeneration,
        renderedGraphInternals.readVisibleElementIds(),
      );
    },

    readGraphLayoutSnapshot() {
      assertNotDisposed();
      if (activeLoadGeneration === null) {
        throw new Error("No completed graph layout snapshot exists.");
      }
      return createGraphLayoutSnapshot({
        loadGeneration: activeLoadGeneration,
        ...renderedGraphInternals.readLayoutState(),
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

      renderedGraphInternals.paused(pauseRequest.isPaused);
      const { hasEnded } = renderedGraphInternals.readLayoutState();

      return createGraphLayoutPauseResult({
        loadGeneration: pauseRequest.loadGeneration,
        isPaused: pauseRequest.isPaused,
        layoutStatus: pauseRequest.isPaused
          ? "paused"
          : hasEnded
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

    resetVisualization() {
      assertNotDisposed();
      renderedGraphInternals.resetVisualization();
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
      // An exported view is the view on screen, so the clone is framed on the
      // live viewport rather than on the configured canvas. Framing it on a
      // different canvas would clip a graph the reader can see, because the
      // drawn content is positioned for the viewport it is drawn in.
      const viewportDimensions = {
        widthPx:
          readSvgLengthAttribute(liveSvgRoot, "width") ??
          renderedGraphConfiguration.widthPx,
        heightPx:
          readSvgLengthAttribute(liveSvgRoot, "height") ??
          renderedGraphConfiguration.heightPx,
      };
      // The reader comes from the document the graph is drawn in, so the
      // export resolves the styles that document actually applies.
      const liveWindowObject = liveSvgRoot.ownerDocument?.defaultView;
      const detachedSvgRoot = createRenderedSvgExportClone(
        liveSvgRoot,
        liveWindowObject?.getComputedStyle?.bind(liveWindowObject),
        viewportDimensions,
      );

      return createRenderedSvgSnapshot({
        loadGeneration: snapshotRequest.loadGeneration,
        detachedSvgRoot,
        widthPx: viewportDimensions.widthPx,
        heightPx: viewportDimensions.heightPx,
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
      renderedGraphInternals.dispose();
      renderedGraphEventSubscribers.clear();
      activeLoadGeneration = null;
    },
  });

  return Object.freeze({
    renderedGraphRuntime,
    renderedGraphInteractionPort: Object.freeze({
      publishRenderedGraphEvent,
    }),
  });
}
