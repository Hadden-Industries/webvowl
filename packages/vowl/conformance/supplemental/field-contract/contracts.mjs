// SPDX-License-Identifier: AGPL-3.0-only
// Field inventory independently transcribed from A1-A5, B1 and B3.
// This is a conformance descriptor, not a validator or a production schema.
const primitive = (type, extra = {}) => ({ type, ...extra });
const ref = (sort) => primitive("reference", { sort });
const record = (name) => primitive("record", { record: name });
const collection = (item, min = 0, max = null, sequence = false) => ({
  type: "collection",
  item,
  min,
  max,
  sequence,
});
const set = (item, min = 0, max = null) => collection(item, min, max);
const enumeration = (...values) => primitive("enum", { values });
const optional = (value) => ({ ...value, optional: true });
const id = primitive("handle");
const iri = primitive("iri");
const text = primitive("text");
const number = primitive("number");
const boolean = primitive("boolean");
const decimal = primitive("decimal");
const roles = [
  "class",
  "rdf-class",
  "datatype",
  "object-property",
  "data-property",
  "annotation-property",
  "rdf-property",
  "individual",
];
const objectCharacteristics = [
  "functional",
  "inverse-functional",
  "symmetric",
  "asymmetric",
  "transitive",
  "reflexive",
  "irreflexive",
];
export const definitions = {};
export const families = {};
function fixed(name, fields, citation, forbidden = [], family = name) {
  definitions[name] = {
    name,
    family,
    fields,
    citation,
    explicitForbidden: forbidden,
  };
}
function variants(family, variants_, citation, base = {}, forbidden = []) {
  families[family] = {
    tag: family === "LabelSelection" ? "mode" : "kind",
    variants: {},
  };
  for (const [kind, fields] of Object.entries(variants_)) {
    const name = `${family}:${kind}`;
    fixed(
      name,
      { ...base, [families[family].tag]: enumeration(kind), ...fields },
      citation,
      forbidden,
      family,
    );
    families[family].variants[kind] = name;
  }
}
fixed("SourceStructural", { structural: record("Structural") }, "A2", [
  "profile",
  "visualization",
]);
fixed(
  "SourceArtifact",
  { structural: record("Structural"), visualization: record("Visualization") },
  "A2",
  ["profile"],
);
fixed(
  "DocumentStructural",
  { profile: iri, structural: record("Structural") },
  "A2/D19",
  ["visualization"],
);
fixed(
  "DocumentArtifact",
  {
    profile: iri,
    structural: record("Structural"),
    visualization: record("Visualization"),
  },
  "A2/D19",
);
fixed(
  "Structural",
  {
    ontology: record("Ontology"),
    subjects: set(record("Subject")),
    roles: set(record("Role")),
    expressions: set(record("Expression")),
    constructs: set(record("Construct")),
    occurrences: set(record("Occurrence")),
  },
  "A2",
);
fixed(
  "Ontology",
  {
    iri: optional(iri),
    versionIri: optional(iri),
    imports: set(iri),
    annotations: set(record("Annotation")),
  },
  "A2",
);
fixed("Subject", { id, iri: optional(iri) }, "A2");
fixed("Role", { id, kind: enumeration(...roles), subject: ref("S") }, "A2");
fixed(
  "Annotation",
  {
    predicate: iri,
    value: record("AnnotationValue"),
    annotations: set(record("Annotation")),
  },
  "A2",
  ["id"],
);
const literalVariants = {
  typed: { lexical: text, datatype: iri },
  language: { lexical: text, language: primitive("language-tag") },
};
variants(
  "AnnotationValue",
  {
    iri: { iri },
    subject: { subject: ref("S-anonymous") },
    ...literalVariants,
  },
  "A2",
  {},
  ["id"],
);
variants("Literal", literalVariants, "A2", {}, ["id", "iri", "subject"]);
fixed("Facet", { facet: iri, value: record("Literal") }, "A3", ["id"]);

