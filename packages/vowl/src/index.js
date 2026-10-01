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
import { compareBytes, jsonBytes, orderSets } from "./canonicalJson.js";
import { parseBytes } from "./lexicalJson.js";
import { takeOperationBudget } from "./operationBudget.js";
import {
  applyChanges,
  normalizeDraft,
  editingCorrespondence,
} from "./editing.js";

export { profiles, VowlError };
const admitted = new WeakMap();
const canonicalOptionChecks = {
  profile(value) {
    if (!Object.values(profiles).includes(value)) {
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
    if (!Object.values(profiles).includes(document.profile)) {
      fail("PROFILE_UNKNOWN", "/profile");
    }
    const profile = document.profile;
    validateFields(document, envelope(profile, true), budget);
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
