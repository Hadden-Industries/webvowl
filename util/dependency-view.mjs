// SPDX-License-Identifier: AGPL-3.0-only
export const graphOutputBytes = 16 * 1024 * 1024;

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const compareRecord = (a, b) => compare(JSON.stringify(a), JSON.stringify(b));
const relationKind = (kind) => (kind === "source-reader" ? "reads-file" : kind);
const uncertaintyKinds = new Set([
  "file-read",
  "file-write",
  "dynamic-import",
  "process",
  "worker",
]);

/** Compose a single immutable, dependent-to-dependency view of an admitted snapshot. */
export function dependencyView(native, inventory, declarations, observations) {
  const paths = new Set(inventory);
  const nodes = new Map([...paths].map((path) => [path, "repository-file"]));
  const edges = new Map();
  const diagnostics = [...observations.diagnostics];
  const add = ({ from, to, kind, evidence }) => {
    for (const id of [from, to]) {
      if (nodes.has(id)) continue;
      const type = id.startsWith("artifact:")
        ? "artifact"
        : id.startsWith("check:")
          ? "verification-command"
          : "external";
      nodes.set(id, type);
    }
    // json-identity-contract: ordered-tuple; owner: Dependency edge identity; reason: The triple is the ordered dependent, dependency and relationship kind.
    const key = JSON.stringify([from, to, kind]);
    const existing = edges.get(key);
    if (existing) existing.evidence.push(...evidence);
    else edges.set(key, { from, to, kind, evidence: [...evidence] });
  };
  const blocked = native.summary.violations.filter(
    (item) =>
      item.rule.severity === "error" &&
      !(
        item.rule.name === "unresolved" &&
        observations.browserResolutions.has(
          JSON.stringify([item.from, item.to]),
        )
      ),
  );
  for (const module of native.modules) {
    if (!paths.has(module.source)) continue;
    for (const dependency of module.dependencies) {
      if (dependency.couldNotResolve) continue;
      const from = module.source;
      const to = paths.has(dependency.resolved)
        ? dependency.resolved
        : "external:" +
          (dependency.coreModule ? "node:" : "npm:") +
          dependency.module;
      add({
        from,
        to,
        kind: "imports",
        evidence: [
          {
            source: from,
            specifier: dependency.module,
            context: "node",
            origin: "native",
          },
        ],
      });
    }
  }
  for (const edge of observations.edges) add(edge);
  for (const declaration of declarations) {
    const { consumer, dependency, kind, id, evidence, fixture } = declaration;
    const matches = dependency.endsWith("/")
      ? [...paths].filter((path) => path.startsWith(dependency))
      : paths.has(dependency)
        ? [dependency]
        : [];
    if (!paths.has(consumer) || !matches.length) {
      diagnostics.push({
        source: consumer,
        kind: "stale-relation",
        relationId: id,
        reason: "declared endpoint missing",
      });
      continue;
    }
    for (const to of matches) {
      if (to === consumer) continue;
      add({
        from: consumer,
        to,
        kind: relationKind(kind),
        evidence: [
          {
            source: consumer,
            context: "impact-policy",
            origin: "declared",
            relationId: id,
            note: evidence,
            fixture,
          },
        ],
      });
    }
  }
  const frozen = (items) => Object.freeze(items.map(Object.freeze));
  return Object.freeze({
    schemaVersion: 1,
    nodes: frozen(
      [...nodes]
        .sort(([a], [b]) => compare(a, b))
        .map(([id, kind]) => ({ id, kind })),
    ),
    edges: frozen(
      [...edges.entries()]
        .sort(([a], [b]) => compare(a, b))
        .map(([, edge]) => ({
          ...edge,
          evidence: frozen(edge.evidence.sort(compareRecord)),
        })),
    ),
    resourceDiagnostics: frozen(diagnostics.sort(compareRecord)),
    browserResolutions: Object.freeze(
      [...observations.browserResolutions]
        .sort()
        .map((key) => Object.freeze(JSON.parse(key))),
    ),
    blockingFindings: frozen(blocked),
  });
}

const graphIndexes = new WeakMap();

function createWitnessBudget(maximumBytes = graphOutputBytes) {
  const sizes = new WeakMap();
  let remaining = maximumBytes;
  return (record) => {
    let bytes = sizes.get(record);
    if (bytes === undefined) {
      bytes = Buffer.byteLength(JSON.stringify(record));
      sizes.set(record, bytes);
    }
    remaining -= bytes;
    if (remaining < 0)
      throw new Error("Dependency witnesses exceed the graph output budget");
  };
}

function indexGraph(graph) {
  const existing = graphIndexes.get(graph);
  if (existing) return existing;
  const nodes = new Set(graph.nodes.map((node) => node.id));
  const consumers = new Map();
  const dependencies = new Map();
  for (const edge of graph.edges) {
    const inbound = consumers.get(edge.to) ?? [];
    inbound.push(edge);
    consumers.set(edge.to, inbound);
    const outbound = dependencies.get(edge.from) ?? [];
    outbound.push(edge.to);
    dependencies.set(edge.from, outbound);
  }
  const index = { nodes, consumers, dependencies };
  graphIndexes.set(graph, index);
  return index;
}

