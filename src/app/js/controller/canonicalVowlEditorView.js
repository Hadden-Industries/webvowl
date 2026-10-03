import { isVowlExternal } from "./vowlDisplayProjector.js";

const OWL = "http://www.w3.org/2002/07/owl#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const DC = "http://purl.org/dc/elements/1.1/";

/** Human-editor presentation only; these rows are never parser or save input. */
export function createCanonicalVowlEditorView(
  inspection,
  visualization,
  { loadGeneration, selectedId } = {},
) {
  const records = new Map(
    ["subjects", "roles", "expressions", "constructs"].flatMap((name) =>
      inspection.records[name].map((record) => [record.id, record]),
    ),
  );
  function localized(annotations, predicate) {
    const values = new Map();
    let ambiguous = false;
    for (const annotation of annotations.filter(
      (entry) => entry.predicate === predicate,
    )) {
      const value = annotation.value;
      if (!(
        value.kind === "language" ||
        (value.kind === "typed" &&
          value.datatype === "http://www.w3.org/2001/XMLSchema#string")
      )) {
        ambiguous = true;
        continue;
      }
      const language = value.kind === "language" ? value.language : "undefined";
      if (values.has(language)) {
        ambiguous = true;
      } else {
        values.set(language, value.lexical);
      }
    }
    return { value: Object.fromEntries(values), ambiguous };
  }
  const ontology = inspection.records.ontology;
  const metadata = { iri: ontology.iri ?? "" };
  const ambiguousMetadata = [];
  for (const [field, predicate] of Object.entries({
    title: DC + "title",
    description: DC + "description",
    author: DC + "creator",
    version: OWL + "versionInfo",
  })) {
    const result = localized(ontology.annotations, predicate);
    metadata[field] = result.value;
    if (result.ambiguous) {
      ambiguousMetadata.push(field);
    }
  }
  const record = selectedId === undefined ? undefined : records.get(selectedId);
  if (selectedId !== undefined && !record) {
    throw new RangeError("The selected editor record is no longer present.");
  }
  let selectedRecord;
  let isProperty = false;
  if (record) {
    const subject = records.get(record.subject);
    const annotations = inspection.records.constructs.filter(
      (fact) =>
        fact.kind === "annotation-assertion" && fact.subject === subject?.id,
    );
    const label = localized(annotations, RDFS + "label");
    let type = {
      class: "owl:Class",
      "rdf-class": "rdfs:Class",
      datatype: "rdfs:Datatype",
      "object-property": "owl:objectProperty",
      "data-property": "owl:datatypeProperty",
      "rdf-property": "rdf:Property",
      "annotation-property": "owl:AnnotationProperty",
      "disjoint-classes": "owl:disjointWith",
    }[record.kind];
    isProperty =
      record.kind.endsWith("-property") ||
      record.kind === "disjoint-classes" ||
      record.kind === "subclass";
    if (record.kind === "subclass") {
      const expression = records.get(record.super);
      type =
        {
          "object-some": "owl:someValuesFrom",
          "object-all": "owl:allValuesFrom",
        }[expression?.kind] ?? "rdfs:subClassOf";
    }
    if (subject?.iri === OWL + "Thing") {
      type = "owl:Thing";
    } else if (subject?.iri === RDFS + "Literal") {
      type = "rdfs:Literal";
    }
    if (type) {
      const attributes = inspection.records.constructs
        .filter(
          (fact) =>
            fact.kind.endsWith("-characteristic") &&
            fact.property === record.id,
        )
        .map((fact) => fact.characteristic.replaceAll("-", " "));
      if (
        annotations.some(
          (fact) =>
            fact.predicate === OWL + "deprecated" &&
            fact.value.kind === "typed" &&
            fact.value.datatype ===
              "http://www.w3.org/2001/XMLSchema#boolean" &&
            ["true", "1"].includes(fact.value.lexical),
        )
      ) {
        attributes.push("deprecated");
        if (type === "owl:Class") {
          type = "owl:DeprecatedClass";
        }
      }
      if (
        subject?.iri &&
        isVowlExternal({
          rootOntologyIri: ontology.iri,
          subjectIri: subject.iri,
        })
      ) {
        attributes.push("external");
      }
      selectedRecord = {
        type,
        iri: subject?.iri ?? "",
        label: label.value,
        attributes,
        typeEditable: ![
          "rdf-class",
          "rdf-property",
          "annotation-property",
        ].includes(record.kind),
        availableCharacteristics: [
          OWL + "Thing",
          OWL + "Nothing",
          RDFS + "Literal",
        ].includes(subject?.iri)
          ? []
          : record.kind === "object-property"
            ? ["deprecated", "inverse functional", "functional", "transitive"]
            : ["data-property", "rdf-property"].includes(record.kind)
              ? ["deprecated", "functional"]
              : subject && record.kind !== "datatype"
                ? ["deprecated"]
                : [],
        labelEditable: !label.ambiguous && subject !== undefined,
        iriEditable:
          subject !== undefined &&
          inspection.records.roles.filter((role) => role.subject === subject.id)
            .length === 1,
      };
    }
  }
  return {
    loadGeneration,
    metadata,
    ambiguousMetadata,
    prefixes: Object.fromEntries(
      visualization.prefixes.map(({ prefix, iri }) => [prefix, iri]),
    ),
    selectedRecord,
    isProperty,
  };
}
