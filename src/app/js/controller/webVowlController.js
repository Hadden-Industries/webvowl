import {
  createWebVowlControllerState,
  WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES,
  GENERATION_SCOPED_CONTROLLER_STATE_FIELDS,
  toPublicWebVowlError,
  truncateOntologyDerivedText,
  truncateResultCollection,
  WEB_VOWL_OPERATION_LIMITS,
  WebVowlOperationError,
} from "./webVowlControllerContracts.js";

const WEB_VOWL_CONTROLLER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "ontologySourceLoader",
  "vowlModelInspectionProjector",
  "renderedGraphRuntime",
  "ontologyInspector",
  "graphLayoutSettler",
  "svgArtifactService",
  "waitForDocumentFonts",
  "waitForBrowserPaint",
]);

const EXPORT_REQUEST_FIELD_NAMES = Object.freeze([
  "filename",
  "settleTimeoutMs",
  "onTimeout",
]);

const BACKGROUND_SETTLE_TIMEOUT_MS = 30000;
const DEFAULT_EXPORT_SETTLE_TIMEOUT_MS = 12000;
const BROWSER_PAINT_WAIT_COUNT = 2;

const IDLE_CONTROLLER_STATE = Object.freeze({
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

function arePublishedValuesEqual(leftValue, rightValue) {
  if (leftValue === rightValue) {
    return true;
  }
  if (
    leftValue === null ||
    rightValue === null ||
    typeof leftValue !== "object" ||
    typeof rightValue !== "object"
  ) {
    return false;
  }
  if (Array.isArray(leftValue) !== Array.isArray(rightValue)) {
    return false;
  }
  if (Array.isArray(leftValue)) {
    return (
      leftValue.length === rightValue.length &&
      leftValue.every((entry, entryIndex) =>
        arePublishedValuesEqual(entry, rightValue[entryIndex]),
      )
    );
  }
  const leftFieldNames = Object.keys(leftValue);
  return (
    leftFieldNames.length === Object.keys(rightValue).length &&
    leftFieldNames.every(
      (fieldName) =>
        Object.prototype.hasOwnProperty.call(rightValue, fieldName) &&
        arePublishedValuesEqual(leftValue[fieldName], rightValue[fieldName]),
    )
  );
}

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
  assertPlainRecord(dependencies, "WebVOWL controller dependencies");
  const actualFieldNames = Object.keys(dependencies).sort();
  const expectedFieldNames = [
    ...WEB_VOWL_CONTROLLER_DEPENDENCY_FIELD_NAMES,
  ].sort();
  if (
    actualFieldNames.length !== expectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== expectedFieldNames[index],
    )
  ) {
    throw new TypeError(
      "WebVOWL controller dependencies have an invalid dependency field set.",
    );
  }
}

function assertAllowedFieldNames(record, allowedFieldNames, description) {
  assertPlainRecord(record, description);
  const unsupportedFieldName = Object.keys(record).find(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unsupportedFieldName !== undefined) {
    throw new TypeError(
      `${description} contains unsupported field ${unsupportedFieldName}.`,
    );
  }
}

function isExpectedOperationError(error) {
  return (
    error !== null &&
    typeof error === "object" &&
    typeof error.code === "string"
  );
}

function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.code === "LOAD_ABORTED" ||
    error?.code === "ABORT_ERR"
  );
}

function createNoOntologyError() {
  return new WebVowlOperationError({
    code: "NO_ONTOLOGY",
    message: "No ontology is currently loaded.",
  });
}

function createLoadAbortedError(cause) {
  return new WebVowlOperationError({
    cause,
    code: "LOAD_ABORTED",
    message: "The requested load generation was superseded or cancelled.",
  });
}

function publicErrorProjection(operationError) {
  try {
    return toPublicWebVowlError(operationError);
  } catch {
    return Object.freeze({
      code: operationError.code,
      message: truncateOntologyDerivedText(String(operationError.message ?? ""))
        .ontologyDerivedText,
      isRetryable: operationError.isRetryable === true,
      details: Object.freeze({ ...(operationError.details ?? {}) }),
    });
  }
}

