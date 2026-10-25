import { hierarchy, tree } from "d3";

/** Keep nearby tree seeds when there is room; spread only crowded points. */
function spreadCrowdedPoints(points, cellSize, gap = () => 0) {
  const cells = new Map();
  const searchedRings = new Map();
  const blockedFootprints = new Map();
  function available(x, y, point) {
    const column = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      const columnCells = cells.get(column + dx);
      if (!columnCells) {
        continue;
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of columnCells.get(row + dy) ?? []) {
          const clearance = point.radius + other.radius + gap(point, other);
          if ((x - other.x) ** 2 + (y - other.y) ** 2 < clearance ** 2) {
            return false;
          }
        }
      }
    }
    return true;
  }
  for (const point of points) {
    if (!available(point.x, point.y, point)) {
      const column = Math.round(point.x / cellSize);
      const row = Math.round(point.y / cellSize);
      const searchKey = `${column},${row},${point.radius},${point.datatype ?? false}`;
      const footprintKey = `${point.radius},${point.datatype ?? false}`;
      let blockedColumns = blockedFootprints.get(footprintKey);
      if (!blockedColumns) {
        blockedColumns = new Map();
        blockedFootprints.set(footprintKey, blockedColumns);
      }
      let nearest;
      function consider(dx, dy) {
        const candidateColumn = column + dx;
        const candidateRow = row + dy;
        const x = candidateColumn * cellSize;
        const y = candidateRow * cellSize;
        const distance = (x - point.x) ** 2 + (y - point.y) ** 2;
        if (nearest && distance >= nearest.distance) {
          return;
        }
        let blockedRows = blockedColumns.get(candidateColumn);
        if (blockedRows?.has(candidateRow)) {
          return;
        }
        if (available(x, y, point)) {
          nearest = { x, y, distance };
        } else {
          // Occupancy only grows: a rejected grid position stays blocked for
          // this footprint, including searches from a neighboring seed cell.
          if (!blockedRows) {
            blockedRows = new Set();
            blockedColumns.set(candidateColumn, blockedRows);
          }
          blockedRows.add(candidateRow);
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
    const column = Math.floor(point.x / cellSize);
    const row = Math.floor(point.y / cellSize);
    let columnCells = cells.get(column);
    if (!columnCells) {
      columnCells = new Map();
      cells.set(column, columnCells);
    }
    let cell = columnCells.get(row);
    if (!cell) {
      cell = [];
      columnCells.set(row, cell);
    }
    cell.push(point);
  }
}

/** Finish fresh placement with actual glyph bounds and the requested clear gap. */
export function spaceInitialNodeFootprints(points, distances) {
  const largestRadius = points.reduce(
    (largest, point) => Math.max(largest, point.radius),
    0,
  );
  const cellSize =
    2 * largestRadius +
    Math.max(distances.classDistancePx, distances.datatypeDistancePx);
  if (cellSize > 0) {
    spreadCrowdedPoints(points, cellSize, (a, b) =>
      a.datatype || b.datatype
        ? distances.datatypeDistancePx
        : distances.classDistancePx,
    );
  }
  return points;
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
      // This coarse forest precedes native glyph sizing. It cannot establish
      // visible clearance; the fresh native drawing applies the full requested
      // gap around actual glyph footprints before fitting and painting.
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
