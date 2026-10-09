import { readFile, writeFile } from "node:fs/promises";
import { canonicalize, edit, encode, profiles } from "vowl";
import { createCanonicalVowlScene } from "../src/app/js/controller/canonicalVowlScene.js";

if (process.argv.length > 3) {
  throw new Error(
    "Usage: node util/generateCanonicalBenchmark.mjs [output-file]",
  );
}

// This authors one known visual demo; it is not a general legacy importer.
// The historical fixture stays intact, including its deliberately invalid data.
const legacy = JSON.parse(
  await readFile(new URL("../src/app/data/benchmark.json", import.meta.url)),
);
const root = "https://haddenindustries.com/webvowl/benchmark";
const external = "https://example.org/webvowl-benchmark#";
const OWL = "http://www.w3.org/2002/07/owl#";
const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const changes = [];
let ordinal = 0;
function insert(collection, fields) {
  const id = `benchmark:${ordinal++}`;
  changes.push({ kind: "insert", collection, record: { id, ...fields } });
  return id;
}
function entity(kind, iri) {
  const subject = insert("subjects", iri === undefined ? {} : { iri });
  return { subject, role: insert("roles", { kind, subject }) };
}
function literal(lexical, language) {
  return language
    ? { kind: "language", lexical, language }
    : { kind: "typed", lexical, datatype: XSD + "string" };
}
function localized(value) {
  if (typeof value === "string") {
    return [literal(value)];
  }
  return Object.entries(value ?? {})
    .filter(([language]) => language !== "iriBased")
    .map(([language, text]) =>
      literal(
        text,
        ["unset", "undefined"].includes(language) ? undefined : language,
      ),
    );
}
function annotations(record) {
  return [
    ...localized(record.label ?? record.title).map((value) => ({
      predicate: RDFS + "label",
      value,
      annotations: [],
    })),
    ...localized(record.comment ?? record.description).map((value) => ({
      predicate: RDFS + "comment",
      value,
      annotations: [],
    })),
  ];
}
function annotate(subject, record) {
  for (const { predicate, value } of annotations(record)) {
    insert("constructs", {
      kind: "annotation-assertion",
      subject,
      predicate,
      value,
    });
  }
  if (
    record.attributes?.includes("deprecated") ||
    record.type === "owl:DeprecatedClass"
  ) {
    insert("constructs", {
      kind: "annotation-assertion",
      subject,
      predicate: OWL + "deprecated",
      value: { kind: "typed", lexical: "true", datatype: XSD + "boolean" },
    });
  }
}
function joined(collection) {
  const attributes = new Map(
    (legacy[`${collection}Attribute`] ?? []).map((record) => [
      record.id,
      record,
    ]),
  );
  return legacy[collection].map((record) => ({
    ...record,
    ...attributes.get(record.id),
  }));
}
const classes = joined("class");
const datatypes = joined("datatype");
const properties = joined("property");
const nodes = new Map();
const operators = new Map([
  ["owl:intersectionOf", "class-intersection"],
  ["owl:unionOf", "class-union"],
  ["owl:complementOf", "class-complement"],
]);
const builtins = new Map([
  ["owl:Thing", OWL + "Thing"],
  ["owl:Nothing", OWL + "Nothing"],
  ["rdfs:Resource", RDFS + "Resource"],
  ["rdfs:Literal", RDFS + "Literal"],
]);
for (const record of [...classes, ...datatypes]) {
  if (operators.has(record.type)) {
    continue;
  }
  // The old datatype-property example points to a class-shaped placeholder.
  const kind =
    datatypes.includes(record) || record.id === "DatatypePropertyTest"
      ? "datatype"
      : record.type === "rdfs:Class" || record.type === "rdfs:Resource"
        ? "rdf-class"
        : "class";
  const iri =
    record.id === "AnonymousClass"
      ? undefined
      : (builtins.get(record.type) ??
        record.iri ??
        (record.type === "ExternalClass" ? external : root + "#") + record.id);
  const target = entity(kind, iri);
  nodes.set(record.id, target.role);
  annotate(target.subject, { ...record, label: record.label ?? record.id });
}
for (const record of classes.filter(({ type }) => operators.has(type))) {
  const kind = operators.get(record.type);
  const operand = nodes.get("SetOperatorTest");
  const expression = insert("expressions", {
    kind,
    ...(kind === "class-complement" ? { operand } : { members: [operand] }),
  });
  nodes.set(record.id, expression);
  insert("constructs", { kind: "subclass", sub: operand, super: expression });
}
for (const record of classes) {
  const target = nodes.get(record.id);
  if (record.equivalent) {
    insert("constructs", {
      kind: "equivalent-classes",
      members: [target, ...record.equivalent.map((id) => nodes.get(id))],
    });
  }
  if (record.disjointUnion) {
    insert("constructs", {
      kind: "disjoint-union",
      defined: target,
      members: record.disjointUnion.map((id) => nodes.get(id)),
    });
  }
  // Named, distinct demo individuals replace the unidentifiable {a: b} objects.
  for (let index = 0; index < (record.individuals?.length ?? 0); index++) {
    const individual = entity(
      "individual",
      `${root}#${record.id}-individual-${index + 1}`,
    );
    insert("constructs", {
      kind: "class-membership",
      class: target,
      individual: individual.role,
    });
  }
}
const entities = new Map();
const propertyKinds = new Map();
for (const record of properties) {
  if (["owl:disjointWith", "rdfs:SubClassOf"].includes(record.type)) {
    insert(
      "constructs",
      record.type === "owl:disjointWith"
        ? {
            kind: "disjoint-classes",
            members: [nodes.get(record.domain), nodes.get(record.range)],
          }
        : {
            kind: "subclass",
            sub: nodes.get(record.domain),
            super: nodes.get(record.range),
          },
    );
    continue;
  }
  const datatypeTarget = [
    ...datatypes.map(({ id }) => id),
    "DatatypePropertyTest",
  ].includes(record.range);
  const kind =
    record.type === "rdf:Property"
      ? "rdf-property"
      : record.type === "owl:DatatypeProperty" || datatypeTarget
        ? "data-property"
        : "object-property";
  // Expand this fixture's compact property IRI; all invented demo IDs are explicit.
  const iri =
    record.iri === "rdf:Group"
      ? RDF + "Group"
      : (record.iri ??
        (record.attributes?.includes("external") ? external : root + "#") +
          record.id);
  const target = entity(kind, iri);
  entities.set(record.id, target.role);
  propertyKinds.set(record.id, kind.split("-")[0]);
  annotate(target.subject, { ...record, label: record.label ?? record.id });
}
const inversePairs = new Set();
const characteristics = new Map([
  ["owl:FunctionalProperty", "functional"],
  ["owl:InverseFunctionalProperty", "inverse-functional"],
  ["owl:TransitiveProperty", "transitive"],
  ["owl:SymmetricProperty", "symmetric"],
]);
for (const record of properties) {
  const property = entities.get(record.id);
  if (property === undefined) {
    continue;
  }
  const family = propertyKinds.get(record.id);
  // Inverse-only placeholders inherit reversed ends from the authored partner.
  const partner = properties.find(
    (candidate) => candidate.inverse === record.id,
  );
  const domain = record.domain ?? partner?.range;
  const range = record.range ?? partner?.domain;
  for (const [end, target] of [
    ["domain", domain],
    ["range", range],
  ]) {
    if (target !== undefined) {
      insert("constructs", {
        kind: `${family}-${end}`,
        property,
        target: nodes.get(target),
      });
    }
  }
  if (record.inverse) {
    const key = [record.id, record.inverse].sort().join("/");
    if (!inversePairs.has(key)) {
      inversePairs.add(key);
      insert("constructs", {
        kind: "inverse-properties",
        members: [property, entities.get(record.inverse)],
      });
    }
  }
  if (record.equivalent) {
    insert("constructs", {
      kind: `equivalent-${family}-properties`,
      members: [property, ...record.equivalent.map((id) => entities.get(id))],
    });
  }
  for (const childProperty of record.subproperty ?? []) {
    insert("constructs", {
      kind: `sub-${family}-property`,
      sub: entities.get(childProperty),
      super: property,
    });
  }
  const characteristic = characteristics.get(record.type);
  if (characteristic) {
    insert("constructs", {
      kind: `${family}-characteristic`,
      property,
      characteristic,
    });
  }
  if (record.attributes?.includes("key")) {
    insert("constructs", {
      kind: "key",
      class: nodes.get(domain),
      objectProperties: [property],
      dataProperties: [],
    });
  }
  if (["owl:someValuesFrom", "owl:allValuesFrom"].includes(record.type)) {
    const restriction = insert("expressions", {
      kind: `${family}-${record.type === "owl:someValuesFrom" ? "some" : "all"}`,
      property,
      filler: nodes.get(range),
    });
    insert("constructs", {
      kind: "subclass",
      sub: nodes.get(domain),
      super: restriction,
    });
  }
  // B2 draws unqualified cardinality restrictions. Keep the original ordinary
  // links too, and demonstrate every original bound on scoped Thing edges.
  for (const [field, bound] of [
    ["cardinality", "exact"],
    ["minCardinality", "min"],
    ["maxCardinality", "max"],
  ]) {
    if (record[field] !== undefined) {
      const restriction = insert("expressions", {
        kind: `${family}-${bound}-cardinality`,
        property,
        cardinality: String(record[field]),
        filler: nodes.get("OwlThing"),
      });
      insert("constructs", {
        kind: "subclass",
        sub: nodes.get(domain),
        super: restriction,
      });
    }
  }
}
const before = await canonicalize(
  {
    structural: {
      ontology: { iri: root, imports: [], annotations: [] },
      subjects: [],
      roles: [],
      expressions: [],
      constructs: [],
      occurrences: [],
    },
  },
  { profile: profiles.structuralContent },
);
changes.push({
  kind: "set-ontology",
  ontology: {
    iri: root,
    imports: [],
    annotations: [
      ...annotations(legacy.header),
      ...legacy.header.author.map((author) => ({
        predicate: "http://purl.org/dc/elements/1.1/creator",
        value: literal(author),
        annotations: [],
      })),
    ],
  },
});
// Public editing owns signature normalization and occurrence generation; the
// authoring tool neither reproduces that logic nor fabricates canonical IDs.
const { document } = await edit(before, changes);
const visualization = createCanonicalVowlScene(
  document.structural.occurrences,
  {
    loadGeneration: 1,
  },
).snapshot();
visualization.labelSelection = { mode: "language", range: "en" };
visualization.display.nodeScaling = "direct-membership";
const artifact = await canonicalize(
  { structural: document.structural, visualization },
  { profile: profiles.artifact },
);
const output =
  process.argv[2] ??
  new URL("../src/canonical-examples/benchmark.json", import.meta.url);
await writeFile(output, encode(artifact));
console.log(
  `Authored canonical benchmark: ${document.structural.occurrences.length} drawing occurrences.`,
);
