import { expect, test } from "@jest/globals";
import { Label } from "../src/webvowl/js/elements/links/Label.js";
import {
  LEGACY_FORCE_FIXTURES,
  createLegacyForceFixture,
  createForceRandom,
} from "./legacyForceBenchmarkFixtures.mjs";

const snapshot = ({ nodes, links }) => {
  const indices = new Map(nodes.map((node, index) => [node, index]));
  return {
    points: nodes.map(({ x, y, px, py }) => [x, y, px, py]),
    links: links.map(({ source, target }) => [
      indices.get(source),
      indices.get(target),
    ]),
  };
};

test.each([
  ["wvowl-medium-sparse", 500, 750],
  ["wvowl-medium-hub", 500, 1000],
  ["wvowl-large", 2000, 3000],
  ["wvowl-large-hub", 2000, 4000],
  ["wvowl-xlarge", 5000, 7500],
  ["wvowl-xlarge-dense", 5000, 15000],
])(
  "%s has the declared solver inputs and real label state",
  (id, points, links) => {
    const graph = createLegacyForceFixture(id);
    expect(graph.nodes).toHaveLength(points);
    expect(graph.links).toHaveLength(links);
    const pointSet = new Set(graph.nodes);
    expect(
      graph.links.every(
        ({ source, target }) =>
          pointSet.has(source) && pointSet.has(target) && source !== target,
      ),
    ).toBe(true);
    expect(
      graph.nodes.every(
        ({ x, y, px, py }) =>
          Number.isFinite(x) && Number.isFinite(y) && px === x && py === y,
      ),
    ).toBe(true);
    const label = graph.nodes[graph.classCount];
    expect(label).toBeInstanceOf(Label);
    label.x = 42;
    expect(label.property().x).toBe(42);
  },
);

test("fixture seeds reproduce independent graphs and meaningfully change inputs", () => {
  const first = createLegacyForceFixture("wvowl-medium-hub", 123);
  const second = createLegacyForceFixture("wvowl-medium-hub", 123);
  expect(snapshot(first)).toEqual(snapshot(second));
  expect(first.nodes[0]).not.toBe(second.nodes[0]);
  expect(snapshot(first)).not.toEqual(
    snapshot(createLegacyForceFixture("wvowl-medium-hub", 124)),
  );
  const degrees = new Map(first.nodes.map((node) => [node, 0]));
  first.links.forEach(({ source, target }) => {
    degrees.set(source, degrees.get(source) + 1);
    degrees.set(target, degrees.get(target) + 1);
  });
  expect(Math.max(...degrees.values())).toBeGreaterThan(50);
  expect(LEGACY_FORCE_FIXTURES).toHaveLength(6);
  expect(() => createLegacyForceFixture("unknown")).toThrow(RangeError);
});

test("random streams retain independent replay state", () => {
  const first = createForceRandom(1);
  const second = createForceRandom(1);
  expect(first()).toBe(1015568748 / 0x100000000);
  expect(second()).toBe(1015568748 / 0x100000000);
  expect(first()).toBe(second());
});
