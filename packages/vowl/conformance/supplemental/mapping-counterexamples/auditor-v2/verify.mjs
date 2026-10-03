// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { bundle, here, hash } from "./support.mjs";
import { readCorpusArtifact } from "../../../storage.mjs";
const repository = resolve(bundle, "../../.."),
  index = JSON.parse(await readFile(resolve(here, "provenance-index.json")));
for (const entry of index.artifacts) {
  const root = entry.base === "repository" ? repository : bundle,
    path = resolve(root, entry.path),
    suffix = relative(root, path);
  assert(suffix && !suffix.startsWith("..") && !isAbsolute(suffix));
  const bytes =
    root === bundle ? readCorpusArtifact(entry.path) : await readFile(path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  assert.equal(bytes.length, entry.byteLength, entry.path);
}
console.log(
  JSON.stringify({
    explicitArtifactPins: index.artifacts.length,
    writes: 0,
    filesystemDiscovery: false,
  }),
);
