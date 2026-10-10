import {
  assertCurrentOntologyElementReference,
  ontologyElementReferenceKey,
  resolveOntologyElementReference,
} from "./webVowlControllerContracts.js";

export const CANONICAL_NEIGHBORHOOD_LIMITS = Object.freeze({
  references: 25,
  nodes: 500,
  edges: 1000,
  labels: 2000,
  adjacencyEntries: 10000,
});

/** Revision-owned index over admitted occurrences, independent of visibility. */
export function createCanonicalSearchProjection(
  inspection,
  references,
  loadGeneration,
) {
  const occurrences = inspection.occurrences;
  const nodes = new Map();
  const edges = new Map();
  const labelsByEdge = new Map();
  const incidence = new Map();
  const seedsByReference = new Map();
  const constructs = new Map(
    inspection.records.constructs.map((row) => [row.id, row]),
  );
  const expressions = new Map(
    inspection.records.expressions.map((row) => [row.id, row]),
  );
  const semanticReferences = [...references.values()];
  let indexEntryCount = occurrences.length;
  function seed(recordId, occurrenceId) {
    const reference = references.get(recordId);
    if (!reference) {
      return;
    }
    const key = ontologyElementReferenceKey(reference);
    if (!seedsByReference.has(key)) {
      seedsByReference.set(key, new Set());
    }
    seedsByReference.get(key).add(occurrenceId);
    indexEntryCount++;
  }
  for (const row of occurrences) {
    if (["class-node", "datatype-node"].includes(row.kind)) {
      nodes.set(row.id, row);
      incidence.set(row.id, []);
      for (const id of row.targets ?? [row.target]) {
        seed(id, row.id);
      }
    } else if (row.kind === "label") {
      if (!labelsByEdge.has(row.edge)) {
        labelsByEdge.set(row.edge, []);
      }
      labelsByEdge.get(row.edge).push(row.id);
      indexEntryCount++;
    } else {
      const ends = [...new Set(row.ends ?? [row.from, row.to])];
      edges.set(row.id, { row, ends });
      const property = expressions.get(
        constructs.get(row.construct)?.super,
      )?.property;
      for (const id of row.properties ?? [
        ...(row.forward ?? []),
        ...(row.reverse ?? []),
        property,
      ]) {
        seed(id, row.id);
      }
    }
  }
  for (const [id, { ends }] of edges) {
    for (const node of ends) {
      incidence.get(node).push(id);
      indexEntryCount++;
    }
  }
  return Object.freeze({
    indexEntryCount,
    plan(requestedReferences) {
      const counts = { nodes: 0, edges: 0, labels: 0, adjacencyEntries: 0 };
      const refuse = (reason) =>
        Object.freeze({
          canReveal: false,
          reason,
          counts: Object.freeze({ ...counts }),
        });
      if (
        !Array.isArray(requestedReferences) ||
        requestedReferences.length === 0 ||
        requestedReferences.length > CANONICAL_NEIGHBORHOOD_LIMITS.references
      ) {
        return refuse("reference-limit");
      }
      const includedNodes = new Set();
      const inspectedEdges = new Set();
      const includeNode = (id) => {
        includedNodes.add(id);
        counts.nodes = includedNodes.size;
        return counts.nodes <= CANONICAL_NEIGHBORHOOD_LIMITS.nodes;
      };
      for (const requested of requestedReferences) {
        const valid = assertCurrentOntologyElementReference(
          requested,
          loadGeneration,
        );
        const exact = resolveOntologyElementReference(
          valid,
          semanticReferences,
        );
        const seeds =
          exact && seedsByReference.get(ontologyElementReferenceKey(exact));
        if (!seeds?.size) {
          return refuse("no-drawable-neighborhood");
        }
        for (const id of seeds) {
          if (
            ++counts.adjacencyEntries >
            CANONICAL_NEIGHBORHOOD_LIMITS.adjacencyEntries
          ) {
            return refuse("adjacency-limit");
          }
          for (const node of nodes.has(id) ? [id] : edges.get(id).ends) {
            if (!includeNode(node)) {
              return refuse("node-limit");
            }
          }
        }
      }
      let frontier = [...includedNodes];
      for (let depth = 0; depth < 2; depth++) {
        const next = [];
        for (const node of frontier) {
          for (const id of incidence.get(node)) {
            if (
              ++counts.adjacencyEntries >
              CANONICAL_NEIGHBORHOOD_LIMITS.adjacencyEntries
            ) {
              return refuse("adjacency-limit");
            }
            inspectedEdges.add(id);
            for (const neighbor of edges.get(id).ends) {
              if (!includedNodes.has(neighbor)) {
                if (!includeNode(neighbor)) {
                  return refuse("node-limit");
                }
                next.push(neighbor);
              }
            }
          }
        }
        frontier = next;
      }
      // Inspect incidence of the boundary too: include every induced edge,
      // including parallel links and links between two depth-two nodes.
      for (const node of includedNodes) {
        for (const id of incidence.get(node)) {
          if (
            ++counts.adjacencyEntries >
            CANONICAL_NEIGHBORHOOD_LIMITS.adjacencyEntries
          ) {
            return refuse("adjacency-limit");
          }
          inspectedEdges.add(id);
        }
      }
      const included = new Set(includedNodes);
      for (const id of inspectedEdges) {
        if (
          ++counts.adjacencyEntries >
          CANONICAL_NEIGHBORHOOD_LIMITS.adjacencyEntries
        ) {
          return refuse("adjacency-limit");
        }
        if (!edges.get(id).ends.every((node) => includedNodes.has(node))) {
          continue;
        }
        if (++counts.edges > CANONICAL_NEIGHBORHOOD_LIMITS.edges) {
          return refuse("edge-limit");
        }
        included.add(id);
        for (const label of labelsByEdge.get(id) ?? []) {
          if (
            ++counts.adjacencyEntries >
            CANONICAL_NEIGHBORHOOD_LIMITS.adjacencyEntries
          ) {
            return refuse("adjacency-limit");
          }
          if (++counts.labels > CANONICAL_NEIGHBORHOOD_LIMITS.labels) {
            return refuse("label-limit");
          }
          included.add(label);
        }
      }
      return Object.freeze({
        canReveal: true,
        counts: Object.freeze(counts),
        hidden: occurrences
          .filter(({ id }) => !included.has(id))
          .map(({ id }) => id),
      });
    },
  });
}
