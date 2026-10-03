import { createVowlDocumentRecordTarget } from "./webVowlControllerContracts.js";

// Drawing creation records and editor vocabulary; canonical semantics are owned by vowl.edit.
export const VOWL_EDITOR_CLASS_TYPES = Object.freeze([
  "owl:Thing",
  "owl:Class",
  "owl:DeprecatedClass",
]);
export const VOWL_EDITOR_PROPERTY_TYPES = Object.freeze([
  "owl:objectProperty",
  "rdfs:subClassOf",
  "owl:disjointWith",
  "owl:allValuesFrom",
  "owl:someValuesFrom",
  "owl:datatypeProperty",
]);
export const VOWL_EDITOR_DATATYPE_NAMES = Object.freeze([
  "rdfs:Literal",
  "owl:real",
  "owl:rational",
  "xsd:decimal",
  "xsd:integer",
  "xsd:nonNegativeInteger",
  "xsd:nonPositiveInteger",
  "xsd:positiveInteger",
  "xsd:negativeInteger",
  "xsd:long",
  "xsd:int",
  "xsd:short",
  "xsd:byte",
  "xsd:unsignedLong",
  "xsd:unsignedInt",
  "xsd:unsignedShort",
  "xsd:unsignedByte",
  "xsd:boolean",
  "xsd:double",
  "xsd:float",
  "xsd:string",
  "xsd:dateTime",
  "undefined",
]);

export const DEFAULT_VOWL_EDITOR_PREFIXES = Object.freeze({
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  dc: "http://purl.org/dc/elements/1.1/#",
  xml: "http://www.w3.org/XML/1998/namespace",
});

function assertFields(value, fields, description) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((field) => !fields.includes(field))
  ) {
    throw new TypeError(`${description} has an invalid field set.`);
  }
}

function freezeDocument(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freezeDocument);
    Object.freeze(value);
  }
  return value;
}

export function createVowlDocumentSnapshot(vowlModel) {
  return freezeDocument(structuredClone(vowlModel));
}

export function createVowlDocumentInsertionRecords(records) {
  if (!Array.isArray(records) || records.length < 1 || records.length > 2) {
    throw new TypeError(
      "A canvas creation inserts one element or one datatype/property pair.",
    );
  }
  for (const record of records) {
    assertFields(
      record,
      [
        "collection",
        "id",
        "type",
        "label",
        "iri",
        "baseIri",
        "pos",
        "domain",
        "range",
      ],
      "Created record",
    );
    createVowlDocumentRecordTarget({
      collection: record.collection,
      recordId: record.id,
    });
    const allowedTypes =
      record.collection === "property"
        ? VOWL_EDITOR_PROPERTY_TYPES
        : [
            ...(record.collection === "class" ? VOWL_EDITOR_CLASS_TYPES : []),
            "rdfs:Literal",
            "rdfs:Datatype",
          ];
    if (
      typeof record.type !== "string" ||
      !allowedTypes.includes(canonicalVowlType(record.type)) ||
      typeof record.label !== "string"
    ) {
      throw new TypeError(
        "Created records require a supported editor type and a label.",
      );
    }
    assertResourceIri(record.iri);
    assertResourceIri(record.baseIri);
    if (
      !Array.isArray(record.pos) ||
      record.pos.length !== 2 ||
      !record.pos.every(Number.isFinite)
    ) {
      throw new TypeError("Created records require a finite drawing position.");
    }
    if (record.collection === "property") {
      if (
        typeof record.domain !== "string" ||
        typeof record.range !== "string"
      ) {
        throw new TypeError(
          "A created property requires its relationship endpoints.",
        );
      }
    } else if (record.domain !== undefined || record.range !== undefined) {
      throw new TypeError(
        "Only created properties have relationship endpoints.",
      );
    }
  }
  return createVowlDocumentSnapshot(records);
}

function canonicalVowlType(type) {
  // The existing VOWL reader accepts capitalization variants in saved files.
  // Keep that file-format interpretation here while editor requests use one value.
  return (
    [
      ...VOWL_EDITOR_CLASS_TYPES,
      ...VOWL_EDITOR_PROPERTY_TYPES,
      "rdfs:Literal",
      "rdfs:Datatype",
    ].find((known) => known.toLowerCase() === String(type).toLowerCase()) ??
    type
  );
}

function assertResourceIri(iri) {
  if (
    typeof iri !== "string" ||
    !["http:", "https:", "ftp:"].includes(new URL(iri).protocol)
  ) {
    throw new TypeError(
      "The editor requires an absolute HTTP, HTTPS or FTP IRI.",
    );
  }
}
