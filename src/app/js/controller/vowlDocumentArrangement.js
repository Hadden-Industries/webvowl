import { createVowlDocumentSnapshot } from "./vowlDocument.js";
import { createRenderedArrangement } from "./renderedArrangementContracts.js";

// Only drawing attributes are copied. A drawn occurrence supplies no ontology
// fact, and an absent record (for example after a deletion) is never recreated.
export function retainVowlDocumentArrangement(vowlModel, arrangement) {
  const model = structuredClone(vowlModel);
  for (const occurrence of createRenderedArrangement(arrangement).occurrences) {
    for (const { collection, recordId } of occurrence.recordTargets) {
      const records = (model[collection] ?? []).filter(
        (record) => String(record.id) === recordId,
      );
      if (records.length !== 1) {
        continue;
      }
      const attributeCollection = `${collection}Attribute`;
      model[attributeCollection] ??= [];
      let attribute = model[attributeCollection].find(
        (record) => String(record.id) === recordId,
      );
      if (attribute === undefined) {
        attribute = { id: records[0].id };
        model[attributeCollection].push(attribute);
      }
      attribute.pos = [occurrence.xPx, occurrence.yPx];
      attribute.pinned = occurrence.isPinned;
    }
  }
  return createVowlDocumentSnapshot(model);
}
