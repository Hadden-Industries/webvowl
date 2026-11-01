import { readOwnedWorkerResult } from "./canonicalVowlWorkerResultOwnership.js";

const maximumRetainedBytes = 33554432;
const sourceFields = [
  "operation",
  "bytes",
  "documentIri",
  "mediaType",
  "owlMappingStrategy",
  "limits",
];

/** Exact byte equality, with no rewriting or parser interpretation. Inputs are owned native copies. */
export function sameSourceBytes(left, right) {
  if (
    !(left instanceof Uint8Array) ||
    !(right instanceof Uint8Array) ||
    left.length !== right.length
  ) {
    return false;
  }
  if (left.byteOffset % 4 === 0 && right.byteOffset % 4 === 0) {
    const count = Math.floor(left.length / 4);
    const a = new Uint32Array(left.buffer, left.byteOffset, count);
    const b = new Uint32Array(right.buffer, right.byteOffset, count);
    for (let index = 0; index < count; index++) {
      if (a[index] !== b[index]) {
        return false;
      }
    }
    for (let index = count * 4; index < left.length; index++) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
export function importRequestKey(iri, parent) {
  return JSON.stringify([iri, parent]);
}

function signature(request, scope) {
  if (
    scope.explicitLimits ||
    request.operation !== "open-owl-model" ||
    typeof request.documentIri !== "string" ||
    (request.mediaType !== undefined &&
      typeof request.mediaType !== "string") ||
    (request.owlMappingStrategy !== undefined &&
      typeof request.owlMappingStrategy !== "string") ||
    Object.keys(request).some((key) => !sourceFields.includes(key))
  ) {
    return null;
  }
  return JSON.stringify([
    request.documentIri,
    request.mediaType,
    request.owlMappingStrategy,
    scope.deadlineMs,
    scope.inputLimit,
  ]);
}

/**
 * Private, one-result transport memoization. This carries no model admission or
 * encoding authority. Every source is freshly acquired and compared before reuse;
 * edits/exports still submit checkpoints to the owning package's full readmission.
 */
export function createValidatedOwlResultCache({ measure }) {
  let retained;
  const previews = new WeakMap();
  function measuredSize(value, maximum) {
    const size = measure(value, maximum);
    if (!Number.isSafeInteger(size) || size < 0 || size > maximum) {
      throw new RangeError("Retention capacity");
    }
    return size;
  }
  return Object.freeze({
    candidate(request, scope) {
      const key = signature(request, scope);
      return key &&
        retained?.key === key &&
        request.bytes?.length === retained.root.length
        ? retained
        : undefined;
    },
    capture(request, scope, result) {
      const transferred = readOwnedWorkerResult(result);
      result = transferred ?? result;
      if (
        !signature(request, scope) ||
        result?.checkpoint?.revision !== 0 ||
        result?.inspection?.revision !== 0
      ) {
        return;
      }
      try {
        if (transferred) {
          // No payload is allocated here: the session already needs this native
          // receiver value. Measure optional retention at completion, before
          // allocating a completion copy or installing the long-lived entry.
          previews.set(transferred, null);
          return transferred;
        }
        const size = measuredSize(result, maximumRetainedBytes);
        const owned = structuredClone(result);
        previews.set(owned, size);
        return owned;
      } catch {
        return undefined;
      }
    },
    remember(request, scope, imports, completion, preview) {
      const hasPreview = previews.has(preview);
      const result = hasPreview ? { ...preview, ...completion } : completion;
      const key = signature(request, scope);
      if (
        !key ||
        !result?.displayOrderKeys ||
        result.checkpoint?.revision !== 0 ||
        result.inspection?.revision !== 0 ||
        result.inspection.imports?.some((edge) => edge.state !== "acquired")
      ) {
        return;
      }
      try {
        // Capacity only disables reuse. It never rejects an otherwise valid load.
        // The caller cannot access this owned preview. A transferred value has
        // not needed a payload allocation yet; copied previews already carry
        // their measurement. Count both root envelopes conservatively.
        const previewSize = hasPreview
          ? (previews.get(preview) ??
            measuredSize(preview, maximumRetainedBytes))
          : 0;
        measuredSize(
          hasPreview ? completion : result,
          maximumRetainedBytes - previewSize,
        );
        const owned = hasPreview
          ? { ...preview, ...structuredClone(completion) }
          : structuredClone(result);
        if (preview) {
          previews.delete(preview);
        }
        const documents = owned.inspection.documents;
        const sources = new Map(
          owned.checkpoint.source.sources.map((source) => [
            source.document,
            source.bytes,
          ]),
        );
        if (
          documents.length !== sources.size ||
          !documents.every(
            (document) => sources.get(document.id) instanceof Uint8Array,
          )
        ) {
          return;
        }
        const root = documents.find(
          (document) => document.documentIri === request.documentIri,
        );
        if (!root || !sameSourceBytes(request.bytes, sources.get(root.id))) {
          return;
        }
        const recipe = imports.map((imported) => {
          const document = documents.find(
            (document) => document.documentIri === imported.documentIri,
          );
          if (!document) {
            throw new Error("Unmatched source");
          }
          return { ...imported, bytes: sources.get(document.id) };
        });
        if (
          !documents.every(
            (document) =>
              document.id === root.id ||
              recipe.some(
                (imported) => imported.documentIri === document.documentIri,
              ),
          )
        ) {
          return;
        }
        retained = { key, root: sources.get(root.id), recipe, result: owned };
      } catch {
        /* Optional retention cannot change admission or its original failure. */
      }
    },
    copy(candidate) {
      return structuredClone(candidate.result);
    },
    clear() {
      retained = undefined;
    },
  });
}
