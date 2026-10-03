// SPDX-License-Identifier: AGPL-3.0-only
// Experimental acceptance-budget measurement, deliberately outside A8 conformance.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { grammarSources } from "../grammar/sources.mjs";
import { profiles } from "../../oracle/producer.mjs";
import { extendedSources } from "../../oracle/extended-sources.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const original = await readFile(
  resolve(here, "../../oracle/producer.mjs"),
  "utf8",
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
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
let exploratory = original;
for (const [before, after] of edits) {
  assert.equal(exploratory.split(before).length - 1, 1);
  exploratory = exploratory.replace(before, after);
}
const { produce } = await import(
  "data:text/javascript;base64," + Buffer.from(exploratory).toString("base64")
);
function defaultedDataProperties(count) {
  const structural = {
    ontology: { imports: [], annotations: [] },
    subjects: [
      { id: "subject-Thing", iri: "http://www.w3.org/2002/07/owl#Thing" },
      {
        id: "subject-Literal",
        iri: "http://www.w3.org/2000/01/rdf-schema#Literal",
      },
    ],
    roles: [
      { id: "Thing", kind: "class", subject: "subject-Thing" },
      { id: "Literal", kind: "datatype", subject: "subject-Literal" },
    ],
    expressions: [],
    constructs: [],
    occurrences: [],
  };
  for (let index = 0; index < count; index++) {
    const id = `p${index}`;
    structural.subjects.push({
      id: `subject-${id}`,
      iri: `https://example.org/growth#${id}`,
    });
    structural.roles.push({
      id,
      kind: "data-property",
      subject: `subject-${id}`,
    });
    structural.occurrences.push(
      {
        id: `domain-${id}`,
        kind: "class-node",
        targets: ["Thing"],
        context: { kind: "property", properties: [id] },
      },
      {
        id: `range-${id}`,
        kind: "datatype-node",
        target: "Literal",
        context: { kind: "property", properties: [id] },
      },
      {
        id: `edge-${id}`,
        kind: "property-edge",
        properties: [id],
        from: `domain-${id}`,
        to: `range-${id}`,
      },
      {
        id: `label-${id}`,
        kind: "label",
        edge: `edge-${id}`,
        direction: "single",
      },
    );
  }
  return { structural };
}
const cases = [
  "disjoint-data-properties",
  "multiple-explicit-inverse-pairs",
].map((id) => {
  const found = grammarSources.find((value) => value.id === id);
  return {
    id,
    source: found.source,
    normativeBudget: found.expectedDeepIterations,
    repetitions: 3,
  };
});
cases.unshift({
  id: "original-per-property-datatype-current-producer",
  source: extendedSources.find((item) => item.id === "per-property-datatype")
    .source,
  normativeBudget: 37,
  repetitions: 3,
});
for (let count = 1; count <= 8; count++)
  cases.push({
    id: `defaulted-data-properties-${count}`,
    source: defaultedDataProperties(count),
    normativeBudget: 13 + 12 * count,
    repetitions: 1,
    count,
  });
