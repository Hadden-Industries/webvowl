import { profiles } from "./profiles.js";

// The A2-A4/B1/B3 inventory drives schema generation, typed reference traversal and
// A6 encoding together. Field spelling never heuristically determines a reference.
const token = (...values) => ({ token: values });
const reference = (category, ...kinds) => ({ reference: category, kinds });
const set = (items, minimum = 0, maximum) => ({ items, minimum, maximum });
const object = (fields, optional = []) => ({ fields, optional });
const primary = (category, fields) =>
  object({ id: { id: category }, ...fields });
const choice = (field, branches) => ({ discriminator: field, branches });
const ref = Object.fromEntries(
  ["S", "R", "X", "K", "O", "C", "D", "P", "DP", "RP", "AP", "I"].map(
    (name) => [name, reference(name)],
  ),
);

export const roleKinds = Object.freeze([
  "class",
  "rdf-class",
  "datatype",
  "object-property",
  "data-property",
  "annotation-property",
  "rdf-property",
  "individual",
]);
export const dataRangeKinds = Object.freeze([
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
]);
export const expressionPayloads = {
  "class-intersection": { members: set(ref.C, 1) },
  "class-union": { members: set(ref.C, 1) },
  "class-complement": { operand: ref.C },
  "class-enumeration": { members: set(ref.I, 1) },
  "object-some": { property: ref.P, filler: ref.C },
  "object-all": { property: ref.P, filler: ref.C },
  "object-value": { property: ref.P, value: ref.I },
  "object-self": { property: ref.P },
  "object-inverse": { property: reference("R", "object-property") },
  "data-some": { property: ref.DP, filler: ref.D },
  "data-all": { property: ref.DP, filler: ref.D },
  "data-value": { property: ref.DP, value: "Literal" },
  "data-intersection": { members: set(ref.D, 1) },
  "data-union": { members: set(ref.D, 1) },
  "data-complement": { operand: ref.D },
  "data-enumeration": { members: set("Literal", 1) },
  "datatype-restriction": {
    datatype: reference("R", "datatype"),
    facets: set("Facet", 1),
  },
};
for (const family of ["object", "data"]) {
  for (const bound of ["min", "max", "exact"]) {
    expressionPayloads[`${family}-${bound}-cardinality`] = {
      property: family === "object" ? ref.P : ref.DP,
      cardinality: "Decimal",
      filler: family === "object" ? ref.C : ref.D,
    };
  }
}

export const constructPayloads = {
  subclass: { sub: ref.C, super: ref.C },
  "equivalent-classes": { members: set(ref.C, 1) },
  "disjoint-classes": { members: set(ref.C, 1) },
  "disjoint-union": {
    defined: reference("R", "class"),
    members: set(ref.C, 1),
  },
  "inverse-properties": { members: set(ref.P, 1, 2) },
  "property-chain": {
    members: { ...set(ref.P, 2), sequence: true },
    super: ref.P,
  },
  "object-characteristic": {
    property: ref.P,
    characteristic: token(
      "functional",
      "inverse-functional",
      "symmetric",
      "asymmetric",
      "transitive",
      "reflexive",
      "irreflexive",
    ),
  },
  "sub-annotation-property": { sub: ref.AP, super: ref.AP },
  "annotation-domain": { property: ref.AP, target: "IRI" },
  "annotation-range": { property: ref.AP, target: "IRI" },
  "datatype-definition": {
    datatype: reference("R", "datatype"),
    target: ref.D,
  },
  key: {
    class: ref.C,
    objectProperties: set(ref.P),
    dataProperties: set(ref.DP),
  },
  "class-membership": { class: ref.C, individual: ref.I },
  "annotation-assertion": {
    subject: ref.S,
    predicate: "IRI",
    value: "AnnotationValue",
  },
};
for (const [family, property, range] of [
  ["object", ref.P, ref.C],
  ["data", ref.DP, ref.D],
  ["rdf", ref.RP, reference("CD")],
]) {
  constructPayloads[`sub-${family}-property`] = {
    sub: property,
    super: property,
  };
  constructPayloads[`equivalent-${family}-properties`] = {
    members: set(property, 1),
  };
  constructPayloads[`disjoint-${family}-properties`] = {
    members: set(property, 1),
  };
  constructPayloads[`${family}-domain`] = { property, target: ref.C };
  constructPayloads[`${family}-range`] = { property, target: range };
  if (family !== "object") {
    constructPayloads[`${family}-characteristic`] = {
      property,
      characteristic: token("functional"),
    };
  }
}

