// SPDX-License-Identifier: AGPL-3.0-only
// Bounded independent edit inputs/outputs; no production editor or validator.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { produce } from "../amended-policy/producer.mjs";
import {
  baseline,
  hash,
  json,
  profiles,
  readPinned,
  repository,
} from "../field-contract/support.mjs";
import { permute } from "../field-contract/positives.mjs";
import {
  model,
  projectFixture,
  IRIS,
} from "../mapping-counterexamples/model.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const { header } = await baseline();
const amendment = {
  path: "docs/specs/2026-09-30-canonical-vowl-editing-amendment.md",
  sha256: "75b47ac91ee1d0f219b69f38fb69ca354536c1e763fe32ef202cc9b04ad6b846",
};
await readPinned(amendment, repository);
async function pin(path, contents) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  const expected = Buffer.from(contents),
    destination = resolve(here, path);
  if (process.argv.includes("--write-new")) {
    await mkdir(dirname(destination), { recursive: true });
    try {
      await writeFile(destination, expected, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(destination),
    expected,
    `${path}: no golden replacement`,
  );
  return {
    path: `supplemental/editing-v1/${path}`,
    sha256: hash(expected),
    byteLength: expected.length,
  };
}
async function positiveFiles(id, side, source) {
  const result = await produce(source, profiles.structural),
    permutation = permute(source),
    permuted = await produce(permutation, profiles.structural);
  assert.deepEqual(result.bytes, permuted.bytes);
  assert.equal(result.canonicalNQuads, permuted.canonicalNQuads);
  const files = {};
  for (const [name, bytes] of [
    ["source.json", json(source)],
    ["permuted-source.json", json(permutation)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[name] = await pin(`${id}/${side}/${name}`, bytes);
  return { files, result };
}
function canonicalSource(result) {
  return { structural: structuredClone(result.document.structural) };
}
function canonicalId(result, sourceHandle) {
  const item = result.correspondence.find(
    (value) => value.sourceHandle === sourceHandle,
  );
  assert(item);
  return item.canonicalId;
}
function stable(value) {
  if (Array.isArray(value))
    return value
      .map(stable)
      .sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}
function occurrenceKeys(occurrences) {
  const records = new Map(occurrences.map((item) => [item.id, item])),
    keys = new Map();
  function key(id) {
    if (!keys.has(id)) {
      const { id: ignored, ...value } = records.get(id);
      void ignored;
      for (const field of ["from", "to", "edge"])
        if (value[field]) value[field] = key(value[field]);
      if (value.ends) value.ends = value.ends.map(key);
      keys.set(id, JSON.stringify(stable(value)));
    }
    return keys.get(id);
  }
  for (const { id } of occurrences) key(id);
  return keys;
}
function correspondence(before, afterSource, after) {
  const currentByHandle = new Map(
    after.correspondence.map((item) => [item.sourceHandle, item.canonicalId]),
  );
  const pairs = [];
  for (const category of ["subjects", "roles", "expressions", "constructs"])
    for (const item of before.document.structural[category])
      pairs.push({
        previous: item.id,
        current: currentByHandle.get(item.id) ?? null,
      });
  const oldKeys = occurrenceKeys(before.document.structural.occurrences),
    newKeys = occurrenceKeys(afterSource.structural.occurrences);
  const newByKey = new Map(
    [...newKeys].map(([id, key]) => [key, currentByHandle.get(id)]),
  );
  for (const [id, key] of oldKeys)
    pairs.push({ previous: id, current: newByKey.get(key) ?? null });
  const incoming = new Set(
    pairs.map((item) => item.current).filter((item) => item !== null),
  );
  return {
    correspondence: pairs,
    created: after.correspondence
      .map((item) => item.canonicalId)
      .filter((id) => !incoming.has(id)),
    comparison:
      "Compare correspondence as a total previous-ID mapping and created as an ID set; the amendment does not specify array order. These cases need no merge aliases and do not claim general editing normalization coverage.",
  };
}
const vectors = [];
let insertionBase;
for (const scenario of [
  "insert-class",
  "delete-class",
  "retarget-annotated-domain",
]) {
  const m = model();
  m.role("A", "class");
  if (scenario !== "insert-class") m.role("B", "class");
  if (scenario === "retarget-annotated-domain") {
    m.role("C", "class");
    m.role("p", "object-property");
    m.role("annotation", "annotation-property", "urn:editing:annotation");
    m.role("string", "datatype");
    m.fact("domain", "object-domain", { property: "p", target: "A" });
    m.fact("range", "object-range", { property: "p", target: "B" });
    m.fact("anchor", "assertion-anchor", {
      assertion: { kind: "object-domain", property: "p", target: "A" },
      annotations: [
        {
          predicate: "urn:editing:annotation",
          value: {
            kind: "typed",
            lexical: "domain annotation",
            datatype: IRIS.string,
          },
          annotations: [],
        },
      ],
    });
  }
  projectFixture(m.source);
  const before = await positiveFiles(scenario, "before", m.source),
    afterSource = canonicalSource(before.result);
  let changes;
  if (scenario === "insert-class") {
    changes = [
      {
        kind: "insert",
        collection: "subjects",
        record: { id: "new-subject-B", iri: "urn:editing:inserted-B" },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: "new-role-B", kind: "class", subject: "new-subject-B" },
      },
    ];
    afterSource.structural.subjects.push(structuredClone(changes[0].record));
    afterSource.structural.roles.push(structuredClone(changes[1].record));
    insertionBase = before;
  } else if (scenario === "delete-class") {
    const role = canonicalId(before.result, "B"),
      subject = canonicalId(before.result, "s:B");
    changes = [
      { kind: "remove", id: role },
      { kind: "remove", id: subject },
    ];
    afterSource.structural.roles = afterSource.structural.roles.filter(
      (item) => item.id !== role,
    );
    afterSource.structural.subjects = afterSource.structural.subjects.filter(
      (item) => item.id !== subject,
    );
  } else {
    const domain = canonicalId(before.result, "domain"),
      target = canonicalId(before.result, "C"),
      anchor = canonicalId(before.result, "anchor");
    changes = [{ kind: "set-endpoint", construct: domain, target }];
    afterSource.structural.constructs.find(
      (item) => item.id === domain,
    ).target = target;
    afterSource.structural.constructs.find(
      (item) => item.id === anchor,
    ).assertion.target = target;
  }
  projectFixture(afterSource);
  const after = await positiveFiles(scenario, "after", afterSource),
    expected = correspondence(before.result, afterSource, after.result);
  const changesPin = await pin(`${scenario}/changes.json`, json(changes));
  const correspondencePin = await pin(
    `${scenario}/correspondence.json`,
    json(expected),
  );
  vectors.push({
    id: scenario,
    operation: "edit",
    outcome: "success",
    before: before.files,
    changes: changesPin,
    after: after.files,
    expectedCorrespondence: correspondencePin,
    rules: [
      "editing/public-boundary",
      "editing/annotation-normalization-ownership",
      "editing/result-correspondence",
      "B1",
      "A6",
    ],
    independence:
      "Normalized after-source is manually constructed from the accepted change semantics; the independent A6 producer supplies full output bytes, and B1 generation keys supply occurrence correspondence. No product edit execution was used.",
  });
}
const oldSubject = insertionBase.result.document.structural.subjects[0].id,
  oldRole = insertionBase.result.document.structural.roles[0].id,
  oldOccurrence = insertionBase.result.document.structural.occurrences[0].id;
for (const [id, changes, reason] of [
  [
    "removed-handles-cannot-be-reinserted",
    [
      { kind: "remove", id: oldRole },
      { kind: "remove", id: oldSubject },
      {
        kind: "insert",
        collection: "subjects",
        record: { id: oldSubject, iri: "urn:editing:unrelated" },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: oldRole, kind: "class", subject: oldSubject },
      },
    ],
    "An insert handle must be fresh for the atomic request, not merely absent after an earlier remove.",
  ],
  [
    "removed-handles-cannot-swap-categories",
    [
      { kind: "remove", id: oldRole },
      { kind: "remove", id: oldSubject },
      {
        kind: "insert",
        collection: "subjects",
        record: { id: oldRole, iri: "urn:editing:unrelated" },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: oldSubject, kind: "class", subject: oldRole },
      },
    ],
    "Fresh-handle identity spans all primary categories; removing two old handles does not permit reusing them with exchanged categories.",
  ],
  [
    "insert-cannot-use-existing-occurrence-handle",
    [
      {
        kind: "insert",
        collection: "subjects",
        record: { id: oldOccurrence, iri: "urn:editing:unrelated" },
      },
    ],
    "Occurrence handles are existing primary handles even though occurrence edits are not public operations; conflicting insert handles fail request validation.",
  ],
])
  vectors.push({
    id,
    operation: "edit",
    outcome: "error",
    expectedError: "EDIT_INVALID",
    before: insertionBase.files,
    changes: await pin(`${id}/changes.json`, json(changes)),
    rules: ["editing/insert-fresh-handle", "editing/conflicting-handles"],
    reason,
  });
const sourcePath = "supplemental/editing-v1/derive.mjs",
  helperPath = "supplemental/mapping-counterexamples/model.mjs";
await pin(
  "manifest.json",
  json({
    format: "canonical-vowl-editing-conformance-manifest/1",
    status: "bounded-independent-editing-expectations-pending-review",
    specificationRevision: header.specificationRevision,
    resourceAmendment: header.amendment,
    editingAmendment: amendment,
    sourceArtifacts: [
      {
        path: sourcePath,
        sha256: hash(await readFile(fileURLToPath(import.meta.url))),
      },
      {
        path: helperPath,
        sha256: hash(
          await readFile(resolve(here, "../mapping-counterexamples/model.mjs")),
        ),
      },
    ],
    scope:
      "Three explicitly requested fresh-handle request rejections, class insertion/deletion, and exact supported annotated-domain retargeting. No claim of every normalization/merge/edit combination or complete operation validation.",
    vectors,
  }),
);
console.log(
  JSON.stringify({
    editingPositives: 3,
    freshHandleNegatives: 3,
    independentBeforeAfterPermutations: 6,
  }),
);
