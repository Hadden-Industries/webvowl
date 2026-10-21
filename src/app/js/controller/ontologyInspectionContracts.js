// Application-owned semantic inspection data. No renderer dependency.
import {
  assertPlainRecord,
  assertExactFieldNames,
  assertPositiveLoadGeneration,
  assertNonEmptyString,
  assertNullableNonEmptyString,
  createFrozenOntologyElementReference,
  createFrozenReferenceCollection,
  deepFreezePlainData,
} from "./controllerDataContracts.js";

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
