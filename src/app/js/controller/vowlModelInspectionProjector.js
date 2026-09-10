import { createOntologyInspectionSnapshot } from "./renderedGraphRuntimeContracts.js";

// VOWL states a subclass or disjointness relation as a property record whose
// domain and range name the two classes, rather than as a field on the class.
const SUBCLASS_PROPERTY_TYPE = "rdfs:subclassof";
const DISJOINT_PROPERTY_TYPE = "owl:disjointwith";

function vowlBaseRecords(vowlModelCollection) {
  return Array.isArray(vowlModelCollection) ? vowlModelCollection : [];
}

function ontologyElementReferenceForVowlRecord(
  vowlRecord,
  kind,
  loadGeneration,
) {
  if (typeof vowlRecord.iri === "string" && vowlRecord.iri.length > 0) {
    return { kind, iri: vowlRecord.iri };
  }
  return {
    kind,
    loadGeneration,
    localId: String(vowlRecord.id ?? "anonymous"),
  };
}

function localizedTextRecords(vowlLabelValue) {
  // VOWL writes a label either as a language-keyed object or, for elements
  // with no language information, as a bare string.
  if (typeof vowlLabelValue === "string") {
    return vowlLabelValue.length > 0
      ? [{ languageTag: null, text: vowlLabelValue }]
      : [];
  }
  if (vowlLabelValue === null || typeof vowlLabelValue !== "object") {
    return [];
  }
  return Object.entries(vowlLabelValue)
    .filter(([, text]) => typeof text === "string" && text.length > 0)
    .map(([languageTag, text]) => ({
      languageTag: languageTag === "undefined" ? null : languageTag,
      text,
    }));
}

// VOWL JSON splits every element in two: a bare entry in `class`, `property`
// or `datatype` carrying the id and type, and an entry in the matching
// `*Attribute` collection carrying the IRI, labels and comments. An inspection
// record needs both, so they are merged by id before projection.
function mergeVowlElementsWithAttributes(baseCollection, attributeCollection) {
  const attributesById = new Map(
    vowlBaseRecords(attributeCollection).map((attributeRecord) => [
      String(attributeRecord.id),
      attributeRecord,
    ]),
  );
  return vowlBaseRecords(baseCollection).map((baseRecord) => ({
    ...baseRecord,
    ...(attributesById.get(String(baseRecord.id)) ?? {}),
  }));
}

// The eight characteristics OWL defines for a property. VOWL keeps them in one
// flat `attributes` bag alongside class-expression kinds such as `union` and
// status markers such as `external`; only these eight have an unambiguous OWL
// reading, so the rest stay unclassified rather than acquiring an invented
// taxonomy.
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

function characteristicNamesFrom(vowlAttributeNames) {
  return vowlBaseRecords(vowlAttributeNames).filter((attributeName) =>
    OWL_PROPERTY_CHARACTERISTIC_NAMES.includes(attributeName),
  );
}

function unclassifiedAttributeNamesFrom(vowlAttributeNames) {
  return vowlBaseRecords(vowlAttributeNames).filter(
    (attributeName) =>
      !OWL_PROPERTY_CHARACTERISTIC_NAMES.includes(attributeName),
  );
}

// VOWL groups annotations under the annotation property's bare local name and,
// since the current converter, records the rest of the IRI beside each value as
// `predicateNs`. A model converted before that carries no namespace, so the
// property IRI is unknown rather than absent and is projected as null.
function annotationRecordsFrom(vowlAnnotations) {
  if (vowlAnnotations === null || typeof vowlAnnotations !== "object") {
    return [];
  }
  return Object.entries(vowlAnnotations).flatMap(([localName, annotations]) =>
    vowlBaseRecords(annotations)
      .filter(
        (annotation) =>
          annotation !== null &&
          typeof annotation === "object" &&
          typeof annotation.value === "string",
      )
      .map((annotation) => ({
        localName,
        propertyIri:
          typeof annotation.predicateNs === "string" &&
          annotation.predicateNs.length > 0
            ? `${annotation.predicateNs}${localName}`
            : null,
        languageTag:
          typeof annotation.language === "string" &&
          annotation.language !== "undefined"
            ? annotation.language
            : null,
        text: annotation.value,
        valueKind: annotation.type === "iri" ? "iri" : "literal",
      })),
  );
}

function cardinalityBound(vowlCardinalityValue) {
  const boundValue = Number(vowlCardinalityValue);
  return Number.isInteger(boundValue) && boundValue >= 0 ? boundValue : null;
}

function cardinalityRecordFrom(vowlRecord) {
  return {
    exact: cardinalityBound(vowlRecord.cardinality),
    minimum: cardinalityBound(vowlRecord.minCardinality),
    maximum: cardinalityBound(vowlRecord.maxCardinality),
  };
}

