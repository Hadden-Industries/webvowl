import {
  createLegacyQuadtree,
  createLegacyQuadtreePool,
} from "./legacyForceQuadtree.js";

function points(count) {
  return Array.from({ length: count }, (_, index) => ({
    index,
    x: (index * 127) % 509,
    y: (index * 137) % 503,
  }));
}

function structure(tree) {
  const result = [];
  tree.visit((cell, x1, y1, x2, y2) => {
    result.push([cell.leaf, cell.point?.index, cell.x, cell.y, x1, y1, x2, y2]);
  });
  return result;
}

describe("simulation-owned fresh quadtree pool", () => {
  test("rebuilds current topology and bounds without warm allocation", () => {
    const data = points(120);
    const pool = createLegacyQuadtreePool();
    const before = structure(pool.build(data));
    const allocations = pool.statistics().allocated;
    expect(structure(pool.build(data))).toEqual(before);
    expect(pool.statistics().allocated).toBe(allocations);
    data[0].x = -1000;
    data[1].y = 3000;
    expect(structure(pool.build(data))).toEqual(
      structure(createLegacyQuadtree(data)),
    );
  });

  test("releases retired points and trims large/small/large capacity", () => {
    const pool = createLegacyQuadtreePool();
    const large = points(2000);
    const retired = [];
    pool.build(large).visit((cell) => {
      retired.push(cell);
    });
    const largeCapacity = pool.statistics().capacity;
    const small = points(3);
    pool.build(small);
    expect(pool.statistics().capacity).toBeLessThan(largeCapacity / 2);
    expect(pool.statistics().capacity).toBeLessThanOrEqual(
      pool.statistics().used * 2,
    );
    const current = new Set(small);
    for (const cell of retired) {
      if (cell.point) {
        expect(current.has(cell.point)).toBe(true);
      }
    }
    expect(structure(pool.build(large))).toEqual(
      structure(createLegacyQuadtree(large)),
    );
    pool.clear();
    expect(pool.statistics().capacity).toBe(0);
    for (const cell of retired) {
      expect(cell.point).toBeNull();
      expect(cell.nodes).toEqual([]);
      expect(cell.visit).toBeNull();
    }
  });

  test("keeps independent pools and caller-owned fresh trees separate", () => {
    const left = createLegacyQuadtreePool();
    const right = createLegacyQuadtreePool();
    const stable = right.build(points(25));
    const fresh = createLegacyQuadtree(points(25));
    const expected = structure(stable);
    left.build(points(200));
    left.clear();
    expect(structure(stable)).toEqual(expected);
    expect(structure(fresh)).toEqual(expected);
  });

  test.each(
    [
      [],
      [{ index: 0, x: NaN, y: 0 }],
      [
        { index: 0, x: 0, y: 0 },
        { index: 1, x: 0, y: 0 },
        { index: 2, x: 0.001, y: 0.002 },
      ],
    ].map((data) => [data]),
  )("reuses empty, invalid and near-coincident topology (%#)", (data) => {
    const pool = createLegacyQuadtreePool();
    pool.build(points(50));
    expect(structure(pool.build(data))).toEqual(
      structure(createLegacyQuadtree(data)),
    );
    expect(structure(pool.build(data))).toEqual(
      structure(createLegacyQuadtree(data)),
    );
    pool.clear();
  });
});
