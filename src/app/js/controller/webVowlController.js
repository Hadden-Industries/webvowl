import {
  createOntologyEditorOptionsRequest,
  createVisualizationViewportSize,
  DEFAULT_ONTOLOGY_EDITOR_OPTIONS,
  ONTOLOGY_CREATION_TYPES,
} from "./rendererInteractionContracts.js";
import {
  createWebVowlControllerState,
  WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES,
  GENERATION_SCOPED_CONTROLLER_STATE_FIELDS,
  toPublicWebVowlError,
  truncateOntologyDerivedText,
  truncateResultCollection,
  WEB_VOWL_OPERATION_LIMITS,
  WebVowlOperationError,
  createVowlDocumentRecordTarget,
} from "./webVowlControllerContracts.js";
import {
  applyVowlDocumentRecordEdit,
  createVowlDocumentSnapshot,
  applyVowlOntologyMetadataEdit,
  setVowlDocumentPrefix,
  removeVowlDocumentPrefix,
  describeVowlDocumentDeletion,
  applyVowlDocumentDeletion,
  insertVowlDocumentRecords,
} from "./vowlDocument.js";
import {
  decodeVowlVisualizationSettings,
  encodeVowlVisualizationSettings,
} from "./vowlVisualizationSettings.js";
import { createVisualizationShareLink } from "./visualizationShareLink.js";
import {
  createInitialVisualizationRequest,
  createVisualizationViewApplicationRequest,
} from "./renderedGraphRuntimeContracts.js";

const WEB_VOWL_CONTROLLER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "ontologySourceLoader",
  "vowlModelInspectionProjector",
  "renderedGraphRuntime",
  "ontologyInspector",
  "graphLayoutSettler",
  "visualizationArtifactService",
  "waitForDocumentFonts",
  "waitForBrowserPaint",
  "applicationUrl",
]);

const EXPORT_REQUEST_FIELD_NAMES = Object.freeze([
  "format",
  "filename",
  "settleTimeoutMs",
  "onTimeout",
]);

const BACKGROUND_SETTLE_TIMEOUT_MS = 30000;
const DEFAULT_EXPORT_SETTLE_TIMEOUT_MS = 12000;
const BROWSER_PAINT_WAIT_COUNT = 2;

import { retainVowlDocumentArrangement } from "./vowlDocumentArrangement.js";
import {
  createRenderedArrangementQuery,
  createRenderedArrangementRequest,
  createRenderedOccurrenceSelectionRequest,
} from "./renderedArrangementContracts.js";

