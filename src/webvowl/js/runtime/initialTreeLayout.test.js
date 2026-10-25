import {
  layoutInitialTree,
  spaceInitialNodeFootprints,
} from "./initialTreeLayout.js";

test("a two-leaf tree places the root centrally and leaves at opposite radii", () => {
  const root = {
    index: 0,
    children: [{ index: 1 }, { index: 2 }],
  };
  const before = structuredClone(root);
  const points = layoutInitialTree(root, 200);
  expect(root).toEqual(before);
  expect(points.map(({ index }) => index)).toEqual([0, 1, 2]);
  expect(points[0].x).toBeCloseTo(0);
  expect(points[0].y).toBeCloseTo(0);
  expect(points[1].x).toBeCloseTo(0);
  expect(points[1].y).toBeCloseTo(200);
  expect(points[2].x).toBeCloseTo(0);
  expect(points[2].y).toBeCloseTo(-200);
});

test.each([
  [{ classDistancePx: 200, datatypeDistancePx: 120 }],
  [{ classDistancePx: 120, datatypeDistancePx: 300 }],
])(
  "native footprints retain the selected class/datatype clearance (%j)",
  (distances) => {
    const points = Array.from({ length: 18 }, (_, index) => ({
      index,
      x: 0,
      y: 0,
      radius: index % 3 ? 50 : 80,
      datatype: index % 2 === 1,
    }));
    spaceInitialNodeFootprints(points, distances);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j];
        const expected =
          a.datatype || b.datatype
            ? distances.datatypeDistancePx
            : distances.classDistancePx;
        expect(
          Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius,
        ).toBeGreaterThanOrEqual(expected - 1e-6);
      }
    }
    const prepared = structuredClone(points);
    spaceInitialNodeFootprints(points, distances);
    expect(points).toEqual(prepared);
  },
);
