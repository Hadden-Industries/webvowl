// SPDX-License-Identifier: AGPL-3.0-only
// Corpus member paths identify evidence, independently of its physical storage.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const storageFormat = "canonical-vowl-fixture-bundle/1";
const fixtureNames = new Set([
  "source.json",
  "permuted-source.json",
  "document.json",
  "mapped.nq",
  "canonical.nq",
  "ids.json",
  "canonical.json",
]);
const families = ["field-contract", "mapping-counterexamples"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function memberPath(path) {
  assert.equal(typeof path, "string", "Corpus member path must be text");
  assert(
    path &&
      !/[\\:\0]/.test(path) &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
    `Invalid corpus member path: ${path}`,
  );
  return path;
}

/** Physical bundle for a fixture member, or null for ordinary corpus metadata/code. */
export function fixtureBundle(path) {
  memberPath(path);
  const family = families.find((name) =>
    path.startsWith(`supplemental/${name}/`),
  );
  if (!family || !fixtureNames.has(path.split("/").at(-1))) return null;
  // Stable buckets keep files reviewable and additions from reshuffling the corpus.
  const bucket = createHash("sha256").update(path).digest()[0] % 32;
  return `bundles/${family}-${String(bucket).padStart(2, "0")}.json`;
}

/**
 * Read native corpus members from their declared storage family. Packed members
 * must exist in their bundle: an old loose file is never a fallback. Expected
 * hashes in the independent manifests remain the authority for their contents.
 * Each call returns owned bytes, so a test cannot mutate cached expectations.
 */
export function createCorpusReader(root) {
  const directory = fileURLToPath(root);
  const bundles = new Map();
  return function readCorpusMember(path) {
    memberPath(path);
    const location = fixtureBundle(path);
    if (location === null) return readFileSync(resolve(directory, path));
    if (!bundles.has(location)) {
      const bundle = JSON.parse(readFileSync(resolve(directory, location)));
      assert.equal(bundle.format, storageFormat, location);
      assert(Array.isArray(bundle.artifacts), location);
      const entries = new Map();
      for (const entry of bundle.artifacts) {
        assert.equal(fixtureBundle(entry.path), location, entry.path);
        assert(
          !entries.has(entry.path),
          `Duplicate corpus member: ${entry.path}`,
        );
        assert(["utf8", "base64"].includes(entry.encoding), entry.path);
        assert.equal(typeof entry.text, "string", entry.path);
        const bytes = Buffer.from(entry.text, entry.encoding);
        assert.equal(bytes.toString(entry.encoding), entry.text, entry.path);
        assert.equal(bytes.length, entry.byteLength, entry.path);
        assert.equal(sha256(bytes), entry.sha256, entry.path);
        entries.set(entry.path, entry);
      }
      bundles.set(location, entries);
    }
    const entry = bundles.get(location).get(path);
    assert(entry, `Missing bundled corpus member: ${path}`);
    return Buffer.from(entry.text, entry.encoding);
  };
}

export const readCorpusArtifact = createCorpusReader(
  new URL("./", import.meta.url),
);