const IDLE_CONTROLLER_STATE = Object.freeze({
  status: "idle",
  loadGeneration: 0,
  documentRevision: 0,
  source: null,
  hasReusedCachedVisualization: false,
  warnings: [],
  view: null,
  zoomScale: null,
  translation: null,
  layout: { status: "unavailable" },
  selection: [],
  selectedDocumentRecord: null,
  renderProgress: null,
  degreeFilterRange: null,
  editorMode: null,
  renderingStatistics: null,
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

async function awaitExportCompletion(work, signal) {
  let onAbort;
  const cancellation = new Promise((resolve, reject) => {
    void resolve;
    onAbort = () => reject(signal.reason);
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    return await Promise.race([work, cancellation]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function assertExactDependencyFieldNames(dependencies) {
  assertPlainRecord(dependencies, "WebVOWL controller dependencies");
  const actualFieldNames = Object.keys(dependencies)
    .filter((name) => name !== "requestOntologyDeletionConfirmation")
    .sort();
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
  if (
    dependencies.requestOntologyDeletionConfirmation !== undefined &&
    typeof dependencies.requestOntologyDeletionConfirmation !== "function"
  ) {
    throw new TypeError("Deletion confirmation must be a function.");
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

function createLoadFailedError(cause) {
  return new WebVowlOperationError({
    code: "LOAD_FAILED",
    message: "The ontology could not be loaded.",
    cause,
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
    visualizationArtifactService,
    waitForDocumentFonts,
    waitForBrowserPaint,
    applicationUrl,
    requestOntologyDeletionConfirmation = async () => false,
  } = dependencies;

  let isDisposed = false;
  let controllerState = createWebVowlControllerState(IDLE_CONTROLLER_STATE);
  let lastValidControllerState = controllerState;
  let activeLoadGeneration = 0;
  let lastIssuedLoadGeneration = 0;
  let currentOntologyGeneration = 0;
  let currentVowlModel = null;
  let currentSourceCacheKey = null;
  const cachedOntologySources = new Map();
  let hasAcceptedRenderedMount = false;
  let ontologyEditorOptions = DEFAULT_ONTOLOGY_EDITOR_OPTIONS;
  let activeLoadAbortController;
  let activeExportOperation;
  let layoutIntentSequence = 0;

  function retireActiveExport() {
    activeExportOperation?.restoreLayout?.();
    activeExportOperation?.abortController.abort();
    activeExportOperation = undefined;
  }
  let backgroundObservationController;
  let currentSourceProvenance = null;
  let currentOntologyInspectionSnapshot = null;
  let currentWarnings = [];
  const stateSubscribers = new Set();
  const deletionProposals = new WeakMap();

  function sourceCacheKeyFor(source) {
    if (!["ontology-document-iri", "vowl-json-url"].includes(source?.kind)) {
      return null;
    }
    // Include every supplied field. Only a request previously accepted by the
    // source loader can hit; malformed or extended input still reaches its
    // authoritative validation. Property order has no semantic significance.
    return JSON.stringify(source, Object.keys(source).sort());
  }

  function retainCurrentOntologyForNavigation() {
    if (
      currentSourceCacheKey === null ||
      currentVowlModel === null ||
      !hasAcceptedRenderedMount
    ) {
      return;
    }
    const arrangedModel = retainVowlDocumentArrangement(
      currentVowlModel,
      renderedGraphRuntime.readRenderedArrangement({
        loadGeneration: currentOntologyGeneration,
      }),
    );
    const acceptedState =
      controllerState.loadGeneration === currentOntologyGeneration
        ? controllerState
        : lastValidControllerState;
    const sourceRecord = Object.freeze({
      vowlModel: createVowlDocumentSnapshot({
        ...arrangedModel,
        ...(acceptedState.zoomScale === null ||
        acceptedState.translation === null
          ? {}
          : { settings: encodeVowlVisualizationSettings(acceptedState) }),
      }),
      sourceProvenance: currentSourceProvenance,
      diagnostics: currentWarnings.map((message) => ({ message })),
      sourceCacheKey: currentSourceCacheKey,
    });
    cachedOntologySources.delete(currentSourceCacheKey);
    cachedOntologySources.set(currentSourceCacheKey, sourceRecord);
    // Keep a small recent navigation history rather than every ontology ever
    // opened in a long-lived page. A miss simply reloads through the source owner.
    if (cachedOntologySources.size > 4) {
      cachedOntologySources.delete(cachedOntologySources.keys().next().value);
    }
  }

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
    if (renderedGraphEvent.kind === "document-record-selection-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        selectedDocumentRecord: renderedGraphEvent.payload.recordTarget,
      });
      return;
    }
    if (renderedGraphEvent.kind === "record-creation-requested") {
      const { records, selectedRecord, editLabel } = renderedGraphEvent.payload;
      observeHumanEdit(
        applyHumanDocumentEdit(
          { loadGeneration: renderedGraphEvent.loadGeneration, records },
          ["records"],
          (model) => insertVowlDocumentRecords(model, records),
          { selectedRecord, editLabel },
        ),
      );
      return;
    }
    if (renderedGraphEvent.kind === "record-endpoint-edit-requested") {
      const { recordTarget, endpoint, nodeRecordId, labelPosition } =
        renderedGraphEvent.payload;
      observeHumanEdit(
        applyHumanDocumentEdit(
          { loadGeneration: renderedGraphEvent.loadGeneration, recordTarget },
          ["recordTarget"],
          (model) =>
            applyVowlDocumentRecordEdit(model, {
              recordTarget,
              changes: { [`${endpoint}RecordId`]: nodeRecordId },
            }),
          {
            selectedRecord: recordTarget,
            positionOverride: { recordTarget, ...labelPosition },
          },
        ),
      );
      return;
    }
    if (renderedGraphEvent.kind === "record-deletion-requested") {
      observeHumanEdit(
        (async () => {
          const proposal = proposeOntologyDeletion({
            loadGeneration: renderedGraphEvent.loadGeneration,
            recordTarget: renderedGraphEvent.payload.recordTarget,
          });
          // Preserve the canvas rule: only cascades of more than two records ask.
          if (
            proposal.recordTargets.length > 2 &&
            !(await requestOntologyDeletionConfirmation(proposal, {
              signal: activeLoadAbortController.signal,
            }))
          ) {
            deletionProposals.delete(proposal);
            return;
          }
          await confirmOntologyDeletion(proposal);
        })(),
      );
      return;
    }
    if (renderedGraphEvent.kind === "record-label-edit-requested") {
      const { recordTarget, text, deriveIriFromLabel } =
        renderedGraphEvent.payload;
      const request = {
        loadGeneration: renderedGraphEvent.loadGeneration,
        recordTarget,
        changes: {
          label: {
            language: controllerState.view?.language ?? "default",
            text,
          },
        },
      };
      const editing = applyHumanDocumentEdit(
        request,
        ["recordTarget", "changes"],
        (model) =>
          applyVowlDocumentRecordEdit(model, {
            recordTarget,
            changes: {
              ...request.changes,
              ...(deriveIriFromLabel
                ? {
                    iri: `${model.header?.iri ?? "http://www.w3.org/2002/07/owl#"}${text.replaceAll(" ", "_")}`,
                  }
                : {}),
            },
          }),
        { selectedRecord: recordTarget },
      );
      observeHumanEdit(editing);
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
    if (renderedGraphEvent.kind === "degree-filter-range-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        degreeFilterRange: renderedGraphEvent.payload,
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
    if (renderedGraphEvent.kind === "rendering-statistics-changed") {
      publishForGeneration(renderedGraphEvent.loadGeneration, {
        renderingStatistics: renderedGraphEvent.payload,
      });
      return;
    }
    if (renderedGraphEvent.kind === "editor-mode-changed") {
      ontologyEditorOptions = Object.freeze({
        ...ontologyEditorOptions,
        isEditorMode: renderedGraphEvent.payload.isEditorMode,
      });
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
  function assertRequestedLanguageIsCarried(
    requestedLanguage,
    ontologyInspectionSnapshot = currentOntologyInspectionSnapshot,
  ) {
    if (requestedLanguage === undefined) {
      return;
    }
    const availableLabelLanguages =
      ontologyInspectionSnapshot?.availableLabelLanguages ?? [];
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
      currentSourceCacheKey = null;
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
        initialVisualization: {
          view: {
            language: recoveredView.language,
            filters: recoveredView.filters,
            focus: recoveredView.focus,
            layout: state.layout.status === "paused" ? "pause" : "resume",
            ...(state.zoomScale === null ? {} : { zoomScale: state.zoomScale }),
            ...(state.translation === null
              ? {}
              : { translation: state.translation }),
          },
          modes: recoveredView.modes,
          forceDistances: recoveredView.forceDistances,
        },
      },
      { signal: recoverySignal },
    );
    throwWhenSuperseded(recoveryGeneration, recoverySignal);
    const applied = await applyRuntimeVisualizationView(
      recoveryGeneration,
      {},
      recoverySignal,
    );
    throwWhenSuperseded(recoveryGeneration, recoverySignal);
    currentVowlModel = model;
    currentSourceCacheKey = previousOntology.sourceCacheKey;
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

  function assertCurrentDrawing() {
    assertOntologyPresent();
    if (
      !hasAcceptedRenderedMount ||
      activeLoadGeneration !== currentOntologyGeneration ||
      ["loading", "parsing", "rendering"].includes(controllerState.status)
    ) {
      throw new WebVowlOperationError({
        code: "VIEW_REJECTED",
        message:
          "Wait for the current ontology drawing before changing its arrangement or selection.",
      });
    }
  }

  async function replaceOntologyDocument(
    prepareSourceLoad,
    { signal, initialVisualization: requestedInitialVisualization } = {},
  ) {
    if (isDisposed) {
      throw createLoadAbortedError();
    }
    let initialChoices;
    try {
      initialChoices = createInitialVisualizationRequest(
        requestedInitialVisualization ?? {},
      );
    } catch (cause) {
      throw new WebVowlOperationError({
        code: "VIEW_REJECTED",
        message: "The initial visualization choices are invalid.",
        cause,
      });
    }
    retireActiveExport();
    activeLoadAbortController?.abort();
    abortBackgroundLayoutObservation();

    activeLoadGeneration = ++lastIssuedLoadGeneration;
    const loadGeneration = activeLoadGeneration;
    const previousOntology =
      currentVowlModel === null
        ? null
        : {
            model: currentVowlModel,
            sourceCacheKey: currentSourceCacheKey,
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

      const sourceLoadRecord = await prepareSourceLoad({
        onPhaseChange: (loadPhase) => {
          if (loadPhase === "parsing") {
            publishForGeneration(loadGeneration, { status: "parsing" });
          }
        },
        signal: cancellationSignal,
      });
      throwWhenSuperseded(loadGeneration, cancellationSignal);

      let initialVisualization;
      try {
        initialVisualization = decodeVowlVisualizationSettings(
          sourceLoadRecord.vowlModel.settings,
        );
        const mergedChoices = {};
        for (const section of ["view", "modes", "forceDistances"]) {
          if (
            initialVisualization[section] !== undefined ||
            initialChoices[section] !== undefined
          ) {
            mergedChoices[section] = {
              ...initialVisualization[section],
              ...initialChoices[section],
            };
          }
        }
        if (
          initialVisualization.view?.filters !== undefined ||
          initialChoices.view?.filters !== undefined
        ) {
          mergedChoices.view.filters = {
            ...initialVisualization.view?.filters,
            ...initialChoices.view?.filters,
          };
        }
        initialVisualization = createInitialVisualizationRequest(mergedChoices);
      } catch (cause) {
        throw new WebVowlOperationError({
          code: "PARSE_FAILED",
          message: "Saved visualization settings are invalid.",
          cause,
        });
      }

      // Projected before the renderer is asked to draw, so a semantic
      // question is answerable as soon as the model exists.
      const ontologyInspectionSnapshot =
        vowlModelInspectionProjector.projectOntologyInspectionSnapshot(
          sourceLoadRecord.vowlModel,
          loadGeneration,
        );
      assertRequestedLanguageIsCarried(
        initialVisualization.view?.language,
        ontologyInspectionSnapshot,
      );
      throwWhenSuperseded(loadGeneration, cancellationSignal);

      publishForGeneration(loadGeneration, { status: "rendering" });
      hasStartedModelReplacement = true;
      hasAcceptedRenderedMount = false;
      await renderedGraphRuntime.replaceVowlModel(
        {
          loadGeneration,
          vowlModel: sourceLoadRecord.vowlModel,
          ...(Object.keys(initialVisualization).length === 0
            ? {}
            : { initialVisualization }),
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
      currentSourceCacheKey = sourceLoadRecord.sourceCacheKey ?? null;
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
        documentRevision: 1,
        hasReusedCachedVisualization:
          sourceLoadRecord.hasReusedCachedVisualization === true,
        warnings: [...currentWarnings],
        editorMode: { isEditorMode: ontologyEditorOptions.isEditorMode },
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
        : cancellationSignal.aborted ||
            !isCurrentGeneration(loadGeneration) ||
            isAbortError(error)
          ? createLoadAbortedError(error)
          : createLoadFailedError(error);
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
                createLoadFailedError(recoveryError),
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
  }

  function assertCurrentEditableDocument(request, allowedFields) {
    assertOntologyPresent();
    assertAllowedFieldNames(
      request,
      ["loadGeneration", ...allowedFields],
      "Ontology edit",
    );
    if (
      request.loadGeneration !== currentOntologyGeneration ||
      !["ready", "relaxing"].includes(controllerState.status) ||
      controllerState.editorMode?.isEditorMode !== true
    ) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message:
          "The edit must target the current ontology in the enabled editor.",
      });
    }
  }

  function proposeOntologyDeletion(request) {
    try {
      assertCurrentEditableDocument(request, ["recordTarget"]);
      const description = describeVowlDocumentDeletion(
        currentVowlModel,
        request.recordTarget,
      );
      const proposal = Object.freeze({
        loadGeneration: currentOntologyGeneration,
        ...description,
      });
      deletionProposals.set(proposal, {
        baseModel: currentVowlModel,
        editedModel: applyVowlDocumentDeletion(
          currentVowlModel,
          request.recordTarget,
        ),
      });
      return proposal;
    } catch (cause) {
      if (isExpectedOperationError(cause)) {
        throw cause;
      }
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message: cause.message,
        cause,
      });
    }
  }
  async function confirmOntologyDeletion(proposal, options) {
    const pendingDeletion = deletionProposals.get(proposal);
    if (
      pendingDeletion === undefined ||
      pendingDeletion.baseModel !== currentVowlModel
    ) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message:
          "This deletion proposal was not issued here or has already been used.",
      });
    }
    assertCurrentEditableDocument(
      { loadGeneration: proposal.loadGeneration },
      [],
    );
    deletionProposals.delete(proposal);
    return commitEditedDocument(pendingDeletion.editedModel, {
      ...options,
      selectedRecord: null,
    });
  }
  function observeHumanEdit(editing) {
    const requestOwner = activeLoadAbortController;
    void editing.catch((error) => {
      if (
        !isDisposed &&
        activeLoadAbortController === requestOwner &&
        !requestOwner?.signal.aborted
      ) {
        currentWarnings = truncateResultCollection(
          [...currentWarnings, error.message],
          WEB_VOWL_OPERATION_LIMITS.maxWarnings,
        ).retainedEntries;
        publishForGeneration(activeLoadGeneration, {
          warnings: currentWarnings,
        });
      }
    });
  }

  async function commitEditedDocument(
    editedModel,
    {
      signal,
      selectedRecord = controllerState.selectedDocumentRecord,
      editLabel = false,
      positionOverride,
    } = {},
  ) {
    if (signal?.aborted) {
      throw createLoadAbortedError(signal.reason);
    }
    selectedRecord =
      selectedRecord === null
        ? null
        : createVowlDocumentRecordTarget(selectedRecord);
    const state = controllerState;
    const arrangedModel = structuredClone(
      retainVowlDocumentArrangement(
        editedModel,
        renderedGraphRuntime.readRenderedArrangement(),
      ),
    );
    if (positionOverride) {
      const { collection, recordId } = positionOverride.recordTarget;
      const attributes = arrangedModel[`${collection}Attribute`]?.find(
        (record) => String(record.id) === recordId,
      );
      if (attributes) {
        attributes.pos = [positionOverride.xPx, positionOverride.yPx];
      }
    }
    const loadGeneration = currentOntologyGeneration;
    const revisedModel = createVowlDocumentSnapshot(arrangedModel);
    const inspection =
      vowlModelInspectionProjector.projectOntologyInspectionSnapshot(
        revisedModel,
        loadGeneration,
      );
    retireActiveExport();
    const revisionResult = renderedGraphRuntime.applyVowlModelRevision({
      loadGeneration,
      vowlModel: revisedModel,
    });
    currentVowlModel = revisedModel;
    currentOntologyInspectionSnapshot = inspection;
    const layoutSnapshot = readGraphLayoutSnapshot();
    publishForGeneration(loadGeneration, {
      documentRevision: state.documentRevision + 1,
      selection: [],
      selectedDocumentRecord: null,
      view: revisionResult.appliedVisualizationView,
      status:
        layoutSnapshot.isPaused || layoutSnapshot.hasEnded
          ? "ready"
          : "relaxing",
      layout: { status: layoutStatusFromSnapshot(layoutSnapshot) },
    });
    const occurrence =
      selectedRecord === null
        ? null
        : renderedGraphRuntime
            .readRenderedArrangement()
            .occurrences.find((entry) =>
              entry.recordTargets.some(
                (target) =>
                  target.collection === selectedRecord.collection &&
                  target.recordId === selectedRecord.recordId,
              ),
            );
    renderedGraphRuntime.selectRenderedOccurrence(
      {
        reference: occurrence?.reference ?? null,
      },
      { editLabel },
    );
    lastValidControllerState = controllerState;
    if (!layoutSnapshot.isPaused && !layoutSnapshot.hasEnded) {
      startBackgroundLayoutObservation(loadGeneration);
    }
    return controllerState;
  }

  async function applyHumanDocumentEdit(
    request,
    fields,
    editDocument,
    options,
  ) {
    let editedModel;
    try {
      assertCurrentEditableDocument(request, fields);
      editedModel = editDocument(currentVowlModel);
    } catch (cause) {
      if (isExpectedOperationError(cause)) {
        throw cause;
      }
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message: cause.message,
        cause,
      });
    }
    return commitEditedDocument(editedModel, options);
  }

  async function exportCurrentVisualization(
    exportRequest,
    cancellationSignal,
    exportOperation,
  ) {
    assertCurrentDrawing();
    assertAllowedFieldNames(
      exportRequest,
      EXPORT_REQUEST_FIELD_NAMES,
      "export request",
    );
    const loadGeneration = currentOntologyGeneration;
    const format = exportRequest.format ?? "svg";
    if (!["svg", "vowl-json", "turtle", "latex"].includes(format)) {
      throw new TypeError("Unsupported visualization export format.");
    }
    throwWhenSuperseded(loadGeneration, cancellationSignal);
    if (format === "vowl-json" || format === "turtle") {
      if (
        exportRequest.settleTimeoutMs !== undefined ||
        exportRequest.onTimeout !== undefined
      ) {
        throw new TypeError(
          "Layout settlement options apply to SVG and LaTeX exports.",
        );
      }
      if (format === "turtle") {
        try {
          const turtleDocumentSnapshot =
            renderedGraphRuntime.createTurtleDocumentSnapshot({
              loadGeneration,
            });
          return await visualizationArtifactService.createVisualizationArtifact(
            {
              format,
              filename: exportRequest.filename,
              source: { ...currentSourceProvenance },
              turtleDocumentSnapshot,
            },
            { signal: cancellationSignal },
          );
        } catch (cause) {
          if (isExpectedOperationError(cause) || isAbortError(cause)) {
            throw cause;
          }
          throw new WebVowlOperationError({
            code: "EXPORT_FAILED",
            message: "The ontology could not be exported as Turtle.",
            cause,
          });
        }
      }
      const arrangedModel = retainVowlDocumentArrangement(
        currentVowlModel,
        renderedGraphRuntime.readRenderedArrangement({ loadGeneration }),
      );
      const vowlDocument = Object.freeze({
        loadGeneration,
        source: currentSourceProvenance,
        vowlModel: createVowlDocumentSnapshot({
          ...arrangedModel,
          settings: encodeVowlVisualizationSettings(controllerState),
        }),
      });
      return visualizationArtifactService.createVisualizationArtifact(
        { format, filename: exportRequest.filename, vowlDocument },
        { signal: cancellationSignal },
      );
    }
    abortBackgroundLayoutObservation();

    let priorPauseState;
    let didPauseForExport = false;
    let pauseIntentSequence;
    exportOperation.restoreLayout = () => {
      if (
        didPauseForExport &&
        !isDisposed &&
        loadGeneration === currentOntologyGeneration &&
        loadGeneration === activeLoadGeneration &&
        pauseIntentSequence === layoutIntentSequence
      ) {
        const restoredPauseResult = renderedGraphRuntime.setGraphLayoutPaused({
          loadGeneration,
          isPaused: priorPauseState,
        });
        publishForGeneration(loadGeneration, {
          layout: { status: restoredPauseResult.layoutStatus },
        });
      }
      didPauseForExport = false;
    };

    try {
      const layoutOutcome = await graphLayoutSettler.waitForSettledGraphLayout(
        {
          loadGeneration,
          readGraphLayoutSnapshot,
          subscribeToGraphLayoutEvents,
          settleTimeoutMs:
            exportRequest.settleTimeoutMs ?? DEFAULT_EXPORT_SETTLE_TIMEOUT_MS,
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
        pauseIntentSequence = layoutIntentSequence;
        renderedGraphRuntime.setGraphLayoutPaused({
          loadGeneration,
          isPaused: true,
        });
        didPauseForExport = true;
      }

      await awaitExportCompletion(waitForDocumentFonts(), cancellationSignal);
      for (
        let paintIndex = 0;
        paintIndex < BROWSER_PAINT_WAIT_COUNT;
        paintIndex += 1
      ) {
        await awaitExportCompletion(
          waitForBrowserPaint({ signal: cancellationSignal }),
          cancellationSignal,
        );
      }
      throwWhenSuperseded(loadGeneration, cancellationSignal);

      if (format === "latex") {
        return await visualizationArtifactService.createVisualizationArtifact(
          {
            format,
            filename: exportRequest.filename,
            source: { ...currentSourceProvenance },
            renderedDrawingSnapshot:
              renderedGraphRuntime.createRenderedDrawingSnapshot({
                loadGeneration,
              }),
          },
          { signal: cancellationSignal },
        );
      }

      const renderedSvgSnapshot =
        renderedGraphRuntime.createRenderedSvgSnapshot({ loadGeneration });

      return await visualizationArtifactService.createVisualizationArtifact(
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
      exportOperation.restoreLayout();
    }
  }

  return Object.freeze({
    getOntologyEditorOptions() {
      return Object.freeze({
        ...ontologyEditorOptions,
        ...ONTOLOGY_CREATION_TYPES,
      });
    },

    setOntologyEditorOptions(request) {
      if (isDisposed) {
        throw createLoadAbortedError();
      }
      const changes = createOntologyEditorOptionsRequest(request);
      const accepted = renderedGraphRuntime.setOntologyEditorOptions(changes);
      ontologyEditorOptions = Object.freeze({
        ...ontologyEditorOptions,
        ...accepted,
      });
      publishControllerState(
        {
          ...controllerState,
          editorMode: { isEditorMode: ontologyEditorOptions.isEditorMode },
        },
        ["editorMode"],
      );
      return ontologyEditorOptions;
    },

    resizeVisualizationViewport(request) {
      if (isDisposed) {
        throw createLoadAbortedError();
      }
      return renderedGraphRuntime.resizeVisualizationViewport(
        createVisualizationViewportSize(request),
      );
    },

    setRenderingDiagnosticsEnabled(isEnabled) {
      if (isDisposed) {
        throw createLoadAbortedError();
      }
      if (typeof isEnabled !== "boolean") {
        throw new TypeError("Rendering diagnostics requires a boolean.");
      }
      renderedGraphRuntime.setRenderingDiagnosticsEnabled(isEnabled);
    },

    loadOntology(sourceRequest, options) {
      if (isDisposed) {
        return Promise.reject(createLoadAbortedError());
      }
      assertAllowedFieldNames(
        sourceRequest,
        ["source", "reuseCachedOntology"],
        "ontology load request",
      );
      if (
        sourceRequest.reuseCachedOntology !== undefined &&
        typeof sourceRequest.reuseCachedOntology !== "boolean"
      ) {
        throw new TypeError("reuseCachedOntology must be a boolean.");
      }
      retainCurrentOntologyForNavigation();
      const sourceCacheKey = sourceCacheKeyFor(sourceRequest.source);
      const cachedSource =
        sourceRequest.reuseCachedOntology === true
          ? cachedOntologySources.get(sourceCacheKey)
          : undefined;
      return replaceOntologyDocument(
        async (loadOptions) =>
          cachedSource
            ? { ...cachedSource, hasReusedCachedVisualization: true }
            : {
                ...(await ontologySourceLoader.loadOntologySource(
                  { source: sourceRequest.source },
                  loadOptions,
                )),
                sourceCacheKey,
              },
        options,
      );
    },

    getVisualizationFocus() {
      const focus =
        !isDisposed &&
        hasAcceptedRenderedMount &&
        currentOntologyGeneration === controllerState.loadGeneration
          ? (controllerState.view?.focus ?? [])
          : [];
      const focusableElementCount =
        focus.length === 0
          ? 0
          : ontologyInspector.resolveFocusableOntologyElementReferences({
              ...readInspectionRequestSnapshots(),
              ontologyElementReferences: focus,
            }).focusableReferences.length;
      return Object.freeze({
        focus: Object.freeze([...focus]),
        focusableElementCount,
      });
    },

    getOntologyDocument() {
      assertOntologyPresent();
      return Object.freeze({
        loadGeneration: currentOntologyGeneration,
        vowlModel: createVowlDocumentSnapshot(currentVowlModel),
      });
    },

    async editOntologyRecord(request, { signal } = {}) {
      return applyHumanDocumentEdit(
        request,
        ["recordTarget", "changes"],
        (model) =>
          applyVowlDocumentRecordEdit(model, {
            recordTarget: request.recordTarget,
            changes: request.changes,
          }),
        { signal, selectedRecord: request?.recordTarget },
      );
    },

    editOntologyMetadata(request, options) {
      return applyHumanDocumentEdit(
        request,
        ["changes"],
        (model) => applyVowlOntologyMetadataEdit(model, request.changes),
        options,
      );
    },
    setOntologyPrefix(request, options) {
      return applyHumanDocumentEdit(
        request,
        ["previousName", "name", "iri"],
        (model) =>
          setVowlDocumentPrefix(model, {
            ...(request.previousName === undefined
              ? {}
              : { previousName: request.previousName }),
            name: request.name,
            iri: request.iri,
          }),
        options,
      );
    },
    removeOntologyPrefix(request, options) {
      return applyHumanDocumentEdit(
        request,
        ["name"],
        (model) => removeVowlDocumentPrefix(model, request.name),
        options,
      );
    },
    proposeOntologyDeletion,
    confirmOntologyDeletion,

    getVisualizationArrangement(request = {}) {
      assertCurrentDrawing();
      try {
        const { offset, limit, ontologyElementReference } =
          createRenderedArrangementQuery(request);
        const snapshot = renderedGraphRuntime.readRenderedArrangement();
        if (
          ontologyElementReference?.loadGeneration !== undefined &&
          ontologyElementReference.loadGeneration !== currentOntologyGeneration
        ) {
          throw new RangeError(
            "The ontology reference belongs to a retired load generation.",
          );
        }
        const sameReference = (reference) =>
          reference.kind === ontologyElementReference.kind &&
          (ontologyElementReference.iri !== undefined
            ? reference.iri === ontologyElementReference.iri
            : reference.localId === ontologyElementReference.localId &&
              reference.loadGeneration ===
                ontologyElementReference.loadGeneration);
        const occurrences =
          ontologyElementReference === undefined
            ? snapshot.occurrences
            : snapshot.occurrences.filter((entry) =>
                entry.ontologyElementReferences.some(sameReference),
              );
        return Object.freeze({
          loadGeneration: snapshot.loadGeneration,
          offset,
          occurrenceCount: occurrences.length,
          nextOffset:
            offset + limit < occurrences.length ? offset + limit : null,
          occurrences: Object.freeze(occurrences.slice(offset, offset + limit)),
        });
      } catch (cause) {
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message: cause.message,
          cause,
        });
      }
    },

    async setVisualizationArrangement(request, { signal } = {}) {
      assertCurrentDrawing();
      const loadGeneration = currentOntologyGeneration;
      try {
        const arrangementRequest = createRenderedArrangementRequest(request);
        const requestedIds = new Set(
          arrangementRequest.changes.map(
            ({ reference }) => reference.occurrenceId,
          ),
        );
        const result = await renderedGraphRuntime.setRenderedArrangement(
          arrangementRequest,
          { signal },
        );
        throwWhenSuperseded(loadGeneration, signal);
        return Object.freeze({
          loadGeneration,
          changedOccurrenceCount: requestedIds.size,
          occurrences: Object.freeze(
            result.occurrences.filter(({ reference }) =>
              requestedIds.has(reference.occurrenceId),
            ),
          ),
        });
      } catch (cause) {
        if (isAbortError(cause)) {
          throw createLoadAbortedError(cause);
        }
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message: cause.message,
          cause,
        });
      }
    },

    async selectVisualizationElement(request, { signal } = {}) {
      assertCurrentDrawing();
      try {
        signal?.throwIfAborted();
        renderedGraphRuntime.selectRenderedOccurrence(
          createRenderedOccurrenceSelectionRequest(request),
        );
        lastValidControllerState = controllerState;
        return controllerState;
      } catch (cause) {
        if (isAbortError(cause)) {
          throw createLoadAbortedError(cause);
        }
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message: cause.message,
          cause,
        });
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

    getVisualizationShareLink(request = {}) {
      assertCurrentDrawing();
      assertAllowedFieldNames(request, ["presentation"], "share-link request");
      try {
        return Object.freeze({
          loadGeneration: currentOntologyGeneration,
          url: createVisualizationShareLink(
            applicationUrl,
            controllerState,
            request.presentation,
          ),
        });
      } catch (error) {
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message: error.message,
          cause: error,
          isRetryable: false,
        });
      }
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

        const validatedView = createVisualizationViewApplicationRequest({
          loadGeneration,
          ...resolvedVisualizationView,
        });
        throwWhenSuperseded(loadGeneration, cancellationSignal);
        if (validatedView.layout !== undefined) {
          layoutIntentSequence += 1;
        }
        if (validatedView.layout === "resume") {
          abortBackgroundLayoutObservation();
        }

        const viewApplicationResult = await applyRuntimeVisualizationView(
          loadGeneration,
          validatedView,
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
      layoutIntentSequence += 1;
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
      layoutIntentSequence += 1;
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
      if (activeExportOperation !== undefined) {
        throw new WebVowlOperationError({
          code: "EXPORT_FAILED",
          message:
            "An export is already in progress. Wait for it to finish before exporting again.",
          isRetryable: true,
        });
      }
      const exportOperation = { abortController: new AbortController() };
      activeExportOperation = exportOperation;
      const cancellationSignal = AbortSignal.any([
        exportOperation.abortController.signal,
        ...(signal === undefined ? [] : [signal]),
      ]);
      try {
        return await awaitExportCompletion(
          exportCurrentVisualization(
            exportRequest,
            cancellationSignal,
            exportOperation,
          ),
          cancellationSignal,
        );
      } catch (error) {
        if (cancellationSignal.aborted || isAbortError(error)) {
          throw createLoadAbortedError(error);
        }
        throw error;
      } finally {
        exportOperation.restoreLayout?.();
        if (activeExportOperation === exportOperation) {
          activeExportOperation = undefined;
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
      retireActiveExport();
      activeLoadAbortController?.abort();
      abortBackgroundLayoutObservation();
      unsubscribeFromRenderedGraphEvents();
      stateSubscribers.clear();
      cachedOntologySources.clear();
      renderedGraphRuntime.dispose();
      visualizationArtifactService.dispose();
    },
  });
}
