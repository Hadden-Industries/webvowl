// SPDX-License-Identifier: AGPL-3.0-only
// Independent isolated error/counter expectations from A1-A8 and B3; no product imports.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { seedSources } from "../../oracle/seed-sources.mjs";
import { extendedSources } from "../../oracle/extended-sources.mjs";
import { profiles } from "../../oracle/producer.mjs";
import { grammarSources } from "../grammar/sources.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "../..");
const writeNew = process.argv.includes("--write-new");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const recipes = [...seedSources, ...extendedSources, ...grammarSources];
const sourceOf = (id) =>
  structuredClone(recipes.find((item) => item.id === id).source);
const cases = [];
function sourceCase(id, base, mutate, code, rules, options = {}) {
  const source = sourceOf(base);
  mutate(source);
  cases.push({
    id,
    operation: "canonicalize",
    profile: source.visualization ? profiles.artifact : profiles.structural,
    options,
    expectedError: code,
    rules,
    extension: "source.json",
    bytes: Buffer.from(json(source)),
    sourceFixture: base,
  });
}
function bytesCase(id, bytes, code, options = {}, rules = ["A7"]) {
  cases.push({
    id,
    operation: "decode",
    options,
    expectedError: code,
    rules,
    extension: "input.bin",
    bytes: Buffer.from(bytes),
  });
}
const noChange = () => {};
sourceCase(
  "duplicate-id-distinct-subject-iri",
  "named-class-structural",
  (s) =>
    s.structural.subjects.push({
      id: "class-subject",
      iri: "urn:example:distinct-subject",
    }),
  "ID_DUPLICATE",
  ["A2", "A5", "A7"],
);
sourceCase(
  "nested-intersection-descendant-anchor",
  "aggregate-anchor-outer",
  (s) => {
    s.structural.constructs.find((c) => c.id === "anchor").assertion.target =
      "A";
  },
  "ASSERTION_UNSUPPORTED",
  ["A4", "A7"],
);
sourceCase(
  "signature-missing-annotation-role",
  "typed-integer-lexical-01",
  (s) => {
    s.structural.roles = s.structural.roles.filter((r) => r.id !== "note");
    s.structural.subjects = s.structural.subjects.filter(
      (r) => r.id !== "subject-note",
    );
  },
  "NORMALIZATION_INVALID",
  ["A2", "A5", "A7"],
);
sourceCase(
  "signature-missing-literal-datatype",
  "typed-integer-lexical-01",
  (s) => {
    s.structural.roles = s.structural.roles.filter((r) => r.id !== "integer");
    s.structural.subjects = s.structural.subjects.filter(
      (r) => r.id !== "subject-integer",
    );
  },
  "NORMALIZATION_INVALID",
  ["A2", "A5", "A7"],
);
sourceCase(
  "signature-missing-language-datatype",
  "language-i-klingon",
  (s) => {
    s.structural.roles = s.structural.roles.filter((r) => r.id !== "language");
    s.structural.subjects = s.structural.subjects.filter(
      (r) => r.id !== "subject-language",
    );
  },
  "NORMALIZATION_INVALID",
  ["A2", "A5", "A7"],
);
sourceCase(
  "class-and-generic-rdf-class-role",
  "named-class-structural",
  (s) => {
    s.structural.roles.push({
      id: "generic-role",
      kind: "rdf-class",
      subject: "class-subject",
    });
  },
  "NORMALIZATION_INVALID",
  ["A2", "A7"],
);
sourceCase(
  "specific-and-generic-rdf-property-role",
  "matched-inverse",
  (s) => {
    s.structural.roles.push({
      id: "generic-p",
      kind: "rdf-property",
      subject: "s-p",
    });
  },
  "NORMALIZATION_INVALID",
  ["A2", "A7"],
);
sourceCase(
  "unaggregated-distinct-domain-targets",
  "matched-inverse",
  (s) => {
    s.structural.constructs.push({
      id: "other-domain-p",
      kind: "object-domain",
      property: "p",
      target: "B",
    });
  },
  "NORMALIZATION_INVALID",
  ["A5", "A7"],
);
sourceCase(
  "duplicate-expression-typed-payload",
  "aggregate-anchor-outer",
  (s) => {
    s.structural.expressions.push({
      id: "duplicate-inner",
      kind: "class-intersection",
      members: ["B", "A"],
    });
    s.structural.expressions
      .find((e) => e.id === "outer")
      .members.push("duplicate-inner");
  },
  "RECORD_DUPLICATE",
  ["A3", "A5", "A7"],
);
sourceCase(
  "duplicate-construct-typed-payload",
  "matched-inverse",
  (s) => {
    s.structural.constructs.push({
      ...s.structural.constructs.find((c) => c.id === "domain-p"),
      id: "duplicate-domain",
    });
  },
  "RECORD_DUPLICATE",
  ["A4", "A5", "A7"],
);
sourceCase(
  "wrong-expression-reference-sort",
  "data-complement",
  (s) => {
    const role = s.structural.roles.find((r) => r.id === "integer");
    role.kind = "class";
  },
  "REFERENCE_KIND",
  ["A1", "A3", "A7"],
);
sourceCase(
  "anonymous-property-subject",
  "matched-inverse",
  (s) => {
    delete s.structural.subjects.find((r) => r.id === "s-p").iri;
  },
  "NORMALIZATION_INVALID",
  ["A2", "A7"],
);
sourceCase(
  "anonymous-annotation-value-target-is-named",
  "iri-value-equals-source-handle",
  (s) => {
    s.structural.constructs[0].value = {
      kind: "subject",
      subject: "urn:example:source-handle",
    };
  },
  "NORMALIZATION_INVALID",
  ["A2", "A7"],
);
sourceCase(
  "duplicate-language-value-after-ascii-fold",
  "language-i-klingon",
  (s) => {
    const original = s.structural.constructs[0];
    s.structural.constructs.push({
      ...original,
      id: "second-annotation",
      value: { ...original.value, language: "I-KLINGON" },
    });
  },
  "RECORD_DUPLICATE",
  ["A2", "A5", "A7"],
);
for (const [id, tag] of [
  ["duplicate-variant", "sl-rozaj-rozaj"],
  ["duplicate-singleton", "en-a-aaa-A-bbb"],
  ["non-ascii-subtag", "en-\u212a"],
  ["empty-private-use", "en-x"],
])
  sourceCase(
    `language-${id}`,
    "language-i-klingon",
    (s) => {
      s.structural.constructs[0].value.language = tag;
    },
    "LANGUAGE_TAG_INVALID",
    ["A2", "A7"],
  );
