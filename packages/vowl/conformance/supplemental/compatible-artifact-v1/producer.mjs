// SPDX-License-Identifier: AGPL-3.0-only
// Independent Canonical VOWL compatible-artifact producer pass.
// Derived strictly from authoritative specifications:
// - docs/specs/2026-10-04-canonical-vowl-compatible-artifact-contract.md
//   (SHA256: 9199710c479a28dc01708973390fd942e4459be9599f78aba003ac9cb652c527)
// - docs/specs/2026-10-02-canonical-vowl-compatible-view-amendment-draft.md
// Historical structural and visualization shapes reused with attribution from:
// - packages/vowl/conformance/oracle/producer.mjs
// Dependency resolution path authorized solely for importing external standards libraries:
import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const _canonicalizeMod = require("canonicalize");
const canonicalize = _canonicalizeMod.default || _canonicalizeMod;
const _rdfCanonizeMod = require("rdf-canonize");
const rdfCanonize = _rdfCanonizeMod.default || _rdfCanonizeMod;

export const profile =
  "https://haddenindustries.com/ontology/profiles/vowl/canonical/compatible-artifact/v1";
export const schemaIdentifier =
  "https://haddenindustries.com/ontology/profiles/vowl/canonical/compatible-artifact/v1/schema";

const mapping =
  "https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#";
const colorPredicate =
  "https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color";
const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const xsd = "http://www.w3.org/2001/XMLSchema#";

const categories = [
  { path: ["structural", "subjects"], category: "subjects", type: "Subject", prefix: "s" },
  { path: ["structural", "roles"], category: "roles", type: "Role", prefix: "r" },
  { path: ["structural", "expressions"], category: "expressions", type: "Expression", prefix: "x" },
  { path: ["structural", "constructs"], category: "constructs", type: "Construct", prefix: "c" },
  { path: ["structural", "occurrences"], category: "occurrences", type: "Occurrence", prefix: "o" },
  { path: ["qualifications", "documents"], category: "documents", type: "CompatibleDocument", prefix: "d" },
  { path: ["qualifications", "imports"], category: "imports", type: "CompatibleImport", prefix: "i" },
  { path: ["qualifications", "entries"], category: "entries", type: "Qualification", prefix: "q" },
  { path: ["qualifications", "sourceNodes"], category: "sourceNodes", type: "SourceBlankNode", prefix: "b" },
  { path: ["qualifications", "sourceStatements"], category: "sourceStatements", type: "SourceStatement", prefix: "v" },
];

const portableRules = new Set([
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-assessment",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#owning-header-selection",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#import-acquisition",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#owning-compatible-interpretation",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-profile-assessment",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-source-assessment",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#retained-projection",
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#canonical-source",
]);

// Structural schema shapes
const set = (item) => ({ collection: "Set", item });
const sequence = (item) => ({ collection: "Sequence", item });
const fields = (value, optional = []) => ({
  fields: value,
  required: Object.keys(value).filter((key) => !optional.includes(key)),
});