// The descriptive fields every element record carries, whatever its kind.
function describedElementFields(vowlRecord) {
  return {
    elementTypeName:
      typeof vowlRecord.type === "string" && vowlRecord.type.length > 0
        ? vowlRecord.type
        : null,
    labelRecords: localizedTextRecords(vowlRecord.label),
    commentRecords: localizedTextRecords(vowlRecord.comment),
    descriptionRecords: localizedTextRecords(vowlRecord.description),
    annotationRecords: annotationRecordsFrom(vowlRecord.annotations),
    characteristicNames: characteristicNamesFrom(vowlRecord.attributes),
    unclassifiedAttributeNames: unclassifiedAttributeNamesFrom(
      vowlRecord.attributes,
    ),
  };
}

function referencesByVowlElementId(mergedRecords, kind, loadGeneration) {
  return new Map(
    mergedRecords.map((mergedRecord) => [
      String(mergedRecord.id),
      ontologyElementReferenceForVowlRecord(mergedRecord, kind, loadGeneration),
    ]),
  );
}

// One ontology entity may be drawn several times, so a reference key groups
// every occurrence of the same entity. FOAF draws owl:Thing six times and
// rdfs:Literal twenty-one times under one IRI each.
export function ontologyElementReferenceKey(ontologyElementReference) {
  return typeof ontologyElementReference.iri === "string"
    ? `iri:${ontologyElementReference.iri}`
    : `localId:${ontologyElementReference.localId}`;
}

// The renderer identifies a drawn element by its VOWL id, so this is the one
// translation between renderer identity and ontology identity. It is derived
// from the model rather than from anything the renderer holds.
export function indexOntologyElementReferencesByVowlElementId(
  vowlModel,
  loadGeneration,
) {
  return new Map([
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.class,
        vowlModel.classAttribute,
      ),
      "class",
      loadGeneration,
    ),
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.property,
        vowlModel.propertyAttribute,
      ),
      "property",
      loadGeneration,
    ),
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.datatype,
        vowlModel.datatypeAttribute,
      ),
      "datatype",
      loadGeneration,
    ),
  ]);
}

function resolveReferences(vowlElementIds, referencesById) {
  const candidateIds = Array.isArray(vowlElementIds)
    ? vowlElementIds
    : vowlElementIds === undefined || vowlElementIds === null
      ? []
      : [vowlElementIds];
  return candidateIds.flatMap((vowlElementId) => {
    const reference = referencesById.get(String(vowlElementId));
    return reference === undefined ? [] : [{ ...reference }];
  });
}

// Collects the class-to-class edges VOWL expresses as property records.
// `superclassReferences` follows one direction because subclassing is not
// symmetric; `disjointClassReferences` follows both because disjointness is.
function collectClassRelationEdges(mergedProperties) {
  const superclassIdsBySubclassId = new Map();
  const disjointIdsByClassId = new Map();
  const addEdge = (edgesByClassId, fromId, toId) => {
    const existingIds = edgesByClassId.get(fromId) ?? [];
    existingIds.push(toId);
    edgesByClassId.set(fromId, existingIds);
  };

  for (const mergedProperty of mergedProperties) {
    const domainId =
      mergedProperty.domain === undefined
        ? undefined
        : String(mergedProperty.domain);
    const rangeId =
      mergedProperty.range === undefined
        ? undefined
        : String(mergedProperty.range);
    if (domainId === undefined || rangeId === undefined) {
      continue;
    }
    // VOWL's renderer matches its type tokens without case distinctions. This
    // does not normalize the IRIs identifying ontology elements.
    const propertyType = mergedProperty.type?.toLowerCase();
    if (propertyType === SUBCLASS_PROPERTY_TYPE) {
      addEdge(superclassIdsBySubclassId, domainId, rangeId);
    } else if (propertyType === DISJOINT_PROPERTY_TYPE) {
      addEdge(disjointIdsByClassId, domainId, rangeId);
      addEdge(disjointIdsByClassId, rangeId, domainId);
    }
  }

  return { superclassIdsBySubclassId, disjointIdsByClassId };
}

function projectIndividualRecords(
  mergedClasses,
  classReferencesById,
  loadGeneration,
) {
  return mergedClasses.flatMap((mergedClass) => {
    const declaringClassReference = classReferencesById.get(
      String(mergedClass.id),
    );
    return vowlBaseRecords(mergedClass.individuals).map(
      (individualRecord, individualIndex) => ({
        ontologyElementReference: ontologyElementReferenceForVowlRecord(
          {
            ...individualRecord,
            // An individual carries no VOWL id of its own, so an unnamed one
            // is addressed by its position within the class that declares it.
            id: `${mergedClass.id}-individual-${individualIndex}`,
          },
          "individual",
          loadGeneration,
        ),
        ...describedElementFields({
          ...individualRecord,
          label: individualRecord.labels ?? individualRecord.label,
        }),
        classReferences:
          declaringClassReference === undefined
            ? []
            : [{ ...declaringClassReference }],
      }),
    );
  });
}

