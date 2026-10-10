import { createOntologyInspectionSnapshot } from "./renderedGraphRuntimeContracts.js";
import { createOntologyElementReference } from "./webVowlControllerContracts.js";
import { indexVowlLabelCandidates } from "./vowlDisplayProjector.js";

const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const DC = "http://purl.org/dc/elements/1.1/";
const OWL = "http://www.w3.org/2002/07/owl#";
const KINDS = new Map([
  ["class", "class"],
  ["rdf-class", "class"],
  ["datatype", "datatype"],
  ["individual", "individual"],
  ["object-property", "property"],
  ["data-property", "property"],
  ["annotation-property", "property"],
  ["rdf-property", "property"],
]);
const DATA_RANGES = new Set([
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
]);

/** Project admitted semantic records, never legacy topology or renderer state. */
export function createCanonicalSemanticReferences(
  inspection,
  loadGeneration,
  targetForRecord,
) {
  const structural = inspection.records;
  const subjects = new Map(
    structural.subjects.map((record) => [record.id, record]),
  );
  const references = new Map();
  const semantic = [...structural.roles, ...structural.expressions];
  for (const record of semantic) {
    const kind =
      KINDS.get(record.kind) ??
      (record.kind === "object-inverse"
        ? "property"
        : DATA_RANGES.has(record.kind)
          ? "datatype"
          : "class");
    const subject = subjects.get(record.subject);
    const target = targetForRecord(record.id);
    if (
      target.loadGeneration !== loadGeneration ||
      !Number.isSafeInteger(target.recordToken) ||
      target.recordToken < 1
    ) {
      throw new TypeError(
        "Inspection targets must belong to the candidate load.",
      );
    }
    references.set(
      record.id,
      createOntologyElementReference({
        kind,
        ...(KINDS.has(record.kind) ? { roleKind: record.kind } : {}),
        ...(subject?.iri
          ? { iri: subject.iri }
          : { loadGeneration, localId: `record-${target.recordToken}` }),
      }),
    );
  }
  return references;
}

