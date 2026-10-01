// SPDX-License-Identifier: AGPL-3.0-only
// Verify explicit frozen entries; do not discover or rewrite future additions.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { bundle, here, hash } from "./support.mjs";
import { readCorpusArtifact } from "../../storage.mjs";
const repository = resolve(bundle, "../../.."),
  index = JSON.parse(await readFile(resolve(here, "provenance-index.json")));
for (const entry of index.artifacts) {
  const root = entry.base === "repository" ? repository : bundle;
  const path = resolve(root, entry.path),
    suffix = relative(root, path);
  assert(
    suffix && !suffix.startsWith("..") && !isAbsolute(suffix),
    `Outside explicit scope: ${entry.path}`,
  );
  const bytes =
    root === bundle ? readCorpusArtifact(entry.path) : await readFile(path);
  assert.equal(hash(bytes), entry.sha256, `${entry.base}/${entry.path}`);
  assert.equal(bytes.length, entry.byteLength, `${entry.path} byte length`);
}
console.log(
  JSON.stringify({
    explicitFrozenArtifacts: index.artifacts.length,
    writes: 0,
    filesystemDiscovery: false,
  }),
);