const subject = fields({ iri: "iri" }, ["iri"]);
const role = fields({ kind: "token", subject: "coreRef" });
const literal = {
  discriminator: {
    typed: { lexical: "text", datatype: "iri" },
    language: { lexical: "text", language: "text" },
  },
};
const annotationValue = {
  discriminator: {
    ...literal.discriminator,
    iri: { iri: "iri" },
    subject: { subject: "coreRef" },
  },
};
const annotation = fields({ predicate: "iri", value: annotationValue });
annotation.fields.annotations = set(annotation);
annotation.required.push("annotations");
const facet = fields({ facet: "iri", value: literal });
const expressionFields = {
  "class-intersection": { members: set("coreRef") },
  "class-union": { members: set("coreRef") },
  "class-complement": { operand: "coreRef" },
  "class-enumeration": { members: set("coreRef") },
  "object-some": { property: "coreRef", filler: "coreRef" },
  "object-all": { property: "coreRef", filler: "coreRef" },
  "object-value": { property: "coreRef", value: "coreRef" },
  "object-self": { property: "coreRef" },
  "object-min-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "object-max-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "object-exact-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "data-some": { property: "coreRef", filler: "coreRef" },
  "data-all": { property: "coreRef", filler: "coreRef" },
  "data-value": { property: "coreRef", value: literal },
  "data-min-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "data-max-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "data-exact-cardinality": {
    property: "coreRef",
    cardinality: "decimal",
    filler: "coreRef",
  },
  "object-inverse": { property: "coreRef" },
  "data-intersection": { members: set("coreRef") },
  "data-union": { members: set("coreRef") },
  "data-complement": { operand: "coreRef" },
  "data-enumeration": { members: set(literal) },
  "datatype-restriction": { datatype: "coreRef", facets: set(facet) },
};
const constructFields = {
  subclass: { sub: "coreRef", super: "coreRef" },
  "equivalent-classes": { members: set("coreRef") },
  "disjoint-classes": { members: set("coreRef") },
  "disjoint-union": { defined: "coreRef", members: set("coreRef") },
  "sub-object-property": { sub: "coreRef", super: "coreRef" },
  "equivalent-object-properties": { members: set("coreRef") },
  "disjoint-object-properties": { members: set("coreRef") },
  "inverse-properties": { members: set("coreRef") },
  "property-chain": { members: sequence("coreRef"), super: "coreRef" },
  "object-domain": { property: "coreRef", target: "coreRef" },
  "object-range": { property: "coreRef", target: "coreRef" },
  "object-characteristic": { property: "coreRef", characteristic: "token" },
  "sub-data-property": { sub: "coreRef", super: "coreRef" },
  "equivalent-data-properties": { members: set("coreRef") },
  "disjoint-data-properties": { members: set("coreRef") },
  "data-domain": { property: "coreRef", target: "coreRef" },
  "data-range": { property: "coreRef", target: "coreRef" },
  "data-characteristic": { property: "coreRef", characteristic: "token" },
  "sub-rdf-property": { sub: "coreRef", super: "coreRef" },
  "equivalent-rdf-properties": { members: set("coreRef") },
  "disjoint-rdf-properties": { members: set("coreRef") },
  "rdf-domain": { property: "coreRef", target: "coreRef" },
  "rdf-range": { property: "coreRef", target: "coreRef" },
  "rdf-characteristic": { property: "coreRef", characteristic: "token" },
  "sub-annotation-property": { sub: "coreRef", super: "coreRef" },
  "annotation-domain": { property: "coreRef", target: "iri" },
  "annotation-range": { property: "coreRef", target: "iri" },
  "datatype-definition": { datatype: "coreRef", target: "coreRef" },
  key: {
    class: "coreRef",
    objectProperties: set("coreRef"),
    dataProperties: set("coreRef"),
  },
  "class-membership": { class: "coreRef", individual: "coreRef" },
  "annotation-assertion": {
    subject: "coreRef",
    predicate: "iri",
    value: annotationValue,
  },
};
const assertion = {
  discriminator: { ...constructFields, declaration: { role: "coreRef" } },
};
constructFields["assertion-anchor"] = {
  assertion,
  annotations: set(annotation),
};
const context = {
  discriminator: {
    class: { targets: set("coreRef") },
    property: fields({ properties: set("coreRef"), scope: "coreRef" }, ["scope"]),
  },
};
const occurrenceFields = {
  "class-node": fields({ targets: set("coreRef"), context }, ["context"]),
  "datatype-node": { target: "coreRef", context },
  "property-edge": { properties: set("coreRef"), from: "coreRef", to: "coreRef" },
  "inverse-edge": {
    construct: "coreRef",
    forward: set("coreRef"),
    reverse: set("coreRef"),
    from: "coreRef",
    to: "coreRef",
  },
  "subclass-edge": { construct: "coreRef", from: "coreRef", to: "coreRef" },
  "disjoint-edge": { construct: "coreRef", ends: set("coreRef") },
  "operator-edge": { expression: "coreRef", from: "coreRef", to: "coreRef" },
  "restriction-edge": { construct: "coreRef", from: "coreRef", to: "coreRef" },
  label: { edge: "coreRef", direction: "token" },
};
const point = fields({ x: "number", y: "number" });
const structural = fields({
  ontology: fields(
    {
      iri: "iri",
      versionIri: "iri",
      imports: set("iri"),
      annotations: set(annotation),
    },
    ["iri", "versionIri"],
  ),
  subjects: set({ primary: "subjects", shape: subject }),
  roles: set({ primary: "roles", shape: role }),
  expressions: set({
    primary: "expressions",
    shape: { discriminator: expressionFields },
  }),
  constructs: set({
    primary: "constructs",
    shape: { discriminator: constructFields },
  }),
  occurrences: set({
    primary: "occurrences",
    shape: { discriminator: occurrenceFields },
  }),
});

const visualization = fields({
  placements: set(
    fields({ occurrence: "coreRef", position: point, pinned: "boolean" }),
  ),
  camera: fields({ center: point, zoom: "number" }),
  hidden: set("coreRef"),
  labelSelection: {
    tag: "mode",
    discriminator: { iri: {}, untagged: {}, language: { range: "text" } },
  },
  prefixes: set(fields({ prefix: "text", iri: "iri" })),
  display: fields({
    compactNotation: "boolean",
    nodeScaling: "token",
    externalColoring: "boolean",
  }),
});

// Qualifications shapes
const documentShape = fields(
  {
    id: "docRef",
    ontologyIri: "iri",
    versionIri: "iri",
    root: "boolean",
    headers: "token",
  },
  ["ontologyIri", "versionIri"],
);

const importShape = fields(
  {
    id: "importRef",
    parentDocument: "docRef",
    requestedIri: "iri",
    targetDocument: "docRef",
    state: "token",
  },
  ["targetDocument"],
);

const residualLiteral = fields(
  {
    lexical: "text",
    datatype: "iri",
    language: "string",
    direction: "token",
  },
  ["direction"],
);

const resourceShape = {
  discriminator: {
    iri: { iri: "iri" },
    blank: { node: "blankRef" },
  },
};

const termShape = {
  discriminator: {
    iri: { iri: "iri" },
    blank: { node: "blankRef" },
    literal: { value: residualLiteral },
  },
};

const graphShape = {
  discriminator: {
    iri: { iri: "iri" },
    blank: { node: "blankRef" },
    default: {},
    unavailable: {},
  },
};

const sourceNodeShape = fields({
  id: "blankRef",
  document: "docRef",
});

const sourceStatementShape = fields({
  id: "statementRef",
  document: "docRef",
  graph: graphShape,
  subject: resourceShape,
  predicate: "iri",
  object: termShape,
});

const detailShape = {
  discriminator: {
    scope: {},
    assessment: fields(
      {
        status: "token",
        iri: "iri",
        datatype: "iri",
        entityKind: "string",
        count: "decimal",
      },
      ["iri", "datatype", "entityKind", "count"],
    ),
    property: fields(
      {
        iri: "iri",
        subProperty: "iri",
        superProperty: "iri",
        declaredCategories: set("token"),
        existingCategories: set("token"),
        resolvedCategory: "token",
        requestedCategory: "token",
        evidence: "string",
      },
      [
        "iri",
        "subProperty",
        "superProperty",
        "declaredCategories",
        "existingCategories",
        "resolvedCategory",
        "requestedCategory",
        "evidence",
      ],
    ),
    headers: fields({
      candidates: set("iri"),
      selected: "iri",
    }),
    exclusion: fields(
      {
        constructor: "string",
        unsupported: "string",
      },
      ["unsupported"],
    ),
    import: fields({
      requestedIri: "iri",
    }),
    "source-statements": fields({
      statements: set("statementRef"),
    }),
  },
};

