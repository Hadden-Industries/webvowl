import {
  createOntologyElementReference,
  createVowlDocumentRecordTarget,
} from "./webVowlControllerContracts.js";
import {
  createVowlDocumentInsertionRecords,
  VOWL_EDITOR_CLASS_TYPES,
  VOWL_EDITOR_PROPERTY_TYPES,
} from "./ontologyEditorDrawingRecords.js";
import { createRenderedOccurrenceReference } from "./renderedArrangementContracts.js";

export const RENDERED_GRAPH_RUNTIME_METHOD_NAMES = Object.freeze([
  "replaceVowlModel",
  "applyVowlModelRevision",
  "clearRenderedGraph",
  "applyVisualizationView",
  "readVisibleRenderedGraphSnapshot",
  "readGraphLayoutSnapshot",
  "readRenderedArrangement",
  "setRenderedArrangement",
  "selectRenderedOccurrence",
  "setGraphLayoutPaused",
  "setContinuousZoom",
  "setForceLayoutDistances",
  "setVisualizationModes",
  "resetVisualization",
  "setOntologyEditorOptions",
  "resizeVisualizationViewport",
  "setRenderingDiagnosticsEnabled",
  "createRenderedSvgSnapshot",
  "createRenderedDrawingSnapshot",
  "subscribeToRenderedGraphEvents",
  "dispose",
]);

// Names the seam once carried and must never regain. The ontology model is
// owned by the application, so a runtime offering to read it would reopen a
// second, renderer-owned source of the same facts.
export const RETIRED_RENDERED_GRAPH_RUNTIME_METHOD_NAMES = Object.freeze([
  "readOntologyInspectionSnapshot",
]);

export const RENDERED_GRAPH_EVENT_KINDS = Object.freeze([
  "render-progress-changed",
  "render-warning-raised",
  "rendered-element-selection-changed",
  "document-record-selection-changed",
  "record-label-edit-requested",
  "record-creation-requested",
  "semantic-creation-requested",
  "record-endpoint-edit-requested",
  "record-deletion-requested",
  "viewport-changed",
  "visualization-view-changed",
  "degree-filter-range-changed",
  "graph-layout-state-changed",
  "editor-mode-changed",
  "rendering-statistics-changed",
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
const APPLIED_VISUALIZATION_VIEW_FIELD_NAMES = Object.freeze([
  "language",
  "filters",
  "focus",
  "modes",
  "forceDistances",
]);
const VISUALIZATION_VIEW_REQUEST_FIELD_NAMES = Object.freeze([
  "language",
  "filters",
  "focus",
  "layout",
  "viewport",
  "zoomScale",
  "translation",
]);

export const VISUALIZATION_VIEWPORT_LIMITS = Object.freeze({
  minimumZoomScale: 0.01,
  maximumZoomScale: 4,
  maximumAbsoluteTranslationPx: Number.MAX_SAFE_INTEGER,
});

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

function createOntologyHeaderRecord({
  annotationRecords = [],
  ...ontologyHeaderRecord
}) {
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
  if (
    ontologyHeaderRecord.versionInformationText !== null &&
    typeof ontologyHeaderRecord.versionInformationText !== "string"
  ) {
    throw new TypeError(
      "ontologyHeaderRecord.versionInformationText must be a string or null.",
    );
  }
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
    annotationRecords: createAnnotationRecordCollection(
      annotationRecords,
      "ontology header annotations",
    ),
  });
}

// The eight characteristics OWL defines for a property. VOWL keeps them in one
// flat bag alongside class-expression kinds and status markers; only these have
// an unambiguous OWL reading, so only these are classified.
const OWL_PROPERTY_CHARACTERISTIC_NAMES = Object.freeze([
  "functional",
  "inverse functional",
  "transitive",
  "symmetric",
  "asymmetric",
  "reflexive",
  "irreflexive",
  "key",
]);

const ANNOTATION_VALUE_KINDS = Object.freeze(["literal", "iri"]);

// The OWL type VOWL states for an element, such as `owl:Class` or
// `owl:ObjectProperty`. An individual is declared by the class that names it
// and carries no type of its own, so the field is nullable.
function createElementTypeName(elementTypeName, description) {
  if (elementTypeName === null) {
    return null;
  }
  assertNonEmptyString(elementTypeName, description);
  return elementTypeName;
}