export const expressionVariants = {
  "class-intersection": { members: set(ref("C"), 1) },
  "class-union": { members: set(ref("C"), 1) },
  "class-complement": { operand: ref("C") },
  "class-enumeration": { members: set(ref("I"), 1) },
  "object-some": { property: ref("P"), filler: ref("C") },
  "object-all": { property: ref("P"), filler: ref("C") },
  "object-value": { property: ref("P"), value: ref("I") },
  "object-self": { property: ref("P") },
  "object-min-cardinality": {
    property: ref("P"),
    cardinality: decimal,
    filler: ref("C"),
  },
  "object-max-cardinality": {
    property: ref("P"),
    cardinality: decimal,
    filler: ref("C"),
  },
  "object-exact-cardinality": {
    property: ref("P"),
    cardinality: decimal,
    filler: ref("C"),
  },
  "data-some": { property: ref("DP"), filler: ref("D") },
  "data-all": { property: ref("DP"), filler: ref("D") },
  "data-value": { property: ref("DP"), value: record("Literal") },
  "data-min-cardinality": {
    property: ref("DP"),
    cardinality: decimal,
    filler: ref("D"),
  },
  "data-max-cardinality": {
    property: ref("DP"),
    cardinality: decimal,
    filler: ref("D"),
  },
  "data-exact-cardinality": {
    property: ref("DP"),
    cardinality: decimal,
    filler: ref("D"),
  },
  "object-inverse": { property: ref("R-object-property") },
  "data-intersection": { members: set(ref("D"), 1) },
  "data-union": { members: set(ref("D"), 1) },
  "data-complement": { operand: ref("D") },
  "data-enumeration": { members: set(record("Literal"), 1) },
  "datatype-restriction": {
    datatype: ref("R-datatype"),
    facets: set(record("Facet"), 1),
  },
};
variants("Expression", expressionVariants, "A3", { id }, ["sort"]);
export const baseConstructVariants = {
  subclass: { sub: ref("C"), super: ref("C") },
  "equivalent-classes": { members: set(ref("C"), 1) },
  "disjoint-classes": { members: set(ref("C"), 1) },
  "disjoint-union": { defined: ref("R-class-kind"), members: set(ref("C"), 1) },
  "sub-object-property": { sub: ref("P"), super: ref("P") },
  "equivalent-object-properties": { members: set(ref("P"), 1) },
  "disjoint-object-properties": { members: set(ref("P"), 1) },
  "inverse-properties": { members: set(ref("P"), 1, 2) },
  "property-chain": {
    members: collection(ref("P"), 2, null, true),
    super: ref("P"),
  },
  "object-domain": { property: ref("P"), target: ref("C") },
  "object-range": { property: ref("P"), target: ref("C") },
  "object-characteristic": {
    property: ref("P"),
    characteristic: enumeration(...objectCharacteristics),
  },
  "sub-data-property": { sub: ref("DP"), super: ref("DP") },
  "equivalent-data-properties": { members: set(ref("DP"), 1) },
  "disjoint-data-properties": { members: set(ref("DP"), 1) },
  "data-domain": { property: ref("DP"), target: ref("C") },
  "data-range": { property: ref("DP"), target: ref("D") },
  "data-characteristic": {
    property: ref("DP"),
    characteristic: enumeration("functional"),
  },
  "sub-rdf-property": { sub: ref("RP"), super: ref("RP") },
  "equivalent-rdf-properties": { members: set(ref("RP"), 1) },
  "disjoint-rdf-properties": { members: set(ref("RP"), 1) },
  "rdf-domain": { property: ref("RP"), target: ref("C") },
  "rdf-range": { property: ref("RP"), target: ref("C-or-D") },
  "rdf-characteristic": {
    property: ref("RP"),
    characteristic: enumeration("functional"),
  },
  "sub-annotation-property": { sub: ref("AP"), super: ref("AP") },
  "annotation-domain": { property: ref("AP"), target: iri },
  "annotation-range": { property: ref("AP"), target: iri },
  "datatype-definition": { datatype: ref("R-datatype"), target: ref("D") },
  key: {
    class: ref("C"),
    objectProperties: set(ref("P")),
    dataProperties: set(ref("DP")),
  },
  "class-membership": { class: ref("C"), individual: ref("I") },
  "annotation-assertion": {
    subject: ref("S"),
    predicate: iri,
    value: record("AnnotationValue"),
  },
};
variants(
  "Construct",
  {
    ...baseConstructVariants,
    "assertion-anchor": {
      assertion: record("Assertion"),
      annotations: set(record("Annotation"), 1),
    },
  },
  "A4",
  { id },
);
variants(
  "Assertion",
  { ...baseConstructVariants, declaration: { role: ref("R") } },
  "A4",
  {},
  ["id", "annotations"],
);
variants(
  "Context",
  {
    class: { targets: set(ref("C"), 1) },
    property: {
      properties: set(ref("R"), 1),
      scope: optional(ref("K")),
    },
  },
  "B1",
  {},
  ["id"],
);
fixed(
  "PropertyContext",
  {
    kind: enumeration("property"),
    properties: set(ref("R"), 1),
    scope: optional(ref("K")),
  },
  "B1",
  ["id", "targets"],
);
variants(
  "Occurrence",
  {
    "class-node": {
      targets: set(ref("C"), 1),
      context: optional(record("Context")),
    },
    "datatype-node": {
      target: ref("R-datatype"),
      context: record("PropertyContext"),
    },
    "property-edge": {
      properties: set(ref("R-property"), 1),
      from: ref("O"),
      to: ref("O"),
    },
    "inverse-edge": {
      construct: ref("K-inverse-properties"),
      forward: set(ref("R-object-property"), 1),
      reverse: set(ref("R-object-property"), 1),
      from: ref("O"),
      to: ref("O"),
    },
    "subclass-edge": {
      construct: ref("K-subclass"),
      from: ref("O"),
      to: ref("O"),
    },
    "disjoint-edge": {
      construct: ref("K-disjoint-classes"),
      ends: set(ref("O"), 1, 2),
    },
    "operator-edge": {
      expression: ref("X-operator"),
      from: ref("O"),
      to: ref("O"),
    },
    "restriction-edge": {
      construct: ref("K-subclass"),
      from: ref("O"),
      to: ref("O"),
    },
    label: {
      edge: ref("O"),
      direction: enumeration("single", "forward", "reverse"),
    },
  },
  "B1",
  { id },
  ["iri", "annotations", "characteristic", "value", "members"],
);
fixed(
  "Visualization",
  {
    placements: set(record("Placement")),
    camera: record("Camera"),
    hidden: set(ref("O")),
    labelSelection: record("LabelSelection"),
    prefixes: set(record("PrefixBinding")),
    display: record("Display"),
  },
  "B3",
);
fixed(
  "Placement",
  {
    occurrence: ref("O"),
    position: record("Point"),
    pinned: boolean,
  },
  "B3",
);
fixed("Point", { x: number, y: number }, "B3");
fixed(
  "Camera",
  { center: record("Point"), zoom: primitive("positive-number") },
  "B3",
);
variants(
  "LabelSelection",
  { iri: {}, untagged: {}, language: { range: primitive("language-range") } },
  "B3/B4",
);
fixed("PrefixBinding", { prefix: primitive("prefix"), iri }, "B3/B4");
fixed(
  "Display",
  {
    compactNotation: boolean,
    nodeScaling: enumeration("uniform", "direct-membership"),
    externalColoring: boolean,
  },
  "B3",
);

for (const descriptor of Object.values(definitions)) {
  const siblings = Object.values(definitions).filter(
    (item) => item.family === descriptor.family,
  );
  descriptor.forbiddenFields = [
    ...new Set([
      "unexpectedField",
      ...descriptor.explicitForbidden,
      ...siblings.flatMap((item) => Object.keys(item.fields)),
    ]),
  ]
    .filter((field) => !Object.hasOwn(descriptor.fields, field))
    .sort();
}
export function select(name, value) {
  if (definitions[name]) return definitions[name];
  const family = families[name];
  return family && definitions[family.variants[value?.[family.tag]]];
}
export function visit(value, name, callback, path = []) {
  const descriptor = select(name, value);
  if (
    !descriptor ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  )
    throw new Error(
      `No independent descriptor for ${name} at ${path.join("/")}`,
    );
  callback(descriptor, value, path);
  for (const [field, type] of Object.entries(descriptor.fields)) {
    if (!Object.hasOwn(value, field)) continue;
    if (type.type === "record")
      visit(value[field], type.record, callback, [...path, field]);
    if (type.type === "collection" && type.item.type === "record")
      value[field].forEach((item, index) =>
        visit(item, type.item.record, callback, [...path, field, index]),
      );
  }
}