const entryShape = fields({
  id: "entryRef",
  dimension: "token",
  code: "string",
  records: set("coreRef"),
  documents: set("docRef"),
  rule: "iri",
  detail: detailShape,
});

const qualifications = fields({
  documents: set({ primary: "documents", shape: documentShape }),
  imports: set({ primary: "imports", shape: importShape }),
  entries: set({ primary: "entries", shape: entryShape }),
  sourceNodes: set({ primary: "sourceNodes", shape: sourceNodeShape }),
  sourceStatements: set({ primary: "sourceStatements", shape: sourceStatementShape }),
});

const compatibleArtifactEnvelope = fields({
  profile: "iri",
  structural,
  visualization,
  qualifications,
});

function shapeFields(shape, value) {
  if (shape.fields) return shape.fields;
  const tag = shape.tag ?? "kind";
  const variant =
    typeof value[tag] === "string" &&
    Object.hasOwn(shape.discriminator ?? {}, value[tag]) &&
    shape.discriminator[value[tag]];
  if (!variant) throw new Error(`DOCUMENT_TYPE: Oracle has no shape for variant ${value[tag]}`);
  return { [tag]: "token", ...(variant.fields ?? variant) };
}

function requiredFields(shape, value) {
  if (shape.fields) return shape.required;
  const tag = shape.tag ?? "kind";
  const variant =
    typeof value[tag] === "string" &&
    Object.hasOwn(shape.discriminator ?? {}, value[tag]) &&
    shape.discriminator[value[tag]];
  if (!variant) throw new Error(`DOCUMENT_TYPE: Oracle has no shape for variant ${value[tag]}`);
  return [tag, ...(variant.required ?? Object.keys(variant))];
}

function textValue(value) {
  if (typeof value !== "string")
    throw new Error("DOCUMENT_TYPE: Oracle expects a string scalar");
  for (const char of value) {
    const point = char.codePointAt(0);
    if (
      (point >= 0xd800 && point <= 0xdfff) ||
      (point >= 0xfdd0 && point <= 0xfdef) ||
      (point & 0xffff) >= 0xfffe
    )
      throw new Error("STRING_INVALID: Oracle rejects invalid Unicode scalar");
  }
  return value;
}

function asciiLanguage(value, range) {
  textValue(value);
  if (!/^[A-Za-z0-9*-]+$/.test(value))
    throw new Error("LANGUAGE_INVALID: Oracle rejects non-ASCII language spelling");
  const lower = value.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
  if (range) {
    if (!/^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/.test(lower))
      throw new Error("LANGUAGE_INVALID: Oracle rejects invalid basic language range");
  } else if (!/^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/.test(lower)) {
    throw new Error("LANGUAGE_INVALID: Oracle rejects invalid language token spelling");
  }
  return lower;
}

function safeFixture(value, active = new Set()) {
  if (value === null) throw new Error("DOCUMENT_TYPE: Oracle rejects null fixtures");
  if (typeof value !== "object") {
    if (!["string", "boolean", "number"].includes(typeof value))
      throw new Error("DOCUMENT_TYPE: Oracle rejects non-JSON fixture values");
    return;
  }
  if (active.has(value)) throw new Error("DOCUMENT_TYPE: Oracle rejects fixture cycles");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    array
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null
  )
    throw new Error("DOCUMENT_TYPE: Oracle rejects non-plain fixture prototypes");
  active.add(value);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1)
    throw new Error("DOCUMENT_TYPE: Oracle rejects sparse or extended arrays");
  for (const key of keys) {
    if (array && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new Error("DOCUMENT_TYPE: Oracle rejects unsafe fixture descriptors");
    if (array && !/^(0|[1-9][0-9]*)$/.test(key))
      throw new Error("DOCUMENT_TYPE: Oracle rejects extra array keys");
    safeFixture(descriptor.value, active);
  }
  active.delete(value);
}

const named = (value) => ({ termType: "NamedNode", value });
const blank = (value) => ({ termType: "BlankNode", value });
const lit = (value, datatype, language = "") => ({
  termType: "Literal",
  value,
  datatype: named(datatype),
  language,
});
const utf8 = (a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));

