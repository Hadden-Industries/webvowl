import { profiles } from "./profiles.js";
import { fail, VowlError } from "./errors.js";
import {
  optionRecord,
  ResourceBudget,
  validateOperationOptions,
} from "./resourceBudget.js";
import { snapshotSource, snapshotBytes, deepFreeze } from "./snapshot.js";
import { validateFields } from "./typedValues.js";
import { envelope } from "./modelContract.js";
import { validateGraph, validateMeaning } from "./validateGraph.js";
import { validateProjection, validateArtifact } from "./projection.js";
import { issueIds } from "./internalRdf.js";
import { refineDataset } from "./refinedRdf.js";
import { compareBytes, jsonBytes, orderSets } from "./canonicalJson.js";
import { parseBytes } from "./lexicalJson.js";
import { takeOperationBudget } from "./operationBudget.js";
import {
  applyChanges,
  normalizeDraft,
  editingCorrespondence,
} from "./editing.js";
import {
  liveState,
  openCanonicalState,
  openOwlState,
  inspectLiveModel,
  editLiveModel,
  checkpointLiveModel,
  readmitLiveModel,
  captureQualifications,
  readLiveModelSource,
} from "./liveModel.js";
import { registerOwlAdmission } from "./modelAdmission.js";
import {
  compatibleArtifactProfile,
  compatibleDocumentContract,
} from "./compatibleContract.js";
import { admitCompatibleArtifact } from "./compatibleArtifact.js";

export { profiles, compatibleArtifactProfile, VowlError };
export {
  namespaces,
  migrationDialect,
  compatibleViewPolicy,
} from "./profiles.js";
export { dataRangeKinds } from "./modelContract.js";
export { operationLimitPolicy } from "./resourceBudget.js";
const admitted = new WeakMap();
const admittedModels = new WeakSet();

function rememberModel(result) {
  admittedModels.add(result.model);
  return result;
}

registerOwlAdmission(inspectModel, (source, archive, documentIri, budget) =>
  rememberModel(openOwlState(source, archive, documentIri, budget)),
);

function requireModel(model) {
  if (!admittedModels.has(model)) {
    fail("MODEL_NOT_ADMITTED");
  }
  return liveState(model);
}
const canonicalOptionChecks = {
  profile(value) {
    if (
      ![...Object.values(profiles), compatibleArtifactProfile].includes(value)
    ) {
      fail("OPTION_INVALID", "/profile");
    }
  },
};

/** Atomic document editing, authorized by the 2026-09-30 interface amendment. */
export async function edit(document, changes, options) {
  const startedAt = performance.now();
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, startedAt);
  try {
    if (!admitted.has(document)) {
      fail("DOCUMENT_NOT_ADMITTED");
    }
    if (document.profile === compatibleArtifactProfile) {
      // This frozen v1 operation returns structural-content/v1. Qualified
      // artifacts use openCanonical/editModel/captureModel to preserve evidence.
      fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
    }
    const source = snapshotSource({ structural: document.structural }, budget);
    const requests = snapshotSource({ changes }, budget, (pointer) =>
      /^\/changes\/[0-9]+\/record$/.test(pointer),
    ).changes;
    applyChanges(source, requests, budget);
    const resolve = normalizeDraft(source, budget);
    const correspondence = editingCorrespondence(
      document,
      source,
      resolve,
      budget,
    );
    const issued = new Map();
    const result = await admit(
      source,
      profiles.structuralContent,
      budget,
      undefined,
      issued,
    );
    const matched = new Set();
    for (const pair of correspondence) {
      if (pair.current !== null) {
        pair.current = issued.get(pair.current);
        matched.add(pair.current);
      }
    }
    const created = [...issued.values()].filter((id) => !matched.has(id));
    budget.check();
    return deepFreeze({ document: result, correspondence, created });
  } finally {
    budget.dispose();
  }
}

async function admit(source, profile, budget, originalBytes, issued) {
  if (profile === compatibleArtifactProfile) {
    const result = await admitCompatibleArtifact(source, budget, originalBytes);
    if (issued) {
      for (const [before, after] of result.correspondence) {
        issued.set(before, after);
      }
    }
    admitted.set(result.document, result.bytes);
    return result.document;
  }
  validateFields(source, envelope(profile), budget);
  const graph = validateGraph(
    source,
    profile,
    budget,
    originalBytes !== undefined,
  );
  const context = validateMeaning(source, graph, budget);
  validateProjection(source, context, budget);
  validateArtifact(source, context, budget);
  const document = { profile, ...source };
  const replacements = await issueIds(document, budget);
  if (issued) {
    for (const [before, after] of replacements) {
      issued.set(before, after);
    }
  }
  orderSets(document, envelope(profile, true), budget);
  let bytes;
  try {
    bytes = jsonBytes(document);
  } catch (cause) {
    throw new VowlError("DEPENDENCY_FAILURE", "JSON canonicalization failed", {
      details: { stage: "jcs" },
      cause,
    });
  }
  budget.check();
  if (originalBytes && compareBytes(bytes, originalBytes) !== 0) {
    fail("NON_CANONICAL_BYTES");
  }
  deepFreeze(document);
  budget.check();
  admitted.set(document, bytes);
  return document;
}

