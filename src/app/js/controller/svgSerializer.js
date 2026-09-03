import {
  createRenderedSvgSnapshot,
  createVisualizationViewApplicationRequest,
} from "./renderedGraphRuntimeContracts.js";

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";
const SVG_SERIALIZER_DEPENDENCY_FIELD_NAMES = Object.freeze([
  "XMLSerializerConstructor",
  "documentObject",
  "webVowlVersion",
]);
const SVG_VIEW_RECIPE_FIELD_NAMES = Object.freeze([
  "pageLocalViewRecipeId",
  "source",
  "loadGeneration",
  "appliedVisualizationView",
  "viewportDimensions",
  "layoutOutcome",
]);
const APPLIED_VISUALIZATION_VIEW_FIELD_NAMES = Object.freeze([
  "language",
  "filters",
  "focus",
  "layout",
  "viewport",
  "zoomScale",
]);
const SOURCE_PROVENANCE_FIELD_NAMES = Object.freeze([
  "kind",
  "identity",
  "sha256Hex",
]);
const VIEWPORT_DIMENSION_FIELD_NAMES = Object.freeze(["widthPx", "heightPx"]);
const LAYOUT_OUTCOME_FIELD_NAMES = Object.freeze(["status", "reason"]);
const SHA256_HEX_CHARACTER_SET = new Set("0123456789abcdef");

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

function assertPlainRecord(candidate, description) {
  if (!isPlainRecord(candidate)) {
    throw new TypeError(`${description} must be a plain object.`);
  }
}