function validateQualificationInvariants(source) {
  const q = source.qualifications;
  if (!q || typeof q !== "object")
    throw new Error("DOCUMENT_REQUIRED_FIELD: qualifications object required");

  // 1. Index collections, check nonempty / unique primary handles
  const allHandles = new Set();
  for (const item of categories) {
    const coll = item.path.reduce((acc, k) => acc?.[k], source);
    if (!Array.isArray(coll))
      throw new Error(`DOCUMENT_TYPE: Primary collection missing: ${item.category}`);
    for (const record of coll) {
      if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id)
        throw new Error("IDENTIFIER_INVALID: Empty or missing primary handle");
      textValue(record.id);
      if (allHandles.has(record.id))
        throw new Error(`IDENTIFIER_INVALID: Duplicate global handle: ${record.id}`);
      allHandles.add(record.id);
    }
  }

  // 2. Exactly one root document
  const rootDocs = q.documents.filter((d) => d.root === true);
  if (rootDocs.length !== 1)
    throw new Error("DOCUMENT_TYPE: Exactly one root document required");

  // 3. In order, check imports, entries and sourceStatements for duplicate payload
  const checkDuplicatePayloads = (list, name) => {
    const payloads = new Set();
    for (const item of list) {
      const copy = structuredClone(item);
      delete copy.id;
      const jcs = canonicalize(copy);
      if (payloads.has(jcs))
        throw new Error(`NORMALIZATION_INVALID: Repeated payload in ${name}`);
      payloads.add(jcs);
    }
  };
  checkDuplicatePayloads(q.imports, "imports");
  checkDuplicatePayloads(q.entries, "entries");
  checkDuplicatePayloads(q.sourceStatements, "sourceStatements");

  // 4. Source statement terms and source nodes
  const sourceNodeDocs = new Map();
  for (const sn of q.sourceNodes) {
    sourceNodeDocs.set(sn.id, sn.document);
  }
  const usedSourceNodes = new Set();
  const checkTerm = (term, stmtDoc) => {
    if (!term || typeof term !== "object") return;
    if (term.kind === "blank") {
      const ref = term.node;
      if (!sourceNodeDocs.has(ref) || sourceNodeDocs.get(ref) !== stmtDoc)
        throw new Error("REFERENCE_INVALID: Blank reference missing or cross-document");
      usedSourceNodes.add(ref);
    }
  };
  for (const stmt of q.sourceStatements) {
    checkTerm(stmt.graph, stmt.document);
    checkTerm(stmt.subject, stmt.document);
    checkTerm(stmt.object, stmt.document);
  }
  for (const sn of q.sourceNodes) {
    if (!usedSourceNodes.has(sn.id))
      throw new Error("NORMALIZATION_INVALID: Unused source node");
  }

  // 5. Import state / targetDocument equivalence
  for (const imp of q.imports) {
    const hasTarget = Object.hasOwn(imp, "targetDocument") && imp.targetDocument !== undefined;
    if ((imp.state === "acquired") !== hasTarget)
      throw new Error("DOCUMENT_TYPE: Import state and targetDocument presence mismatch");
  }

  // 6. Entries validation
  for (const entry of q.entries) {
    if (typeof entry.code !== "string" || !entry.code)
      throw new Error("DOCUMENT_TYPE: Entry code must be a nonempty string");
    if (!portableRules.has(entry.rule))
      throw new Error("DOCUMENT_TYPE: Entry rule not in portable registry");

    const kind = entry.detail?.kind;
    const dim = entry.dimension;
    if (kind === "scope") {
      if (dim !== "scope")
        throw new Error("DOCUMENT_TYPE: Scope detail requires scope dimension");
      const allowedCodes = [
        "SOURCE_ASSOCIATIONS_UNAVAILABLE",
        "SOURCE_HEADER_ASSOCIATIONS_UNAVAILABLE",
        "ORIGINAL_SOURCE_UNAVAILABLE",
      ];
      if (!allowedCodes.includes(entry.code))
        throw new Error("DOCUMENT_TYPE: Invalid scope code");
    } else if (kind === "assessment") {
      if (!["profile", "lexical", "scope", "closure"].includes(dim))
        throw new Error("DOCUMENT_TYPE: Invalid assessment dimension");
    } else if (kind === "property") {
      if (dim !== "interpretation")
        throw new Error("DOCUMENT_TYPE: Property detail requires interpretation dimension");
      const hasIri = typeof entry.detail.iri === "string";
      const hasSubSuper =
        typeof entry.detail.subProperty === "string" &&
        typeof entry.detail.superProperty === "string";
      if (!hasIri && !hasSubSuper)
        throw new Error("DOCUMENT_TYPE: Property detail requires iri or subProperty+superProperty");
    } else if (kind === "headers") {
      if (dim !== "interpretation")
        throw new Error("DOCUMENT_TYPE: Headers detail requires interpretation dimension");
      const cands = entry.detail.candidates;
      if (!Array.isArray(cands) || cands.length === 0)
        throw new Error("DOCUMENT_TYPE: Headers detail requires nonempty candidates");
      if (!cands.includes(entry.detail.selected))
        throw new Error("DOCUMENT_TYPE: Selected header must occur in candidates");
    } else if (kind === "exclusion") {
      if (dim !== "scope")
        throw new Error("DOCUMENT_TYPE: Exclusion detail requires scope dimension");
    } else if (kind === "import") {
      if (dim !== "closure")
        throw new Error("DOCUMENT_TYPE: Import detail requires closure dimension");
    } else if (kind === "source-statements") {
      if (dim !== "scope")
        throw new Error("DOCUMENT_TYPE: Source-statements detail requires scope dimension");
      const stmts = entry.detail.statements;
      if (!Array.isArray(stmts) || stmts.length === 0)
        throw new Error("DOCUMENT_TYPE: Source-statements detail requires nonempty statements");
    } else {
      throw new Error(`DOCUMENT_TYPE: Unknown detail kind ${kind}`);
    }
  }
}

