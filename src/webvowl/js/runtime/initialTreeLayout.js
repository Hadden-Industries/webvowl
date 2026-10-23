import { hierarchy, tree } from "d3";

/** Keep nearby tree seeds when there is room; spread only crowded points. */
function spreadCrowdedPoints(points, cellSize) {
  const cells = new Map();
  const searchedRings = new Map();
  function available(x, y, radius) {
    const column = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${column + dx},${row + dy}`) ?? []) {
          const clearance = radius + other.radius;
          if ((x - other.x) ** 2 + (y - other.y) ** 2 < clearance ** 2) {
            return false;
          }
        }
      }
    }
    return true;
  }
  for (const point of points) {
    if (!available(point.x, point.y, point.radius)) {
      const column = Math.round(point.x / cellSize);
      const row = Math.round(point.y / cellSize);
      const searchKey = `${column},${row},${point.radius}`;
      let nearest;
      function consider(dx, dy) {
        const x = (column + dx) * cellSize;
        const y = (row + dy) * cellSize;
        const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
        if (
          (!nearest || distance < nearest.distance) &&
          available(x, y, point.radius)
        ) {
          nearest = { x, y, distance };
        }
      }
      // Occupancy only grows. For the same cell and clearance, an exhausted
      // ring stays exhausted; dense hubs need not scan that area for each leaf.
      let ring = searchedRings.get(searchKey) ?? 0;
      for (; !nearest; ring++) {
        // Visit only the perimeter, not every cell inside each growing square.
        for (let offset = -ring; offset <= ring; offset++) {
          consider(offset, -ring);
          consider(offset, ring);
        }
        for (let offset = 1 - ring; offset < ring; offset++) {
          consider(-ring, offset);
          consider(ring, offset);
        }
      }
      searchedRings.set(searchKey, ring - 1);
      point.x = nearest.x;
      point.y = nearest.y;
    }
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    if (!cells.has(key)) {
      cells.set(key, []);
    }
    cells.get(key).push(point);
  }
}

/** Pure coordinates for an application-owned, temporary spanning tree. */
export function layoutInitialTree(root, radius) {
  const forest = hierarchy(root);
  tree().size([2 * Math.PI, radius])(forest);
  const defaultSpacing = radius / Math.max(1, forest.height);
  const descendants = forest.descendants();
  // Breadth-first traversal lets each edge use its requested distance while
  // retaining the tree's angular grouping. No simulation or DOM work is needed.
  const points = descendants.map((node) => {
    node.y = node.parent
      ? node.parent.y + (node.data.distance ?? defaultSpacing)
      : 0;
    return {
      index: node.data.index,
      x: node.y * Math.cos(node.x),
      y: node.y * Math.sin(node.x),
      // Reserve half the requested spacing across a node, matching the scale
      // of the existing spacing-only initializer. This is a seed, not a second
      // force-distance or glyph-size authority.
      radius: (node.data.spacing ?? defaultSpacing) / 4,
    };
  });
  const cellSize = points.reduce(
    (size, point) => Math.max(size, point.radius * 2),
    0,
  );
  if (cellSize > 0) {
    spreadCrowdedPoints(points, cellSize);
  }
  return points.map(({ index, x, y }) => ({ index, x, y }));
}
