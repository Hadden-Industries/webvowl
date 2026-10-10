// SPDX-License-Identifier: AGPL-3.0-only
// Versioned loader correction: compare JSON data within the executing realm.
// Native structuredClone can introduce host-realm prototypes under Jest.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { loadCorpus as historicalCorpus } from "../catalog.mjs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { hash, readPinned as readHistoricalPin } from "../support.mjs";

const require = createRequire(import.meta.url);
export async function readPinned(reference) {
  const historicalPrefix = "packages/vowl/node_modules/canonicalize/";
  if (
    reference.base !== "repository" ||
    !reference.path.startsWith(historicalPrefix)
  )
    return readHistoricalPin(reference);
  const relativePath = reference.path.slice(historicalPrefix.length);
  assert(["package.json", "lib/canonicalize.js"].includes(relativePath));
  const packageRoot = resolve(dirname(require.resolve("canonicalize")), "..");
  const bytes = await readFile(resolve(packageRoot, relativePath));
  assert.equal(hash(bytes), reference.sha256, reference.path);
  if (reference.byteLength !== undefined)
    assert.equal(bytes.length, reference.byteLength);
  return bytes;
}

export const sourceRevisionPin = {
  path: "supplemental/owl-mapping/source-v2/manifest.json",
  sha256: "84578b5c9abb5e37f3c39f8932dcb0711681ec18262cca2eebecdc0c8c99a68c",
};
export async function loadCorpus() {
  const revision = JSON.parse(await readPinned(sourceRevisionPin));
  const scope = JSON.parse(await readPinned(revision.previousScope));
  for (const reference of [...scope.artifacts, ...revision.producerSources])
    await readPinned(reference);
  const historical = await historicalCorpus();
  assert.equal(revision.vectors.length, historical.vectors.length);
  for (const vector of revision.vectors) {
    const old = historical.vectors.find(({ id }) => id === vector.id);
    assert(old, vector.id);
    const reconstructed = JSON.parse(JSON.stringify(vector));
    reconstructed.root.bytes = old.root.bytes;
    reconstructed.imports.forEach((entry, i) => {
      entry.bytes = old.imports[i].bytes;
    });
    assert.deepEqual(
      reconstructed,
      old,
      "Source revision must not change models, outputs or expectations",
    );
  }
  for (const change of revision.changes) {
    const before = await readPinned(change.before),
      after = await readPinned(change.after);
    const removed = Buffer.from(change.removal.utf8Text, "utf8");
    assert.equal(removed.length, change.removal.byteLength);
    assert.equal(hash(removed), change.removal.sha256);
    const offset = change.removal.byteOffset;
    assert.deepEqual(before.subarray(offset, offset + removed.length), removed);
    assert.deepEqual(
      Buffer.concat([
        after.subarray(0, offset),
        removed,
        after.subarray(offset),
      ]),
      before,
      "Exact original source reconstruction",
    );
    const vector = revision.vectors.find(({ id }) => id === change.vector);
    const input =
      change.input === "root"
        ? vector.root
        : vector.imports[Number(change.input.slice("import-".length))];
    assert.deepEqual(input.bytes, change.after);
  }
  const vectors = revision.vectors;
  const runs = vectors.flatMap((vector) =>
    vector.runs.map((run) => ({ id: `${vector.id}/${run.id}`, vector, run })),
  );
  return { revision, vectors, runs: [...runs, ...revision.prefixControls] };
}
