import { createCanonicalVowlScene } from "./canonicalVowlScene.js";
import { readCanonicalFacts } from "./canonicalVowlFacts.js";
import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import {
  createCanonicalVowlInspectionProjection,
  createCanonicalSemanticReferences,
} from "./canonicalVowlInspectionProjector.js";
import { profiles, compatibleArtifactProfile } from "vowl";
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

function readResult(result, revision) {
  if (
    result.inspection?.revision !== revision ||
    result.checkpoint?.revision !== revision
  ) {
    throw rejected("DOCUMENT_WORKER_RESULT_INVALID");
  }
  return {
    inspection: structuredClone(result.inspection),
    checkpoint: structuredClone(result.checkpoint),
    selectNodes: createCanonicalNodeSelector(
      result.inspection,
      result.rankingIdentity,
    ),
  };
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
    selectNodes(filters, nodesShown, hidden) {
      return loaded().selectNodes(filters, nodesShown, hidden);
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
    snapshot() {
      const accepted = loaded();
      return {
        loadGeneration: accepted.generation,
        documentRevision: accepted.revision,
        inspection: structuredClone(accepted.inspection),
        checkpoint: structuredClone(accepted.checkpoint),
        visualization: accepted.scene.snapshot(),
      };
    },
    scene() {
      return loaded().scene;
    },
    inspectOntology() {
      return structuredClone(loaded().ontologyInspection);
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
      const ontologyInspection = projectInspection(
        base.inspection,
        visualization,
        base.generation,
        base.records,
      );
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
      return { ...this.snapshot(), projection };
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
      try {
        const result = await workerClient.run(request, {
          loadGeneration,
          baseRevision: 0,
          signal: operation.signal,
          resolveImport,
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
        const candidate = readResult(result, 0);
        const scene = createCanonicalVowlScene(
          candidate.inspection.occurrences,
          {
            loadGeneration,
            visualization: result.visualization ?? undefined,
            center,
            suppliedPositions,
          },
        );
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
          structuredClone(candidate.inspection),
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
                  ...(Object.keys(nativeInitial).length
                    ? { initialVisualization: nativeInitial }
                    : {}),
                },
                { signal: operation.signal },
              );
              checkCurrent();
              if (Object.keys(nativeInitial).length) {
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
          current = {
            ...candidate,
            generation: loadGeneration,
            revision: 0,
            scene,
            records,
            nextRecordToken: records.size,
            ontologyInspection,
          };
          return {
            ...this.snapshot(),
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
          };
        });
        presentationTail = acceptance.catch(() => {});
        return await acceptance;
      } finally {
        if (loading === operation) {
          loading = undefined;
        }
      }
    },
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
            hidden: prepareVisibility?.(structuredClone(candidate.inspection), {
              correspondence: structuredClone(result.correspondence),
              selectNodes: candidate.selectNodes,
            }),
            suppliedPositions:
              typeof suppliedPositions === "function"
                ? suppliedPositions(structuredClone(candidate.inspection), {
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
          structuredClone(candidate.inspection),
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
        current = {
          ...base,
          ...candidate,
          records: nextRecords,
          nextRecordToken,
          revision: base.revision + 1,
          ontologyInspection,
        };
        return {
          ...this.snapshot(),
          projection,
          correspondence: structuredClone(result.correspondence),
          created: [...result.created],
        };
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
              : { visualization: base.scene.snapshot() }),
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
      mutation?.abort.abort();
      for (const capture of captures) {
        capture.abort.abort();
      }
      workerClient.dispose();
      current = undefined;
    },
  });
}
