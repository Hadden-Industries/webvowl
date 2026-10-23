import { DEFAULT_FORCE_LAYOUT_DISTANCES } from "../../../shared/js/visualizationDefaults.js";

/** Temporary spanning forest for fresh placement only; it never owns topology. */
export function createCanonicalVowlInitialPositions(
  occurrences,
  center,
  forceDistances = DEFAULT_FORCE_LAYOUT_DISTANCES,
  layoutInitialTree,
) {
  const spacing = Math.max(
    forceDistances.classDistancePx ??
      DEFAULT_FORCE_LAYOUT_DISTANCES.classDistancePx,
    forceDistances.datatypeDistancePx ??
      DEFAULT_FORCE_LAYOUT_DISTANCES.datatypeDistancePx,
  );
  const nodes = occurrences.filter(({ kind }) =>
    ["class-node", "datatype-node"].includes(kind),
  );
  if (!nodes.length) {
    return new Map();
  }
  const index = new Map(nodes.map(({ id }, i) => [id, i]));
  const neighbors = nodes.map(() => new Set());
  for (const edge of occurrences) {
    if (!edge.kind.endsWith("-edge")) {
      continue;
    }
    const ends = [...new Set(edge.ends ?? [edge.from, edge.to])]
      .map((id) => index.get(id))
      .filter((i) => i !== undefined);
    // A temporary incidence star keeps n-ary preprocessing linear in its arity.
    for (const end of ends.slice(1)) {
      neighbors[ends[0]].add(end);
      neighbors[end].add(ends[0]);
    }
  }
  const remaining = new Set(nodes.map((_, i) => i));
  const components = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const members = [first];
    for (let cursor = 0; cursor < members.length; cursor++) {
      for (const next of neighbors[members[cursor]]) {
        if (remaining.delete(next)) {
          members.push(next);
        }
      }
    }
    const rootIndex = members.reduce((best, current) =>
      neighbors[current].size > neighbors[best].size ||
      (neighbors[current].size === neighbors[best].size && current < best)
        ? current
        : best,
    );
    const root = { index: rootIndex, depth: 0, children: [] };
    const pending = [root];
    const visited = new Set([rootIndex]);
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const parent = pending[cursor];
      for (const next of [...neighbors[parent.index]].sort((a, b) => a - b)) {
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        const child = { index: next, depth: parent.depth + 1, children: [] };
        parent.children.push(child);
        pending.push(child);
      }
    }
    const depth = pending.at(-1).depth;
    let points;
    if (!layoutInitialTree || depth > Math.sqrt(members.length)) {
      // A long thin tree is a poor radial approximation. Avoid both compressed
      // neighbors and hierarchy's ancestor-height work on a very deep chain.
      const angle = Math.PI * (3 - Math.sqrt(5));
      points = members
        .sort((a, b) => a - b)
        .map((nodeIndex, i) => {
          const radius = (spacing / 2) * Math.sqrt(i + 0.5);
          return {
            index: nodeIndex,
            x: radius * Math.cos(i * angle),
            y: radius * Math.sin(i * angle),
          };
        });
    } else {
      points = layoutInitialTree(root, spacing * depth);
    }
    const bounds = points.reduce(
      (box, point) => ({
        minX: Math.min(box.minX, point.x),
        minY: Math.min(box.minY, point.y),
        maxX: Math.max(box.maxX, point.x),
        maxY: Math.max(box.maxY, point.y),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    components.push({
      points,
      ...bounds,
      width: bounds.maxX - bounds.minX + spacing,
      height: bounds.maxY - bounds.minY + spacing,
    });
  }
  const rowLimit = Math.max(
    components.reduce(
      (width, component) => Math.max(width, component.width),
      0,
    ),
    Math.sqrt(
      components.reduce(
        (area, component) => area + component.width * component.height,
        0,
      ),
    ),
  );
  const packed = [];
  let x = 0,
    y = 0,
    rowHeight = 0,
    maxX = 0,
    maxY = 0;
  for (const component of components) {
    if (x && x + component.width > rowLimit) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    for (const point of component.points) {
      const position = {
        index: point.index,
        x: x + point.x - component.minX,
        y: y + point.y - component.minY,
      };
      maxX = Math.max(maxX, position.x);
      maxY = Math.max(maxY, position.y);
      packed.push(position);
    }
    x += component.width;
    rowHeight = Math.max(rowHeight, component.height);
  }
  return new Map(
    packed.map((point) => [
      nodes[point.index].id,
      {
        x: center.x + point.x - maxX / 2,
        y: center.y + point.y - maxY / 2,
      },
    ]),
  );
}
