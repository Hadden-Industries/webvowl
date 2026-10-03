// SPDX-License-Identifier: AGPL-3.0-only
// Check physical storage and, optionally, exact preservation against Git objects.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createCorpusReader, fixtureBundle } from "../conformance/storage.mjs";

const rootUrl = new URL("../conformance/", import.meta.url);
const root = fileURLToPath(rootUrl);
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const prefix = "packages/vowl/conformance/";
const inventory = () =>
  JSON.parse(readFileSync(resolve(root, "storage-inventory.json")));

/** Verify all relocated members and containers, without generating expectations. */
export function verifyCorpusStorage() {
  const scope = inventory();
  assert.equal(scope.format, "canonical-vowl-corpus-storage-inventory/1");
  assert.equal(scope.artifacts.length, scope.artifactCount);
  assert.equal(scope.bundles.length, scope.bundleCount);
  const recorded = new Map(scope.artifacts.map((entry) => [entry.path, entry]));
  assert.equal(recorded.size, scope.artifactCount);
  const actualMembers = new Set();
  for (const pin of scope.bundles) {
    const bytes = readFileSync(resolve(root, pin.path));
    assert.equal(hash(bytes), pin.sha256, pin.path);
    assert.equal(bytes.length, pin.byteLength, pin.path);
    const bundle = JSON.parse(bytes);
    assert.equal(bundle.artifacts.length, pin.members);
    for (const entry of bundle.artifacts) {
      assert(!actualMembers.has(entry.path), entry.path);
      actualMembers.add(entry.path);
      assert(recorded.has(entry.path), entry.path);
      assert.equal(recorded.get(entry.path).bundle, pin.path, entry.path);
    }
  }
  assert.equal(actualMembers.size, recorded.size);
  const read = createCorpusReader(rootUrl);
  for (const entry of scope.artifacts) {
    assert.equal(fixtureBundle(entry.path), entry.bundle, entry.path);
    assert(
      !existsSync(resolve(root, entry.path)),
      `Obsolete loose fixture: ${entry.path}`,
    );
    const bytes = read(entry.path);
    assert.equal(hash(bytes), entry.sha256, entry.path);
    assert.equal(bytes.length, entry.byteLength, entry.path);
  }
  return {
    artifacts: recorded.size,
    bundles: scope.bundles.length,
    looseCopies: 0,
  };
}

function baselineFiles(commit) {
  const tree = execFileSync("git", ["ls-tree", "-rz", commit, "--", prefix], {
    cwd: repository,
    maxBuffer: 8 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [header, path] = line.split("\t");
      const [mode, type, oid] = header.split(" ");
      assert.equal(mode, "100644", path);
      assert.equal(type, "blob", path);
      return { path: path.slice(prefix.length), oid };
    });
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    cwd: repository,
    input: tree.map(({ oid }) => oid).join("\n") + "\n",
    maxBuffer: 128 * 1024 * 1024,
  });
  let offset = 0;
  const files = new Map();
  for (const entry of tree) {
    const end = bytes.indexOf(10, offset);
    const [oid, type, size] = bytes.subarray(offset, end).toString().split(" ");
    assert.equal(oid, entry.oid);
    assert.equal(type, "blob");
    const value = bytes.subarray(end + 1, end + 1 + Number(size));
    assert.equal(value.length, Number(size));
    files.set(entry.path, value);
    offset = end + 1 + Number(size) + 1;
  }
  assert.equal(offset, bytes.length);
  return files;
}

/** Compare every original artifact with the checkpoint, allowing metadata pin changes only. */
export function verifyGitPreservation() {
  const scope = inventory();
  return verifyCorpusPreservation({
    scope,
    before: baselineFiles(scope.baselineCommit),
    read: createCorpusReader(rootUrl),
  });
}

