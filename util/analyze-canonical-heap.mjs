import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";

function readHeap(path) {
  const heap = JSON.parse(readFileSync(path, "utf8"));
  const nf = heap.snapshot.meta.node_fields;
  const ef = heap.snapshot.meta.edge_fields;
  const nw = nf.length;
  const ew = ef.length;
  const ni = Object.fromEntries(nf.map((field, index) => [field, index]));
  const ei = Object.fromEntries(ef.map((field, index) => [field, index]));
  const nodeTypes = heap.snapshot.meta.node_types[ni.type];
  const edgeTypes = heap.snapshot.meta.edge_types[ei.type];
  const count = heap.nodes.length / nw;
  const starts = new Uint32Array(count + 1);
  const ids = new Map();
  let offset = 0;
  for (let index = 0; index < count; index++) {
    starts[index] = offset;
    ids.set(heap.nodes[index * nw + ni.id], index);
    offset += heap.nodes[index * nw + ni.edge_count] * ew;
  }
  starts[count] = offset;
  assert.equal(offset, heap.edges.length, "complete heap edge inventory");
  const name = (node) => heap.strings[heap.nodes[node * nw + ni.name]];
  const type = (node) => nodeTypes[heap.nodes[node * nw + ni.type]];
  const id = (node) => heap.nodes[node * nw + ni.id];
  function edges(node) {
    const result = [];
    for (let edge = starts[node]; edge < starts[node + 1]; edge += ew) {
      const kind = edgeTypes[heap.edges[edge + ei.type]];
      const key = heap.edges[edge + ei.name_or_index];
      result.push({
        type: kind,
        name: kind === "element" || kind === "hidden" ? key : heap.strings[key],
        target: heap.edges[edge + ei.to_node] / nw,
      });
    }
    return result;
  }
  const property = (node, key) =>
    edges(node).find((edge) => edge.type === "property" && edge.name === key)
      ?.target;
  function rootPaths(targets) {
    const parents = new Int32Array(count).fill(-1);
    const labels = new Map();
    const queue = new Uint32Array(count);
    let tail = 1;
    queue[0] = 0;
    parents[0] = 0;
    for (let head = 0; head < tail; head++) {
      const node = queue[head];
      for (const edge of edges(node)) {
        if (edge.type === "weak" || parents[edge.target] !== -1) continue;
        parents[edge.target] = node;
        labels.set(edge.target, `${edge.type}:${edge.name}`);
        queue[tail++] = edge.target;
      }
    }
    return targets.map((target) => {
      if (parents[target] === -1) return null;
      const path = [];
      for (let node = target; node !== 0; node = parents[node]) {
        path.push({ id: id(node), name: name(node), edge: labels.get(node) });
      }
      return path.reverse();
    });
  }
  function census() {
    const families = new Map();
    let elementOwnClosures = 0;
    let elementClosureShallowBytes = 0;
    for (let node = 0; node < count; node++) {
      if (type(node) !== "object") continue;
      const own = edges(node).filter((edge) => edge.type === "property");
      const method = (key) =>
        own.some(
          (edge) => edge.name === key && type(edge.target) === "closure",
        );
      const baseElement = method("id") && method("iri") && method("attributes");
      if (
        !baseElement &&
        !/^(PlainLink|ArrowLink|BoxArrowLink)$/u.test(name(node))
      )
        continue;
      const family = families.get(name(node)) ?? {
        constructor: name(node),
        objects: 0,
        shallowBytes: 0,
        ownFunctionProperties: 0,
      };
      family.objects++;
      family.shallowBytes += heap.nodes[node * nw + ni.self_size];
      for (const edge of own) {
        if (type(edge.target) !== "closure") continue;
        family.ownFunctionProperties++;
        if (baseElement) {
          elementOwnClosures++;
          elementClosureShallowBytes +=
            heap.nodes[edge.target * nw + ni.self_size];
        }
      }
      families.set(name(node), family);
    }
    return {
      families: [...families.values()],
      elementOwnClosures,
      elementClosureShallowBytes,
      limit:
        "Own closure shallow sizes are not retained-size savings; shared contexts and callback contracts require separate qualification.",
    };
  }
  return { count, ids, name, type, id, edges, property, rootPaths, census };
}

export function analyzeCanonicalHeap(livePath, retiredPath) {
  const live = readHeap(livePath);
  const roots = [];
  for (let node = 0; node < live.count; node++) {
    const target = live.property(node, "performanceSearchHeapCheckpoint");
    if (target !== undefined) roots.push(target);
  }
  assert(roots.length > 0, "live positive-control checkpoint exists");
  const ownersArray = live.property(roots[0], "owners");
  assert.notEqual(ownersArray, undefined);
  const owners = live
    .edges(ownersArray)
    .filter((edge) => edge.type === "element")
    .map(({ target }) => {
      const owner = live.property(target, "owner");
      const kind = live.name(live.property(target, "kind"));
      assert.notEqual(owner, undefined, `positive control ${kind}`);
      return {
        kind,
        id: live.id(owner),
        constructor: live.name(owner),
        node: owner,
      };
    });
  assert.equal(owners.length, 7, "all named live owners captured");
  assert.deepEqual(
    owners.map(({ kind }) => kind).sort(),
    [
      "controller",
      "graph",
      "preparation",
      "runtime",
      "scene",
      "session",
      "worker",
    ],
    "each required live owner is distinct",
  );
  const paths = live.rootPaths(owners.map((owner) => owner.node));
  assert(
    paths.every(Boolean),
    "every positive control has a strong live root path",
  );
  const liveCensus = live.census();
  const retired = readHeap(retiredPath);
  const present = owners.filter((owner) => retired.ids.has(owner.id));
  const survivorPaths = retired.rootPaths(
    present.map((owner) => retired.ids.get(owner.id)),
  );
  const survivingStrongOwners = present.filter(
    (_, index) => survivorPaths[index],
  );
  return {
    status: survivingStrongOwners.length === 0 ? "passed" : "failed",
    method:
      "Stable V8 object IDs across positive-control live and post-disposal snapshots. Strong root traversal excludes weak edges; absent IDs need no inferred retainer path.",
    liveNodes: live.count,
    retiredNodes: retired.count,
    owners: owners.map(({ kind, id, constructor }, index) => ({
      kind,
      id,
      constructor,
      livePath: paths[index],
    })),
    presentAfterRetirement: present.map(({ kind, id, constructor }) => ({
      kind,
      id,
      constructor,
    })),
    survivingStrongOwners: survivingStrongOwners.map(
      ({ kind, id, constructor }) => ({ kind, id, constructor }),
    ),
    survivorPaths,
    liveCensus,
    retiredCensus: retired.census(),
    limitations:
      "Main-target JavaScript heap only. Native allocations and terminated worker heaps are separate observations. Instrumentation intentionally owns live controls and is removed before retirement capture.",
  };
}

if (process.argv[1]?.endsWith("analyze-canonical-heap.mjs")) {
  const result = analyzeCanonicalHeap(process.argv[2], process.argv[3]);
  writeFileSync(process.argv[4], JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(JSON.stringify(result));
  if (result.status !== "passed") process.exitCode = 1;
}
