// SPDX-License-Identifier: AGPL-3.0-only
// No-write verification of the additive recorded scope, followed by old scopes.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { bundle, readPinned, repository } from "./support.mjs";
assert.equal(
  process.argv.length,
  2,
  "Usage: node verify.mjs; no write mode exists",
);
const index = JSON.parse(
  await readFile(
    resolve(bundle, "supplemental/field-contract/provenance-index.json"),
  ),
);
assert.equal(index.format, "canonical-vowl-field-contract-provenance/1");
assert.equal(index.artifacts.length, index.counts.artifacts);
const seen = new Set();
for (const entry of index.artifacts) {
  assert(
    entry.path &&
      !/[\\:]/.test(entry.path) &&
      entry.path
        .split("/")
        .every((part) => part && part !== "." && part !== ".."),
  );
  assert(!seen.has(entry.path), `Duplicate provenance entry ${entry.path}`);
  seen.add(entry.path);
  await readPinned(
    entry,
    entry.path.startsWith("docs/specs/") ||
      entry.path.startsWith("node_modules/")
      ? repository
      : bundle,
  );
}
console.log(
  JSON.stringify({
    fieldScopeRecordedFilesVerified: seen.size,
    filesystemDiscovery: false,
    writes: false,
  }),
);
await import("../review-resolution-v1/verify-frozen-scopes.mjs");