const results = [];
let stopSeries = false;
for (const item of cases) {
  if (item.count && stopSeries) {
    results.push({
      id: item.id,
      status: "skipped-after-series-timeout-or-cap",
    });
    continue;
  }
  const attempts = [];
  let baseline;
  let terminated = false;
  async function probe(budget) {
    assert.ok(Number.isInteger(budget) && budget >= 0 && budget <= 100000);
    const start = performance.now();
    try {
      const output = await produce(item.source, profiles.structural, budget);
      if (!baseline) baseline = output;
      assert.equal(output.canonicalNQuads, baseline.canonicalNQuads);
      assert.deepEqual(output.bytes, baseline.bytes);
      attempts.push({
        budget,
        outcome: "success",
        elapsedMs: Number((performance.now() - start).toFixed(3)),
        canonicalNQuadsSha256: sha256(output.canonicalNQuads),
      });
      return true;
    } catch (error) {
      const resource = /^Maximum deep iterations exceeded \(\d+\)\.$/.test(
        error.message,
      );
      if (!resource) {
        terminated = true;
        attempts.push({
          budget,
          outcome: "timeout-or-unexpected-error",
          name: error.name,
          rawMessage: error.message,
          elapsedMs: Number((performance.now() - start).toFixed(3)),
        });
        return false;
      }
      attempts.push({
        budget,
        outcome: "resource-limit",
        rawMessage: error.message,
        elapsedMs: Number((performance.now() - start).toFixed(3)),
      });
      return false;
    }
  }
  const normativeSuccess = await probe(item.normativeBudget);
  const proposedBudget = Math.min(item.normativeBudget ** 2, 100000);
  const proposedSuccess = await probe(proposedBudget);
  let minimum;
  if (!terminated && (await probe(100000))) {
    let lo = -1;
    let hi = 100000;
    while (hi - lo > 1 && !terminated) {
      const middle = Math.floor((hi + lo) / 2);
      if (await probe(middle)) hi = middle;
      else lo = middle;
    }
    if (!terminated) {
      minimum = hi;
      for (let repeat = 0; repeat < item.repetitions; repeat++) {
        if (minimum > 0) assert.equal(await probe(minimum - 1), false);
        assert.equal(await probe(minimum), true);
      }
    }
  }
  if (item.count && (terminated || minimum === undefined)) stopSeries = true;
  const target = resolve(here, "raw", item.id);
  await mkdir(target, { recursive: true });
  const sourceBytes = JSON.stringify(item.source, null, 2) + "\n";
  await writeFile(resolve(target, "source.json"), sourceBytes);
  if (baseline) {
    await writeFile(resolve(target, "mapped.nq"), baseline.mappedNQuads);
    await writeFile(resolve(target, "canonical.nq"), baseline.canonicalNQuads);
    assert.equal(baseline.blankNodeCount, item.normativeBudget);
    if (item.count) assert.equal(baseline.quadCount, 34 + 42 * item.count);
  }
  const result = {
    id: item.id,
    status: minimum === undefined ? "threshold-unavailable" : "measured",
    sourceSha256: sha256(sourceBytes),
    normativeBudget: item.normativeBudget,
    normativeSuccess,
    proposedBudget,
    proposedSuccess,
    smallestSuccessfulBudget: minimum ?? null,
    absoluteProbeCeiling: 100000,
    perCallDeadlineMs: 10000,
    confirmationPairs: item.repetitions,
    ...(baseline
      ? {
          blankNodes: baseline.blankNodeCount,
          quads: baseline.quadCount,
          mappedNQuadsSha256: sha256(baseline.mappedNQuads),
          canonicalNQuadsSha256: sha256(baseline.canonicalNQuads),
        }
      : {}),
    attempts,
  };
  await writeFile(
    resolve(target, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  results.push(result);
  console.log(
    JSON.stringify({
      id: item.id,
      normativeBudget: item.normativeBudget,
      normativeSuccess,
      minimum: minimum ?? null,
      quads: baseline?.quadCount,
    }),
  );
}
const report = {
  status: "experimental-nonconforming-A8-budget-growth-probe",
  normativePolicyChanged: false,
  command:
    "node packages/vowl/conformance/supplemental/budget/probe-growth.mjs",
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  dependency: "rdf-canonize@5.0.0",
  frozenProducerSha256: sha256(original),
  probeSourceSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  transformedProducerSha256: sha256(exploratory),
  grammarRecipeSha256: sha256(
    await readFile(resolve(here, "../grammar/sources.mjs")),
  ),
  extendedRecipeSha256: sha256(
    await readFile(resolve(here, "../../oracle/extended-sources.mjs")),
  ),
  proposedPolicy:
    "min(totalAllocatedBlankNodes ** 2, rdfDeepIterations); default rdfDeepIterations 100000; caller upper bound remains 1000000; experimental only",
  cases: results,
  limitation:
    "These exploratory success thresholds do not admit inputs under current A8 or authorize a policy change. Only exact supplied graphs and this library/runtime are measured.",
};
await writeFile(
  resolve(here, "growth-results.json"),
  JSON.stringify(report, null, 2) + "\n",
);
