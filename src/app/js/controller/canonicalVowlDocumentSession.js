import { createCanonicalVowlScene } from "./canonicalVowlScene.js";
import { readCanonicalFacts } from "./canonicalVowlFacts.js";
import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import { ownCanonicalInspection } from "./canonicalVowlInspectionOwnership.js";
import { createCanonicalVowlSemanticReadModel } from "./canonicalVowlSemanticReadModel.js";
import {
  createCanonicalVowlInspectionProjection,
  createCanonicalSemanticReferences,
} from "./canonicalVowlInspectionProjector.js";
import {
  profiles,
  compatibleArtifactProfile,
  DISPLAY_ORDER_KEY_PURPOSE,
} from "vowl";
import { deepFreezePlainData } from "./controllerDataContracts.js";
import { WebVowlOperationError } from "./webVowlControllerContracts.js";
import { createCanonicalVowlEditorView } from "./canonicalVowlEditorView.js";
import { createInitialVisualizationRequest } from "./renderedGraphRuntimeContracts.js";
import {
  CANONICAL_VISIBLE_FILTERS,
  createCanonicalNodeSelector,
  canonicalLabelSelection,
} from "./canonicalVowlViewControls.js";
import {
  prepareCanonicalPrefixChange,
  prepareCanonicalPrefixRemoval,
  resolveCanonicalEditorIri,
} from "./canonicalVowlPrefixCommands.js";

const EDITABLE_COLLECTIONS = ["subjects", "roles", "expressions", "constructs"];

function rejected(code) {
  const error = new Error(code.replaceAll("_", " ").toLowerCase());
  error.code = code;
  return error;
}

function semanticRecords(inspection) {
  return EDITABLE_COLLECTIONS.flatMap((name) => inspection.records[name]);
}

function readResult(result, revision, preview = false) {
  if (
    result.inspection?.revision !== revision ||
    result.checkpoint?.revision !== revision ||
    (!preview &&
      (result.displayOrderKeys?.revision !== revision ||
        result.displayOrderKeys.purpose !== DISPLAY_ORDER_KEY_PURPOSE))
  ) {
    throw rejected("DOCUMENT_WORKER_RESULT_INVALID");
  }
  const inspection = ownCanonicalInspection(result.inspection);
  return {
    inspection,
    checkpoint: structuredClone(result.checkpoint),
    selectNodes: createCanonicalNodeSelector(
      inspection,
      preview
        ? undefined
        : deepFreezePlainData(structuredClone(result.displayOrderKeys)),
      { preview },
    ),
  };
}

/**
 * Capture one accepted document value, not the mutable session owner. A result
 * owns one mutable copy after its first read; replacing the accessor also
 * releases its source reference. Unread fields remain assignable/deletable.
 */
