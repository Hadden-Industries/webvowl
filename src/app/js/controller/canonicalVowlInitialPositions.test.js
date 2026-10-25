import { createCanonicalVowlInitialPositions as createPositions } from "./canonicalVowlInitialPositions.js";
import { layoutInitialTree } from "../../../webvowl/js/runtime/initialTreeLayout.js";

const createCanonicalVowlInitialPositions = (occurrences, center, distances) =>
  createPositions(occurrences, center, distances, layoutInitialTree);

const node = (id) => ({ id, kind: "class-node" });
const edge = (from, to) => ({
  id: `${from}-${to}`,
  kind: "subclass-edge",
  from,
  to,
});
const center = { x: 400, y: 300 };

test("fresh placement is complete, deterministic and does not rewrite incidence", () => {
  const occurrences = [
    node("a"),
    node("b"),
    node("c"),
    edge("b", "a"),
    edge("b", "c"),
  ];
  const before = structuredClone(occurrences);
  const positions = createCanonicalVowlInitialPositions(occurrences, center);
  expect(occurrences).toEqual(before);
  expect(positions.size).toBe(3);
  expect(createCanonicalVowlInitialPositions(occurrences, center)).toEqual(
    positions,
  );
  expect(
    createCanonicalVowlInitialPositions(
      occurrences.map((row) =>
        row.from ? { ...row, from: row.to, to: row.from } : row,
      ),
      center,
    ),
  ).toEqual(positions);
  const translated = createCanonicalVowlInitialPositions(occurrences, {
    x: 460,
    y: 280,
  });
  for (const [id, point] of positions) {
    expect(translated.get(id).x).toBeCloseTo(point.x + 60);
    expect(translated.get(id).y).toBeCloseTo(point.y - 20);
  }
});

test("temporary incidence includes n-ary edges without merging distinct occurrences", () => {
  const occurrences = [
    node("a"),
    node("b"),
    node("c"),
    node("d"),
    { id: "many", kind: "disjoint-edge", ends: ["a", "b", "c", "d"] },
  ];
  const positions = createCanonicalVowlInitialPositions(occurrences, center);
  expect(positions.size).toBe(4);
  expect(
    new Set([...positions.values()].map((point) => `${point.x},${point.y}`))
      .size,
  ).toBe(4);
});

test.each(["chain", "star", "cycle", "isolated"])(
  "%s preparation stays finite and within a bounded extent",
  (shape) => {
    const occurrences = Array.from({ length: 2000 }, (_, i) => node(`n${i}`));
    for (let i = 1; i < 2000; i++) {
      if (shape !== "isolated") {
        occurrences.push(edge(shape === "star" ? "n0" : `n${i - 1}`, `n${i}`));
      }
    }
    if (shape === "cycle") {
      occurrences.push(edge("n1999", "n0"));
    }
    const positions = createCanonicalVowlInitialPositions(occurrences, center);
    expect(positions.size).toBe(2000);
    for (const point of positions.values()) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(Math.hypot(point.x - center.x, point.y - center.y)).toBeLessThan(
        15000,
      );
    }
    // A long chain must not collapse into one crowded line or allocate a full
    // depth-scaled radius. This assertion is about shape, not a timing threshold.
    if (shape === "chain") {
      expect(
        Math.abs(positions.get("n0").x - positions.get("n1").x),
      ).toBeGreaterThan(10);
      expect(
        Math.hypot(
          positions.get("n0").x - positions.get("n1").x,
          positions.get("n0").y - positions.get("n1").y,
        ),
      ).toBeGreaterThan(100);
    }
  },
);

test("explicit force-distance requests scale fresh placement and empty drawings stay empty", () => {
  const occurrences = [node("a"), node("b"), edge("a", "b")];
  const defaults = createCanonicalVowlInitialPositions(occurrences, center);
  const doubled = createCanonicalVowlInitialPositions(occurrences, center, {
    classDistancePx: 400,
  });
  for (const [id, point] of defaults) {
    expect(doubled.get(id).x - center.x).toBeCloseTo(2 * (point.x - center.x));
    expect(doubled.get(id).y - center.y).toBeCloseTo(2 * (point.y - center.y));
  }
  expect(createCanonicalVowlInitialPositions([], center).size).toBe(0);
});

