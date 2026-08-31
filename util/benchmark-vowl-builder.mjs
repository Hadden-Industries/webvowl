import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus, release, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import process from "node:process";

import { OWLManager } from "owlapi/apibinding";
import { StringDocumentSource } from "owlapi/io";

import owl2vowl from "../src/owl2vowl/js/index.js";
import { VOWLBuilder } from "../src/owl2vowl/js/vowlBuilder.js";

import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";
import {
  generateVowlBenchmarkFixture,
  VOWL_BENCHMARK_GENERATOR_VERSION,
} from "./vowlBenchmarkFixtures.mjs";

await assertQuiescentMachine();

const RUN_COUNT = 5;
const SAMPLE_INTERVAL_MS = 5;
const WARMUP_COUNT = 1;
const LARGE_COUNT = 50_000;

const firstUseText = generateVowlBenchmarkFixture("rdfxml", { count: 100 });
const largeFunctionalText = generateVowlBenchmarkFixture("functional", {
  count: LARGE_COUNT,
});
const largeRdfXmlText = generateVowlBenchmarkFixture("rdfxml", {
  count: LARGE_COUNT,
});
const largeOntology =
  await OWLManager.createOWLOntologyManager().loadOntologyFromOntologyDocument(
    new StringDocumentSource(largeFunctionalText, {
      documentIRI: "urn:webvowl:benchmark:vowl-builder",
      fileName: "generated-vowl-builder-large.ofn",
    }),
  );

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const sample = async (operation) => {
  globalThis.gc?.();
  const startHeapBytes = process.memoryUsage().heapUsed;
  let peakHeapBytes = startHeapBytes;
  const sampler = setInterval(() => {
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
  }, SAMPLE_INTERVAL_MS);
  const startedAt = performance.now();
  try {
    await operation();
  } finally {
    clearInterval(sampler);
  }
  const wallMs = performance.now() - startedAt;
  const endHeapBytes = process.memoryUsage().heapUsed;
  peakHeapBytes = Math.max(peakHeapBytes, endHeapBytes);
  return {
    peakHeapBytes,
    peakHeapDeltaBytes: Math.max(0, peakHeapBytes - startHeapBytes),
    retainedHeapDeltaBytes: endHeapBytes - startHeapBytes,
    wallMs,
  };
};

const buildLargeOntology = async () => {
  const result = new VOWLBuilder().build(largeOntology);
  if (result.class.length !== LARGE_COUNT) {
    throw new Error("The builder benchmark produced an incomplete VOWL graph");
  }
};

const loadLargeRdfXml = async () => {
  const result = await owl2vowl(largeRdfXmlText, {
    fileName: "generated-rdfxml-large.rdf",
  });
  if (result.class.length !== LARGE_COUNT) {
    throw new Error("The adapter benchmark produced an incomplete VOWL graph");
  }
};

const firstUse = await sample(async () => {
  const result = await owl2vowl(firstUseText, {
    fileName: "first-use.rdf",
  });
  if (result.class.length !== 100) {
    throw new Error(
      "The first-use benchmark produced an incomplete VOWL graph",
    );
  }
});
const benchmarks = Object.freeze([
  {
    id: "generated-vowl-classes-large.builder-only",
    operation: buildLargeOntology,
  },
  {
    id: "generated-rdfxml-large.owlapi-to-vowl",
    operation: loadLargeRdfXml,
  },
]);

const results = [];
for (const benchmark of benchmarks) {
  for (let index = 0; index < WARMUP_COUNT; index += 1) {
    await sample(benchmark.operation);
  }
  const measurements = [];
  for (let index = 0; index < RUN_COUNT; index += 1) {
    measurements.push(await sample(benchmark.operation));
  }
  results.push({
    id: benchmark.id,
    measurements,
    median: {
      peakHeapBytes: median(
        measurements.map(({ peakHeapBytes }) => peakHeapBytes),
      ),
      peakHeapDeltaBytes: median(
        measurements.map(({ peakHeapDeltaBytes }) => peakHeapDeltaBytes),
      ),
      retainedHeapDeltaBytes: median(
        measurements.map(
          ({ retainedHeapDeltaBytes }) => retainedHeapDeltaBytes,
        ),
      ),
      wallMs: median(measurements.map(({ wallMs }) => wallMs)),
    },
  });
}

const packageLock = readFileSync(
  new URL("../package-lock.json", import.meta.url),
);
console.log(
  JSON.stringify(
    {
      environment: {
        architecture: process.arch,
        cpu: cpus()[0]?.model,
        logicalCpuCount: cpus().length,
        node: process.version,
        nodeArguments: process.execArgv,
        os: `${process.platform} ${release()}`,
        packageLockSha256: createHash("sha256")
          .update(packageLock)
          .digest("hex"),
        totalMemoryBytes: totalmem(),
      },
      firstUse: {
        inputBytes: Buffer.byteLength(firstUseText),
        measurement: firstUse,
        path: "installed owlapi -> manager -> RDF/XML -> RDF-to-OWL -> VOWLBuilder",
      },
      measuredOn: new Date().toISOString(),
      protocol: {
        aggregation: "median",
        fixture: {
          count: LARGE_COUNT,
          functionalBytes: Buffer.byteLength(largeFunctionalText),
          generator: VOWL_BENCHMARK_GENERATOR_VERSION,
          rdfXmlBytes: Buffer.byteLength(largeRdfXmlText),
        },
        garbageCollectionRequestedBeforeEachRun:
          typeof globalThis.gc === "function",
        heapSamplingIntervalMs: SAMPLE_INTERVAL_MS,
        measuredRuns: RUN_COUNT,
        warmups: WARMUP_COUNT,
      },
      results,
      schemaVersion: 1,
    },
    null,
    2,
  ),
);