function createAnnotationRecord(annotationRecord, description) {
  assertExactFieldNames(
    annotationRecord,
    ["localName", "propertyIri", "languageTag", "text", "valueKind"],
    description,
  );
  assertNonEmptyString(annotationRecord.localName, `${description}.localName`);
  // VOWL groups annotations under a bare local name, which cannot distinguish
  // two annotation properties from different namespaces. A model converted
  // before the current builder records no namespace, so the IRI is genuinely
  // unknown rather than absent.
  if (
    annotationRecord.propertyIri !== null &&
    typeof annotationRecord.propertyIri !== "string"
  ) {
    throw new TypeError(`${description}.propertyIri must be a string or null.`);
  }
  if (
    annotationRecord.languageTag !== null &&
    typeof annotationRecord.languageTag !== "string"
  ) {
    throw new TypeError(`${description}.languageTag must be a string or null.`);
  }
  if (typeof annotationRecord.text !== "string") {
    throw new TypeError(`${description}.text must be a string.`);
  }
  if (!ANNOTATION_VALUE_KINDS.includes(annotationRecord.valueKind)) {
    throw new TypeError(
      `${description}.valueKind must be one of ${ANNOTATION_VALUE_KINDS.join(", ")}.`,
    );
  }
  return Object.freeze({
    localName: annotationRecord.localName,
    propertyIri: annotationRecord.propertyIri,
    languageTag: annotationRecord.languageTag,
    text: annotationRecord.text,
    valueKind: annotationRecord.valueKind,
  });
}

function createAnnotationRecordCollection(annotationRecords, description) {
  if (!Array.isArray(annotationRecords)) {
    throw new TypeError(`${description} must be an array.`);
  }
  return Object.freeze(
    annotationRecords.map((annotationRecord) =>
      createAnnotationRecord(annotationRecord, description),
    ),
  );
}

function createAttributeNameCollection(attributeNames, description) {
  if (!Array.isArray(attributeNames)) {
    throw new TypeError(`${description} must be an array.`);
  }
  return Object.freeze(
    attributeNames.map((attributeName) => {
      assertNonEmptyString(attributeName, description);
      return attributeName;
    }),
  );
}

function createCharacteristicNameCollection(characteristicNames, description) {
  const names = createAttributeNameCollection(characteristicNames, description);
  for (const characteristicName of names) {
    if (!OWL_PROPERTY_CHARACTERISTIC_NAMES.includes(characteristicName)) {
      throw new TypeError(
        `${description} must contain only OWL property characteristics.`,
      );
    }
  }
  return names;
}

function createCardinalityRecord(cardinalityRecord, description) {
  assertExactFieldNames(
    cardinalityRecord,
    ["exact", "minimum", "maximum"],
    description,
  );
  for (const boundName of ["exact", "minimum", "maximum"]) {
    const boundValue = cardinalityRecord[boundName];
    if (
      boundValue !== null &&
      (!Number.isInteger(boundValue) || boundValue < 0)
    ) {
      throw new TypeError(
        `${description}.${boundName} must be a non-negative integer or null.`,
      );
    }
  }
  return Object.freeze({
    exact: cardinalityRecord.exact,
    minimum: cardinalityRecord.minimum,
    maximum: cardinalityRecord.maximum,
  });
}