function defineOwnedDocumentField(result, name, source) {
  function assign(value) {
    Object.defineProperty(this, name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  Object.defineProperty(result, name, {
    enumerable: true,
    configurable: true,
    get() {
      const value = structuredClone(source);
      assign.call(this, value);
      return value;
    },
    set: assign,
  });
}

function documentSnapshot(accepted, visualization = accepted.scene.snapshot()) {
  // A literal allocation site's cached shape can retain one of the lazy
  // getters below, including its old inspection. Use an ordinary object
  // without that allocation-site feedback; lazy ownership is unchanged.
  const result = Object.assign(Object.create(Object.prototype), {
    loadGeneration: accepted.generation,
    documentRevision: accepted.revision,
    visualization,
  });
  defineOwnedDocumentField(result, "inspection", accepted.inspection);
  defineOwnedDocumentField(result, "checkpoint", accepted.checkpoint);
  return result;
}

function projectInspection(inspection, visualization, generation, records) {
  return createCanonicalVowlInspectionProjection(inspection, {
    loadGeneration: generation,
    visualization,
    targetForRecord: (id) => ({
      loadGeneration: generation,
      recordToken: records.get(id),
    }),
  });
}

function bindDrawing(
  projection,
  inspection,
  generation,
  records,
  runtimeReferences,
) {
  const target = (id) => ({
    loadGeneration: generation,
    recordToken: records.get(id),
  });
  const semantic = createCanonicalSemanticReferences(
    inspection,
    generation,
    target,
  );
  const occurrences = new Map(
    inspection.occurrences.map((record) => [record.id, record]),
  );
  return {
    ...projection,
    applicationBindings: [
      ...projection.nodes,
      ...projection.edges,
      ...projection.labels,
    ].map((row) => {
      const occurrence = occurrences.get(row.occurrence);
      const edge =
        occurrence.kind === "label"
          ? occurrences.get(occurrence.edge)
          : occurrence;
      const ids = row.targets ?? row.records ?? [];
      const editable = edge.construct ? [edge.construct] : ids;
      return {
        occurrence: row.occurrence,
        positionable: ["class-node", "datatype-node", "label"].includes(
          occurrence.kind,
        ),
        runtimeReference: runtimeReferences.get(row.occurrence),
        semanticReferences: ids.flatMap((id) =>
          semantic.has(id) ? [semantic.get(id)] : [],
        ),
        recordTargets: editable.map(target),
      };
    }),
  };
}

/**
 * Transaction owner for a live checkpoint, editable targets and the complete scene.
 * Capture never installs its relabelled artifact as the live model. Editing
 * installs a complete successor only after scene reconciliation is accepted.
 */
export function createCanonicalVowlDocumentSession({ workerClient }) {
  let generation = 0;
  let requestSequence = 0;
  let current;
  let loading;
  let mutation;
  let disposed = false;
  let presenting = false;
  let presentationTail = Promise.resolve();
  const captures = new Set();

  function checkOpen() {
    if (disposed) {
      throw rejected("DOCUMENT_SESSION_DISPOSED");
    }
  }
  function checkNotPresenting() {
    if (presenting) {
      throw rejected("DOCUMENT_BUSY");
    }
  }
  function loaded() {
    checkOpen();
    if (!current) {
      throw rejected("NO_ONTOLOGY");
    }
    return current;
  }
  function target(id) {
    const document = loaded();
    const token = document.records.get(id);
    if (token === undefined) {
      throw rejected("DOCUMENT_TARGET_MISSING");
    }
    return Object.freeze({
      loadGeneration: document.generation,
      recordToken: token,
    });
  }
  function resolveTarget(reference) {
    const document = loaded();
    if (reference?.loadGeneration !== document.generation) {
      throw rejected("DOCUMENT_TARGET_EXPIRED");
    }
    const entry = [...document.records].find(
      ([, token]) => token === reference.recordToken,
    );
    if (!entry) {
      throw rejected("DOCUMENT_TARGET_EXPIRED");
    }
    return entry[0];
  }
  function makeOperation(signal) {
    const abort = new AbortController();
    return {
      abort,
      signal: signal ? AbortSignal.any([signal, abort.signal]) : abort.signal,
      sequence: ++requestSequence,
    };
  }
  async function exportSemanticArtifact(
    format,
    { documentId, artifactService, filename, source, signal, limits } = {},
  ) {
    const base = loaded();
    if (loading || mutation || captures.size) {
      throw rejected("DOCUMENT_BUSY");
    }
    const retainedSource = structuredClone(source);
    const operation = makeOperation(signal);
    captures.add(operation);
    try {
      const result = await workerClient.run(
        {
          operation:
            format === "turtle" ? "export-model-rdf" : "read-model-source",
          checkpoint: base.checkpoint,
          ...(format === "original-source" ? { documentId } : {}),
          limits,
        },
        {
          loadGeneration: base.generation,
          baseRevision: base.revision,
          signal: operation.signal,
        },
      );
      if (
        disposed ||
        operation.signal.aborted ||
        current !== base ||
        loading ||
        result.loadGeneration !== base.generation ||
        result.baseRevision !== base.revision
      ) {
        throw rejected("DOCUMENT_CAPTURE_SUPERSEDED");
      }
      return await artifactService.createSemanticSourceArtifact(
        {
          bytes: result.bytes,
          filename,
          source: retainedSource,
          format,
          loadGeneration: base.generation,
          scope:
            format === "turtle"
              ? result.scope
              : {
                  kind: "original-input",
                  documentId,
                  documentIri: result.documentIri,
                  mediaType: result.mediaType,
                  digest: result.digest,
                },
        },
        { signal: operation.signal },
      );
    } finally {
      captures.delete(operation);
    }
  }
  return Object.freeze({
    exportTurtleArtifact: (options) =>
      exportSemanticArtifact("turtle", options),
    exportOriginalSourceArtifact: (options) =>
      exportSemanticArtifact("original-source", options),
    target,
    resolveTarget,
    identity() {
      const accepted = loaded();
      return Object.freeze({
        loadGeneration: accepted.generation,
        documentRevision: accepted.revision,
      });
    },
    selectNodes(filters, nodesShown, hidden, options) {
      return loaded().selectNodes(filters, nodesShown, hidden, options);
    },
    nodeCountStatus() {
      return loaded().selectNodes.status();
    },
    assertNodeOrderingReady() {
      const status = loaded().selectNodes.status().orderingStatus;
      if (status === "preparing" || status === "failed") {
        throw new WebVowlOperationError({
          code:
            status === "preparing"
              ? "NODE_ORDERING_PENDING"
              : "NODE_ORDERING_UNAVAILABLE",
          message:
            status === "preparing"
              ? "Wait for node count preparation to finish."
              : "Node count preparation failed. Reload the ontology to retry.",
          isRetryable: status === "preparing",
        });
      }
    },
    inspectRecords() {
      return structuredClone(loaded().inspection);
    },
    originalSources() {
      const accepted = loaded();
      const available = new Set(
        accepted.checkpoint?.source?.sources.map(({ document }) => document) ??
          [],
      );
      return Object.freeze(
        accepted.inspection.documents.map(({ id, documentIri, mediaType }) =>
          Object.freeze({
            documentId: id,
            documentIri,
            mediaType,
            available: available.has(id),
          }),
        ),
      );
    },
    /**
     * Bind identity and scene to this instant. Inspection/checkpoint stay
     * readable but copy only on first access, once per field per result.
     * Extend this result in place: object spread would eagerly read them.
     */
    snapshot() {
      return documentSnapshot(loaded());
    },
    scene() {
      return loaded().scene;
    },
    /** Return an independently mutable copy for callers that require ownership. */
    inspectOntology() {
      return structuredClone(loaded().ontologyInspection);
    },
    /**
     * Internal readers borrow the deeply frozen projection, including retained
     * facts. Obtain it per operation: revision or presentation changes replace
     * it, while previously returned values stay immutable. No indexes escape.
     */
    readOntologyInspection() {
      return loaded().ontologyInspection;
    },
    /** Lazily bind reads to this accepted revision and immutable presentation. */
    readModel() {
      const accepted = loaded();
      // Capture values, not `accepted` or the session's dynamic target method:
      // a retained old model must neither keep its successor nor change meaning.
      if (!accepted.readModel) {
        const { generation: loadGeneration, records } = accepted;
        accepted.readModel = createCanonicalVowlSemanticReadModel({
          inspection: accepted.inspection,
          ontologyInspection: accepted.ontologyInspection,
          visualization: accepted.scene.snapshot(),
          loadGeneration,
          targetForRecord: (id) =>
            Object.freeze({
              loadGeneration,
              recordToken: records.get(id),
            }),
          selectNodes: accepted.selectNodes,
        });
      }
      return accepted.readModel;
    },
    revealNeighborhood(hidden, options = {}) {
      const accepted = loaded();
      if (options.renderedGraphRuntime) {
        this.synchronizeDrawing(
          options.renderedGraphRuntime.readCanonicalDrawingState(),
        );
      }
      const ordinaryScene = accepted.ordinaryScene ?? accepted.scene.snapshot();
      this.updateView(
        { hidden: hidden.map(accepted.scene.reference) },
        options,
      );
      accepted.ordinaryScene = ordinaryScene;
    },
    clearNeighborhood(options = {}) {
      const accepted = loaded();
      if (!accepted.ordinaryScene) {
        return false;
      }
      const ordinary = accepted.ordinaryScene;
      this.updateView(
        { ...ordinary, hidden: ordinary.hidden.map(accepted.scene.reference) },
        options,
      );
      accepted.ordinaryScene = undefined;
      return true;
    },
    hasNeighborhood() {
      return Boolean(loaded().ordinaryScene);
    },
    inspectFacts(request) {
      const accepted = loaded();
      return {
        loadGeneration: accepted.generation,
        documentRevision: accepted.revision,
        ...readCanonicalFacts(accepted.inspection, request),
      };
    },
    inspectEditor(reference) {
      const base = loaded();
      return createCanonicalVowlEditorView(
        base.inspection,
        base.scene.snapshot(),
        {
          loadGeneration: base.generation,
          selectedId:
            reference === null || reference === undefined
              ? undefined
              : resolveTarget(reference),
        },
      );
    },
    resolveEditorIri(input) {
      const base = loaded();
      return resolveCanonicalEditorIri(input, {
        prefixes: base.scene.snapshot().prefixes,
        ontologyIri: base.inspection.records.ontology.iri,
      });
    },
    setPrefix(request, options) {
      const prefixes = prepareCanonicalPrefixChange(
        loaded().scene.snapshot().prefixes,
        request,
      );
      return this.updateView({ prefixes }, options);
    },
    removePrefix(name, options) {
      const prefixes = prepareCanonicalPrefixRemoval(
        loaded().scene.snapshot().prefixes,
        name,
      );
      return this.updateView({ prefixes }, options);
    },
    updateView(changes, { renderedGraphRuntime } = {}) {
      checkNotPresenting();
      const base = loaded();
      if (loading || captures.size) {
        throw rejected("DOCUMENT_BUSY");
      }
      if (renderedGraphRuntime) {
        this.synchronizeDrawing(
          renderedGraphRuntime.readCanonicalDrawingState(),
        );
      }
      const proposal = base.scene.prepareView(changes);
      const visualization = proposal.preview();
      const projection = bindDrawing(
        createCanonicalVowlRenderProjection(base.inspection, visualization),
        base.inspection,
        base.generation,
        base.records,
        new Map(
          base.inspection.occurrences.map(({ id }) => [
            id,
            base.scene.reference(id),
          ]),
        ),
      );
      const ontologyInspection =
        changes.labelSelection !== undefined || changes.prefixes !== undefined
          ? projectInspection(
              base.inspection,
              visualization,
              base.generation,
              base.records,
            )
          : base.ontologyInspection;
      presenting = true;
      try {
        proposal.commit({
          beforeCommit: () =>
            renderedGraphRuntime?.applyCanonicalDrawingRevision({
              loadGeneration: base.generation,
              baseRevision: base.revision,
              documentRevision: base.revision,
              drawing: projection,
            }),
        });
      } finally {
        presenting = false;
      }
      // Keep this document identity stable while a worker edit is pending: its
      // later scene reconciliation must observe the newly accepted view state.
      base.ontologyInspection = ontologyInspection;
      if (
        changes.labelSelection !== undefined ||
        changes.prefixes !== undefined
      ) {
        base.readModel = undefined;
      }
      // The preview already owns the exact scene just committed. Projection
      // construction does not mutate or lend it to the renderer.
      return Object.assign(documentSnapshot(base, visualization), {
        projection,
      });
    },
    synchronizeDrawing({
      loadGeneration,
      documentRevision,
      placements,
      camera,
    }) {
      const base = loaded();
      if (
        loadGeneration !== base.generation ||
        documentRevision !== base.revision
      ) {
        throw rejected("DOCUMENT_DRAWING_EXPIRED");
      }
      base.scene.arrange(
        placements.map(({ occurrence, position, pinned }) => ({
          reference: base.scene.reference(occurrence),
          position,
          pinned,
        })),
        { camera },
      );
    },
    /** prepareProjection borrows a deeply frozen accepted inspection. */
    async load(
      request,
      {
        signal,
        resolveImport,
        center,
        suppliedPositions,
        prepareProjection = createCanonicalVowlRenderProjection,
        renderedGraphRuntime,
        initialVisualization,
        useAutomaticNodesShown = false,
        onNodeOrdering,
      } = {},
    ) {
      checkOpen();
      checkNotPresenting();
      const initial = createInitialVisualizationRequest(
        initialVisualization ?? {},
      );
      loading?.abort.abort();
      mutation?.abort.abort();
      for (const capture of captures) {
        capture.abort.abort();
      }
      const operation = makeOperation(signal);
      loading = operation;
      const loadGeneration = ++generation;
      let ordering;
      let installed = false;
      try {
        const result = await workerClient.run(request, {
          loadGeneration,
          baseRevision: 0,
          signal: operation.signal,
          resolveImport,
          deferNodeOrdering: request.operation === "open-owl-model",
        });
        if (
          disposed ||
          operation.signal.aborted ||
          loading !== operation ||
          result.loadGeneration !== loadGeneration ||
          result.baseRevision !== 0
        ) {
          throw rejected("LOAD_ABORTED");
        }
        const initialPlacementStarted = performance.now();
        ordering = result.nodeOrdering;
        if (
          ordering &&
          (request.operation !== "open-owl-model" ||
            typeof ordering.start !== "function" ||
            typeof ordering.ready?.then !== "function")
        ) {
          throw rejected("DOCUMENT_WORKER_RESULT_INVALID");
        }
        const candidate = readResult(result, 0, Boolean(ordering));
        const seedStarted = performance.now();
        const scene = createCanonicalVowlScene(
          candidate.inspection.occurrences,
          {
            loadGeneration,
            visualization: result.visualization ?? undefined,
            center,
            suppliedPositions,
            forceDistances: initial.forceDistances,
            layoutInitialTree: renderedGraphRuntime?.layoutInitialTree,
          },
        );
        const seedDuration = performance.now() - seedStarted;
        const fitInitialDrawing =
          !result.visualization &&
          !suppliedPositions?.size &&
          initial.view?.zoomScale === undefined &&
          initial.view?.translation === undefined;
        const retainedHidden = scene.snapshot().hidden;
        const {
          filters,
          nodesShown: initialNodesShown,
          language,
          ...nativeView
        } = initial.view ?? {};
        const defaultFilters = { ...CANONICAL_VISIBLE_FILTERS, ...filters };
        const appliedFilters = defaultFilters;
        const nodesShown = initialNodesShown ?? {
          mode:
            useAutomaticNodesShown || !result.visualization ? "auto" : "all",
        };
        const visibility = candidate.selectNodes(
          appliedFilters,
          nodesShown,
          retainedHidden,
        );
        const { compactNotation, nodeScaling, colorExternals, ...nativeModes } =
          initial.modes ?? {};
        const viewChanges = {
          ...(language === undefined
            ? {}
            : { labelSelection: canonicalLabelSelection(language) }),
          hidden: visibility.hidden.map(scene.reference),
          display: {
            ...(compactNotation === undefined ? {} : { compactNotation }),
            ...(nodeScaling === undefined
              ? {}
              : { nodeScaling: nodeScaling ? "direct-membership" : "uniform" }),
            ...(colorExternals === undefined
              ? {}
              : { externalColoring: colorExternals }),
          },
        };
        scene.prepareView(viewChanges).commit();
        const nativeInitial = {
          ...(Object.keys(nativeView).length ? { view: nativeView } : {}),
          ...(Object.keys(nativeModes).length ? { modes: nativeModes } : {}),
          ...(initial.forceDistances
            ? { forceDistances: initial.forceDistances }
            : {}),
        };
        const records = new Map(
          semanticRecords(candidate.inspection).map((record, index) => [
            record.id,
            index + 1,
          ]),
        );
        const preparedProjection = prepareProjection(
          candidate.inspection,
          scene.snapshot(),
        );
        const projection = bindDrawing(
          preparedProjection,
          candidate.inspection,
          loadGeneration,
          records,
          new Map(
            candidate.inspection.occurrences.map(({ id }) => [
              id,
              scene.reference(id),
            ]),
          ),
        );
        const ontologyInspection = projectInspection(
          candidate.inspection,
          scene.snapshot(),
          loadGeneration,
          records,
        );
        const initialLayout =
          initial.view?.layout ?? (result.visualization ? "pause" : "resume");
        const checkCurrent = () => {
          if (disposed || operation.signal.aborted || loading !== operation) {
            throw rejected("LOAD_ABORTED");
          }
        };
        // Serialize presentation, including recovery. An obsolete candidate's
        // recovery must finish before the next load can install its drawing.
        const acceptance = presentationTail.then(async () => {
          checkCurrent();
          if (renderedGraphRuntime) {
            let previous;
            const previousView = Object.keys(nativeInitial).length
              ? renderedGraphRuntime.readVisualizationView()
              : undefined;
            if (current) {
              this.synchronizeDrawing(
                renderedGraphRuntime.readCanonicalDrawingState(),
              );
              previous = {
                loadGeneration: current.generation,
                documentRevision: current.revision,
                drawing: bindDrawing(
                  createCanonicalVowlRenderProjection(
                    current.inspection,
                    current.scene.snapshot(),
                  ),
                  current.inspection,
                  current.generation,
                  current.records,
                  new Map(
                    current.inspection.occurrences.map(({ id }) => [
                      id,
                      current.scene.reference(id),
                    ]),
                  ),
                ),
                layout: renderedGraphRuntime.readGraphLayoutSnapshot().isPaused
                  ? "pause"
                  : "resume",
                ...(previousView
                  ? {
                      initialVisualization: {
                        view: { focus: previousView.focus },
                        modes: previousView.modes,
                        forceDistances: previousView.forceDistances,
                      },
                    }
                  : {}),
              };
            }
            try {
              await renderedGraphRuntime.replaceCanonicalDrawing(
                {
                  loadGeneration,
                  documentRevision: 0,
                  drawing: projection,
                  layout: initialLayout,
                  ...(fitInitialDrawing ? { fitInitialDrawing: true } : {}),
                  ...(Object.keys(nativeInitial).length
                    ? { initialVisualization: nativeInitial }
                    : {}),
                },
                { signal: operation.signal },
              );
              checkCurrent();
              if (fitInitialDrawing || Object.keys(nativeInitial).length) {
                const observed =
                  renderedGraphRuntime.readCanonicalDrawingState();
                scene.arrange(
                  observed.placements.map(
                    ({ occurrence, position, pinned }) => ({
                      reference: scene.reference(occurrence),
                      position,
                      pinned,
                    }),
                  ),
                  { camera: observed.camera },
                );
                projection.camera = structuredClone(observed.camera);
              }
              performance.clearMeasures("webvowl.initial-placement");
              performance.measure("webvowl.initial-placement", {
                start: seedStarted,
                duration: seedDuration,
                detail: { loadGeneration },
              });
              performance.clearMeasures("webvowl.initial-usable-drawing");
              performance.measure("webvowl.initial-usable-drawing", {
                start: initialPlacementStarted,
                end: performance.now(),
                detail: {
                  loadGeneration,
                  layout: initialLayout,
                  fitInitialDrawing,
                },
              });
            } catch (error) {
              try {
                if (previous && !disposed) {
                  await renderedGraphRuntime.replaceCanonicalDrawing(previous);
                } else {
                  renderedGraphRuntime.clearRenderedGraph();
                  if (previousView && !disposed) {
                    await renderedGraphRuntime.setVisualizationModes(
                      previousView.modes,
                    );
                    renderedGraphRuntime.setForceLayoutDistances(
                      previousView.forceDistances,
                    );
                  }
                }
                if (disposed) {
                  renderedGraphRuntime.clearRenderedGraph();
                }
              } catch (recoveryError) {
                const failure = new AggregateError(
                  [error, recoveryError],
                  "Document presentation and recovery both failed.",
                );
                failure.code = "DOCUMENT_PRESENTATION_RECOVERY_FAILED";
                throw failure;
              }
              throw error;
            }
          }
          checkCurrent();
          current?.orderingOperation?.abort.abort();
          current = {
            ...candidate,
            generation: loadGeneration,
            revision: 0,
            scene,
            records,
            nextRecordToken: records.size,
            ontologyInspection,
            ...(ordering ? { orderingOperation: operation } : {}),
          };
          installed = true;
          if (ordering) {
            const owner = current;
            const finish = (outcome) => {
              if (disposed || current !== owner) {
                return;
              }
              let nodeCountStatus;
              try {
                if (outcome.error) {
                  throw outcome.error;
                }
                const keys = outcome.displayOrderKeys;
                if (
                  keys?.revision !== owner.revision ||
                  keys?.purpose !== DISPLAY_ORDER_KEY_PURPOSE
                ) {
                  throw rejected("DOCUMENT_WORKER_RESULT_INVALID");
                }
                nodeCountStatus = owner.selectNodes.completeOrdering(
                  deepFreezePlainData(structuredClone(keys)),
                );
              } catch {
                nodeCountStatus = owner.selectNodes.failOrdering();
              }
              owner.orderingOperation = undefined;
              owner.readModel = undefined;
              onNodeOrdering?.({
                loadGeneration,
                documentRevision: owner.revision,
                nodeCountStatus,
              });
            };
            void ordering.ready.then(finish, (error) => finish({ error }));
            ordering.start();
          }
          return Object.assign(this.snapshot(), {
            projection,
            initialLayout,
            retainedHidden,
            appliedFilters,
            nodesShown,
            nodeCountStatus: visibility.nodeCountStatus,
            diagnostics: structuredClone([
              ...candidate.inspection.diagnostics,
              ...(result.diagnostics ?? []),
            ]),
          });
        });
        // This tail serializes presentation only. Keeping the accepted result
        // would retain its unread document fields after the next edit retires it.
        presentationTail = acceptance.then(
          () => {},
          () => {},
        );
        return await acceptance;
      } finally {
        if (!installed) {
          operation.abort.abort();
        }
        if (loading === operation) {
          loading = undefined;
        }
      }
    },
    /**
     * Projection, visibility and supplied-position preparation borrow the frozen
     * candidate inspection. Authorization/reconciliation keep owned UI copies.
     */
    async edit(
      changes,
      {
        signal,
        limits,
        reconcile,
        authorize,
        center,
        suppliedPositions,
        prepareVisibility,
        prepareProjection = createCanonicalVowlRenderProjection,
        renderedGraphRuntime,
      } = {},
    ) {
      const base = loaded();
      if (mutation || loading || captures.size) {
        throw rejected("DOCUMENT_BUSY");
      }
      const operation = makeOperation(signal);
      mutation = operation;
      try {
        const result = await workerClient.run(
          {
            operation: "edit-model",
            checkpoint: base.checkpoint,
            changes,
            limits,
          },
          {
            loadGeneration: base.generation,
            baseRevision: base.revision,
            signal: operation.signal,
          },
        );
        function checkCurrent() {
          if (
            disposed ||
            operation.signal.aborted ||
            current !== base ||
            mutation !== operation ||
            loading ||
            result.loadGeneration !== base.generation ||
            result.baseRevision !== base.revision
          ) {
            throw rejected("DOCUMENT_EDIT_SUPERSEDED");
          }
        }
        checkCurrent();
        const candidate = readResult(result, base.revision + 1);
        if (authorize) {
          const accepted = await authorize(
            {
              inspection: structuredClone(candidate.inspection),
              correspondence: structuredClone(result.correspondence),
            },
            { signal: operation.signal },
          );
          checkCurrent();
          if (accepted !== true) {
            throw rejected("DOCUMENT_EDIT_CANCELLED");
          }
        }
        const nextRecords = new Map();
        const newIds = new Set(
          semanticRecords(candidate.inspection).map(({ id }) => id),
        );
        const seen = new Set();
        for (const { previous, current: next } of result.correspondence) {
          if (!base.records.has(previous)) {
            continue;
          }
          if (seen.has(previous) || (next !== null && !newIds.has(next))) {
            throw rejected("DOCUMENT_CORRESPONDENCE_INVALID");
          }
          seen.add(previous);
          if (next !== null) {
            nextRecords.set(
              next,
              Math.min(
                base.records.get(previous),
                nextRecords.get(next) ?? Infinity,
              ),
            );
          }
        }
        if (seen.size !== base.records.size) {
          throw rejected("DOCUMENT_CORRESPONDENCE_INVALID");
        }
        let nextRecordToken = base.nextRecordToken;
        for (const id of newIds) {
          if (!nextRecords.has(id)) {
            nextRecords.set(id, ++nextRecordToken);
          }
        }
        // Expensive worker work has finished: reconcile against the latest
        // drag/pin state, not the scene that existed when the edit was submitted.
        const proposal = base.scene.prepareEdit(
          {
            occurrences: candidate.inspection.occurrences,
            correspondence: result.correspondence,
          },
          {
            center,
            hidden: prepareVisibility?.(candidate.inspection, {
              correspondence: structuredClone(result.correspondence),
              selectNodes: candidate.selectNodes,
            }),
            suppliedPositions:
              typeof suppliedPositions === "function"
                ? suppliedPositions(candidate.inspection, {
                    correspondence: structuredClone(result.correspondence),
                  })
                : suppliedPositions,
          },
        );
        let choices = new Map();
        if (proposal.conflicts.length > 0) {
          if (typeof reconcile !== "function") {
            throw rejected("DOCUMENT_MERGE_REQUIRES_CHOICE");
          }
          choices = await reconcile(proposal.conflicts, {
            inspection: structuredClone(candidate.inspection),
            visualization: proposal.preview(
              new Map(
                proposal.conflicts.map((conflict) => [
                  conflict.occurrence,
                  conflict.choices[0].reference,
                ]),
              ),
            ),
            previous: {
              inspection: structuredClone(base.inspection),
              visualization: base.scene.snapshot(),
              references: base.inspection.occurrences.map(({ id }) => ({
                occurrence: id,
                reference: base.scene.reference(id),
              })),
            },
            signal: operation.signal,
          });
          if (choices === null) {
            throw rejected("DOCUMENT_EDIT_CANCELLED");
          }
        }
        checkCurrent();
        const acceptedChoices = structuredClone(choices);
        // Inspection/render projection failures must precede any live mutation.
        const preparedProjection = prepareProjection(
          candidate.inspection,
          proposal.preview(acceptedChoices),
          { correspondence: structuredClone(result.correspondence) },
        );
        const projection = bindDrawing(
          preparedProjection,
          candidate.inspection,
          base.generation,
          nextRecords,
          proposal.previewReferences(acceptedChoices),
        );
        const ontologyInspection = projectInspection(
          candidate.inspection,
          proposal.preview(acceptedChoices),
          base.generation,
          nextRecords,
        );
        checkCurrent();
        // All worker work and scene validation precede the native synchronous
        // revision. Its failure restores the prior drawing and leaves the
        // accepted document, scene and editable targets untouched.
        presenting = true;
        try {
          proposal.commit(acceptedChoices, {
            beforeCommit: () => {
              renderedGraphRuntime?.applyCanonicalDrawingRevision({
                loadGeneration: base.generation,
                baseRevision: base.revision,
                documentRevision: candidate.inspection.revision,
                drawing: projection,
              });
            },
          });
        } finally {
          presenting = false;
        }
        base.orderingOperation?.abort.abort();
        current = {
          ...base,
          ...candidate,
          records: nextRecords,
          nextRecordToken,
          revision: base.revision + 1,
          ontologyInspection,
          readModel: undefined,
          ordinaryScene: undefined,
          orderingOperation: undefined,
        };
        return Object.assign(this.snapshot(), {
          projection,
          correspondence: structuredClone(result.correspondence),
          created: [...result.created],
        });
      } finally {
        if (mutation === operation) {
          mutation = undefined;
        }
      }
    },
    async exportCanonicalArtifact({
      artifactService,
      renderedGraphRuntime,
      filename,
      source,
      signal,
      limits,
    } = {}) {
      const base = loaded();
      signal?.throwIfAborted();
      if (typeof artifactService?.createCanonicalVowlArtifact !== "function") {
        throw new TypeError(
          "Canonical export requires the artifact publication service.",
        );
      }
      const retainedSource = structuredClone(source);
      if (renderedGraphRuntime) {
        this.synchronizeDrawing(
          renderedGraphRuntime.readCanonicalDrawingState(),
        );
      }
      const bytes = await this.capture({ signal, limits });
      if (
        disposed ||
        current !== base ||
        loading ||
        mutation ||
        captures.size
      ) {
        throw rejected("DOCUMENT_CAPTURE_SUPERSEDED");
      }
      // Retain cancellation ownership through hashing and publication, not just
      // through worker encoding. A replacing load may abort either phase.
      const operation = makeOperation(signal);
      captures.add(operation);
      try {
        return await artifactService.createCanonicalVowlArtifact(
          {
            bytes,
            filename,
            source: retainedSource,
            loadGeneration: base.generation,
          },
          { signal: operation.signal },
        );
      } finally {
        captures.delete(operation);
      }
    },
    async capture({ signal, limits, profile } = {}) {
      const base = loaded();
      profile ??=
        base.inspection.origin.kind === "owl" ||
        base.inspection.origin.profile === compatibleArtifactProfile
          ? compatibleArtifactProfile
          : profiles.artifact;
      if (loading || mutation || captures.size) {
        throw rejected("DOCUMENT_BUSY");
      }
      const operation = makeOperation(signal);
      captures.add(operation);
      try {
        const result = await workerClient.run(
          {
            operation: "capture-model",
            checkpoint: base.checkpoint,
            profile,
            ...(profile === profiles.structuralContent
              ? {}
              : {
                  visualization: structuredClone(
                    base.ordinaryScene ?? base.scene.snapshot(),
                  ),
                }),
            limits,
          },
          {
            loadGeneration: base.generation,
            baseRevision: base.revision,
            signal: operation.signal,
          },
        );
        if (
          disposed ||
          operation.signal.aborted ||
          current !== base ||
          loading ||
          result.loadGeneration !== base.generation ||
          result.baseRevision !== base.revision
        ) {
          throw rejected("DOCUMENT_CAPTURE_SUPERSEDED");
        }
        return result.bytes.slice();
      } finally {
        captures.delete(operation);
      }
    },
    dispose() {
      checkNotPresenting();
      disposed = true;
      loading?.abort.abort();
      current?.orderingOperation?.abort.abort();
      mutation?.abort.abort();
      for (const capture of captures) {
        capture.abort.abort();
      }
      workerClient.dispose();
      current = undefined;
    },
  });
}
