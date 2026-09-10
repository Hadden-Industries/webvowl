import { createVowlDocumentRecordTarget } from "./webVowlControllerContracts.js";

const RECORD_COLLECTIONS = new Set(["class", "datatype", "property"]);
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
const RESTRICTION_TYPES = ["owl:allValuesFrom", "owl:someValuesFrom"];
const FIXED_IRIS = {
  "owl:Thing": "http://www.w3.org/2002/07/owl#Thing",
  "rdfs:Literal": "http://www.w3.org/2000/01/rdf-schema#Literal",
  "rdfs:subClassOf": "http://www.w3.org/2000/01/rdf-schema#subClassOf",
  "owl:disjointWith": "http://www.w3.org/2002/07/owl#disjointWith",
};
export const DEFAULT_VOWL_EDITOR_PREFIXES = Object.freeze({
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  dc: "http://purl.org/dc/elements/1.1/#",
  xml: "http://www.w3.org/XML/1998/namespace",
});
const PROTECTED_PREFIX_NAMES = new Set(["rdf", "rdfs", "xsd", "dc", "owl"]);

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

export function describeVowlDocumentDeletion(vowlModel, target) {
  locateRecord(vowlModel, target);
  const targets = [{ ...target }];
  const properties = mergedRecords(vowlModel, "property");
  const removedProperties = properties.filter((property) =>
    target.collection === "property"
      ? String(property.id) === target.recordId
      : [String(property.domain), String(property.range)].includes(
          target.recordId,
        ),
  );
  if (target.collection !== "property") {
    targets.push(
      ...removedProperties.map((property) => ({
        collection: "property",
        recordId: String(property.id),
      })),
    );
  }
  const removedPropertyIds = new Set(
    removedProperties.map((property) => String(property.id)),
  );
  const remainingProperties = properties.filter(
    (property) => !removedPropertyIds.has(String(property.id)),
  );
  for (const property of removedProperties) {
    if (property.type !== "owl:datatypeProperty") {
      continue;
    }
    const rangeId = String(property.range);
    if (
      targets.some(
        (recordTarget) =>
          recordTarget.collection !== "property" &&
          recordTarget.recordId === rangeId,
      ) ||
      remainingProperties.some((remaining) =>
        [String(remaining.domain), String(remaining.range)].includes(rangeId),
      )
    ) {
      continue;
    }
    const range = requireNode(vowlModel, rangeId);
    if (!["rdfs:Literal", "rdfs:Datatype"].includes(range.type)) {
      continue;
    }
    const collection = (vowlModel.datatype ?? []).some(
      (node) => String(node.id) === rangeId,
    )
      ? "datatype"
      : "class";
    targets.push({ collection, recordId: rangeId });
  }
  return freezeDocument({ recordTargets: targets });
}

export function applyVowlDocumentDeletion(vowlModel, target) {
  const { recordTargets } = describeVowlDocumentDeletion(vowlModel, target);
  const model = structuredClone(vowlModel);
  const removedIds = new Set(recordTargets.map(({ recordId }) => recordId));
  for (const collection of RECORD_COLLECTIONS) {
    const collectionIds = new Set(
      recordTargets
        .filter((recordTarget) => recordTarget.collection === collection)
        .map(({ recordId }) => recordId),
    );
    for (const key of [collection, `${collection}Attribute`]) {
      if (model[key] !== undefined) {
        model[key] = model[key].filter(
          (record) => !collectionIds.has(String(record.id)),
        );
        for (const record of model[key]) {
          for (const field of [
            "equivalent",
            "union",
            "intersection",
            "disjointUnion",
            "subproperty",
            "superproperty",
          ]) {
            if (Array.isArray(record[field])) {
              record[field] = record[field].filter(
                (id) => !removedIds.has(String(id)),
              );
            }
          }
          for (const field of ["inverse", "complement"]) {
            if (removedIds.has(String(record[field]))) {
              delete record[field];
            }
          }
        }
      }
    }
  }
  return freezeDocument(model);
}

function changedLocalizedText(previous, change) {
  assertFields(change, ["language", "text"], "Localized text change");
  if (
    typeof change.language !== "string" ||
    change.language.length === 0 ||
    typeof change.text !== "string"
  ) {
    throw new TypeError(
      "A localized text change requires a language and text.",
    );
  }
  return {
    ...(typeof previous === "string" ? { undefined: previous } : previous),
    [change.language === "default" ? "undefined" : change.language]:
      change.text,
  };
}