function createCommonOntologyElementRecord(
  record,
  expectedKind,
  exactFieldNames,
  description,
) {
  const { canonicalDisplay, relationGroups, ...fields } = record;
  assertExactFieldNames(fields, exactFieldNames, description);
  if (relationGroups !== undefined) {
    assertPlainRecord(relationGroups, "relationGroups");
    for (const [field, indices] of Object.entries(relationGroups)) {
      if (
        !exactFieldNames.includes(field) ||
        !field.endsWith("References") ||
        !Array.isArray(indices) ||
        indices.some((index) => !Number.isSafeInteger(index) || index < 0)
      ) {
        throw new TypeError("Invalid inspection relation group indices.");
      }
    }
  }
  return {
    ...(relationGroups === undefined
      ? {}
      : {
          relationGroups: deepFreezePlainData(structuredClone(relationGroups)),
        }),
    ...(canonicalDisplay === undefined
      ? {}
      : {
          canonicalDisplay: deepFreezePlainData(
            structuredClone(canonicalDisplay),
          ),
        }),
    ontologyElementReference: createFrozenOntologyElementReference(
      record.ontologyElementReference,
      [expectedKind],
      `${description}.ontologyElementReference`,
    ),
    elementTypeName: createElementTypeName(
      record.elementTypeName,
      `${description}.elementTypeName`,
    ),
    labelRecords: createLocalizedTextRecordCollection(
      record.labelRecords,
      `${description}.labelRecords`,
    ),
    commentRecords: createLocalizedTextRecordCollection(
      record.commentRecords,
      `${description}.commentRecords`,
    ),
    descriptionRecords: createLocalizedTextRecordCollection(
      record.descriptionRecords,
      `${description}.descriptionRecords`,
    ),
    annotationRecords: createAnnotationRecordCollection(
      record.annotationRecords,
      `${description}.annotationRecords`,
    ),
    characteristicNames: createCharacteristicNameCollection(
      record.characteristicNames,
      `${description}.characteristicNames`,
    ),
    unclassifiedAttributeNames: createAttributeNameCollection(
      record.unclassifiedAttributeNames,
      `${description}.unclassifiedAttributeNames`,
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
        "elementTypeName",
        "labelRecords",
        "commentRecords",
        "descriptionRecords",
        "annotationRecords",
        "characteristicNames",
        "unclassifiedAttributeNames",
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
      [
        "ontologyElementReference",
        "elementTypeName",
        "labelRecords",
        "commentRecords",
        "descriptionRecords",
        "annotationRecords",
        "characteristicNames",
        "unclassifiedAttributeNames",
      ],
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
        "elementTypeName",
        "labelRecords",
        "commentRecords",
        "descriptionRecords",
        "annotationRecords",
        "characteristicNames",
        "unclassifiedAttributeNames",
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
        "elementTypeName",
        "labelRecords",
        "commentRecords",
        "descriptionRecords",
        "annotationRecords",
        "characteristicNames",
        "unclassifiedAttributeNames",
        "domainReferences",
        "rangeReferences",
        "superpropertyReferences",
        "inversePropertyReferences",
        "equivalentPropertyReferences",
        "subpropertyReferences",
        "cardinalityRecord",
      ],
      description,
    ),
    cardinalityRecord: createCardinalityRecord(
      propertyRecord.cardinalityRecord,
      `${description}.cardinalityRecord`,
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
    equivalentPropertyReferences: createFrozenReferenceCollection(
      propertyRecord.equivalentPropertyReferences,
      ["property"],
      "equivalentPropertyReferences",
    ),
    subpropertyReferences: createFrozenReferenceCollection(
      propertyRecord.subpropertyReferences,
      ["property"],
      "subpropertyReferences",
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
  for (const methodName of RETIRED_RENDERED_GRAPH_RUNTIME_METHOD_NAMES) {
    if (renderedGraphRuntime[methodName] !== undefined) {
      throw new TypeError(
        `RenderedGraphRuntime must not expose the retired ${methodName} method.`,
      );
    }
  }
  return renderedGraphRuntime;
}

export function createOntologyInspectionSnapshot(snapshot) {
  const { retainedFacts, relationGroups, ...fields } = snapshot;
  if (relationGroups !== undefined && !Array.isArray(relationGroups)) {
    throw new TypeError("relationGroups must be an array.");
  }
  assertExactFieldNames(
    fields,
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

  const groups =
    relationGroups === undefined
      ? undefined
      : relationGroups.map((group) =>
          createFrozenReferenceCollection(
            group,
            ["class", "datatype", "individual", "property"],
            "relationGroups",
          ),
        );
  for (const collection of [
    snapshot.classRecords,
    snapshot.propertyRecords,
    snapshot.datatypeRecords,
    snapshot.individualRecords,
  ]) {
    for (const record of collection) {
      for (const indices of Object.values(record.relationGroups ?? {})) {
        if (
          !Array.isArray(indices) ||
          indices.some(
            (index) =>
              !Number.isSafeInteger(index) ||
              index < 0 ||
              index >= (groups?.length ?? 0),
          )
        ) {
          throw new TypeError(
            "Inspection relation group index is out of bounds.",
          );
        }
      }
    }
  }
  return Object.freeze({
    ...(groups === undefined ? {} : { relationGroups: Object.freeze(groups) }),
    ...(retainedFacts === undefined
      ? {}
      : { retainedFacts: deepFreezePlainData(structuredClone(retainedFacts)) }),
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
  // Glyph counts and semantic references are distinct: one equivalence glyph
  // can name several entities, and a subclass edge is not a property entity.
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

function createOwnedVowlModel(vowlModel) {
  assertPlainRecord(vowlModel, "vowlModel");
  let ownedVowlModel;
  try {
    ownedVowlModel = structuredClone(vowlModel);
  } catch (error) {
    throw new TypeError("vowlModel must be structured-cloneable.", {
      cause: error,
    });
  }
  return deepFreezePlainData(ownedVowlModel);
}

export function createVowlModelRevisionRequest(request) {
  assertExactFieldNames(
    request,
    ["loadGeneration", "vowlModel"],
    "VOWL model revision request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  return Object.freeze({
    loadGeneration: request.loadGeneration,
    vowlModel: createOwnedVowlModel(request.vowlModel),
  });
}

/** Drawing DTOs carry no encoder authority; semantics remain application-owned. */
export function createCanonicalDrawingRequest(
  request,
  { revision = false } = {},
) {
  assertExactFieldNames(
    request,
    [
      "loadGeneration",
      "documentRevision",
      "drawing",
      revision ? "baseRevision" : "layout",
      ...(!revision && request.initialVisualization !== undefined
        ? ["initialVisualization"]
        : []),
    ],
    "Canonical drawing request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  assertNonNegativeInteger(request.documentRevision, "documentRevision");
  if (revision) {
    assertNonNegativeInteger(request.baseRevision, "baseRevision");
    if (
      request.documentRevision !== request.baseRevision &&
      request.documentRevision !== request.baseRevision + 1
    ) {
      throw new RangeError(
        "A drawing revision must describe the current or next document revision.",
      );
    }
  } else if (!["pause", "resume"].includes(request.layout)) {
    throw new TypeError(
      "A canonical drawing requires an explicit layout choice.",
    );
  }
  assertPlainRecord(request.drawing, "canonical drawing");
  return Object.freeze({
    ...request,
    drawing: deepFreezePlainData(structuredClone(request.drawing)),
    ...(request.initialVisualization === undefined
      ? {}
      : {
          initialVisualization: createInitialVisualizationRequest(
            request.initialVisualization,
          ),
        }),
  });
}

export function createVowlModelReplacementRequest(request) {
  assertAllowedFieldNames(
    request,
    ["loadGeneration", "vowlModel", "initialVisualization"],
    "VOWL model replacement request",
  );
  assertPositiveLoadGeneration(request.loadGeneration);
  return Object.freeze({
    loadGeneration: request.loadGeneration,
    vowlModel: createOwnedVowlModel(request.vowlModel),
    ...(request.initialVisualization === undefined
      ? {}
      : {
          initialVisualization: createInitialVisualizationRequest(
            request.initialVisualization,
          ),
        }),
  });
}

export function createInitialVisualizationRequest(initial) {
  assertAllowedFieldNames(
    initial,
    ["view", "modes", "forceDistances"],
    "initial visualization",
  );
  if (initial.view?.viewport !== undefined) {
    throw new TypeError(
      "Initial visualization accepts viewport coordinates, not viewport actions.",
    );
  }
  return Object.freeze({
    ...(initial.view === undefined
      ? {}
      : { view: createVisualizationViewRequest(initial.view) }),
    ...(initial.modes === undefined
      ? {}
      : { modes: createVisualizationModesRequest(initial.modes) }),
    ...(initial.forceDistances === undefined
      ? {}
      : {
          forceDistances: createForceLayoutDistancesRequest(
            initial.forceDistances,
          ),
        }),
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
    if (!Number.isSafeInteger(filters.minDegree) || filters.minDegree < 0) {
      throw new RangeError("minDegree must be a non-negative safe integer.");
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

// Pause preserves the current arrangement by stopping automatic motion;
// resume restarts it. Omission requests neither action.
export const VISUALIZATION_LAYOUT_ACTIONS = Object.freeze(["pause", "resume"]);

function assertLayoutDirective(layout) {
  if (!VISUALIZATION_LAYOUT_ACTIONS.includes(layout)) {
    throw new TypeError(
      `layout must be ${VISUALIZATION_LAYOUT_ACTIONS.join(", ")}.`,
    );
  }
}

// Zoom and center changes magnification and pan to frame the visible graph.
// Focus-next brings the next highlighted occurrence into view.
export const VISUALIZATION_VIEWPORT_ACTIONS = Object.freeze([
  "zoom-and-center",
  "focus-next",
]);

// A held zoom control reports that a gesture started and that it ended. The
// renderer owns the animation between those two facts, because the viewport is
// renderer-owned and a per-frame write through an asynchronous, generation
// fenced operation would be sixty round trips a second.
const CONTINUOUS_ZOOM_DIRECTIONS = Object.freeze(["in", "out", "none"]);

// Force distances are renderer tuning: they change how the graph is laid out,
// never what the ontology says. The charge the simulation derives from them is
// the renderer's own business and is not part of this request.
const FORCE_LAYOUT_DISTANCE_FIELD_NAMES = Object.freeze([
  "classDistancePx",
  "datatypeDistancePx",
]);

// How the graph is drawn rather than what it says. Editor mode is deliberately
// absent: this plan publishes it as a fact so a presentation module can read
// it, and opens no vocabulary for entering or leaving it.
const VISUALIZATION_MODE_PREDICATE_FIELD_NAMES = Object.freeze([
  "colorExternals",
  "compactNotation",
  "nodeScaling",
  "dynamicLabelWidth",
  "pickAndPin",
]);

// How external elements are coloured when that mode is on: one shared colour,
// or a gradient across them.
const COLOR_EXTERNALS_MODES = Object.freeze(["same", "gradient"]);

export const DEFAULT_VISUALIZATION_FILTERS = Object.freeze({
  datatypes: "show",
  objectProperties: "show",
  subclasses: "show",
  disjointness: "hide",
  setOperators: "show",
  minDegree: 0,
});

export const DEFAULT_VISUALIZATION_MODES = Object.freeze({
  colorExternals: true,
  compactNotation: false,
  nodeScaling: true,
  dynamicLabelWidth: true,
  pickAndPin: false,
  maxLabelWidthPx: 120,
  colorExternalsMode: "same",
});

export const DEFAULT_FORCE_LAYOUT_DISTANCES = Object.freeze({
  classDistancePx: 200,
  datatypeDistancePx: 120,
});

export const VISUALIZATION_SLIDER_LIMITS = Object.freeze({
  minimumLabelWidthPx: 20,
  minimumForceDistancePx: 10,
  maximumPx: 600,
  stepPx: 10,
});

function assertSliderValue(value, fieldName, minimum) {
  assertFiniteNumber(value, fieldName, { minimum });
  const { maximumPx, stepPx } = VISUALIZATION_SLIDER_LIMITS;
  if (value > maximumPx || value % stepPx !== 0) {
    throw new RangeError(
      `${fieldName} must be from ${minimum} through ${maximumPx} in steps of ${stepPx} pixels.`,
    );
  }
}

export function createVisualizationModesRequest(request) {
  assertAllowedFieldNames(
    request,
    [
      ...VISUALIZATION_MODE_PREDICATE_FIELD_NAMES,
      "maxLabelWidthPx",
      "colorExternalsMode",
    ],
    "visualization mode request",
  );
  const requestedModes = {};
  for (const fieldName of VISUALIZATION_MODE_PREDICATE_FIELD_NAMES) {
    if (request[fieldName] === undefined) {
      continue;
    }
    if (typeof request[fieldName] !== "boolean") {
      throw new TypeError(`${fieldName} must be a boolean.`);
    }
    requestedModes[fieldName] = request[fieldName];
  }
  if (request.maxLabelWidthPx !== undefined) {
    assertSliderValue(
      request.maxLabelWidthPx,
      "maxLabelWidthPx",
      VISUALIZATION_SLIDER_LIMITS.minimumLabelWidthPx,
    );
    requestedModes.maxLabelWidthPx = request.maxLabelWidthPx;
  }
  if (request.colorExternalsMode !== undefined) {
    if (!COLOR_EXTERNALS_MODES.includes(request.colorExternalsMode)) {
      throw new TypeError(
        `colorExternalsMode must be one of ${COLOR_EXTERNALS_MODES.join(", ")}.`,
      );
    }
    requestedModes.colorExternalsMode = request.colorExternalsMode;
  }
  if (Object.keys(requestedModes).length === 0) {
    throw new TypeError(
      "A visualization mode request must name at least one mode.",
    );
  }
  return Object.freeze(requestedModes);
}

export function createForceLayoutDistancesRequest(request) {
  assertAllowedFieldNames(
    request,
    FORCE_LAYOUT_DISTANCE_FIELD_NAMES,
    "force layout distances request",
  );
  const requestedDistances = {};
  for (const fieldName of FORCE_LAYOUT_DISTANCE_FIELD_NAMES) {
    if (request[fieldName] === undefined) {
      continue;
    }
    assertSliderValue(
      request[fieldName],
      fieldName,
      VISUALIZATION_SLIDER_LIMITS.minimumForceDistancePx,
    );
    requestedDistances[fieldName] = request[fieldName];
  }
  if (Object.keys(requestedDistances).length === 0) {
    throw new TypeError(
      "A force layout distances request must name at least one distance.",
    );
  }
  return Object.freeze(requestedDistances);
}

export function createContinuousZoomRequest(request) {
  assertExactFieldNames(request, ["zoomDirection"], "continuous zoom request");
  if (!CONTINUOUS_ZOOM_DIRECTIONS.includes(request.zoomDirection)) {
    throw new TypeError(
      `zoomDirection must be one of ${CONTINUOUS_ZOOM_DIRECTIONS.join(", ")}.`,
    );
  }
  return Object.freeze({ zoomDirection: request.zoomDirection });
}

function assertViewportDirective(viewport) {
  if (!VISUALIZATION_VIEWPORT_ACTIONS.includes(viewport)) {
    throw new TypeError(
      `viewport must be one of ${VISUALIZATION_VIEWPORT_ACTIONS.join(", ")}.`,
    );
  }
}

function createVisualizationViewSettings(view, { requireEveryField }) {
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
  return Object.freeze(normalizedView);
}

export function createAppliedVisualizationView(view) {
  assertExactFieldNames(
    view,
    APPLIED_VISUALIZATION_VIEW_FIELD_NAMES,
    "applied visualization view",
  );
  assertExactFieldNames(
    view.modes,
    Object.keys(DEFAULT_VISUALIZATION_MODES),
    "applied visualization modes",
  );
  assertExactFieldNames(
    view.forceDistances,
    FORCE_LAYOUT_DISTANCE_FIELD_NAMES,
    "applied force distances",
  );
  return Object.freeze({
    ...createVisualizationViewSettings(view, { requireEveryField: true }),
    modes: createVisualizationModesRequest(view.modes),
    forceDistances: createForceLayoutDistancesRequest(view.forceDistances),
  });
}

export function createVisualizationViewApplicationRequest(request) {
  assertAllowedFieldNames(
    request,
    ["loadGeneration", ...VISUALIZATION_VIEW_REQUEST_FIELD_NAMES],
    "visualization view application request",
  );
  if (!("loadGeneration" in request)) {
    throw new TypeError(
      "visualization view application request requires loadGeneration.",
    );
  }
  assertPositiveLoadGeneration(request.loadGeneration);
  const { loadGeneration, ...viewRequest } = request;
  return Object.freeze({
    ...createVisualizationViewRequest(viewRequest),
    loadGeneration,
  });
}

export function createVisualizationViewRequest(request) {
  assertAllowedFieldNames(
    request,
    VISUALIZATION_VIEW_REQUEST_FIELD_NAMES,
    "visualization view request",
  );
  const normalizedRequest = {
    ...createVisualizationViewSettings(request, {
      requireEveryField: false,
    }),
  };
  if (request.layout !== undefined) {
    assertLayoutDirective(request.layout);
    normalizedRequest.layout = request.layout;
  }
  if (request.viewport !== undefined) {
    assertViewportDirective(request.viewport);
    normalizedRequest.viewport = request.viewport;
  }
  if (request.zoomScale !== undefined) {
    assertFiniteNumber(request.zoomScale, "zoomScale", {
      minimum: VISUALIZATION_VIEWPORT_LIMITS.minimumZoomScale,
    });
    if (request.zoomScale > VISUALIZATION_VIEWPORT_LIMITS.maximumZoomScale) {
      throw new RangeError("zoomScale must be at most 4.");
    }
    normalizedRequest.zoomScale = request.zoomScale;
  }
  if (request.translation !== undefined) {
    assertExactFieldNames(
      request.translation,
      ["xPx", "yPx"],
      "viewport translation",
    );
    for (const field of ["xPx", "yPx"]) {
      assertFiniteNumber(request.translation[field], `translation.${field}`);
      if (
        Math.abs(request.translation[field]) >
        VISUALIZATION_VIEWPORT_LIMITS.maximumAbsoluteTranslationPx
      ) {
        throw new RangeError(
          `translation.${field} is outside the supported pixel range.`,
        );
      }
    }
    normalizedRequest.translation = Object.freeze({ ...request.translation });
  }
  return Object.freeze(normalizedRequest);
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
    appliedVisualizationView: createAppliedVisualizationView(
      result.appliedVisualizationView,
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
    case "document-record-selection-changed":
      assertExactFieldNames(
        payload,
        [
          "recordTarget",
          ...(payload.occurrence === undefined ? [] : ["occurrence"]),
        ],
        `${kind} payload`,
      );
      return Object.freeze({
        recordTarget:
          payload.recordTarget === null
            ? null
            : createVowlDocumentRecordTarget(payload.recordTarget),
        ...(payload.occurrence === undefined
          ? {}
          : {
              occurrence: createRenderedOccurrenceReference(payload.occurrence),
            }),
      });
    case "record-deletion-requested": {
      const semantic = payload.recordTarget?.recordToken !== undefined;
      assertExactFieldNames(
        payload,
        ["recordTarget", ...(semantic ? ["documentRevision"] : [])],
        `${kind} payload`,
      );
      if (
        semantic &&
        (!Number.isSafeInteger(payload.documentRevision) ||
          payload.documentRevision < 0)
      ) {
        throw new TypeError(
          "A semantic deletion requires its document revision.",
        );
      }
      return Object.freeze({
        recordTarget: createVowlDocumentRecordTarget(payload.recordTarget),
        ...(semantic ? { documentRevision: payload.documentRevision } : {}),
      });
    }
    case "semantic-creation-requested": {
      assertExactFieldNames(
        payload,
        [
          "type",
          "position",
          "documentRevision",
          "fromTarget",
          "toTarget",
          "datatype",
        ],
        `${kind} payload`,
      );
      assertExactFieldNames(payload.position, ["x", "y"], "Creation position");
      const isClass = VOWL_EDITOR_CLASS_TYPES.includes(payload.type);
      const isData = payload.type === "owl:datatypeProperty";
      if (
        (!isClass && !VOWL_EDITOR_PROPERTY_TYPES.includes(payload.type)) ||
        !Number.isSafeInteger(payload.documentRevision) ||
        payload.documentRevision < 0 ||
        !Number.isFinite(payload.position.x) ||
        !Number.isFinite(payload.position.y) ||
        (isData
          ? typeof payload.datatype !== "string" || !payload.datatype
          : payload.datatype !== null) ||
        (isClass
          ? payload.fromTarget !== null || payload.toTarget !== null
          : payload.fromTarget === null ||
            (isData ? payload.toTarget !== null : payload.toTarget === null))
      ) {
        throw new TypeError("Invalid semantic creation intent.");
      }
      const fromTarget =
        payload.fromTarget === null
          ? null
          : createVowlDocumentRecordTarget(payload.fromTarget);
      const toTarget =
        payload.toTarget === null
          ? null
          : createVowlDocumentRecordTarget(payload.toTarget);
      if (
        [fromTarget, toTarget].some(
          (target) => target !== null && target.recordToken === undefined,
        ) ||
        (fromTarget &&
          toTarget &&
          fromTarget.loadGeneration !== toTarget.loadGeneration)
      ) {
        throw new TypeError(
          "Creation endpoints require current semantic targets.",
        );
      }
      return Object.freeze({
        ...payload,
        position: Object.freeze({ ...payload.position }),
        fromTarget,
        toTarget,
      });
    }
    case "record-creation-requested": {
      assertExactFieldNames(
        payload,
        ["records", "selectedRecord", "editLabel"],
        `${kind} payload`,
      );
      if (typeof payload.editLabel !== "boolean") {
        throw new TypeError(
          "Creation must state whether to begin inline label editing.",
        );
      }
      const records = createVowlDocumentInsertionRecords(payload.records);
      const selectedRecord =
        payload.selectedRecord === null
          ? null
          : createVowlDocumentRecordTarget(payload.selectedRecord);
      if (
        selectedRecord &&
        !records.some(
          (record) =>
            record.collection === selectedRecord.collection &&
            record.id === selectedRecord.recordId,
        )
      ) {
        throw new TypeError("Creation can select only one of its new records.");
      }
      return Object.freeze({
        records,
        selectedRecord,
        editLabel: payload.editLabel,
      });
    }
    case "record-endpoint-edit-requested": {
      if (payload.recordTarget?.recordToken !== undefined) {
        assertExactFieldNames(
          payload,
          [
            "recordTarget",
            "nodeTarget",
            "endpoint",
            "labelPosition",
            "documentRevision",
          ],
          `${kind} payload`,
        );
        const recordTarget = createVowlDocumentRecordTarget(
          payload.recordTarget,
        );
        const nodeTarget = createVowlDocumentRecordTarget(payload.nodeTarget);
        assertExactFieldNames(
          payload.labelPosition,
          ["xPx", "yPx"],
          "Label position",
        );
        if (
          nodeTarget.recordToken === undefined ||
          nodeTarget.loadGeneration !== recordTarget.loadGeneration ||
          !["domain", "range"].includes(payload.endpoint) ||
          !Number.isSafeInteger(payload.documentRevision) ||
          payload.documentRevision < 0 ||
          !Number.isFinite(payload.labelPosition.xPx) ||
          !Number.isFinite(payload.labelPosition.yPx)
        ) {
          throw new TypeError(
            "A semantic endpoint edit requires current exact targets, revision and finite geometry.",
          );
        }
        return Object.freeze({
          ...payload,
          recordTarget,
          nodeTarget,
          labelPosition: Object.freeze({ ...payload.labelPosition }),
        });
      }
      assertExactFieldNames(
        payload,
        ["recordTarget", "endpoint", "nodeRecordId", "labelPosition"],
        `${kind} payload`,
      );
      const recordTarget = createVowlDocumentRecordTarget(payload.recordTarget);
      if (
        recordTarget.collection !== "property" ||
        !["domain", "range"].includes(payload.endpoint) ||
        typeof payload.nodeRecordId !== "string"
      ) {
        throw new TypeError(
          "An endpoint edit requires a property and its new node.",
        );
      }
      assertExactFieldNames(
        payload.labelPosition,
        ["xPx", "yPx"],
        "Label position",
      );
      if (
        !Number.isFinite(payload.labelPosition.xPx) ||
        !Number.isFinite(payload.labelPosition.yPx)
      ) {
        throw new TypeError("Label position must be finite.");
      }
      return Object.freeze({
        ...payload,
        recordTarget,
        labelPosition: Object.freeze({ ...payload.labelPosition }),
      });
    }
    case "record-label-edit-requested": {
      const semantic = payload.recordTarget?.recordToken !== undefined;
      assertExactFieldNames(
        payload,
        [
          "recordTarget",
          "text",
          "deriveIriFromLabel",
          ...(semantic ? ["documentRevision"] : []),
        ],
        `${kind} payload`,
      );
      if (
        semantic &&
        (!Number.isSafeInteger(payload.documentRevision) ||
          payload.documentRevision < 0)
      ) {
        throw new TypeError(
          "A semantic label edit requires its document revision.",
        );
      }
      if (
        typeof payload.text !== "string" ||
        typeof payload.deriveIriFromLabel !== "boolean"
      ) {
        throw new TypeError(
          "An inline label edit requires text and an explicit IRI derivation choice.",
        );
      }
      return Object.freeze({
        recordTarget: createVowlDocumentRecordTarget(payload.recordTarget),
        text: payload.text,
        deriveIriFromLabel: payload.deriveIriFromLabel,
        ...(semantic ? { documentRevision: payload.documentRevision } : {}),
      });
    }
    case "rendering-statistics-changed":
      assertExactFieldNames(
        payload,
        ["framesPerSecond", "nodeCount", "linkCount"],
        `${kind} payload`,
      );
      if (
        !Number.isFinite(payload.framesPerSecond) ||
        payload.framesPerSecond < 0
      ) {
        throw new TypeError("framesPerSecond must be nonnegative and finite.");
      }
      assertNonNegativeInteger(payload.nodeCount, "nodeCount");
      assertNonNegativeInteger(payload.linkCount, "linkCount");
      return Object.freeze({ ...payload });
    case "editor-mode-changed":
      assertExactFieldNames(payload, ["isEditorMode"], `${kind} payload`);
      if (typeof payload.isEditorMode !== "boolean") {
        throw new TypeError("isEditorMode must be a boolean.");
      }
      return Object.freeze({ isEditorMode: payload.isEditorMode });
    case "degree-filter-range-changed":
      assertExactFieldNames(
        payload,
        ["maximumDegree", "automaticMinimumDegree"],
        `${kind} payload`,
      );
      assertNonNegativeInteger(payload.maximumDegree, "maximumDegree");
      assertNonNegativeInteger(
        payload.automaticMinimumDegree,
        "automaticMinimumDegree",
      );
      if (payload.automaticMinimumDegree > payload.maximumDegree) {
        throw new RangeError(
          "Automatic minimum degree cannot exceed the maximum degree.",
        );
      }
      return Object.freeze({ ...payload });
    case "visualization-view-changed":
      assertExactFieldNames(
        payload,
        ["appliedVisualizationView"],
        `${kind} payload`,
      );
      return Object.freeze({
        appliedVisualizationView: createAppliedVisualizationView(
          payload.appliedVisualizationView,
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