export async function produce(source) {
  safeFixture(source);
  if (
    Array.isArray(source) ||
    !source ||
    typeof source !== "object" ||
    !Object.hasOwn(source, "structural") ||
    !Object.hasOwn(source, "visualization") ||
    !Object.hasOwn(source, "qualifications")
  ) {
    throw new Error("DOCUMENT_REQUIRED_FIELD: Closed envelope requires structural, visualization and qualifications");
  }

  for (const key of Object.keys(source)) {
    if (!["profile", "structural", "visualization", "qualifications"].includes(key))
      throw new Error(`DOCUMENT_UNKNOWN_FIELD: Unknown envelope field ${key}`);
  }
  if (Object.hasOwn(source, "profile") && source.profile !== profile) {
    throw new Error("PROFILE_UNKNOWN: Unknown profile IRI");
  }

  validateQualificationInvariants(source);

  const input = { profile, ...structuredClone(source) };
  const records = new Map();
  const coreCategories = new Set(["subjects", "roles", "expressions", "constructs", "occurrences"]);

  for (const item of categories) {
    const list = item.path.reduce((acc, k) => acc?.[k], input);
    for (const [index, record] of list.entries()) {
      records.set(record.id, {
        category: item.category,
        type: item.type,
        prefix: item.prefix,
        node: blank(`p_${item.prefix}_${index}`),
      });
    }
  }

  let auxiliary = 0;
  const baseQuads = [];
  const emitted = new Set();

  const add = (s, p, o) => {
    if (typeof p !== "string") throw new Error("DEPENDENCY_FAILURE: Predicate must be string");
    if (p.startsWith("https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#"))
      throw new Error("DEPENDENCY_FAILURE: Base mapping cannot emit reserved compatible-mapping predicates");
    baseQuads.push({
      subject: s,
      predicate: named(p),
      object: o,
      graph: { termType: "DefaultGraph", value: "" },
    });
  };

  const type = (node, name) => add(node, rdfType, named(mapping + name));
  const fresh = (name) => {
    const node = blank(`a_${auxiliary++}`);
    type(node, name);
    return node;
  };

  function emitObject(value, shape, node, primary = false) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("DOCUMENT_TYPE: Oracle expects an object");
    const declared = shapeFields(shape, value);
    for (const required of requiredFields(shape, value)) {
      if (!Object.hasOwn(value, required))
        throw new Error(`DOCUMENT_REQUIRED_FIELD: Required field missing: ${required}`);
    }
    for (const key of Object.keys(value).sort()) {
      if (primary && key === "id") continue;
      if (!Object.hasOwn(declared, key))
        throw new Error(`DOCUMENT_UNKNOWN_FIELD: Unknown field ${key}`);
      if (key === "language" && shape === literal.discriminator.language) {
        value[key] = asciiLanguage(value[key], false);
      } else if (key === "range" && value.mode === "language") {
        value[key] = asciiLanguage(value[key], true);
      }
      add(node, mapping + "field/" + key, emit(value[key], declared[key]));
    }
    return node;
  }

  function emit(value, shape) {
    if (
      shape === "coreRef" ||
      shape === "docRef" ||
      shape === "importRef" ||
      shape === "entryRef" ||
      shape === "blankRef" ||
      shape === "statementRef"
    ) {
      textValue(value);
      const reference = records.get(value);
      if (!reference) throw new Error(`REFERENCE_INVALID: Dangling reference: ${value}`);
      if (shape === "coreRef" && !coreCategories.has(reference.category))
        throw new Error(`REFERENCE_INVALID: Reference expected core category, got ${reference.category}`);
      if (shape === "docRef" && reference.category !== "documents")
        throw new Error(`REFERENCE_INVALID: Reference expected documents, got ${reference.category}`);
      if (shape === "importRef" && reference.category !== "imports")
        throw new Error(`REFERENCE_INVALID: Reference expected imports, got ${reference.category}`);
      if (shape === "entryRef" && reference.category !== "entries")
        throw new Error(`REFERENCE_INVALID: Reference expected entries, got ${reference.category}`);
      if (shape === "blankRef" && reference.category !== "sourceNodes")
        throw new Error(`REFERENCE_INVALID: Reference expected sourceNodes, got ${reference.category}`);
      if (shape === "statementRef" && reference.category !== "sourceStatements")
        throw new Error(`REFERENCE_INVALID: Reference expected sourceStatements, got ${reference.category}`);
      return reference.node;
    }
    if (shape === "iri") {
      textValue(value);
      if (
        !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
        [...value].some((char) => char.codePointAt(0) <= 0x20) ||
        /[<>"{}|\\^`]/.test(value)
      )
        throw new Error("IRI_INVALID: Rejects non-absolute or unsafe IRI spelling");
      return named(value);
    }
    if (shape === "decimal") {
      textValue(value);
      if (!/^(0|[1-9][0-9]*)$/.test(value))
        throw new Error("DECIMAL_INVALID: Rejects noncanonical decimal");
      return lit(value, xsd + "string");
    }
    if (shape === "text") return lit(textValue(value), xsd + "string");
    if (shape === "string") return lit(textValue(value), xsd + "string");
    if (shape === "token") {
      textValue(value);
      if (!/^[\x20-\x7e]*$/.test(value))
        throw new Error("DOCUMENT_TYPE: Rejects non-ASCII token");
      return lit(value, mapping + "token");
    }
    if (shape === "boolean") {
      if (typeof value !== "boolean")
        throw new Error("DOCUMENT_TYPE: Rejects non-boolean scalar");
      return lit(value ? "true" : "false", xsd + "boolean");
    }
    if (shape === "number") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        Object.is(value, -0)
      )
        throw new Error("DOCUMENT_TYPE: Rejects non-finite/negative-zero number");
      return lit(canonicalize(value), mapping + "binary64");
    }
    if (shape.primary) {
      const primary = records.get(value.id);
      if (primary.category !== shape.primary || emitted.has(value.id))
        throw new Error("NORMALIZATION_INVALID: Repeated or miscategorized primary");
      emitted.add(value.id);
      type(primary.node, primary.type);
      return emitObject(value, shape.shape, primary.node, true);
    }
    if (shape.collection) {
      if (!Array.isArray(value))
        throw new Error("DOCUMENT_TYPE: Oracle expects a collection array");
      if (shape.collection === "Sequence" && value.length < 2)
        throw new Error("DOCUMENT_TYPE: Sequence requires at least two members");
      const node = fresh(shape.collection);
      value.forEach((item, index) => {
        if (shape.collection === "Set") {
          add(node, mapping + "member", emit(item, shape.item));
        } else {
          const slot = fresh("Slot");
          add(node, mapping + "slot", slot);
          add(
            slot,
            mapping + "index",
            lit(String(index), xsd + "nonNegativeInteger"),
          );
          add(slot, mapping + "value", emit(item, shape.item));
        }
      });
      return node;
    }
    return emitObject(value, shape, fresh("Object"));
  }

  const root = named(mapping + "root");
  type(root, "Object");
  emitObject(input, compatibleArtifactEnvelope, root);

  // Exact Refinement
  const blankNodesMap = new Map();
  for (const q of baseQuads) {
    if (q.subject.termType === "BlankNode") blankNodesMap.set(q.subject.value, q.subject);
    if (q.object.termType === "BlankNode") blankNodesMap.set(q.object.value, q.object);
  }
  const blankNodes = [...blankNodesMap.values()];

  const incidentQuads = new Map();
  for (const b of blankNodes) incidentQuads.set(b.value, []);
  for (const q of baseQuads) {
    const sBlank = q.subject.termType === "BlankNode";
    const oBlank = q.object.termType === "BlankNode";
    if (sBlank) incidentQuads.get(q.subject.value).push(q);
    if (oBlank && (!sBlank || q.subject.value !== q.object.value))
      incidentQuads.get(q.object.value).push(q);
  }

  const groundTermCache = new Map();
  function getGroundKey(term) {
    const cacheKey =
      term.termType === "NamedNode"
        ? `N:${term.value}`
        : `L:${term.value}:${term.datatype.value}`;
    let cached = groundTermCache.get(cacheKey);
    if (!cached) {
      let rawKey;
      if (term.termType === "NamedNode") {
        rawKey = ["iri", term.value];
      } else {
        rawKey = ["literal", term.value, term.datatype.value, ""];
      }
      const u = Buffer.from(JSON.stringify(rawKey), "utf8");
      const h = createHash("sha256").update(u).digest("hex");
      cached = ["term", h];
      groundTermCache.set(cacheKey, cached);
    }
    return cached;
  }

  let colors = new Map();
  for (const b of blankNodes) colors.set(b.value, "");
  let prevCount = blankNodes.length > 0 ? 1 : 0;

  while (blankNodes.length > 0) {
    const nextColors = new Map();
    for (const b of blankNodes) {
      const bId = b.value;
      const prevColorOfB = colors.get(bId);
      const quadsForB = incidentQuads.get(bId) || [];
      const incidentStrings = [];

      for (const q of quadsForB) {
        const subjKey =
          q.subject.termType === "BlankNode"
            ? q.subject.value === bId
              ? ["self"]
              : ["blank", colors.get(q.subject.value)]
            : getGroundKey(q.subject);
        const predKey = getGroundKey(q.predicate);
        const objKey =
          q.object.termType === "BlankNode"
            ? q.object.value === bId
              ? ["self"]
              : ["blank", colors.get(q.object.value)]
            : getGroundKey(q.object);

        incidentStrings.push(JSON.stringify([subjKey, predKey, objKey]));
      }

      incidentStrings.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const sig = JSON.stringify([prevColorOfB, incidentStrings]);
      const nextColor = createHash("sha256")
        .update(Buffer.from(sig, "utf8"))
        .digest("hex");
      nextColors.set(bId, nextColor);
    }

    colors = nextColors;
    const distinctCount = new Set(colors.values()).size;
    if (distinctCount <= prevCount) break;
    prevCount = distinctCount;
  }

  const augmentedQuads = [...baseQuads];
  for (const b of blankNodes) {
    const c = colors.get(b.value);
    augmentedQuads.push({
      subject: b,
      predicate: named(colorPredicate),
      object: lit(c, xsd + "hexBinary"),
      graph: { termType: "DefaultGraph", value: "" },
    });
  }

  const canonicalIdMap = new Map();
  const maxDeepIterations = Math.min(blankNodes.length * blankNodes.length, 100000);
  const canonicalNQuads = await rdfCanonize.canonize(augmentedQuads, {
    algorithm: "RDFC-1.0",
    messageDigestAlgorithm: "sha256",
    rejectURDNA2015: true,
    canonicalIdMap,
    maxDeepIterations,
    signal: AbortSignal.timeout(20000),
  });

  const ordinal = (identifier) => {
    const match =
      typeof identifier === "string" && /^c14n(0|[1-9][0-9]*)$/.exec(identifier);
    if (!match)
      throw new Error(`DEPENDENCY_FAILURE: Invalid canonical ID: ${identifier}`);
    return BigInt(match[1]);
  };

  const ids = {};
  for (const item of categories) {
    const members = [...records.entries()].filter(
      ([, rec]) => rec.category === item.category,
    );
    members.sort(([, a], [, b]) => {
      const x = ordinal(canonicalIdMap.get(a.node.value));
      const y = ordinal(canonicalIdMap.get(b.node.value));
      return x < y ? -1 : x > y ? 1 : 0;
    });
    members.forEach(([handle, record], rank) => {
      record.canonicalId = item.prefix + rank;
      ids[handle] = {
        handle,
        id: record.canonicalId,
        issuedId: record.canonicalId,
        canonicalBlank: canonicalIdMap.get(record.node.value),
        canonicalId: record.canonicalId,
        category: record.category,
      };
    });
  }

  function replace(value, shape) {
    if (
      shape === "coreRef" ||
      shape === "docRef" ||
      shape === "importRef" ||
      shape === "entryRef" ||
      shape === "blankRef" ||
      shape === "statementRef"
    ) {
      return records.get(value).canonicalId;
    }
    if (typeof shape === "string") return value;
    if (shape.collection) {
      const members = value.map((item) => replace(item, shape.item));
      if (shape.collection === "Sequence") return members;
      // Inside-out UTF-8 JCS sorting and duplicate check
      const seen = new Set();
      members.sort((a, b) => {
        const aJcs = canonicalize(a);
        const bJcs = canonicalize(b);
        return utf8(aJcs, bJcs);
      });
      for (const m of members) {
        const jcs = canonicalize(m);
        if (seen.has(jcs))
          throw new Error("NORMALIZATION_INVALID: Duplicate set member after replacement");
        seen.add(jcs);
      }
      return members;
    }
    const declared = shapeFields(shape.primary ? shape.shape : shape, value);
    const output = {};
    for (const key of Object.keys(value)) {
      output[key] =
        shape.primary && key === "id"
          ? records.get(value.id).canonicalId
          : replace(value[key], declared[key]);
    }
    return output;
  }

  const document = replace(input, compatibleArtifactEnvelope);
  const jsonString = canonicalize(document);
  const bytes = Buffer.from(jsonString, "utf8");
  const baseNQuads = rdfCanonize.NQuads.serialize(baseQuads);

  return {
    document,
    baseNQuads,
    canonicalNQuads,
    ids,
    bytes,
  };
}

