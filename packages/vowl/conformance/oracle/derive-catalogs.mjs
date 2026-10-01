// SPDX-License-Identifier: AGPL-3.0-only
// Literal transcriptions of B2.5 and independently reasoned B4/B5 expectations.
import assert from "node:assert/strict";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const directory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const writeNew = process.argv.includes("--write-new");
const rows = [];
function row(
  category,
  kinds,
  presentation,
  occurrences,
  condition,
  generationRule,
  rationale,
) {
  for (const kind of kinds.split(" "))
    rows.push({
      category,
      kind,
      retained: true,
      presentation,
      occurrenceKinds: occurrences,
      condition,
      generationRule,
      authority: "Canonical VOWL projection contract B2.5",
      rationale,
      coverageStatus:
        "Inventory only; exhaustive positive and conditional-negative coverage is pending",
    });
}
row(
  "role",
  "class rdf-class",
  "visual",
  ["class-node"],
  "Ordinary and anonymous roles always; generic roles only when a projected relation needs them",
  "B2.1/B2.3",
  "Named equivalence components group; generic splitting and anonymous identity are preserved",
);
row(
  "role",
  "datatype",
  "visual",
  ["datatype-node"],
  "Named datatype is an effective drawable relation endpoint",
  "B2.2/B2.3",
  "Unattached datatypes remain details-only; split by exact property context",
);
row(
  "role",
  "object-property data-property rdf-property",
  "visual",
  ["property-edge", "inverse-edge", "label"],
  "A named-role partition has drawable exact effective endpoints",
  "B2.2/B2.4",
  "No endpoint propagation; equivalence partitions preserve unequal endpoint terms",
);
row(
  "role",
  "annotation-property individual",
  "details-only",
  ["none"],
  "Always",
  "B2.5",
  "No ABox or property-metadata glyph is defined in v1",
);
row(
  "expression",
  "class-union class-intersection class-complement",
  "visual",
  ["class-node", "operator-edge"],
  "Operator gets its own node; connect only drawable operands",
  "B2.1/B2.4",
  "Keep every semantic operand and expose omitted-operand details",
);
row(
  "expression",
  "class-enumeration object-some object-all object-value object-self data-some data-all data-value object-inverse",
  "details-only",
  ["none"],
  "Always",
  "B2.5",
  "No standalone glyph or inferred quantified-restriction edge",
);
row(
  "expression",
  "object-min-cardinality object-max-cardinality object-exact-cardinality data-min-cardinality data-max-cardinality data-exact-cardinality",
  "visual",
  ["restriction-edge", "label"],
  "Super of a subclass from a named class role; exact named property and exact generic filler",
  "B2.4",
  "Qualified, inverse-property, anonymous-subclass and other contexts remain details-only; each retained bound is separate",
);
row(
  "expression",
  "data-intersection data-union data-complement data-enumeration datatype-restriction",
  "details-only",
  ["none"],
  "Always",
  "B2.5",
  "No class-operator glyph is reused for data-range meaning",
);
row(
  "construct",
  "subclass",
  "visual",
  ["subclass-edge", "restriction-edge", "label"],
  "Both terms drawable, or the exact unqualified cardinality restriction conditions hold",
  "B2.4",
  "All other subclass assertions remain details-only",
);
row(
  "construct",
  "equivalent-classes",
  "visual",
  ["class-node"],
  "Named ordinary class members join components",
  "B2.1",
  "Generic roles, anonymous roles and expressions stay out of grouping; no extra equivalence edge",
);
row(
  "construct",
  "disjoint-classes",
  "visual",
  ["disjoint-edge"],
  "Drawable member pairs, including normalized singleton and collapsed self-loops",
  "B2.4",
  "Only endpoint pairs deduplicate; undrawable members remain in details",
);
row(
  "construct",
  "equivalent-object-properties equivalent-data-properties equivalent-rdf-properties",
  "visual",
  ["property-edge", "inverse-edge", "label"],
  "Named members with the same exact direct effective endpoint pair share a partition",
  "B2.2",
  "Inverse expression members remain details-only; no extra equivalence edge",
);
row(
  "construct",
  "inverse-properties",
  "visual",
  ["inverse-edge", "label"],
  "Named drawable partitions with exactly reversed endpoint terms; a singleton is a self-pair",
  "B2.4",
  "Unmatched inverses stay in details and preserve independently drawable property edges",
);
row(
  "construct",
  "object-domain object-range data-domain data-range rdf-domain rdf-range",
  "visual",
  ["property-edge", "inverse-edge"],
  "Contributes a direct normalized named-property endpoint which is drawable",
  "B2.2/B2.4",
  "Compound undrawable ranges remain details-only; no semantic copies on occurrences",
);
row(
  "construct",
  "sub-object-property sub-data-property sub-rdf-property",
  "visual",
  ["none"],
  "Both explicitly related named roles have ordinary or inverse occurrences",
  "B2.4",
  "Interaction highlighting only; inverse-expression or absent projections remain details-only",
);
row(
  "construct",
  "object-characteristic",
  "visual",
  ["none"],
  "Direct functional, inverse-functional, symmetric or transitive characteristic of the selected named principal",
  "B2.4/B2.5",
  "Reflexive, irreflexive and asymmetric are details-only; no transfer from inverse expressions or nonprincipal aliases",
);
row(
  "construct",
  "data-characteristic rdf-characteristic",
  "visual",
  ["none"],
  "Direct functional characteristic of the selected named principal",
  "B2.4/B2.5",
  "No extra occurrence or transfer from aliases",
);
row(
  "construct",
  "disjoint-union disjoint-object-properties disjoint-data-properties disjoint-rdf-properties property-chain datatype-definition key",
  "details-only",
  ["none"],
  "Always",
  "B2.5",
  "Retained structures have no additional v1 glyph",
);
row(
  "construct",
  "sub-annotation-property annotation-domain annotation-range annotation-assertion assertion-anchor class-membership",
  "details-only",
  ["none"],
  "Always",
  "B2.5",
  "Annotations and direct member listings are inspectable; derived labels are not semantic copies",
);
row(
  "metadata",
  "ontology imports annotations",
  "details-only",
  ["none"],
  "Always",
  "B2.5/B4",
  "Header/details or label derivation; no independently positioned graph occurrence",
);
row(
  "annotation-value",
  "iri subject typed language",
  "details-only",
  ["none"],
  "Always",
  "A2/B2.5/B4",
  "Preserve boxed exact values; only qualifying label assertions provide candidate text",
);
const identities = rows.map(({ category, kind }) => category + ":" + kind);
assert.equal(
  new Set(identities).size,
  identities.length,
  "One matrix row per category/token",
);
assert.equal(rows.filter((entry) => entry.category === "role").length, 8);
assert.equal(
  rows.filter((entry) => entry.category === "expression").length,
  23,
);
assert.equal(rows.filter((entry) => entry.category === "construct").length, 32);

