import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceX,
  forceY,
} from "d3";
import { Label } from "../src/webvowl/js/elements/links/Label.js";
import { OwlClass } from "../src/webvowl/js/elements/nodes/implementations/owlClass.js";
import { OwlObjectProperty } from "../src/webvowl/js/elements/properties/implementations/owlObjectProperty.js";
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

// Independent equal-step numerical oracle, including fixed/unfixed changes.
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

const results = [];
let failure;
try {
  // This counterbalanced batch is one measurement group. Check before it,
  // rather than classifying the preceding benchmark's own CPU work as load.
  await assertQuiescentMachine({ sampleMs: 5000 });
  for (let round = 0; round < 5; round++) {
    const order =
      round % 2
        ? [
            ["candidate", CandidateLabel],
            ["baseline", BaselineLabel],
          ]
        : [
            ["baseline", BaselineLabel],
            ["candidate", CandidateLabel],
          ];
    const measurements = {};
    for (const [name, Constructor] of order) {
      const current = workload(Constructor);
      current.simulation.tick(30);
      const ticks = [];
      for (let tick = 0; tick < 120; tick++) {
        const start = performance.now();
        current.simulation.tick();
        ticks.push(performance.now() - start);
      }
      current.simulation.stop();
      measurements[name] = {
        medianMs: quantile(ticks, 0.5),
        p95Ms: quantile(ticks, 0.95),
        ticks,
      };
    }
    results.push({
      round,
      order: order.map(([name]) => name),
      ...measurements,
    });
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
      comparison: process.argv.includes("--aa") ? "A/A" : "A/B",
      quiescenceSampleMs: 5000,
      complete: !failure,
      ...(failure ? { failure } : {}),
      nodeVersion: process.version,
      exactTrajectoryMatch: true,
      medianPairedRatio: results.length
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
