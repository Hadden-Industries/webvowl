import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readCorpusArtifact } from "../conformance/storage.mjs";

const roots = {
  conformance: new URL("../conformance/", import.meta.url),
  repository: new URL("../../../", import.meta.url),
};
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const pins = new Map();
const baseOf = (reference) =>
  reference.base ??
  (reference.path.startsWith("docs/") ? "repository" : "conformance");
const keyOf = (reference) => `${baseOf(reference)}:${reference.path}`;

function register(reference) {
  const key = keyOf(reference),
    prior = pins.get(key);
  if (prior) {
    assert.equal(
      prior.sha256,
      reference.sha256,
      `Conflicting frozen pin: ${key}`,
    );
  } else {
    pins.set(key, reference);
  }
}

export function readPinned(reference) {
  if (typeof reference === "string") {
    const path = reference;
    reference = pins.get(`conformance:${path}`);
    assert.ok(reference, `Missing frozen corpus pin: ${path}`);
  }
  const root = roots[baseOf(reference)];
  assert.ok(root, `Unknown corpus pin base: ${reference.base}`);
  const url = new URL(reference.path, root);
  assert.ok(
    url.href.startsWith(root.href),
    `Corpus pin escapes its root: ${reference.path}`,
  );
  const bytes =
    baseOf(reference) === "conformance"
      ? readCorpusArtifact(reference.path)
      : readFileSync(url);
  assert.equal(
    hash(bytes),
    reference.sha256,
    `Frozen artifact changed: ${reference.path}`,
  );
  if (reference.byteLength !== undefined) {
    assert.equal(bytes.length, reference.byteLength, reference.path);
  }
  return bytes;
}
export const readJson = (reference) => JSON.parse(readPinned(reference));

// Fixed recorded scopes, never filesystem discovery or golden regeneration.
const indices = [
  [
    "supplemental/conditional/provenance.json",
    "627672609828c58b6a5b2bdc3674cf243bde4fea062fb1b9ffe84f04a57e89f8",
  ],
  [
    "supplemental/field-contract/provenance-index.json",
    "551b1a9fa54e7fae765ab1167e5a89f02b67973ddcf6143c21639e4af2aca2ca",
  ],
  [
    "supplemental/mapping-counterexamples/provenance-index.json",
    "d3faacaded67d017d8f8d590fea87543e684578764d1a2af6889448e6db8f20c",
  ],
  [
    "supplemental/mapping-counterexamples/auditor-v2/provenance-index.json",
    "ac480871481f5c3c9f84a01cbcffa905054bd5eb469c74b56d6b1c83b50ac689",
  ],
];
for (const [path, sha256] of indices) {
  const reference = { path, sha256 };
  register(reference);
  for (const artifact of readJson(reference).artifacts) {
    register(artifact);
  }
}
for (const [path, sha256] of [
  [
    "negative-manifest.json",
    "9d989895c553ab121eff6bd10443d33b705f4be073d4b11073f0fba4bb6c09ed",
  ],
  [
    "supplemental/negative/manifest.json",
    "b7f6d60f8ba05c2c4a9e3fe6f2fe97f73b5c89a1ad656bf1ed8b06f49e4893a3",
  ],
]) {
  register({ path, sha256 });
}

const pairManifestPaths = [
  "core",
  "value-state",
  "derived",
  "branch",
  "distinction",
  "binding-correction",
].map((name) => `supplemental/mapping-counterexamples/${name}-manifest.json`);
const positiveManifestPaths = [
  "supplemental/amended-policy/manifest.json",
  "supplemental/conditional/manifest.json",
  "supplemental/conditional/additional-manifest.json",
  "supplemental/conditional/completion-manifest.json",
  "supplemental/conditional/scope-manifest.json",
  "supplemental/field-contract/positive-manifest.json",
  "supplemental/field-contract/additional-positive-manifest.json",
  "supplemental/field-contract/state-identity-manifest.json",
  ...pairManifestPaths,
];
export const positives = positiveManifestPaths.flatMap((manifest) =>
  readJson(manifest).vectors.map((vector) => ({ ...vector, manifest })),
);
export const positiveById = new Map(
  positives.map((vector) => [vector.id, vector]),
);
assert.equal(
  positives.length,
  859,
  "Full independently frozen positive denominator",
);
assert.equal(
  positiveById.size,
  positives.length,
  "Positive IDs must be unique",
);

