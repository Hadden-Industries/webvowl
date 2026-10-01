// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { produce } from "./producer.mjs";
import { extendedSources } from "./extended-sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "..");
const writeNew = process.argv.includes("--write-new");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const referenceFields = new Set([
  "subject",
  "role",
  "property",
  "class",
  "individual",
  "sub",
  "super",
  "defined",
  "operand",
  "filler",
  "datatype",
  "target",
  "construct",
  "expression",
  "from",
  "to",
  "edge",
  "occurrence",
  "scope",
  "targets",
  "properties",
  "forward",
  "reverse",
  "ends",
  "members",
  "hidden",
  "objectProperties",
  "dataProperties",
]);

function permute(source) {
  const handles = Object.values(source.structural)
    .filter(Array.isArray)
    .flatMap((records) =>
      records
        .filter(
          (record) => record && typeof record === "object" && "id" in record,
        )
        .map((record) => record.id),
    );
  const renamed = new Map(
    handles.map((id, index) => [id, `renamed-${handles.length - index}`]),
  );
  function visit(value, key, owner) {
    if (typeof value === "string") {
      const reference =
        key === "id" ||
        referenceFields.has(key) ||
        (key === "value" && owner?.kind === "object-value");
      return reference && renamed.has(value) ? renamed.get(value) : value;
    }
    if (Array.isArray(value)) {
      const list = value.map((item) => visit(item, key, owner));
      return key === "members" && owner?.kind === "property-chain"
        ? list
        : list.reverse();
    }
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((field) => [field, visit(value[field], field, value)]),
    );
  }
  return visit(source);
}

const seedManifest = JSON.parse(
  await readFile(resolve(bundle, "manifest.json"), "utf8"),
);
const generated = [];
const results = new Map();
for (const vector of extendedSources) {
  const permutedSource = permute(vector.source);
  let result;
  const outputs = [
    ["source.json", json(vector.source)],
    ["permuted-source.json", json(permutedSource)],
  ];
  if (vector.expectedError) {
    for (const source of [vector.source, permutedSource]) {
      await assert.rejects(
        produce(source, vector.profile),
        /^Error: Maximum deep iterations exceeded \(37\)\.$/,
      );
    }
    outputs.push([
      "expected-error.json",
      json({
        code: vector.expectedError,
        rule: "A8",
        dependency: "rdf-canonize@5.0.0",
        maxDeepIterations: 37,
        note: "Bounded operational rejection for this pinned implementation; no canonical result or fallback is permitted.",
      }),
    ]);
  } else {
    result = await produce(vector.source, vector.profile);
    const permuted = await produce(permutedSource, vector.profile);
    assert.deepEqual(
      permuted.bytes,
      result.bytes,
      `${vector.id}: complete output under simultaneous handle/set/key permutation`,
    );
    assert.equal(
      permuted.canonicalNQuads,
      result.canonicalNQuads,
      `${vector.id}: canonical dataset under permutation`,
    );
    outputs.push(
      ["mapped.nq", result.mappedNQuads],
      ["canonical.nq", result.canonicalNQuads],
      ["ids.json", json(result.correspondence)],
      ["canonical.json", result.bytes],
    );
  }
  const files = {};
  for (const [name, data] of outputs) {
    const path = `vectors/${vector.id}/${name}`;
    const target = resolve(bundle, path);
    const bytes = Buffer.from(data);
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
      bytes,
      `${path}: no automatic expectation overwrite`,
    );
    files[name] = { path, sha256: sha256(bytes), byteLength: bytes.length };
  }
  generated.push({
    id: vector.id,
    profile: vector.profile,
    rules: vector.rules,
    status: "independently-derived-pending-review",
    ...(vector.expectedError ? { expectedError: vector.expectedError } : {}),
    counts: vector.expectedCounts ?? {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    },
    metamorphic: [
      "source-handle-bijection",
      "all-set-reversal",
      "object-insertion-order-reversal",
    ],
    files,
  });
  results.set(vector.id, result);
}
for (const [left, right] of [
  ["repeated-chain", "reversed-chain"],
  ["repeated-chain", "short-chain"],
  ["named-pair-artifact", "named-pair-exchanged-artifact"],
]) {
  assert.notDeepEqual(
    results.get(left).bytes,
    results.get(right).bytes,
    `${left}/${right}: retained distinction`,
  );
}
const symmetric = extendedSources.find(
  (vector) => vector.id === "symmetric-anonymous-artifact",
);
const exchanged = structuredClone(symmetric.source);
[
  exchanged.visualization.placements[0].occurrence,
  exchanged.visualization.placements[1].occurrence,
] = [
  exchanged.visualization.placements[1].occurrence,
  exchanged.visualization.placements[0].occurrence,
];
assert.deepEqual(
  (await produce(exchanged, symmetric.profile)).bytes,
  results.get(symmetric.id).bytes,
  "Exchange structurally symmetric anonymous occurrences with all their state: compare complete output",
);

const manifest = {
  format: "canonical-vowl-conformance-manifest/1",
  status: "experimental-expanded-corpus-pending-independent-review",
  specificationRevision: seedManifest.specificationRevision,
  seedManifest: {
    path: "manifest.json",
    sha256: sha256(await readFile(resolve(bundle, "manifest.json"))),
  },
  oracle: {
    source: "oracle/producer.mjs",
    sourceSha256: sha256(await readFile(resolve(here, "producer.mjs"))),
    fixtureDerivation: "oracle/extended-sources.mjs",
    fixtureDerivationSha256: sha256(
      await readFile(resolve(here, "extended-sources.mjs")),
    ),
    dependencies: { "rdf-canonize": "5.0.0", canonicalize: "5.1.0" },
  },
  interpretationChecks: [
    {
      rule: "B2.3/B2.4",
      status:
        "Claude confirmed the specific-rule interpretation; full vector review pending",
      interpretation:
        "The explicit B2.4 scoped PropertyContext rule governs both object and data restriction filler occurrences.",
    },
  ],
  vectors: generated,
};
const target = resolve(bundle, "extended-manifest.json");
if (writeNew) {
  try {
    await writeFile(target, json(manifest), { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
if (process.argv.includes("--update-provenance")) {
  const previous = JSON.parse(await readFile(target, "utf8"));
  assert.deepEqual(
    previous.vectors,
    manifest.vectors,
    "Provenance update must preserve all extended vectors and expected files",
  );
  await writeFile(target, JSON.stringify(manifest, null, 2) + "\n");
}
assert.deepEqual(
  JSON.parse(await readFile(target, "utf8")),
  manifest,
  "Extended manifest changed: fixture review required",
);
console.log(
  JSON.stringify({
    vectors: generated.length,
    metamorphicComparisons: generated.length + 1,
    retainedDistinctions: 3,
    result: "all independently produced files and invariants match",
  }),
);
