// SPDX-License-Identifier: AGPL-3.0-only
// Stable error expectations come from A7's ordering, not production execution.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import canonicalize from "canonicalize";
import { seedSources } from "./seed-sources.mjs";
import { extendedSources } from "./extended-sources.mjs";
import { profiles } from "./producer.mjs";
const directory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const writeNew = process.argv.includes("--write-new");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const vectors = [];
const sourceOf = (id) =>
  structuredClone(
    [...seedSources, ...extendedSources].find((entry) => entry.id === id)
      .source,
  );
function sourceCase(id, base, modify, code, rule) {
  const source = sourceOf(base);
  modify(source);
  vectors.push({
    id,
    operation: "canonicalize",
    profile: source.visualization ? profiles.artifact : profiles.structural,
    code,
    rule,
    source,
    extension: "source.json",
    bytes: Buffer.from(json(source)),
  });
}
function bytesCase(id, bytes, code, rule = "A7/D19") {
  vectors.push({
    id,
    operation: "decode",
    code,
    rule,
    extension: "input.bin",
    bytes: Buffer.from(bytes),
  });
}
sourceCase(
  "required-role-collection",
  "named-class-structural",
  (s) => {
    delete s.structural.roles;
  },
  "DOCUMENT_REQUIRED_FIELD",
  "A1/A2/A7",
);
sourceCase(
  "unknown-subject-field",
  "named-class-structural",
  (s) => {
    s.structural.subjects[0].label = "Forbidden copy";
  },
  "DOCUMENT_UNKNOWN_FIELD",
  "A1/A2/A7",
);
sourceCase(
  "subject-iri-not-absolute",
  "named-class-structural",
  (s) => {
    s.structural.subjects[0].iri = "relative";
  },
  "IRI_INVALID",
  "A1/A7",
);
sourceCase(
  "duplicate-primary-id",
  "named-class-structural",
  (s) => {
    s.structural.subjects.push({ ...s.structural.subjects[0] });
  },
  "ID_DUPLICATE",
  "A5/A7",
);
sourceCase(
  "duplicate-named-subject",
  "named-class-structural",
  (s) => {
    s.structural.subjects.push({
      ...s.structural.subjects[0],
      id: "duplicate-subject",
    });
  },
  "RECORD_DUPLICATE",
  "A2/A5/A7",
);
sourceCase(
  "duplicate-role-key",
  "named-class-structural",
  (s) => {
    s.structural.roles.push({ ...s.structural.roles[0], id: "duplicate-role" });
  },
  "RECORD_DUPLICATE",
  "A2/A5/A7",
);
sourceCase(
  "dangling-role-subject",
  "named-class-structural",
  (s) => {
    s.structural.roles[0].subject = "absent";
  },
  "REFERENCE_DANGLING",
  "A1/A7",
);
sourceCase(
  "wrong-role-subject-category",
  "named-class-structural",
  (s) => {
    s.structural.roles[0].subject = "class-role";
  },
  "REFERENCE_KIND",
  "A1/A7",
);
sourceCase(
  "duplicate-import-set-member",
  "empty-structural",
  (s) => {
    s.structural.ontology.imports = [
      "urn:example:import",
      "urn:example:import",
    ];
  },
  "SOURCE_DUPLICATE_SET_MEMBER",
  "A1/A5/A7",
);
sourceCase(
  "expression-cycle-before-projection",
  "named-class-structural",
  (s) => {
    s.structural.expressions.push({
      id: "cycle",
      kind: "class-complement",
      operand: "cycle",
    });
    s.structural.constructs.push({
      id: "subclass",
      kind: "subclass",
      sub: "class-role",
      super: "cycle",
    });
  },
  "EXPRESSION_CYCLE",
  "A3/A7",
);
sourceCase(
  "unsupported-assertion-anchor",
  "asymmetric-subclass",
  (s) => {
    s.structural.subjects.push({
      id: "note-subject",
      iri: "https://example.org/note",
    });
    s.structural.roles.push({
      id: "note",
      kind: "annotation-property",
      subject: "note-subject",
    });
    s.structural.constructs.push({
      id: "unsupported",
      kind: "assertion-anchor",
      assertion: { kind: "subclass", sub: "B", super: "A" },
      annotations: [
        {
          predicate: "https://example.org/note",
          value: { kind: "iri", iri: "https://example.org/value" },
          annotations: [],
        },
      ],
    });
  },
  "ASSERTION_UNSUPPORTED",
  "A4/A7",
);
sourceCase(
  "missing-required-occurrence",
  "named-class-structural",
  (s) => {
    s.structural.occurrences = [];
  },
  "PROJECTION_INVALID",
  "B2.1/A7",
);
sourceCase(
  "artifact-missing-placement",
  "named-class-artifact",
  (s) => {
    s.visualization.placements = [];
  },
  "ARTIFACT_INCOMPLETE",
  "B3/A7",
);
sourceCase(
  "artifact-duplicate-placement",
  "named-class-artifact",
  (s) => {
    s.visualization.placements.push({
      occurrence: "class-node",
      position: { x: 10, y: 10 },
      pinned: false,
    });
  },
  "ARTIFACT_INCOMPLETE",
  "B3/A7",
);
sourceCase(
  "bad-language-tag",
  "annotated-class",
  (s) => {
    s.structural.constructs[0].value.language = "en--gb";
  },
  "LANGUAGE_TAG_INVALID",
  "A2/A7",
);
sourceCase(
  "bad-language-range",
  "named-pair-artifact",
  (s) => {
    s.visualization.labelSelection.range = "en-*";
  },
  "LANGUAGE_RANGE_INVALID",
  "B4/A7",
);
sourceCase(
  "noncanonical-decimal-string",
  "object-exact-unqualified",
  (s) => {
    s.structural.expressions[0].cardinality = "01";
  },
  "DECIMAL_INVALID",
  "A1/A3/A7",
);
sourceCase(
  "noncharacter-text",
  "annotated-class",
  (s) => {
    s.structural.constructs[0].value.lexical = "\ufdd0";
  },
  "UNICODE_INVALID",
  "A7",
);