export function createCanonicalVowlInspectionProjection(
  inspection,
  { loadGeneration, visualization, targetForRecord },
) {
  const structural = inspection.records;
  const subjects = new Map(
    structural.subjects.map((record) => [record.id, record]),
  );
  const semantic = [...structural.roles, ...structural.expressions];
  const references = createCanonicalSemanticReferences(
    inspection,
    loadGeneration,
    targetForRecord,
  );
  const annotations = new Map();
  for (const record of structural.constructs) {
    if (record.kind === "annotation-assertion") {
      const values = annotations.get(record.subject) ?? [];
      values.push(record);
      annotations.set(record.subject, values);
    }
  }
  const labels = indexVowlLabelCandidates(structural);
  const localized = (values, predicate) =>
    values
      .filter(
        (entry) =>
          entry.predicate === predicate &&
          typeof entry.value.lexical === "string" &&
          entry.value.lexical.length > 0,
      )
      .map(({ value }) => ({
        languageTag: value.language ?? null,
        text: value.lexical,
      }));
  const annotationRecords = (values) =>
    values
      .filter(({ value }) => value.kind !== "subject")
      .map(({ predicate, value }) => ({
        localName:
          predicate.slice(
            Math.max(
              predicate.lastIndexOf("#"),
              predicate.lastIndexOf("/"),
              predicate.lastIndexOf(":"),
            ) + 1,
          ) || predicate,
        propertyIri: predicate,
        languageTag: value.language ?? null,
        text: value.iri ?? value.lexical,
        valueKind: value.kind === "iri" ? "iri" : "literal",
      }));
  const ref = (id) => {
    const reference = references.get(id);
    if (!reference) {
      throw new TypeError("An inspection relation has no semantic target.");
    }
    return reference;
  };
  const constructs = structural.constructs;
  // Index once rather than scanning every assertion for every semantic record.
  // Store n-ary groups once. The inspector expands only requested relationships.
  const factsByKindAndField = new Map();
  const membersByKindAndId = new Map();
  const relationGroups = [];
  const characteristics = new Map();
  function append(index, key, value) {
    const values = index.get(key) ?? [];
    values.push(value);
    index.set(key, values);
  }
  for (const fact of constructs) {
    for (const field of ["sub", "super", "property", "individual"]) {
      if (typeof fact[field] === "string") {
        append(
          factsByKindAndField,
          JSON.stringify([fact.kind, field, fact[field]]),
          fact,
        );
      }
    }
    if (Array.isArray(fact.members)) {
      const groupIndex = relationGroups.length;
      relationGroups.push(fact.members.map(ref));
      for (const id of fact.members) {
        append(membersByKindAndId, JSON.stringify([fact.kind, id]), groupIndex);
      }
    }
    if (fact.kind.endsWith("-characteristic")) {
      append(
        characteristics,
        fact.property,
        fact.characteristic.replaceAll("-", " "),
      );
    }
  }
  const snapshot = {
    relationGroups,
    loadGeneration,
    ontologyHeaderRecord: {
      ontologyIri: structural.ontology.iri ?? null,
      versionInformationText:
        localized(structural.ontology.annotations, OWL + "versionInfo")
          .map(({ text }) => text)
          .join("\n") || null,
      titleRecords: localized(structural.ontology.annotations, DC + "title"),
      descriptionRecords: localized(
        structural.ontology.annotations,
        DC + "description",
      ),
      authorNames: localized(
        structural.ontology.annotations,
        DC + "creator",
      ).map(({ text }) => text),
      annotationRecords: annotationRecords(structural.ontology.annotations),
    },
    classRecords: [],
    propertyRecords: [],
    datatypeRecords: [],
    individualRecords: [],
    namespaceRecords: visualization.prefixes.map(({ prefix, iri }) => ({
      prefix,
      namespaceIri: iri,
    })),
    importRecords: structural.ontology.imports.map((importedOntologyIri) => ({
      importedOntologyIri,
    })),
    availableLabelLanguages: [
      ...new Set(
        [...labels.values()].flatMap((values) =>
          values.flatMap(({ language }) =>
            language === undefined ? [] : [language],
          ),
        ),
      ),
    ].sort(),
    // Complete retained evidence is separate from the bounded relationship
    // summary. Typed values, anchors, qualifications and details-only facts
    // remain available even when they have no drawable occurrence.
    // The public snapshot constructor makes the owned, frozen copy once.
    retainedFacts: inspection,
  };
  for (const record of semantic) {
    const reference = ref(record.id);
    const values = annotations.get(record.subject) ?? [];
    const common = {
      ontologyElementReference: reference,
      elementTypeName: record.kind,
      labelRecords: localized(values, RDFS + "label"),
      commentRecords: localized(values, RDFS + "comment"),
      descriptionRecords: localized(values, DC + "description"),
      annotationRecords: annotationRecords(values),
      characteristicNames: characteristics.get(record.id) ?? [],
      unclassifiedAttributeNames: [],
      canonicalDisplay: {
        iri: subjects.get(record.subject)?.iri,
        unnamedKind: `anonymous ${reference.kind}`,
        selection: visualization.labelSelection,
        prefixes: visualization.prefixes,
        candidates: labels.get(record.subject) ?? [],
      },
    };
    const neighbors = (kind, field, result) =>
      (
        factsByKindAndField.get(JSON.stringify([kind, field, record.id])) ?? []
      ).map((fact) => ref(fact[result]));
    const groups = (kind) =>
      membersByKindAndId.get(JSON.stringify([kind, record.id])) ?? [];
    if (reference.kind === "class") {
      snapshot.classRecords.push({
        ...common,
        superclassReferences: neighbors("subclass", "sub", "super"),
        equivalentClassReferences: [],
        disjointClassReferences: [],
        relationGroups: {
          equivalentClassReferences: groups("equivalent-classes"),
          disjointClassReferences: groups("disjoint-classes"),
        },
      });
    } else if (reference.kind === "datatype") {
      snapshot.datatypeRecords.push(common);
    } else if (reference.kind === "individual") {
      snapshot.individualRecords.push({
        ...common,
        classReferences: neighbors("class-membership", "individual", "class"),
      });
    } else {
      const family = {
        "object-property": "object",
        "data-property": "data",
        "rdf-property": "rdf",
        "annotation-property": "annotation",
      }[record.kind];
      // Annotation domain/range values are IRIs, not admitted class references.
      // Keep those exact facts in retainedFacts instead of inventing class roles.
      snapshot.propertyRecords.push({
        ...common,
        domainReferences:
          family === "annotation" || !family
            ? []
            : neighbors(`${family}-domain`, "property", "target"),
        rangeReferences:
          family === "annotation" || !family
            ? []
            : neighbors(`${family}-range`, "property", "target"),
        superpropertyReferences: family
          ? neighbors(`sub-${family}-property`, "sub", "super")
          : [],
        subpropertyReferences: family
          ? neighbors(`sub-${family}-property`, "super", "sub")
          : [],
        inversePropertyReferences: [],
        equivalentPropertyReferences: [],
        relationGroups: {
          inversePropertyReferences: groups("inverse-properties"),
          equivalentPropertyReferences: family
            ? groups(`equivalent-${family}-properties`)
            : [],
        },
        cardinalityRecord: { exact: null, minimum: null, maximum: null },
      });
    }
  }
  return createOntologyInspectionSnapshot(snapshot);
}