const pairs = new Map();
for (const vector of positives.filter((entry) =>
  pairManifestPaths.includes(entry.manifest),
)) {
  assert.ok(
    vector.pair && ["before", "after"].includes(vector.side),
    vector.id,
  );
  if (!pairs.has(vector.pair)) {
    pairs.set(vector.pair, { id: vector.pair });
  }
  const pair = pairs.get(vector.pair);
  assert.ok(!pair[vector.side], `Duplicate pair side: ${vector.id}`);
  pair[vector.side] = vector;
}
export const mappingPairs = [...pairs.values()];
assert.equal(mappingPairs.length, 321);
for (const pair of mappingPairs) {
  assert.ok(pair.before && pair.after, pair.id);
}
export const fieldAccounting = readJson(
  "supplemental/mapping-counterexamples/field-accounting.json",
);
assert.equal(fieldAccounting.entries.length, 343);

const fieldNegatives = readJson(
  "supplemental/field-contract/negative-manifest.json",
).vectors;
const fieldIds = new Set(fieldNegatives.map(({ id }) => id));
const historicalNegatives = [
  ...readJson("negative-manifest.json").vectors,
  ...readJson("supplemental/negative/manifest.json").vectors,
  ...readJson("supplemental/conditional/negative-manifest.json").vectors,
  ...readJson(
    "supplemental/field-contract/early-negative-manifest.json",
  ).vectors.filter(({ id }) => !fieldIds.has(id)),
  ...fieldNegatives,
  ...readJson("supplemental/field-contract/semantic-negative-manifest.json")
    .vectors,
  ...readJson("supplemental/field-contract/semantic-overlap-manifest.json")
    .vectors,
];
const activeNegatives = new Map(
  historicalNegatives.map((vector) => [vector.id, vector]),
);
assert.equal(
  activeNegatives.size,
  historicalNegatives.length,
  "Unexpected negative ID collision",
);
export const cameraOverlay = readJson(
  "supplemental/accepted-protocol-v2/camera-corrections-manifest.json",
);
readPinned(cameraOverlay.authority);
const predecessor = readJson(cameraOverlay.predecessor);
assert.equal(cameraOverlay.vectors.length, 5);
for (const active of cameraOverlay.vectors) {
  const previous = predecessor.vectors.find(({ id }) => id === active.id);
  assert.ok(previous, active.id);
  assert.equal(
    hash(JSON.stringify(previous, null, 2) + "\n"),
    active.replaces.recordSha256,
    active.id,
  );
  assert.deepEqual(active.historical.predecessorRecord, previous);
  const originalManifest = readJson(previous.correction.historicalManifest);
  const original = originalManifest.vectors.find(({ id }) => id === active.id);
  assert.ok(original, active.id);
  assert.equal(
    hash(JSON.stringify(original, null, 2) + "\n"),
    previous.correction.historicalRecordSha256,
    active.id,
  );
  assert.deepEqual(activeNegatives.get(active.id), original);
  assert.deepEqual(active.input, original.input);
  assert.equal(active.operation, original.operation);
  assert.equal(active.profile, original.profile);
  assert.equal(active.expectedError, previous.expectedError);
  assert.equal(active.activeValidationStage, 4);
  // Replace the active record; historical reasons/rules are never spread into it.
  activeNegatives.set(active.id, active);
}
export const prefixNegatives = readJson(
  "supplemental/accepted-protocol-v1/prefix-negative-manifest.json",
).vectors;
export const negatives = [...activeNegatives.values(), ...prefixNegatives];
assert.equal(new Set(negatives.map(({ id }) => id)).size, negatives.length);
export const editingManifest = readJson(
  "supplemental/editing-v1/manifest.json",
);
export const frozenPins = [...pins.values()];