const emptyBytes = await readFile(
  resolve(directory, "vectors/empty-structural/canonical.json"),
);
const artifactBytes = await readFile(
  resolve(directory, "vectors/named-class-artifact/canonical.json"),
);
const namedBytes = await readFile(
  resolve(directory, "vectors/named-class-structural/canonical.json"),
);
bytesCase("invalid-utf8", Uint8Array.from([0xc0, 0xaf]), "JSON_INVALID_UTF8");
bytesCase(
  "utf8-bom",
  Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), emptyBytes]),
  "JSON_BOM",
);
bytesCase("incomplete-json", "{", "JSON_SYNTAX");
bytesCase(
  "escaped-equal-root-member",
  '{"profile":"' +
    profiles.structural +
    '","\\u0070rofile":"' +
    profiles.structural +
    '"}',
  "JSON_DUPLICATE_MEMBER",
);
bytesCase(
  "nested-equal-duplicate",
  '{"structural":{"ontology":{"imports":[],"imports":[]}}}',
  "JSON_DUPLICATE_MEMBER",
);
bytesCase("lone-surrogate", '{"profile":"\\ud800"}', "UNICODE_INVALID");
bytesCase(
  "trailing-newline",
  Buffer.concat([emptyBytes, Buffer.from("\n")]),
  "NON_CANONICAL_BYTES",
);
bytesCase(
  "leading-whitespace",
  Buffer.concat([Buffer.from(" "), emptyBytes]),
  "NON_CANONICAL_BYTES",
);
bytesCase(
  "negative-zero",
  artifactBytes.toString("utf8").replace('"x":12.5', '"x":-0'),
  "NUMBER_INVALID",
);
const unknownProfile = JSON.parse(emptyBytes);
unknownProfile.profile = "urn:example:unknown-profile";
bytesCase("unknown-profile", canonicalize(unknownProfile), "PROFILE_UNKNOWN");
const wrongId = JSON.parse(namedBytes);
wrongId.structural.subjects[0].id = "s00";
wrongId.structural.roles[0].subject = "s00";
bytesCase("malformed-canonical-id", canonicalize(wrongId), "ID_INVALID");
const wrongRank = JSON.parse(namedBytes);
wrongRank.structural.subjects[0].id = "s9";
wrongRank.structural.roles[0].subject = "s9";
bytesCase(
  "noncontiguous-canonical-rank",
  canonicalize(wrongRank),
  "NON_CANONICAL_BYTES",
);

const manifest = [];
for (const vector of vectors) {
  const path = `negative/${vector.id}/${vector.extension}`;
  const target = resolve(directory, path);
  if (writeNew) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, vector.bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    vector.bytes,
    `${path}: never overwrite expected inputs`,
  );
  manifest.push({
    id: vector.id,
    operation: vector.operation,
    ...(vector.profile ? { profile: vector.profile } : {}),
    expectedError: vector.code,
    rule: vector.rule,
    input: {
      path,
      sha256: sha256(vector.bytes),
      byteLength: vector.bytes.length,
    },
    status: "independently-derived-pending-review-and-production-execution",
  });
}
const path = resolve(directory, "negative-manifest.json");
const contents = json({
  status: "experimental-stable-error-expectations",
  vectors: manifest,
});
if (writeNew) {
  try {
    await writeFile(path, contents, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
assert.equal(
  await readFile(path, "utf8"),
  contents,
  "Negative expectations require explicit review before changes",
);
console.log(
  JSON.stringify({
    negativeVectors: vectors.length,
    result: "all independently derived input files match",
  }),
);
