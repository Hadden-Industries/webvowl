import { createOntologyElementReference } from "./webVowlControllerContracts.js";

export const RENDERED_GRAPH_RUNTIME_METHOD_NAMES = Object.freeze([
  "replaceVowlModel",
  "applyVisualizationView",
  "readOntologyInspectionSnapshot",
  "readVisibleRenderedGraphSnapshot",
  "readGraphLayoutSnapshot",
  "setGraphLayoutPaused",
  "createRenderedSvgSnapshot",
  "subscribeToRenderedGraphEvents",
  "dispose",
]);

export const RENDERED_GRAPH_EVENT_KINDS = Object.freeze([
  "render-progress-changed",
  "render-warning-raised",
  "rendered-element-selection-changed",
  "viewport-changed",
  "graph-layout-state-changed",
]);

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";
const MAX_VISUALIZATION_FOCUS_REFERENCE_COUNT = 25;
const VISIBILITY_FILTER_FIELD_NAMES = Object.freeze([
  "datatypes",
  "objectProperties",
  "subclasses",
  "disjointness",
  "setOperators",
]);
const VISUALIZATION_FILTER_FIELD_NAMES = Object.freeze([
  ...VISIBILITY_FILTER_FIELD_NAMES,
  "minDegree",
]);
const VISUALIZATION_VIEW_FIELD_NAMES = Object.freeze([
  "language",
  "filters",
  "focus",
  "layout",
  "viewport",
]);

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

function assertAllowedFieldNames(record, allowedFieldNames, description) {
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

function assertPositiveLoadGeneration(loadGeneration) {
  if (!Number.isInteger(loadGeneration) || loadGeneration < 1) {
    throw new TypeError("loadGeneration must be a positive integer.");
  }
}

function assertNonNegativeInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${fieldName} must be a non-negative integer.`);
  }
}

function assertFiniteNumber(value, fieldName, { minimum } = {}) {
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

function assertBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${fieldName} must be a Boolean predicate.`);
  }
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }
}

function assertNullableNonEmptyString(value, fieldName) {
  if (value !== null) {
    assertNonEmptyString(value, fieldName);
  }
}

