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
