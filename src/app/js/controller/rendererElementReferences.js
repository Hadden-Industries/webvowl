function vowlBaseRecords(vowlModelCollection) {
  return Array.isArray(vowlModelCollection) ? vowlModelCollection : [];
}

function ontologyElementReferenceForVowlRecord(
  vowlRecord,
  kind,
  loadGeneration,
) {
  if (typeof vowlRecord.iri === "string" && vowlRecord.iri.length > 0) {
    return { kind, iri: vowlRecord.iri };
  }
  return {
    kind,
    loadGeneration,
    localId: String(vowlRecord.id ?? "anonymous"),
  };
}

function mergeVowlElementsWithAttributes(baseCollection, attributeCollection) {
  const attributesById = new Map(
    vowlBaseRecords(attributeCollection).map((attributeRecord) => [
      String(attributeRecord.id),
      attributeRecord,
    ]),
  );
  return vowlBaseRecords(baseCollection).map((baseRecord) => ({
    ...baseRecord,
    ...(attributesById.get(String(baseRecord.id)) ?? {}),
  }));
}

function referencesByVowlElementId(mergedRecords, kind, loadGeneration) {
  return new Map(
    mergedRecords.map((mergedRecord) => [
      String(mergedRecord.id),
      ontologyElementReferenceForVowlRecord(mergedRecord, kind, loadGeneration),
    ]),
  );
}

// The renderer identifies a drawn element by its VOWL id, so this is the one
// translation between renderer identity and ontology identity. It is derived
// from the model rather than from anything the renderer holds.
export function indexOntologyElementReferencesByVowlElementId(
  vowlModel,
  loadGeneration,
) {
  return new Map([
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.class,
        vowlModel.classAttribute,
      ),
      "class",
      loadGeneration,
    ),
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.property,
        vowlModel.propertyAttribute,
      ),
      "property",
      loadGeneration,
    ),
    ...referencesByVowlElementId(
      mergeVowlElementsWithAttributes(
        vowlModel.datatype,
        vowlModel.datatypeAttribute,
      ),
      "datatype",
      loadGeneration,
    ),
  ]);
}
