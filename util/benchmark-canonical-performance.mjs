import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";
import { createCanonicalVowlScene } from "../src/app/js/controller/canonicalVowlScene.js";
import {
  createOntologyInspector,
  prepareOntologySearch,
} from "../src/app/js/controller/ontologyInspector.js";
import { PlainLink } from "../src/webvowl/js/elements/links/PlainLink.js";

const baseline = process.argv[2];
const output = process.argv[3];
const allocationOnly = process.argv.includes("--allocation-only");
const equivalenceOnly = process.argv.includes("--equivalence-only");
if (!baseline || !output || !globalThis.gc)
  throw new Error(
    "Usage: node --expose-gc util/benchmark-canonical-performance.mjs <baseline-commit> <absolute-result.json>",
  );
const root = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const paths = [
  "src/app/js/controller/canonicalVowlScene.js",
  "src/app/js/controller/ontologyInspector.js",
  "src/webvowl/js/elements/links/PlainLink.js",
];
const sources = [];
async function previous(path) {
  const source = execFileSync("git", ["show", `${baseline}:${path}`], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  sources.push({
    path,
    baselineSha256: sha256(source),
    candidateSha256: sha256(
      readFileSync(new URL(`../${path}`, import.meta.url)),
    ),
  });
  const url = new URL(`../${path}`, import.meta.url);
  const resolved = source.replace(
    /from\s+"([^"]+)"/g,
    (_, specifier) =>
      `from ${JSON.stringify(specifier.startsWith(".") ? new URL(specifier, url).href : import.meta.resolve(specifier))}`,
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(resolved).toString("base64")}`
  );
}
const oldScene = (await previous(paths[0])).createCanonicalVowlScene;
const oldInspector = (await previous(paths[1])).createOntologyInspector();
const OldLink = (await previous(paths[2])).PlainLink;
const inspector = createOntologyInspector();
if (!allocationOnly && !equivalenceOnly) await assertQuiescentMachine();
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
function measure(operation) {
  const start = performance.now();
  const value = operation();
  return { value, ms: performance.now() - start };
}
async function paired(before, after) {
  before();
  after();
  const samples = { baseline: [], candidate: [] };
  for (let i = 0; i < 9; i++) {
    for (const name of i % 2
      ? ["candidate", "baseline"]
      : ["baseline", "candidate"])
      samples[name].push(measure(name === "baseline" ? before : after).ms);
  }
  return Object.fromEntries(
    Object.entries(samples).map(([name, values]) => [
      name,
      {
        medianMs: quantile(values, 0.5),
        p95Ms: quantile(values, 0.95),
        samplesMs: values,
      },
    ]),
  );
}
const results = {
  baseline,
  sources,
  candidateHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  node: process.version,
  lockSha256: sha256(
    readFileSync(new URL("../package-lock.json", import.meta.url)),
  ),
  scope:
    "Paired isolated scene and search-owner boundaries; Node equal-live-link allocation with explicit GC. Not browser latency, canonical admission of synthetic records, or a heap-retainer proof.",
  timingStatus:
    allocationOnly || equivalenceOnly
      ? "not-run: machine-contention; explicit non-timing mode"
      : "paired-after-quiescence-preflight",
  scene: [],
  search: [],
  links: [],
};
for (const size of allocationOnly ? [] : [1000, 10000]) {
  const occurrences = Array.from({ length: size }, (_, i) => ({
    id: `n${i}`,
    kind: "class-node",
  }));
  const baselineScene = oldScene(occurrences, { loadGeneration: 1 });
  const candidateScene = createCanonicalVowlScene(occurrences, {
    loadGeneration: 1,
  });
  const changes = occurrences.map(({ id }, i) => ({
    reference: baselineScene.reference(id),
    position: { x: i, y: -i },
    pinned: i % 2 === 0,
  }));
  const edit = {
    occurrences,
    correspondence: occurrences.map(({ id }) => ({
      previous: id,
      current: id,
    })),
  };
  baselineScene.arrange(changes);
  candidateScene.arrange(changes);
  assert.deepEqual(candidateScene.snapshot(), baselineScene.snapshot());
  if (equivalenceOnly) {
    assert.deepEqual(
      candidateScene.prepareEdit(edit).preview(),
      baselineScene.prepareEdit(edit).preview(),
    );
    results.scene.push({ size, equivalent: true });
    continue;
  }
  const arrange = await paired(
    () => baselineScene.arrange(changes),
    () => candidateScene.arrange(changes),
  );
  const reconcile = await paired(
    () => baselineScene.prepareEdit(edit).preview(),
    () => candidateScene.prepareEdit(edit).preview(),
  );
  assert.deepEqual(
    candidateScene.prepareEdit(edit).preview(),
    baselineScene.prepareEdit(edit).preview(),
  );
  results.scene.push({ size, arrange, reconcile });
}
for (const size of allocationOnly ? [] : [1000, 10000, 100000]) {
  const snapshot = {
    loadGeneration: 1,
    relationGroups: [],
    datatypeRecords: [],
    propertyRecords: [],
    individualRecords: [],
    classRecords: Array.from({ length: size }, (_, i) => ({
      ontologyElementReference: {
        kind: "class",
        roleKind: "class",
        iri: `urn:node:${i}`,
      },
      labelRecords: [{ text: `Node ${i}`, languageTag: "en" }],
      equivalentClassReferences: [],
      superclassReferences: [],
      disjointClassReferences: [],
    })),
    retainedFacts: { payload: new Uint8Array(1024 * 1024) },
  };
  const request = {
    query: "Node 42",
    limit: 25,
    language: "en",
    visibleRenderedGraphSnapshot: {
      loadGeneration: 1,
      visibleElementReferences: [],
      visibleRelationshipReferences: [],
    },
  };
  const build = equivalenceOnly
    ? { value: prepareOntologySearch(snapshot, inspector) }
    : measure(() => prepareOntologySearch(snapshot, inspector));
  const prepared = build.value;
  const before = () =>
    oldInspector.findOntologyElements({
      ...request,
      ontologyInspectionSnapshot: structuredClone(snapshot),
    });
  const after = () => prepared.findOntologyElements(request);
  assert.deepEqual(after(), before());
  if (equivalenceOnly) {
    results.search.push({ size, equivalent: true });
    continue;
  }
  const queries = await paired(before, after);
  results.search.push({ size, preparationMs: build.ms, queries });
}
const methods = [
  "layers",
  "layerIndex",
  "loops",
  "loopIndex",
  "domain",
  "range",
  "label",
  "linkParts",
  "pathObj",
];
const node = {
  equals(other) {
    return this === other;
  },
};
const property = { inverse: () => null };
function allocation(Constructor, size) {
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const links = Array.from(
    { length: size },
    () => new Constructor(node, node, property),
  );
  globalThis.gc();
  const retainedHeapDeltaBytes = process.memoryUsage().heapUsed - before;
  const functions = new Set();
  for (const link of links)
    for (const method of methods) functions.add(link[method]);
  return { retainedHeapDeltaBytes, pilotFunctionObjects: functions.size };
}
for (const size of equivalenceOnly ? [] : [1000, 10000, 100000]) {
  const row = { size };
  for (const [name, Constructor] of [
    ["baseline", OldLink],
    ["candidate", PlainLink],
  ]) {
    row[name] = allocation(Constructor, size);
    globalThis.gc();
  }
  results.links.push(row);
}
writeFileSync(output, JSON.stringify(results, null, 2) + "\n", { flag: "wx" });
process.stdout.write(
  JSON.stringify(
    {
      output,
      scene: results.scene.map(({ size, arrange, equivalent }) => ({
        size,
        equivalent,
        baselineMs: arrange?.baseline.medianMs,
        candidateMs: arrange?.candidate.medianMs,
      })),
      search: results.search.map(({ size, queries, equivalent }) => ({
        size,
        equivalent,
        baselineMs: queries?.baseline.medianMs,
        candidateMs: queries?.candidate.medianMs,
      })),
      links: results.links,
    },
    null,
    2,
  ) + "\n",
);