/** Check a supplied immutable baseline and reader, including verifier fault controls. */
export function verifyCorpusPreservation({ scope, before, read }) {
  assert.equal(before.size, scope.baselineCorpusFiles);
  const originalInventory = [...before].map(([path, bytes]) => ({
    path,
    sha256: hash(bytes),
    byteLength: bytes.length,
  }));
  originalInventory.sort((a, b) => (a.path < b.path ? -1 : 1));
  assert.equal(
    hash(JSON.stringify(originalInventory)),
    scope.baselineInventorySha256,
  );
  assert.deepEqual(
    scope.artifacts.map(({ path }) => path).sort(),
    [...before.keys()].filter((path) => fixtureBundle(path)).sort(),
    "Bundled inventory must match the original fixture set",
  );
  const changed = new Map();
  for (const [path, bytes] of before) {
    const after = read(path);
    if (!after.equals(bytes)) {
      assert.equal(fixtureBundle(path), null, `Changed fixture: ${path}`);
      changed.set(path, after);
    }
  }
  const updatedHashes = new Map();
  for (const [path, bytes] of changed) {
    const oldHash = hash(before.get(path)),
      newHash = hash(bytes);
    if (updatedHashes.has(oldHash))
      assert.equal(updatedHashes.get(oldHash), newHash, path);
    updatedHashes.set(oldHash, newHash);
  }
  const archivedInventory =
    "supplemental/mapping-counterexamples/history/field-accounting.pre-storage.json";
  const originalAccounting =
    "supplemental/mapping-counterexamples/field-accounting.json";
  assert.deepEqual(read(archivedInventory), before.get(originalAccounting));

  let archiveRelocations = 0,
    cameraRecords = 0;
  function expectedMetadata(value) {
    if (Array.isArray(value)) return value.map(expectedMetadata);
    if (!value || typeof value !== "object") return value;
    const result = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        expectedMetadata(child),
      ]),
    );
    if (typeof value.path === "string" && typeof value.sha256 === "string") {
      const original = before.get(value.path);
      if (
        original &&
        changed.has(value.path) &&
        value.sha256 === hash(original)
      ) {
        const actual = changed.get(value.path);
        result.sha256 = hash(actual);
        if (Object.hasOwn(value, "byteLength")) {
          assert.equal(value.byteLength, original.length, value.path);
          result.byteLength = actual.length;
        }
      }
    }
    if (value.replaces?.recordSha256 && value.historical?.predecessorRecord) {
      cameraRecords++;
      assert.equal(
        value.replaces.recordSha256,
        hash(
          JSON.stringify(value.historical.predecessorRecord, null, 2) + "\n",
        ),
      );
      result.replaces.recordSha256 = hash(
        JSON.stringify(result.historical.predecessorRecord, null, 2) + "\n",
      );
    }
    return result;
  }
  const metadata = [],
    code = [],
    documentation = [];
  const readerChanges = new Set([
    "supplemental/field-contract/derive-provenance.mjs",
    "supplemental/field-contract/support.mjs",
    "supplemental/mapping-counterexamples/auditor-v2/derive-provenance.mjs",
    "supplemental/mapping-counterexamples/auditor-v2/support.mjs",
    "supplemental/mapping-counterexamples/auditor-v2/verify.mjs",
    "supplemental/mapping-counterexamples/derive-provenance.mjs",
    "supplemental/mapping-counterexamples/source-pin-cleanup.mjs",
    "supplemental/mapping-counterexamples/support.mjs",
    "supplemental/mapping-counterexamples/verify.mjs",
  ]);
  const pinOnlyChanges = new Set([
    "supplemental/accepted-protocol-v1/derive-prefix.mjs",
    "supplemental/accepted-protocol-v1/derive.mjs",
    "supplemental/accepted-protocol-v2/derive.mjs",
    "supplemental/mapping-counterexamples/auditor-v2/derive.mjs",
    "supplemental/mapping-counterexamples/derive-core.mjs",
  ]);
  for (const [path, bytes] of changed) {
    if (path.endsWith(".mjs")) {
      if (!readerChanges.has(path)) {
        assert(pinOnlyChanges.has(path), `Unexpected oracle change: ${path}`);
        assert.equal(
          bytes.toString(),
          before
            .get(path)
            .toString()
            .replace(/[a-f0-9]{64}/g, (pin) => updatedHashes.get(pin) ?? pin),
          `Unexpected oracle code change: ${path}`,
        );
      }
      code.push(path);
      continue;
    }
    if (path === "README.md") {
      documentation.push(path);
      continue;
    }
    assert(path.endsWith(".json"), `Unexpected changed evidence: ${path}`);
    const oldValue = JSON.parse(before.get(path)),
      newValue = JSON.parse(bytes);
    if (
      path === "supplemental/mapping-counterexamples/source-pin-cleanup-v1.json"
    ) {
      assert.equal(oldValue.current.inventory.path, originalAccounting);
      assert.deepEqual(newValue.current.inventory, {
        ...oldValue.current.inventory,
        path: archivedInventory,
      });
      oldValue.current.inventory.path = archivedInventory;
      archiveRelocations++;
    }
    if (path.endsWith("/provenance-index.json")) {
      const additions = newValue.artifacts.filter((entry) =>
        ["storage.mjs", archivedInventory].includes(entry.path),
      );
      const expectedAdditions = ["storage.mjs"];
      if (path === "supplemental/mapping-counterexamples/provenance-index.json")
        expectedAdditions.push(archivedInventory);
      assert.deepEqual(
        additions.map((entry) => entry.path).sort(),
        expectedAdditions.sort(),
        path,
      );
      for (const entry of additions) {
        const bytes = read(entry.path);
        assert.deepEqual(entry, {
          ...(path === "supplemental/field-contract/provenance-index.json"
            ? {}
            : { base: "conformance" }),
          path: entry.path,
          sha256: hash(bytes),
          byteLength: bytes.length,
        });
      }
      newValue.artifacts = newValue.artifacts.filter(
        (entry) => !additions.includes(entry),
      );
      if (newValue.counts && Object.hasOwn(newValue.counts, "artifacts")) {
        newValue.counts.artifacts -= additions.length;
        newValue.counts.priorWitnessesOrAuthorities -= additions.length;
      }
      if (
        newValue.counts &&
        Object.hasOwn(newValue.counts, "explicitArtifacts")
      ) {
        newValue.counts.explicitArtifacts -= additions.length;
        newValue.counts.conformanceArtifacts -= additions.length;
      }
    }
    assert.deepEqual(
      newValue,
      expectedMetadata(oldValue),
      `Non-checksum metadata change: ${path}`,
    );
    metadata.push(path);
  }
  assert.equal(archiveRelocations, 1);
  assert.equal(cameraRecords, 5);
  return {
    baselineCommit: scope.baselineCommit,
    originalFiles: before.size,
    byteIdenticalArtifacts: before.size - changed.size,
    checksumOnlyMetadata: metadata.length,
    codeForReview: code,
    documentationForReview: documentation,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert(
    process.argv.length === 2 ||
      (process.argv.length === 3 && process.argv[2] === "--against-git"),
  );
  process.stdout.write(
    JSON.stringify({
      ...verifyCorpusStorage(),
      ...(process.argv.includes("--against-git")
        ? verifyGitPreservation()
        : {}),
    }) + "\n",
  );
}
