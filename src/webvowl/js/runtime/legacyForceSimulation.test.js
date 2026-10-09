import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { createLegacyForceSimulation } from "./legacyForceSimulation.js";
import { Label } from "../elements/links/Label.js";
import { OwlObjectProperty } from "../elements/properties/implementations/OwlObjectProperty.js";
import { OwlClass } from "../elements/nodes/implementations/OwlClass.js";

const referenceSource = readFileSync(
  new URL(
    "../../../../test/fixtures/legacy-force/d3-v3.5.17.txt",
    import.meta.url,
  ),
  "utf8",
);

function seededRandom() {
  let seed = 123456789;
  return () => {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function referenceForce() {
  // Untouched official distribution in an isolated realm. Its timers cannot run;
  // both algorithms are stepped manually with their own identical random stream.
  const math = Object.create(Math);
  math.random = seededRandom();
  const context = { Math: math, setTimeout() {}, clearTimeout() {} };
  runInNewContext(referenceSource, context);
  return context.d3.layout.force();
}

function fixture({ missing = false, coincident = false, labels = false } = {}) {
  const nodes = Array.from({ length: 25 }, (_, i) => {
    const point =
      labels && i % 2
        ? new Label(
            new OwlObjectProperty({ language: () => "en" }).id(`p-${i}`),
            null,
          )
        : {};
    if (!missing) {
      point.x = coincident ? 10 : i * 17 - 20;
      point.y = coincident ? 10 : (i % 7) * 23 - 50;
      point.px = point.x;
      point.py = point.y;
    }
    point.fixed = i === 0;
    return point;
  });
  const links = nodes
    .slice(1)
    .map((node, i) => ({ source: nodes[Math.floor(i / 2)], target: node }));
  links.push({ source: nodes[3], target: nodes[3] });
  return { nodes, links };
}

function configure(force, graph) {
  return force
    .nodes(graph.nodes)
    .links(graph.links)
    .size([800, 600])
    .gravity(0.025)
    .charge((_, i) => (i % 2 ? -400 : -500))
    .linkDistance((_, i) => 75 + (i % 4) * 10)
    .linkStrength(1)
    .start();
}

function state(graph) {
  return graph.nodes.map((n) => [
    n.x,
    n.y,
    n.px,
    n.py,
    n.weight,
    n.index,
    Boolean(n.fixed),
  ]);
}

test("reference distribution has its retained immutable identity", () => {
  expect(createHash("sha256").update(referenceSource).digest("hex")).toBe(
    "0c0b24005903a9d71beb93837fc1fc618b81780f14601c729030227c16b3ef51",
  );
});

test.each([
  ["fresh load", {}],
  ["coincident points", { coincident: true }],
  ["legacy initialization", { missing: true }],
  ["real movable labels", { labels: true }],
])("exact legacy force state at every step: %s", (_, options) => {
  const expected = fixture(options),
    actual = fixture(options);
  const reference = configure(referenceForce(), expected);
  const candidate = configure(
    createLegacyForceSimulation({ random: seededRandom() }),
    actual,
  ).stop();
  try {
    expect(state(actual)).toEqual(state(expected));
    for (let step = 0; step < 300; ++step) {
      expect(candidate.tick()).toBe(reference.tick());
      expect(candidate.alpha()).toBe(reference.alpha());
      expect(state(actual)).toEqual(state(expected));
      if (candidate.alpha() === 0) {
        break;
      }
    }
    expect(candidate.alpha()).toBe(0);
    // Settled resume, changed distances and drag/fix/release each reheat to .1.
    for (const phase of ["resume", "distance", "drag", "release"]) {
      if (phase === "distance") {
        reference.linkDistance(120).start();
        candidate.linkDistance(120).start().stop();
      } else {
        if (phase === "drag" || phase === "release") {
          for (const graph of [expected, actual]) {
            const n = graph.nodes[1];
            n.fixed = phase === "drag";
            n.x = n.px = 111;
            n.y = n.py = 222;
          }
        }
        reference.resume();
        candidate.resume().stop();
      }
      for (let i = 0; i < 30; ++i) {
        reference.tick();
        candidate.tick();
        expect(state(actual)).toEqual(state(expected));
      }
    }
  } finally {
    candidate.stop();
    reference.stop();
  }
});

test("one-node gravity and Verlet case does not translate the centroid to the center", () => {
  const node = { x: 0, y: 0, px: 0, py: 0 };
  const force = createLegacyForceSimulation()
    .nodes([node])
    .links([])
    .size([800, 600])
    .gravity(0.025)
    .charge(0)
    .start()
    .stop();
  force.tick();
  expect(node.x).toBeCloseTo(400 * 0.099 * 0.025 * 1.9, 14);
  expect(node.y).toBeCloseTo(300 * 0.099 * 0.025 * 1.9, 14);
});

test("representative canonical-size force inputs retain legacy trajectory and label pin ownership", () => {
  const owner = { language: () => "en" };
  const classNodes = Array.from({ length: 668 }, (_, i) =>
    new OwlClass(owner).id(`n-${i}`),
  );
  const labels = Array.from(
    { length: 775 },
    (_, i) => new Label(new OwlObjectProperty(owner).id(`p-${i}`), null),
  );
  const nodes = [...classNodes, ...labels];
  nodes.forEach((node, i) => {
    node.x = node.px = Math.cos(i * 2.399963) * Math.sqrt(i) * 35;
    node.y = node.py = Math.sin(i * 2.399963) * Math.sqrt(i) * 35;
  });
  const links = labels.flatMap((label, i) => [
    { source: classNodes[i % 668], target: label },
    { source: label, target: classNodes[(i * 17 + 3) % 668] },
  ]);
  const expectedNodes = nodes.map(({ x, y, px, py }) => ({ x, y, px, py }));
  const expectedLinks = links.map(({ source, target }) => ({
    source: expectedNodes[nodes.indexOf(source)],
    target: expectedNodes[nodes.indexOf(target)],
  }));
  const setup = (force, points, parts) =>
    force
      .nodes(points)
      .links(parts)
      .size([800, 600])
      .charge((_, i) => (i < 668 ? -500 : -400))
      .gravity(0.025)
      .linkDistance(150)
      .start();
  const actual = setup(
    createLegacyForceSimulation({ random: seededRandom() }),
    nodes,
    links,
  ).stop();
  const expected = setup(referenceForce(), expectedNodes, expectedLinks);
  try {
    for (let tick = 0; tick < 300; ++tick) {
      if (tick === 30 || tick === 120) {
        labels[0].pinned(tick === 30);
        const n = expectedNodes[668];
        n.fixed = tick === 30;
        // Pinning captures the current location; the fixed-target adapter
        // translates this to the previous-position owner used by D3 v3.
        if (n.fixed) {
          n.px = n.x;
          n.py = n.y;
        }
      }
      expect(actual.tick()).toBe(expected.tick());
      if ([0, 1, 30, 120, 298, 299].includes(tick)) {
        expect(state({ nodes })).toEqual(state({ nodes: expectedNodes }));
      }
    }
    expect(actual.alpha()).toBe(0);
  } finally {
    actual.stop();
    expected.stop();
  }
});

test("canonical fixed targets, pause and natural end have distinct ownership", () => {
  const node = { x: 20, y: 30, px: -10, py: -20, fixed: true, fx: 40, fy: 50 };
  const events = [];
  const force = createLegacyForceSimulation()
    .nodes([node])
    .links([])
    .on("end.test", () => events.push("end"))
    .start()
    .stop();
  expect(events).toEqual([]);
  force.tick();
  expect([node.x, node.y, node.px, node.py]).toEqual([40, 50, 40, 50]);
  force.alpha(0.005).tick();
  expect(events).toEqual(["end"]);
  expect(force.alpha()).toBe(0);
});
