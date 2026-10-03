import { closeVowlVisibility } from "./canonicalVowlScene.js";

export const CANONICAL_VISIBLE_FILTERS = Object.freeze({
  datatypes: "show",
  objectProperties: "show",
  subclasses: "show",
  disjointness: "show",
  setOperators: "show",
  minDegree: 0,
});

/** Visibility controls select admitted occurrences; they never rebuild topology. */
export function prepareCanonicalVisibility(
  inspection,
  filters,
  retainedHidden = [],
) {
  const occurrences = inspection.occurrences;
  const records = new Map(
    [...inspection.records.roles, ...inspection.records.expressions].map(
      (record) => [record.id, record],
    ),
  );
  const byId = new Map(occurrences.map((record) => [record.id, record]));
  const hidden = new Set(retainedHidden.filter((id) => byId.has(id)));
  const degree = new Map();
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
    const endpoints = occurrence.ends ?? [occurrence.from, occurrence.to];
    if (
      occurrence.kind.endsWith("-edge") &&
      !endpoints.some((id) => byId.get(id)?.kind === "datatype-node")
    ) {
      for (const id of new Set(endpoints)) {
        if (id !== undefined) {
          degree.set(id, (degree.get(id) ?? 0) + 1);
        }
      }
    }
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
  if (filters.minDegree > 0) {
    for (const occurrence of occurrences) {
      if (
        occurrence.kind === "class-node" &&
        (degree.get(occurrence.id) ?? 0) < filters.minDegree
      ) {
        hidden.add(occurrence.id);
      }
    }
  }
  let maximumDegree = 0;
  for (const value of degree.values()) {
    maximumDegree = Math.max(maximumDegree, value);
  }
  return {
    hidden: closeVowlVisibility(occurrences, [...hidden]),
    maximumDegree,
  };
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
