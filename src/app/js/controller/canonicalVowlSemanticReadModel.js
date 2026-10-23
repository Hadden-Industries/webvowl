import isEqual from "lodash/isEqual.js";
import { prepareOntologyQueries } from "./ontologyInspector.js";
import { createCanonicalSearchProjection } from "./canonicalSearchProjection.js";
import { createCanonicalSemanticReferences } from "./canonicalVowlInspectionProjector.js";
import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";
import { prepareCanonicalVisibility } from "./canonicalVowlViewControls.js";
import { ontologyElementReferenceKey } from "./webVowlControllerContracts.js";

/**
 * Own semantic preparation for one accepted revision and presentation. Inputs
 * borrow the session's frozen inspections and a private scene snapshot. Query
 * results own mutable values or share frozen ones; indexes never escape.
 * Visibility is supplied per operation, while pan, selection and viewport do
 * not change semantic identity. Public result bounds belong to the controller.
 */
export function createCanonicalVowlSemanticReadModel({
  inspection,
  ontologyInspection,
  visualization,
  loadGeneration,
  targetForRecord,
  selectNodes,
}) {
  const queries = prepareOntologyQueries(ontologyInspection);
  let references;
  let neighborhood;
  let projection;
  let reveal;
  function semanticReferences() {
    references ??= createCanonicalSemanticReferences(
      inspection,
      loadGeneration,
      targetForRecord,
    );
    return references;
  }
  return Object.freeze({
    ...queries,
    planNeighborhood(requestedReferences) {
      neighborhood ??= createCanonicalSearchProjection(
        inspection,
        semanticReferences(),
        loadGeneration,
      );
      // Refusal on the existing neighborhood safety budget is not truncation.
      return neighborhood.plan(requestedReferences);
    },
    /** Return every requested semantic rank that is eligible under these inputs. */
    revealRanks({ filters, nodesShown, upstreamHidden }, requestedReferences) {
      // Node-count intent changes the shown prefix, not the eligibility ranking.
      // The caller combines these ranks with its current shown count. Geometry
      // and presentation do not alter occurrence-to-record connectivity.
      const signature = structuredClone([filters, upstreamHidden]);
      if (!isEqual(reveal?.signature, signature)) {
        const visibility = selectNodes(filters, nodesShown, upstreamHidden, {
          measure: false,
        });
        const ranks = new Map(
          visibility.rankedNodeOccurrenceIds.map((id, index) => [
            id,
            index + 1,
          ]),
        );
        const upstream = new Set(
          prepareCanonicalVisibility(inspection, filters, upstreamHidden)
            .hidden,
        );
        projection ??= createCanonicalVowlRenderProjection(
          inspection,
          visualization,
        );
        const requiredByOccurrence = new Map(
          projection.nodes.map((row) => [
            row.occurrence,
            ranks.get(row.occurrence),
          ]),
        );
        for (const edge of projection.edges) {
          const ends = [ranks.get(edge.from), ranks.get(edge.to)];
          if (ends.every((rank) => rank !== undefined)) {
            requiredByOccurrence.set(edge.occurrence, Math.max(...ends));
          }
        }
        for (const label of projection.labels) {
          requiredByOccurrence.set(
            label.occurrence,
            requiredByOccurrence.get(label.edge),
          );
        }
        const byElement = new Map();
        for (const row of [
          ...projection.nodes,
          ...projection.edges,
          ...projection.labels,
        ]) {
          const rank = requiredByOccurrence.get(row.occurrence);
          if (rank === undefined || upstream.has(row.occurrence)) {
            continue;
          }
          for (const id of row.targets ?? row.records ?? []) {
            const reference = semanticReferences().get(id);
            if (reference) {
              const key = ontologyElementReferenceKey(reference);
              byElement.set(
                key,
                Math.min(byElement.get(key) ?? Infinity, rank),
              );
            }
          }
        }
        reveal = { signature, byElement };
      }
      const requested = new Map(
        requestedReferences.map((reference) => [
          ontologyElementReferenceKey(reference),
          reference,
        ]),
      );
      return Object.freeze(
        [...requested].flatMap(([key, reference]) => {
          const rank = reveal.byElement.get(key);
          return rank === undefined
            ? []
            : [
                Object.freeze({
                  ontologyElementReference: structuredClone(reference),
                  requiredNodeCount: rank,
                }),
              ];
        }),
      );
    },
  });
}