export function applyVowlOntologyMetadataEdit(vowlModel, changes) {
  assertFields(
    changes,
    ["title", "iri", "version", "author", "description"],
    "Ontology metadata changes",
  );
  const model = structuredClone(vowlModel);
  model.header ??= {};
  for (const [field, value] of Object.entries(changes)) {
    if (["title", "description"].includes(field)) {
      model.header[field] = changedLocalizedText(model.header[field], value);
    } else {
      if (typeof value !== "string") {
        throw new TypeError("Ontology metadata input must be text.");
      }
      if (field === "iri") {
        assertResourceIri(value);
      }
      model.header[field] = value;
    }
  }
  return freezeDocument(model);
}

export function readVowlDocumentPrefixes(vowlModel) {
  return Object.freeze({
    ...DEFAULT_VOWL_EDITOR_PREFIXES,
    ...Object.fromEntries(
      (vowlModel.namespace ?? []).map(({ name, iri }) => [name, iri]),
    ),
    ...vowlModel.header?.prefixList,
  });
}

function expandAbbreviatedRecordIris(model, prefixes) {
  function expand(iri) {
    if (typeof iri !== "string") {
      return iri;
    }
    if (/^(https?|ftp):/iu.test(iri)) {
      return iri;
    }
    const separator = iri.indexOf(":");
    const prefix = iri.slice(0, separator);
    return separator >= 0 && Object.hasOwn(prefixes, prefix)
      ? `${prefixes[prefix]}${iri.slice(separator + 1)}`
      : iri;
  }
  function expandRecord(record) {
    for (const field of ["iri", "baseIri"]) {
      if (record[field] !== undefined) {
        record[field] = expand(record[field]);
      }
    }
    (record.individuals ?? []).forEach(expandRecord);
  }
  for (const collection of RECORD_COLLECTIONS) {
    (model[collection] ?? []).forEach(expandRecord);
    (model[`${collection}Attribute`] ?? []).forEach(expandRecord);
  }
}

function assertEditablePrefix(name) {
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    /[\s:]/u.test(name) ||
    PROTECTED_PREFIX_NAMES.has(name)
  ) {
    throw new TypeError(
      "The prefix must be a non-empty, unprotected name without spaces or colons.",
    );
  }
}