test("rendererless placement uses the bounded spacing fallback", () => {
  const positions = createPositions(
    [node("a"), node("b"), edge("a", "b")],
    center,
  );
  const a = positions.get("a");
  const b = positions.get("b");
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(100);
});

test("a deep path starts with short links even when inventory order differs from connectivity", () => {
  const occurrences = Array.from({ length: 101 }, (_, i) =>
    node(`n${(i * 17) % 101}`),
  );
  for (let i = 1; i < 101; i++) {
    occurrences.push(edge(`n${i - 1}`, `n${i}`));
  }
  const positions = createCanonicalVowlInitialPositions(occurrences, center, {
    classDistancePx: 300,
  });
  for (let i = 1; i < 101; i++) {
    const a = positions.get(`n${i - 1}`);
    const b = positions.get(`n${i}`);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(300);
  }
  const points = [...positions.values()];
  expect(new Set(points.map(({ x, y }) => `${x},${y}`)).size).toBe(101);
  expect(
    Math.max(...points.map(({ x }) => x)) -
      Math.min(...points.map(({ x }) => x)),
  ).toBeLessThanOrEqual(3000);
  expect(
    Math.max(...points.map(({ y }) => y)) -
      Math.min(...points.map(({ y }) => y)),
  ).toBeLessThanOrEqual(3000);
});

test("a broad connected cluster leaves room for ordinary class glyphs", () => {
  const occurrences = [node("hub")];
  for (let i = 0; i < 64; i++) {
    occurrences.push(node(`leaf${i}`), edge("hub", `leaf${i}`));
  }
  const points = [
    ...createCanonicalVowlInitialPositions(occurrences, center).values(),
  ];
  let minimumDistance = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      minimumDistance = Math.min(
        minimumDistance,
        Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y),
      );
    }
  }
  // Native class glyphs have a 50-unit radius. A breadth-only tree must not
  // squeeze arbitrarily many of them onto a fixed 200-unit ring.
  expect(minimumDistance).toBeGreaterThanOrEqual(100);
});

test("scaling both distance settings scales a crowded mixed cluster consistently", () => {
  const occurrences = [node("hub")];
  for (let i = 0; i < 64; i++) {
    occurrences.push(
      { id: `leaf${i}`, kind: i % 2 ? "datatype-node" : "class-node" },
      edge("hub", `leaf${i}`),
    );
  }
  const ordinary = createCanonicalVowlInitialPositions(occurrences, center);
  const expanded = createCanonicalVowlInitialPositions(occurrences, center, {
    classDistancePx: 400,
    datatypeDistancePx: 240,
  });
  for (const [id, point] of ordinary) {
    expect(expanded.get(id).x - center.x).toBeCloseTo(2 * (point.x - center.x));
    expect(expanded.get(id).y - center.y).toBeCloseTo(2 * (point.y - center.y));
  }
});

test.each([
  ["class-node", "class-node", {}, 200],
  ["datatype-node", "datatype-node", {}, 120],
  ["class-node", "datatype-node", {}, 120],
  ["datatype-node", "class-node", {}, 120],
  ["class-node", "class-node", { datatypeDistancePx: 300 }, 200],
  ["class-node", "datatype-node", { datatypeDistancePx: 300 }, 300],
  ["datatype-node", "datatype-node", { classDistancePx: 400 }, 120],
])(
  "%s to %s uses the matching force distance (%j)",
  (a, b, distances, expected) => {
    const points = [
      ...createCanonicalVowlInitialPositions(
        [{ id: "a", kind: a }, { id: "b", kind: b }, edge("a", "b")],
        center,
        distances,
      ).values(),
    ];
    expect(
      Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
    ).toBeCloseTo(expected);
  },
);