export function projectOntologyInspectionSnapshot(vowlModel, loadGeneration) {
  const mergedClasses = mergeVowlElementsWithAttributes(
    vowlModel.class,
    vowlModel.classAttribute,
  );
  const mergedProperties = mergeVowlElementsWithAttributes(
    vowlModel.property,
    vowlModel.propertyAttribute,
  );
  const mergedDatatypes = mergeVowlElementsWithAttributes(
    vowlModel.datatype,
    vowlModel.datatypeAttribute,
  );

  const classReferencesById = referencesByVowlElementId(
    mergedClasses,
    "class",
    loadGeneration,
  );
  const datatypeReferencesById = referencesByVowlElementId(
    mergedDatatypes,
    "datatype",
    loadGeneration,
  );
  const propertyReferencesById = referencesByVowlElementId(
    mergedProperties,
    "property",
    loadGeneration,
  );
  // A property domain or range may name either a class or a datatype, and the
  // two identifier spaces do not overlap within one VOWL model.
  const classOrDatatypeReferencesById = new Map([
    ...classReferencesById,
    ...datatypeReferencesById,
  ]);
  const { superclassIdsBySubclassId, disjointIdsByClassId } =
    collectClassRelationEdges(mergedProperties);

  const classRecords = mergedClasses.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "class",
      loadGeneration,
    ),
    ...describedElementFields(vowlRecord),
    superclassReferences: resolveReferences(
      superclassIdsBySubclassId.get(String(vowlRecord.id)),
      classReferencesById,
    ),
    equivalentClassReferences: resolveReferences(
      vowlRecord.equivalent,
      classReferencesById,
    ),
    disjointClassReferences: resolveReferences(
      disjointIdsByClassId.get(String(vowlRecord.id)),
      classReferencesById,
    ),
  }));
  const propertyRecords = mergedProperties.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "property",
      loadGeneration,
    ),
    ...describedElementFields(vowlRecord),
    cardinalityRecord: cardinalityRecordFrom(vowlRecord),
    domainReferences: resolveReferences(
      vowlRecord.domain,
      classOrDatatypeReferencesById,
    ),
    rangeReferences: resolveReferences(
      vowlRecord.range,
      classOrDatatypeReferencesById,
    ),
    superpropertyReferences: resolveReferences(
      vowlRecord.superproperty,
      propertyReferencesById,
    ),
    inversePropertyReferences: resolveReferences(
      vowlRecord.inverse,
      propertyReferencesById,
    ),
    equivalentPropertyReferences: resolveReferences(
      vowlRecord.equivalent,
      propertyReferencesById,
    ),
    subpropertyReferences: resolveReferences(
      vowlRecord.subproperty,
      propertyReferencesById,
    ),
  }));
  const datatypeRecords = mergedDatatypes.map((vowlRecord) => ({
    ontologyElementReference: ontologyElementReferenceForVowlRecord(
      vowlRecord,
      "datatype",
      loadGeneration,
    ),
    ...describedElementFields(vowlRecord),
  }));

  const ontologyHeader = vowlModel.header ?? {};
  return createOntologyInspectionSnapshot({
    loadGeneration,
    ontologyHeaderRecord: {
      ontologyIri:
        typeof ontologyHeader.iri === "string" && ontologyHeader.iri.length > 0
          ? ontologyHeader.iri
          : null,
      versionInformationText:
        typeof ontologyHeader.version === "string"
          ? ontologyHeader.version
          : null,
      titleRecords: localizedTextRecords(ontologyHeader.title),
      descriptionRecords: localizedTextRecords(ontologyHeader.description),
      authorNames: Array.isArray(ontologyHeader.author)
        ? ontologyHeader.author.filter(
            (authorName) =>
              typeof authorName === "string" && authorName.length > 0,
          )
        : [],
    },
    classRecords,
    propertyRecords,
    datatypeRecords,
    individualRecords: projectIndividualRecords(
      mergedClasses,
      classReferencesById,
      loadGeneration,
    ),
    namespaceRecords: Array.isArray(vowlModel.namespace)
      ? vowlModel.namespace
          .filter((namespaceRecord) => namespaceRecord !== null)
          .map((namespaceRecord) => ({
            prefix: String(Object.keys(namespaceRecord)[0] ?? ""),
            namespaceIri: String(Object.values(namespaceRecord)[0] ?? ""),
          }))
          .filter(({ namespaceIri }) => namespaceIri.length > 0)
      : [],
    // Models converted before the current builder carry no import list, so an
    // absent field means unrecorded rather than none declared.
    importRecords: vowlBaseRecords(ontologyHeader.imports)
      .filter(
        (importedOntologyIri) =>
          typeof importedOntologyIri === "string" &&
          importedOntologyIri.length > 0,
      )
      .map((importedOntologyIri) => ({ importedOntologyIri })),
    availableLabelLanguages: [
      ...new Set(
        [...classRecords, ...propertyRecords, ...datatypeRecords]
          .flatMap(({ labelRecords }) => labelRecords)
          .map(({ languageTag }) => languageTag)
          .filter(
            (languageTag) =>
              typeof languageTag === "string" && languageTag.length > 0,
          ),
      ),
    ],
  });
}

// The injected shape the controller receives. The bare projection function
// stays exported so it can be exercised against real models without a
// controller, which is the point of moving it out of the renderer.
export const vowlModelInspectionProjector = Object.freeze({
  projectOntologyInspectionSnapshot,
});
