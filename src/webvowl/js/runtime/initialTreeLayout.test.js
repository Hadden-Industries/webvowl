import { layoutInitialTree } from "./initialTreeLayout.js";

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
