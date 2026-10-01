// SPDX-License-Identifier: AGPL-3.0-only
// Versioned, read-only verification of recorded frozen scopes. Never discover
// corpus files recursively or regenerate an index from the current directory.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repository = resolve(bundle, "../../..");
const scopes = [
  {
    id: "baseline-supplemental",
    path: "supplemental/provenance-index.json",
    sha256: "8079159ae4fb579a000b109349120320e00781c5c03fa1bfa6eab75c6e394fa7",
    artifactCount: 83,
  },
  {
    id: "conditional-supplemental",
    path: "supplemental/conditional/provenance.json",
    sha256: "627672609828c58b6a5b2bdc3674cf243bde4fea062fb1b9ffe84f04a57e89f8",
    artifactCount: 17,
  },
];

const arguments_ = process.argv.slice(2);
assert(
  arguments_.length === 0 ||
    (arguments_.length === 1 && arguments_[0] === "--self-check"),
  "Usage: node verify-frozen-scopes.mjs [--self-check]; no write mode exists",
);

function absolutePath(path) {
  assert.equal(typeof path, "string", "Recorded path must be text");
  assert(
    path.length > 0 &&
      !path.includes("\\") &&
      !path.includes(":") &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
    `Recorded path must be a contained relative path: ${path}`,
  );
  const root =
    path.startsWith("docs/specs/") || path.startsWith("node_modules/")
      ? repository
      : bundle;
  return resolve(root, path);
}

function assertBytes(pin, bytes) {
  assert.match(pin.sha256, /^[a-f0-9]{64}$/, `Invalid SHA-256: ${pin.path}`);
  if (Object.hasOwn(pin, "byteLength")) {
    assert(
      Number.isSafeInteger(pin.byteLength) && pin.byteLength >= 0,
      `Invalid byte length: ${pin.path}`,
    );
    assert.equal(
      bytes.length,
      pin.byteLength,
      `Byte length mismatch: ${pin.path}`,
    );
  }
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    pin.sha256,
    `SHA-256 mismatch: ${pin.path}`,
  );
}

// Traverse only explicit metadata values, never the filesystem. Historical
// identity strings without a path are history, not current-file assertions.
function* recordedPins(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.path === "string" && typeof value.sha256 === "string") {
    yield value;
  }
  for (const child of Object.values(value)) yield* recordedPins(child);
}

const bytesByPath = new Map();
async function verify(pin, scopeFiles) {
  const path = absolutePath(pin.path);
  if (!bytesByPath.has(path)) bytesByPath.set(path, await readFile(path));
  const bytes = bytesByPath.get(path);
  assertBytes(pin, bytes);
  scopeFiles.add(path);
  return bytes;
}

const results = [];
for (const scope of scopes) {
  const scopeFiles = new Set();
  const bytes = await verify(scope, scopeFiles);
  const index = JSON.parse(bytes.toString("utf8"));
  assert.equal(index.artifacts.length, scope.artifactCount, scope.path);
  let explicitPinChecks = 1;
  for (const pin of recordedPins(index)) {
    await verify(pin, scopeFiles);
    explicitPinChecks++;
  }

  let manifests = 0;
  let vectorEntries = 0;
  for (const artifact of index.artifacts) {
    if (!/(?:^|\/)[^/]*manifest\.json$/.test(artifact.path)) continue;
    const manifest = JSON.parse(
      (await verify(artifact, scopeFiles)).toString("utf8"),
    );
    assert(Array.isArray(manifest.vectors), `No vectors: ${artifact.path}`);
    manifests++;
    vectorEntries += manifest.vectors.length;
    for (const pin of recordedPins(manifest)) {
      await verify(pin, scopeFiles);
      explicitPinChecks++;
    }
  }

  results.push({
    scope: scope.id,
    index: scope.path,
    sha256: scope.sha256,
    recordedArtifacts: index.artifacts.length,
    recordedManifests: manifests,
    vectorEntriesIncludingHistoricalOverlaps: vectorEntries,
    explicitPinChecks,
    uniqueFiles: scopeFiles.size,
  });
}

let selfCheck;
if (arguments_[0] === "--self-check") {
  for (const scope of scopes) {
    const bytes = bytesByPath.get(absolutePath(scope.path));
    const changedBytes = Buffer.from(bytes);
    changedBytes[0] ^= 1;
    assert.throws(() => assertBytes(scope, changedBytes), /SHA-256 mismatch/);
    assert.throws(
      () => assertBytes({ ...scope, byteLength: bytes.length + 1 }, bytes),
      /Byte length mismatch/,
    );
  }
  selfCheck = {
    inMemoryDigestMismatchesRejected: scopes.length,
    inMemoryLengthMismatchesRejected: scopes.length,
    filesystemMutations: 0,
  };
}

console.log(
  JSON.stringify({
    format: "canonical-vowl-frozen-scope-verification/1",
    mode: "explicit-recorded-entries-only",
    scopes: results,
    uniqueFiles: bytesByPath.size,
    writes: 0,
    selfCheck,
    result: "All recorded file identities match; no corpus semantics executed",
  }),
);
