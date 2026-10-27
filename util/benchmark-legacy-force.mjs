import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { arch, cpus, platform, release } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { createLegacyForceSimulation } from "../src/webvowl/js/runtime/legacyForceSimulation.js";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";
import { summarizeSamples } from "./productionPerformance.mjs";
import {
  LEGACY_FORCE_FIXTURES,
  configureLegacyForce,
  createForceRandom,
  createLegacyForceFixture,
  legacyForceState,
} from "./legacyForceBenchmarkFixtures.mjs";

const { values } = parseArgs({
  options: {
    "baseline-ref": { type: "string" },
    fixture: { type: "string", multiple: true },
    runs: { type: "string", default: "20" },
    warmups: { type: "string", default: "3" },
    theta: { type: "string", default: "0.8" },
    "charge-distance": { type: "string", default: "Infinity" },
    output: { type: "string" },
    aa: { type: "boolean", default: false },
    diagnostic: { type: "boolean", default: false },
  },
});
const root = fileURLToPath(new URL("../", import.meta.url));
assert(
  values["baseline-ref"],
  "Supply an immutable baseline-ref for A/A and A/B comparisons",
);
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
const sha256 = (input) => createHash("sha256").update(input).digest("hex");
const sourcePath = "src/webvowl/js/runtime/legacyForceSimulation.js";
const treePath = "src/webvowl/js/runtime/legacyForceQuadtree.js";
const packedPath = "src/webvowl/js/runtime/legacyPackedForceKernel.js";
const runs = Number(values.runs);
const warmups = Number(values.warmups);
const theta = Number(values.theta);
const chargeDistance = Number(values["charge-distance"]);
assert(
  Number.isSafeInteger(runs) && runs > 0 && runs <= 100,
  "runs must be 1 through 100",
);
assert(
  Number.isSafeInteger(warmups) && warmups >= 0 && warmups <= 20,
  "warmups must be 0 through 20",
);
assert(
  Number.isFinite(theta) && theta > 0,
  "theta must be finite and positive",
);
assert(chargeDistance > 0, "charge-distance must be positive");
const fixtureIds = values.fixture ?? LEGACY_FORCE_FIXTURES.map(({ id }) => id);
assert(
  new Set(fixtureIds).size === fixtureIds.length,
  "fixture IDs must be unique",
);
fixtureIds.forEach((id) =>
  assert(
    LEGACY_FORCE_FIXTURES.some((item) => item.id === id),
    `Unknown fixture: ${id}`,
  ),
);

// Historical source is immutable input, never restored into the working tree.
// Only ESM dependency URLs are adapted; both variants use this exact D3 runtime.
async function baselineFactory() {
  if (!values["baseline-ref"])
    return { factory: createLegacyForceSimulation, reference: null };
  const revision = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${values["baseline-ref"]}^{commit}`,
  ).trim();
  const source = git("show", `${revision}:${sourcePath}`);
  const packed = source.includes('from "./legacyPackedForceKernel.js"');
  const dependencyPath = packed ? packedPath : treePath;
  const dependency = git("show", `${revision}:${dependencyPath}`);
  const dependencyImport = packed
    ? 'from "./legacyPackedForceKernel.js"'
    : 'from "./legacyForceQuadtree.js"';
  const moduleUrl = (text) =>
    `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
  assert(
    source.split('from "d3"').length === 2 &&
      source.split(dependencyImport).length === 2,
    "Historical import contract changed; inspect the baseline loader",
  );
  let adapted = source
    .replace('from "d3"', `from ${JSON.stringify(import.meta.resolve("d3"))}`)
    .replace(dependencyImport, `from ${JSON.stringify(moduleUrl(dependency))}`);
  if (packed) {
    assert(source.split('from "../elements/links/Label.js"').length === 2);
    adapted = adapted.replace(
      'from "../elements/links/Label.js"',
      `from ${JSON.stringify(new URL("../src/webvowl/js/elements/links/Label.js", import.meta.url).href)}`,
    );
  }
  return {
    factory: (await import(moduleUrl(adapted))).createLegacyForceSimulation,
    reference: {
      revision,
      sourceSha256: sha256(source),
      dependencyPath,
      dependencySha256: sha256(dependency),
      importAdaptation: packed
        ? "D3, historical packed kernel, and shared fixture Label identity URLs only"
        : "D3 and historical quadtree URLs only",
    },
  };
}