for (const [id, iri] of [
  ["bad-percent", "urn:example:%zz"],
  ["space", "urn:example:bad value"],
  ["unescaped-bracket", "urn:example:[bad]"],
])
  sourceCase(
    `iri-${id}`,
    "named-class-structural",
    (s) => {
      s.structural.subjects[0].iri = iri;
    },
    "IRI_INVALID",
    ["A1", "A7"],
  );
sourceCase(
  "hidden-node-without-edge-closure",
  "artifact-hidden-node-closure",
  (s) => {
    s.visualization.hidden = ["node-A", "label-subclass-edge"];
  },
  "ARTIFACT_INCOMPLETE",
  ["B3", "A7"],
);
sourceCase(
  "hidden-edge-without-label-closure",
  "artifact-hidden-edge-closure",
  (s) => {
    s.visualization.hidden = ["subclass-edge"];
  },
  "ARTIFACT_INCOMPLETE",
  ["B3", "A7"],
);
sourceCase(
  "hidden-label-still-needs-placement",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.placements = s.visualization.placements.filter(
      (p) => p.occurrence !== "label-subclass-edge",
    );
  },
  "ARTIFACT_INCOMPLETE",
  ["B3", "A7"],
);
sourceCase(
  "edge-must-not-have-placement",
  "artifact-hidden-edge-closure",
  (s) => {
    s.visualization.placements.push({
      occurrence: "subclass-edge",
      position: { x: 0, y: 0 },
      pinned: false,
    });
  },
  "ARTIFACT_INCOMPLETE",
  ["B1", "B3", "A7"],
);
sourceCase(
  "duplicate-placement-distinct-state",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.placements.push({
      occurrence: "label-subclass-edge",
      position: { x: 1, y: 2 },
      pinned: false,
    });
  },
  "ARTIFACT_INCOMPLETE",
  ["B3", "A7"],
);
sourceCase(
  "hidden-reference-dangling",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.hidden = ["absent"];
  },
  "REFERENCE_DANGLING",
  ["A1", "A7", "B3"],
);
sourceCase(
  "hidden-reference-wrong-category",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.hidden = ["A"];
  },
  "REFERENCE_KIND",
  ["A1", "A7", "B3"],
);
sourceCase(
  "iri-mode-forbids-language-range",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.labelSelection.range = "en";
  },
  "DOCUMENT_UNKNOWN_FIELD",
  ["A1", "A7", "B4"],
);
sourceCase(
  "boolean-is-not-truthy-string",
  "artifact-hidden-label-closure",
  (s) => {
    s.visualization.display.compactNotation = "false";
  },
  "DOCUMENT_TYPE",
  ["A1", "A7", "B3"],
);
sourceCase(
  "cardinality-retains-decimal-domain",
  "object-exact-unqualified",
  (s) => {
    s.structural.expressions.find((e) => e.id === "restriction").cardinality =
      0;
  },
  "DOCUMENT_TYPE",
  ["A1", "A3", "A7"],
);
const annotated = JSON.parse(
  await readFile(
    resolve(bundle, "vectors/annotated-class/canonical.json"),
    "utf8",
  ),
);
const annotation = annotated.structural.constructs.find(
  (c) => c.kind === "annotation-assertion",
);
annotation.value.lexical = "\ud800";
bytesCase(
  "lone-surrogate-in-valid-envelope-and-literal",
  JSON.stringify(annotated),
  "UNICODE_INVALID",
  {},
  ["A2", "A7", "D19"],
);
const emptyBytes = await readFile(
  resolve(bundle, "vectors/empty-structural/canonical.json"),
);
bytesCase(
  "input-byte-limit-one-short",
  emptyBytes,
  "INPUT_RESOURCE_LIMIT",
  { limits: { inputBytes: emptyBytes.length - 1 } },
  ["A7", "A8"],
);
bytesCase(
  "input-byte-limit-exact",
  emptyBytes,
  null,
  { limits: { inputBytes: emptyBytes.length } },
  ["A7", "A8"],
);
cases.at(-1).expectedCanonical = {
  path: "vectors/empty-structural/canonical.json",
  sha256: sha256(emptyBytes),
};
for (const [limit, value] of [
  ["primaryRecords", 2],
  ["embeddedValues", 1],
  ["depth", 1],
  ["stringBytes", 1],
  ["totalStringBytes", 1],
])
  sourceCase(
    `${limit}-insufficient`,
    "named-class-structural",
    noChange,
    "MODEL_RESOURCE_LIMIT",
    ["A7", "A8"],
    { limits: { [limit]: value } },
  );