/** Admit a complete normalized source. The caller's entire tree is copied before suspension. */
export async function canonicalize(source, options) {
  const startedAt = performance.now();
  const opts = optionRecord(options, ["profile", "limits", "signal"]);
  const borrowed = takeOperationBudget(source, canonicalize);
  if (borrowed) {
    validateOperationOptions(opts, canonicalOptionChecks);
  }
  const budget =
    borrowed ?? new ResourceBudget(opts, startedAt, canonicalOptionChecks);
  try {
    const snapshot = snapshotSource(source, budget);
    return await admit(snapshot, opts.profile, budget);
  } finally {
    if (!borrowed) {
      budget.dispose();
    }
  }
}

/** Verify exact canonical bytes; valid but differently encoded documents are never repaired. */
export async function decode(input, options) {
  const startedAt = performance.now();
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, startedAt);
  try {
    const bytes = snapshotBytes(input, budget);
    const document = parseBytes(bytes, budget);
    if (
      document === null ||
      typeof document !== "object" ||
      Array.isArray(document)
    ) {
      fail("DOCUMENT_TYPE", "");
    }
    // Both profiles require this envelope. A7 checks its required fields and
    // JSON types before dispatching on the profile; nested fields come later.
    for (const name of ["profile", "structural"]) {
      if (!Object.hasOwn(document, name)) {
        fail("DOCUMENT_REQUIRED_FIELD", `/${name}`);
      }
    }
    if (typeof document.profile !== "string") {
      fail("DOCUMENT_TYPE", "/profile");
    }
    if (
      document.structural === null ||
      typeof document.structural !== "object" ||
      Array.isArray(document.structural)
    ) {
      fail("DOCUMENT_TYPE", "/structural");
    }
    if (
      ![...Object.values(profiles), compatibleArtifactProfile].includes(
        document.profile,
      )
    ) {
      fail("PROFILE_UNKNOWN", "/profile");
    }
    const profile = document.profile;
    validateFields(
      document,
      profile === compatibleArtifactProfile
        ? compatibleDocumentContract
        : envelope(profile, true),
      budget,
    );
    delete document.profile;
    return await admit(document, profile, budget, bytes);
  } finally {
    budget.dispose();
  }
}

/** Only this module instance's immutable admitted documents can yield fresh encoded bytes. */
export function encode(document) {
  const bytes = admitted.get(document);
  if (!bytes) {
    fail("DOCUMENT_NOT_ADMITTED");
  }
  return new Uint8Array(bytes);
}

/** Open verified retained content without acquiring canonical authority for the live token. */
export async function openCanonical(document, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    return rememberModel(
      await openCanonicalState(document, encode(document), budget),
    );
  } finally {
    budget.dispose();
  }
}

export function inspectModel(model) {
  requireModel(model);
  return inspectLiveModel(model);
}

/** Reuse atomic edit normalization while retaining local, noncanonical handles. */
export async function editModel(model, changes, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    requireModel(model);
    return rememberModel(editLiveModel(model, changes, budget));
  } finally {
    budget.dispose();
  }
}

/** Capture an immutable revision; returned canonical IDs never replace live handles. */
export async function captureModel(model, options) {
  const opts = optionRecord(options, [
    "profile",
    "visualization",
    "limits",
    "signal",
  ]);
  const budget = new ResourceBudget(
    opts,
    performance.now(),
    canonicalOptionChecks,
  );
  try {
    const state = requireModel(model);
    if (
      opts.profile !== compatibleArtifactProfile &&
      (state.origin.kind === "owl" || state.qualifications)
    ) {
      fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
    }
    const source = snapshotSource(
      {
        structural: state.structural,
        ...(opts.profile === compatibleArtifactProfile
          ? { qualifications: captureQualifications(model, budget) }
          : {}),
        ...(Object.hasOwn(opts, "visualization")
          ? { visualization: opts.visualization }
          : {}),
      },
      budget,
    );
    const issued = new Map();
    const document = await admit(
      source,
      opts.profile,
      budget,
      undefined,
      issued,
    );
    return deepFreeze({
      document,
      correspondence: [...issued].map(([previous, current]) => ({
        previous,
        current,
      })),
    });
  } finally {
    budget.dispose();
  }
}

/** Structural ranking keys only: never artifact authority or replacement handles. */
export async function readModelRankingIdentity(model, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    const state = requireModel(model);
    const source = snapshotSource(
      { profile: profiles.structuralContent, structural: state.structural },
      budget,
    );
    // The admitted live model already passed structural validation. Reuse the
    // producer's qualified refinement to bound symmetric RDF work, without
    // admitting an artifact or including appearance and qualifications in keys.
    const issued = await issueIds(source, budget, { refine: refineDataset });
    return deepFreeze({
      revision: model.revision,
      correspondence: state.structural.occurrences.map(({ id }) => ({
        previous: id,
        current: issued.get(id),
      })),
    });
  } finally {
    budget.dispose();
  }
}

export async function checkpointModel(model, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    requireModel(model);
    return checkpointLiveModel(model, budget);
  } finally {
    budget.dispose();
  }
}

/** Return a disposable copy of one exact original input document. */
export async function readModelSource(model, documentId, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    requireModel(model);
    return readLiveModelSource(model, documentId, budget);
  } finally {
    budget.dispose();
  }
}

export async function readmitModel(checkpoint, options) {
  const opts = optionRecord(options, ["limits", "signal"]);
  const budget = new ResourceBudget(opts, performance.now());
  try {
    return rememberModel(await readmitLiveModel(checkpoint, budget));
  } finally {
    budget.dispose();
  }
}
