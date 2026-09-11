import { createRenderedGraphConfiguration } from "./renderedGraphConfiguration.js";
import { createRenderedGraphInternals } from "./renderedGraphInternals.js";
import {
  createOntologyEditorOptionsRequest,
  createVisualizationViewportSize,
} from "../../../app/js/controller/rendererInteractionContracts.js";
import { createRenderedSvgExportClone } from "./renderedSvgExportClone.js";
import { captureRenderedDrawing } from "./captureRenderedDrawing.js";
import { serializeOntologyAsTurtle } from "./ontologyTurtleSerializer.js";
import { createRenderedDrawingSnapshot } from "../../../app/js/controller/renderedDrawingSnapshot.js";
import {
  indexOntologyElementReferencesByVowlElementId,
  ontologyElementReferenceKey,
} from "../../../app/js/controller/vowlModelInspectionProjector.js";
import {
  createContinuousZoomRequest,
  createAppliedVisualizationView,
  DEFAULT_VISUALIZATION_MODES,
  DEFAULT_VISUALIZATION_FILTERS,
  DEFAULT_FORCE_LAYOUT_DISTANCES,
  createForceLayoutDistancesRequest,
  createVisualizationModesRequest,
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
  createVowlModelRevisionRequest,
  createVowlModelReplacementResult,
} from "../../../app/js/controller/renderedGraphRuntimeContracts.js";

import {
  createRenderedArrangement,
  createRenderedOccurrenceSelectionRequest,
  resolveRenderedArrangementChanges,
} from "../../../app/js/controller/renderedArrangementContracts.js";

