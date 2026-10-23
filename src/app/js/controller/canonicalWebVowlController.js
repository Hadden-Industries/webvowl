import isEqual from "lodash/isEqual.js";
import { createNodeCountAdjustment } from "./nodeCountAdjustment.js";
import { createControllerOperationLifecycle } from "./controllerOperationLifecycle.js";
import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { exportCanonicalDrawing } from "./canonicalVowlDrawingExport.js";
import { createCanonicalVowlWorkerClient } from "./canonicalVowlWorkerClient.js";
import {
  canonicalFailureDetails,
  canonicalLoadingMessage,
} from "./canonicalVowlFailure.js";
import { createCanonicalVowlSourceAcquisition } from "./canonicalVowlSourceAcquisition.js";
import { applyCanonicalEditorCommand } from "./canonicalVowlEditorCommands.js";
import {
  createOntologyInspector,
  boundOntologySearchResult,
  boundOntologyFocusResult,
} from "./ontologyInspector.js";
import { createCanonicalSemanticReferences } from "./canonicalVowlInspectionProjector.js";
import { createVisualizationShareLink } from "./visualizationShareLink.js";
import {
  CANONICAL_VISIBLE_FILTERS,
  canonicalLabelSelection,
} from "./canonicalVowlViewControls.js";
import {
  createVisualizationViewApplicationRequest,
  createVisualizationModesRequest,
  createInitialVisualizationRequest,
  createForceLayoutDistancesRequest,
  createGraphLayoutPauseRequest,
  createContinuousZoomRequest,
} from "./renderedGraphRuntimeContracts.js";
import {
  createWebVowlControllerState,
  WebVowlOperationError,
  toPublicWebVowlError,
  resolveOntologyElementReference,
  ontologyElementReferenceKey,
} from "./webVowlControllerContracts.js";
import {
  createRenderedArrangementQuery,
  createRenderedArrangementRequest,
  createRenderedOccurrenceSelectionRequest,
} from "./renderedArrangementContracts.js";
import {
  DEFAULT_ONTOLOGY_EDITOR_OPTIONS,
  ONTOLOGY_CREATION_TYPES,
  createOntologyEditorOptionsRequest,
  createVisualizationViewportSize,
} from "./rendererInteractionContracts.js";

const idle = {
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
  nodeCountStatus: null,
  nodeCountAdjustment: null,
  editorMode: null,
  renderingStatistics: null,
  temporaryPresentation: null,
  error: null,
};