const xsd = "http://www.w3.org/2001/XMLSchema#";
const typed = (lexical) => ({
  kind: "typed",
  lexical,
  datatype: xsd + "string",
});
const language = (lexical, tag) => ({
  kind: "language",
  lexical,
  language: tag,
});
const display = [];
function label(id, selection, candidates, expected, extra = {}) {
  display.push({
    id,
    operation: "select-label",
    rule: "B4",
    input: {
      iri: "https://example.org/o#A",
      unnamedKind: "anonymous class",
      selection,
      candidates,
      prefixes: [],
      ...extra,
    },
    expected,
  });
}
label(
  "full-iri-bypasses-label-and-prefix",
  { mode: "iri" },
  [typed("Label")],
  "https://example.org/o#A",
  { prefixes: [{ prefix: "ex", iri: "https://example.org/o#" }] },
);
label("unnamed-never-uses-handle", { mode: "iri" }, [], "anonymous class", {
  iri: null,
});
label(
  "untagged-utf8-not-locale",
  { mode: "untagged" },
  [typed("ä"), typed("z")],
  "z",
);
label(
  "language-exact-before-parent",
  { mode: "language", range: "zh-hant-tw" },
  [
    language("Traditional", "zh-hant"),
    language("Taiwan", "zh-hant-tw"),
    language("Chinese", "zh"),
  ],
  "Taiwan",
);
label(
  "language-parent-lookup",
  { mode: "language", range: "zh-hant-tw" },
  [language("Traditional", "zh-hant"), language("Chinese", "zh")],
  "Traditional",
);
label(
  "no-arbitrary-regional-expansion",
  { mode: "language", range: "en" },
  [
    language("British", "en-gb"),
    language("American", "en-us"),
    typed("Default"),
  ],
  "Default",
);
label(
  "no-english-fallback",
  { mode: "language", range: "fr" },
  [language("English", "en")],
  "A",
);
label(
  "wildcard-goes-to-default",
  { mode: "language", range: "*" },
  [language("English", "en"), typed("Default")],
  "Default",
);
label(
  "lookup-removes-trailing-singleton",
  { mode: "language", range: "en-us-x-test" },
  [language("United States", "en-us")],
  "United States",
);
label(
  "language-tie-complete-literal-order",
  { mode: "language", range: "en" },
  [language("z", "en"), language("ä", "en")],
  "z",
);
label("prefix-tie-empty-name", { mode: "untagged" }, [], ":A", {
  prefixes: [
    { prefix: "ex", iri: "https://example.org/o#" },
    { prefix: "", iri: "https://example.org/o#" },
  ],
});
label("prefix-longest-match", { mode: "untagged" }, [], "long:A", {
  prefixes: [
    { prefix: "short", iri: "https://example.org/" },
    { prefix: "long", iri: "https://example.org/o#" },
  ],
});
label("prefix-fixed-nbsp-whitespace", { mode: "untagged" }, [], "A\u00a0B", {
  iri: "urn:ex:A\u00a0B",
  prefixes: [{ prefix: "e", iri: "urn:ex:" }],
});
label(
  "prefix-bom-is-not-fixed-whitespace",
  { mode: "untagged" },
  [],
  "e:A\ufeffB",
  { iri: "urn:ex:A\ufeffB", prefixes: [{ prefix: "e", iri: "urn:ex:" }] },
);
label("fallback-does-not-percent-decode", { mode: "untagged" }, [], "A%20B", {
  iri: "https://example.org/o#A%20B",
});
label(
  "empty-final-suffix-full-iri",
  { mode: "untagged" },
  [],
  "https://example.org/o#",
  { iri: "https://example.org/o#" },
);
label("fixed-builtin-before-prefix", { mode: "untagged" }, [], "Thing", {
  iri: "http://www.w3.org/2002/07/owl#Thing",
  prefixes: [{ prefix: "owl", iri: "http://www.w3.org/2002/07/owl#" }],
});
for (const [id, root, subject, expected] of [
  ["anonymous-root-local", null, "https://outside.example/A", false],
  ["unnamed-subject-local", "https://example.org/o", null, false],
  [
    "root-itself-local",
    "https://example.org/o",
    "https://example.org/o",
    false,
  ],
  ["fragment-local", "https://example.org/o", "https://example.org/o#A", false],
  ["path-local", "https://example.org/o", "https://example.org/o/A", false],
  [
    "subpath-external",
    "https://example.org/o",
    "https://example.org/o/sub/A",
    true,
  ],
  [
    "one-trailing-slash",
    "https://example.org/o/",
    "https://example.org/o/#A",
    false,
  ],
  [
    "query-same",
    "https://example.org/o?rev=1",
    "https://example.org/o/A?rev=1",
    false,
  ],
  [
    "query-different",
    "https://example.org/o?rev=1",
    "https://example.org/o/A?rev=2",
    true,
  ],
  [
    "authority-case-preserved",
    "https://EXAMPLE.org/o",
    "https://example.org/o#A",
    true,
  ],
  [
    "empty-final-segment",
    "https://example.org/o",
    "https://example.org/o/A/",
    true,
  ],
  ["urn-local", "urn:example:ontology", "urn:example:ontology:Class", false],
  [
    "exact-builtin-exemption",
    "https://example.org/o",
    "http://www.w3.org/2002/07/owl#Thing",
    false,
  ],
  [
    "no-namespace-wide-exemption",
    "https://example.org/o",
    "http://www.w3.org/2002/07/owl#ImaginedBuiltin",
    true,
  ],
])
  display.push({
    id,
    operation: "classify-external",
    rule: "B5",
    input: { rootOntologyIri: root, subjectIri: subject },
    expected,
  });
