import { createCanonicalVowlRenderProjection } from "../controller/canonicalVowlRenderProjection.js";
import { requestCanonicalMergeResolution } from "./canonicalMergeDialog.js";

function descriptions(inspection, visualization) {
  const projection = createCanonicalVowlRenderProjection(
    inspection,
    visualization,
  );
  return new Map(
    [...projection.nodes, ...projection.labels, ...projection.edges].map(
      (row) => [
        row.occurrence,
        row.members
          ?.map((member) =>
            member.iri ? `${member.name} (${member.iri})` : member.name,
          )
          .join(", ") ||
          row.description ||
          row.name ||
          row.kind.replaceAll("-", " "),
      ],
    ),
  );
}

/** Describe both sides through the same display policy used by the drawing. */
export function requestCanonicalSceneReconciliation(
  conflicts,
  { inspection, visualization, previous, signal },
) {
  const currentNames = descriptions(inspection, visualization);
  const previousNames = descriptions(
    previous.inspection,
    previous.visualization,
  );
  const references = new Map(
    previous.references.map(({ occurrence, reference }) => [
      JSON.stringify([reference.loadGeneration, reference.occurrenceId]),
      occurrence,
    ]),
  );
  return requestCanonicalMergeResolution({
    conflicts,
    signal,
    describeOccurrence: (id) => currentNames.get(id),
    describeChoice: (reference) =>
      previousNames.get(
        references.get(
          JSON.stringify([reference.loadGeneration, reference.occurrenceId]),
        ),
      ),
  });
}