/** Candidate application owner. It never creates or interprets a legacy model. */
export function createCanonicalWebVowlController({
  renderedGraphRuntime: runtime,
  visualizationArtifactService: artifacts,
  graphLayoutSettler,
  waitForDocumentFonts,
  waitForBrowserPaint,
  applicationUrl,
  documentSession: session = createCanonicalVowlDocumentSession({
    workerClient: createCanonicalVowlWorkerClient(),
  }),
  sourceAcquisition: acquisition = createCanonicalVowlSourceAcquisition(),
  ontologyInspector: inspector = createOntologyInspector(),
  requestOntologyDeletionConfirmation,
  requestInverseDetachmentConfirmation,
  requestOntologyCreation,
  reconcileScene,
  nodeCountAdjustmentClock,
} = {}) {
  let state = createWebVowlControllerState(idle);
  let disposed = false;
  let retainedState = state;
  let layoutIntent = 0;
  let viewportSize;
  let filters = { ...CANONICAL_VISIBLE_FILTERS };
  let retainedHidden = [];
  let nodesShown = { mode: "auto" };
  let viewInteraction = 0;
  let ordinaryPresentation;
  let countLayoutHold;
  const lifecycle = createControllerOperationLifecycle({
    readIdentity: () => session.identity(),
    retirePresentation: () => clearNeighborhood(),
  });
  const countAdjustment = createNodeCountAdjustment({
    readAccepted: () => ({ ...session.identity(), nodesShown }),
    apply: (intent, options) =>
      applyVisualizationView(
        validateVisualizationView({ nodesShown: intent }),
        options,
      ),
    holdLayout: holdCountAdjustmentLayout,
    beforeStage: () => lifecycle.retireCaptures(),
    publish: (nodeCountAdjustment) => publish({ nodeCountAdjustment }),
    reportError: (error) => {
      if (
        !disposed &&
        error?.name !== "AbortError" &&
        error?.code !== "LOAD_ABORTED"
      ) {
        publish({ error: toPublicWebVowlError(error) });
      }
    },
    clock: nodeCountAdjustmentClock,
  });
  function validateVisualizationView(request) {
    const accepted = current("setVisualizationView");
    return createVisualizationViewApplicationRequest({
      ...request,
      loadGeneration: accepted.loadGeneration,
    });
  }
  function layoutState(status) {
    return {
      status,
      ...(countLayoutHold
        ? { requestedIsPaused: countLayoutHold.requestedIsPaused }
        : {}),
    };
  }
  function holdCountAdjustmentLayout() {
    const identity = session.identity();
    const snapshot = runtime.readGraphLayoutSnapshot();
    const owner = {
      requestedIsPaused: snapshot.isPaused,
      physicallyHeld: false,
    };
    countLayoutHold = owner;
    const currentOwner = () => {
      if (disposed || countLayoutHold !== owner) {
        return false;
      }
      try {
        const current = session.identity();
        return (
          current.loadGeneration === identity.loadGeneration &&
          current.documentRevision === identity.documentRevision
        );
      } catch {
        // A failed recovery can retire the session before the hold is released.
        return false;
      }
    };
    function prepareInstallation() {
      if (!currentOwner()) {
        throw new DOMException("The adjustment was retired.", "AbortError");
      }
      if (owner.physicallyHeld) {
        return;
      }
      owner.physicallyHeld = true;
      layoutIntent += 1;
      runtime.setGraphLayoutPaused({
        loadGeneration: identity.loadGeneration,
        isPaused: true,
      });
      publish({ layout: layoutState("paused") });
    }
    return {
      // Publish only after the adjustment owner has stored this hold. State
      // subscribers may synchronously stage another count during publication.
      beginAdjustment() {
        // A cancelled draft must not reheat an already settled graph.
        if (!snapshot.isPaused && !snapshot.hasEnded) {
          prepareInstallation();
        }
      },
      prepareInstallation,
      release() {
        const mayRestore = currentOwner();
        if (countLayoutHold !== owner) {
          return;
        }
        countLayoutHold = undefined;
        if (!mayRestore || !owner.physicallyHeld) {
          return;
        }
        layoutIntent += 1;
        const result = runtime.setGraphLayoutPaused({
          loadGeneration: identity.loadGeneration,
          isPaused: owner.requestedIsPaused,
        });
        publish({ layout: layoutState(result.layoutStatus) });
      },
    };
  }
  function clearNeighborhood() {
    if (!ordinaryPresentation) {
      return undefined;
    }
    if (disposed) {
      ordinaryPresentation = undefined;
      state = createWebVowlControllerState({
        ...state,
        temporaryPresentation: null,
      });
      return undefined;
    }
    const restoredScene = session.clearNeighborhood({
      renderedGraphRuntime: runtime,
    });
    lifecycle.retireViews();
    const restored = ordinaryPresentation;
    if (restoredScene) {
      runtime.setVisualizationFocus({
        loadGeneration: session.identity().loadGeneration,
        focus: restored.focus,
      });
    }
    ordinaryPresentation = undefined;
    publish({
      temporaryPresentation: null,
      view: readView(),
      ...runtime.readVisualizationViewport(),
    });
    return restoredScene ? restored : undefined;
  }
  function readUpstreamHidden() {
    return retainedHidden.flatMap((reference) => {
      try {
        return [session.scene().resolve(reference)];
      } catch (error) {
        if (error.code !== "SCENE_REFERENCE_EXPIRED") {
          throw error;
        }
        return [];
      }
    });
  }
  function readView(applied = runtime.readVisualizationView()) {
    return {
      ...applied,
      filters: { ...filters },
      nodesShown: { ...nodesShown },
    };
  }
  let editorOptions = { ...DEFAULT_ONTOLOGY_EDITOR_OPTIONS };
  const subscribers = new Set();
  const occurrenceObservers = new Set();
  function publishOccurrenceObservation(observation) {
    if (
      observation &&
      (observation.loadGeneration !== state.loadGeneration ||
        observation.documentRevision !== state.documentRevision)
    ) {
      return;
    }
    for (const observer of [...occurrenceObservers]) {
      try {
        observer(observation);
      } catch {
        // An observation consumer cannot disrupt drawing or other readers.
        occurrenceObservers.delete(observer);
      }
    }
  }
  function publish(changes) {
    if (disposed) {
      return;
    }
    const previous = state;
    state = createWebVowlControllerState({
      ...state,
      ...changes,
      ...(changes.warnings ? { warnings: changes.warnings.slice(-10) } : {}),
    });
    if (!lifecycle.has("load")) {
      retainedState = state;
    }
    const fields = Object.freeze(
      Object.keys(changes).filter((key) => !isEqual(previous[key], state[key])),
    );
    const published = state;
    if (fields.includes("selection") && state.selection.length === 0) {
      publishOccurrenceObservation(null);
    }
    const failed = new Set();
    for (const subscriber of [...subscribers]) {
      try {
        subscriber(published, fields);
      } catch {
        failed.add(subscriber);
      }
    }
    const warning =
      "A presentation subscriber failed. The document remains available.";
    if (
      failed.size &&
      state === published &&
      !state.warnings.includes(warning)
    ) {
      state = createWebVowlControllerState({
        ...state,
        warnings: [...state.warnings, warning].slice(-10),
      });
      if (!lifecycle.has("load")) {
        retainedState = state;
      }
      const warned = state;
      const warningFields = Object.freeze(["warnings"]);
      for (const subscriber of [...subscribers]) {
        if (!failed.has(subscriber)) {
          try {
            subscriber(warned, warningFields);
          } catch {
            // Reporting a presentation failure cannot recursively report another one.
          }
        }
      }
    }
  }
  function current(operation) {
    return lifecycle.check(operation);
  }
  function resolveFocusable(ontologyElementReferences) {
    current("getOntologySummary");
    return boundOntologyFocusResult(
      session.readModel().resolveFocusable({
        visibleRenderedGraphSnapshot:
          runtime.readVisibleRenderedGraphSnapshot(),
        ontologyElementReferences,
      }),
    );
  }
  function snapshots(operation = "getOntologySummary") {
    current(operation);
    return {
      ontologyInspectionSnapshot: session.readOntologyInspection(),
      visibleRenderedGraphSnapshot: runtime.readVisibleRenderedGraphSnapshot(),
    };
  }
  function editorRequest(request, allowed) {
    const accepted = current("editOntologyRecord");
    if (
      !request ||
      Object.keys(request).some(
        (field) =>
          !["loadGeneration", "documentRevision", ...allowed].includes(field),
      ) ||
      request.loadGeneration !== accepted.loadGeneration ||
      (request.documentRevision !== undefined &&
        request.documentRevision !== accepted.documentRevision)
    ) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message:
          "The editor request is invalid or belongs to a retired document revision.",
      });
    }
    return request;
  }
  function acceptRevision(result, selectionTargets) {
    clearNeighborhood();
    lifecycle.retireViews();
    let selectedDocumentRecord =
      result.selectedTarget ?? state.selectedDocumentRecord;
    if (selectedDocumentRecord) {
      try {
        session.resolveTarget(selectedDocumentRecord);
      } catch (error) {
        if (error.code !== "DOCUMENT_TARGET_EXPIRED") {
          throw error;
        }
        selectedDocumentRecord = null;
      }
    }
    let selection = selectedDocumentRecord === null ? [] : state.selection;
    if (selectionTargets !== undefined) {
      const references = createCanonicalSemanticReferences(
        session.inspectRecords(),
        state.loadGeneration,
        session.target,
      );
      selection = (
        result.selectedTarget ? [result.selectedTarget] : selectionTargets
      ).flatMap((target) => {
        try {
          const reference = references.get(session.resolveTarget(target));
          return reference ? [reference] : [];
        } catch (error) {
          if (error.code !== "DOCUMENT_TARGET_EXPIRED") {
            throw error;
          }
          return [];
        }
      });
    }
    const visibility = session.selectNodes(
      filters,
      nodesShown,
      readUpstreamHidden(),
    );
    publish({
      nodeCountStatus: visibility.nodeCountStatus,
      documentRevision: result.documentRevision,
      view: readView(),
      selectedDocumentRecord,
      selection,
      error: null,
    });
    return state;
  }
  async function command(intent, { signal } = {}) {
    const ticket = lifecycle.prepare("editOntologyRecord", { signal });
    countAdjustment.cancel();
    const accepted = ticket.identity;
    ticket.prepareScene();
    const references = createCanonicalSemanticReferences(
      session.inspectRecords(),
      accepted.loadGeneration,
      session.target,
    );
    const selectedKeys = new Set(
      state.selection.map(ontologyElementReferenceKey),
    );
    const selectionTargets = [...references].flatMap(([id, reference]) =>
      selectedKeys.has(ontologyElementReferenceKey(reference))
        ? [session.target(id)]
        : [],
    );
    ticket.accept();
    try {
      const result = await applyCanonicalEditorCommand(
        session,
        {
          documentRevision: accepted.documentRevision,
          ...intent,
        },
        {
          renderedGraphRuntime: runtime,
          signal: ticket.signal,
          reconcile: reconcileScene,
          confirmDeletion: requestOntologyDeletionConfirmation,
          confirmInverseDetachment: requestInverseDetachmentConfirmation,
          prepareVisibility(inspection, { correspondence, selectNodes }) {
            // A draft can begin while the worker is editing. Retire its hold
            // before the replacement semantic revision reads layout state.
            countAdjustment.cancel();
            const next = new Map(
              correspondence.map(({ previous, current: id }) => [previous, id]),
            );
            const hidden = retainedHidden.flatMap((reference) => {
              try {
                const id = next.get(session.scene().resolve(reference));
                return typeof id === "string" ? [id] : [];
              } catch (error) {
                if (error.code !== "SCENE_REFERENCE_EXPIRED") {
                  throw error;
                }
                return [];
              }
            });
            return selectNodes(filters, nodesShown, hidden).hidden;
          },
        },
      );
      ticket.assertCurrent();
      return acceptRevision(result, selectionTargets);
    } catch (cause) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message: cause.message,
        ...(typeof cause.code === "string"
          ? { details: { reason: cause.code } }
          : {}),
        cause,
      });
    } finally {
      ticket.release();
    }
  }
  function observe(promise) {
    const isCurrent = lifecycle.checkpoint();
    void promise.catch((error) => {
      if (isCurrent()) {
        publish({ error: toPublicWebVowlError(error) });
      }
    });
  }
  async function createFromGesture(payload) {
    const ticket = lifecycle.prepare("editOntologyRecord");
    const accepted = ticket.identity;
    const inspection = session.inspectRecords();
    if (payload.documentRevision !== accepted.documentRevision) {
      throw new Error("The creation gesture belongs to an earlier revision.");
    }
    if (typeof requestOntologyCreation !== "function") {
      throw new Error("Semantic creation input is unavailable.");
    }
    ticket.prepareScene();
    ticket.accept();
    const subjects = new Map(
      inspection.records.subjects.map((record) => [record.id, record]),
    );
    try {
      const input = await requestOntologyCreation(
        {
          type: payload.type,
          datatype: payload.datatype,
          properties: inspection.records.roles
            .filter(({ kind }) => kind === "object-property")
            .flatMap((role) => {
              const iri = subjects.get(role.subject)?.iri;
              return iri ? [{ iri, target: session.target(role.id) }] : [];
            }),
          resolveIri: session.resolveEditorIri,
        },
        { signal: ticket.signal },
      );
      ticket.assertCurrent();
      if (input === null) {
        return;
      }
      const common = {
        documentRevision: payload.documentRevision,
        position: payload.position,
      };
      await command(
        input.relation
          ? {
              ...common,
              kind: "insert-relation",
              ...input,
              from: payload.fromTarget,
              to: payload.toTarget,
            }
          : {
              ...common,
              kind: "insert",
              ...input,
              roleKind:
                payload.type === "owl:objectProperty"
                  ? "object-property"
                  : payload.type === "owl:datatypeProperty"
                    ? "data-property"
                    : "class",
              deprecated: payload.type === "owl:DeprecatedClass",
              ...(payload.fromTarget ? { domain: payload.fromTarget } : {}),
              ...(payload.toTarget ? { range: payload.toTarget } : {}),
            },
        { signal: ticket.signal },
      );
    } finally {
      ticket.release();
    }
  }
  let selectedEditorOccurrence;
  const unsubscribe = runtime.subscribeToRenderedGraphEvents((event) => {
    if (
      disposed ||
      lifecycle.has("load") ||
      event.loadGeneration !== state.loadGeneration
    ) {
      return;
    }
    const payload = event.payload;
    switch (event.kind) {
      case "selected-occurrence-geometry-changed":
        publishOccurrenceObservation(payload.observation);
        break;
      case "semantic-creation-requested":
        observe(createFromGesture(payload));
        break;
      case "rendered-element-selection-changed":
        publish({ selection: payload.selectedOntologyElementReferences });
        break;
      case "document-record-selection-changed":
        selectedEditorOccurrence = payload.occurrence;
        publish({ selectedDocumentRecord: payload.recordTarget });
        break;
      case "viewport-changed":
        publish({
          zoomScale: payload.zoomScale,
          translation: {
            xPx: payload.translationXPx,
            yPx: payload.translationYPx,
          },
        });
        break;
      case "visualization-view-changed":
        publish({
          view: readView(payload.appliedVisualizationView),
        });
        break;
      case "editor-mode-changed":
        publish({ editorMode: payload });
        break;
      case "rendering-statistics-changed":
        publish({ renderingStatistics: payload });
        break;
      case "graph-layout-state-changed": {
        const status = payload.isPaused
          ? "paused"
          : payload.hasEnded
            ? "settled"
            : "relaxing";
        if (state.layout.status !== status) {
          publish({ layout: layoutState(status) });
        }
        break;
      }
      case "render-warning-raised":
        publish({ warnings: [...state.warnings, payload.message].slice(-20) });
        break;
      case "record-endpoint-edit-requested":
        observe(
          command({
            kind: "endpoint",
            target: payload.recordTarget,
            endpoint: payload.endpoint,
            endpointTarget: payload.nodeTarget,
            documentRevision: payload.documentRevision,
          }),
        );
        break;
      case "record-deletion-requested":
        observe(
          command({
            kind: "delete",
            target: payload.recordTarget,
            documentRevision: payload.documentRevision,
          }),
        );
        break;
      case "record-label-edit-requested":
        observe(
          (async () => {
            const language = ["default", "undefined", "IRI-based"].includes(
              state.view?.language,
            )
              ? ""
              : (state.view?.language ?? "");
            return command({
              kind: "record",
              target: payload.recordTarget,
              documentRevision: payload.documentRevision,
              changes: {
                label: { text: payload.text, language },
                ...(payload.deriveIriFromLabel
                  ? {
                      iri: session.resolveEditorIri(
                        payload.text.replaceAll(" ", "_"),
                      ),
                    }
                  : {}),
              },
            });
          })(),
        );
        break;
      default:
        break;
    }
  });
  async function applyVisualizationView(validated, { signal } = {}) {
    const startedAt = performance.now();
    const ticket = lifecycle.prepare("setVisualizationView", {
      signal,
      request: validated,
    });
    const restored = ticket.prepareScene();
    const {
      filters: changes,
      nodesShown: requestedNodesShown,
      language,
      ...nativeView
    } = validated;
    if (restored && nativeView.focus === undefined) {
      nativeView.focus = restored.focus;
    }
    const nextNodesShown = requestedNodesShown ?? nodesShown;
    // Validate references before changing the scene; determine visibility afterwards.
    if (nativeView.focus !== undefined) {
      resolveFocusable(nativeView.focus);
    }
    const viewChanges = {};
    const previous = {
      filters,
      nodesShown,
      nodeCountStatus: state.nodeCountStatus,
    };
    let previousScene;
    let visibility;
    const nextFilters = { ...filters, ...changes };
    if (changes !== undefined || requestedNodesShown !== undefined) {
      visibility = session.selectNodes(
        nextFilters,
        nextNodesShown,
        readUpstreamHidden(),
      );
      viewChanges.hidden = visibility.hidden.map((id) =>
        session.scene().reference(id),
      );
    }
    if (language !== undefined) {
      viewChanges.labelSelection = canonicalLabelSelection(language);
    }
    if (Object.keys(viewChanges).length) {
      previousScene = session.scene().snapshot();
      session.updateView(viewChanges, { renderedGraphRuntime: runtime });
      filters = nextFilters;
      nodesShown = nextNodesShown;
    }
    ticket.accept();
    const viewRevision = ++viewInteraction;
    try {
      if (Object.keys(viewChanges).length) {
        publish({
          view: readView(),
          ...(visibility
            ? { nodeCountStatus: visibility.nodeCountStatus }
            : {}),
        });
      }
      if (nativeView.focus !== undefined) {
        const resolution = resolveFocusable(nativeView.focus);
        nativeView.focus = [...resolution.focusableReferences];
      }
      if (nativeView.layout !== undefined) {
        layoutIntent += 1;
      }
      await runtime.applyVisualizationView(nativeView, {
        signal: ticket.signal,
      });
      ticket.assertCurrent();
      session.synchronizeDrawing(runtime.readCanonicalDrawingState());
      if (requestedNodesShown !== undefined) {
        performance.clearMeasures("webvowl.node-count-interaction");
        performance.measure("webvowl.node-count-interaction", {
          start: startedAt,
          end: performance.now(),
          detail: { viewRevision, nodeCountStatus: state.nodeCountStatus },
        });
      }
    } catch (error) {
      if (previousScene && ticket.isCurrent() && !ticket.signal.aborted) {
        session.updateView(
          {
            hidden: previousScene.hidden.map((id) =>
              session.scene().reference(id),
            ),
            labelSelection: previousScene.labelSelection,
          },
          { renderedGraphRuntime: runtime },
        );
        filters = previous.filters;
        nodesShown = previous.nodesShown;
        visibility = { nodeCountStatus: previous.nodeCountStatus };
      }
      throw error;
    } finally {
      if (ticket.isCurrent()) {
        publish({
          view: readView(),
          ...(visibility
            ? {
                nodeCountStatus: visibility.nodeCountStatus,
              }
            : {}),
        });
      }
      ticket.release();
    }
    return state;
  }

  return Object.freeze({
    getState: () => state,
    subscribeToState(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("A state subscriber must be a function.");
      }
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    subscribeToSelectedVisualizationOccurrence(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("An occurrence observer must be a function.");
      }
      occurrenceObservers.add(listener);
      return () => occurrenceObservers.delete(listener);
    },
    getSelectedVisualizationOccurrence() {
      const accepted = current("getSelectedVisualizationOccurrence");
      const observation = runtime.readSelectedOccurrenceObservation();
      return observation &&
        observation.loadGeneration === accepted.loadGeneration &&
        observation.documentRevision === accepted.documentRevision
        ? observation
        : null;
    },
    async loadOntology(
      { source },
      { signal, initialVisualization, useAutomaticNodesShown } = {},
    ) {
      const initial = createInitialVisualizationRequest(
        initialVisualization ?? {},
      );
      const retained = structuredClone(source);
      const ticket = lifecycle.prepare("loadOntology", { signal });
      countAdjustment.cancel();
      ticket.prepareScene();
      ticket.accept();
      const combined = ticket.signal;
      const previous = retainedState;
      publish({
        status: "loading",
        selection: [],
        selectedDocumentRecord: null,
        error: null,
      });
      try {
        combined.throwIfAborted();
        let request;
        if (retained.kind === "ontology-document-iri") {
          request = await acquisition.remote(retained.documentIri, {
            signal: combined,
            format: retained.format,
          });
        } else if (
          ["ontology-text", "ontology-bytes"].includes(retained.kind)
        ) {
          const bytes =
            retained.kind === "ontology-bytes"
              ? retained.bytes
              : new TextEncoder().encode(retained.text);
          request = acquisition.local(bytes, {
            documentIri: retained.documentIri,
            format: retained.format,
            fileName: retained.displayName,
          });
        } else if (retained.kind === "vowl-json-url") {
          request = await acquisition.canonicalRemote(retained.url, {
            signal: combined,
          });
        } else if (
          ["vowl-json-text", "vowl-json-bytes"].includes(retained.kind)
        ) {
          const bytes =
            retained.kind === "vowl-json-bytes"
              ? retained.bytes
              : new TextEncoder().encode(retained.text);
          request =
            retained.dialect === undefined
              ? acquisition.canonicalLocal(bytes)
              : acquisition.legacyLocal(bytes, retained);
        } else {
          throw new TypeError(
            "Choose an explicit ontology or canonical document source.",
          );
        }
        combined.throwIfAborted();
        let attempt;
        let awaitingFormat = false;
        const imports = acquisition.createImportContext?.(
          request.bytes?.byteLength ?? 0,
          {
            onFormatRequired: () => {
              awaitingFormat = true;
              attempt?.abort();
            },
            onFailure: (error) => attempt?.abort(error),
          },
        );
        let accepted;
        for (;;) {
          awaitingFormat = false;
          attempt = new AbortController();
          try {
            accepted = await session.load(request, {
              signal: AbortSignal.any([combined, attempt.signal]),
              resolveImport:
                imports?.resolveImport ?? acquisition.resolveImport,
              renderedGraphRuntime: runtime,
              useAutomaticNodesShown,
              ...(viewportSize
                ? {
                    center: {
                      x: viewportSize.widthPx / 2,
                      y: viewportSize.heightPx / 2,
                    },
                  }
                : {}),
              ...(initialVisualization === undefined
                ? {}
                : { initialVisualization: initial }),
            });
            break;
          } catch (cause) {
            combined.throwIfAborted();
            if (attempt.signal.reason?.code === "RESOURCE_LIMIT_EXCEEDED") {
              throw attempt.signal.reason;
            }
            if (
              !imports ||
              !awaitingFormat ||
              !(cause.code === "LOAD_ABORTED" || cause.name === "AbortError") ||
              !(await imports.choosePendingFormats({ signal: combined }))
            ) {
              throw cause;
            }
          }
        }
        ticket.assertCurrent();
        ticket.release();
        selectedEditorOccurrence = undefined;
        filters = accepted.appliedFilters ?? {
          ...CANONICAL_VISIBLE_FILTERS,
          ...initial.view?.filters,
        };
        nodesShown = accepted.nodesShown;
        retainedHidden =
          (accepted.retainedHidden ?? accepted.visualization?.hidden)?.map(
            (id) => session.scene().reference(id),
          ) ?? [];
        const layout = runtime.readGraphLayoutSnapshot();
        publish({
          ...idle,
          status: "ready",
          loadGeneration: accepted.loadGeneration,
          documentRevision: accepted.documentRevision,
          source: {
            kind: retained.kind,
            ...(retained.documentIri || retained.url
              ? { identity: retained.documentIri ?? retained.url }
              : {}),
            ...(retained.displayName
              ? { displayName: retained.displayName }
              : {}),
          },
          warnings: (
            accepted.diagnostics ?? accepted.inspection.diagnostics
          ).map(({ message }) => message),
          view: readView(),
          ...(accepted.nodeCountStatus
            ? { nodeCountStatus: accepted.nodeCountStatus }
            : {}),
          ...runtime.readVisualizationViewport(),
          layout: {
            status: layout.isPaused
              ? "paused"
              : layout.hasEnded
                ? "settled"
                : "relaxing",
          },
          editorMode: { isEditorMode: editorOptions.isEditorMode },
        });
        return state;
      } catch (cause) {
        if (ticket.isCurrent()) {
          ticket.release();
          const cancelled = combined.aborted || cause?.name === "AbortError";
          publish({
            ...previous,
            status: cancelled ? previous.status : "error",
            error: cancelled
              ? previous.error
              : toPublicWebVowlError(
                  new WebVowlOperationError({
                    code: "LOAD_FAILED",
                    message: canonicalLoadingMessage(cause),
                    ...(typeof cause.code === "string"
                      ? {
                          details: {
                            reason: cause.code,
                            ...canonicalFailureDetails(cause),
                          },
                        }
                      : {}),
                    cause,
                  }),
                ),
          });
        }
        throw cause;
      } finally {
        ticket.release();
      }
    },
    getOntologyEditorView(target) {
      current("getOntologyEditorView");
      return session.inspectEditor(target);
    },
    resolveOntologyEditorIri(value) {
      current("resolveOntologyEditorIri");
      return session.resolveEditorIri(value);
    },
    editOntologyRecord(request, options) {
      editorRequest(request, ["recordTarget", "changes"]);
      return command(
        {
          kind: "record",
          target: request.recordTarget,
          changes: request.changes,
          ...(request.changes?.datatypeName !== undefined &&
          selectedEditorOccurrence
            ? { occurrence: selectedEditorOccurrence }
            : {}),
        },
        options,
      );
    },
    editOntologyMetadata(request, options) {
      editorRequest(request, ["changes"]);
      return command({ kind: "metadata", changes: request.changes }, options);
    },
    setOntologyPrefix(request, { signal } = {}) {
      editorRequest(request, ["name", "previousName", "iri"]);
      const ticket = lifecycle.prepare("setOntologyPrefix", { signal });
      ticket.prepareScene();
      ticket.accept();
      const { loadGeneration, documentRevision, ...prefix } = request;
      void loadGeneration;
      void documentRevision;
      try {
        return acceptRevision(
          session.setPrefix(prefix, { renderedGraphRuntime: runtime }),
        );
      } finally {
        ticket.release();
      }
    },
    removeOntologyPrefix(request, { signal } = {}) {
      editorRequest(request, ["name"]);
      const ticket = lifecycle.prepare("removeOntologyPrefix", { signal });
      ticket.prepareScene();
      ticket.accept();
      try {
        return acceptRevision(
          session.removePrefix(request.name, { renderedGraphRuntime: runtime }),
        );
      } finally {
        ticket.release();
      }
    },
    getOntologySummary() {
      return inspector.getOntologySummary({
        ...snapshots(),
        appliedVisualizationView: state.view,
        sourceProvenance: state.source,
        warnings: state.warnings,
      });
    },
    getOntologyElementRevealPlan(ontologyElementReferences) {
      current("getOntologyElementRevealPlan");
      const ranks = session.readModel().revealRanks(
        {
          filters,
          nodesShown,
          upstreamHidden: readUpstreamHidden(),
        },
        ontologyElementReferences,
      );
      const requested = new Set(
        ontologyElementReferences.map(ontologyElementReferenceKey),
      );
      return Object.freeze({
        canReveal: ranks.length === requested.size && requested.size > 0,
        requestedCount: ranks.reduce(
          (count, row) => Math.max(count, row.requiredNodeCount),
          state.nodeCountStatus.shownNodeCount,
        ),
      });
    },
    getOntologyNeighborhoodRevealPlan(ontologyElementReferences) {
      current("getOntologyNeighborhoodRevealPlan");
      const { canReveal, reason, counts } = session
        .readModel()
        .planNeighborhood(ontologyElementReferences);
      return Object.freeze({
        canReveal,
        ...(reason ? { reason } : {}),
        counts,
      });
    },
    async revealOntologyNeighborhood(
      { ontologyElementReferences },
      { signal } = {},
    ) {
      const ticket = lifecycle.prepare("revealOntologyNeighborhood", {
        signal,
      });
      const accepted = ticket.identity;
      const plan = session
        .readModel()
        .planNeighborhood(ontologyElementReferences);
      if (!plan.canReveal) {
        return Object.freeze({
          ...accepted,
          status: "refused",
          reason: plan.reason,
          counts: plan.counts,
        });
      }
      const ordinary = ordinaryPresentation ?? {
        viewport: runtime.readVisualizationViewport(),
        focus: state.view?.focus ?? [],
      };
      ticket.prepareScene();
      try {
        session.revealNeighborhood(plan.hidden, {
          renderedGraphRuntime: runtime,
        });
        ticket.accept();
        ordinaryPresentation = ordinary;
        const { nodes, edges, labels } = plan.counts;
        publish({
          temporaryPresentation: {
            kind: "neighborhood",
            ...accepted,
            counts: { nodes, edges, labels },
          },
          view: readView(),
        });
        await runtime.applyVisualizationView(
          {
            loadGeneration: accepted.loadGeneration,
            focus: ontologyElementReferences,
          },
          { signal: ticket.signal },
        );
        ticket.assertCurrent();
        session.synchronizeDrawing(runtime.readCanonicalDrawingState());
        publish({ view: readView() });
        return Object.freeze({
          ...accepted,
          status: "revealed",
          counts: plan.counts,
        });
      } catch (error) {
        if (ticket.isCurrent()) {
          clearNeighborhood();
        }
        throw error;
      } finally {
        ticket.release();
      }
    },
    async clearOntologyNeighborhood(_request = {}, { signal } = {}) {
      const ticket = lifecycle.prepare("clearOntologyNeighborhood", { signal });
      const accepted = ticket.identity;
      ticket.accept();
      let restored;
      try {
        restored = clearNeighborhood();
      } finally {
        ticket.release();
      }
      if (restored) {
        await this.setVisualizationView({ focus: restored.focus }, { signal });
      }
      return Object.freeze({ ...accepted, status: "cleared" });
    },
    async revealOntologyElements({ ontologyElementReferences }, options) {
      current("revealOntologyElements");
      const plan = this.getOntologyElementRevealPlan(ontologyElementReferences);
      if (!plan.canReveal) {
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message:
            "These elements are hidden by another filter or the restored snapshot. Change that visibility first.",
        });
      }
      return this.setVisualizationView(
        {
          nodesShown: { mode: "exact", requestedCount: plan.requestedCount },
          focus: ontologyElementReferences,
        },
        options,
      );
    },
    findOntologyElements(request) {
      current("findOntologyElements");
      return boundOntologySearchResult(
        session.readModel().find({
          visibleRenderedGraphSnapshot:
            runtime.readVisibleRenderedGraphSnapshot(),
          ...request,
          language: state.view?.language,
        }),
        request,
      );
    },
    describeOntologyElements(request) {
      current("describeOntologyElements");
      return session.readModel().describe({
        visibleRenderedGraphSnapshot:
          runtime.readVisibleRenderedGraphSnapshot(),
        ...request,
        language: state.view?.language,
      });
    },
    getOntologyFacts(request) {
      current("getOntologyFacts");
      return session.inspectFacts(request);
    },
    getOntologyEditorOptions: () =>
      Object.freeze({ ...editorOptions, ...ONTOLOGY_CREATION_TYPES }),
    getVisualizationFocus() {
      const focus =
        disposed || lifecycle.has("load") || state.status === "idle"
          ? []
          : (state.view?.focus ?? []);
      const resolved = focus.length
        ? resolveFocusable(focus)
        : { focusableReferences: [] };
      return Object.freeze({
        focus: Object.freeze([...focus]),
        focusableElementCount: resolved.focusableReferences.length,
      });
    },
    getVisualizationShareLink(request = {}) {
      const accepted = current("getVisualizationShareLink");
      if (Object.keys(request).some((field) => field !== "presentation")) {
        throw new TypeError("Invalid share-link request.");
      }
      if (accepted.documentRevision > 0) {
        throw new WebVowlOperationError({
          code: "VIEW_REJECTED",
          message:
            "The source URL does not contain your edits. Export canonical JSON to share this document.",
        });
      }
      return Object.freeze({
        loadGeneration: accepted.loadGeneration,
        url: createVisualizationShareLink(
          applicationUrl,
          {
            ...state,
            ...(ordinaryPresentation?.viewport ??
              runtime.readVisualizationViewport()),
            ...(ordinaryPresentation
              ? { view: { ...state.view, focus: ordinaryPresentation.focus } }
              : {}),
          },
          request.presentation,
        ),
      });
    },
    getVisualizationArrangement(request = {}) {
      const accepted = current("getVisualizationArrangement");
      const { ontologyElementReference, offset, limit } =
        createRenderedArrangementQuery(request);
      const snapshot = runtime.readRenderedArrangement();
      let occurrences = snapshot.occurrences;
      if (ontologyElementReference !== undefined) {
        if (
          ontologyElementReference.loadGeneration !== undefined &&
          ontologyElementReference.loadGeneration !== accepted.loadGeneration
        ) {
          throw new RangeError(
            "The ontology reference belongs to a retired document.",
          );
        }
        const inspection = session.readOntologyInspection();
        const references = [
          "classRecords",
          "datatypeRecords",
          "propertyRecords",
          "individualRecords",
        ].flatMap((field) =>
          inspection[field].map((record) => record.ontologyElementReference),
        );
        const resolved = resolveOntologyElementReference(
          ontologyElementReference,
          references,
        );
        occurrences = resolved
          ? occurrences.filter((entry) =>
              entry.ontologyElementReferences.some(
                (reference) =>
                  ontologyElementReferenceKey(reference) ===
                  ontologyElementReferenceKey(resolved),
              ),
            )
          : [];
      }
      return Object.freeze({
        loadGeneration: accepted.loadGeneration,
        offset,
        occurrenceCount: occurrences.length,
        nextOffset: offset + limit < occurrences.length ? offset + limit : null,
        occurrences: Object.freeze(occurrences.slice(offset, offset + limit)),
      });
    },
    async setVisualizationArrangement(request, { signal } = {}) {
      const ticket = lifecycle.prepare("setVisualizationArrangement", {
        signal,
      });
      const accepted = ticket.identity;
      const validated = createRenderedArrangementRequest(request);
      ticket.accept();
      try {
        const result = await runtime.setRenderedArrangement(validated, {
          signal: ticket.signal,
        });
        ticket.assertCurrent();
        session.synchronizeDrawing(runtime.readCanonicalDrawingState());
        const requested = new Set(
          validated.changes.map(({ reference }) => reference.occurrenceId),
        );
        return Object.freeze({
          loadGeneration: accepted.loadGeneration,
          changedOccurrenceCount: requested.size,
          occurrences: Object.freeze(
            result.occurrences.filter(({ reference }) =>
              requested.has(reference.occurrenceId),
            ),
          ),
        });
      } finally {
        ticket.release();
      }
    },
    async selectVisualizationElement(request, { signal } = {}) {
      const ticket = lifecycle.prepare("selectVisualizationElement", {
        signal,
      });
      const validated = createRenderedOccurrenceSelectionRequest(request);
      ticket.accept();
      try {
        runtime.selectRenderedOccurrence(validated);
        return state;
      } finally {
        ticket.release();
      }
    },
    /** Stage human input; accepted scene ownership transfers only on flush. */
    stageNodeCountAdjustment(request) {
      current("stageNodeCountAdjustment");
      return countAdjustment.stage(request);
    },
    async flushNodeCountAdjustment() {
      current("flushNodeCountAdjustment");
      await countAdjustment.flush();
      return state;
    },
    setNodeCountAdjustmentVisible(isVisible) {
      if (typeof isVisible !== "boolean") {
        throw new TypeError("Adjustment visibility must be Boolean.");
      }
      if (!disposed) {
        countAdjustment.setVisible(isVisible);
      }
    },
    async setVisualizationView(request, options) {
      options?.signal?.throwIfAborted();
      const validated = validateVisualizationView(request);
      const replacesAdjustment =
        validated.nodesShown !== undefined ||
        validated.filters !== undefined ||
        validated.language !== undefined ||
        validated.layout !== undefined;
      const draft = replacesAdjustment ? countAdjustment.take() : undefined;
      return applyVisualizationView(
        draft &&
          validated.filters !== undefined &&
          validated.nodesShown === undefined
          ? { ...validated, nodesShown: draft }
          : validated,
        options,
      );
    },
    async setVisualizationModes(request, { signal } = {}) {
      const ticket = lifecycle.prepare("setVisualizationModes", { signal });
      const modes = createVisualizationModesRequest(request);
      ticket.prepareScene();
      const { compactNotation, nodeScaling, colorExternals, ...nativeModes } =
        modes;
      const display = {
        ...(compactNotation === undefined ? {} : { compactNotation }),
        ...(nodeScaling === undefined
          ? {}
          : { nodeScaling: nodeScaling ? "direct-membership" : "uniform" }),
        ...(colorExternals === undefined
          ? {}
          : { externalColoring: colorExternals }),
      };
      if (Object.keys(display).length) {
        session.updateView({ display }, { renderedGraphRuntime: runtime });
      }
      ticket.accept();
      try {
        if (Object.keys(nativeModes).length) {
          await runtime.setVisualizationModes(nativeModes, {
            signal: ticket.signal,
          });
        }
        ticket.assertCurrent();
      } finally {
        if (ticket.isCurrent()) {
          publish({ view: readView() });
        }
        ticket.release();
      }
      return state;
    },
    async setForceLayoutDistances(request, { signal } = {}) {
      const ticket = lifecycle.prepare("setForceLayoutDistances", { signal });
      const validated = createForceLayoutDistancesRequest(request);
      ticket.prepareScene();
      ticket.accept();
      try {
        runtime.setForceLayoutDistances(validated);
        publish({ view: readView() });
        return state;
      } finally {
        ticket.release();
      }
    },
    async resetVisualization({ signal } = {}) {
      const ticket = lifecycle.prepare("resetVisualization", { signal });
      countAdjustment.cancel();
      ticket.prepareScene();
      const resetNodesShown = { mode: "auto" };
      const visibility = session.selectNodes(
        CANONICAL_VISIBLE_FILTERS,
        resetNodesShown,
        [],
      );
      session.updateView(
        {
          hidden: visibility.hidden.map(session.scene().reference),
          display: {
            compactNotation: false,
            nodeScaling: "direct-membership",
            externalColoring: true,
          },
        },
        { renderedGraphRuntime: runtime },
      );
      ticket.accept();
      nodesShown = resetNodesShown;
      filters = { ...CANONICAL_VISIBLE_FILTERS };
      retainedHidden = [];
      layoutIntent += 1;
      try {
        await runtime.resetVisualization({ signal: ticket.signal });
        ticket.assertCurrent();
        session.synchronizeDrawing(runtime.readCanonicalDrawingState());
      } finally {
        if (ticket.isCurrent()) {
          publish({
            view: readView(),
            nodeCountStatus: visibility.nodeCountStatus,
            ...runtime.readVisualizationViewport(),
          });
        }
        ticket.release();
      }
      return state;
    },
    resizeVisualizationViewport(request) {
      if (disposed) {
        throw new DOMException(
          "The application has been disposed.",
          "AbortError",
        );
      }
      lifecycle.retireCaptures();
      const size = createVisualizationViewportSize(request);
      const result = runtime.resizeVisualizationViewport(size);
      viewportSize = size;
      return result;
    },
    setRenderingDiagnosticsEnabled(isEnabled) {
      if (disposed) {
        throw new DOMException(
          "The application has been disposed.",
          "AbortError",
        );
      }
      if (typeof isEnabled !== "boolean") {
        throw new TypeError("Rendering diagnostics requires a boolean.");
      }
      runtime.setRenderingDiagnosticsEnabled(isEnabled);
    },
    setGraphLayoutPaused(request) {
      const ticket = lifecycle.prepare("setGraphLayoutPaused");
      const validated = createGraphLayoutPauseRequest({
        loadGeneration: ticket.identity.loadGeneration,
        isPaused: request?.isPaused,
      });
      ticket.prepareScene();
      ticket.accept();
      try {
        if (countLayoutHold) {
          countLayoutHold.requestedIsPaused = validated.isPaused;
          countLayoutHold.physicallyHeld = true;
        }
        const result = runtime.setGraphLayoutPaused(
          countLayoutHold ? { ...validated, isPaused: true } : validated,
        );
        layoutIntent += 1;
        publish({ layout: layoutState(result.layoutStatus) });
        return result;
      } finally {
        ticket.release();
      }
    },
    setContinuousZoom(request) {
      const ticket = lifecycle.prepare("setContinuousZoom");
      const validated = createContinuousZoomRequest(request);
      ticket.accept();
      try {
        return runtime.setContinuousZoom(validated);
      } finally {
        ticket.release();
      }
    },
    setOntologyEditorOptions(request) {
      const changes = createOntologyEditorOptionsRequest(request);
      runtime.setOntologyEditorOptions(changes);
      editorOptions = { ...editorOptions, ...changes };
      publish({ editorMode: { isEditorMode: editorOptions.isEditorMode } });
      return Object.freeze({ ...editorOptions });
    },
    async exportVisualization(request = {}, { signal } = {}) {
      signal?.throwIfAborted();
      await countAdjustment.flush();
      const ticket = lifecycle.prepare("exportVisualization", { signal });
      const accepted = ticket.identity;
      const { format = "vowl-json", filename } = request;
      ticket.accept();
      const combined = ticket.signal;
      const pauseSequence = layoutIntent;
      const options = {
        artifactService: artifacts,
        renderedGraphRuntime: runtime,
        filename,
        source: state.source,
        signal: combined,
      };
      try {
        combined.throwIfAborted();
        if (format === "vowl-json") {
          return await session.exportCanonicalArtifact(options);
        }
        if (format === "turtle") {
          return await session.exportTurtleArtifact(options);
        }
        return await exportCanonicalDrawing({
          runtime,
          artifacts,
          graphLayoutSettler,
          waitForDocumentFonts,
          waitForBrowserPaint,
          request: { ...request, format },
          loadGeneration: accepted.loadGeneration,
          source: state.source,
          view: state.view,
          signal: combined,
          assertCurrent: ticket.assertCurrent,
          canRestoreLayout: () =>
            ticket.isCurrent() && pauseSequence === layoutIntent,
        });
      } finally {
        ticket.release();
      }
    },
    getOriginalSources() {
      current("getOriginalSources");
      return session.originalSources();
    },
    async exportOriginalSource({ documentId, filename }, { signal } = {}) {
      const ticket = lifecycle.prepare("exportOriginalSource", { signal });
      ticket.accept();
      const combined = ticket.signal;
      try {
        combined.throwIfAborted();
        return await session.exportOriginalSourceArtifact({
          documentId,
          filename,
          signal: combined,
          artifactService: artifacts,
          source: state.source,
        });
      } finally {
        ticket.release();
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      countAdjustment.dispose();
      disposed = true;
      clearNeighborhood();
      lifecycle.dispose();
      unsubscribe();
      subscribers.clear();
      occurrenceObservers.clear();
      session.dispose();
      runtime.dispose();
      artifacts.dispose();
    },
  });
}
