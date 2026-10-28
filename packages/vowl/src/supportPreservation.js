import { envelope } from "./modelContract.js";
import { profiles, collectionTypeNames } from "./profiles.js";
import { descriptorFor, walkTyped } from "./typedValues.js";
import { snapshotSource } from "./snapshot.js";
import { jsonKey } from "./canonicalJson.js";

// Both inputs belong to the current operation: the previous admitted revision
// is immutable, and normalization has validated the owned edited draft. Compare
// every field and sequence member, remapping only schema-declared IDs/references.
// Object member order has no JCS meaning; array order and literal strings do.
function equalMappedValue(previous, current, descriptor, successors, budget) {
  budget.poll();
  const shape = descriptorFor(previous, descriptor, "");
  if (shape?.id || shape?.reference) {
    return (successors.get(previous) ?? null) === current;
  }
  if (previous === null || typeof previous !== "object") {
    return previous === current;
  }
  if (
    current === null ||
    typeof current !== "object" ||
    Array.isArray(previous) !== Array.isArray(current)
  ) {
    return false;
  }
  const keys = Object.keys(previous);
  if (keys.length !== Object.keys(current).length) {
    return false;
  }
  for (const key of keys) {
    budget.poll();
    if (
      !Object.hasOwn(current, key) ||
      !equalMappedValue(
        previous[key],
        current[key],
        shape?.items ?? shape?.fields?.[key],
        successors,
        budget,
      )
    ) {
      return false;
    }
  }
  return true;
}

/** Match complete mapped content, preserving the original non-edit precedence. */
export function createPreservedSupportLookup(before, successors, budget) {
  const supports = new Map();
  for (const support of before.supports) {
    budget.poll();
    supports.set(support.record, support);
  }
  const candidates = new Map();
  for (const [collection, descriptor] of Object.entries(collectionTypeNames)) {
    for (const record of before.structural[collection]) {
      budget.poll();
      const current = successors.get(record.id);
      if (current === undefined || current === null) {
        continue;
      }
      if (!candidates.has(current)) {
        candidates.set(current, []);
      }
      candidates
        .get(current)
        .push({ record, descriptor, support: supports.get(record.id) });
    }
  }

  // Retain the original canonical comparison for changed/ambiguous content.
  // Build its owned mapped tree only if the complete typed comparison cannot
  // prove the candidate group equivalent; ordinary inserts need neither copy
  // nor serialization of the previous revision.
  let canonical;
  function canonicalLookup() {
    if (canonical) {
      return canonical;
    }
    const renamed = snapshotSource({ structural: before.structural }, budget);
    walkTyped(
      renamed,
      envelope(profiles.structuralContent),
      (value, shape, _pointer, parent, field) => {
        budget.check();
        if (shape?.reference || shape?.id) {
          parent[field] = successors.get(value) ?? null;
        }
      },
    );
    canonical = new Map();
    for (const collection of Object.keys(collectionTypeNames)) {
      renamed.structural[collection].forEach((record, index) => {
        budget.check();
        if (record.id === null) {
          return;
        }
        const key = jsonKey(record);
        const support = supports.get(before.structural[collection][index].id);
        if (!canonical.has(key) || support.origin !== "edit") {
          canonical.set(key, support);
        }
      });
    }
    return canonical;
  }

  return (record) => {
    const group = candidates.get(record.id);
    if (!group) {
      return undefined;
    }
    let result;
    for (const candidate of group) {
      budget.poll();
      if (
        !equalMappedValue(
          candidate.record,
          record,
          candidate.descriptor,
          successors,
          budget,
        )
      ) {
        return canonicalLookup().get(jsonKey(record));
      }
      if (!result || candidate.support.origin !== "edit") {
        result = candidate.support;
      }
    }
    return result;
  };
}
