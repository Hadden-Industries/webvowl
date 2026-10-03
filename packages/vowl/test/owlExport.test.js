import { exportModelRdf, openOwl } from "vowl/owl";
import { inspectModel, editModel, canonicalize, encode, profiles } from "vowl";

const bytes = (text) => new TextEncoder().encode(text);
const open = (text, mediaType = "text/owl-functional") =>
  openOwl(bytes(text), { documentIri: "urn:source", mediaType });

test("Turtle exports current structure and anchored annotations with exact large cardinalities", async () => {
  const { model } = await open(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>))
    Declaration(ObjectProperty(<urn:p>)) Declaration(DataProperty(<urn:d>))
    Declaration(AnnotationProperty(<urn:note>))
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "old"@en)
    SubClassOf(Annotation(<urn:note> "anchored") <urn:A> ObjectMinCardinality(9007199254740993 <urn:p> <urn:B>))
    DataPropertyRange(<urn:d> DataOneOf("text" "7"^^<http://www.w3.org/2001/XMLSchema#integer>))
    ObjectPropertyDomain(<urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>)
  )`);
  const label = inspectModel(model).records.constructs.find(
    (record) => record.kind === "annotation-assertion",
  );
  const edited = await editModel(model, [
    {
      kind: "replace",
      id: label.id,
      record: { ...label, value: { ...label.value, lexical: "edited" } },
    },
  ]);
  const output = await exportModelRdf(edited.model);
  expect(output.scope).toMatchObject({
    revision: 1,
    kind: "flattened-retained-closure",
    mediaType: "text/turtle",
  });

  const text = new TextDecoder().decode(output.bytes);
  expect(text).toContain('"edited"@en');
  expect(text).not.toContain('"old"@en');
  expect(text).toContain('"9007199254740993"');
  const reopened = await open(text, "text/turtle");
  const canonical = async (live) =>
    encode(
      await canonicalize(
        {
          structural: {
            ...inspectModel(live).records,
            occurrences: inspectModel(live).occurrences,
          },
        },
        { profile: profiles.structuralContent },
      ),
    );
  expect(await canonical(reopened.model)).toEqual(
    await canonical(edited.model),
  );
  output.bytes.fill(0);
  expect(
    new TextDecoder().decode((await exportModelRdf(edited.model)).bytes),
  ).toBe(text);
});

test("qualified RDF literals survive export without inventing an OWL category", async () => {
  const { model } = await open(
    `@prefix owl: <http://www.w3.org/2002/07/owl#>.
    <urn:A> a owl:Class. <urn:A> <urn:unmapped> "value"^^<urn:unverified>.
  `,
    "text/turtle",
  );
  const output = await exportModelRdf(model);
  expect(new TextDecoder().decode(output.bytes)).toContain(
    '"value"^^<urn:unverified>',
  );
  await expect(exportModelRdf({}, {})).rejects.toMatchObject({
    code: "MODEL_NOT_ADMITTED",
  });
  await expect(
    exportModelRdf(model, { format: "other" }),
  ).rejects.toMatchObject({ code: "OPTION_INVALID" });
  await expect(
    exportModelRdf(model, { limits: { rdfQuads: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  const abort = new AbortController();
  abort.abort();
  await expect(
    exportModelRdf(model, { signal: abort.signal }),
  ).rejects.toMatchObject({ code: "ABORTED" });
});

test.each([
  ["ObjectIntersectionOf(<urn:A> <urn:B>)", "intersectionOf"],
  ["ObjectUnionOf(<urn:A> <urn:B>)", "unionOf"],
  ["ObjectComplementOf(<urn:B>)", "complementOf"],
  ["ObjectOneOf(<urn:i> <urn:j>)", "oneOf"],
  ["ObjectSomeValuesFrom(ObjectInverseOf(<urn:p>) <urn:B>)", "inverseOf"],
  ["ObjectAllValuesFrom(<urn:p> <urn:B>)", "allValuesFrom"],
  ["ObjectHasValue(<urn:p> <urn:i>)", "hasValue"],
  ["ObjectHasSelf(<urn:p>)", "hasSelf"],
  ["ObjectMaxCardinality(3 <urn:p> <urn:B>)", "maxQualifiedCardinality"],
  ["ObjectExactCardinality(2 <urn:p> <urn:B>)", "qualifiedCardinality"],
  [
    "DataSomeValuesFrom(<urn:d> DataIntersectionOf(<http://www.w3.org/2001/XMLSchema#integer> <http://www.w3.org/2001/XMLSchema#decimal>))",
    "intersectionOf",
  ],
  [
    "DataAllValuesFrom(<urn:d> DataUnionOf(<http://www.w3.org/2001/XMLSchema#integer> <http://www.w3.org/2001/XMLSchema#string>))",
    "unionOf",
  ],
  [
    "DataSomeValuesFrom(<urn:d> DataComplementOf(<http://www.w3.org/2001/XMLSchema#string>))",
    "datatypeComplementOf",
  ],
  [
    'DataHasValue(<urn:d> "7"^^<http://www.w3.org/2001/XMLSchema#integer>)',
    "hasValue",
  ],
  [
    "DataMinCardinality(2 <urn:d> <http://www.w3.org/2001/XMLSchema#integer>)",
    "minQualifiedCardinality",
  ],
  [
    'DataSomeValuesFrom(<urn:d> DatatypeRestriction(<http://www.w3.org/2001/XMLSchema#integer> <http://www.w3.org/2001/XMLSchema#minInclusive> "2"^^<http://www.w3.org/2001/XMLSchema#integer>))',
    "withRestrictions",
  ],
])("exports and reopens %s", async (expression, predicate) => {
  const { model } = await open(
    `Ontology(Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(ObjectProperty(<urn:p>)) Declaration(DataProperty(<urn:d>)) SubClassOf(<urn:A> ${expression}))`,
  );
  const output = await exportModelRdf(model);
  const text = new TextDecoder().decode(output.bytes);
  expect(text).toContain(`#${predicate}>`);
  const reopened = await open(text, "text/turtle");
  const summarize = (live) =>
    inspectModel(live)
      .records.expressions.map(({ kind, cardinality }) => ({
        kind,
        cardinality,
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind));
  expect(summarize(reopened.model)).toEqual(summarize(model));
});

