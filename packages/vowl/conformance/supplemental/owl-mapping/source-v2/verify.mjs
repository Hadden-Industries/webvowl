// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import process from "node:process";
import { loadCorpus, sourceRevisionPin } from "./catalog.mjs";
import { json, localPin, pin, readPinned } from "../support.mjs";

const corpus = await loadCorpus();
const artifacts = [
  sourceRevisionPin,
  corpus.revision.previousScope,
  ...corpus.revision.producerSources,
];
for (const change of corpus.revision.changes)
  artifacts.push(change.before, change.after);
for (const path of ["source-v2/catalog.mjs", "source-v2/verify.mjs"])
  artifacts.push(await localPin(path));
const unique = new Map();
for (const reference of artifacts) {
  const key = `${reference.base ?? "conformance"}:${reference.path}`;
  const old = unique.get(key);
  if (old) assert.equal(old.sha256, reference.sha256);
  else unique.set(key, reference);
  await readPinned(reference);
}
const receipt = await pin(
  "source-v2/provenance.json",
  json({
    format: "independent-canonical-vowl-owl-source-revision-provenance-v2",
    previousScope: corpus.revision.previousScope,
    sourceRevision: sourceRevisionPin,
    counts: {
      sourceReplacements: corpus.revision.changes.length,
      activeVectors: corpus.vectors.length,
      mappingRuns: 66,
      historicalPrefixRejections: 2,
      totalPublicRuns: corpus.runs.length,
      unchangedExpectedModels: corpus.vectors.filter(
        (vector) => vector.expected,
      ).length,
    },
    artifacts: [...unique.values()],
  }),
);
console.log(
  JSON.stringify(
    {
      scope: receipt,
      artifacts: unique.size,
      exactHistoricalInputReconstructions: corpus.revision.changes.length,
      unchangedExpectedModels: corpus.vectors.filter(
        (vector) => vector.expected,
      ).length,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