const typed = object({
  kind: token("typed"),
  lexical: "Text",
  datatype: "IRI",
});
const language = object({
  kind: token("language"),
  lexical: "Text",
  language: "LanguageTag",
});
const literalBranches = { typed, language };
const occurrencePayloads = {
  "class-node": { targets: set(ref.C, 1), context: "Context" },
  "datatype-node": {
    target: reference("R", "datatype"),
    context: "PropertyContext",
  },
  "property-edge": {
    properties: set(
      reference("R", "object-property", "data-property", "rdf-property"),
      1,
    ),
    from: ref.O,
    to: ref.O,
  },
  "inverse-edge": {
    construct: reference("K", "inverse-properties"),
    forward: set(reference("R", "object-property"), 1),
    reverse: set(reference("R", "object-property"), 1),
    from: ref.O,
    to: ref.O,
  },
  "subclass-edge": {
    construct: reference("K", "subclass"),
    from: ref.O,
    to: ref.O,
  },
  "restriction-edge": {
    construct: reference("K", "subclass"),
    from: ref.O,
    to: ref.O,
  },
  "disjoint-edge": {
    construct: reference("K", "disjoint-classes"),
    ends: set(ref.O, 1, 2),
  },
  "operator-edge": {
    expression: reference(
      "X",
      "class-union",
      "class-intersection",
      "class-complement",
    ),
    from: ref.O,
    to: ref.O,
  },
  label: { edge: ref.O, direction: token("single", "forward", "reverse") },
};
const records = (category, payloads) =>
  Object.fromEntries(
    Object.entries(payloads).map(([kind, payload]) => [
      kind,
      primary(category, { kind: token(kind), ...payload }),
    ]),
  );

export const definitions = {
  Subject: { ...primary("S", { iri: "IRI" }), optional: ["iri"] },
  Role: primary("R", { kind: token(...roleKinds), subject: ref.S }),
  Expression: choice("kind", records("X", expressionPayloads)),
  Construct: choice(
    "kind",
    records("K", {
      ...constructPayloads,
      "assertion-anchor": {
        assertion: "Assertion",
        annotations: set("Annotation", 1),
      },
    }),
  ),
  Assertion: choice(
    "kind",
    Object.fromEntries(
      Object.entries({
        ...constructPayloads,
        declaration: { role: ref.R },
      }).map(([kind, payload]) => [
        kind,
        object({ kind: token(kind), ...payload }),
      ]),
    ),
  ),
  Literal: choice("kind", literalBranches),
  AnnotationValue: choice("kind", {
    ...literalBranches,
    iri: object({ kind: token("iri"), iri: "IRI" }),
    subject: object({ kind: token("subject"), subject: ref.S }),
  }),
  Annotation: object({
    predicate: "IRI",
    value: "AnnotationValue",
    annotations: set("Annotation"),
  }),
  Facet: object({ facet: "IRI", value: "Literal" }),
  Ontology: object(
    {
      iri: "IRI",
      versionIri: "IRI",
      imports: set("IRI"),
      annotations: set("Annotation"),
    },
    ["iri", "versionIri"],
  ),
  Occurrence: choice("kind", records("O", occurrencePayloads)),
  ClassContext: object({ kind: token("class"), targets: set(ref.C, 1) }),
  PropertyContext: object(
    { kind: token("property"), properties: set(ref.R, 1), scope: ref.K },
    ["scope"],
  ),
  Context: choice("kind", {
    class: "ClassContext",
    property: "PropertyContext",
  }),
  Structural: object({
    ontology: "Ontology",
    subjects: set("Subject"),
    roles: set("Role"),
    expressions: set("Expression"),
    constructs: set("Construct"),
    occurrences: set("Occurrence"),
  }),
  Point: object({ x: "Number", y: "Number" }),
  Placement: object({
    occurrence: ref.O,
    position: "Point",
    pinned: "Boolean",
  }),
  Camera: object({ center: "Point", zoom: "PositiveNumber" }),
  LabelSelection: choice("mode", {
    iri: object({ mode: token("iri") }),
    untagged: object({ mode: token("untagged") }),
    language: object({ mode: token("language"), range: "LanguageRange" }),
  }),
  PrefixBinding: object({ prefix: "Prefix", iri: "IRI" }),
  Display: object({
    compactNotation: "Boolean",
    nodeScaling: token("uniform", "direct-membership"),
    externalColoring: "Boolean",
  }),
  Visualization: object({
    placements: set("Placement"),
    camera: "Camera",
    hidden: set(ref.O),
    labelSelection: "LabelSelection",
    prefixes: set("PrefixBinding"),
    display: "Display",
  }),
};
definitions.Occurrence.branches["class-node"].optional = ["context"];