export function setVowlDocumentPrefix(vowlModel, request) {
  assertFields(request, ["previousName", "name", "iri"], "Prefix change");
  assertEditablePrefix(request.name);
  assertResourceIri(request.iri);
  const prefixes = readVowlDocumentPrefixes(vowlModel);
  if (request.previousName !== undefined) {
    assertEditablePrefix(request.previousName);
    if (!Object.hasOwn(prefixes, request.previousName)) {
      throw new RangeError("The prefix to rename is no longer present.");
    }
  }
  if (
    request.name !== request.previousName &&
    Object.hasOwn(prefixes, request.name)
  ) {
    throw new RangeError("That prefix is already defined.");
  }
  const model = structuredClone(vowlModel);
  expandAbbreviatedRecordIris(model, prefixes);
  model.namespace = (model.namespace ?? []).filter(
    ({ name }) =>
      request.previousName === undefined || name !== request.previousName,
  );
  model.namespace.push({ name: request.name, iri: request.iri });
  model.header ??= {};
  model.header.prefixList = { ...model.header.prefixList };
  if (request.previousName !== undefined) {
    delete model.header.prefixList[request.previousName];
  }
  Object.defineProperty(model.header.prefixList, request.name, {
    value: request.iri,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return freezeDocument(model);
}

export function removeVowlDocumentPrefix(vowlModel, name) {
  assertEditablePrefix(name);
  const prefixes = readVowlDocumentPrefixes(vowlModel);
  if (!Object.hasOwn(prefixes, name)) {
    throw new RangeError("The prefix is no longer present.");
  }
  const model = structuredClone(vowlModel);
  expandAbbreviatedRecordIris(model, prefixes);
  model.namespace = (model.namespace ?? []).filter(
    (entry) => entry.name !== name,
  );
  model.header ??= {};
  model.header.prefixList = { ...model.header.prefixList };
  delete model.header.prefixList[name];
  return freezeDocument(model);
}

function locateRecord(vowlModel, target) {
  target = createVowlDocumentRecordTarget(target);
  const matchingRecords = (vowlModel[target.collection] ?? []).filter(
    (record) => String(record.id) === target.recordId,
  );
  if (matchingRecords.length !== 1) {
    throw new RangeError(
      "The document record is absent or its ID is ambiguous.",
    );
  }
  const attributes = (vowlModel[`${target.collection}Attribute`] ?? []).find(
    (record) => String(record.id) === target.recordId,
  );
  return { record: matchingRecords[0], attributes };
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

export function describeVowlDocumentRecord(vowlModel, target) {
  const { record, attributes } = locateRecord(vowlModel, target);
  const described = { ...record, ...attributes };
  described.type = canonicalVowlType(described.type);
  return createVowlDocumentSnapshot(described);
}

export function resolveVowlEditorIri(input, vowlModel) {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new TypeError("Enter an IRI or a local name.");
  }
  const text = input.trim();
  if (/^(https?|ftp):/iu.test(text)) {
    assertResourceIri(text);
    return text;
  }
  const separator = text.indexOf(":");
  const prefixes = readVowlDocumentPrefixes(vowlModel);
  const baseIri = vowlModel.header?.iri ?? "http://www.w3.org/2002/07/owl#";
  let iri;
  if (separator >= 0) {
    const prefix = text.slice(0, separator);
    const localName = text.slice(separator + 1);
    if (!localName || (prefix !== "" && !Object.hasOwn(prefixes, prefix))) {
      throw new RangeError(
        "The prefix is undefined or its local name is empty.",
      );
    }
    iri = `${prefix === "" ? baseIri : prefixes[prefix]}${localName}`;
  } else {
    iri = `${baseIri}${text}`;
  }
  assertResourceIri(iri);
  return iri;
}

function mergedRecords(model, collection) {
  return (model[collection] ?? []).map((record) => {
    const merged = {
      ...record,
      ...(model[`${collection}Attribute`] ?? []).find(
        (attributes) => String(attributes.id) === String(record.id),
      ),
    };
    merged.type = canonicalVowlType(merged.type);
    return merged;
  });
}

function requireNode(model, recordId) {
  const matches = ["class", "datatype"]
    .flatMap((collection) => mergedRecords(model, collection))
    .filter((record) => String(record.id) === recordId);
  if (matches.length !== 1) {
    throw new RangeError("The relationship endpoint is absent or ambiguous.");
  }
  return matches[0];
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

function assertPropertyRelationship(model, property) {
  const domain = requireNode(model, String(property.domain));
  const range = requireNode(model, String(property.range));
  if (["rdfs:subClassOf", "owl:disjointWith"].includes(property.type)) {
    if (String(domain.id) === String(range.id)) {
      throw new RangeError(
        "Subclass and disjointness relationships cannot be loops in the editor.",
      );
    }
    if (
      mergedRecords(model, "property").some(
        (other) =>
          String(other.id) !== String(property.id) &&
          other.type === property.type &&
          ((String(other.domain) === String(domain.id) &&
            String(other.range) === String(range.id)) ||
            (String(other.domain) === String(range.id) &&
              String(other.range) === String(domain.id))),
      )
    ) {
      throw new RangeError(
        "That relationship or its inverse is already present.",
      );
    }
  }
  if (
    RESTRICTION_TYPES.includes(property.type) &&
    [domain.type, range.type].includes("owl:Thing")
  ) {
    throw new RangeError(
      "Value restrictions cannot connect to owl:Thing in the editor.",
    );
  }
}

// A record target identifies the selected document entry, even when another
// record describes the same ontology IRI. All returned data belongs to the
// application; the renderer receives its own projection later.
export function applyVowlDocumentRecordEdit(vowlModel, request) {
  assertFields(request, ["recordTarget", "changes"], "VOWL record edit");
  assertFields(
    request.changes,
    [
      "label",
      "iri",
      "type",
      "characteristics",
      "domainRecordId",
      "rangeRecordId",
      "datatypeName",
    ],
    "VOWL record changes",
  );
  if (Object.keys(request.changes).length === 0) {
    throw new TypeError("A document edit requires at least one change.");
  }
  const model = structuredClone(vowlModel);
  const { record, attributes } = locateRecord(model, request.recordTarget);
  const changedAttributes = attributes ?? { id: record.id };
  if (attributes === undefined) {
    (model[`${request.recordTarget.collection}Attribute`] ??= []).push(
      changedAttributes,
    );
  }
  const isProperty = request.recordTarget.collection === "property";
  const originalType = canonicalVowlType(changedAttributes.type ?? record.type);
  const { changes } = request;
  if (changes.type !== undefined) {
    const types = isProperty
      ? VOWL_EDITOR_PROPERTY_TYPES
      : ["rdfs:Literal", "rdfs:Datatype"].includes(originalType)
        ? ["rdfs:Literal", "rdfs:Datatype"]
        : VOWL_EDITOR_CLASS_TYPES;
    if (!types.includes(changes.type)) {
      throw new RangeError("That element type is not supported by the editor.");
    }
    if (
      !isProperty &&
      changes.type !== "owl:Class" &&
      mergedRecords(model, "property").some(
        (property) =>
          RESTRICTION_TYPES.includes(property.type) &&
          [String(property.domain), String(property.range)].includes(
            String(record.id),
          ),
      )
    ) {
      throw new RangeError(
        "An attached value restriction prevents that class type change.",
      );
    }
    record.type = changes.type;
    delete changedAttributes.type;
    if (FIXED_IRIS[changes.type] !== undefined) {
      changedAttributes.iri = FIXED_IRIS[changes.type];
    } else if (FIXED_IRIS[originalType] !== undefined) {
      changedAttributes.iri = `${model.header?.iri ?? "http://www.w3.org/2002/07/owl#"}${record.id}`;
    }
  }
  if (changes.datatypeName !== undefined) {
    if (
      !["rdfs:Datatype", "rdfs:Literal"].includes(
        canonicalVowlType(changedAttributes.type ?? record.type),
      ) ||
      !VOWL_EDITOR_DATATYPE_NAMES.includes(changes.datatypeName)
    ) {
      throw new RangeError(
        "That datatype choice is not supported for this record.",
      );
    }
    const [prefix, local] = changes.datatypeName.includes(":")
      ? changes.datatypeName.split(":")
      : ["xsd", "undefined"];
    changedAttributes.baseIri = DEFAULT_VOWL_EDITOR_PREFIXES[prefix];
    changedAttributes.iri = `${changedAttributes.baseIri}${local}`;
    changedAttributes.label = local;
    record.type =
      changes.datatypeName === "rdfs:Literal"
        ? "rdfs:Literal"
        : "rdfs:Datatype";
    delete changedAttributes.type;
  }
  const finalType = canonicalVowlType(changedAttributes.type ?? record.type);
  if (changes.iri !== undefined) {
    assertResourceIri(changes.iri);
    if (
      FIXED_IRIS[finalType] !== undefined &&
      changes.iri !== FIXED_IRIS[finalType]
    ) {
      throw new RangeError("This built-in element has a fixed IRI.");
    }
    if (
      changes.iri !== (attributes?.iri ?? record.iri) &&
      FIXED_IRIS[finalType] === undefined &&
      mergedRecords(model, request.recordTarget.collection).some(
        (other) =>
          String(other.id) !== String(record.id) &&
          other.iri === changes.iri &&
          FIXED_IRIS[other.type] === undefined,
      )
    ) {
      throw new RangeError("Another editable record already uses that IRI.");
    }
    changedAttributes.iri = changes.iri;
  }
  for (const [field, attribute] of [
    ["domainRecordId", "domain"],
    ["rangeRecordId", "range"],
  ]) {
    if (changes[field] !== undefined) {
      if (!isProperty || typeof changes[field] !== "string") {
        throw new TypeError(
          "Only properties have editable relationship endpoints.",
        );
      }
      changedAttributes[attribute] = requireNode(model, changes[field]).id;
    }
  }
  if (
    isProperty &&
    ["type", "domainRecordId", "rangeRecordId"].some(
      (field) => changes[field] !== undefined,
    )
  ) {
    assertPropertyRelationship(model, {
      ...record,
      ...changedAttributes,
      type: finalType,
    });
  }
  if (changes.characteristics !== undefined) {
    const editableCharacteristics = !isProperty
      ? ["deprecated"]
      : finalType === "owl:datatypeProperty"
        ? ["deprecated", "functional"]
        : ["deprecated", "inverse functional", "functional", "transitive"];
    assertFields(
      changes.characteristics,
      editableCharacteristics,
      "Editable characteristics",
    );
    const attributeNames = new Set(
      changedAttributes.attributes ?? record.attributes ?? [],
    );
    for (const [name, enabled] of Object.entries(changes.characteristics)) {
      if (typeof enabled !== "boolean") {
        throw new TypeError("Characteristic choices must be Boolean.");
      }
      if (enabled) {
        attributeNames.add(name);
      } else {
        attributeNames.delete(name);
      }
    }
    changedAttributes.attributes = [...attributeNames];
  }
  if (request.changes.label !== undefined) {
    changedAttributes.label = changedLocalizedText(
      changedAttributes.label ?? record.label,
      changes.label,
    );
  }
  return freezeDocument(model);
}
