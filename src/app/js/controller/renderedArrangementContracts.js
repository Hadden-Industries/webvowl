import {
  createOntologyElementReference,
  createVowlDocumentRecordTarget,
} from "./webVowlControllerContracts.js";

function fields(value, allowed, required = allowed) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new TypeError(
      "The rendered arrangement value has an invalid field set.",
    );
  }
}

function generation(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError("loadGeneration must be a positive safe integer.");
  }
}

function coordinate(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > Number.MAX_SAFE_INTEGER
  ) {
    throw new TypeError(
      "Arrangement coordinates must be finite supported pixel values.",
    );
  }
}

export function createRenderedOccurrenceReference(reference) {
  fields(reference, ["loadGeneration", "occurrenceId"]);
  generation(reference.loadGeneration);
  if (
    typeof reference.occurrenceId !== "string" ||
    reference.occurrenceId.length === 0 ||
    reference.occurrenceId.length > 128
  ) {
    throw new TypeError(
      "occurrenceId must be a nonempty opaque identifier of at most 128 characters.",
    );
  }
  return Object.freeze({ ...reference });
}

export function createRenderedArrangement(snapshot) {
  fields(snapshot, ["loadGeneration", "occurrences"]);
  generation(snapshot.loadGeneration);
  if (!Array.isArray(snapshot.occurrences)) {
    throw new TypeError("occurrences must be an array.");
  }
  const seen = new Set();
  const occurrences = snapshot.occurrences.map((entry) => {
    fields(entry, [
      "reference",
      "recordTargets",
      "ontologyElementReferences",
      "kind",
      "xPx",
      "yPx",
      "isPinned",
      "canMove",
      "canPin",
    ]);
    const reference = createRenderedOccurrenceReference(entry.reference);
    if (
      reference.loadGeneration !== snapshot.loadGeneration ||
      seen.has(reference.occurrenceId)
    ) {
      throw new RangeError(
        "Arrangement references must be unique within the snapshot generation.",
      );
    }
    seen.add(reference.occurrenceId);
    if (!["node", "property-label"].includes(entry.kind)) {
      throw new TypeError("Unknown rendered occurrence kind.");
    }
    coordinate(entry.xPx);
    coordinate(entry.yPx);
    for (const key of ["isPinned", "canMove", "canPin"]) {
      if (typeof entry[key] !== "boolean") {
        throw new TypeError(`${key} must be Boolean.`);
      }
    }
    if (
      !Array.isArray(entry.recordTargets) ||
      !Array.isArray(entry.ontologyElementReferences)
    ) {
      throw new TypeError(
        "Occurrence document targets and ontology references must be arrays.",
      );
    }
    return Object.freeze({
      ...entry,
      reference,
      recordTargets: Object.freeze(
        entry.recordTargets.map(createVowlDocumentRecordTarget),
      ),
      ontologyElementReferences: Object.freeze(
        entry.ontologyElementReferences.map(createOntologyElementReference),
      ),
    });
  });
  return Object.freeze({
    loadGeneration: snapshot.loadGeneration,
    occurrences: Object.freeze(occurrences),
  });
}

export function createRenderedArrangementRequest(request) {
  fields(request, ["changes"]);
  if (
    !Array.isArray(request.changes) ||
    request.changes.length < 1 ||
    request.changes.length > 100
  ) {
    throw new RangeError(
      "An arrangement request must contain between 1 and 100 changes.",
    );
  }
  const seen = new Set();
  const changes = request.changes.map((change) => {
    fields(change, ["reference", "xPx", "yPx", "isPinned"], ["reference"]);
    const reference = createRenderedOccurrenceReference(change.reference);
    const key = `${reference.loadGeneration}:${reference.occurrenceId}`;
    if (seen.has(key)) {
      throw new RangeError(
        "An occurrence may be changed only once per request.",
      );
    }
    seen.add(key);
    if ((change.xPx === undefined) !== (change.yPx === undefined)) {
      throw new TypeError("A move requires both xPx and yPx.");
    }
    if (change.xPx === undefined && change.isPinned === undefined) {
      throw new TypeError(
        "An arrangement change must move or pin an occurrence.",
      );
    }
    if (change.xPx !== undefined) {
      coordinate(change.xPx);
      coordinate(change.yPx);
    }
    if (change.isPinned !== undefined && typeof change.isPinned !== "boolean") {
      throw new TypeError("isPinned must be Boolean.");
    }
    return Object.freeze({ ...change, reference });
  });
  return Object.freeze({ changes: Object.freeze(changes) });
}

export function createRenderedOccurrenceSelectionRequest(request) {
  fields(request, ["reference"]);
  return Object.freeze({
    ...request,
    reference:
      request.reference === null
        ? null
        : createRenderedOccurrenceReference(request.reference),
  });
}

export function createRenderedArrangementQuery(request = {}) {
  fields(request, ["offset", "limit", "ontologyElementReference"], []);
  const offset = request.offset ?? 0;
  const limit = request.limit ?? 25;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new RangeError(
      "Arrangement queries require a nonnegative offset and a limit from 1 to 100.",
    );
  }
  const query = { offset, limit };
  if (request.ontologyElementReference !== undefined) {
    const reference = request.ontologyElementReference;
    fields(
      reference,
      Object.hasOwn(reference, "iri")
        ? ["kind", "iri"]
        : ["kind", "loadGeneration", "localId"],
    );
    query.ontologyElementReference = createOntologyElementReference(reference);
  }
  return Object.freeze(query);
}

export function resolveRenderedArrangementChanges(snapshot, request) {
  return createRenderedArrangementRequest(request).changes.map((change) => {
    const occurrence = snapshot.occurrences.find(
      (entry) => entry.reference.occurrenceId === change.reference.occurrenceId,
    );
    if (
      change.reference.loadGeneration !== snapshot.loadGeneration ||
      occurrence === undefined
    ) {
      throw new RangeError(
        "The arrangement request targets an absent or retired occurrence.",
      );
    }
    if (
      (change.xPx !== undefined && !occurrence.canMove) ||
      (change.isPinned === true && !occurrence.canPin)
    ) {
      throw new RangeError(
        "This occurrence cannot be moved or pinned independently in the current view.",
      );
    }
    return change;
  });
}