const D3_RENDERED_GRAPH_ADAPTER_DEPENDENCY_FIELD_NAMES = Object.freeze([
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
  modes: DEFAULT_VISUALIZATION_MODES,
  forceDistances: DEFAULT_FORCE_LAYOUT_DISTANCES,
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
    ...(Object.hasOwn(dependencies, "createRenderer")
      ? ["createRenderer"]
      : []),
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
    createRenderer = createRenderedGraphInternals,
    graphContainerElement,
    observeNextPaint,
    renderedGraphConfiguration = createRenderedGraphConfiguration(),
  } = dependencies;
  const renderedGraphInternals = createRenderer(
    graphContainerElement,
    renderedGraphConfiguration,
  );

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
  let documentRecordTargetsByRendererElementId = new Map();
  let occurrenceIdsByRendererKey = new Map();
  let appliedVisualizationView = DEFAULT_APPLIED_VISUALIZATION_VIEW;
  let activeGenerationAbortController = null;
  let activeViewAbortController = null;
  const renderedGraphEventSubscribers = new Set();

  function assertNotDisposed() {
    if (isDisposed) {
      throw new Error("The D3 rendered graph runtime is disposed.");
    }
  }

  function readRenderedArrangement() {
    assertNotDisposed();
    if (activeLoadGeneration === null) {
      throw new Error("No rendered arrangement is available.");
    }
    return createRenderedArrangement({
      loadGeneration: activeLoadGeneration,
      occurrences: renderedGraphInternals
        .readArrangement()
        .map(({ rendererKey, rendererElementIds, ...geometry }) => {
          if (!occurrenceIdsByRendererKey.has(rendererKey)) {
            occurrenceIdsByRendererKey.set(
              rendererKey,
              `occurrence-${occurrenceIdsByRendererKey.size + 1}`,
            );
          }
          return {
            ...geometry,
            reference: {
              loadGeneration: activeLoadGeneration,
              occurrenceId: occurrenceIdsByRendererKey.get(rendererKey),
            },
            recordTargets: rendererElementIds
              .map((id) =>
                documentRecordTargetsByRendererElementId.get(String(id)),
              )
              .filter((target) => target !== null && target !== undefined),
            ontologyElementReferences: rendererElementIds
              .map((id) =>
                ontologyElementReferencesByRendererElementId.get(String(id)),
              )
              .filter(
                (reference) => reference !== null && reference !== undefined,
              ),
          };
        }),
    });
  }

  function rendererKeyForOccurrence(reference) {
    const snapshot = readRenderedArrangement();
    if (
      reference.loadGeneration !== activeLoadGeneration ||
      !snapshot.occurrences.some(
        (entry) => entry.reference.occurrenceId === reference.occurrenceId,
      )
    ) {
      throw new RangeError(
        "The selection targets an absent or retired occurrence.",
      );
    }
    return [...occurrenceIdsByRendererKey].find(
      ([, id]) => id === reference.occurrenceId,
    )[0];
  }

  function indexDocumentRecords(vowlModel, loadGeneration) {
    documentRecordTargetsByRendererElementId = new Map();
    for (const collection of ["class", "datatype", "property"]) {
      for (const record of vowlModel[collection] ?? []) {
        const recordId = String(record.id);
        documentRecordTargetsByRendererElementId.set(
          recordId,
          documentRecordTargetsByRendererElementId.has(recordId)
            ? null
            : { collection, recordId },
        );
      }
    }
    ontologyElementReferencesByRendererElementId =
      indexOntologyElementReferencesByVowlElementId(vowlModel, loadGeneration);
    rendererElementIdsByOntologyElementReferenceKey =
      groupRendererElementIdsByReferenceKey(
        ontologyElementReferencesByRendererElementId,
      );
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
    publishRecordCreation: (payload) => {
      if (activeLoadGeneration !== null) {
        publishRenderedGraphEvent({
          kind: "record-creation-requested",
          loadGeneration: activeLoadGeneration,
          payload,
        });
      }
    },
    publishRecordEndpointEdit: (
      recordId,
      endpoint,
      nodeRecordId,
      labelPosition,
    ) => {
      const recordTarget =
        documentRecordTargetsByRendererElementId.get(recordId);
      if (activeLoadGeneration !== null && recordTarget) {
        publishRenderedGraphEvent({
          kind: "record-endpoint-edit-requested",
          loadGeneration: activeLoadGeneration,
          payload: { recordTarget, endpoint, nodeRecordId, labelPosition },
        });
      }
    },
    publishRecordDeletion: (recordId) => {
      const recordTarget =
        documentRecordTargetsByRendererElementId.get(recordId);
      if (activeLoadGeneration !== null && recordTarget) {
        publishRenderedGraphEvent({
          kind: "record-deletion-requested",
          loadGeneration: activeLoadGeneration,
          payload: { recordTarget },
        });
      }
    },
    publishRenderingStatistics: (payload) => {
      if (activeLoadGeneration !== null) {
        publishRenderedGraphEvent({
          kind: "rendering-statistics-changed",
          loadGeneration: activeLoadGeneration,
          payload,
        });
      }
    },
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
      publishRenderedGraphEvent({
        kind: "document-record-selection-changed",
        loadGeneration: activeLoadGeneration,
        payload: {
          recordTarget:
            selectedElementIds.length === 1
              ? (documentRecordTargetsByRendererElementId.get(
                  String(selectedElementIds[0]),
                ) ?? null)
              : null,
        },
      });
    },
    publishRecordLabelEdit: (recordId, text, deriveIriFromLabel) => {
      const recordTarget =
        documentRecordTargetsByRendererElementId.get(recordId);
      if (
        activeLoadGeneration === null ||
        recordTarget === null ||
        recordTarget === undefined
      ) {
        return false;
      }
      return publishRenderedGraphEvent({
        kind: "record-label-edit-requested",
        loadGeneration: activeLoadGeneration,
        payload: { recordTarget, text, deriveIriFromLabel },
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
      modes: {
        ...Object.fromEntries(
          Object.entries(VISUALIZATION_MODE_MODULE_READERS).map(
            ([name, readModule]) => [name, readModule(settings).enabled()],
          ),
        ),
        dynamicLabelWidth: settings.dynamicLabelWidth(),
        maxLabelWidthPx: settings.maxLabelWidth(),
        colorExternalsMode: settings.colorExternalsModule().colorModeType(),
      },
      forceDistances: {
        classDistancePx: settings.classDistance(),
        datatypeDistancePx: settings.datatypeDistance(),
      },
    };
  }

  // One normalized batch: every field the view changed is written to the
  // renderer before a single recomputation runs.
  function applyVisualizationViewToRenderer(
    requestedView,
    { updateDrawing = true } = {},
  ) {
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
    if (
      updateDrawing &&
      requiresRecomputation &&
      activeLoadGeneration !== null
    ) {
      renderedGraphInternals.update();
    }
    // Focus replaces the previous membership. A redraw may remove its halos,
    // so restore the standing focus even when this request omitted that field.
    if (requestedView.focus !== undefined || requiresRecomputation) {
      renderedGraphInternals.resetSearchHighlight();
      const focus = requestedView.focus ?? appliedVisualizationView.focus;
      if (focus.length > 0) {
        const focusedElementIds = focus.flatMap(
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

  function beginVisualizationRequest(signal) {
    signal?.throwIfAborted();
    activeViewAbortController?.abort(
      createAbortError(
        "The view request was superseded by a newer visualization request.",
      ),
    );
    activeViewAbortController = new AbortController();
    return AbortSignal.any([
      activeViewAbortController.signal,
      ...(activeGenerationAbortController
        ? [activeGenerationAbortController.signal]
        : []),
      ...(signal ? [signal] : []),
    ]);
  }

  function publishActualVisualizationView(loadGeneration) {
    if (
      loadGeneration !== null &&
      loadGeneration === activeLoadGeneration &&
      !isDisposed
    ) {
      publishRenderedGraphEvent({
        kind: "visualization-view-changed",
        loadGeneration,
        payload: { appliedVisualizationView: readAppliedVisualizationView() },
      });
    }
  }

  function applyVisualizationModesToRenderer(
    requestedModes,
    { updateDrawing = true } = {},
  ) {
    const renderedGraphSettings = renderedGraphInternals.options();
    let hasChangedElementRendering = false;
    for (const [modeName, readModeModule] of Object.entries(
      VISUALIZATION_MODE_MODULE_READERS,
    )) {
      if (requestedModes[modeName] === undefined) {
        continue;
      }
      readModeModule(renderedGraphSettings)?.enabled(requestedModes[modeName]);
      hasChangedElementRendering = true;
    }
    if (requestedModes.colorExternalsMode !== undefined) {
      renderedGraphSettings
        .colorExternalsModule()
        ?.colorModeType(requestedModes.colorExternalsMode);
      hasChangedElementRendering = true;
    }
    if (
      updateDrawing &&
      (requestedModes.colorExternals !== undefined ||
        requestedModes.colorExternalsMode !== undefined)
    ) {
      renderedGraphInternals.executeColorExternalsModule();
    }
    if (updateDrawing && requestedModes.compactNotation !== undefined) {
      renderedGraphInternals.executeCompactNotationModule();
    }
    if (updateDrawing && requestedModes.nodeScaling !== undefined) {
      renderedGraphInternals.executeNodeScalingModule();
    }
    // Label width is a drawing setting rather than a filter module, so it is
    // applied directly and animated into place.
    let hasChangedDynamicLabelWidthMode = false;
    let hasChangedMaxLabelWidth = false;
    if (requestedModes.dynamicLabelWidth !== undefined) {
      renderedGraphSettings.dynamicLabelWidth(requestedModes.dynamicLabelWidth);
      hasChangedDynamicLabelWidthMode = true;
    }
    if (requestedModes.maxLabelWidthPx !== undefined) {
      renderedGraphSettings.maxLabelWidth(requestedModes.maxLabelWidthPx);
      hasChangedMaxLabelWidth = true;
    }
    return {
      requiresRedraw: hasChangedElementRendering,
      requiresLabelWidthAnimation:
        hasChangedDynamicLabelWidthMode ||
        (hasChangedMaxLabelWidth && renderedGraphSettings.dynamicLabelWidth()),
    };
  }

  const renderedGraphRuntime = Object.freeze({
    setRenderingDiagnosticsEnabled(isEnabled) {
      assertNotDisposed();
      if (typeof isEnabled !== "boolean") {
        throw new TypeError("Rendering diagnostics requires a boolean.");
      }
      renderedGraphInternals.setRenderingDiagnosticsEnabled(isEnabled);
    },
    setOntologyEditorOptions(request) {
      assertNotDisposed();
      const options = createOntologyEditorOptionsRequest(request);
      const settings = renderedGraphInternals.options();
      for (const name of [
        "defaultClass",
        "defaultDatatype",
        "defaultProperty",
      ]) {
        if (options[name] !== undefined) {
          renderedGraphInternals.ontologyEditingState()[name](options[name]);
        }
      }
      for (const name of ["useAccuracyHelper", "showDraggerObject"]) {
        if (options[name] !== undefined) {
          settings[name](options[name]);
        }
      }
      if (options.isEditorMode !== undefined) {
        renderedGraphInternals.editorMode(options.isEditorMode);
        if (options.isEditorMode) {
          renderedGraphInternals.showEditorHintIfNeeded();
        }
        publishActualVisualizationView(activeLoadGeneration);
      }
      if (
        activeLoadGeneration !== null &&
        (options.useAccuracyHelper !== undefined ||
          options.showDraggerObject !== undefined)
      ) {
        renderedGraphInternals.lazyRefresh();
        renderedGraphInternals.updateDraggerElements();
      }
      return options;
    },

    resizeVisualizationViewport(request) {
      assertNotDisposed();
      const viewport = createVisualizationViewportSize(request);
      renderedGraphInternals.resizeViewport(viewport);
      return viewport;
    },

    clearRenderedGraph() {
      assertNotDisposed();
      retireActiveGeneration(
        createAbortError("The rendered graph was cleared."),
      );
      activeLoadGeneration = null;
      ontologyElementReferencesByRendererElementId.clear();
      documentRecordTargetsByRendererElementId.clear();
      occurrenceIdsByRendererKey.clear();
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

      occurrenceIdsByRendererKey = new Map();
      indexDocumentRecords(replacementRequest.vowlModel, loadGeneration);
      try {
        // The renderer parses and mutates the model as it builds the graph, so
        // it receives its own copy before its first root is drawn.
        // A native failure in either step retires this candidate too.
        renderedGraphInternals
          .options()
          .data(structuredClone(replacementRequest.vowlModel));
        if (!hasBuiltRenderedGraphRoot) {
          renderedGraphInternals.initializeSvgRoot();
          hasBuiltRenderedGraphRoot = true;
        }
        const initial = replacementRequest.initialVisualization ?? {};
        const initialView = initial.view ?? {};
        if (initialView.filters?.minDegree === undefined) {
          renderedGraphInternals
            .options()
            .nodeDegreeFilter()
            .useAutomaticMinimumDegree();
        }
        // Data interpretation happened in the application. Apply its semantic
        // choices before drawing, without running modules on a retired model.
        applyVisualizationViewToRenderer(
          { filters: initialView.filters },
          { updateDrawing: false },
        );
        applyVisualizationModesToRenderer(initial.modes ?? {}, {
          updateDrawing: false,
        });
        for (const kind of ["class", "datatype"]) {
          const distance = initial.forceDistances?.[`${kind}DistancePx`];
          if (distance !== undefined) {
            renderedGraphInternals.options()[`${kind}Distance`](distance);
          }
        }
        const hasInitialViewport =
          initialView.zoomScale !== undefined ||
          initialView.translation !== undefined;
        renderedGraphInternals.load(loadGeneration, {
          ...(initialView.language === undefined
            ? {}
            : { language: initialView.language }),
          ...(initialView.layout === undefined
            ? {}
            : { isPaused: initialView.layout === "pause" }),
          centerViewport: !hasInitialViewport,
        });
        publishRenderedGraphEvent({
          kind: "degree-filter-range-changed",
          loadGeneration,
          payload: renderedGraphInternals
            .options()
            .nodeDegreeFilter()
            .readDegreeRange(),
        });
        if (hasInitialViewport) {
          renderedGraphInternals.setViewportTransform(
            initialView.zoomScale ?? renderedGraphInternals.scaleFactor(),
            initialView.translation === undefined
              ? renderedGraphInternals.translation()
              : [initialView.translation.xPx, initialView.translation.yPx],
          );
        }
        if (initialView.focus !== undefined) {
          applyVisualizationViewToRenderer({ focus: initialView.focus });
          appliedVisualizationView = createAppliedVisualizationView({
            ...readAppliedVisualizationView(),
            focus: initialView.focus,
          });
        }

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

    applyVowlModelRevision(request) {
      assertNotDisposed();
      const revision = createVowlModelRevisionRequest(request);
      if (revision.loadGeneration !== activeLoadGeneration) {
        throw createAbortError(
          "The document revision targets a superseded load generation.",
        );
      }
      const retainedView = readAppliedVisualizationView();
      renderedGraphInternals.applyVowlModelRevision(
        structuredClone(revision.vowlModel),
      );
      indexDocumentRecords(revision.vowlModel, activeLoadGeneration);
      const focus = retainedView.focus.filter((reference) =>
        rendererElementIdsByOntologyElementReferenceKey.has(
          ontologyElementReferenceKey(reference),
        ),
      );
      applyVisualizationViewToRenderer({ focus });
      appliedVisualizationView = createAppliedVisualizationView({
        ...readAppliedVisualizationView(),
        focus,
      });
      publishRenderedGraphEvent({
        kind: "degree-filter-range-changed",
        loadGeneration: activeLoadGeneration,
        payload: renderedGraphInternals
          .options()
          .nodeDegreeFilter()
          .readDegreeRange(),
      });
      return createVisualizationViewApplicationResult({
        loadGeneration: activeLoadGeneration,
        appliedVisualizationView,
        visibleRenderedGraphSnapshot:
          renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
      });
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

      const viewSignal = beginVisualizationRequest(signal);

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
      if (requestedView.translation !== undefined) {
        const completed = renderedGraphInternals.panViewport(
          requestedView.translation,
        );
        if (completed === false) {
          throw createAbortError("The viewport pan could not be applied.");
        }
        await awaitObservedPaint(loadGeneration, viewSignal);
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

    readRenderedArrangement,

    async setRenderedArrangement(request, { signal } = {}) {
      assertNotDisposed();
      signal?.throwIfAborted();
      const changes = resolveRenderedArrangementChanges(
        readRenderedArrangement(),
        request,
      );
      const resolved = changes.map(({ reference, ...change }) => ({
        ...change,
        rendererKey: rendererKeyForOccurrence(reference),
      }));
      const loadGeneration = activeLoadGeneration;
      const viewSignal = beginVisualizationRequest(signal);
      renderedGraphInternals.applyArrangement(resolved);
      await awaitObservedPaint(loadGeneration, viewSignal);
      return readRenderedArrangement();
    },

    selectRenderedOccurrence(request, { editLabel = false } = {}) {
      assertNotDisposed();
      if (typeof editLabel !== "boolean") {
        throw new TypeError("Inline label editing must be Boolean.");
      }
      const selection = createRenderedOccurrenceSelectionRequest(request);
      const rendererKey =
        selection.reference === null
          ? null
          : rendererKeyForOccurrence(selection.reference);
      renderedGraphInternals.selectOccurrence(rendererKey, { editLabel });
      return selection.reference;
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

    setVisualizationModes(request, { signal } = {}) {
      assertNotDisposed();
      signal?.throwIfAborted();
      const requestedModes = createVisualizationModesRequest(request);
      const loadGeneration = activeLoadGeneration;
      const viewSignal = beginVisualizationRequest(signal);
      const renderingChanges =
        applyVisualizationModesToRenderer(requestedModes);
      if (renderingChanges.requiresRedraw && loadGeneration !== null) {
        renderedGraphInternals.lazyRefresh();
      }
      let labelWidthAnimation;
      if (
        loadGeneration !== null &&
        renderingChanges.requiresLabelWidthAnimation
      ) {
        labelWidthAnimation = renderedGraphInternals.animateDynamicLabelWidth({
          signal: viewSignal,
        });
      }
      return (async () => {
        const animationCompleted = await labelWidthAnimation;
        viewSignal.throwIfAborted();
        if (animationCompleted === false) {
          throw createAbortError("The label width animation was interrupted.");
        }
        if (loadGeneration !== null) {
          applyVisualizationViewToRenderer({
            focus: appliedVisualizationView.focus,
          });
          await awaitObservedPaint(loadGeneration, viewSignal);
        }
        viewSignal.throwIfAborted();
        assertNotDisposed();
        return createAppliedVisualizationView(readAppliedVisualizationView());
      })().finally(() => {
        // Cancellation stops waiting for the action. Native transition handlers
        // finish its applied geometry; observers must receive those actual choices.
        publishActualVisualizationView(loadGeneration);
      });
    },

    setForceLayoutDistances(request) {
      assertNotDisposed();
      const requestedDistances = createForceLayoutDistancesRequest(request);
      renderedGraphInternals.setForceLayoutDistances(requestedDistances);
      return createAppliedVisualizationView(readAppliedVisualizationView());
    },

    async resetVisualization({ signal } = {}) {
      assertNotDisposed();
      signal?.throwIfAborted();
      const loadGeneration = activeLoadGeneration;
      const resetSignal = beginVisualizationRequest(signal);
      try {
        applyVisualizationModesToRenderer(DEFAULT_VISUALIZATION_MODES);
        appliedVisualizationView = { ...appliedVisualizationView, focus: [] };
        applyVisualizationViewToRenderer({
          filters: DEFAULT_VISUALIZATION_FILTERS,
          focus: [],
        });
        renderedGraphInternals.resetVisualization();
        renderedGraphInternals.setForceLayoutDistances(
          DEFAULT_FORCE_LAYOUT_DISTANCES,
        );
        if (loadGeneration !== null) {
          renderedGraphRuntime.setGraphLayoutPaused({
            loadGeneration,
            isPaused: false,
          });
          await awaitObservedPaint(loadGeneration, resetSignal);
        }
        resetSignal.throwIfAborted();
        assertNotDisposed();
        appliedVisualizationView = createAppliedVisualizationView(
          readAppliedVisualizationView(),
        );
        return appliedVisualizationView;
      } finally {
        publishActualVisualizationView(loadGeneration);
      }
    },

    createTurtleDocumentSnapshot(request) {
      assertNotDisposed();
      if (
        request?.loadGeneration !== activeLoadGeneration ||
        activeLoadGeneration === null
      ) {
        throw createAbortError(
          "The Turtle export request targets a superseded load generation.",
        );
      }
      const turtleText = serializeOntologyAsTurtle(renderedGraphInternals);
      if (turtleText === null) {
        throw new Error(
          "The existing Turtle exporter does not support this ontology.",
        );
      }
      return Object.freeze({
        loadGeneration: activeLoadGeneration,
        turtleText,
      });
    },

    createRenderedDrawingSnapshot(request) {
      assertNotDisposed();
      if (
        request?.loadGeneration !== activeLoadGeneration ||
        activeLoadGeneration === null
      ) {
        throw createAbortError(
          "The drawing snapshot request targets a superseded load generation.",
        );
      }
      const svgRoot = graphContainerElement.querySelector("svg");
      if (!svgRoot) {
        throw createAbortError("The rendered graph has no drawing to export.");
      }
      const nodes = [];
      renderedGraphInternals
        .graphNodeElements()
        .each((node) => nodes.push(node));
      const [translationXPx, translationYPx] =
        renderedGraphInternals.translation();
      const drawing = captureRenderedDrawing({
        svgRoot,
        nodes,
        propertyLabels: renderedGraphInternals.graphLabelElements(),
        links: renderedGraphInternals.graphLinkElements(),
        math: renderedGraphInternals.math(),
        compactNotation: readAppliedVisualizationView().modes.compactNotation,
        readComputedStyle: (element) =>
          svgRoot.ownerDocument.defaultView.getComputedStyle(element),
        viewport: {
          widthPx:
            readSvgLengthAttribute(svgRoot, "width") ??
            renderedGraphConfiguration.widthPx,
          heightPx:
            readSvgLengthAttribute(svgRoot, "height") ??
            renderedGraphConfiguration.heightPx,
          zoomScale: renderedGraphInternals.scaleFactor(),
          translationXPx,
          translationYPx,
        },
      });
      return createRenderedDrawingSnapshot({
        loadGeneration: activeLoadGeneration,
        ...drawing,
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