test.each([
  "EquivalentClasses(<urn:A> <urn:B> <urn:C>)",
  "DisjointClasses(<urn:A> <urn:B> <urn:C>)",
  "DisjointUnion(<urn:A> <urn:B> <urn:C>)",
  "EquivalentObjectProperties(<urn:p> <urn:q> <urn:r>)",
  "DisjointObjectProperties(<urn:p> <urn:q> <urn:r>)",
  "EquivalentDataProperties(<urn:d> <urn:e>)",
  "DisjointDataProperties(<urn:d> <urn:e>)",
  "SubObjectPropertyOf(ObjectPropertyChain(<urn:p> <urn:q>) <urn:r>)",
  "InverseObjectProperties(<urn:p> <urn:q>)",
  "HasKey(<urn:A> (<urn:p>) (<urn:d>))",
  "ClassAssertion(<urn:A> <urn:i>)",
  "FunctionalObjectProperty(<urn:p>)",
  "SymmetricObjectProperty(<urn:p>)",
  "FunctionalDataProperty(<urn:d>)",
  "AnnotationPropertyDomain(<urn:note> <urn:A>)",
  "AnnotationPropertyRange(<urn:note> <urn:B>)",
  "SubAnnotationPropertyOf(<urn:note> <urn:parentNote>)",
])("retains annotated assertion %s", async (axiom) => {
  const annotated = axiom.replace(
    "(",
    '(Annotation(Annotation(<urn:parentNote> "nested") <urn:note> "anchor") ',
  );
  const { model } = await open(`Ontology(${annotated})`);
  const text = new TextDecoder().decode((await exportModelRdf(model)).bytes);
  const reopened = await open(text, "text/turtle");
  const before = inspectModel(model).records.constructs.filter(
    ({ kind }) => kind === "assertion-anchor",
  );
  const after = inspectModel(reopened.model).records.constructs.filter(
    ({ kind }) => kind === "assertion-anchor",
  );
  expect(before.length).toBeGreaterThan(0);
  expect(after.length).toBeGreaterThan(0);
  expect(
    after.every(({ annotations }) =>
      annotations.some(
        ({ value, annotations: nested }) =>
          value.lexical === "anchor" &&
          nested.some(({ value: child }) => child.lexical === "nested"),
      ),
    ),
  ).toBe(true);
});
