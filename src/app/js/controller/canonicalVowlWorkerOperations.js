import {
  canonicalize,
  decode,
  edit,
  encode,
  profiles,
  VowlError,
  openCanonical,
  inspectModel,
  editModel,
  captureModel,
  checkpointModel,
  readmitModel,
  readModelSource,
} from "vowl";
import { fromOwl, openOwl, exportModelRdf } from "vowl/owl";
import { migrate } from "vowl/migrate";
import { canonicalFailureDetails } from "./canonicalVowlFailure.js";

/**
 * Worker-only package boundary. Each operation admits bytes in this module
 * instance; the returned model is an inspection clone, never encoder authority.
 * The client owns the whole-job deadline, including admission and import waits.
 */
export async function runCanonicalVowlOperation(
  request,
  resolveImport,
  context,
) {
  const { operation, bytes, limits } = request;
  let document;
  let metadata = {};
  switch (operation) {
    case "open-owl-model": {
      const opened = await openOwl(bytes, {
        documentIri: request.documentIri,
        mediaType: request.mediaType,
        limits,
        resolveImport,
      });
      const startedAt = performance.now();
      const inspection = inspectModel(opened.model);
      const checkpoint = await checkpointModel(opened.model, { limits });
      performance.measure("webvowl.owl-checkpoint", {
        start: startedAt,
        end: performance.now(),
      });
      return {
        visualization: null,
        inspection,
        checkpoint,
        correspondence: opened.correspondence,
      };
    }
    case "open-canonical-model": {
      const decoded = await decode(bytes, { limits });
      return openAdmittedDocument(decoded, limits);
    }
    case "open-legacy-model": {
      const migrated = await migrate(bytes, {
        dialect: request.dialect,
        profile: request.profile,
        resolutions: request.resolutions,
        limits,
      });
      return {
        ...(await openAdmittedDocument(migrated.document, limits)),
        dialect: migrated.dialect,
        diagnostics: migrated.diagnostics,
      };
    }
    case "recover-model": {
      const recovered = await recoverCheckpoint(
        request.checkpoint,
        limits,
        context,
      );
      return {
        inspection: inspectModel(recovered.model),
        checkpoint: await checkpointModel(recovered.model, { limits }),
        correspondence: recovered.correspondence,
      };
    }
    case "edit-model": {
      const recovered = await recoverCheckpoint(
        request.checkpoint,
        limits,
        context,
      );
      const result = await editModel(recovered.model, request.changes, {
        limits,
      });
      return {
        inspection: inspectModel(result.model),
        checkpoint: await checkpointModel(result.model, { limits }),
        correspondence: result.correspondence,
        created: result.created,
      };
    }
    case "capture-model": {
      const recovered = await recoverCheckpoint(
        request.checkpoint,
        limits,
        context,
      );
      const result = await captureModel(recovered.model, {
        profile: request.profile,
        ...(request.visualization === undefined
          ? {}
          : { visualization: request.visualization }),
        limits,
      });
      return {
        document: result.document,
        bytes: encode(result.document),
        correspondence: result.correspondence,
      };
    }
    case "read-model-source": {
      const recovered = await recoverCheckpoint(
        request.checkpoint,
        limits,
        context,
      );
      return readModelSource(recovered.model, request.documentId, { limits });
    }
    case "export-model-rdf": {
      const recovered = await recoverCheckpoint(
        request.checkpoint,
        limits,
        context,
      );
      return exportModelRdf(recovered.model, { limits });
    }
    case "decode":
      document = await decode(bytes, { limits });
      break;
    case "owl": {
      const result = await fromOwl(bytes, {
        documentIri: request.documentIri,
        mediaType: request.mediaType,
        ...(request.mappingProfile === undefined
          ? {}
          : { mappingProfile: request.mappingProfile }),
        limits,
        resolveImport,
      });
      document = result.document;
      metadata = {
        mappingProfile: result.mappingProfile,
        diagnostics: result.diagnostics,
      };
      break;
    }
    case "migrate": {
      const result = await migrate(bytes, {
        dialect: request.dialect,
        profile: request.profile,
        resolutions: request.resolutions,
        limits,
      });
      document = result.document;
      metadata = { dialect: result.dialect, diagnostics: result.diagnostics };
      break;
    }
    case "edit": {
      const previous = await decode(bytes, { limits });
      const result = await edit(previous, request.changes, { limits });
      document = result.document;
      metadata = {
        correspondence: result.correspondence,
        created: result.created,
      };
      break;
    }
    case "capture": {
      const previous = await decode(bytes, { limits });
      document = await canonicalize(
        {
          structural: previous.structural,
          visualization: request.visualization,
        },
        { profile: profiles.artifact, limits },
      );
      break;
    }
    default:
      throw new TypeError("Unknown canonical operation.");
  }
  return { document, bytes: encode(document), ...metadata };
}

async function openAdmittedDocument(document, limits) {
  const opened = await openCanonical(document, { limits });
  const references = new Map(
    opened.correspondence.map(({ previous, current }) => [previous, current]),
  );
  const visualization = document.visualization
    ? structuredClone(document.visualization)
    : null;
  if (visualization) {
    for (const placement of visualization.placements) {
      placement.occurrence = references.get(placement.occurrence);
    }
    visualization.hidden = visualization.hidden.map((id) => references.get(id));
  }
  return {
    visualization,
    inspection: inspectModel(opened.model),
    checkpoint: await checkpointModel(opened.model, { limits }),
    correspondence: opened.correspondence,
  };
}

async function recoverCheckpoint(checkpoint, limits, context) {
  if (
    !Number.isSafeInteger(context?.baseRevision) ||
    context.baseRevision < 0
  ) {
    throw new VowlError(
      "MODEL_REVISION_MISMATCH",
      "Missing model revision context",
    );
  }
  const result = await readmitModel(checkpoint, { limits });
  if (result.model.revision !== context.baseRevision) {
    throw new VowlError(
      "MODEL_REVISION_MISMATCH",
      "Checkpoint and request revisions differ",
    );
  }
  return result;
}

/** Never send source text, stacks or dependency exceptions across this seam. */
export function canonicalWorkerFailure(error) {
  return {
    code:
      error instanceof VowlError && /^[A-Z][A-Z0-9_]{0,95}$/u.test(error.code)
        ? error.code
        : "CANONICAL_OPERATION_FAILED",
    ...(error instanceof VowlError && error.details
      ? { details: canonicalFailureDetails(error.details) }
      : {}),
  };
}