sourceCase(
  "primary-record-limit-exact",
  "named-class-structural",
  noChange,
  null,
  ["A7", "A8"],
  { limits: { primaryRecords: 3 } },
);
const namedBytes = await readFile(
  resolve(bundle, "vectors/named-class-structural/canonical.json"),
);
cases.at(-1).expectedCanonical = {
  path: "vectors/named-class-structural/canonical.json",
  sha256: sha256(namedBytes),
};
sourceCase(
  "rdf-quad-limit-one-short",
  "empty-structural",
  noChange,
  "RDF_RESOURCE_LIMIT",
  ["A7", "A8"],
  { limits: { rdfQuads: 19 } },
);
sourceCase(
  "rdf-quad-limit-exact",
  "empty-structural",
  noChange,
  null,
  ["A7", "A8"],
  { limits: { rdfQuads: 20 } },
);
cases.at(-1).expectedCanonical = {
  path: "vectors/empty-structural/canonical.json",
  sha256: sha256(emptyBytes),
};
sourceCase(
  "rdf-deep-zero",
  "symmetric-anonymous-classes",
  noChange,
  "RDFC_RESOURCE_LIMIT",
  ["A7", "A8"],
  { limits: { rdfDeepIterations: 0 } },
);
for (const [limit, maximum] of Object.entries({
  inputBytes: 268435456,
  primaryRecords: 1000000,
  embeddedValues: 4000000,
  depth: 512,
  stringBytes: 16777216,
  totalStringBytes: 134217728,
  rdfQuads: 8000000,
  rdfDeepIterations: 1000000,
  deadlineMs: 300000,
})) {
  sourceCase(
    `option-${limit}-above-ceiling`,
    "empty-structural",
    noChange,
    "OPTION_INVALID",
    ["A7", "A8"],
    { limits: { [limit]: maximum + 1 } },
  );
  if (limit !== "rdfDeepIterations")
    sourceCase(
      `option-${limit}-zero`,
      "empty-structural",
      noChange,
      "OPTION_INVALID",
      ["A7", "A8"],
      { limits: { [limit]: 0 } },
    );
}
sourceCase(
  "option-rdfDeepIterations-negative",
  "empty-structural",
  noChange,
  "OPTION_INVALID",
  ["A7", "A8"],
  { limits: { rdfDeepIterations: -1 } },
);
sourceCase(
  "option-unknown-limit",
  "empty-structural",
  noChange,
  "OPTION_INVALID",
  ["A7", "A8"],
  { limits: { unbounded: true } },
);
const entries = [];
async function pinned(path, bytes) {
  const target = resolve(here, path);
  if (writeNew) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    Buffer.from(bytes),
    `${path}: no expectation overwrite`,
  );
  return {
    path: `supplemental/negative/${path}`,
    sha256: sha256(bytes),
    byteLength: Buffer.byteLength(bytes),
  };
}
for (const { extension, bytes, ...entry } of cases)
  entries.push({
    ...entry,
    status: "independently-derived-pending-review-and-production-execution",
    input: await pinned(`vectors/${entry.id}/${extension}`, bytes),
  });