function profileEnvelope(profile, document) {
  return object({
    ...(document ? { profile: { iriConstant: profile } } : {}),
    structural: "Structural",
    ...(profile === profiles.artifact
      ? { visualization: "Visualization" }
      : {}),
  });
}

// Ajv retains compiled schemas strongly. Reuse this finite inventory's four roots.
const profileEnvelopes = new Map(
  Object.values(profiles).map((profile) => [
    profile,
    {
      source: profileEnvelope(profile, false),
      document: profileEnvelope(profile, true),
    },
  ]),
);

/** Select the closed profile envelope, keeping source input distinct from an admitted document. */
export function envelope(profile, document = false) {
  return profileEnvelopes.get(profile)[document ? "document" : "source"];
}

/** Resolve only declared named shapes; ordinary strings can never turn into references. */
export function resolveDescriptor(descriptor) {
  return typeof descriptor === "string" &&
    Object.hasOwn(definitions, descriptor)
    ? definitions[descriptor]
    : descriptor;
}

/** Translate the typed inventory to JSON Schema, leaving graph invariants to semantic validation. */
export function schemaFor(
  descriptor,
  { source = false, shallow = false } = {},
) {
  if (
    typeof descriptor === "string" &&
    Object.hasOwn(definitions, descriptor)
  ) {
    return shallow ? { type: "object" } : { $ref: `#/$defs/${descriptor}` };
  }
  if (typeof descriptor === "string") {
    const scalar = {
      type:
        descriptor === "Boolean"
          ? "boolean"
          : ["Number", "PositiveNumber"].includes(descriptor)
            ? "number"
            : "string",
    };
    if (descriptor === "PositiveNumber") {
      scalar.exclusiveMinimum = 0;
    }
    if (descriptor === "IRI") {
      scalar.format = "iri";
    }
    if (descriptor === "Decimal") {
      scalar.pattern = "^(0|[1-9][0-9]*)$";
    }
    if (descriptor === "LanguageTag") {
      scalar.format = "bcp47";
    }
    if (descriptor === "LanguageRange") {
      scalar.pattern = "^(\\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$";
    }
    if (descriptor === "Prefix") {
      scalar.pattern = "^(?:[A-Za-z][A-Za-z0-9_-]*)?$";
    }
    return scalar;
  }
  if (descriptor.reference || descriptor.id) {
    const result = { type: "string", ...(source ? {} : { minLength: 1 }) };
    if (descriptor.id && !source) {
      result.pattern = `^${descriptor.idPrefix ?? { S: "s", R: "r", X: "x", K: "c", O: "o" }[descriptor.id]}(0|[1-9][0-9]*)$`;
    }
    return result;
  }
  if (descriptor.token) {
    return { type: "string", enum: descriptor.token };
  }
  if (descriptor.iriConstant) {
    return { type: "string", const: descriptor.iriConstant };
  }
  if (descriptor.items) {
    return {
      type: "array",
      minItems: descriptor.minimum,
      ...(descriptor.maximum === undefined
        ? {}
        : { maxItems: descriptor.maximum }),
      ...(shallow ? {} : { items: schemaFor(descriptor.items, { source }) }),
    };
  }
  if (descriptor.discriminator) {
    return {
      oneOf: Object.values(descriptor.branches).map((branch) =>
        schemaFor(branch, { source, shallow }),
      ),
    };
  }
  return {
    type: "object",
    required: Object.keys(descriptor.fields)
      .filter((key) => !descriptor.optional.includes(key))
      .sort(),
    properties: Object.fromEntries(
      Object.entries(descriptor.fields)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, field]) => [
          key,
          shallow ? {} : schemaFor(field, { source }),
        ]),
    ),
    additionalProperties: false,
  };
}

/** Generate a self-contained, offline 2020-12 contract for one proposed profile. */
export function profileSchema(profile, source = false) {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${profile}${source ? "/source-schema" : "/schema"}`,
    ...schemaFor(envelope(profile, !source), { source }),
    $defs: Object.fromEntries(
      Object.entries(definitions).map(([name, shape]) => [
        name,
        schemaFor(shape, { source }),
      ]),
    ),
  };
}
