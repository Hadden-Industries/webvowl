import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { exportCanonicalDrawing } from "./canonicalVowlDrawingExport.js";
import { createCanonicalVowlWorkerClient } from "./canonicalVowlWorkerClient.js";
import {
  canonicalFailureDetails,
  canonicalLoadingMessage,
} from "./canonicalVowlFailure.js";
import { createCanonicalVowlSourceAcquisition } from "./canonicalVowlSourceAcquisition.js";
import { applyCanonicalEditorCommand } from "./canonicalVowlEditorCommands.js";
import { createOntologyInspector } from "./ontologyInspector.js";
import { createCanonicalSemanticReferences } from "./canonicalVowlInspectionProjector.js";
import { createVisualizationShareLink } from "./visualizationShareLink.js";
import {
  CANONICAL_VISIBLE_FILTERS,
  canonicalLabelSelection,
  prepareCanonicalVisibility,
} from "./canonicalVowlViewControls.js";
import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import {
  createVisualizationViewApplicationRequest,
  createVisualizationModesRequest,
  createInitialVisualizationRequest,
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
  editorMode: null,
  renderingStatistics: null,
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
} = {}) {
  let state = createWebVowlControllerState(idle);
  let disposed = false;
  let pendingLoad;
  let loadSequence = 0;
  let retainedState = state;
  let activeExport;
  let layoutIntent = 0;
  let viewportSize;
  const edits = new Set();
  let filters = { ...CANONICAL_VISIBLE_FILTERS };
  let retainedHidden = [];
  let nodesShown = { mode: "auto" };
  let viewSequence = 0;
  let pendingView;
  let revealCache;
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
  function readView() {
    return {
      ...runtime.readVisualizationView(),
      filters: { ...filters },
      nodesShown: { ...nodesShown },
    };
  }
  let editorOptions = { ...DEFAULT_ONTOLOGY_EDITOR_OPTIONS };
  const subscribers = new Set();
  function publish(changes) {
    if (disposed) {
      return;
    }
    const previous = state;
    state = createWebVowlControllerState({ ...state, ...changes });
    if (!pendingLoad) {
      retainedState = state;
    }
    const fields = Object.freeze(
      Object.keys(changes).filter(
        (key) => JSON.stringify(previous[key]) !== JSON.stringify(state[key]),
      ),
    );
    for (const subscriber of [...subscribers]) {
      subscriber(state, fields);
    }
  }
  function current() {
    if (disposed) {
      throw new WebVowlOperationError({
        code: "LOAD_ABORTED",
        message: "The application has been disposed.",
      });
    }
    if (pendingLoad) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message: "Wait for the current document load to finish.",
      });
    }
    return session.identity();
  }
  function snapshots() {
    current();
    return {
      ontologyInspectionSnapshot: session.inspectOntology(),
      visibleRenderedGraphSnapshot: runtime.readVisibleRenderedGraphSnapshot(),
    };
  }
  function editorRequest(request, allowed) {
    const accepted = current();
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
    revealCache = undefined;
    pendingView?.abort();
    pendingView = undefined;
    viewSequence += 1;
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
    const accepted = current();
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
    activeExport?.abort();
    const sequence = loadSequence;
    const owner = new AbortController();
    edits.add(owner);
    const combined = signal
      ? AbortSignal.any([signal, owner.signal])
      : owner.signal;
    try {
      const result = await applyCanonicalEditorCommand(
        session,
        {
          documentRevision: accepted.documentRevision,
          ...intent,
        },
        {
          renderedGraphRuntime: runtime,
          signal: combined,
          reconcile: reconcileScene,
          confirmDeletion: requestOntologyDeletionConfirmation,
          confirmInverseDetachment: requestInverseDetachmentConfirmation,
          prepareVisibility(inspection, { correspondence, selectNodes }) {
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
      if (disposed || sequence !== loadSequence) {
        throw new DOMException("The edit was superseded.", "AbortError");
      }
      return acceptRevision(result, selectionTargets);
    } catch (cause) {
      throw new WebVowlOperationError({
        code: "EDIT_REJECTED",
        message: cause.message,
        details: { reason: cause.code },
        cause,
      });
    } finally {
      edits.delete(owner);
    }
  }
  function observe(promise) {
    const sequence = loadSequence;
    void promise.catch((error) => {
      if (!disposed && sequence === loadSequence && !pendingLoad) {
        publish({ error: toPublicWebVowlError(error) });
      }
    });
  }
  async function createFromGesture(payload) {
    const accepted = current();
    const inspection = session.inspectRecords();
    if (payload.documentRevision !== accepted.documentRevision) {
      throw new Error("The creation gesture belongs to an earlier revision.");
    }
    if (typeof requestOntologyCreation !== "function") {
      throw new Error("Semantic creation input is unavailable.");
    }
    const owner = new AbortController();
    edits.add(owner);
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
        { signal: owner.signal },
      );
      owner.signal.throwIfAborted();
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
        { signal: owner.signal },
      );
    } finally {
      edits.delete(owner);
    }
  }
  let selectedEditorOccurrence;
  const unsubscribe = runtime.subscribeToRenderedGraphEvents((event) => {
    if (
      disposed ||
      pendingLoad ||
      event.loadGeneration !== state.loadGeneration
    ) {
      return;
    }
    const payload = event.payload;
    switch (event.kind) {
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
          view: {
            ...payload.appliedVisualizationView,
            filters: { ...filters },
          },
        });
        break;
      case "editor-mode-changed":
        publish({ editorMode: payload });
        break;
      case "rendering-statistics-changed":
        publish({ renderingStatistics: payload });
        break;
      case "graph-layout-state-changed":
        publish({
          layout: {
            status: payload.isPaused
              ? "paused"
              : payload.hasEnded
                ? "settled"
                : "relaxing",
          },
        });
        break;
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
  return Object.freeze({
    getState: () => state,
    subscribeToState(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("A state subscriber must be a function.");
      }
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    async loadOntology(
      { source },
      { signal, initialVisualization, useAutomaticNodesShown } = {},
    ) {
      const initial = createInitialVisualizationRequest(
        initialVisualization ?? {},
      );
      if (disposed) {
        throw new WebVowlOperationError({
          code: "LOAD_ABORTED",
          message: "The application has been disposed.",
        });
      }
      const retained = structuredClone(source);
      revealCache = undefined;
      loadSequence += 1;
      pendingView?.abort();
      viewSequence += 1;
      activeExport?.abort();
      for (const edit of edits) {
        edit.abort();
      }
      pendingLoad?.abort();
      const owner = new AbortController();
      pendingLoad = owner;
      const combined = signal
        ? AbortSignal.any([signal, owner.signal])
        : owner.signal;
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
        if (pendingLoad !== owner) {
          throw new DOMException("The load was superseded.", "AbortError");
        }
        pendingLoad = undefined;
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
        if (pendingLoad === owner) {
          pendingLoad = undefined;
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
      }
    },
    getOntologyEditorView(target) {
      current();
      return session.inspectEditor(target);
    },
    resolveOntologyEditorIri(value) {
      current();
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
      signal?.throwIfAborted();
      activeExport?.abort();
      const { loadGeneration, documentRevision, ...prefix } = request;
      void loadGeneration;
      void documentRevision;
      return acceptRevision(
        session.setPrefix(prefix, { renderedGraphRuntime: runtime }),
      );
    },
    removeOntologyPrefix(request, { signal } = {}) {
      editorRequest(request, ["name"]);
      signal?.throwIfAborted();
      activeExport?.abort();
      return acceptRevision(
        session.removePrefix(request.name, { renderedGraphRuntime: runtime }),
      );
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
      current();
      const retained = readUpstreamHidden();
      const signature = JSON.stringify([session.identity(), filters, retained]);
      if (revealCache?.signature !== signature) {
        const inspection = session.inspectRecords();
        const references = createCanonicalSemanticReferences(
          inspection,
          state.loadGeneration,
          session.target,
        );
        const visibility = session.selectNodes(filters, nodesShown, retained, {
          measure: false,
        });
        const ranks = new Map(
          visibility.rankedNodeOccurrenceIds.map((id, index) => [
            id,
            index + 1,
          ]),
        );
        const upstream = new Set(
          prepareCanonicalVisibility(inspection, filters, retained).hidden,
        );
        const projection = createCanonicalVowlRenderProjection(
          inspection,
          session.scene().snapshot(),
        );
        const requiredByOccurrence = new Map(
          projection.nodes.map((row) => [
            row.occurrence,
            ranks.get(row.occurrence),
          ]),
        );
        for (const edge of projection.edges) {
          const ends = [ranks.get(edge.from), ranks.get(edge.to)];
          if (ends.every((rank) => rank !== undefined)) {
            requiredByOccurrence.set(edge.occurrence, Math.max(...ends));
          }
        }
        for (const label of projection.labels) {
          requiredByOccurrence.set(
            label.occurrence,
            requiredByOccurrence.get(label.edge),
          );
        }
        const byElement = new Map();
        for (const row of [
          ...projection.nodes,
          ...projection.edges,
          ...projection.labels,
        ]) {
          const rank = requiredByOccurrence.get(row.occurrence);
          if (rank === undefined || upstream.has(row.occurrence)) {
            continue;
          }
          for (const id of row.targets ?? row.records ?? []) {
            const reference = references.get(id);
            if (reference) {
              const key = ontologyElementReferenceKey(reference);
              byElement.set(
                key,
                Math.min(byElement.get(key) ?? Infinity, rank),
              );
            }
          }
        }
        revealCache = { signature, byElement };
      }
      const requested = new Set(
        ontologyElementReferences.map(ontologyElementReferenceKey),
      );
      let requestedCount = state.nodeCountStatus.shownNodeCount;
      const matched = new Set();
      for (const key of requested) {
        const rank = revealCache.byElement.get(key);
        if (rank !== undefined) {
          matched.add(key);
          requestedCount = Math.max(requestedCount, rank);
        }
      }
      return Object.freeze({
        canReveal: matched.size === requested.size && requested.size > 0,
        requestedCount,
      });
    },
    async revealOntologyElements({ ontologyElementReferences }, options) {
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
      return inspector.findOntologyElements({
        ...snapshots(),
        ...request,
        language: state.view?.language,
      });
    },
    describeOntologyElements(request) {
      return inspector.describeOntologyElements({
        ...snapshots(),
        ...request,
        language: state.view?.language,
      });
    },
    getOntologyFacts(request) {
      if (disposed || pendingLoad) {
        throw new WebVowlOperationError({
          code: "LOAD_ABORTED",
          message: "Wait for the current document load to finish.",
        });
      }
      return session.inspectFacts(request);
    },
    getOntologyEditorOptions: () =>
      Object.freeze({ ...editorOptions, ...ONTOLOGY_CREATION_TYPES }),
    getVisualizationFocus() {
      const focus =
        disposed || pendingLoad || state.status === "idle"
          ? []
          : (state.view?.focus ?? []);
      const resolved = focus.length
        ? inspector.resolveFocusableOntologyElementReferences({
            ...snapshots(),
            ontologyElementReferences: focus,
          })
        : { focusableReferences: [] };
      return Object.freeze({
        focus: Object.freeze([...focus]),
        focusableElementCount: resolved.focusableReferences.length,
      });
    },
    getVisualizationShareLink(request = {}) {
      const accepted = current();
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
          { ...state, ...runtime.readVisualizationViewport() },
          request.presentation,
        ),
      });
    },
    getVisualizationArrangement(request = {}) {
      const accepted = current();
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
        const inspection = session.inspectOntology();
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
      const accepted = current();
      const validated = createRenderedArrangementRequest(request);
      signal?.throwIfAborted();
      activeExport?.abort();
      const sequence = loadSequence;
      const result = await runtime.setRenderedArrangement(validated, {
        signal,
      });
      if (disposed || sequence !== loadSequence) {
        throw new DOMException("The arrangement was superseded.", "AbortError");
      }
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
    },
    async selectVisualizationElement(request, { signal } = {}) {
      current();
      signal?.throwIfAborted();
      runtime.selectRenderedOccurrence(
        createRenderedOccurrenceSelectionRequest(request),
      );
      return state;
    },
    async setVisualizationView(request, { signal } = {}) {
      const startedAt = performance.now();
      const accepted = current();
      const validated = createVisualizationViewApplicationRequest({
        ...request,
        loadGeneration: accepted.loadGeneration,
      });
      signal?.throwIfAborted();
      activeExport?.abort();
      const sequence = loadSequence;
      const {
        filters: changes,
        nodesShown: requestedNodesShown,
        language,
        ...nativeView
      } = validated;
      const nextNodesShown = requestedNodesShown ?? nodesShown;
      // Validate references before changing the scene; determine visibility afterwards.
      if (nativeView.focus !== undefined) {
        inspector.resolveFocusableOntologyElementReferences({
          ...snapshots(),
          ontologyElementReferences: nativeView.focus,
        });
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
      const viewRevision = ++viewSequence;
      pendingView?.abort();
      const owner = new AbortController();
      pendingView = owner;
      const viewSignal = signal
        ? AbortSignal.any([signal, owner.signal])
        : owner.signal;
      if (Object.keys(viewChanges).length) {
        publish({
          view: readView(),
          ...(visibility
            ? { nodeCountStatus: visibility.nodeCountStatus }
            : {}),
        });
      }
      if (nativeView.focus !== undefined) {
        const resolution = inspector.resolveFocusableOntologyElementReferences({
          ...snapshots(),
          ontologyElementReferences: nativeView.focus,
        });
        nativeView.focus = [...resolution.focusableReferences];
      }
      if (nativeView.layout !== undefined) {
        layoutIntent += 1;
      }
      try {
        await runtime.applyVisualizationView(nativeView, {
          signal: viewSignal,
        });
        if (
          disposed ||
          sequence !== loadSequence ||
          viewRevision !== viewSequence ||
          session.identity().documentRevision !== accepted.documentRevision ||
          viewSignal.aborted
        ) {
          throw new DOMException("The view was superseded.", "AbortError");
        }
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
        if (
          previousScene &&
          !disposed &&
          sequence === loadSequence &&
          viewRevision === viewSequence &&
          session.identity().documentRevision === accepted.documentRevision
        ) {
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
        if (
          !disposed &&
          sequence === loadSequence &&
          viewRevision === viewSequence &&
          session.identity().documentRevision === accepted.documentRevision
        ) {
          pendingView = undefined;
          publish({
            view: readView(),
            ...(visibility
              ? {
                  nodeCountStatus: visibility.nodeCountStatus,
                }
              : {}),
          });
        }
      }
      return state;
    },
    async setVisualizationModes(request, { signal } = {}) {
      current();
      const modes = createVisualizationModesRequest(request);
      signal?.throwIfAborted();
      activeExport?.abort();
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
      const sequence = loadSequence;
      try {
        if (Object.keys(nativeModes).length) {
          await runtime.setVisualizationModes(nativeModes, { signal });
        }
        if (disposed || sequence !== loadSequence) {
          throw new DOMException("The display was superseded.", "AbortError");
        }
      } finally {
        if (!disposed && sequence === loadSequence) {
          publish({ view: readView() });
        }
      }
      return state;
    },
    async setForceLayoutDistances(request, { signal } = {}) {
      current();
      signal?.throwIfAborted();
      activeExport?.abort();
      runtime.setForceLayoutDistances(request);
      publish({ view: readView() });
      return state;
    },
    async resetVisualization({ signal } = {}) {
      current();
      signal?.throwIfAborted();
      activeExport?.abort();
      const sequence = loadSequence;
      const viewRevision = ++viewSequence;
      pendingView?.abort();
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
      nodesShown = resetNodesShown;
      filters = { ...CANONICAL_VISIBLE_FILTERS };
      retainedHidden = [];
      layoutIntent += 1;
      try {
        await runtime.resetVisualization({ signal });
        if (
          disposed ||
          sequence !== loadSequence ||
          viewRevision !== viewSequence
        ) {
          throw new DOMException("The reset was superseded.", "AbortError");
        }
        session.synchronizeDrawing(runtime.readCanonicalDrawingState());
      } finally {
        if (
          !disposed &&
          sequence === loadSequence &&
          viewRevision === viewSequence
        ) {
          publish({
            view: readView(),
            nodeCountStatus: visibility.nodeCountStatus,
            ...runtime.readVisualizationViewport(),
          });
        }
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
      activeExport?.abort();
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
      const accepted = current();
      const result = runtime.setGraphLayoutPaused({
        loadGeneration: accepted.loadGeneration,
        isPaused: request?.isPaused,
      });
      layoutIntent += 1;
      activeExport?.abort();
      publish({ layout: { status: result.layoutStatus } });
      return result;
    },
    setContinuousZoom(request) {
      current();
      activeExport?.abort();
      return runtime.setContinuousZoom(request);
    },
    setOntologyEditorOptions(request) {
      const changes = createOntologyEditorOptionsRequest(request);
      runtime.setOntologyEditorOptions(changes);
      editorOptions = { ...editorOptions, ...changes };
      publish({ editorMode: { isEditorMode: editorOptions.isEditorMode } });
      return Object.freeze({ ...editorOptions });
    },
    async exportVisualization(request = {}, { signal } = {}) {
      const accepted = current();
      const { format = "vowl-json", filename } = request;
      if (activeExport) {
        throw new WebVowlOperationError({
          code: "EXPORT_FAILED",
          message: "An export is already in progress.",
        });
      }
      const owner = new AbortController();
      activeExport = owner;
      const combined = signal
        ? AbortSignal.any([signal, owner.signal])
        : owner.signal;
      const sequence = loadSequence;
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
          assertCurrent() {
            if (
              disposed ||
              sequence !== loadSequence ||
              session.identity().documentRevision !== accepted.documentRevision
            ) {
              throw new DOMException(
                "The export was superseded.",
                "AbortError",
              );
            }
          },
          canRestoreLayout: () =>
            !disposed &&
            sequence === loadSequence &&
            pauseSequence === layoutIntent,
        });
      } finally {
        if (activeExport === owner) {
          activeExport = undefined;
        }
      }
    },
    getOriginalSources() {
      current();
      return session.originalSources();
    },
    async exportOriginalSource({ documentId, filename }, { signal } = {}) {
      current();
      if (activeExport) {
        throw new WebVowlOperationError({
          code: "EXPORT_FAILED",
          message: "An export is already in progress.",
        });
      }
      const owner = new AbortController();
      activeExport = owner;
      const combined = signal
        ? AbortSignal.any([signal, owner.signal])
        : owner.signal;
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
        if (activeExport === owner) {
          activeExport = undefined;
        }
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      revealCache = undefined;
      viewSequence += 1;
      pendingView?.abort();
      activeExport?.abort();
      for (const edit of edits) {
        edit.abort();
      }
      pendingLoad?.abort();
      unsubscribe();
      subscribers.clear();
      session.dispose();
      runtime.dispose();
      artifacts.dispose();
    },
  });
}