for (const [count, expected] of [
  [0, 1],
  [15, 2],
  [255, 3],
  [4095, 4],
  [8191, 4],
]) {
  display.push({
    id: `membership-factor-${count}`,
    operation: "radius-factor",
    rule: "B5",
    input: {
      generic: false,
      nodeScaling: "direct-membership",
      directDistinctIndividualCount: count,
    },
    expected,
  });
}
display.push(
  {
    id: "generic-fixed-radius",
    operation: "radius-factor",
    rule: "B5",
    input: {
      generic: true,
      nodeScaling: "direct-membership",
      directDistinctIndividualCount: 8191,
    },
    expected: 0.6,
  },
  {
    id: "uniform-radius",
    operation: "radius-factor",
    rule: "B5",
    input: {
      generic: false,
      nodeScaling: "uniform",
      directDistinctIndividualCount: 8191,
    },
    expected: 1,
  },
  {
    id: "equivalence-direct-membership-union",
    operation: "membership-factor",
    rule: "B5",
    input: {
      targets: ["A", "B"],
      memberships: [
        ["A", "i1"],
        ["B", "i1"],
        ["A", "i2"],
        ["B", "i3"],
      ],
      hiddenIndividuals: ["i2"],
    },
    expected: { count: 3, factor: 1.5 },
  },
  {
    id: "principal-local-before-iri",
    operation: "principal-and-aliases",
    rule: "B4/B5",
    input: {
      rootOntologyIri: "https://example.org/o",
      externalColoring: false,
      members: [
        { iri: "https://aaa.example/A", kind: "class" },
        { iri: "https://example.org/o#Z", kind: "class" },
        { iri: "https://example.org/o#B", kind: "class" },
      ],
    },
    expected: {
      principalIri: "https://example.org/o#B",
      aliasIris: ["https://aaa.example/A", "https://example.org/o#Z"],
    },
  },
  {
    id: "camera-canvas-to-viewport",
    operation: "camera-project",
    rule: "B3",
    input: {
      viewport: { width: 800, height: 600 },
      center: { x: 10, y: 20 },
      zoom: 2,
      point: { x: 15, y: 10 },
    },
    expected: { x: 410, y: 280 },
  },
  {
    id: "legacy-camera-conversion",
    operation: "camera-center",
    rule: "B3",
    input: {
      viewport: { width: 800, height: 600 },
      translation: { x: 100, y: 50 },
      zoom: 2,
    },
    expected: { x: 150, y: 125 },
  },
  {
    id: "exact-huge-cardinality",
    operation: "cardinality-text",
    rule: "B2.4",
    input: {
      kind: "object-exact-cardinality",
      cardinality: "90071992547409931234567890",
    },
    expected: "90071992547409931234567890",
  },
  {
    id: "minimum-cardinality",
    operation: "cardinality-text",
    rule: "B2.4",
    input: { kind: "object-min-cardinality", cardinality: "3" },
    expected: "3..*",
  },
  {
    id: "maximum-cardinality",
    operation: "cardinality-text",
    rule: "B2.4",
    input: { kind: "data-max-cardinality", cardinality: "3" },
    expected: "0..3",
  },
  {
    id: "compact-notation-preserves-meaning",
    operation: "compact-notation",
    rule: "B5",
    input: {
      compactNotation: true,
      selectedName: "has child",
      aliases: ["offspring"],
      cardinality: "2",
      subclassPhrase: "Subclass of",
      characteristicOnlyIndication: "functional",
    },
    expected: {
      selectedName: "has child",
      aliases: ["offspring"],
      cardinality: "2",
      subclassPhrase: "",
      characteristicOnlyIndication: "functional",
      occurrenceTopologyChanged: false,
      placementsStillRequired: true,
    },
  },
);
for (const [name, artifact] of [
  [
    "projection-matrix.json",
    {
      status: "experimental-inventory-pending-protocol-review",
      specification:
        "docs/specs/2026-09-24-canonical-vowl-projection-contract.md",
      rows,
    },
  ],
  [
    "display-vectors.json",
    {
      status: "independently-derived-pending-review-and-application-execution",
      scope:
        "Language-neutral conceptual operation inputs; no additional core exports or wire fields",
      candidateLabelPremise:
        "Candidates come only from qualifying retained annotation assertions; filtering axiom annotations is separately required",
      vectors: display,
    },
  ],
]) {
  const path = resolve(directory, name);
  const data = JSON.stringify(artifact, null, 2) + "\n";
  if (writeNew) {
    try {
      await writeFile(path, data, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.equal(
    await readFile(path, "utf8"),
    data,
    `${name}: no automatic expectation overwrite`,
  );
}
console.log(
  JSON.stringify({
    matrixRows: rows.length,
    displayVectors: display.length,
    result: "literal inventories match",
  }),
);
