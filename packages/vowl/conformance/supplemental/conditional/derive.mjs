// SPDX-License-Identifier: AGPL-3.0-only
// Independent conditional topology outputs; no production modules or tests.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { produce, profiles } from "../amended-policy/producer.mjs";
import { conditionalSources } from "./sources.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "../..");
const repo = resolve(bundle, "../../..");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const writeNew = process.argv.includes("--write-new");
const referenceNames = new Set([
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
    .flatMap((items) =>
      items
        .filter((item) => item && typeof item === "object" && "id" in item)
        .map((item) => item.id),
    );
  const names = new Map(
    handles.map((handle, index) => [
      handle,
      `conditional-renamed-${handles.length - index}`,
    ]),
  );
  function visit(value, key, owner) {
    if (typeof value === "string") {
      let reference =
        key === "id" ||
        referenceNames.has(key) ||
        (key === "value" && owner?.kind === "object-value");
      if (
        (key === "datatype" && owner?.kind === "typed") ||
        (key === "target" &&
          ["annotation-domain", "annotation-range"].includes(owner?.kind))
      )
        reference = false;
      return reference && names.has(value) ? names.get(value) : value;
    }
    if (Array.isArray(value)) {
      const items = value.map((item) => visit(item, key, owner));
      return key === "members" && owner?.kind === "property-chain"
        ? items
        : items.reverse();
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.keys(value)
        .reverse()
        .map((field) => [field, visit(value[field], field, value)]),
    );
  }
  return visit(source);
}
async function pinned(path, value) {
  const bytes = Buffer.from(value),
    target = resolve(here, path);
  if (
    process.argv.includes("--update-provenance") &&
    path.endsWith("manifest.json")
  ) {
    const previous = JSON.parse(await readFile(target, "utf8"));
    const next = JSON.parse(bytes);
    assert.deepEqual(
      previous,
      { ...next, sourceArtifacts: previous.sourceArtifacts },
      "Only source artifact provenance may change; all vector expectations and other metadata stay frozen",
    );
    await writeFile(target, bytes);
  }
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
    `${path}: no frozen expectation overwrites`,
  );
  return {
    path: `supplemental/conditional/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
const baselinePath = "supplemental/amended-policy/manifest.json";
const baselineBytes = await readFile(resolve(bundle, baselinePath)),
  baseline = JSON.parse(baselineBytes);
const amendment = await readFile(resolve(repo, baseline.amendment.path));
assert.equal(hash(amendment), baseline.amendment.sha256);
assert.equal(
  hash(
    await readFile(resolve(bundle, "supplemental/amended-policy/producer.mjs")),
  ),
  "da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321",
);
const vectors = [];
assert.equal(
  new Set(conditionalSources.map((item) => item.id)).size,
  conditionalSources.length,
  "Fixture identifiers must be unique before writing any expectations",
);
for (const fixture of conditionalSources) {
  const profile = fixture.source.visualization
    ? profiles.artifact
    : profiles.structural;
  const permutation = permute(fixture.source);
  const result = await produce(fixture.source, profile),
    alternate = await produce(permutation, profile);
  assert.deepEqual(
    result.bytes,
    alternate.bytes,
    `${fixture.id}: complete conditional topology/state under handle/set/key permutation`,
  );
  assert.equal(
    result.canonicalNQuads,
    alternate.canonicalNQuads,
    `${fixture.id}: complete canonical dataset under permutation`,
  );
  const files = {};
  for (const [filename, bytes] of [
    ["source.json", json(fixture.source)],
    ["permuted-source.json", json(permutation)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[filename] = await pinned(`vectors/${fixture.id}/${filename}`, bytes);
  vectors.push({
    id: fixture.id,
    profile,
    clauses: fixture.clauses,
    ...(fixture.note ? { note: fixture.note } : {}),
    status:
      "independently-derived-conditional-topology-pending-review-and-production-comparison",
    counts: {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
      occurrenceKinds: Object.fromEntries(
        [
          ...new Set(
            fixture.source.structural.occurrences.map((item) => item.kind),
          ),
        ]
          .sort()
          .map((kind) => [
            kind,
            fixture.source.structural.occurrences.filter(
              (item) => item.kind === kind,
            ).length,
          ]),
      ),
    },
    metamorphic: [
      "source-handle-bijection",
      "all-set-reversal",
      "object-key-reversal",
    ],
    files,
  });
}
const sourceArtifacts = [];
for (const path of [
  "oracle/extended-sources.mjs",
  "supplemental/grammar/sources.mjs",
  "supplemental/amended-policy/producer.mjs",
  "supplemental/conditional/sources.mjs",
  "supplemental/conditional/derive.mjs",
])
  sourceArtifacts.push({
    path,
    sha256: hash(await readFile(resolve(bundle, path))),
  });
await pinned(
  "manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "independent-conditional-supplement-pending-review",
    specificationRevision: baseline.specificationRevision,
    amendment: baseline.amendment,
    policy: baseline.policy,
    dependencies: baseline.dependencies,
    comparisonRules: baseline.comparisonRules,
    priorCorpus: {
      path: baselinePath,
      sha256: hash(baselineBytes),
      positiveCount: 95,
      modified: false,
    },
    independence:
      "Hand-selected normalized sources and complete topology from B2 clauses; only the separate amended oracle and standards libraries derive canonical bytes. No production code, tests or outputs select expectations.",
    sourceArtifacts,
    vectors,
  }),
);
console.log(
  JSON.stringify({
    newPositive: vectors.length,
    metamorphicCompleteOutputComparisons: vectors.length,
    result:
      "new conditional topology/state outputs reproduce without overwrite",
  }),
);
