import { openOwl } from "vowl/owl";
import { inspectModel } from "vowl";
import { createCanonicalVowlScene } from "./canonicalVowlScene.js";
import { createCanonicalVowlInspectionProjection } from "./canonicalVowlInspectionProjector.js";
import { createOntologyInspector } from "./ontologyInspector.js";

test("data-property restrictions are class references while data ranges remain datatypes", async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(DataProperty(<urn:p>))
    SubClassOf(<urn:A> DataSomeValuesFrom(<urn:p> DataUnionOf(<http://www.w3.org/2001/XMLSchema#string> <http://www.w3.org/2001/XMLSchema#integer>)))
    SubClassOf(<urn:A> DataAllValuesFrom(<urn:p> <http://www.w3.org/2001/XMLSchema#string>))
    SubClassOf(<urn:A> DataHasValue(<urn:p> "value"))
    SubClassOf(<urn:A> DataMinCardinality(1 <urn:p> <http://www.w3.org/2001/XMLSchema#string>))
    SubClassOf(<urn:A> DataMaxCardinality(2 <urn:p> <http://www.w3.org/2001/XMLSchema#string>))
    SubClassOf(<urn:A> DataExactCardinality(1 <urn:p> <http://www.w3.org/2001/XMLSchema#string>)))`),
    { documentIri: "urn:root", mediaType: "text/owl-functional" },
  );
  const inspection = inspectModel(model);
  const ids = [
    ...inspection.records.roles,
    ...inspection.records.expressions,
  ].map(({ id }) => id);
  const snapshot = createCanonicalVowlInspectionProjection(inspection, {
    loadGeneration: 1,
    visualization: createCanonicalVowlScene(inspection.occurrences, {
      loadGeneration: 1,
    }).snapshot(),
    targetForRecord: (id) => ({
      loadGeneration: 1,
      recordToken: ids.indexOf(id) + 1,
    }),
  });
  const namedClass = snapshot.classRecords.find(
    ({ ontologyElementReference }) => ontologyElementReference.iri === "urn:A",
  );
  expect(namedClass.superclassReferences).toHaveLength(6);
  expect(
    namedClass.superclassReferences.every(({ kind }) => kind === "class"),
  ).toBe(true);
  expect(
    snapshot.datatypeRecords.some(
      ({ elementTypeName }) => elementTypeName === "data-union",
    ),
  ).toBe(true);
});

test("large equivalence groups stay linear until requested and retain alias search", () => {
  const count = 1000;
  const subjects = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    iri: `urn:class:${index}`,
  }));
  const roles = subjects.map((subject, index) => ({
    id: `r${index}`,
    kind: "class",
    subject: subject.id,
  }));
  const inspection = {
    records: {
      subjects,
      roles,
      expressions: [],
      ontology: { annotations: [], imports: [] },
      constructs: [
        {
          id: "group",
          kind: "equivalent-classes",
          members: roles.map(({ id }) => id),
        },
        {
          id: "label",
          kind: "annotation-assertion",
          subject: "s0",
          predicate: "http://www.w3.org/2000/01/rdf-schema#label",
          value: {
            kind: "language",
            lexical: "Distinctive alias",
            language: "en",
          },
        },
      ],
    },
  };
  const snapshot = createCanonicalVowlInspectionProjection(inspection, {
    loadGeneration: 1,
    visualization: {
      prefixes: [],
      labelSelection: { mode: "language", range: "en" },
    },
    targetForRecord: (id) => ({
      loadGeneration: 1,
      recordToken: Number(id.slice(1)) + 1,
    }),
  });
  expect(snapshot.relationGroups.map((group) => group.length)).toEqual([count]);
  expect(
    snapshot.classRecords.every(
      (record) =>
        record.equivalentClassReferences.length === 0 &&
        record.relationGroups.equivalentClassReferences.length === 1,
    ),
  ).toBe(true);
  const request = {
    ontologyInspectionSnapshot: snapshot,
    visibleRenderedGraphSnapshot: {
      loadGeneration: 1,
      visibleElementReferences: [],
      visibleRelationshipReferences: [],
    },
  };
  const inspector = createOntologyInspector();
  const search = inspector.findOntologyElements({
    ...request,
    query: "Distinctive alias",
    limit: 1,
    includeNeighborhood: true,
  });
  expect(search.totalMatchCount).toBe(count);
  expect(
    search.matches[0].neighborhoodFacts.equivalentClassReferences,
  ).toHaveLength(25);
  expect(search.optionalFactsTruncated).toBe(true);
  const description = inspector.describeOntologyElements({
    ...request,
    ontologyElementReferences: [
      snapshot.classRecords[1].ontologyElementReference,
    ],
  });
  expect(
    description.elementDescriptions[0].equivalentClassElements,
  ).toHaveLength(count - 1);
  expect(
    description.elementDescriptions[0].equivalentClassElements.some(
      ({ displayLabel }) => displayLabel === "Distinctive alias",
    ),
  ).toBe(true);
});

test("semantic inspection retains details-only facts and uses the drawing's B4 label policy", async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>))
    Declaration(ObjectProperty(<urn:p>)) Declaration(AnnotationProperty(<urn:note>))
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Zulu"@en)
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Alpha"@en)
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Sans langue")
    SubClassOf(Annotation(<urn:note> "anchored") <urn:A> ObjectMinCardinality(9007199254740993 <urn:p> <urn:B>))
    AnnotationPropertyDomain(<urn:note> <urn:untyped-domain>))`),
    { documentIri: "urn:root", mediaType: "text/owl-functional" },
  );
  const inspection = inspectModel(model);
  const visualization = createCanonicalVowlScene(inspection.occurrences, {
    loadGeneration: 1,
  }).snapshot();
  const ids = [
    ...inspection.records.roles,
    ...inspection.records.expressions,
  ].map(({ id }) => id);
  const snapshot = createCanonicalVowlInspectionProjection(inspection, {
    loadGeneration: 1,
    visualization,
    targetForRecord: (id) => ({
      loadGeneration: 1,
      recordToken: ids.indexOf(id) + 1,
    }),
  });
  expect(snapshot.retainedFacts.records.expressions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ cardinality: "9007199254740993" }),
    ]),
  );
  expect(snapshot.retainedFacts.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "assertion-anchor" }),
      expect.objectContaining({
        kind: "annotation-domain",
        target: "urn:untyped-domain",
      }),
    ]),
  );
  expect(
    snapshot.classRecords.some(
      ({ ontologyElementReference }) =>
        ontologyElementReference.iri === "urn:untyped-domain",
    ),
  ).toBe(false);
  const request = {
    ontologyInspectionSnapshot: snapshot,
    visibleRenderedGraphSnapshot: {
      loadGeneration: 1,
      visibleElementReferences: [],
      visibleRelationshipReferences: [],
      visibleGraphCounts: { visibleNodeCount: 0, visiblePropertyCount: 0 },
    },
    ontologyElementReferences: [{ kind: "class", iri: "urn:A" }],
  };
  const inspector = createOntologyInspector();
  const untagged = inspector.describeOntologyElements(request);
  expect(JSON.stringify(untagged)).toContain("Sans langue");
  const english = inspector.describeOntologyElements({
    ...request,
    language: "en",
  });
  expect(JSON.stringify(english)).toContain('"displayLabel":"Alpha"');
  expect(Object.isFrozen(snapshot.retainedFacts.records)).toBe(true);
  const exactClass = snapshot.classRecords.find(
    ({ ontologyElementReference }) => ontologyElementReference.iri === "urn:A",
  ).ontologyElementReference;
  const focusRequest = {
    ...request,
    visibleRenderedGraphSnapshot: {
      ...request.visibleRenderedGraphSnapshot,
      visibleElementReferences: [exactClass],
      visibleGraphCounts: { visibleNodeCount: 1, visiblePropertyCount: 0 },
    },
  };
  expect(
    inspector.resolveFocusableOntologyElementReferences(focusRequest)
      .focusableReferences,
  ).toEqual([exactClass]);
  // A hidden second role still makes a coarse reference ambiguous; visibility
  // must not silently choose the interpretation of a semantic request.
  const ambiguous = {
    ...snapshot,
    classRecords: [
      ...snapshot.classRecords,
      {
        ...snapshot.classRecords[0],
        ontologyElementReference: { ...exactClass, roleKind: "rdf-class" },
      },
    ],
  };
  expect(() =>
    inspector.resolveFocusableOntologyElementReferences({
      ...focusRequest,
      ontologyInspectionSnapshot: ambiguous,
    }),
  ).toThrow(expect.objectContaining({ code: "ELEMENT_AMBIGUOUS" }));
});
