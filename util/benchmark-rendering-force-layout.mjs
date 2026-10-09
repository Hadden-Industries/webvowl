import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceX,
  forceY,
} from "d3";
import { Label } from "../src/webvowl/js/elements/links/Label.js";
import { OwlClass } from "../src/webvowl/js/elements/nodes/implementations/OwlClass.js";
import { OwlObjectProperty } from "../src/webvowl/js/elements/properties/implementations/OwlObjectProperty.js";
import { assertQuiescentMachine } from "./benchmarkEnvironment.mjs";

// Supply the retained, unmodified baseline Label module explicitly. Both
// variants otherwise use this checkout's real renderer elements and D3.
const baselinePath = process.argv[2];
if (!baselinePath)
  throw new Error(
    "Usage: node util/benchmark-rendering-force-layout.mjs <baseline-Label.mjs>",
  );
const { Label: BaselineLabel } = await import(pathToFileURL(baselinePath));
const CandidateLabel = process.argv.includes("--aa") ? BaselineLabel : Label;
const variant = process.argv[process.argv.indexOf("--variant") + 1];
const worker = process.argv.includes("--variant");
if (worker && !["baseline", "candidate"].includes(variant))
  throw new Error("--variant requires baseline or candidate");
const sha256 = (source) => createHash("sha256").update(source).digest("hex");
const lockfile = readFileSync(new URL("../package-lock.json", import.meta.url));
const identity = {
  revision: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  baselineSha256: sha256(readFileSync(baselinePath)),
  candidateSha256: sha256(
    readFileSync(
      new URL("../src/webvowl/js/elements/links/Label.js", import.meta.url),
    ),
  ),
  lockfileSha256: sha256(lockfile),
  d3Version: JSON.parse(lockfile).packages["node_modules/d3"].version,
};
const fields = ["index", "x", "y", "px", "py", "vx", "vy", "fixed", "fx", "fy"];
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

function workload(LabelConstructor, count = 668, labelCount = 750) {
  const graph = { language: () => "en" };
  const nodes = Array.from({ length: count }, (_, index) =>
    new OwlClass(graph).id(`node-${index}`),
  );
  const properties = [];
  const labels = Array.from({ length: labelCount }, (_, index) => {
    const property = new OwlObjectProperty(graph).id(`property-${index}`);
    property
      .domain(nodes[index % count])
      .range(nodes[(index * 17 + 3) % count]);
    if (index % 9 === 0) {
      const inverse = new OwlObjectProperty(graph).id(`inverse-${index}`);
      property.inverse(inverse);
      inverse.inverse(property);
    }
    properties.push(property);
    return new LabelConstructor(property, null);
  });
  const points = [...nodes, ...labels];
  points.forEach((point, index) => {
    point.x = Math.cos(index * 2.399963) * Math.sqrt(index) * 35;
    point.y = Math.sin(index * 2.399963) * Math.sqrt(index) * 35;
    point.px = point.x;
    point.py = point.y;
    point.vx = 0;
    point.vy = 0;
    point.fx = null;
    point.fy = null;
  });
  const links = labels.flatMap((label, index) => [
    { source: nodes[index % count], target: label },
    { source: label, target: nodes[(index * 17 + 3) % count] },
  ]);
  const simulation = forceSimulation(points)
    .stop()
    .force("link", forceLink(links).distance(150).strength(1))
    .force(
      "charge",
      forceManyBody().strength((_point, index) =>
        index < count ? -500 : -400,
      ),
    )
    .force("center", forceCenter(400, 300))
    .force("x", forceX(400).strength(0.025))
    .force("y", forceY(300).strength(0.025));
  return { simulation, points, properties };
}

function checkTrajectory() {
  const baseline = workload(BaselineLabel, 12, 17);
  const candidate = workload(CandidateLabel, 12, 17);
  for (let tick = 0; tick <= 300; tick++) {
    if ([0, 1, 30, 120, 300].includes(tick)) {
      assert.deepEqual(
        candidate.points.map((point) => fields.map((field) => point[field])),
        baseline.points.map((point) => fields.map((field) => point[field])),
      );
      assert.equal(candidate.simulation.alpha(), baseline.simulation.alpha());
    }
    if (tick === 30 || tick === 120) {
      for (const current of [baseline, candidate]) {
        current.properties[0].pinned(tick === 30);
        current.points[0].frozen(tick === 30);
      }
    }
    baseline.simulation.tick();
    candidate.simulation.tick();
  }
}

function measure(Constructor) {
  const current = workload(Constructor);
  current.simulation.tick(30);
  const ticks = [];
  for (let tick = 0; tick < 120; tick++) {
    const start = performance.now();
    current.simulation.tick();
    ticks.push(performance.now() - start);
  }
  current.simulation.stop();
  return {
    medianMs: quantile(ticks, 0.5),
    p95Ms: quantile(ticks, 0.95),
    ticks,
  };
}

const results = [];
let failure;
let exactTrajectoryMatch = false;
try {
  if (worker) {
    // Only one representation reaches D3 in this fresh process.
    results.push(
      measure(variant === "baseline" ? BaselineLabel : CandidateLabel),
    );
  } else {
    checkTrajectory();
    exactTrajectoryMatch = true;
    // This counterbalanced batch is one measurement group. Check before it,
    // rather than classifying the preceding benchmark's own CPU work as load.
    await assertQuiescentMachine({ sampleMs: 5000 });
    for (let round = 0; round < 5; round++) {
      const order =
        round % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"];
      const measurements = {};
      for (const name of order) {
        const output = execFileSync(
          process.execPath,
          [
            fileURLToPath(import.meta.url),
            baselinePath,
            "--variant",
            name,
            ...(process.argv.includes("--aa") ? ["--aa"] : []),
          ],
          { encoding: "utf8", timeout: 120000, windowsHide: true },
        );
        const child = JSON.parse(output);
        assert.deepEqual(child.identity, identity);
        assert.equal(child.complete, true);
        measurements[name] = child.results[0];
      }
      results.push({
        round,
        order,
        ...measurements,
      });
    }
  }
} catch (error) {
  failure = error.message;
  process.exitCode = 1;
}
console.log(
  JSON.stringify(
    {
      kind: "real-renderer-elements-generated-topology-force-only",
      nodeCount: 668,
      labelCount: 750,
      baselinePath,
      identity,
      processIsolation: worker
        ? "single-variant-worker"
        : "fresh-process-per-variant",
      ...(worker ? { variant } : {}),
      comparison: process.argv.includes("--aa") ? "A/A" : "A/B",
      quiescenceSampleMs: 5000,
      complete: !failure,
      ...(failure ? { failure } : {}),
      nodeVersion: process.version,
      exactTrajectoryMatch: worker ? null : exactTrajectoryMatch,
      medianPairedRatio:
        !worker && results.length
          ? quantile(
              results.map(
                (row) => row.candidate.medianMs / row.baseline.medianMs,
              ),
              0.5,
            )
          : null,
      results,
    },
    null,
    2,
  ),
);