function createFrozenOntologyElementReference(
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

function createFrozenReferenceCollection(references, allowedKinds, fieldName) {
  if (!Array.isArray(references)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }
  return Object.freeze(
    references.map((reference) =>
      createFrozenOntologyElementReference(reference, allowedKinds, fieldName),
    ),
  );
}

function createLocalizedTextRecord(localizedTextRecord, description) {
  assertExactFieldNames(
    localizedTextRecord,
    ["languageTag", "text"],
    description,
  );
  assertNullableNonEmptyString(
    localizedTextRecord.languageTag,
    `${description}.languageTag`,
  );
  assertNonEmptyString(localizedTextRecord.text, `${description}.text`);
  return Object.freeze({
    languageTag: localizedTextRecord.languageTag,
    text: localizedTextRecord.text,
  });
}

function createLocalizedTextRecordCollection(records, fieldName) {
  if (!Array.isArray(records)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }
  return Object.freeze(
    records.map((record) => createLocalizedTextRecord(record, fieldName)),
  );
}

function createOntologyHeaderRecord(ontologyHeaderRecord) {
  assertExactFieldNames(
    ontologyHeaderRecord,
    [
      "ontologyIri",
      "versionInformationText",
      "titleRecords",
      "descriptionRecords",
      "authorNames",
    ],
    "ontology header record",
  );
  assertNullableNonEmptyString(
    ontologyHeaderRecord.ontologyIri,
    "ontologyHeaderRecord.ontologyIri",
  );
  assertNullableNonEmptyString(
    ontologyHeaderRecord.versionInformationText,
    "ontologyHeaderRecord.versionInformationText",
  );
  if (!Array.isArray(ontologyHeaderRecord.authorNames)) {
    throw new TypeError("ontologyHeaderRecord.authorNames must be an array.");
  }
  const authorNames = ontologyHeaderRecord.authorNames.map((authorName) => {
    assertNonEmptyString(authorName, "ontologyHeaderRecord.authorNames");
    return authorName;
  });
  return Object.freeze({
    ontologyIri: ontologyHeaderRecord.ontologyIri,
    versionInformationText: ontologyHeaderRecord.versionInformationText,
    titleRecords: createLocalizedTextRecordCollection(
      ontologyHeaderRecord.titleRecords,
      "ontologyHeaderRecord.titleRecords",
    ),
    descriptionRecords: createLocalizedTextRecordCollection(
      ontologyHeaderRecord.descriptionRecords,
      "ontologyHeaderRecord.descriptionRecords",
    ),
    authorNames: Object.freeze(authorNames),
  });
}

function createCommonOntologyElementRecord(
  record,
  expectedKind,
  exactFieldNames,
  description,
) {
  assertExactFieldNames(record, exactFieldNames, description);
  return {
    ontologyElementReference: createFrozenOntologyElementReference(
      record.ontologyElementReference,
      [expectedKind],
      `${description}.ontologyElementReference`,
    ),
    labelRecords: createLocalizedTextRecordCollection(
      record.labelRecords,
      `${description}.labelRecords`,
    ),
    commentRecords: createLocalizedTextRecordCollection(
      record.commentRecords,
      `${description}.commentRecords`,
    ),
  };
}

function createClassRecord(classRecord) {
  const description = "class record";
  return Object.freeze({
    ...createCommonOntologyElementRecord(
      classRecord,
      "class",
      [
        "ontologyElementReference",
        "labelRecords",
        "commentRecords",
        "superclassReferences",
        "equivalentClassReferences",
        "disjointClassReferences",
      ],
      description,
    ),
    superclassReferences: createFrozenReferenceCollection(
      classRecord.superclassReferences,
      ["class"],
      "superclassReferences",
    ),
    equivalentClassReferences: createFrozenReferenceCollection(
      classRecord.equivalentClassReferences,
      ["class"],
      "equivalentClassReferences",
    ),
    disjointClassReferences: createFrozenReferenceCollection(
      classRecord.disjointClassReferences,
      ["class"],
      "disjointClassReferences",
    ),
  });
}

function createDatatypeRecord(datatypeRecord) {
  return Object.freeze(
    createCommonOntologyElementRecord(
      datatypeRecord,
      "datatype",
      ["ontologyElementReference", "labelRecords", "commentRecords"],
      "datatype record",
    ),
  );
}

function createIndividualRecord(individualRecord) {
  const description = "individual record";
  return Object.freeze({
    ...createCommonOntologyElementRecord(
      individualRecord,
      "individual",
      [
        "ontologyElementReference",
        "labelRecords",
        "commentRecords",
        "classReferences",
      ],
      description,
    ),
    classReferences: createFrozenReferenceCollection(
      individualRecord.classReferences,
      ["class"],
      "classReferences",
    ),
  });
}

function createPropertyRecord(propertyRecord) {
  const description = "property record";
  return Object.freeze({
    ...createCommonOntologyElementRecord(
      propertyRecord,
      "property",
      [
        "ontologyElementReference",
        "labelRecords",
        "commentRecords",
        "domainReferences",
        "rangeReferences",
        "superpropertyReferences",
        "inversePropertyReferences",
      ],
      description,
    ),
    domainReferences: createFrozenReferenceCollection(
      propertyRecord.domainReferences,
      ["class", "datatype"],
      "domainReferences",
    ),
    rangeReferences: createFrozenReferenceCollection(
      propertyRecord.rangeReferences,
      ["class", "datatype"],
      "rangeReferences",
    ),
    superpropertyReferences: createFrozenReferenceCollection(
      propertyRecord.superpropertyReferences,
      ["property"],
      "superpropertyReferences",
    ),
    inversePropertyReferences: createFrozenReferenceCollection(
      propertyRecord.inversePropertyReferences,
      ["property"],
      "inversePropertyReferences",
    ),
  });
}

function createNamespaceRecord(namespaceRecord) {
  assertExactFieldNames(
    namespaceRecord,
    ["prefix", "namespaceIri"],
    "namespace record",
  );
  if (typeof namespaceRecord.prefix !== "string") {
    throw new TypeError("namespaceRecord.prefix must be a string.");
  }
  assertNonEmptyString(
    namespaceRecord.namespaceIri,
    "namespaceRecord.namespaceIri",
  );
  return Object.freeze({
    prefix: namespaceRecord.prefix,
    namespaceIri: namespaceRecord.namespaceIri,
  });
}

function createImportRecord(importRecord) {
  assertExactFieldNames(importRecord, ["importedOntologyIri"], "import record");
  assertNonEmptyString(
    importRecord.importedOntologyIri,
    "importRecord.importedOntologyIri",
  );
  return Object.freeze({
    importedOntologyIri: importRecord.importedOntologyIri,
  });
}

function createRecordCollection(records, fieldName, createRecord) {
  if (!Array.isArray(records)) {
    throw new TypeError(`${fieldName} must be an array.`);
  }
  return Object.freeze(records.map((record) => createRecord(record)));
}

export function assertRenderedGraphRuntime(renderedGraphRuntime) {
  if (
    renderedGraphRuntime === null ||
    (typeof renderedGraphRuntime !== "object" &&
      typeof renderedGraphRuntime !== "function")
  ) {
    throw new TypeError("RenderedGraphRuntime must be an object.");
  }
  for (const methodName of RENDERED_GRAPH_RUNTIME_METHOD_NAMES) {
    if (typeof renderedGraphRuntime[methodName] !== "function") {
      throw new TypeError(
        `RenderedGraphRuntime requires a ${methodName} method.`,
      );
    }
  }
  return renderedGraphRuntime;
}

export function createOntologyInspectionSnapshot(snapshot) {
  assertExactFieldNames(
    snapshot,
    [
      "loadGeneration",
      "ontologyHeaderRecord",
      "classRecords",
      "propertyRecords",
      "datatypeRecords",
      "individualRecords",
      "namespaceRecords",
      "importRecords",
      "availableLabelLanguages",
    ],
    "ontology inspection snapshot",
  );
  assertPositiveLoadGeneration(snapshot.loadGeneration);
  if (!Array.isArray(snapshot.availableLabelLanguages)) {
    throw new TypeError("availableLabelLanguages must be an array.");
  }
  const availableLabelLanguages = snapshot.availableLabelLanguages.map(
    (languageTag) => {
      assertNonEmptyString(languageTag, "availableLabelLanguages");
      return languageTag;
    },
  );

  return Object.freeze({
    loadGeneration: snapshot.loadGeneration,
    ontologyHeaderRecord: createOntologyHeaderRecord(
      snapshot.ontologyHeaderRecord,
    ),
    classRecords: createRecordCollection(
      snapshot.classRecords,
      "classRecords",
      createClassRecord,
    ),
    propertyRecords: createRecordCollection(
      snapshot.propertyRecords,
      "propertyRecords",
      createPropertyRecord,
    ),
    datatypeRecords: createRecordCollection(
      snapshot.datatypeRecords,
      "datatypeRecords",
      createDatatypeRecord,
    ),
    individualRecords: createRecordCollection(
      snapshot.individualRecords,
      "individualRecords",
      createIndividualRecord,
    ),
    namespaceRecords: createRecordCollection(
      snapshot.namespaceRecords,
      "namespaceRecords",
      createNamespaceRecord,
    ),
    importRecords: createRecordCollection(
      snapshot.importRecords,
      "importRecords",
      createImportRecord,
    ),
    availableLabelLanguages: Object.freeze(availableLabelLanguages),
  });
}

export function createVisibleRenderedGraphSnapshot(snapshot) {
  assertExactFieldNames(
    snapshot,
    [
      "loadGeneration",
      "visibleElementReferences",
      "visibleRelationshipReferences",
      "visibleGraphCounts",
    ],
    "visible rendered graph snapshot",
  );
  assertPositiveLoadGeneration(snapshot.loadGeneration);
  const visibleElementReferences = createFrozenReferenceCollection(
    snapshot.visibleElementReferences,
    ["class", "datatype", "individual"],
    "visibleElementReferences",
  );
  const visibleRelationshipReferences = createFrozenReferenceCollection(
    snapshot.visibleRelationshipReferences,
    ["property"],
    "visibleRelationshipReferences",
  );
  assertExactFieldNames(
    snapshot.visibleGraphCounts,
    ["visibleNodeCount", "visiblePropertyCount"],
    "visibleGraphCounts",
  );
  assertNonNegativeInteger(
    snapshot.visibleGraphCounts.visibleNodeCount,
    "visibleNodeCount",
  );
  assertNonNegativeInteger(
    snapshot.visibleGraphCounts.visiblePropertyCount,
    "visiblePropertyCount",
  );
  if (
    snapshot.visibleGraphCounts.visibleNodeCount !==
    visibleElementReferences.length
  ) {
    throw new RangeError(
      "visibleNodeCount must equal visibleElementReferences.length.",
    );
  }
  if (
    snapshot.visibleGraphCounts.visiblePropertyCount !==
    visibleRelationshipReferences.length
  ) {
    throw new RangeError(
      "visiblePropertyCount must equal visibleRelationshipReferences.length.",
    );
  }
  return Object.freeze({
    loadGeneration: snapshot.loadGeneration,
    visibleElementReferences,
    visibleRelationshipReferences,
    visibleGraphCounts: Object.freeze({
      visibleNodeCount: snapshot.visibleGraphCounts.visibleNodeCount,
      visiblePropertyCount: snapshot.visibleGraphCounts.visiblePropertyCount,
    }),
  });
}

export function createGraphLayoutSnapshot(snapshot) {
  assertExactFieldNames(
    snapshot,
    [
      "loadGeneration",
      "observedAtMs",
      "forceAlpha",
      "hasEnded",
      "isPaused",
      "widthPx",
      "heightPx",
      "layoutElementPositions",
    ],
    "graph layout snapshot",
  );
  assertPositiveLoadGeneration(snapshot.loadGeneration);
  assertFiniteNumber(snapshot.observedAtMs, "observedAtMs", { minimum: 0 });
  assertFiniteNumber(snapshot.forceAlpha, "forceAlpha", { minimum: 0 });
  assertBoolean(snapshot.hasEnded, "hasEnded");
  assertBoolean(snapshot.isPaused, "isPaused");
  assertFiniteNumber(snapshot.widthPx, "widthPx", { minimum: 0 });
  assertFiniteNumber(snapshot.heightPx, "heightPx", { minimum: 0 });
  if (!Array.isArray(snapshot.layoutElementPositions)) {
    throw new TypeError("layoutElementPositions must be an array.");
  }
  const stableLayoutElementKeys = new Set();
  const layoutElementPositions = snapshot.layoutElementPositions.map(
    (layoutElementPosition) => {
      assertExactFieldNames(
        layoutElementPosition,
        ["stableLayoutElementKey", "x", "y"],
        "layout element position",
      );
      assertNonEmptyString(
        layoutElementPosition.stableLayoutElementKey,
        "stableLayoutElementKey",
      );
      if (
        stableLayoutElementKeys.has(
          layoutElementPosition.stableLayoutElementKey,
        )
      ) {
        throw new RangeError(
          `Duplicate stableLayoutElementKey: ${layoutElementPosition.stableLayoutElementKey}`,
        );
      }
      stableLayoutElementKeys.add(layoutElementPosition.stableLayoutElementKey);
      assertFiniteNumber(layoutElementPosition.x, "layoutElementPosition.x");
      assertFiniteNumber(layoutElementPosition.y, "layoutElementPosition.y");
      return Object.freeze({
        stableLayoutElementKey: layoutElementPosition.stableLayoutElementKey,
        x: layoutElementPosition.x,
        y: layoutElementPosition.y,
      });
    },
  );
  return Object.freeze({
    loadGeneration: snapshot.loadGeneration,
    observedAtMs: snapshot.observedAtMs,
    forceAlpha: snapshot.forceAlpha,
    hasEnded: snapshot.hasEnded,
    isPaused: snapshot.isPaused,
    widthPx: snapshot.widthPx,
    heightPx: snapshot.heightPx,
    layoutElementPositions: Object.freeze(layoutElementPositions),
  });
}

function assertDetachedSvgRoot(detachedSvgRoot) {
  if (
    detachedSvgRoot === null ||
    typeof detachedSvgRoot !== "object" ||
    detachedSvgRoot.localName?.toLowerCase() !== "svg" ||
    detachedSvgRoot.namespaceURI !== SVG_NAMESPACE_IRI ||
    detachedSvgRoot.parentNode !== null ||
    typeof detachedSvgRoot.cloneNode !== "function"
  ) {
    throw new TypeError(
      "detachedSvgRoot must be a detached SVG DOM root with cloneNode support.",
    );
  }
}

export function createRenderedSvgSnapshot(snapshot) {
  assertExactFieldNames(
    snapshot,
    ["loadGeneration", "detachedSvgRoot", "widthPx", "heightPx"],
    "rendered SVG snapshot",
  );
  assertPositiveLoadGeneration(snapshot.loadGeneration);
  assertFiniteNumber(snapshot.widthPx, "widthPx", { minimum: 0 });
  assertFiniteNumber(snapshot.heightPx, "heightPx", { minimum: 0 });
  assertDetachedSvgRoot(snapshot.detachedSvgRoot);
  const ownedDetachedSvgRoot = snapshot.detachedSvgRoot.cloneNode(true);
  assertDetachedSvgRoot(ownedDetachedSvgRoot);
  if (ownedDetachedSvgRoot === snapshot.detachedSvgRoot) {
    throw new TypeError(
      "detachedSvgRoot.cloneNode(true) must return a new node.",
    );
  }
  return Object.freeze({
    loadGeneration: snapshot.loadGeneration,
    detachedSvgRoot: ownedDetachedSvgRoot,
    widthPx: snapshot.widthPx,
    heightPx: snapshot.heightPx,
  });
}

function deepFreezePlainData(plainDataValue, ancestorObjects = new WeakSet()) {
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
    throw new TypeError("VOWL model values must be plain structured data.");
  }
  if (ancestorObjects.has(plainDataValue)) {
    throw new TypeError("VOWL model values must not contain cycles.");
  }
  if (!Array.isArray(plainDataValue) && !isPlainRecord(plainDataValue)) {
    throw new TypeError("VOWL model values must contain only plain objects.");
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

export function createVowlModelReplacementRequest(request) {
  assertExactFieldNames(
    request,
    ["loadGeneration", "vowlModel", "displayName"],
    "VOWL model replacement request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  assertNonEmptyString(request.displayName, "displayName");
  assertPlainRecord(request.vowlModel, "vowlModel");
  let ownedVowlModel;
  try {
    ownedVowlModel = structuredClone(request.vowlModel);
  } catch (error) {
    throw new TypeError("vowlModel must be structured-cloneable.", {
      cause: error,
    });
  }
  return Object.freeze({
    loadGeneration: request.loadGeneration,
    vowlModel: deepFreezePlainData(ownedVowlModel),
    displayName: request.displayName,
  });
}

export function createVowlModelReplacementResult(result) {
  assertExactFieldNames(
    result,
    ["loadGeneration"],
    "VOWL model replacement result",
  );
  assertPositiveLoadGeneration(result.loadGeneration);
  return Object.freeze({ loadGeneration: result.loadGeneration });
}

function createVisualizationFilters(filters, { requireEveryField }) {
  if (requireEveryField) {
    assertExactFieldNames(
      filters,
      VISUALIZATION_FILTER_FIELD_NAMES,
      "visualization filters",
    );
  } else {
    assertAllowedFieldNames(
      filters,
      VISUALIZATION_FILTER_FIELD_NAMES,
      "visualization filters",
    );
  }
  const normalizedFilters = {};
  for (const fieldName of VISIBILITY_FILTER_FIELD_NAMES) {
    if (filters[fieldName] === undefined && !requireEveryField) {
      continue;
    }
    if (filters[fieldName] !== "show" && filters[fieldName] !== "hide") {
      throw new TypeError(`${fieldName} must be show or hide.`);
    }
    normalizedFilters[fieldName] = filters[fieldName];
  }
  if (filters.minDegree !== undefined || requireEveryField) {
    if (
      !Number.isInteger(filters.minDegree) ||
      filters.minDegree < 0 ||
      filters.minDegree > 100
    ) {
      throw new RangeError("minDegree must be an integer from 0 through 100.");
    }
    normalizedFilters.minDegree = filters.minDegree;
  }
  return Object.freeze(normalizedFilters);
}

function createVisualizationFocus(focus) {
  if (!Array.isArray(focus)) {
    throw new TypeError("focus must be an array.");
  }
  if (focus.length > MAX_VISUALIZATION_FOCUS_REFERENCE_COUNT) {
    throw new RangeError(
      `focus may contain at most ${MAX_VISUALIZATION_FOCUS_REFERENCE_COUNT} ontology-element references.`,
    );
  }
  return createFrozenReferenceCollection(
    focus,
    ["class", "datatype", "individual", "property"],
    "focus",
  );
}

function assertLayoutDirective(layout) {
  if (layout !== "preserve" && layout !== "relax") {
    throw new TypeError("layout must be preserve or relax.");
  }
}

// preserve leaves the viewport alone, fit frames the whole graph, and
// focus-next brings one focused element into view, advancing through them on
// repeat so a reader can step through every match.
const VIEWPORT_DIRECTIVES = Object.freeze(["preserve", "fit", "focus-next"]);

function assertViewportDirective(viewport) {
  if (!VIEWPORT_DIRECTIVES.includes(viewport)) {
    throw new TypeError(
      `viewport must be one of ${VIEWPORT_DIRECTIVES.join(", ")}.`,
    );
  }
}

function createVisualizationView(view, { requireEveryField }) {
  if (requireEveryField) {
    assertExactFieldNames(
      view,
      VISUALIZATION_VIEW_FIELD_NAMES,
      "applied visualization view",
    );
  } else {
    assertAllowedFieldNames(
      view,
      VISUALIZATION_VIEW_FIELD_NAMES,
      "visualization view application request",
    );
  }
  const normalizedView = {};
  if (view.language !== undefined || requireEveryField) {
    assertNonEmptyString(view.language, "language");
    normalizedView.language = view.language;
  }
  if (view.filters !== undefined || requireEveryField) {
    normalizedView.filters = createVisualizationFilters(view.filters, {
      requireEveryField,
    });
  }
  if (view.focus !== undefined || requireEveryField) {
    normalizedView.focus = createVisualizationFocus(view.focus);
  }
  if (view.layout !== undefined || requireEveryField) {
    assertLayoutDirective(view.layout);
    normalizedView.layout = view.layout;
  }
  if (view.viewport !== undefined || requireEveryField) {
    assertViewportDirective(view.viewport);
    normalizedView.viewport = view.viewport;
  }
  return Object.freeze(normalizedView);
}

export function createVisualizationViewApplicationRequest(request) {
  assertAllowedFieldNames(
    request,
    ["loadGeneration", ...VISUALIZATION_VIEW_FIELD_NAMES],
    "visualization view application request",
  );
  if (!("loadGeneration" in request)) {
    throw new TypeError(
      "visualization view application request requires loadGeneration.",
    );
  }
  assertPositiveLoadGeneration(request.loadGeneration);
  const { loadGeneration, ...visualizationView } = request;
  return Object.freeze({
    ...createVisualizationView(visualizationView, {
      requireEveryField: false,
    }),
    loadGeneration,
  });
}

export function createVisualizationViewApplicationResult(result) {
  assertExactFieldNames(
    result,
    [
      "loadGeneration",
      "appliedVisualizationView",
      "visibleRenderedGraphSnapshot",
    ],
    "visualization view application result",
  );
  assertPositiveLoadGeneration(result.loadGeneration);
  const visibleRenderedGraphSnapshot = createVisibleRenderedGraphSnapshot(
    result.visibleRenderedGraphSnapshot,
  );
  if (visibleRenderedGraphSnapshot.loadGeneration !== result.loadGeneration) {
    throw new RangeError(
      "The visible snapshot loadGeneration must match the view result loadGeneration.",
    );
  }
  return Object.freeze({
    loadGeneration: result.loadGeneration,
    appliedVisualizationView: createVisualizationView(
      result.appliedVisualizationView,
      { requireEveryField: true },
    ),
    visibleRenderedGraphSnapshot,
  });
}

export function createGraphLayoutPauseRequest(request) {
  assertExactFieldNames(
    request,
    ["loadGeneration", "isPaused"],
    "graph layout pause request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  assertBoolean(request.isPaused, "isPaused");
  return Object.freeze({
    loadGeneration: request.loadGeneration,
    isPaused: request.isPaused,
  });
}

export function createGraphLayoutPauseResult(result) {
  assertExactFieldNames(
    result,
    ["loadGeneration", "isPaused", "layoutStatus"],
    "graph layout pause result",
  );
  assertPositiveLoadGeneration(result.loadGeneration);
  assertBoolean(result.isPaused, "isPaused");
  if (!["paused", "relaxing", "settled"].includes(result.layoutStatus)) {
    throw new TypeError("layoutStatus must be paused, relaxing, or settled.");
  }
  if (
    (result.isPaused && result.layoutStatus !== "paused") ||
    (!result.isPaused && result.layoutStatus === "paused")
  ) {
    throw new TypeError("layoutStatus must agree with isPaused.");
  }
  return Object.freeze({
    loadGeneration: result.loadGeneration,
    isPaused: result.isPaused,
    layoutStatus: result.layoutStatus,
  });
}

export function createRenderedSvgSnapshotRequest(request) {
  assertExactFieldNames(
    request,
    ["loadGeneration"],
    "rendered SVG snapshot request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  return Object.freeze({ loadGeneration: request.loadGeneration });
}

function createRenderedGraphEventPayload(kind, payload) {
  switch (kind) {
    case "render-progress-changed": {
      assertExactFieldNames(
        payload,
        ["completedRenderedElementCount", "totalRenderedElementCount"],
        `${kind} payload`,
      );
      assertNonNegativeInteger(
        payload.completedRenderedElementCount,
        "completedRenderedElementCount",
      );
      assertNonNegativeInteger(
        payload.totalRenderedElementCount,
        "totalRenderedElementCount",
      );
      if (
        payload.completedRenderedElementCount >
        payload.totalRenderedElementCount
      ) {
        throw new RangeError(
          "completedRenderedElementCount cannot exceed totalRenderedElementCount.",
        );
      }
      return Object.freeze({
        completedRenderedElementCount: payload.completedRenderedElementCount,
        totalRenderedElementCount: payload.totalRenderedElementCount,
      });
    }
    case "render-warning-raised":
      assertExactFieldNames(
        payload,
        ["warningCode", "message"],
        `${kind} payload`,
      );
      assertNonEmptyString(payload.warningCode, "warningCode");
      assertNonEmptyString(payload.message, "message");
      return Object.freeze({
        warningCode: payload.warningCode,
        message: payload.message,
      });
    case "rendered-element-selection-changed":
      assertExactFieldNames(
        payload,
        ["selectedOntologyElementReferences"],
        `${kind} payload`,
      );
      return Object.freeze({
        selectedOntologyElementReferences: createFrozenReferenceCollection(
          payload.selectedOntologyElementReferences,
          ["class", "datatype", "individual", "property"],
          "selectedOntologyElementReferences",
        ),
      });
    case "viewport-changed":
      assertExactFieldNames(
        payload,
        ["zoomScale", "translationXPx", "translationYPx"],
        `${kind} payload`,
      );
      assertFiniteNumber(payload.zoomScale, "zoomScale", {
        minimum: Number.MIN_VALUE,
      });
      assertFiniteNumber(payload.translationXPx, "translationXPx");
      assertFiniteNumber(payload.translationYPx, "translationYPx");
      return Object.freeze({
        zoomScale: payload.zoomScale,
        translationXPx: payload.translationXPx,
        translationYPx: payload.translationYPx,
      });
    case "graph-layout-state-changed":
      assertExactFieldNames(
        payload,
        ["forceAlpha", "hasEnded", "isPaused"],
        `${kind} payload`,
      );
      assertFiniteNumber(payload.forceAlpha, "forceAlpha", { minimum: 0 });
      assertBoolean(payload.hasEnded, "hasEnded");
      assertBoolean(payload.isPaused, "isPaused");
      return Object.freeze({
        forceAlpha: payload.forceAlpha,
        hasEnded: payload.hasEnded,
        isPaused: payload.isPaused,
      });
    default:
      throw new RangeError(`Unsupported rendered-graph event kind: ${kind}`);
  }
}

export function createRenderedGraphEvent(event) {
  assertExactFieldNames(
    event,
    ["kind", "loadGeneration", "payload"],
    "rendered graph event",
  );
  if (!RENDERED_GRAPH_EVENT_KINDS.includes(event.kind)) {
    throw new RangeError(
      `Unsupported rendered-graph event kind: ${event.kind}`,
    );
  }
  assertPositiveLoadGeneration(event.loadGeneration);
  return Object.freeze({
    kind: event.kind,
    loadGeneration: event.loadGeneration,
    payload: createRenderedGraphEventPayload(event.kind, event.payload),
  });
}
