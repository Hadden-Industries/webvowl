// SPDX-License-Identifier: AGPL-3.0-only
// Supplemental derivation uses the frozen independent mapper and trusted recipes.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { produce, profiles } from "../../oracle/producer.mjs";
import { grammarSources } from "./sources.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "../..");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const writeNew = process.argv.includes("--write-new");
const refs = new Set([
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
    handles.map((id, index) => [
      id,
      `supplement-renamed-${handles.length - index}`,
    ]),
  );
  function visit(value, key, owner) {
    if (typeof value === "string")
      return (key === "id" ||
        refs.has(key) ||
        (key === "value" && owner?.kind === "object-value")) &&
        renamed.has(value)
        ? renamed.get(value)
        : value;
    if (Array.isArray(value)) {
      const items = value.map((item) => visit(item, key, owner));
      return key === "members" && owner?.kind === "property-chain"
        ? items
        : items.reverse();
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
async function pinned(path, data) {
  const target = resolve(here, path),
    bytes = Buffer.from(data);
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
    `${path}: no expectation overwrites`,
  );
  return {
    path: `supplemental/grammar/${path}`,
    sha256: sha256(bytes),
    byteLength: bytes.length,
  };
}
const vectors = [],
  results = new Map();
for (const vector of grammarSources) {
  const profile = vector.source.visualization
    ? profiles.artifact
    : profiles.structural;
  const alternate = permute(vector.source);
  const outputs = [
    ["source.json", json(vector.source)],
    ["permuted-source.json", json(alternate)],
  ];
  let result;
  if (vector.expectedError) {
    for (const input of [vector.source, alternate])
      await assert.rejects(
        produce(input, profile),
        (error) =>
          error.message ===
          `Maximum deep iterations exceeded (${vector.expectedDeepIterations}).`,
      );
    outputs.push([
      "expected-error.json",
      json({
        code: vector.expectedError,
        rule: "A8",
        dependency: "rdf-canonize@5.0.0",
        maxDeepIterations: vector.expectedDeepIterations,
        note: "Operational rejection of this pinned library under current A8, not a universal language-neutral validity rejection. No canonical result is authorized.",
      }),
    ]);
  } else {
    result = await produce(vector.source, profile);
    const permuted = await produce(alternate, profile);
    assert.deepEqual(
      permuted.bytes,
      result.bytes,
      `${vector.id}: all complete bytes under permutation`,
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
    results.set(vector.id, result);
  }
  const files = {};
  for (const [filename, bytes] of outputs)
    files[filename] = await pinned(`vectors/${vector.id}/${filename}`, bytes);
  vectors.push({
    id: vector.id,
    profile,
    rules: [
      ...new Set([
        ...vector.rules,
        "A6.3",
        "D18.2",
        ...(vector.source.structural.occurrences.length ? ["B1"] : []),
      ]),
    ],
    status: "independently-derived-pending-review-and-production-comparison",
    ...(vector.interpretation ? { interpretation: vector.interpretation } : {}),
    ...(vector.expectedError
      ? {
          expectedError: vector.expectedError,
          librarySpecificOperationalRejection: true,
        }
      : {
          counts: {
            primary: result.correspondence.length,
            blankNodes: result.blankNodeCount,
            quads: result.quadCount,
          },
        }),
    metamorphic: [
      "source-handle-bijection",
      "all-set-reversal",
      "object-insertion-order-reversal",
    ],
    files,
  });
}
assert.notDeepEqual(
  results.get("typed-integer-lexical-01").bytes,
  results.get("typed-integer-lexical-1").bytes,
  "Literal lexical 01 and 1 remain distinct",
);
const orientation = results.get("inverse-orientation-opposes-role-rank");
const rank = (handle) =>
  BigInt(
    orientation.correspondence
      .find((record) => record.sourceHandle === handle)
      .canonicalId.slice(1),
  );
assert.ok(
  rank("p") > rank("q"),
  "Semantic IRI ordering discriminator must oppose canonical role rank",
);
const oldManifest = JSON.parse(
  await readFile(resolve(bundle, "manifest.json"), "utf8"),
);
const provenance = [];
for (const path of [
  "oracle/producer.mjs",
  "oracle/extended-sources.mjs",
  "supplemental/grammar/sources.mjs",
  "supplemental/grammar/derive.mjs",
])
  provenance.push({
    path,
    sha256: sha256(await readFile(resolve(bundle, path))),
  });
assert.equal(
  provenance[0].sha256,
  "5097d9726c839afc7b4240dcb5527bd5089f5f847d788e9b32b6d3dd67699fd1",
  "Frozen reviewed producer unchanged",
);
await pinned(
  "manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "supplemental-independent-corpus-pending-review",
    specificationRevision: oldManifest.specificationRevision,
    profiles,
    dependencies: { "rdf-canonize": "5.0.0", canonicalize: "5.1.0" },
    sourceArtifacts: provenance,
    comparisonRules: {
      "mapped.nq":
        "Compare RDF dataset isomorphism, never private blank-node spelling or line order.",
      "canonical.nq": "Compare exact RDFC-1.0 N-Quads bytes.",
      "canonical.json": "Compare exact complete RFC 8785 bytes.",
      "ids.json":
        "Derivation evidence only. Symmetric source-handle correspondence is not a conformance invariant even for the same source input.",
    },
    vectors,
  }),
);
console.log(
  JSON.stringify({
    vectors: vectors.length,
    positive: results.size,
    operationalRejections: vectors.length - results.size,
    result: "all supplemental expectations reproduce without overwrite",
  }),
);
