// Shared plain-data validation for application and renderer boundary DTOs.
import { createOntologyElementReference } from "./webVowlControllerContracts.js";

function isPlainRecord(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return false;
  }
  const candidatePrototype = Object.getPrototypeOf(candidate);
  return (
    candidatePrototype === null ||
    Object.getPrototypeOf(candidatePrototype) === null
  );
}

export function assertPlainRecord(candidate, description) {
  if (!isPlainRecord(candidate)) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

export function assertExactFieldNames(record, expectedFieldNames, description) {
  assertPlainRecord(record, description);
  const actualFieldNames = Object.keys(record).sort();
  const sortedExpectedFieldNames = [...expectedFieldNames].sort();
  if (
    actualFieldNames.length !== sortedExpectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== sortedExpectedFieldNames[index],
    )
  ) {
    throw new TypeError(`${description} has an invalid field set.`);
  }
}

export function assertAllowedFieldNames(
  record,
  allowedFieldNames,
  description,
) {
  assertPlainRecord(record, description);
  const unexpectedFieldName = Object.keys(record).find(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unexpectedFieldName !== undefined) {
    throw new TypeError(
      `${description} contains unsupported field ${unexpectedFieldName}.`,
    );
  }
}

export function assertPositiveLoadGeneration(loadGeneration) {
  if (!Number.isInteger(loadGeneration) || loadGeneration < 1) {
    throw new TypeError("loadGeneration must be a positive integer.");
  }
}

export function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer.`);
  }
}

export function assertFiniteNumber(value, fieldName, { minimum } = {}) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    (minimum !== undefined && value < minimum)
  ) {
    const minimumDescription =
      minimum === undefined ? "finite" : `a finite number at least ${minimum}`;
    throw new TypeError(`${fieldName} must be ${minimumDescription}.`);
  }
}

export function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${fieldName} must be a Boolean predicate.`);
  }
}

export function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

export function assertNullableNonEmptyString(value, fieldName) {
  if (value !== null) {
    assertNonEmptyString(value, fieldName);
  }
}

export function createFrozenOntologyElementReference(
  ontologyElementReference,
  allowedKinds,
  fieldName,
) {
  const frozenReference = createOntologyElementReference(
    ontologyElementReference,
  );
  if (!allowedKinds.includes(frozenReference.kind)) {
    throw new TypeError(
      `${fieldName} must contain only ${allowedKinds.join(" or ")} references.`,
    );
  }
  return frozenReference;
}

export function createFrozenReferenceCollection(
  references,
  allowedKinds,
  fieldName,
) {
  if (!Array.isArray(references)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }
  return Object.freeze(
    references.map((reference) =>
      createFrozenOntologyElementReference(reference, allowedKinds, fieldName),
    ),
  );
}

export function deepFreezePlainData(
  plainDataValue,
  ancestorObjects = new WeakSet(),
) {
  if (
    plainDataValue === null ||
    typeof plainDataValue === "string" ||
    typeof plainDataValue === "boolean" ||
    plainDataValue === undefined
  ) {
    return plainDataValue;
  }
  if (typeof plainDataValue === "number" && Number.isFinite(plainDataValue)) {
    return plainDataValue;
  }
  if (typeof plainDataValue !== "object") {
    throw new TypeError("Contract values must be plain structured data.");
  }
  if (ancestorObjects.has(plainDataValue)) {
    throw new TypeError("Contract values must not contain cycles.");
  }
  if (!Array.isArray(plainDataValue) && !isPlainRecord(plainDataValue)) {
    throw new TypeError("Contract values must contain only plain objects.");
  }
  ancestorObjects.add(plainDataValue);
  for (const nestedValue of Array.isArray(plainDataValue)
    ? plainDataValue
    : Object.values(plainDataValue)) {
    deepFreezePlainData(nestedValue, ancestorObjects);
  }
  ancestorObjects.delete(plainDataValue);
  return Object.freeze(plainDataValue);
}
