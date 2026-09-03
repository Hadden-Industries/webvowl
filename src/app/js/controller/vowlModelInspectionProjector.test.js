import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

// The projection is exercised against ontologies the application ships rather
// than a fixture written to match the code. A fixture can only show that the
// code agrees with itself; real data shows whether it agrees with VOWL.
function readShippedVowlModel(fileName) {
  return JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../data/${fileName}`, import.meta.url)),
      "utf8",
    ),
  );
}

const FOAF_VOWL_MODEL = readShippedVowlModel("foaf.json");
const GOOD_RELATIONS_VOWL_MODEL = readShippedVowlModel("goodrelations.json");
const ONTOVIBE_VOWL_MODEL = readShippedVowlModel("ontovibe.json");
const BENCHMARK_VOWL_MODEL = readShippedVowlModel("benchmark.json");

// The eight characteristics OWL defines for a property. Every other value of
// VOWL's flat attribute bag stays unclassified rather than acquiring a
// taxonomy the format does not state.
const OWL_PROPERTY_CHARACTERISTIC_NAMES = Object.freeze([
  "functional",
  "inverse functional",
  "transitive",
  "symmetric",
  "asymmetric",
  "reflexive",
  "irreflexive",
  "key",
]);

let projectOntologyInspectionSnapshot;

beforeAll(async () => {
  ({ projectOntologyInspectionSnapshot } = await loadEsmModuleForTest(
    new URL("./vowlModelInspectionProjector.js", import.meta.url),
    import.meta.url,
  ));
});

// VOWL states a subclass or disjointness relation as a property record whose
// domain and range name the two classes, not as a field on the class itself.
function countPropertyRecordsOfType(vowlModel, propertyType) {
  return (vowlModel.property ?? []).filter(
    (propertyRecord) => propertyRecord.type === propertyType,
  ).length;
}

function countPopulated(elementRecords, relationFieldName) {
  return elementRecords.filter(
    (elementRecord) => elementRecord[relationFieldName].length > 0,
  ).length;
}

describe("projection of a shipped VOWL model", () => {
  test("recovers identity and labels the model keeps in its attribute lists", () => {
    const snapshot = projectOntologyInspectionSnapshot(FOAF_VOWL_MODEL, 1);

    const expectedClassIriCount = FOAF_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) => typeof attributeRecord.iri === "string",
    ).length;
    const expectedLabelledClassCount = FOAF_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) =>
        attributeRecord.label !== undefined &&
        Object.keys(attributeRecord.label).length > 0,
    ).length;

    expect(snapshot.classRecords.length).toBe(FOAF_VOWL_MODEL.class.length);
    expect(snapshot.propertyRecords.length).toBe(
      FOAF_VOWL_MODEL.property.length,
    );
    expect(
      snapshot.classRecords.filter(
        (classRecord) =>
          typeof classRecord.ontologyElementReference.iri === "string",
      ).length,
    ).toBe(expectedClassIriCount);
    expect(
      snapshot.classRecords.filter(
        (classRecord) => classRecord.labelRecords.length > 0,
      ).length,
    ).toBe(expectedLabelledClassCount);
  });

  test("populates the class relations the model states", () => {
    const snapshot = projectOntologyInspectionSnapshot(FOAF_VOWL_MODEL, 1);

    const expectedEquivalentClassCount = FOAF_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) => (attributeRecord.equivalent ?? []).length > 0,
    ).length;

    expect(
      countPopulated(snapshot.classRecords, "equivalentClassReferences"),
    ).toBe(expectedEquivalentClassCount);
    expect(expectedEquivalentClassCount).toBeGreaterThan(0);

    // Every subclass edge names one subclass, so the number of classes
    // carrying at least one superclass cannot exceed the edge count and must
    // be positive.
    const subclassEdgeCount = countPropertyRecordsOfType(
      FOAF_VOWL_MODEL,
      "rdfs:subClassOf",
    );
    const classesWithSuperclass = countPopulated(
      snapshot.classRecords,
      "superclassReferences",
    );
    expect(subclassEdgeCount).toBeGreaterThan(0);
    expect(classesWithSuperclass).toBeGreaterThan(0);
    expect(classesWithSuperclass).toBeLessThanOrEqual(subclassEdgeCount);

    // Disjointness is symmetric, so both named classes carry the relation.
    const disjointEdgeCount = countPropertyRecordsOfType(
      FOAF_VOWL_MODEL,
      "owl:disjointWith",
    );
    expect(disjointEdgeCount).toBeGreaterThan(0);
    expect(
      countPopulated(snapshot.classRecords, "disjointClassReferences"),
    ).toBeGreaterThan(0);
  });

  test("populates the property relations the model states", () => {
    const snapshot = projectOntologyInspectionSnapshot(FOAF_VOWL_MODEL, 1);

    const expectedDomainCount = FOAF_VOWL_MODEL.propertyAttribute.filter(
      (attributeRecord) => attributeRecord.domain !== undefined,
    ).length;
    const expectedRangeCount = FOAF_VOWL_MODEL.propertyAttribute.filter(
      (attributeRecord) => attributeRecord.range !== undefined,
    ).length;
    const expectedSuperpropertyCount = FOAF_VOWL_MODEL.propertyAttribute.filter(
      (attributeRecord) => (attributeRecord.superproperty ?? []).length > 0,
    ).length;
    const expectedInverseCount = FOAF_VOWL_MODEL.propertyAttribute.filter(
      (attributeRecord) => attributeRecord.inverse !== undefined,
    ).length;

    expect(countPopulated(snapshot.propertyRecords, "domainReferences")).toBe(
      expectedDomainCount,
    );
    expect(countPopulated(snapshot.propertyRecords, "rangeReferences")).toBe(
      expectedRangeCount,
    );
    expect(
      countPopulated(snapshot.propertyRecords, "superpropertyReferences"),
    ).toBe(expectedSuperpropertyCount);
    expect(
      countPopulated(snapshot.propertyRecords, "inversePropertyReferences"),
    ).toBe(expectedInverseCount);
    expect(expectedSuperpropertyCount).toBeGreaterThan(0);
    expect(expectedInverseCount).toBeGreaterThan(0);
  });

  test("projects the individuals a class declares", () => {
    const snapshot = projectOntologyInspectionSnapshot(
      GOOD_RELATIONS_VOWL_MODEL,
      1,
    );

    const expectedIndividualCount =
      GOOD_RELATIONS_VOWL_MODEL.classAttribute.reduce(
        (runningCount, attributeRecord) =>
          runningCount + (attributeRecord.individuals ?? []).length,
        0,
      );

    expect(expectedIndividualCount).toBeGreaterThan(0);
    expect(snapshot.individualRecords.length).toBe(expectedIndividualCount);
    // Each individual names the class that declares it, so the relation is
    // navigable in both directions from the snapshot alone.
    for (const individualRecord of snapshot.individualRecords) {
      expect(individualRecord.classReferences.length).toBeGreaterThan(0);
    }
  });

  test("addresses an anonymous class by its load-scoped local identifier", () => {
    const snapshot = projectOntologyInspectionSnapshot(
      GOOD_RELATIONS_VOWL_MODEL,
      4,
    );

    const expectedAnonymousCount =
      GOOD_RELATIONS_VOWL_MODEL.classAttribute.filter(
        (attributeRecord) => typeof attributeRecord.iri !== "string",
      ).length;
    const anonymousReferences = snapshot.classRecords
      .map(({ ontologyElementReference }) => ontologyElementReference)
      .filter((reference) => reference.iri === undefined);

    expect(expectedAnonymousCount).toBeGreaterThan(0);
    expect(anonymousReferences.length).toBe(expectedAnonymousCount);
    for (const reference of anonymousReferences) {
      expect(reference.loadGeneration).toBe(4);
      expect(typeof reference.localId).toBe("string");
    }
  });

  test("keeps every drawn occurrence of an entity that appears more than once", () => {
    const snapshot = projectOntologyInspectionSnapshot(FOAF_VOWL_MODEL, 1);

    const occurrenceCountsByIri = new Map();
    for (const { ontologyElementReference } of snapshot.classRecords) {
      if (typeof ontologyElementReference.iri !== "string") {
        continue;
      }
      occurrenceCountsByIri.set(
        ontologyElementReference.iri,
        (occurrenceCountsByIri.get(ontologyElementReference.iri) ?? 0) + 1,
      );
    }
    const repeatedIris = [...occurrenceCountsByIri.entries()].filter(
      ([, occurrenceCount]) => occurrenceCount > 1,
    );

    // FOAF draws owl:Thing and rdfs:Literal many times over. Collapsing them
    // would assert an entity model the source never stated.
    expect(repeatedIris.length).toBeGreaterThan(0);
  });

  test("projects an annotation under its local name with a nullable property IRI", () => {
    const snapshot = projectOntologyInspectionSnapshot(FOAF_VOWL_MODEL, 1);

    const expectedAnnotatedClassCount = FOAF_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) => attributeRecord.annotations !== undefined,
    ).length;

    expect(expectedAnnotatedClassCount).toBeGreaterThan(0);
    expect(countPopulated(snapshot.classRecords, "annotationRecords")).toBe(
      expectedAnnotatedClassCount,
    );

    const annotationRecords = snapshot.classRecords.flatMap(
      (classRecord) => classRecord.annotationRecords,
    );
    const localNames = new Set(
      annotationRecords.map(({ localName }) => localName),
    );
    expect(localNames.has("term_status")).toBe(true);
    for (const annotationRecord of annotationRecords) {
      expect(["literal", "iri"]).toContain(annotationRecord.valueKind);
      // FOAF predates the current converter, so it records no namespace for an
      // annotation property. Inventing the IRI would assert what the source
      // never stated.
      expect(annotationRecord.propertyIri).toBeNull();
    }
  });

  test("classifies only the OWL property characteristics", () => {
    const ontovibeSnapshot = projectOntologyInspectionSnapshot(
      ONTOVIBE_VOWL_MODEL,
      1,
    );
    const benchmarkSnapshot = projectOntologyInspectionSnapshot(
      BENCHMARK_VOWL_MODEL,
      1,
    );

    const projectedCharacteristics = new Set(
      [
        ...ontovibeSnapshot.propertyRecords,
        ...ontovibeSnapshot.classRecords,
        ...benchmarkSnapshot.propertyRecords,
        ...benchmarkSnapshot.classRecords,
      ].flatMap((elementRecord) => elementRecord.characteristicNames),
    );
    const projectedUnclassified = new Set(
      [
        ...ontovibeSnapshot.propertyRecords,
        ...ontovibeSnapshot.classRecords,
      ].flatMap((elementRecord) => elementRecord.unclassifiedAttributeNames),
    );

    expect(projectedCharacteristics.size).toBeGreaterThan(0);
    for (const characteristicName of projectedCharacteristics) {
      expect(OWL_PROPERTY_CHARACTERISTIC_NAMES).toContain(characteristicName);
    }
    // Class-expression kinds and status markers keep their VOWL spelling in the
    // unclassified bag rather than being sorted into an invented taxonomy.
    expect(projectedUnclassified.size).toBeGreaterThan(0);
    for (const attributeName of projectedUnclassified) {
      expect(OWL_PROPERTY_CHARACTERISTIC_NAMES).not.toContain(attributeName);
    }
  });

  test("projects the cardinality a property restriction states", () => {
    const snapshot = projectOntologyInspectionSnapshot(ONTOVIBE_VOWL_MODEL, 1);

    const expectedCardinalityCount =
      ONTOVIBE_VOWL_MODEL.propertyAttribute.filter(
        (attributeRecord) =>
          attributeRecord.cardinality !== undefined ||
          attributeRecord.minCardinality !== undefined ||
          attributeRecord.maxCardinality !== undefined,
      ).length;
    const projectedWithCardinality = snapshot.propertyRecords.filter(
      ({ cardinalityRecord }) =>
        cardinalityRecord.exact !== null ||
        cardinalityRecord.minimum !== null ||
        cardinalityRecord.maximum !== null,
    );

    expect(expectedCardinalityCount).toBeGreaterThan(0);
    expect(projectedWithCardinality.length).toBe(expectedCardinalityCount);
    for (const propertyRecord of snapshot.propertyRecords) {
      expect(Object.keys(propertyRecord.cardinalityRecord).sort()).toEqual([
        "exact",
        "maximum",
        "minimum",
      ]);
    }
  });

  test("keeps a description distinct from a comment", () => {
    const snapshot = projectOntologyInspectionSnapshot(ONTOVIBE_VOWL_MODEL, 1);

    const expectedDescribedCount = [
      ...ONTOVIBE_VOWL_MODEL.classAttribute,
      ...ONTOVIBE_VOWL_MODEL.propertyAttribute,
    ].filter(
      (attributeRecord) => attributeRecord.description !== undefined,
    ).length;
    const projectedDescribedCount =
      countPopulated(snapshot.classRecords, "descriptionRecords") +
      countPopulated(snapshot.propertyRecords, "descriptionRecords");

    expect(expectedDescribedCount).toBeGreaterThan(0);
    expect(projectedDescribedCount).toBe(expectedDescribedCount);
  });
});