const baseline = await baselineFactory();
const factories = {
  baseline: baseline.factory,
  candidate: values.aa ? baseline.factory : createLegacyForceSimulation,
};
const parameters = { theta, chargeDistance };
const report = {
  schemaVersion: 1,
  layer: "legacy-force-kernel",
  observedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model,
  },
  identity: {
    revision: git("rev-parse", "HEAD").trim(),
    sourceSha256: sha256(readFileSync(resolve(root, sourcePath))),
    treeSha256: sha256(readFileSync(resolve(root, treePath))),
    packedKernelSha256: sha256(readFileSync(resolve(root, packedPath))),
    labelSha256: sha256(
      readFileSync(
        new URL("../src/webvowl/js/elements/links/Label.js", import.meta.url),
      ),
    ),
    fixturesSha256: sha256(
      readFileSync(
        new URL("./legacyForceBenchmarkFixtures.mjs", import.meta.url),
      ),
    ),
    lockfileSha256: sha256(readFileSync(resolve(root, "package-lock.json"))),
    baseline: baseline.reference,
  },
  parameters: {
    theta,
    chargeDistance: chargeDistance === Infinity ? "Infinity" : chargeDistance,
    seed: 0x5eed,
    random: "Seeded default Math.random captured during synchronous setup",
    runs,
    warmups,
    aa: values.aa,
  },
  diagnostic: values.diagnostic,
  limitations: [
    "No SVG, label recentering, paint or input-latency measurement",
    "Node kernel timing is not foreground browser acceptance",
    "Heap/GC/phase attribution requires a separate profiler run",
  ],
  fixtures: [],
  complete: false,
};

function measure(factory, id, selectedParameters) {
  const graph = createLegacyForceFixture(id);
  // Capture a seeded default source in each force without exercising the
  // separately tested custom-callback synchronization path. No timer can run
  // during this synchronous setup, and configureLegacyForce stops it before
  // restoring the process-wide source.
  const previousRandom = Math.random;
  let force;
  try {
    Math.random = createForceRandom();
    force = configureLegacyForce(factory(), graph, selectedParameters);
  } finally {
    Math.random = previousRandom;
  }
  const inputSha256 = sha256(
    JSON.stringify({
      state: legacyForceState(graph),
      links: graph.links.map(({ source, target }) => [
        source.index,
        target.index,
      ]),
    }),
  );
  const tickTimes = [];
  let terminated = false;
  const start = performance.now();
  try {
    for (let calls = 0; calls < 300; calls++) {
      const tickStart = performance.now();
      terminated = force.tick() === true;
      const elapsed = performance.now() - tickStart;
      if (terminated) break;
      tickTimes.push(elapsed);
    }
  } finally {
    force.stop();
  }
  const coolingMs = performance.now() - start;
  assert(
    terminated && force.alpha() === 0 && tickTimes.length === 298,
    "Complete the unchanged cooling cycle",
  );
  const state = legacyForceState(graph);
  assert(
    state.every((point) => point.slice(0, 4).every(Number.isFinite)),
    "Coordinates must remain finite",
  );
  const edgeError =
    graph.links.reduce(
      (sum, { source, target }) =>
        sum +
        Math.abs(Math.hypot(source.x - target.x, source.y - target.y) - 150) /
          150,
      0,
    ) / graph.links.length;
  const ordered = [...tickTimes].sort((a, b) => a - b);
  return {
    inputSha256,
    state,
    stateSha256: sha256(JSON.stringify(state)),
    coolingMs,
    movingSteps: tickTimes.length,
    terminationCalls: 1,
    ticksPerSecond: (tickTimes.length * 1000) / coolingMs,
    tick: {
      ...summarizeSamples(tickTimes),
      p99Ms: ordered[Math.ceil(ordered.length * 0.99) - 1],
    },
    edgeError,
    tickTimes,
  };
}

