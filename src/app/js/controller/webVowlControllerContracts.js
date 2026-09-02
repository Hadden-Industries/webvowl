const WEB_VOWL_OPERATION_ERROR_CODES = Object.freeze([
  "NO_ONTOLOGY",
  "SOURCE_REJECTED",
  "LOAD_ABORTED",
  "FETCH_FAILED",
  "PARSE_FAILED",
  "IMPORT_FAILED",
  "VIEW_REJECTED",
  "ELEMENT_NOT_FOUND",
  "LAYOUT_TIMEOUT",
  "EXPORT_FAILED",
]);

const ONTOLOGY_ELEMENT_KINDS = Object.freeze([
  "class",
  "datatype",
  "individual",
  "property",
]);

const DEFAULT_SVG_FILENAME = "webvowl-visualization.svg";
const SVG_FILENAME_SUFFIX = ".svg";
const MAX_NORMALIZED_SVG_FILENAME_CHARACTERS = 128;
const MAX_PUBLIC_ERROR_DETAIL_FIELD_COUNT = 10;
const MAX_PUBLIC_ERROR_DETAIL_FIELD_NAME_CHARACTERS = 64;
const PORTABLE_FILENAME_UNSAFE_PUNCTUATION = '<>:"|?*';
const PUBLIC_ERROR_DETAIL_FIELD_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/u;
const WINDOWS_RESERVED_DEVICE_BASENAME_PATTERN =
  /^(?:aux|com[1-9¹²³]|con|lpt[1-9¹²³]|nul|prn)(?:\.|$)/iu;
const validatedWebVowlOperationErrorInstances = new WeakSet();

export const WEB_VOWL_OPERATION_LIMITS = Object.freeze({
  maxRemoteSourceLocationCharacters: 2048,
  maxInlineOntologyBytes: 1024 * 1024,
  // Focus is a domain limit: the visible graph focuses at most this many
  // elements. Bounding *search results* is a protocol concern and belongs to
  // the WebMCP tool contract, so the interface can list every match.
  maxFocusReferences: 25,
  maxWarnings: 10,
  maxOntologyDerivedTextCharacters: 256,
});

function truncateWithoutSplittingSurrogatePair(text, maximumCharacters) {
  let truncatedText = text.slice(0, maximumCharacters);
  const finalCodeUnit = truncatedText.charCodeAt(truncatedText.length - 1);
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
    truncatedText = truncatedText.slice(0, -1);
  }
  return truncatedText;
}

export function truncateOntologyDerivedText(ontologyDerivedText) {
  if (typeof ontologyDerivedText !== "string") {
    throw new TypeError("Ontology-derived text must be a string.");
  }

  const maximumCharacters =
    WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters;
  const isTruncated = ontologyDerivedText.length > maximumCharacters;

  return Object.freeze({
    ontologyDerivedText: isTruncated
      ? truncateWithoutSplittingSurrogatePair(
          ontologyDerivedText,
          maximumCharacters,
        )
      : ontologyDerivedText,
    isTruncated,
  });
}

export function truncateResultCollection(resultEntries, maximumEntryCount) {
  if (!Array.isArray(resultEntries)) {
    throw new TypeError("Result entries must be an array.");
  }
  if (!Number.isInteger(maximumEntryCount) || maximumEntryCount < 0) {
    throw new RangeError(
      "The maximum result-entry count must be a non-negative integer.",
    );
  }

  const retainedEntryCount = Math.min(resultEntries.length, maximumEntryCount);
  const retainedEntries = [];
  for (let entryIndex = 0; entryIndex < retainedEntryCount; entryIndex += 1) {
    retainedEntries[entryIndex] = resultEntries[entryIndex];
  }

  return Object.freeze({
    retainedEntries: Object.freeze(retainedEntries),
    isTruncated: resultEntries.length > maximumEntryCount,
  });
}

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

