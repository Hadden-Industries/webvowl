export const NODE_RANKING_POLICY_VERSION = "connected-sqrt-v1";
const compareKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const isCountedOccurrence = ({ kind }) =>
  kind === "class-node" || kind === "datatype-node";

// Indexed frontier: priority changes touch only neighbors of the emitted node.
// The same bounded queue merges component heads; no stale heap entries accrue.
class RankingFrontier {
  constructor(compare) {
    this.compare = compare;
    this.rows = [];
    this.positions = new Map();
  }
  swap(a, b) {
    [this.rows[a], this.rows[b]] = [this.rows[b], this.rows[a]];
    this.positions.set(this.rows[a], a);
    this.positions.set(this.rows[b], b);
  }
  up(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.rows[index], this.rows[parent]) >= 0) {
        break;
      }
      this.swap(index, parent);
      index = parent;
    }
    return index;
  }
  down(index) {
    for (;;) {
      let best = index;
      for (const child of [index * 2 + 1, index * 2 + 2]) {
        if (
          child < this.rows.length &&
          this.compare(this.rows[child], this.rows[best]) < 0
        ) {
          best = child;
        }
      }
      if (best === index) {
        return;
      }
      this.swap(index, best);
      index = best;
    }
  }
  update(row) {
    let index = this.positions.get(row);
    if (index === undefined) {
      index = this.rows.length;
      this.rows.push(row);
      this.positions.set(row, index);
    }
    this.down(this.up(index));
  }
  take() {
    const first = this.rows[0];
    const last = this.rows.pop();
    this.positions.delete(first);
    if (this.rows.length) {
      this.rows[0] = last;
      this.positions.set(last, 0);
      this.down(0);
    }
    return first;
  }
}

/** One complete occurrence permutation; count/camera/placement never enter it. */
export function rankCanonicalNodeOccurrences(
  occurrences,
  upstreamHidden,
  identity,
) {
  const hidden = new Set(upstreamHidden);
  const keys = new Map(
    identity.correspondence.map(({ previous, current }) => [previous, current]),
  );
  const nodes = new Map(
    occurrences
      .filter((row) => isCountedOccurrence(row) && !hidden.has(row.id))
      .map(({ id }) => [
        id,
        {
          id,
          key: keys.get(id),
          neighbors: new Set(),
          incident: 0,
          selectedNeighbors: 0,
        },
      ]),
  );
  if (
    [...nodes.values()].some(({ key }) => typeof key !== "string") ||
    new Set([...nodes.values()].map(({ key }) => key)).size !== nodes.size
  ) {
    throw new TypeError(
      "Complete, unique native node ranking identity is required.",
    );
  }
  for (const edge of occurrences) {
    if (!edge.kind.endsWith("-edge") || hidden.has(edge.id)) {
      continue;
    }
    const endpoints = [...new Set(edge.ends ?? [edge.from, edge.to])].filter(
      (id) => nodes.has(id),
    );
    // Visibility closure has already removed edges with ineligible endpoints.
    for (const id of endpoints) {
      const node = nodes.get(id);
      node.incident += 1;
      for (const other of endpoints) {
        if (other !== id) {
          node.neighbors.add(other);
        }
      }
    }
  }
  const compareNode = (a, b) =>
    b.selectedNeighbors - a.selectedNeighbors ||
    b.neighbors.size - a.neighbors.size ||
    b.incident - a.incident ||
    compareKey(a.key, b.key);
  const remaining = new Set(nodes.keys());
  const components = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    const pending = [start];
    remaining.delete(start);
    const members = [];
    while (pending.length) {
      const node = nodes.get(pending.pop());
      members.push(node);
      for (const id of node.neighbors) {
        if (remaining.delete(id)) {
          pending.push(id);
        }
      }
    }
    let seed = members[0];
    let key = seed.key;
    for (const node of members) {
      if (compareNode(node, seed) < 0) {
        seed = node;
      }
      if (compareKey(node.key, key) < 0) {
        key = node.key;
      }
    }
    const frontier = new RankingFrontier(compareNode);
    frontier.update(seed);
    const selected = new Set();
    const sequence = [];
    while (frontier.rows.length) {
      const node = frontier.take();
      selected.add(node.id);
      sequence.push(node.id);
      for (const id of node.neighbors) {
        if (selected.has(id)) {
          continue;
        }
        const neighbor = nodes.get(id);
        neighbor.selectedNeighbors += 1;
        frontier.update(neighbor);
      }
    }
    components.push({
      sequence,
      key,
      emitted: 0,
      size: BigInt(sequence.length),
    });
  }
  // Square priorities and cross-multiply exactly: no floating-point sqrt ties.
  const merger = new RankingFrontier((a, b) => {
    const left = a.size * BigInt(b.emitted + 1) ** 2n;
    const right = b.size * BigInt(a.emitted + 1) ** 2n;
    return left > right ? -1 : left < right ? 1 : compareKey(a.key, b.key);
  });
  for (const component of components) {
    merger.update(component);
  }
  const order = [];
  while (merger.rows.length) {
    const component = merger.take();
    order.push(component.sequence[component.emitted++]);
    if (component.emitted < component.sequence.length) {
      merger.update(component);
    }
  }
  return Object.freeze(order);
}
