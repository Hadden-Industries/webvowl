import { closeVowlVisibility } from "./canonicalVowlScene.js";
import {
  rankCanonicalNodeOccurrences,
  NODE_RANKING_POLICY_VERSION,
} from "./canonicalNodeOrdering.js";
import {
  createNodesShownIntent,
  rejectObsoleteNodeSelection,
} from "./nodesShownContracts.js";

export const CANONICAL_VISIBLE_FILTERS = Object.freeze({
  datatypes: "show",
  objectProperties: "show",
  subclasses: "show",
  disjointness: "show",
  setOperators: "show",
});

/** Visibility controls select admitted occurrences; they never rebuild topology. */
export function prepareCanonicalVisibility(
  inspection,
  filters,
  retainedHidden = [],
) {
  rejectObsoleteNodeSelection(filters);
  const occurrences = inspection.occurrences;
  const records = new Map(
    [...inspection.records.roles, ...inspection.records.expressions].map(
      (record) => [record.id, record],
    ),
  );
  const byId = new Map(occurrences.map((record) => [record.id, record]));
  const hidden = new Set(retainedHidden.filter((id) => byId.has(id)));
  const constructs = new Map(
    inspection.records.constructs.map((record) => [record.id, record]),
  );
  function objectPropertyEdge(edge) {
    if (edge.kind === "inverse-edge") {
      return true;
    }
    if (edge.kind === "restriction-edge") {
      const assertion = constructs.get(edge.construct);
      return records.get(assertion?.super)?.kind.startsWith("object-") ?? false;
    }
    return (
      edge.properties?.some(
        (id) => records.get(id)?.kind === "object-property",
      ) ?? false
    );
  }
  for (const occurrence of occurrences) {
    if (
      (filters.datatypes === "hide" && occurrence.kind === "datatype-node") ||
      (filters.objectProperties === "hide" && objectPropertyEdge(occurrence)) ||
      (filters.subclasses === "hide" && occurrence.kind === "subclass-edge") ||
      (filters.disjointness === "hide" &&
        occurrence.kind === "disjoint-edge") ||
      (filters.setOperators === "hide" &&
        occurrence.kind === "class-node" &&
        occurrence.targets.some((id) =>
          ["class-union", "class-intersection", "class-complement"].includes(
            records.get(id)?.kind,
          ),
        ))
    ) {
      hidden.add(occurrence.id);
    }
  }
  return { hidden: closeVowlVisibility(occurrences, [...hidden]) };
}

export function canonicalLabelSelection(language) {
  if (language === "IRI-based") {
    return { mode: "iri" };
  }
  if (["undefined", "default"].includes(language)) {
    return { mode: "untagged" };
  }
  return { mode: "language", range: language };
}

/** Cache one ranking per eligibility signature within a structural revision. */
export function createCanonicalNodeSelector(inspection, identity) {
  let signature;
  let upstreamHidden;
  let rankedNodeOccurrenceIds;
  let appliedCount = 0;
  let hidden;
  const byId = new Map(inspection.occurrences.map((row) => [row.id, row]));
  const incident = new Map();
  const labels = new Map();
  for (const row of inspection.occurrences) {
    if (row.kind === "label") {
      if (!labels.has(row.edge)) {
        labels.set(row.edge, []);
      }
      labels.get(row.edge).push(row.id);
    }
    if (row.kind.endsWith("-edge")) {
      for (const id of new Set(row.ends ?? [row.from, row.to])) {
        if (!incident.has(id)) {
          incident.set(id, []);
        }
        incident.get(id).push(row.id);
      }
    }
  }
  return (
    filters,
    nodesShown,
    retainedHidden = [],
    { measure = true } = {},
  ) => {
    const startedAt = performance.now();
    const intent = createNodesShownIntent(nodesShown);
    const nextSignature = JSON.stringify([filters, [...retainedHidden].sort()]);
    const rankingCacheReused = signature === nextSignature;
    if (signature !== nextSignature) {
      upstreamHidden = prepareCanonicalVisibility(
        inspection,
        filters,
        retainedHidden,
      ).hidden;
      rankedNodeOccurrenceIds = rankCanonicalNodeOccurrences(
        inspection.occurrences,
        upstreamHidden,
        identity,
      );
      signature = nextSignature;
      appliedCount = 0;
      hidden = new Set(
        closeVowlVisibility(inspection.occurrences, [
          ...upstreamHidden,
          ...rankedNodeOccurrenceIds,
        ]),
      );
    }
    const eligibleNodeCount = rankedNodeOccurrenceIds.length;
    const shownNodeCount = Math.min(
      eligibleNodeCount,
      intent.mode === "all"
        ? eligibleNodeCount
        : intent.mode === "auto"
          ? 50
          : intent.requestedCount,
    );
    const countHiddenOccurrenceIds =
      rankedNodeOccurrenceIds.slice(shownNodeCount);
    const upstream = new Set(upstreamHidden);
    for (
      let index = Math.min(appliedCount, shownNodeCount);
      index < Math.max(appliedCount, shownNodeCount);
      index++
    ) {
      const id = rankedNodeOccurrenceIds[index];
      if (shownNodeCount > appliedCount) {
        hidden.delete(id);
      } else {
        hidden.add(id);
      }
      for (const edgeId of incident.get(id) ?? []) {
        const edge = byId.get(edgeId);
        const excluded =
          upstream.has(edgeId) ||
          (edge.ends ?? [edge.from, edge.to]).some((end) => hidden.has(end));
        if (excluded) {
          hidden.add(edgeId);
        } else {
          hidden.delete(edgeId);
        }
        for (const label of labels.get(edgeId) ?? []) {
          if (excluded || upstream.has(label)) {
            hidden.add(label);
          } else {
            hidden.delete(label);
          }
        }
      }
    }
    appliedCount = shownNodeCount;
    if (measure) {
      performance.clearMeasures("webvowl.node-selection");
      performance.measure("webvowl.node-selection", {
        start: startedAt,
        end: performance.now(),
        detail: {
          rankingCacheReused,
          eligibleNodeCount,
          shownNodeCount,
          nodeRankingPolicyVersion: NODE_RANKING_POLICY_VERSION,
        },
      });
    }
    return {
      hidden: [...hidden],
      rankedNodeOccurrenceIds,
      countHiddenOccurrenceIds,
      nodeCountStatus: {
        eligibleNodeCount,
        shownNodeCount,
        nodeRankingPolicyVersion: NODE_RANKING_POLICY_VERSION,
      },
    };
  };
}