// Reserve the destination before measuring. A collision must fail before a
// benchmark error exists, and must never replace retained evidence.
const outputDescriptor = values.output
  ? openSync(resolve(values.output), "wx")
  : null;
try {
  // Diagnostic runs retain contention as a limitation; never label them clean.
  if (!values.diagnostic) await assertQuiescentMachine({ sampleMs: 1000 });
  for (const id of fixtureIds) {
    const definition = LEGACY_FORCE_FIXTURES.find(
      (fixture) => fixture.id === id,
    );
    const entry = { ...definition, samples: [], summary: null };
    report.fixtures.push(entry);
    for (let round = 0; round < warmups; round++) {
      measure(factories.baseline, id, { theta: 0.8, chargeDistance: Infinity });
      measure(
        factories.candidate,
        id,
        values.aa ? { theta: 0.8, chargeDistance: Infinity } : parameters,
      );
    }
    let expectedBaseline;
    let expectedCandidate;
    for (let round = 0; round < runs; round++) {
      if (!values.diagnostic) await assertQuiescentMachine({ sampleMs: 1000 });
      const samples = {};
      const order =
        round % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"];
      for (const variant of order) {
        samples[variant] = measure(
          factories[variant],
          id,
          variant === "baseline" || values.aa
            ? { theta: 0.8, chargeDistance: Infinity }
            : parameters,
        );
      }
      const { baseline: before, candidate: after } = samples;
      assert.equal(
        before.inputSha256,
        after.inputSha256,
        "Compare identical graph inputs",
      );
      expectedBaseline ??= before.stateSha256;
      expectedCandidate ??= after.stateSha256;
      assert.equal(
        before.stateSha256,
        expectedBaseline,
        "Baseline must replay deterministically",
      );
      assert.equal(
        after.stateSha256,
        expectedCandidate,
        "Candidate must replay deterministically",
      );
      const exactState = isDeepStrictEqual(before.state, after.state);
      if ((theta === 0.8 && chargeDistance === Infinity) || values.aa)
        assert(
          exactState,
          "Compatibility candidate changed final numerical state",
        );
      const squaredDisplacement = after.state.reduce(
        (sum, point, index) =>
          sum +
          (point[0] - before.state[index][0]) ** 2 +
          (point[1] - before.state[index][1]) ** 2,
        0,
      );
      entry.samples.push({
        round,
        order,
        exactState,
        rawRmsDisplacement: Math.sqrt(squaredDisplacement / definition.points),
        baseline: { ...before, state: undefined },
        candidate: { ...after, state: undefined },
      });
      process.stderr.write(
        `${id} ${round + 1}/${runs}: ${before.coolingMs.toFixed(1)} → ${after.coolingMs.toFixed(1)} ms; exact=${exactState}\n`,
      );
    }
    entry.summary = {
      baseline: summarizeSamples(
        entry.samples.map(({ baseline: value }) => value.coolingMs),
      ),
      candidate: summarizeSamples(
        entry.samples.map(({ candidate: value }) => value.coolingMs),
      ),
      exactState: entry.samples.every((sample) => sample.exactState),
    };
    entry.summary.relativeMedianChange =
      entry.summary.candidate.medianMs / entry.summary.baseline.medianMs - 1;
  }
  report.complete = true;
} catch (error) {
  report.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  const json = `${JSON.stringify(report, null, 2)}\n`;
  try {
    if (outputDescriptor !== null) writeFileSync(outputDescriptor, json);
    else process.stdout.write(json);
  } catch (error) {
    // Preserve the original benchmark failure even if disk output fails.
    process.stderr.write(`${json}Report write failed: ${error.message}\n`);
    process.exitCode = 1;
  } finally {
    if (outputDescriptor !== null) closeSync(outputDescriptor);
  }
}