function createBoundedPublicErrorDetails(details) {
  if (details === undefined) {
    return Object.freeze({});
  }
  if (!isPlainRecord(details)) {
    throw new TypeError("Public error details must be a plain object.");
  }

  const detailEntries = Object.entries(details);
  if (detailEntries.length > MAX_PUBLIC_ERROR_DETAIL_FIELD_COUNT) {
    throw new RangeError(
      `Public error details may contain at most ${MAX_PUBLIC_ERROR_DETAIL_FIELD_COUNT} fields.`,
    );
  }

  const boundedDetailEntries = detailEntries.map(([fieldName, fieldValue]) => {
    if (fieldName.length > MAX_PUBLIC_ERROR_DETAIL_FIELD_NAME_CHARACTERS) {
      throw new RangeError(
        `A public error-detail field name may contain at most ${MAX_PUBLIC_ERROR_DETAIL_FIELD_NAME_CHARACTERS} characters.`,
      );
    }
    if (!PUBLIC_ERROR_DETAIL_FIELD_NAME_PATTERN.test(fieldName)) {
      throw new TypeError(
        `Public error-detail field name ${JSON.stringify(fieldName)} must be a lower-camel-case identifier.`,
      );
    }
    if (typeof fieldValue === "string") {
      return [
        fieldName,
        truncateOntologyDerivedText(fieldValue).ontologyDerivedText,
      ];
    }
    if (
      fieldValue === null ||
      typeof fieldValue === "boolean" ||
      (typeof fieldValue === "number" && Number.isFinite(fieldValue))
    ) {
      return [fieldName, fieldValue];
    }
    throw new TypeError(
      `Public error detail ${fieldName} must be a bounded scalar value.`,
    );
  });

  return Object.freeze(Object.fromEntries(boundedDetailEntries));
}

export class WebVowlOperationError extends Error {
  constructor({ cause, code, details, isRetryable = false, message }) {
    if (!WEB_VOWL_OPERATION_ERROR_CODES.includes(code)) {
      throw new RangeError(`Unsupported WebVOWL operation error code: ${code}`);
    }
    if (typeof message !== "string" || message.length === 0) {
      throw new TypeError("A WebVOWL operation error requires a message.");
    }
    if (typeof isRetryable !== "boolean") {
      throw new TypeError("isRetryable must be a Boolean predicate.");
    }

    const boundedMessage =
      truncateOntologyDerivedText(message).ontologyDerivedText;
    super(boundedMessage);

    Object.defineProperty(this, "name", {
      configurable: true,
      value: "WebVowlOperationError",
    });
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: cause,
      });
    }

    this.code = code;
    this.isRetryable = isRetryable;
    this.details = createBoundedPublicErrorDetails(details);
    validatedWebVowlOperationErrorInstances.add(this);
    Object.freeze(this);
  }
}

export function toPublicWebVowlError(operationError) {
  if (!validatedWebVowlOperationErrorInstances.has(operationError)) {
    throw new TypeError(
      "Only an expected WebVowlOperationError can be projected publicly.",
    );
  }

  return Object.freeze({
    code: operationError.code,
    message: operationError.message,
    isRetryable: operationError.isRetryable,
    details: Object.freeze({ ...operationError.details }),
  });
}

function normalizedSvgBasename(filename) {
  const pathSegments = filename.normalize("NFC").split(/[\\/]/u);
  const finalPathSegment = pathSegments.at(-1) ?? "";
  const basenameWithoutSvgSuffix = finalPathSegment
    .trim()
    .replace(/(?:\.svg|[ .])+$/iu, "");
  return [...basenameWithoutSvgSuffix]
    .map((character) => {
      const characterCodePoint = character.codePointAt(0);
      const isControlCharacter =
        characterCodePoint <= 0x1f || characterCodePoint === 0x7f;
      return isControlCharacter ||
        PORTABLE_FILENAME_UNSAFE_PUNCTUATION.includes(character)
        ? "-"
        : character;
    })
    .join("");
}

function prefixWindowsReservedDeviceBasename(basename) {
  return WINDOWS_RESERVED_DEVICE_BASENAME_PATTERN.test(basename)
    ? `-${basename}`
    : basename;
}

export function normalizeSvgFilename(filename = DEFAULT_SVG_FILENAME) {
  if (typeof filename !== "string") {
    throw new TypeError("An SVG filename must be a string when provided.");
  }

  let basename = normalizedSvgBasename(filename);
  if (basename === "" || basename === "." || basename === "..") {
    basename = DEFAULT_SVG_FILENAME.slice(0, -SVG_FILENAME_SUFFIX.length);
  }
  basename = prefixWindowsReservedDeviceBasename(basename);

  const maximumBasenameCharacters =
    MAX_NORMALIZED_SVG_FILENAME_CHARACTERS - SVG_FILENAME_SUFFIX.length;
  basename = truncateWithoutSplittingSurrogatePair(
    basename,
    maximumBasenameCharacters,
  ).replace(/(?:\.svg|[ .])+$/iu, "");

  if (basename === "") {
    basename = DEFAULT_SVG_FILENAME.slice(0, -SVG_FILENAME_SUFFIX.length);
  }
  basename = prefixWindowsReservedDeviceBasename(basename);

  return `${basename}${SVG_FILENAME_SUFFIX}`;
}

function assertOntologyElementKind(kind) {
  if (!ONTOLOGY_ELEMENT_KINDS.includes(kind)) {
    throw new TypeError(`Unsupported ontology-element kind: ${kind}`);
  }
}