function assertExactFieldNames(record, expectedFieldNames, description) {
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

function assertExactDependencyFieldNames(
  dependencies,
  expectedFieldNames,
  description,
) {
  assertPlainRecord(dependencies, description);
  const actualFieldNames = Object.keys(dependencies).sort();
  const sortedExpectedFieldNames = [...expectedFieldNames].sort();
  if (
    actualFieldNames.length !== sortedExpectedFieldNames.length ||
    actualFieldNames.some(
      (fieldName, index) => fieldName !== sortedExpectedFieldNames[index],
    )
  ) {
    throw new TypeError(`${description} has an invalid dependency field set.`);
  }
}

function assertAllowedFieldNames(record, allowedFieldNames, description) {
  assertPlainRecord(record, description);
  const unsupportedFieldName = Object.keys(record).find(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unsupportedFieldName !== undefined) {
    throw new TypeError(
      `${description} contains unsupported field ${unsupportedFieldName}.`,
    );
  }
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

function assertPositiveLoadGeneration(loadGeneration) {
  if (!Number.isInteger(loadGeneration) || loadGeneration < 1) {
    throw new TypeError("loadGeneration must be a positive integer.");
  }
}

function assertNonNegativeFiniteNumber(value, fieldName) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative finite number.`);
  }
}

function assertSha256Hex(sha256Hex) {
  const normalizedSha256Hex = sha256Hex.toLowerCase();
  if (
    normalizedSha256Hex.length !== 64 ||
    [...normalizedSha256Hex].some(
      (character) => !SHA256_HEX_CHARACTER_SET.has(character),
    )
  ) {
    throw new TypeError(
      "source.sha256Hex must be a 64-character hexadecimal SHA-256 digest.",
    );
  }
  return normalizedSha256Hex;
}

function createSourceProvenance(source) {
  assertAllowedFieldNames(
    source,
    SOURCE_PROVENANCE_FIELD_NAMES,
    "view recipe source",
  );
  if (!("kind" in source) || !("identity" in source)) {
    throw new TypeError("view recipe source requires kind and identity.");
  }
  assertNonEmptyString(source.kind, "source.kind");
  assertNonEmptyString(source.identity, "source.identity");

  const normalizedSource = {
    kind: source.kind,
    identity: source.identity,
  };
  if (source.sha256Hex !== undefined) {
    if (typeof source.sha256Hex !== "string") {
      throw new TypeError("source.sha256Hex must be a string when provided.");
    }
    normalizedSource.sha256Hex = assertSha256Hex(source.sha256Hex);
  }
  return Object.freeze(normalizedSource);
}

function createAppliedVisualizationView(
  appliedVisualizationView,
  loadGeneration,
) {
  assertExactFieldNames(
    appliedVisualizationView,
    APPLIED_VISUALIZATION_VIEW_FIELD_NAMES,
    "applied visualization view",
  );
  const normalizedApplicationRequest =
    createVisualizationViewApplicationRequest({
      ...appliedVisualizationView,
      loadGeneration,
    });
  const {
    loadGeneration: normalizedLoadGeneration,
    ...normalizedVisualizationView
  } = normalizedApplicationRequest;
  if (normalizedLoadGeneration !== loadGeneration) {
    throw new RangeError(
      "The applied visualization view loadGeneration must match its view recipe.",
    );
  }
  return Object.freeze(normalizedVisualizationView);
}

function createViewportDimensions(viewportDimensions) {
  assertExactFieldNames(
    viewportDimensions,
    VIEWPORT_DIMENSION_FIELD_NAMES,
    "view recipe viewport dimensions",
  );
  assertNonNegativeFiniteNumber(viewportDimensions.widthPx, "widthPx");
  assertNonNegativeFiniteNumber(viewportDimensions.heightPx, "heightPx");
  return Object.freeze({
    widthPx: viewportDimensions.widthPx,
    heightPx: viewportDimensions.heightPx,
  });
}

function createLayoutOutcome(layoutOutcome) {
  assertExactFieldNames(
    layoutOutcome,
    LAYOUT_OUTCOME_FIELD_NAMES,
    "view recipe layout outcome",
  );
  const isSettledOutcome =
    layoutOutcome.status === "settled" &&
    ["native-end", "stable-frames"].includes(layoutOutcome.reason);
  const isBestEffortOutcome =
    layoutOutcome.status === "best-effort" &&
    layoutOutcome.reason === "timeout";
  if (!isSettledOutcome && !isBestEffortOutcome) {
    throw new TypeError(
      "layoutOutcome must describe native-end, stable-frames, or explicit best-effort timeout.",
    );
  }
  return Object.freeze({
    status: layoutOutcome.status,
    reason: layoutOutcome.reason,
  });
}

export function createSvgViewRecipe(viewRecipe) {
  assertExactFieldNames(
    viewRecipe,
    SVG_VIEW_RECIPE_FIELD_NAMES,
    "SVG view recipe",
  );
  assertNonEmptyString(
    viewRecipe.pageLocalViewRecipeId,
    "pageLocalViewRecipeId",
  );
  assertPositiveLoadGeneration(viewRecipe.loadGeneration);

  return Object.freeze({
    pageLocalViewRecipeId: viewRecipe.pageLocalViewRecipeId,
    source: createSourceProvenance(viewRecipe.source),
    loadGeneration: viewRecipe.loadGeneration,
    appliedVisualizationView: createAppliedVisualizationView(
      viewRecipe.appliedVisualizationView,
      viewRecipe.loadGeneration,
    ),
    viewportDimensions: createViewportDimensions(viewRecipe.viewportDimensions),
    layoutOutcome: createLayoutOutcome(viewRecipe.layoutOutcome),
  });
}

function assertSerializerDependencies({
  XMLSerializerConstructor,
  documentObject,
  webVowlVersion,
}) {
  if (typeof XMLSerializerConstructor !== "function") {
    throw new TypeError("XMLSerializerConstructor must be a constructor.");
  }
  for (const documentMethodName of [
    "createComment",
    "createDocumentFragment",
    "createElementNS",
  ]) {
    if (typeof documentObject?.[documentMethodName] !== "function") {
      throw new TypeError(
        `documentObject.${documentMethodName} must be a function.`,
      );
    }
  }
  assertNonEmptyString(webVowlVersion, "webVowlVersion");
}

function throwIfOperationAborted(signal) {
  if (signal === undefined) {
    return;
  }
  if (typeof signal?.throwIfAborted !== "function") {
    throw new TypeError("signal must be an AbortSignal when provided.");
  }
  signal.throwIfAborted();
}

function assertOperationOptions(options) {
  assertAllowedFieldNames(options, ["signal"], "SVG serialization options");
}

export function createSvgSerializer(dependencies) {
  assertExactDependencyFieldNames(
    dependencies,
    SVG_SERIALIZER_DEPENDENCY_FIELD_NAMES,
    "SVG serializer dependencies",
  );
  const { XMLSerializerConstructor, documentObject, webVowlVersion } =
    dependencies;
  assertSerializerDependencies({
    XMLSerializerConstructor,
    documentObject,
    webVowlVersion,
  });

  return Object.freeze({
    serializeRenderedSvgSnapshot(
      { renderedSvgSnapshot, viewRecipe },
      options = {},
    ) {
      assertOperationOptions(options);
      throwIfOperationAborted(options.signal);

      const ownedRenderedSvgSnapshot =
        createRenderedSvgSnapshot(renderedSvgSnapshot);
      const normalizedViewRecipe = createSvgViewRecipe(viewRecipe);
      if (
        normalizedViewRecipe.loadGeneration !==
        ownedRenderedSvgSnapshot.loadGeneration
      ) {
        throw new RangeError(
          "The SVG view recipe loadGeneration must match the rendered SVG snapshot.",
        );
      }
      if (
        normalizedViewRecipe.viewportDimensions.widthPx !==
          ownedRenderedSvgSnapshot.widthPx ||
        normalizedViewRecipe.viewportDimensions.heightPx !==
          ownedRenderedSvgSnapshot.heightPx
      ) {
        throw new RangeError(
          "The SVG view recipe viewport dimensions must match the rendered SVG snapshot.",
        );
      }
      throwIfOperationAborted(options.signal);

      const serializedSvgRoot = ownedRenderedSvgSnapshot.detachedSvgRoot;
      serializedSvgRoot.setAttribute("version", "1.1");
      serializedSvgRoot.setAttribute("xmlns", SVG_NAMESPACE_IRI);
      serializedSvgRoot.setAttribute("width", ownedRenderedSvgSnapshot.widthPx);
      serializedSvgRoot.setAttribute(
        "height",
        ownedRenderedSvgSnapshot.heightPx,
      );
      serializedSvgRoot.setAttribute(
        "viewBox",
        `0 0 ${ownedRenderedSvgSnapshot.widthPx} ${ownedRenderedSvgSnapshot.heightPx}`,
      );

      const metadataElement = documentObject.createElementNS(
        SVG_NAMESPACE_IRI,
        "metadata",
      );
      metadataElement.textContent = JSON.stringify({
        webVowlVersion,
        ...normalizedViewRecipe,
      });
      serializedSvgRoot.appendChild(metadataElement);

      const serializedSvgDocument = documentObject.createDocumentFragment();
      serializedSvgDocument.appendChild(
        documentObject.createComment(
          `Created with WebVOWL (version ${webVowlVersion}), https://github.com/Hadden-Industries/webvowl`,
        ),
      );
      serializedSvgDocument.appendChild(serializedSvgRoot);
      throwIfOperationAborted(options.signal);
      return new XMLSerializerConstructor().serializeToString(
        serializedSvgDocument,
      );
    },
  });
}
