import { createCanonicalVowlScene } from "./canonicalVowlScene.js";
import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import { profiles, compatibleArtifactProfile } from "vowl";

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
  const captures = new Set();

  function checkOpen() {
    if (disposed) {
      throw rejected("DOCUMENT_SESSION_DISPOSED");
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
  return Object.freeze({
    target,
    resolveTarget,
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
      } = {},
    ) {
      checkOpen();
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
        const records = new Map(
          semanticRecords(candidate.inspection).map((record, index) => [
            record.id,
            index + 1,
          ]),
        );
        const projection = prepareProjection(
          structuredClone(candidate.inspection),
          scene.snapshot(),
        );
        if (disposed || operation.signal.aborted || loading !== operation) {
          throw rejected("LOAD_ABORTED");
        }
        current = {
          ...candidate,
          generation: loadGeneration,
          revision: 0,
          scene,
          records,
          nextRecordToken: records.size,
        };
        return {
          ...this.snapshot(),
          projection,
          initialLayout: result.visualization ? "pause" : "resume",
          diagnostics: structuredClone(candidate.inspection.diagnostics),
        };
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
        center,
        suppliedPositions,
        prepareProjection = createCanonicalVowlRenderProjection,
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
            suppliedPositions,
          },
        );
        let choices = new Map();
        if (proposal.conflicts.length > 0) {
          if (typeof reconcile !== "function") {
            throw rejected("DOCUMENT_MERGE_REQUIRES_CHOICE");
          }
          choices = await reconcile(proposal.conflicts, {
            inspection: structuredClone(candidate.inspection),
            signal: operation.signal,
          });
          if (choices === null) {
            throw rejected("DOCUMENT_EDIT_CANCELLED");
          }
        }
        checkCurrent();
        const acceptedChoices = structuredClone(choices);
        // Inspection/render projection failures must precede any live mutation.
        const projection = prepareProjection(
          structuredClone(candidate.inspection),
          proposal.preview(acceptedChoices),
        );
        checkCurrent();
        proposal.commit(acceptedChoices);
        current = {
          ...base,
          ...candidate,
          records: nextRecords,
          nextRecordToken,
          revision: base.revision + 1,
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