export function permute(source) {
  const cloned = structuredClone(source);
  const handleMap = new Map();
  let counter = 0;

  for (const item of categories) {
    const list = item.path.reduce((acc, k) => acc?.[k], cloned) || [];
    for (const rec of list) {
      handleMap.set(rec.id, `perm_${item.prefix}_${counter++}`);
    }
  }

  function rewrite(value, shape) {
    if (!value || typeof value !== "object") {
      if (
        (shape === "coreRef" ||
          shape === "docRef" ||
          shape === "importRef" ||
          shape === "entryRef" ||
          shape === "blankRef" ||
          shape === "statementRef") &&
        handleMap.has(value)
      ) {
        return handleMap.get(value);
      }
      return value;
    }
    if (Array.isArray(value)) {
      const isSequence = shape.collection === "Sequence";
      const itemShape = shape.item;
      const rewritten = value.map((m) => rewrite(m, itemShape));
      return isSequence ? rewritten : rewritten.reverse();
    }
    const declared = shapeFields(shape.primary ? shape.shape : shape, value);
    const out = {};
    for (const k of Object.keys(value)) {
      if (shape.primary && k === "id") {
        out[k] = handleMap.get(value.id) || value.id;
      } else {
        out[k] = rewrite(value[k], declared[k]);
      }
    }
    return out;
  }

  return rewrite(cloned, compatibleArtifactEnvelope);
}

