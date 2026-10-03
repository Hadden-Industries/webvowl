// SPDX-License-Identifier: AGPL-3.0-only
// Independent conformance producer, derived only from specification A6 and D18.
// This accepts the reviewed normalized fixtures; it is not a public validator.
import { Buffer } from "node:buffer";
import canonicalize from "canonicalize";
import rdfCanonize from "rdf-canonize";

export const profiles = Object.freeze({
  structural:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  artifact:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1",
});
const mapping =
  "https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#";
const rdfType = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const categories = [
  ["subjects", "Subject", "s"],
  ["roles", "Role", "r"],
  ["expressions", "Expression", "x"],
  ["constructs", "Construct", "c"],
  ["occurrences", "Occurrence", "o"],
];
const set = (item) => ({ collection: "Set", item });
const sequence = (item) => ({ collection: "Sequence", item });
const fields = (value, optional = []) => ({
  fields: value,
  required: Object.keys(value).filter((key) => !optional.includes(key)),
});
const subject = fields({ iri: "iri" }, ["iri"]);
const role = fields({ kind: "token", subject: "ref" });
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
    subject: { subject: "ref" },
  },
};
const annotation = fields({ predicate: "iri", value: annotationValue });
annotation.fields.annotations = set(annotation);
annotation.required.push("annotations");
const facet = fields({ facet: "iri", value: literal });
const expressionFields = {
  "class-intersection": { members: set("ref") },
  "class-union": { members: set("ref") },
  "class-complement": { operand: "ref" },
  "class-enumeration": { members: set("ref") },
  "object-some": { property: "ref", filler: "ref" },
  "object-all": { property: "ref", filler: "ref" },
  "object-value": { property: "ref", value: "ref" },
  "object-self": { property: "ref" },
  "object-min-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "object-max-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "object-exact-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "data-some": { property: "ref", filler: "ref" },
  "data-all": { property: "ref", filler: "ref" },
  "data-value": { property: "ref", value: literal },
  "data-min-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "data-max-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "data-exact-cardinality": {
    property: "ref",
    cardinality: "decimal",
    filler: "ref",
  },
  "object-inverse": { property: "ref" },
  "data-intersection": { members: set("ref") },
  "data-union": { members: set("ref") },
  "data-complement": { operand: "ref" },
  "data-enumeration": { members: set(literal) },
  "datatype-restriction": { datatype: "ref", facets: set(facet) },
};
const constructFields = {
  subclass: { sub: "ref", super: "ref" },
  "equivalent-classes": { members: set("ref") },
  "disjoint-classes": { members: set("ref") },
  "disjoint-union": { defined: "ref", members: set("ref") },
  "sub-object-property": { sub: "ref", super: "ref" },
  "equivalent-object-properties": { members: set("ref") },
  "disjoint-object-properties": { members: set("ref") },
  "inverse-properties": { members: set("ref") },
  "property-chain": { members: sequence("ref"), super: "ref" },
  "object-domain": { property: "ref", target: "ref" },
  "object-range": { property: "ref", target: "ref" },
  "object-characteristic": { property: "ref", characteristic: "token" },
  "sub-data-property": { sub: "ref", super: "ref" },
  "equivalent-data-properties": { members: set("ref") },
  "disjoint-data-properties": { members: set("ref") },
  "data-domain": { property: "ref", target: "ref" },
  "data-range": { property: "ref", target: "ref" },
  "data-characteristic": { property: "ref", characteristic: "token" },
  "sub-rdf-property": { sub: "ref", super: "ref" },
  "equivalent-rdf-properties": { members: set("ref") },
  "disjoint-rdf-properties": { members: set("ref") },
  "rdf-domain": { property: "ref", target: "ref" },
  "rdf-range": { property: "ref", target: "ref" },
  "rdf-characteristic": { property: "ref", characteristic: "token" },
  "sub-annotation-property": { sub: "ref", super: "ref" },
  "annotation-domain": { property: "ref", target: "iri" },
  "annotation-range": { property: "ref", target: "iri" },
  "datatype-definition": { datatype: "ref", target: "ref" },
  key: {
    class: "ref",
    objectProperties: set("ref"),
    dataProperties: set("ref"),
  },
  "class-membership": { class: "ref", individual: "ref" },
  "annotation-assertion": {
    subject: "ref",
    predicate: "iri",
    value: annotationValue,
  },
};
const assertion = {
  discriminator: { ...constructFields, declaration: { role: "ref" } },
};
constructFields["assertion-anchor"] = {
  assertion,
  annotations: set(annotation),
};
const context = {
  discriminator: {
    class: { targets: set("ref") },
    property: fields({ properties: set("ref"), scope: "ref" }, ["scope"]),
  },
};
const occurrenceFields = {
  "class-node": fields({ targets: set("ref"), context }, ["context"]),
  "datatype-node": { target: "ref", context },
  "property-edge": { properties: set("ref"), from: "ref", to: "ref" },
  "inverse-edge": {
    construct: "ref",
    forward: set("ref"),
    reverse: set("ref"),
    from: "ref",
    to: "ref",
  },
  "subclass-edge": { construct: "ref", from: "ref", to: "ref" },
  "disjoint-edge": { construct: "ref", ends: set("ref") },
  "operator-edge": { expression: "ref", from: "ref", to: "ref" },
  "restriction-edge": { construct: "ref", from: "ref", to: "ref" },
  label: { edge: "ref", direction: "token" },
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
const documentShape = fields(
  {
    profile: "iri",
    structural,
    visualization: fields({
      placements: set(
        fields({ occurrence: "ref", position: point, pinned: "boolean" }),
      ),
      camera: fields({ center: point, zoom: "number" }),
      hidden: set("ref"),
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
    }),
  },
  ["visualization"],
);

function shapeFields(shape, value) {
  if (shape.fields) return shape.fields;
  const tag = shape.tag ?? "kind";
  const variant =
    typeof value[tag] === "string" &&
    Object.hasOwn(shape.discriminator ?? {}, value[tag]) &&
    shape.discriminator[value[tag]];
  if (!variant) throw new Error(`Oracle has no shape for ${value[tag]}`);
  return { [tag]: "token", ...(variant.fields ?? variant) };
}
function requiredFields(shape, value) {
  if (shape.fields) return shape.required;
  const tag = shape.tag ?? "kind";
  const variant =
    typeof value[tag] === "string" &&
    Object.hasOwn(shape.discriminator ?? {}, value[tag]) &&
    shape.discriminator[value[tag]];
  if (!variant) throw new Error(`Oracle has no shape for ${value[tag]}`);
  return [tag, ...(variant.required ?? Object.keys(variant))];
}
function textValue(value) {
  if (typeof value !== "string")
    throw new Error("Oracle expects a string scalar");
  for (const char of value) {
    const point = char.codePointAt(0);
    if (
      (point >= 0xd800 && point <= 0xdfff) ||
      (point >= 0xfdd0 && point <= 0xfdef) ||
      (point & 0xffff) >= 0xfffe
    )
      throw new Error("Oracle rejects invalid Unicode scalar");
  }
  return value;
}
function asciiLanguage(value, range) {
  textValue(value);
  if (!/^[A-Za-z0-9*-]+$/.test(value))
    throw new Error("Oracle rejects non-ASCII language spelling");
  const lower = value.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
  if (range) {
    if (!/^(?:\*|[a-z]{1,8}(?:-[a-z0-9]{1,8})*)$/.test(lower))
      throw new Error("Oracle rejects invalid basic language range");
  } else if (!/^[a-z]{1,8}(?:-[a-z0-9]{1,8})*$/.test(lower)) {
    throw new Error("Oracle rejects invalid language token spelling");
  }
  return lower;
}
function safeFixture(value, active = new Set()) {
  if (value === null) throw new Error("Oracle rejects null fixtures");
  if (typeof value !== "object") {
    if (!["string", "boolean", "number"].includes(typeof value))
      throw new Error("Oracle rejects non-JSON fixture values");
    return;
  }
  if (active.has(value)) throw new Error("Oracle rejects fixture cycles");
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (
    array
      ? prototype !== Array.prototype
      : prototype !== Object.prototype && prototype !== null
  )
    throw new Error("Oracle rejects fixture prototypes");
  active.add(value);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1)
    throw new Error("Oracle rejects sparse or extended arrays");
  for (const key of keys) {
    if (array && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    )
      throw new Error("Oracle rejects unsafe fixture descriptors");
    if (array && !/^(0|[1-9][0-9]*)$/.test(key))
      throw new Error("Oracle rejects extra array keys");
    safeFixture(descriptor.value, active);
  }
  active.delete(value);
}
const named = (value) => ({ termType: "NamedNode", value });
const blank = (value) => ({ termType: "BlankNode", value });
const lit = (value, datatype) => ({
  termType: "Literal",
  value,
  datatype: named(datatype),
});
const utf8 = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export async function produce(source, profile) {
  if (!Object.values(profiles).includes(profile))
    throw new Error("Unsupported oracle profile");
  safeFixture(source);
  if (
    Array.isArray(source) ||
    !source ||
    typeof source !== "object" ||
    Object.keys(source).some(
      (key) => key !== "structural" && key !== "visualization",
    ) ||
    !Object.hasOwn(source, "structural")
  )
    throw new Error("Oracle requires the closed source envelope");
  if (
    (profile === profiles.artifact) !==
    Object.hasOwn(source, "visualization")
  )
    throw new Error("Oracle profile/visualization mismatch");
  const input = { profile, ...structuredClone(source) };
  const records = new Map();
  for (const [category, type, prefix] of categories) {
    if (!Array.isArray(input.structural[category]))
      throw new Error(`Oracle requires primary collection ${category}`);
    for (const [index, record] of input.structural[category].entries()) {
      if (typeof record.id !== "string" || !record.id)
        throw new Error("Oracle requires nonempty primary handles");
      textValue(record.id);
      if (records.has(record.id))
        throw new Error(`Duplicate fixture handle ${record.id}`);
      records.set(record.id, {
        category,
        type,
        prefix,
        node: blank(`p${prefix}${index}`),
      });
    }
  }
  let auxiliary = 0;
  const quads = [];
  const emitted = new Set();
  const add = (s, p, o) =>
    quads.push({
      subject: s,
      predicate: named(p),
      object: o,
      graph: { termType: "DefaultGraph", value: "" },
    });
  const type = (node, name) => add(node, rdfType, named(mapping + name));
  const fresh = (name) => {
    const node = blank(`a${auxiliary++}`);
    type(node, name);
    return node;
  };
  function emitObject(value, shape, node, primary = false) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Oracle expects an object");
    const declared = shapeFields(shape, value);
    for (const required of requiredFields(shape, value))
      if (!Object.hasOwn(value, required))
        throw new Error(`Oracle fixture required field missing: ${required}`);
    for (const key of Object.keys(value).sort()) {
      if (primary && key === "id") continue;
      if (!Object.hasOwn(declared, key))
        throw new Error(`Oracle fixture field lacks declared type: ${key}`);
      if (key === "language" || (key === "range" && value.mode === "language"))
        value[key] = asciiLanguage(value[key], key === "range");
      add(node, mapping + "field/" + key, emit(value[key], declared[key]));
    }
    return node;
  }
  function emit(value, shape) {
    if (shape === "ref") {
      textValue(value);
      const reference = records.get(value);
      if (!reference) throw new Error(`Dangling fixture reference: ${value}`);
      return reference.node;
    }
    if (shape === "iri") {
      textValue(value);
      if (
        !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
        [...value].some((character) => character.codePointAt(0) <= 0x20) ||
        /[<>"{}|\\^`]/.test(value)
      )
        throw new Error("Oracle rejects non-absolute or unsafe IRI spelling");
      return named(value);
    }
    if (shape === "decimal") {
      textValue(value);
      if (!/^(0|[1-9][0-9]*)$/.test(value))
        throw new Error("Oracle rejects noncanonical decimal");
      return lit(value, xsd + "string");
    }
    if (shape === "text") return lit(textValue(value), xsd + "string");
    if (shape === "token") {
      textValue(value);
      if (!/^[\x20-\x7e]+$/.test(value))
        throw new Error("Oracle rejects non-ASCII token");
      return lit(value, mapping + "token");
    }
    if (shape === "boolean") {
      if (typeof value !== "boolean")
        throw new Error("Oracle rejects boolean coercion");
      return lit(value ? "true" : "false", xsd + "boolean");
    }
    if (shape === "number") {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        Object.is(value, -0)
      )
        throw new Error(
          "Oracle rejects non-finite/non-number/negative-zero scalar",
        );
      return lit(canonicalize(value), mapping + "binary64");
    }
    if (shape.primary) {
      const primary = records.get(value.id);
      if (primary.category !== shape.primary || emitted.has(value.id))
        throw new Error("Repeated or miscategorized fixture primary");
      emitted.add(value.id);
      type(primary.node, primary.type);
      return emitObject(value, shape.shape, primary.node, true);
    }
    if (shape.collection) {
      if (!Array.isArray(value))
        throw new Error("Oracle expects a collection array");
      if (shape.collection === "Sequence" && value.length < 2)
        throw new Error("Oracle requires two sequence items");
      const node = fresh(shape.collection);
      value.forEach((item, index) => {
        if (shape.collection === "Set")
          add(node, mapping + "member", emit(item, shape.item));
        else {
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
  emitObject(input, documentShape, root);
  const canonicalIdMap = new Map();
  const canonicalNQuads = await rdfCanonize.canonize(quads, {
    algorithm: "RDFC-1.0",
    messageDigestAlgorithm: "sha256",
    rejectURDNA2015: true,
    canonicalIdMap,
    maxDeepIterations: Math.min(records.size + auxiliary, 100000),
    signal: AbortSignal.timeout(10000),
  });
  const ordinal = (identifier) => {
    const match =
      typeof identifier === "string" &&
      /^c14n(0|[1-9][0-9]*)$/.exec(identifier);
    if (!match)
      throw new Error(
        "Oracle received an invalid or missing canonical identifier",
      );
    return BigInt(match[1]);
  };
  if (
    canonicalIdMap.size !== records.size + auxiliary ||
    new Set(canonicalIdMap.values()).size !== canonicalIdMap.size
  )
    throw new Error(
      "Oracle received missing or multiply assigned canonical labels",
    );
  for (const identifier of canonicalIdMap.values()) ordinal(identifier);
  for (const record of records.values())
    ordinal(canonicalIdMap.get(record.node.value));
  const correspondence = [];
  for (const [category, , prefix] of categories) {
    const members = [...records.entries()].filter(
      ([, record]) => record.category === category,
    );
    members.sort(([, a], [, b]) => {
      const x = ordinal(canonicalIdMap.get(a.node.value));
      const y = ordinal(canonicalIdMap.get(b.node.value));
      return x < y ? -1 : x > y ? 1 : 0;
    });
    members.forEach(([handle, record], rank) => {
      record.canonicalId = prefix + rank;
      correspondence.push({
        category,
        sourceHandle: handle,
        primaryBlankNode: record.node.value,
        rdfcIdentifier: canonicalIdMap.get(record.node.value),
        canonicalId: record.canonicalId,
      });
    });
  }
  function replace(value, shape) {
    if (shape === "ref") return records.get(value).canonicalId;
    if (typeof shape === "string") return value;
    if (shape.collection) {
      const members = value.map((item) => replace(item, shape.item));
      return shape.collection === "Sequence"
        ? members
        : members.sort((a, b) => utf8(canonicalize(a), canonicalize(b)));
    }
    const declared = shapeFields(shape.primary ? shape.shape : shape, value);
    const output = {};
    for (const key of Object.keys(value))
      output[key] =
        shape.primary && key === "id"
          ? records.get(value.id).canonicalId
          : replace(value[key], declared[key]);
    return output;
  }
  const document = replace(input, documentShape);
  return {
    document,
    bytes: Buffer.from(canonicalize(document), "utf8"),
    mappedNQuads: rdfCanonize.NQuads.serialize(quads),
    canonicalNQuads,
    correspondence,
    blankNodeCount: records.size + auxiliary,
    quadCount: quads.length,
  };
}