function layoutStatusFromSnapshot(graphLayoutSnapshot) {
  if (graphLayoutSnapshot.isPaused) {
    return "paused";
  }
  return graphLayoutSnapshot.hasEnded ? "settled" : "relaxing";
}

export function createWebVowlController(dependencies) {
  assertExactDependencyFieldNames(dependencies);
  const {
    ontologySourceLoader,
    vowlModelInspectionProjector,
    renderedGraphRuntime,
    ontologyInspector,
    graphLayoutSettler,
    svgArtifactService,
    waitForDocumentFonts,
    waitForBrowserPaint,
  } = dependencies;

  let isDisposed = false;
  let controllerState = createWebVowlControllerState(IDLE_CONTROLLER_STATE);
  let lastValidControllerState = controllerState;
  let activeLoadGeneration = 0;
  let lastIssuedLoadGeneration = 0;
  let currentOntologyGeneration = 0;
  let currentVowlModel = null;
  let hasAcceptedRenderedMount = false;
  let activeLoadAbortController;
  let backgroundObservationController;
  let currentSourceProvenance = null;
  let currentOntologyInspectionSnapshot = null;
  let currentWarnings = [];
  const stateSubscribers = new Set();

  // A writer states the fields it wrote. Narrowing that set to the fields whose
  // value actually differs happens once, here, using what the writer already
  // knew - rather than every subscriber comparing its own slice to work out
  // what a broadcast snapshot changed.
  function publishControllerState(nextControllerState, writtenFieldNames) {
    if (isDisposed) {
      return;
    }
    const previousControllerState = controllerState;
    controllerState = createWebVowlControllerState(nextControllerState);
    const changedFieldNames = Object.freeze(
      writtenFieldNames.filter(
        (fieldName) =>
          !arePublishedValuesEqual(
            previousControllerState?.[fieldName],
            controllerState[fieldName],
          ),
      ),
    );
    for (const stateSubscriber of [...stateSubscribers]) {
      stateSubscriber(controllerState, changedFieldNames);
    }
  }

  function publishForGeneration(loadGeneration, controllerStateChanges) {
    if (isDisposed || loadGeneration !== activeLoadGeneration) {
      return;
    }
    publishControllerState(
      { ...controllerState, ...controllerStateChanges },
      Object.keys(controllerStateChanges),
    );
  }

  function isCurrentGeneration(loadGeneration) {
    return !isDisposed && loadGeneration === activeLoadGeneration;
  }

  function throwWhenSuperseded(loadGeneration, cancellationSignal) {
    if (cancellationSignal?.aborted === true) {
      throw createLoadAbortedError(cancellationSignal.reason);
    }
    if (!isCurrentGeneration(loadGeneration)) {
      throw createLoadAbortedError();
    }
  }

  function abortBackgroundLayoutObservation() {
    backgroundObservationController?.abort();
    backgroundObservationController = undefined;
  }

  function subscribeToGraphLayoutEvents(onGraphLayoutEvent) {
    return renderedGraphRuntime.subscribeToRenderedGraphEvents(
      onGraphLayoutEvent,
    );
  }

  function readGraphLayoutSnapshot() {
    return renderedGraphRuntime.readGraphLayoutSnapshot();
  }

  function startBackgroundLayoutObservation(loadGeneration) {
    abortBackgroundLayoutObservation();
    const observationController = new AbortController();
    backgroundObservationController = observationController;
    graphLayoutSettler
      .waitForSettledGraphLayout(
        {
          loadGeneration,
          readGraphLayoutSnapshot,
          subscribeToGraphLayoutEvents,
          settleTimeoutMs: BACKGROUND_SETTLE_TIMEOUT_MS,
          onTimeout: "best-effort",
        },
        { signal: observationController.signal },
      )
      .then((layoutOutcome) => {
        if (
          !isCurrentGeneration(loadGeneration) ||
          observationController.signal.aborted
        ) {
          return;
        }
        publishForGeneration(loadGeneration, {
          status: "ready",
          layout: { status: layoutOutcome.status },
        });
      })
      .catch(() => undefined);
  }

  function reduceRenderedGraphEvent(renderedGraphEvent) {
    // The active generation is the one being rendered, so its events are
    // current even before the load completes; every other generation is stale.
    if (
      isDisposed ||
      renderedGraphEvent.loadGeneration !== activeLoadGeneration
    ) {
      return;
    }
    if (renderedGraphEvent.kind === "render-warning-raised") {
      currentWarnings = truncateResultCollection(
        [...currentWarnings, renderedGraphEvent.payload.message],
        WEB_VOWL_OPERATION_LIMITS.maxWarnings,
      ).retainedEntries;
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        warnings: [...currentWarnings],
      });
      return;
    }
    if (renderedGraphEvent.kind === "rendered-element-selection-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        selection: [
          ...renderedGraphEvent.payload.selectedOntologyElementReferences,
        ],
      });
      return;
    }
    if (renderedGraphEvent.kind === "render-progress-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        renderProgress: {
          completedRenderedElementCount:
            renderedGraphEvent.payload.completedRenderedElementCount,
          totalRenderedElementCount:
            renderedGraphEvent.payload.totalRenderedElementCount,
        },
      });
      return;
    }
    if (renderedGraphEvent.kind === "visualization-view-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        view: renderedGraphEvent.payload.appliedVisualizationView,
      });
      if (
        hasAcceptedRenderedMount &&
        renderedGraphEvent.loadGeneration === currentOntologyGeneration
      ) {
        lastValidControllerState = controllerState;
      }
      return;
    }
    if (renderedGraphEvent.kind === "viewport-changed") {
      // Magnification and pan are separate fields because a control cares
      // about one or the other; overloading them into a single viewport field
      // would tell a zoom control about every pan.
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        zoomScale: renderedGraphEvent.payload.zoomScale,
        translation: {
          xPx: renderedGraphEvent.payload.translationXPx,
          yPx: renderedGraphEvent.payload.translationYPx,
        },
      });
      return;
    }
    if (renderedGraphEvent.kind === "editor-mode-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        editorMode: { isEditorMode: renderedGraphEvent.payload.isEditorMode },
      });
      return;
    }
    if (renderedGraphEvent.kind === "graph-layout-state-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        layout: {
          status: layoutStatusFromSnapshot(renderedGraphEvent.payload),
        },
      });
    }
  }

  const unsubscribeFromRenderedGraphEvents =
    renderedGraphRuntime.subscribeToRenderedGraphEvents(
      reduceRenderedGraphEvent,
    );

  function assertOntologyPresent() {
    if (isDisposed || currentOntologyGeneration === 0) {
      throw createNoOntologyError();
    }
  }

  // The language that names no choice at all. It is always acceptable, because
  // it is how a reader and an agent ask for the ontology's own labels rather
  // than a particular translation.
  const UNCHOSEN_LANGUAGE = "default";

  // A language is only meaningful against the ontology that is loaded, so this
  // is a controller-domain check rather than something a schema could make.
  // Accepting a language the ontology does not carry would report it as
  // selected while every label on screen stayed as it was, and an agent would
  // tell a reader the graph had switched when it had not.
  function assertRequestedLanguageIsCarried(requestedLanguage) {
    if (requestedLanguage === undefined) {
      return;
    }
    const availableLabelLanguages =
      currentOntologyInspectionSnapshot?.availableLabelLanguages ?? [];
    if (
      requestedLanguage === UNCHOSEN_LANGUAGE ||
      availableLabelLanguages.includes(requestedLanguage)
    ) {
      return;
    }
    throw new WebVowlOperationError({
      code: "VIEW_REJECTED",
      message: `The ontology carries no labels in ${requestedLanguage}. It carries ${[
        UNCHOSEN_LANGUAGE,
        ...availableLabelLanguages,
      ].join(", ")}.`,
    });
  }

  function readInspectionRequestSnapshots() {
    if (currentOntologyInspectionSnapshot === null) {
      throw createNoOntologyError();
    }
    return {
      ontologyInspectionSnapshot: currentOntologyInspectionSnapshot,
      visibleRenderedGraphSnapshot:
        renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
    };
  }

  function restoreStateAfterFailedLoad(
    loadGeneration,
    operationError,
    previousOntology,
  ) {
    if (!isCurrentGeneration(loadGeneration)) {
      return;
    }
    activeLoadGeneration = currentOntologyGeneration;
    lastValidControllerState =
      previousOntology?.state ??
      createWebVowlControllerState(IDLE_CONTROLLER_STATE);
    if (isAbortError(operationError)) {
      publishControllerState(
        lastValidControllerState,
        WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES,
      );
      return;
    }
    publishControllerState(
      {
        ...lastValidControllerState,
        status: "error",
        loadGeneration: currentOntologyGeneration,
        error: publicErrorProjection(operationError),
      },
      WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES,
    );
  }

  async function applyRuntimeVisualizationView(
    loadGeneration,
    visualizationView,
    cancellationSignal,
  ) {
    const viewApplicationResult =
      await renderedGraphRuntime.applyVisualizationView(
        { loadGeneration, ...visualizationView },
        { signal: cancellationSignal },
      );
    throwWhenSuperseded(loadGeneration, cancellationSignal);
    return viewApplicationResult;
  }

  async function restorePreviousRenderedOntology(
    previousOntology,
    recoverySignal,
  ) {
    hasAcceptedRenderedMount = false;
    if (previousOntology === null) {
      renderedGraphRuntime.clearRenderedGraph();
      currentVowlModel = null;
      currentOntologyInspectionSnapshot = null;
      currentSourceProvenance = null;
      currentOntologyGeneration = 0;
      currentWarnings = [];
      activeLoadGeneration = 0;
      lastValidControllerState = createWebVowlControllerState(
        IDLE_CONTROLLER_STATE,
      );
      publishControllerState(
        lastValidControllerState,
        WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES,
      );
      return;
    }

    const recoveryGeneration = ++lastIssuedLoadGeneration;
    activeLoadGeneration = recoveryGeneration;
    const { model, state } = previousOntology;
    // Anonymous references name a mount. Recovery draws the same accepted
    // ontology in a fresh mount, so those references receive its generation.
    const rebindReference = (reference) =>
      "loadGeneration" in reference
        ? { ...reference, loadGeneration: recoveryGeneration }
        : reference;
    const recoveredView = {
      ...state.view,
      focus: state.view.focus.map(rebindReference),
    };
    publishForGeneration(recoveryGeneration, {
      ...GENERATION_SCOPED_CONTROLLER_STATE_FIELDS,
      status: "rendering",
      loadGeneration: recoveryGeneration,
      source: state.source,
      error: null,
    });
    await renderedGraphRuntime.replaceVowlModel(
      {
        loadGeneration: recoveryGeneration,
        vowlModel: model,
      },
      { signal: recoverySignal },
    );
    throwWhenSuperseded(recoveryGeneration, recoverySignal);
    await renderedGraphRuntime.setVisualizationModes(recoveredView.modes, {
      signal: recoverySignal,
    });
    await renderedGraphRuntime.setForceLayoutDistances(
      recoveredView.forceDistances,
      { signal: recoverySignal },
    );
    const applied = await applyRuntimeVisualizationView(
      recoveryGeneration,
      {
        language: recoveredView.language,
        filters: recoveredView.filters,
        focus: recoveredView.focus,
        layout: state.layout.status === "paused" ? "pause" : "resume",
        ...(state.zoomScale === null ? {} : { zoomScale: state.zoomScale }),
      },
      recoverySignal,
    );
    throwWhenSuperseded(recoveryGeneration, recoverySignal);
    currentVowlModel = model;
    hasAcceptedRenderedMount = true;
    currentOntologyGeneration = recoveryGeneration;
    currentOntologyInspectionSnapshot =
      vowlModelInspectionProjector.projectOntologyInspectionSnapshot(
        model,
        recoveryGeneration,
      );
    currentSourceProvenance = state.source;
    currentWarnings = [...state.warnings];
    const layout = readGraphLayoutSnapshot();
    publishForGeneration(recoveryGeneration, {
      ...state,
      loadGeneration: recoveryGeneration,
      zoomScale: controllerState.zoomScale,
      translation: controllerState.translation,
      view: applied.appliedVisualizationView,
      selection: state.selection.map(rebindReference),
      layout: { status: layoutStatusFromSnapshot(layout) },
      status: layout.isPaused || layout.hasEnded ? "ready" : "relaxing",
      error: null,
    });
    lastValidControllerState = controllerState;
    if (!layout.isPaused && !layout.hasEnded) {
      startBackgroundLayoutObservation(recoveryGeneration);
    }
  }

  return Object.freeze({
    async loadOntology(sourceRequest, { signal } = {}) {
      if (isDisposed) {
        throw createLoadAbortedError();
      }
      activeLoadAbortController?.abort();
      abortBackgroundLayoutObservation();

      activeLoadGeneration = ++lastIssuedLoadGeneration;
      const loadGeneration = activeLoadGeneration;
      const previousOntology =
        currentVowlModel === null
          ? null
          : {
              model: currentVowlModel,
              state:
                controllerState.loadGeneration === currentOntologyGeneration &&
                ["ready", "relaxing"].includes(controllerState.status)
                  ? controllerState
                  : lastValidControllerState,
            };
      let hasStartedModelReplacement = false;
      const loadAbortController = new AbortController();
      activeLoadAbortController = loadAbortController;
      const cancellationSignal = AbortSignal.any(
        signal === undefined
          ? [loadAbortController.signal]
          : [signal, loadAbortController.signal],
      );

      try {
        publishForGeneration(loadGeneration, {
          ...GENERATION_SCOPED_CONTROLLER_STATE_FIELDS,
          status: "loading",
          loadGeneration,
          error: null,
        });

        const sourceLoadRecord = await ontologySourceLoader.loadOntologySource(
          sourceRequest,
          {
            onPhaseChange: (loadPhase) => {
              if (loadPhase === "parsing") {
                publishForGeneration(loadGeneration, { status: "parsing" });
              }
            },
            signal: cancellationSignal,
          },
        );
        throwWhenSuperseded(loadGeneration, cancellationSignal);

        // Projected before the renderer is asked to draw, so a semantic
        // question is answerable as soon as the model exists.
        const ontologyInspectionSnapshot =
          vowlModelInspectionProjector.projectOntologyInspectionSnapshot(
            sourceLoadRecord.vowlModel,
            loadGeneration,
          );
        throwWhenSuperseded(loadGeneration, cancellationSignal);

        publishForGeneration(loadGeneration, { status: "rendering" });
        hasStartedModelReplacement = true;
        hasAcceptedRenderedMount = false;
        await renderedGraphRuntime.replaceVowlModel(
          {
            loadGeneration,
            vowlModel: sourceLoadRecord.vowlModel,
          },
          { signal: cancellationSignal },
        );
        throwWhenSuperseded(loadGeneration, cancellationSignal);

        const viewApplicationResult = await applyRuntimeVisualizationView(
          loadGeneration,
          {},
          cancellationSignal,
        );
        const graphLayoutSnapshot = readGraphLayoutSnapshot();
        currentVowlModel = structuredClone(sourceLoadRecord.vowlModel);
        hasAcceptedRenderedMount = true;
        currentOntologyGeneration = loadGeneration;
        currentOntologyInspectionSnapshot = ontologyInspectionSnapshot;
        currentSourceProvenance = sourceLoadRecord.sourceProvenance;
        currentWarnings = truncateResultCollection(
          sourceLoadRecord.diagnostics.map(
            (diagnostic) => diagnostic.message ?? String(diagnostic),
          ),
          WEB_VOWL_OPERATION_LIMITS.maxWarnings,
        ).retainedEntries;

        publishForGeneration(loadGeneration, {
          status:
            graphLayoutSnapshot.isPaused || graphLayoutSnapshot.hasEnded
              ? "ready"
              : "relaxing",
          loadGeneration,
          source: { ...currentSourceProvenance },
          warnings: [...currentWarnings],
          view: viewApplicationResult.appliedVisualizationView,
          layout: { status: layoutStatusFromSnapshot(graphLayoutSnapshot) },
          error: null,
        });
        lastValidControllerState = controllerState;

        if (!graphLayoutSnapshot.isPaused && !graphLayoutSnapshot.hasEnded) {
          startBackgroundLayoutObservation(loadGeneration);
        }
        return controllerState;
      } catch (error) {
        const operationError = isExpectedOperationError(error)
          ? error
          : createLoadAbortedError(error);
        if (
          isCurrentGeneration(loadGeneration) &&
          (hasStartedModelReplacement ||
            (previousOntology !== null && !hasAcceptedRenderedMount))
        ) {
          try {
            // Caller cancellation ends the candidate. A new request or
            // disposal can still abort recovery through the load owner.
            await restorePreviousRenderedOntology(
              previousOntology,
              loadAbortController.signal,
            );
          } catch (recoveryError) {
            if (!loadAbortController.signal.aborted && !isDisposed) {
              renderedGraphRuntime.clearRenderedGraph();
              currentVowlModel = null;
              hasAcceptedRenderedMount = false;
              currentOntologyInspectionSnapshot = null;
              currentSourceProvenance = null;
              currentOntologyGeneration = 0;
              currentWarnings = [];
              lastValidControllerState = createWebVowlControllerState(
                IDLE_CONTROLLER_STATE,
              );
              publishForGeneration(activeLoadGeneration, {
                ...IDLE_CONTROLLER_STATE,
                status: "error",
                loadGeneration: activeLoadGeneration,
                error: publicErrorProjection(
                  createLoadAbortedError(recoveryError),
                ),
              });
            }
          }
          throw operationError;
        }
        restoreStateAfterFailedLoad(
          loadGeneration,
          operationError,
          previousOntology,
        );
        throw operationError;
      }
    },

    getOntologySummary() {
      assertOntologyPresent();
      return ontologyInspector.getOntologySummary({
        ...readInspectionRequestSnapshots(),
        appliedVisualizationView: controllerState.view,
        sourceProvenance: currentSourceProvenance,
        warnings: [...currentWarnings],
      });
    },

    findOntologyElements(searchRequest) {
      assertOntologyPresent();
      return ontologyInspector.findOntologyElements({
        ...readInspectionRequestSnapshots(),
        ...searchRequest,
        language: controllerState.view?.language,
      });
    },

    // A presentation module renders what state says is selected; this resolves
    // those references against the ontology the controller holds, so the
    // interface never reads a drawn element for a semantic fact.
    describeOntologyElements(descriptionRequest) {
      assertOntologyPresent();
      return ontologyInspector.describeOntologyElements({
        ...readInspectionRequestSnapshots(),
        ...descriptionRequest,
        language: controllerState.view?.language,
      });
    },

    async setVisualizationView(visualizationViewRequest, { signal } = {}) {
      assertOntologyPresent();
      const loadGeneration = currentOntologyGeneration;
      const cancellationSignal = AbortSignal.any(
        signal === undefined ? [] : [signal],
      );

      try {
        assertRequestedLanguageIsCarried(visualizationViewRequest?.language);
        const requestedFocus = visualizationViewRequest?.focus;
        const resolvedVisualizationView = { ...visualizationViewRequest };
        if (requestedFocus !== undefined) {
          const focusResolution =
            ontologyInspector.resolveFocusableOntologyElementReferences({
              ...readInspectionRequestSnapshots(),
              ontologyElementReferences: requestedFocus,
            });
          resolvedVisualizationView.focus = [
            ...focusResolution.focusableReferences,
          ];
        }

        if (visualizationViewRequest?.layout === "resume") {
          abortBackgroundLayoutObservation();
        }

        const viewApplicationResult = await applyRuntimeVisualizationView(
          loadGeneration,
          resolvedVisualizationView,
          cancellationSignal,
        );
        const graphLayoutSnapshot = readGraphLayoutSnapshot();
        const isResumeRequested = visualizationViewRequest?.layout === "resume";

        publishForGeneration(loadGeneration, {
          status: isResumeRequested
            ? "relaxing"
            : controllerState.status === "error"
              ? "ready"
              : controllerState.status,
          view: viewApplicationResult.appliedVisualizationView,
          layout: {
            status: isResumeRequested
              ? "relaxing"
              : layoutStatusFromSnapshot(graphLayoutSnapshot),
          },
          error: null,
        });
        lastValidControllerState = controllerState;

        if (isResumeRequested) {
          startBackgroundLayoutObservation(loadGeneration);
        }
        return controllerState;
      } catch (error) {
        if (isExpectedOperationError(error)) {
          throw error;
        }
        throw createLoadAbortedError(error);
      }
    },

    setGraphLayoutPaused(pauseRequest) {
      assertOntologyPresent();
      const loadGeneration = currentOntologyGeneration;
      const graphLayoutPauseResult = renderedGraphRuntime.setGraphLayoutPaused({
        loadGeneration,
        isPaused: pauseRequest?.isPaused,
      });
      publishForGeneration(loadGeneration, {
        layout: { status: graphLayoutPauseResult.layoutStatus },
      });
      lastValidControllerState = controllerState;
      return graphLayoutPauseResult;
    },

    // Drawing preferences also apply to an empty graph and survive a load.
    async setVisualizationModes(visualizationModesRequest, { signal } = {}) {
      try {
        const loadGeneration = activeLoadGeneration;
        throwWhenSuperseded(loadGeneration, signal);
        const view = await renderedGraphRuntime.setVisualizationModes(
          visualizationModesRequest,
          { signal },
        );
        throwWhenSuperseded(loadGeneration, signal);
        publishForGeneration(loadGeneration, { view });
        if (hasAcceptedRenderedMount) {
          lastValidControllerState = controllerState;
        }
        return controllerState;
      } catch (error) {
        if (isAbortError(error)) {
          throw createLoadAbortedError(error);
        }
        throw error;
      }
    },

    async setForceLayoutDistances(
      forceLayoutDistancesRequest,
      { signal } = {},
    ) {
      const loadGeneration = activeLoadGeneration;
      throwWhenSuperseded(loadGeneration, signal);
      const view = await renderedGraphRuntime.setForceLayoutDistances(
        forceLayoutDistancesRequest,
        { signal },
      );
      throwWhenSuperseded(loadGeneration, signal);
      publishForGeneration(loadGeneration, { view });
      if (hasAcceptedRenderedMount) {
        lastValidControllerState = controllerState;
      }
      return controllerState;
    },

    // A held zoom control reports the gesture, not a magnification per frame.
    // This is controller-domain only and never a WebMCP tool: it tunes how the
    // visualization is drawn, not what it says, so an empty graph may be
    // magnified like any other.
    setContinuousZoom(continuousZoomRequest) {
      return renderedGraphRuntime.setContinuousZoom(continuousZoomRequest);
    },

    async resetVisualization(request = {}, { signal } = {}) {
      assertAllowedFieldNames(request, [], "visualization reset request");
      const loadGeneration = activeLoadGeneration;
      throwWhenSuperseded(loadGeneration, signal);
      if (
        ["loading", "parsing", "rendering"].includes(controllerState.status)
      ) {
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message:
            "Wait for ontology loading to finish before resetting the visualization.",
          isRetryable: true,
        });
      }
      abortBackgroundLayoutObservation();
      try {
        const view = await renderedGraphRuntime.resetVisualization({ signal });
        throwWhenSuperseded(loadGeneration, signal);
        const hasOntology = currentOntologyGeneration > 0;
        publishForGeneration(loadGeneration, {
          view,
          error: null,
          status: hasOntology ? "relaxing" : "idle",
          layout: {
            status: hasOntology
              ? layoutStatusFromSnapshot(readGraphLayoutSnapshot())
              : "unavailable",
          },
        });
        lastValidControllerState = controllerState;
        if (hasOntology) {
          startBackgroundLayoutObservation(loadGeneration);
        }
        return controllerState;
      } catch (error) {
        if (isAbortError(error)) {
          throw createLoadAbortedError(error);
        }
        throw error;
      } finally {
        if (
          isCurrentGeneration(loadGeneration) &&
          hasAcceptedRenderedMount &&
          currentOntologyGeneration === loadGeneration &&
          backgroundObservationController === undefined
        ) {
          // Reset effects precede paint. Cancelling the wait must not abandon
          // observation of motion already resumed on the accepted graph.
          const layout = readGraphLayoutSnapshot();
          publishForGeneration(loadGeneration, {
            layout: { status: layoutStatusFromSnapshot(layout) },
            status: layout.isPaused || layout.hasEnded ? "ready" : "relaxing",
          });
          lastValidControllerState = controllerState;
          if (!layout.isPaused && !layout.hasEnded) {
            startBackgroundLayoutObservation(loadGeneration);
          }
        }
      }
    },

    async exportVisualization(exportRequest = {}, { signal } = {}) {
      assertOntologyPresent();
      assertAllowedFieldNames(
        exportRequest,
        EXPORT_REQUEST_FIELD_NAMES,
        "export request",
      );
      const loadGeneration = currentOntologyGeneration;
      const cancellationSignal = AbortSignal.any(
        signal === undefined ? [] : [signal],
      );
      abortBackgroundLayoutObservation();

      let priorPauseState;
      let didPauseForExport = false;

      try {
        const layoutOutcome =
          await graphLayoutSettler.waitForSettledGraphLayout(
            {
              loadGeneration,
              readGraphLayoutSnapshot,
              subscribeToGraphLayoutEvents,
              settleTimeoutMs:
                exportRequest.settleTimeoutMs ??
                DEFAULT_EXPORT_SETTLE_TIMEOUT_MS,
              onTimeout: exportRequest.onTimeout ?? "fail",
            },
            { signal: cancellationSignal },
          );
        throwWhenSuperseded(loadGeneration, cancellationSignal);

        // Holding the layout still keeps the snapshot matching what settled.
        // A layout that has already ended is still by itself, so pausing it
        // achieves nothing and the restore afterwards would re-energise it —
        // which is right when a reader resumes, and wrong as a side effect of
        // exporting a graph they had watched come to rest.
        const graphLayoutSnapshotBeforeCapture = readGraphLayoutSnapshot();
        priorPauseState = graphLayoutSnapshotBeforeCapture.isPaused;
        if (!graphLayoutSnapshotBeforeCapture.hasEnded && !priorPauseState) {
          renderedGraphRuntime.setGraphLayoutPaused({
            loadGeneration,
            isPaused: true,
          });
          didPauseForExport = true;
        }

        await waitForDocumentFonts();
        for (
          let paintIndex = 0;
          paintIndex < BROWSER_PAINT_WAIT_COUNT;
          paintIndex += 1
        ) {
          await waitForBrowserPaint();
        }
        throwWhenSuperseded(loadGeneration, cancellationSignal);

        const renderedSvgSnapshot =
          renderedGraphRuntime.createRenderedSvgSnapshot({ loadGeneration });

        return await svgArtifactService.createSvgArtifact(
          {
            renderedSvgSnapshot,
            filename: exportRequest.filename,
            viewRecipe: {
              source: { ...currentSourceProvenance },
              loadGeneration,
              appliedVisualizationView: controllerState.view,
              // The viewport the artifact was framed on, read from the
              // snapshot itself. Taking it from the layout instead lets the
              // recipe and the artifact disagree about the same picture.
              viewportDimensions: {
                widthPx: renderedSvgSnapshot.widthPx,
                heightPx: renderedSvgSnapshot.heightPx,
              },
              layoutOutcome: {
                status: layoutOutcome.status,
                reason: layoutOutcome.reason,
              },
            },
          },
          { signal: cancellationSignal },
        );
      } catch (error) {
        if (isExpectedOperationError(error)) {
          throw error;
        }
        throw error;
      } finally {
        if (
          didPauseForExport &&
          !isDisposed &&
          loadGeneration === currentOntologyGeneration &&
          loadGeneration === activeLoadGeneration
        ) {
          const restoredPauseResult = renderedGraphRuntime.setGraphLayoutPaused(
            { loadGeneration, isPaused: priorPauseState },
          );
          publishForGeneration(loadGeneration, {
            layout: { status: restoredPauseResult.layoutStatus },
          });
        }
      }
    },

    getState() {
      return controllerState;
    },

    subscribeToState(onStateChange) {
      if (typeof onStateChange !== "function") {
        throw new TypeError(
          "A controller state subscriber must be a function.",
        );
      }
      stateSubscribers.add(onStateChange);
      let isSubscribed = true;
      return () => {
        if (!isSubscribed) {
          return;
        }
        isSubscribed = false;
        stateSubscribers.delete(onStateChange);
      };
    },

    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      activeLoadAbortController?.abort();
      abortBackgroundLayoutObservation();
      unsubscribeFromRenderedGraphEvents();
      stateSubscribers.clear();
      renderedGraphRuntime.dispose();
    },
  });
}