const sourceArtifacts = [];
for (const path of [
  "oracle/seed-sources.mjs",
  "oracle/extended-sources.mjs",
  "supplemental/grammar/sources.mjs",
  "supplemental/negative/derive.mjs",
])
  sourceArtifacts.push({
    path,
    sha256: sha256(await readFile(resolve(bundle, path))),
  });
await pinned(
  "manifest.json",
  json({
    format: "canonical-vowl-negative-and-boundary-manifest/1",
    status: "supplemental-independent-errors-pending-review",
    independence:
      "Inputs and errors derived from contract rules; no production execution or code used to choose outcomes.",
    sourceArtifacts,
    notes: [
      "Original disputed negatives remain unchanged. Duplicate-ID fixture here changes IRI to avoid identical-record/set overlap.",
      "Isolated surrogate fixture uses an otherwise valid admitted-envelope shape and literal slot. It establishes the Unicode failure without deciding A7/D19 precedence against an invalid envelope.",
      "Options are operation options; supply the manifest profile separately to canonicalize. Null expectedError means success and exact expectedCanonical bytes.",
      "Resource errors are policy tests, not RDF validity judgments. Timing and runtime object-safety controls require separate executable harness cases.",
    ],
    vectors: entries,
  }),
);
console.log(
  JSON.stringify({
    cases: entries.length,
    errors: entries.filter((item) => item.expectedError).length,
    successfulBoundaries: entries.filter((item) => !item.expectedError).length,
    result: "isolated expectations pinned; production execution pending",
  }),
);