/** Walk one snapshot. Predecessor edges retain deterministic shortest witnesses. */
function walk(graph, seeds) {
  const { nodes, consumers } = indexGraph(graph);
  const queue = [...new Set(seeds)].filter((seed) => nodes.has(seed)).sort();
  const previous = new Map(queue.map((seed) => [seed, null]));
  const roots = new Map(queue.map((seed) => [seed, seed]));
  for (let offset = 0; offset < queue.length; offset++) {
    const dependency = queue[offset];
    for (const edge of consumers.get(dependency) ?? []) {
      if (previous.has(edge.from)) continue;
      previous.set(edge.from, edge);
      roots.set(edge.from, roots.get(dependency));
      queue.push(edge.from);
    }
  }
  return {
    previous,
    roots,
    pathTo(id, reserve) {
      const path = [];
      for (let edge = previous.get(id); edge; edge = previous.get(edge.to)) {
        reserve(edge);
        path.push(edge);
      }
      return path.reverse();
    },
  };
}

export function focusDependencyView(graph, target, maximumWitnessBytes) {
  const { nodes, consumers } = indexGraph(graph);
  if (!nodes.has(target)) throw new Error("Unknown graph focus: " + target);
  const reached = walk(graph, [target]);
  const reserve = createWitnessBudget(maximumWitnessBytes);
  const dependents = [...reached.previous.keys()]
    .filter((id) => id !== target)
    .sort();
  return {
    schemaVersion: 1,
    target,
    directConsumers: [
      ...new Set((consumers.get(target) ?? []).map((edge) => edge.from)),
    ].sort(),
    transitiveConsumers: dependents,
    paths: Object.fromEntries(
      dependents.map((id) => [id, reached.pathTo(id, reserve)]),
    ),
    diagnostics: graph.resourceDiagnostics.filter(
      (item) => item.source === target || item.target === target,
    ),
  };
}

export function viewContains(graph, path) {
  return indexGraph(graph).nodes.has(path);
}

function inputsOfTests(graph, tests) {
  const { nodes, dependencies } = indexGraph(graph);
  const queue = tests.filter((test) => nodes.has(test));
  const inputs = new Set(queue);
  for (let offset = 0; offset < queue.length; offset++) {
    for (const input of dependencies.get(queue[offset]) ?? []) {
      if (inputs.has(input)) continue;
      inputs.add(input);
      queue.push(input);
    }
  }
  return inputs;
}

/** Union independently witnessed base and current impacts, keeping a reason for each selected file. */
export function selectDependencyTests(graphs, changed, tests, resourcePaths) {
  const reserve = createWitnessBudget();
  const reasons = new Map(),
    appliedRules = new Set(),
    checks = new Set();
  const witnessedResources = new Set();
  const changeSet = new Set(changed);
  const resourceSet = new Set(resourcePaths);
  for (const [snapshot, graph] of graphs) {
    const direct = walk(graph, changed);
    const bySource = new Map();
    if (changed.length) {
      for (const item of graph.resourceDiagnostics) {
        if (
          !uncertaintyKinds.has(item.kind) ||
          (item.target &&
            !changed.some(
              (path) =>
                path === item.target || path.startsWith(item.target + "/"),
            ))
        )
          continue;
        const prior = bySource.get(item.source) ?? [];
        prior.push(item);
        bySource.set(item.source, prior);
      }
    }
    const uncertain = walk(graph, bySource.keys());
    for (const reached of [direct, uncertain]) {
      for (const target of reached.previous.keys())
        if (target.startsWith("check:")) checks.add(target);
    }
    // Every supported fixture seed needs a real consumer path. A diagnostic
    // can widen the decision, but cannot establish ownership of the fixture.
    if (resourceSet.size) {
      const testInputs = inputsOfTests(graph, tests);
      const { consumers } = indexGraph(graph);
      for (const path of resourceSet) {
        if (
          (consumers.get(path) ?? []).some(
            (edge) =>
              edge.kind === "reads-file" &&
              testInputs.has(edge.from) &&
              edge.evidence.some((item) => item.origin === "source"),
          )
        )
          witnessedResources.add(path);
      }
    }
    for (const test of tests) {
      const known = direct.previous.has(test);
      if (!known && !uncertain.previous.has(test)) continue;
      const trace = known ? direct : uncertain;
      const seed = trace.roots.get(test);
      const path = trace.pathTo(test, reserve);
      if (!known) reserve(bySource.get(seed));
      const directRelations = [
        ...new Set(
          path
            .flatMap((edge) => edge.evidence)
            .map((item) => item.relationId)
            .filter(Boolean),
        ),
      ].sort();
      for (const id of directRelations) appliedRules.add(id);
      const reason = {
        kind: changeSet.has(test)
          ? "direct-change"
          : !known
            ? "unresolved-consumer"
            : directRelations.length
              ? "declared-relation"
              : "dependency-path",
        snapshot,
        seed,
        path,
        directRelations,
        ...(known ? {} : { diagnostics: bySource.get(seed) }),
      };
      const old = reasons.get(test);
      if (
        !old ||
        (known && old.kind === "unresolved-consumer") ||
        (known === (old.kind !== "unresolved-consumer") &&
          path.length < old.path.length)
      )
        reasons.set(test, reason);
    }
  }
  const selected = [...reasons.keys()].sort();
  return {
    selected,
    reasons: Object.fromEntries(
      selected.map((test) => [test, reasons.get(test)]),
    ),
    appliedRules: [...appliedRules].sort(),
    checks: [...checks].sort(),
    unseenResources: resourcePaths.filter(
      (path) => !witnessedResources.has(path),
    ),
  };
}