export const cases = [
  {
    id: "comprehensive-compatible-core",
    covers: [
      "all-seven-detail-kinds",
      "multi-document",
      "root-true-and-false",
      "import-acquired-and-unavailable",
      "graph-forms-default-unavailable-named-anonymous",
      "direction-absent-and-empty",
      "cross-document-blank-identity",
      "nonempty-structural-core-with-qualification-refs",
    ],
    source: {
      structural: {
        ontology: {
          iri: "https://example.org/ont/main",
          versionIri: "https://example.org/ont/main/1.0",
          imports: ["https://example.org/ont/imported"],
          annotations: [],
        },
        subjects: [
          { id: "subj-person", iri: "https://example.org/o#Person" },
          { id: "subj-name", iri: "https://example.org/o#name" },
        ],
        roles: [
          { id: "role-person", kind: "class", subject: "subj-person" },
          { id: "role-name", kind: "datatype", subject: "subj-name" },
        ],
        expressions: [],
        constructs: [],
        occurrences: [
          { id: "occ-person-node", kind: "class-node", targets: ["role-person"] },
        ],
      },
      visualization: {
        placements: [
          {
            occurrence: "occ-person-node",
            position: { x: 10, y: 20 },
            pinned: true,
          },
        ],
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        hidden: [],
        labelSelection: { mode: "untagged" },
        prefixes: [{ prefix: "ex", iri: "https://example.org/o#" }],
        display: {
          compactNotation: false,
          nodeScaling: "uniform",
          externalColoring: true,
        },
      },
      qualifications: {
        documents: [
          {
            id: "doc-root",
            root: true,
            headers: "one",
            ontologyIri: "https://example.org/ont/main",
            versionIri: "https://example.org/ont/main/1.0",
          },
          {
            id: "doc-ext",
            root: false,
            headers: "multiple",
            ontologyIri: "https://example.org/ont/imported",
          },
        ],
        imports: [
          {
            id: "imp-ext",
            parentDocument: "doc-root",
            requestedIri: "https://example.org/ont/imported",
            targetDocument: "doc-ext",
            state: "acquired",
          },
          {
            id: "imp-missing",
            parentDocument: "doc-root",
            requestedIri: "https://example.org/ont/missing",
            state: "unavailable",
          },
        ],
        sourceNodes: [
          { id: "b-root-1", document: "doc-root" },
          { id: "b-root-2", document: "doc-root" },
          { id: "b-ext-1", document: "doc-ext" },
        ],
        sourceStatements: [
          {
            id: "stmt-default-graph",
            document: "doc-root",
            graph: { kind: "default" },
            subject: { kind: "blank", node: "b-root-1" },
            predicate: "https://example.org/p#note",
            object: {
              kind: "literal",
              value: {
                lexical: "Plain literal with absent direction",
                datatype: "http://www.w3.org/2001/XMLSchema#string",
                language: "",
              },
            },
          },
          {
            id: "stmt-unavailable-graph",
            document: "doc-root",
            graph: { kind: "unavailable" },
            subject: { kind: "iri", iri: "https://example.org/e#item1" },
            predicate: "https://example.org/p#dirLabel",
            object: {
              kind: "literal",
              value: {
                lexical: "Empty direction string literal",
                datatype: "http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString",
                language: "en",
                direction: "",
              },
            },
          },
          {
            id: "stmt-named-graph",
            document: "doc-root",
            graph: { kind: "iri", iri: "https://example.org/graphs#g1" },
            subject: { kind: "blank", node: "b-root-2" },
            predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            object: { kind: "iri", iri: "https://example.org/o#Person" },
          },
          {
            id: "stmt-anonymous-graph",
            document: "doc-ext",
            graph: { kind: "blank", node: "b-ext-1" },
            subject: { kind: "iri", iri: "https://example.org/e#itemExt" },
            predicate: "https://example.org/p#related",
            object: { kind: "blank", node: "b-ext-1" },
          },
        ],
        entries: [
          {
            id: "entry-scope",
            dimension: "scope",
            code: "SOURCE_ASSOCIATIONS_UNAVAILABLE",
            records: ["subj-person"],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-source-assessment",
            detail: { kind: "scope" },
          },
          {
            id: "entry-assessment",
            dimension: "profile",
            code: "DATATYPE_CUSTOM",
            records: ["role-name"],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-profile-assessment",
            detail: {
              kind: "assessment",
              status: "unverified",
              datatype: "https://example.org/customDatatype",
              count: "1",
            },
          },
          {
            id: "entry-property",
            dimension: "interpretation",
            code: "PROPERTY_CATEGORY_SELECTED",
            records: [],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#owning-compatible-interpretation",
            detail: {
              kind: "property",
              iri: "https://example.org/o#name",
              declaredCategories: ["data"],
              resolvedCategory: "data",
            },
          },
          {
            id: "entry-headers",
            dimension: "interpretation",
            code: "HEADER_MULTI_SELECT",
            records: [],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#owning-header-selection",
            detail: {
              kind: "headers",
              candidates: [
                "https://example.org/ont/main",
                "https://example.org/ont/alt",
              ],
              selected: "https://example.org/ont/main",
            },
          },
          {
            id: "entry-exclusion",
            dimension: "scope",
            code: "CONSTRUCTOR_UNSUPPORTED",
            records: [],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#retained-projection",
            detail: {
              kind: "exclusion",
              constructor: "DisjointUnion",
              unsupported: "DisjointUnion axiom excluded by projection",
            },
          },
          {
            id: "entry-import",
            dimension: "closure",
            code: "IMPORT_FAILED",
            records: [],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#import-acquisition",
            detail: {
              kind: "import",
              requestedIri: "https://example.org/ont/missing",
            },
          },
          {
            id: "entry-statements",
            dimension: "scope",
            code: "STATEMENTS_UNPARSED",
            records: [],
            documents: ["doc-root"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#canonical-source",
            detail: {
              kind: "source-statements",
              statements: ["stmt-default-graph", "stmt-unavailable-graph"],
            },
          },
        ],
      },
    },
  },
  {
    id: "property-sub-super-pair",
    covers: [
      "property-detail-sub-super",
      "direction-explicit-ltr",
      "headers-unavailable",
    ],
    source: {
      structural: {
        ontology: { imports: [], annotations: [] },
        subjects: [],
        roles: [],
        expressions: [],
        constructs: [],
        occurrences: [],
      },
      visualization: {
        placements: [],
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        hidden: [],
        labelSelection: { mode: "untagged" },
        prefixes: [],
        display: {
          compactNotation: false,
          nodeScaling: "uniform",
          externalColoring: true,
        },
      },
      qualifications: {
        documents: [
          {
            id: "doc-single",
            root: true,
            headers: "unavailable",
          },
        ],
        imports: [],
        sourceNodes: [{ id: "b-lone", document: "doc-single" }],
        sourceStatements: [
          {
            id: "stmt-ltr",
            document: "doc-single",
            graph: { kind: "default" },
            subject: { kind: "blank", node: "b-lone" },
            predicate: "https://example.org/p#ltrText",
            object: {
              kind: "literal",
              value: {
                lexical: "Left-to-right text",
                datatype: "http://www.w3.org/1999/02/22-rdf-syntax-ns#dirLangString",
                language: "en",
                direction: "ltr",
              },
            },
          },
        ],
        entries: [
          {
            id: "entry-sub-super",
            dimension: "interpretation",
            code: "HIERARCHY_RETAINED",
            records: [],
            documents: ["doc-single"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#owning-compatible-interpretation",
            detail: {
              kind: "property",
              subProperty: "https://example.org/p#child",
              superProperty: "https://example.org/p#parent",
              evidence: "rdfs:subPropertyOf assertion",
            },
          },
        ],
      },
    },
  },
  {
    id: "minimal-empty-core-headers-none",
    covers: ["empty-structural-core", "headers-none", "zero-blank-nodes"],
    source: {
      structural: {
        ontology: { imports: [], annotations: [] },
        subjects: [],
        roles: [],
        expressions: [],
        constructs: [],
        occurrences: [],
      },
      visualization: {
        placements: [],
        camera: { center: { x: 0, y: 0 }, zoom: 1 },
        hidden: [],
        labelSelection: { mode: "untagged" },
        prefixes: [],
        display: {
          compactNotation: false,
          nodeScaling: "uniform",
          externalColoring: true,
        },
      },
      qualifications: {
        documents: [
          {
            id: "doc-minimal",
            root: true,
            headers: "none",
          },
        ],
        imports: [],
        sourceNodes: [],
        sourceStatements: [],
        entries: [
          {
            id: "entry-minimal-scope",
            dimension: "scope",
            code: "ORIGINAL_SOURCE_UNAVAILABLE",
            records: [],
            documents: ["doc-minimal"],
            rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-source-assessment",
            detail: { kind: "scope" },
          },
        ],
      },
    },
  },
];
