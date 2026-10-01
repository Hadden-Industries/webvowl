// SPDX-License-Identifier: AGPL-3.0-only
// Deliberately NONCONFORMING A8 acceptance probe; never a positive canonical oracle.
// Reuses only this independent producer's own mapping, changing its work ceiling
// in an in-memory module. The normative producer and pinned fixtures are unchanged.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { extendedSources } from "./extended-sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const directory = resolve(here, "../experiments/rdfc-budget-probe");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const original = await readFile(resolve(here, "producer.mjs"), "utf8");
const edits = [
  [
    'from "canonicalize"',
    `from ${JSON.stringify(import.meta.resolve("canonicalize"))}`,
  ],
  [
    'from "rdf-canonize"',
    `from ${JSON.stringify(import.meta.resolve("rdf-canonize"))}`,
  ],
  [
    "export async function produce(source, profile)",
    "export async function produce(source, profile, experimentalBudget)",
  ],
  [
    "maxDeepIterations: Math.min(records.size + auxiliary, 100000)",
    "maxDeepIterations: experimentalBudget",
  ],
];
let experimental = original;
for (const [before, after] of edits) {
  assert.equal(
    experimental.split(before).length - 1,
    1,
    `Experimental transformation anchor: ${before}`,
  );
  experimental = experimental.replace(before, after);
}
const { produce } = await import(
  "data:text/javascript;base64," + Buffer.from(experimental).toString("base64")
);
const vector = extendedSources.find(
  (candidate) => candidate.id === "per-property-datatype",
);
const attempts = [];
let baseline;
async function probe(budget) {
  assert.ok(Number.isInteger(budget) && budget >= 0 && budget <= 1000);
  const start = performance.now();
  try {
    const result = await produce(vector.source, vector.profile, budget);
    if (!baseline) baseline = result;
    assert.equal(result.mappedNQuads, baseline.mappedNQuads);
    assert.equal(result.canonicalNQuads, baseline.canonicalNQuads);
    assert.deepEqual(result.bytes, baseline.bytes);
    attempts.push({
      budget,
      outcome: "success",
      elapsedMs: Number((performance.now() - start).toFixed(3)),
      canonicalNQuadsSha256: sha256(result.canonicalNQuads),
      canonicalBytesSha256: sha256(result.bytes),
    });
    return true;
  } catch (error) {
    assert.match(error.message, /^Maximum deep iterations exceeded \(\d+\)\.$/);
    attempts.push({
      budget,
      outcome: "resource-limit",
      elapsedMs: Number((performance.now() - start).toFixed(3)),
      rawMessage: error.message,
    });
    return false;
  }
}
assert.equal(
  await probe(37),
  false,
  "Reproduce exact normative A8 ceiling failure",
);
assert.equal(await probe(1000), true, "Bounded exploratory ceiling");
let rejected = 37;
let accepted = 1000;
while (accepted - rejected > 1) {
  const middle = Math.floor((accepted + rejected) / 2);
  if (await probe(middle)) accepted = middle;
  else rejected = middle;
}
for (let repeat = 0; repeat < 3; repeat++) {
  assert.equal(await probe(rejected), false);
  assert.equal(await probe(accepted), true);
}
assert.equal(await probe(0), false, "Graph actually requires deep comparison");
assert.equal(baseline.blankNodeCount, 37);
assert.equal(baseline.quadCount, 118);
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "mapped.nq"), baseline.mappedNQuads);
await writeFile(resolve(directory, "canonical.nq"), baseline.canonicalNQuads);
const report = {
  status: "experimental-nonconforming-A8-budget-probe",
  normativePolicyChanged: false,
  command: "node packages/vowl/conformance/oracle/probe-rdfc-budget.mjs",
  date: "2026-09-30",
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  sourceFixture: "vectors/per-property-datatype/source.json",
  independentProducerSha256: sha256(original),
  experimentalTransformedProducerSha256: sha256(experimental),
  dependency: "rdf-canonize@5.0.0",
  blankNodes: 37,
  quads: 118,
  normativeBudget: 37,
  smallestSuccessfulBudget: accepted,
  largestFailingBudget: rejected,
  confirmationPairs: 3,
  mappedNQuadsSha256: sha256(baseline.mappedNQuads),
  canonicalNQuadsSha256: sha256(baseline.canonicalNQuads),
  attempts,
  limitation:
    "Successful exploratory results exceed normative A8 policy and are not admitted positive Canonical VOWL fixtures. The source remains an expected bounded rejection. Minimum measured only for this exact dataset and dependency.",
};
await writeFile(
  resolve(directory, "result.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