function assertPositiveLoadGeneration(loadGeneration) {
  if (!Number.isInteger(loadGeneration) || loadGeneration < 1) {
    throw new TypeError("loadGeneration must be a positive integer.");
  }
}

export function createOntologyElementReference({
  iri,
  kind,
  loadGeneration,
  localId,
}) {
  assertOntologyElementKind(kind);

  if (typeof iri === "string" && iri.length > 0) {
    return Object.freeze({ kind, iri });
  }

  assertPositiveLoadGeneration(loadGeneration);
  if (typeof localId !== "string" || localId.length === 0) {
    throw new TypeError(
      "An anonymous ontology element requires a non-empty localId.",
    );
  }

  return Object.freeze({ kind, loadGeneration, localId });
}

function createElementNotFoundError(referenceKind, cause) {
  return new WebVowlOperationError({
    cause,
    code: "ELEMENT_NOT_FOUND",
    details: referenceKind === undefined ? undefined : { referenceKind },
    message: "The ontology element reference is not current or valid.",
  });
}

export function assertCurrentOntologyElementReference(
  ontologyElementReference,
  currentLoadGeneration,
) {
  assertPositiveLoadGeneration(currentLoadGeneration);

  let referenceKind;
  let normalizedReference;
  try {
    if (
      ontologyElementReference === null ||
      typeof ontologyElementReference !== "object" ||
      Array.isArray(ontologyElementReference)
    ) {
      throw new TypeError("An ontology-element reference must be an object.");
    }

    referenceKind =
      typeof ontologyElementReference.kind === "string"
        ? ontologyElementReference.kind
        : undefined;

    const referenceFieldNames = Object.keys(ontologyElementReference).sort();
    const isStableReference = typeof ontologyElementReference.iri === "string";
    const expectedFieldNames = isStableReference
      ? ["iri", "kind"]
      : ["kind", "loadGeneration", "localId"];
    if (
      referenceFieldNames.length !== expectedFieldNames.length ||
      referenceFieldNames.some(
        (fieldName, index) => fieldName !== expectedFieldNames[index],
      )
    ) {
      throw new TypeError(
        "An ontology-element reference has an invalid field set.",
      );
    }

    normalizedReference = createOntologyElementReference(
      ontologyElementReference,
    );
  } catch (error) {
    throw createElementNotFoundError(referenceKind, error);
  }

  if (
    "loadGeneration" in normalizedReference &&
    normalizedReference.loadGeneration !== currentLoadGeneration
  ) {
    throw createElementNotFoundError(normalizedReference.kind);
  }
  return normalizedReference;
}

function cloneAndFreezeControllerStateValue(stateValue, ancestorObjects) {
  if (
    stateValue === null ||
    typeof stateValue === "string" ||
    typeof stateValue === "boolean" ||
    stateValue === undefined
  ) {
    return stateValue;
  }
  if (typeof stateValue === "number" && Number.isFinite(stateValue)) {
    return stateValue;
  }
  if (typeof stateValue !== "object") {
    throw new TypeError("Controller state must contain only plain data.");
  }
  if (ancestorObjects.has(stateValue)) {
    throw new TypeError("Controller state must not contain cycles.");
  }

  ancestorObjects.add(stateValue);
  let clonedStateValue;
  if (Array.isArray(stateValue)) {
    clonedStateValue = [];
    for (let index = 0; index < stateValue.length; index += 1) {
      clonedStateValue.push(
        cloneAndFreezeControllerStateValue(stateValue[index], ancestorObjects),
      );
    }
  } else {
    if (!isPlainRecord(stateValue)) {
      throw new TypeError("Controller state must contain only plain objects.");
    }
    if (
      Object.getOwnPropertySymbols(stateValue).some((symbol) =>
        Object.prototype.propertyIsEnumerable.call(stateValue, symbol),
      )
    ) {
      throw new TypeError(
        "Controller state must not contain enumerable symbol fields.",
      );
    }
    clonedStateValue = Object.fromEntries(
      Object.entries(stateValue).map(([fieldName, fieldValue]) => [
        fieldName,
        cloneAndFreezeControllerStateValue(fieldValue, ancestorObjects),
      ]),
    );
  }
  ancestorObjects.delete(stateValue);
  return Object.freeze(clonedStateValue);
}

export function freezeWebVowlControllerState(controllerState) {
  if (
    controllerState === null ||
    typeof controllerState !== "object" ||
    Array.isArray(controllerState)
  ) {
    throw new TypeError("Controller state must be a plain object.");
  }
  return cloneAndFreezeControllerStateValue(controllerState, new WeakSet());
}
