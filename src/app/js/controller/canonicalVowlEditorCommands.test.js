import { openOwl } from "vowl/owl";
import { inspectModel, editModel } from "vowl";
import {
  prepareCanonicalEndpointEdit,
  prepareCanonicalIriEdit,
  prepareCanonicalLabelEdit,
  prepareCanonicalDeletion,
  prepareCanonicalCharacteristicEdit,
  prepareCanonicalRelationEdit,
  prepareCanonicalRecordEdit,
  prepareCanonicalDatatypeEdit,
  prepareCanonicalClassTypeEdit,
  prepareCanonicalPropertyTypeEdit,
  prepareCanonicalInsertion,
  prepareCanonicalRelationInsertion,
  prepareCanonicalMetadataEdit,
} from "./canonicalVowlEditorCommands.js";

async function load(extra) {
  return (
    await openOwl(
      new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>))
    Declaration(ObjectProperty(<urn:p>)) Declaration(ObjectProperty(<urn:q>))
    ${extra})`),
      { documentIri: "urn:root", mediaType: "text/owl-functional" },
    )
  ).model;
}

test("mixed-case language input is normalized before label and title editing", async () => {
  const initial = await load(
    'AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Before"@en-GB)',
  );
  const inspection = inspectModel(initial);
  const label = inspection.records.constructs.find(
    ({ kind }) => kind === "annotation-assertion",
  );
  const ontology = JSON.parse(JSON.stringify(inspection.records.ontology));
  ontology.annotations.push({
    predicate: "http://purl.org/dc/elements/1.1/title",
    value: { kind: "language", language: "en-GB", lexical: "Old title" },
    annotations: [],
  });
  const model = (
    await editModel(initial, [
      {
        kind: "replace",
        id: label.id,
        record: { ...label, value: { ...label.value, language: "en-GB" } },
      },
      { kind: "set-ontology", ontology },
    ])
  ).model;
  const before = inspectModel(model);
  expect(
    before.records.constructs.find(
      ({ kind }) => kind === "annotation-assertion",
    ).value.language,
  ).toBe("en-gb");
  const changes = [
    ...prepareCanonicalLabelEdit(before, {
      target: role(before, "urn:A"),
      language: "EN-gb",
      text: "After",
    }).changes,
    ...prepareCanonicalMetadataEdit(before, {
      title: { language: "EN-gb", text: "New title" },
    }).changes,
  ];
  const after = inspectModel(
    (await editModel(model, JSON.parse(JSON.stringify(changes)))).model,
  );
  const labels = after.records.constructs.filter(
    ({ kind }) => kind === "annotation-assertion",
  );
  expect(labels).toHaveLength(1);
  expect(labels[0].value).toMatchObject({
    language: "en-gb",
    lexical: "After",
  });
  expect(after.records.ontology.annotations).toHaveLength(1);
  expect(after.records.ontology.annotations[0].value).toMatchObject({
    language: "en-gb",
    lexical: "New title",
  });
});

test.each(["subclass", "disjoint", "some", "all"])(
  "canvas %s insertion retains the selected endpoints and explicit property",
  async (relation) => {
    const model = await load("SubClassOf(<urn:A> <urn:B>)");
    const before = inspectModel(model);
    const proposal = prepareCanonicalRelationInsertion(before, {
      relation,
      from: role(before, "urn:A"),
      to: role(before, "urn:B"),
      property: role(before, "urn:p"),
    });
    const after = inspectModel(
      (await editModel(model, proposal.changes)).model,
    );
    if (["some", "all"].includes(relation)) {
      const expression = after.records.expressions.find(
        ({ kind }) => kind === `object-${relation}`,
      );
      expect(expression.property).toBe(role(after, "urn:p"));
      expect(expression.filler).toBe(role(after, "urn:B"));
      expect(
        after.records.constructs.some(
          (record) =>
            record.kind === "subclass" &&
            record.sub === role(after, "urn:A") &&
            record.super === expression.id,
        ),
      ).toBe(true);
      expect(() =>
        prepareCanonicalRelationInsertion(before, {
          relation,
          from: role(before, "urn:A"),
          to: role(before, "urn:B"),
        }),
      ).toThrow("property required");
    } else {
      expect(
        after.records.constructs.some(
          ({ kind }) =>
            kind ===
            (relation === "subclass" ? "subclass" : "disjoint-classes"),
        ),
      ).toBe(true);
    }
  },
);

test("datatype property creation inserts its exact datatype and endpoints in one edit", async () => {
  const model = await load("");
  const before = inspectModel(model);
  const proposal = prepareCanonicalInsertion(before, {
    roleKind: "data-property",
    iri: "urn:created",
    domain: role(before, "urn:A"),
    datatypeIri: "http://www.w3.org/2002/07/owl#real",
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  const datatype = role(after, "http://www.w3.org/2002/07/owl#real");
  const property = role(after, "urn:created");
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "data-domain",
        property,
        target: role(after, "urn:A"),
      }),
      expect.objectContaining({
        kind: "data-range",
        property,
        target: datatype,
      }),
    ]),
  );
  expect(after.revision).toBe(before.revision + 1);
});

test.each(["default", "undefined", "IRI-based"])(
  "%s display selection edits an untagged label rather than inventing a language tag",
  async (language) => {
    const model = await load(
      'AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "before")',
    );
    const before = inspectModel(model);
    const proposal = prepareCanonicalRecordEdit(before, {
      target: role(before, "urn:A"),
      changes: { label: { language, text: "after" } },
    });
    const after = inspectModel(
      (await editModel(model, proposal.changes)).model,
    );
    const labels = after.records.constructs.filter(
      ({ kind, predicate }) =>
        kind === "annotation-assertion" &&
        predicate === "http://www.w3.org/2000/01/rdf-schema#label",
    );
    expect(labels).toHaveLength(1);
    expect(labels[0].value).toEqual({
      kind: "typed",
      datatype: "http://www.w3.org/2001/XMLSchema#string",
      lexical: "after",
    });
  },
);

test("restriction row edits copy shared expressions and preserve selected assertion annotations", async () => {
  const model =
    await load(`SubClassOf(Annotation(<urn:note> "selected") <urn:A> ObjectSomeValuesFrom(<urn:p> <urn:B>))
    SubClassOf(<urn:B> ObjectSomeValuesFrom(<urn:p> <urn:B>))`);
  const before = inspectModel(model);
  const selected = before.records.constructs.find(
    (record) =>
      record.kind === "subclass" && record.sub === role(before, "urn:A"),
  );
  const proposal = prepareCanonicalRelationEdit(before, {
    target: selected.id,
    relation: "all",
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  const assertions = after.records.constructs.filter(
    ({ kind }) => kind === "subclass",
  );
  const expressionFor = (iri) =>
    after.records.expressions.find(
      ({ id }) =>
        id === assertions.find(({ sub }) => sub === role(after, iri)).super,
    );
  expect(expressionFor("urn:A").kind).toBe("object-all");
  expect(expressionFor("urn:B").kind).toBe("object-some");
  const anchor = after.records.constructs.find(
    ({ kind }) => kind === "assertion-anchor",
  );
  expect(anchor.assertion.super).toBe(expressionFor("urn:A").id);
  expect(anchor.annotations[0].value.lexical).toBe("selected");
  expect(inspectModel(model)).toEqual(before);
});

test("relation conversion requires a property choice and never chooses an orientation for disjoint facts", async () => {
  const model = await load(
    "SubClassOf(<urn:A> <urn:B>) DisjointClasses(<urn:A> <urn:B>)",
  );
  const before = inspectModel(model);
  const subclass = before.records.constructs.find(
    ({ kind }) => kind === "subclass",
  );
  const disjoint = before.records.constructs.find(
    ({ kind }) => kind === "disjoint-classes",
  );
  expect(() =>
    prepareCanonicalRelationEdit(before, {
      target: subclass.id,
      relation: "some",
    }),
  ).toThrow(
    expect.objectContaining({ code: "EDITOR_RELATION_PROPERTY_REQUIRED" }),
  );
  expect(() =>
    prepareCanonicalRelationEdit(before, {
      target: disjoint.id,
      relation: "subclass",
    }),
  ).toThrow(
    expect.objectContaining({ code: "EDITOR_RELATION_ENDPOINT_REQUIRED" }),
  );
  const proposal = prepareCanonicalRelationEdit(before, {
    target: subclass.id,
    relation: "some",
    property: role(before, "urn:p"),
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(after.records.expressions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "object-some",
        property: role(after, "urn:p"),
        filler: role(after, "urn:B"),
      }),
    ]),
  );
});
function role(inspection, iri) {
  const subject = inspection.records.subjects.find(
    (record) => record.iri === iri,
  );
  return inspection.records.roles.find(
    (record) => record.subject === subject.id,
  ).id;
}

test("endpoint commands detach inverse facts while preserving endpoint annotations and partner endpoints", async () => {
  const model =
    await load(`ObjectPropertyDomain(Annotation(<urn:note> "keep") <urn:p> <urn:A>)
    ObjectPropertyRange(<urn:p> <urn:B>) ObjectPropertyDomain(<urn:q> <urn:B>)
    ObjectPropertyRange(<urn:q> <urn:A>) InverseObjectProperties(<urn:p> <urn:q>)`);
  const before = inspectModel(model);
  const proposal = prepareCanonicalEndpointEdit(before, {
    property: role(before, "urn:p"),
    endpoint: "domain",
    target: role(before, "urn:B"),
  });
  expect(proposal.requiresInverseDetachmentExplanation).toBe(true);
  expect(proposal.detachedInverses).toHaveLength(1);
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(
    after.records.constructs.some(({ kind }) => kind === "inverse-properties"),
  ).toBe(false);
  const q = role(after, "urn:q");
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "object-domain",
        property: q,
        target: role(after, "urn:B"),
      }),
      expect.objectContaining({
        kind: "object-range",
        property: q,
        target: role(after, "urn:A"),
      }),
    ]),
  );
  const anchor = after.records.constructs.find(
    ({ kind }) => kind === "assertion-anchor",
  );
  expect(anchor.assertion).toMatchObject({
    kind: "object-domain",
    target: role(after, "urn:B"),
  });
  expect(anchor.annotations[0].value.lexical).toBe("keep");
  expect(inspectModel(model)).toEqual(before);
});

test("annotated inverse removal requires a separate exact deletion", async () => {
  const model = await load(
    'InverseObjectProperties(Annotation(<urn:note> "preserve") <urn:p> <urn:q>)',
  );
  const inspection = inspectModel(model);
  expect(() =>
    prepareCanonicalEndpointEdit(inspection, {
      property: role(inspection, "urn:p"),
      endpoint: "range",
      target: role(inspection, "urn:A"),
    }),
  ).toThrow(
    expect.objectContaining({
      code: "EDITOR_ANNOTATED_INVERSE_REQUIRES_EXACT_DELETION",
    }),
  );
  expect(inspectModel(model)).toEqual(inspection);
});

test("an edit to a projected default asserts only the chosen endpoint", async () => {
  const model = await load("");
  const inspection = inspectModel(model);
  const proposal = prepareCanonicalEndpointEdit(inspection, {
    property: role(inspection, "urn:p"),
    endpoint: "range",
    target: role(inspection, "urn:B"),
  });
  expect(proposal.requiresInverseDetachmentExplanation).toBe(false);
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(
    after.records.constructs.filter(({ kind }) => kind.endsWith("-domain")),
  ).toEqual([]);
  expect(
    after.records.constructs.filter(({ kind }) => kind === "object-range"),
  ).toEqual([
    expect.objectContaining({
      property: role(after, "urn:p"),
      target: role(after, "urn:B"),
    }),
  ]);
});

test("label edits retain other languages and retarget supported assertion annotations", async () => {
  const model =
    await load(`AnnotationAssertion(Annotation(<urn:note> "keep label provenance")
    <http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Old"@en)
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Alt"@de)`);
  const before = inspectModel(model);
  const proposal = prepareCanonicalLabelEdit(before, {
    target: role(before, "urn:A"),
    language: "EN",
    text: "New",
  });
  const renamedModel = (await editModel(model, proposal.changes)).model;
  const after = inspectModel(renamedModel);
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "annotation-assertion",
        value: { kind: "language", language: "en", lexical: "New" },
      }),
      expect.objectContaining({
        kind: "annotation-assertion",
        value: { kind: "language", language: "de", lexical: "Alt" },
      }),
      expect.objectContaining({
        kind: "assertion-anchor",
        assertion: expect.objectContaining({
          value: { kind: "language", language: "en", lexical: "New" },
        }),
      }),
    ]),
  );
  expect(
    after.records.constructs.find(({ kind }) => kind === "assertion-anchor")
      .annotations[0].value.lexical,
  ).toBe("keep label provenance");
  const inserted = prepareCanonicalLabelEdit(after, {
    target: role(after, "urn:A"),
    text: "Untagged",
  });
  const final = inspectModel(
    (await editModel(renamedModel, inserted.changes)).model,
  );
  expect(
    final.records.constructs.filter(
      ({ kind }) => kind === "annotation-assertion",
    ),
  ).toHaveLength(3);
  expect(inspectModel(model)).toEqual(before);
});

test("label ambiguity leaves all assertions unchanged", async () => {
  const model =
    await load(`AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "One"@en)
    AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Two"@en)`);
  const inspection = inspectModel(model);
  expect(() =>
    prepareCanonicalLabelEdit(inspection, {
      target: role(inspection, "urn:A"),
      language: "en",
      text: "Chosen",
    }),
  ).toThrow(expect.objectContaining({ code: "EDITOR_LABEL_AMBIGUOUS" }));
  expect(inspectModel(model)).toEqual(inspection);
});

test("IRI edits preserve annotations and reject collisions, shared subjects and fixed builtins", async () => {
  const model = await load(
    'AnnotationAssertion(<urn:note> <urn:A> "keep") Declaration(Class(<http://www.w3.org/2002/07/owl#Thing>))',
  );
  const before = inspectModel(model);
  const proposal = prepareCanonicalIriEdit(before, {
    target: role(before, "urn:A"),
    iri: "urn:Renamed",
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  const subject = after.records.subjects.find(
    ({ iri }) => iri === "urn:Renamed",
  );
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "annotation-assertion",
        subject: subject.id,
        value: expect.objectContaining({ lexical: "keep" }),
      }),
    ]),
  );
  expect(() =>
    prepareCanonicalIriEdit(before, {
      target: role(before, "urn:A"),
      iri: "urn:B",
    }),
  ).toThrow(expect.objectContaining({ code: "EDITOR_DUPLICATE_IRI" }));
  expect(() =>
    prepareCanonicalIriEdit(before, {
      target: role(before, "http://www.w3.org/2002/07/owl#Thing"),
      iri: "urn:Ordinary",
    }),
  ).toThrow(expect.objectContaining({ code: "EDITOR_BUILTIN_IRI_FIXED" }));
  const shared = inspectModel(
    await load("Declaration(NamedIndividual(<urn:A>))"),
  );
  expect(() =>
    prepareCanonicalIriEdit(shared, {
      target: role(shared, "urn:A"),
      iri: "urn:Renamed",
    }),
  ).toThrow(expect.objectContaining({ code: "EDITOR_SHARED_SUBJECT_RENAME" }));
});

test("a compound sidebar edit renames and labels atomically without losing assertion annotations", async () => {
  const model = await load(
    'AnnotationAssertion(Annotation(<urn:note> "keep") <http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Old")',
  );
  const before = inspectModel(model);
  const proposal = prepareCanonicalRecordEdit(before, {
    target: role(before, "urn:A"),
    changes: {
      iri: "urn:Renamed",
      label: { language: "default", text: "New" },
    },
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(after.revision).toBe(before.revision + 1);
  const renamed = after.records.subjects.find(
    ({ iri }) => iri === "urn:Renamed",
  );
  const anchor = after.records.constructs.find(
    ({ kind }) => kind === "assertion-anchor",
  );
  expect(anchor.assertion.subject).toBe(renamed.id);
  expect(anchor.assertion.value.lexical).toBe("New");
  expect(anchor.annotations[0].value.lexical).toBe("keep");
  expect(() =>
    prepareCanonicalRecordEdit(before, {
      target: role(before, "urn:A"),
      changes: { iri: "urn:B", label: { text: "New" } },
    }),
  ).toThrow(expect.objectContaining({ code: "EDITOR_DUPLICATE_IRI" }));
  expect(inspectModel(model)).toEqual(before);
});

test("property conversion rejects defaults, annotations and shared assertions without changing them", async () => {
  const inputs = [
    ["", "EDITOR_CONVERSION_REQUIRES_ASSERTED_ENDPOINTS"],
    [
      'ObjectPropertyDomain(Annotation(<urn:note> "keep") <urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>)',
      "EDITOR_SHARED_OR_ANNOTATED_CONVERSION",
    ],
    [
      "ObjectPropertyDomain(<urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>) SubClassOf(<urn:A> ObjectSomeValuesFrom(<urn:p> <urn:B>))",
      "EDITOR_SHARED_OR_ANNOTATED_CONVERSION",
    ],
  ];
  for (const [source, code] of inputs) {
    const model = await load(source);
    const before = inspectModel(model);
    expect(() =>
      prepareCanonicalPropertyTypeEdit(before, {
        target: role(before, "urn:p"),
        type: "owl:disjointWith",
      }),
    ).toThrow(expect.objectContaining({ code }));
    expect(inspectModel(model)).toEqual(before);
  }
});

test("class type choices represent deprecation as an annotation and retain the attached-restriction guard", async () => {
  const model = await load("");
  const before = inspectModel(model);
  const proposal = prepareCanonicalClassTypeEdit(before, {
    target: role(before, "urn:A"),
    type: "owl:DeprecatedClass",
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(
    after.records.roles.find(({ id }) => id === role(after, "urn:A")).kind,
  ).toBe("class");
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "annotation-assertion",
        predicate: "http://www.w3.org/2002/07/owl#deprecated",
        value: {
          kind: "typed",
          datatype: "http://www.w3.org/2001/XMLSchema#boolean",
          lexical: "true",
        },
      }),
    ]),
  );
  const attached = inspectModel(
    await load("SubClassOf(<urn:A> ObjectSomeValuesFrom(<urn:p> <urn:B>))"),
  );
  expect(() =>
    prepareCanonicalClassTypeEdit(attached, {
      target: role(attached, "urn:B"),
      type: "owl:DeprecatedClass",
    }),
  ).toThrow(
    expect.objectContaining({
      code: "EDITOR_ATTACHED_RESTRICTION_PREVENTS_TYPE_CHANGE",
    }),
  );
});

test("a datatype choice retargets only the selected property context and preserves range annotations", async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(DataProperty(<urn:p>)) Declaration(DataProperty(<urn:q>))
    DataPropertyRange(Annotation(<urn:note> "range provenance") <urn:p> <http://www.w3.org/2001/XMLSchema#string>)
    DataPropertyRange(<urn:q> <http://www.w3.org/2001/XMLSchema#string>))`),
    { documentIri: "urn:root", mediaType: "text/owl-functional" },
  );
  const before = inspectModel(model);
  const string = role(before, "http://www.w3.org/2001/XMLSchema#string");
  const occurrence = before.occurrences.find(
    (entry) =>
      entry.kind === "datatype-node" &&
      entry.context.properties.includes(role(before, "urn:p")),
  );
  const proposal = prepareCanonicalDatatypeEdit(before, {
    target: string,
    datatypeIri: "http://www.w3.org/2001/XMLSchema#integer",
    occurrence: occurrence.id,
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: "data-range",
        property: role(after, "urn:p"),
        target: role(after, "http://www.w3.org/2001/XMLSchema#integer"),
      }),
      expect.objectContaining({
        kind: "data-range",
        property: role(after, "urn:q"),
        target: role(after, "http://www.w3.org/2001/XMLSchema#string"),
      }),
    ]),
  );
  const anchor = after.records.constructs.find(
    ({ kind }) => kind === "assertion-anchor",
  );
  expect(anchor.assertion.target).toBe(
    role(after, "http://www.w3.org/2001/XMLSchema#integer"),
  );
  expect(anchor.annotations[0].value.lexical).toBe("range provenance");
  expect(inspectModel(model)).toEqual(before);
});

test("a datatype choice copies a shared cardinality restriction for its exact supporting assertion", async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(DataProperty(<urn:p>))
    SubClassOf(<urn:A> DataMinCardinality(9007199254740993 <urn:p> <http://www.w3.org/2000/01/rdf-schema#Literal>))
    SubClassOf(<urn:B> DataMinCardinality(9007199254740993 <urn:p> <http://www.w3.org/2000/01/rdf-schema#Literal>)))`),
    { documentIri: "urn:root", mediaType: "text/owl-functional" },
  );
  const before = inspectModel(model);
  const assertion = before.records.constructs.find(
    (entry) => entry.kind === "subclass" && entry.sub === role(before, "urn:A"),
  );
  const occurrence = before.occurrences.find(
    (entry) =>
      entry.kind === "datatype-node" && entry.context.scope === assertion.id,
  );
  const proposal = prepareCanonicalDatatypeEdit(before, {
    target: occurrence.target,
    datatypeIri: "http://www.w3.org/2001/XMLSchema#integer",
    occurrence: occurrence.id,
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  const restrictionFor = (iri) => {
    const assertion = after.records.constructs.find(
      (entry) => entry.kind === "subclass" && entry.sub === role(after, iri),
    );
    return after.records.expressions.find(({ id }) => id === assertion.super);
  };
  expect(restrictionFor("urn:A")).toMatchObject({
    filler: role(after, "http://www.w3.org/2001/XMLSchema#integer"),
    cardinality: "9007199254740993",
  });
  expect(restrictionFor("urn:B")).toMatchObject({
    filler: role(after, "http://www.w3.org/2000/01/rdf-schema#Literal"),
    cardinality: "9007199254740993",
  });
});

test("deletion includes exact assertion anchors and leaves unrelated meaning intact", async () => {
  const model =
    await load(`ObjectPropertyDomain(Annotation(<urn:note> "lost with this fact") <urn:p> <urn:A>)
    ObjectPropertyRange(<urn:q> <urn:B>) AnnotationAssertion(<urn:note> <urn:q> "keep")`);
  const before = inspectModel(model);
  const fact = before.records.constructs.find(
    ({ kind }) => kind === "object-domain",
  );
  const proposal = prepareCanonicalDeletion(before, { target: fact.id });
  expect(
    proposal.removedRecords.map(({ record }) => record.kind).sort(),
  ).toEqual(["assertion-anchor", "object-domain"]);
  expect(proposal.annotationLosses).toHaveLength(1);
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(
    after.records.constructs.some(({ kind }) => kind === "object-domain"),
  ).toBe(false);
  expect(after.records.constructs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "object-range" }),
      expect.objectContaining({
        kind: "annotation-assertion",
        value: expect.objectContaining({ lexical: "keep" }),
      }),
    ]),
  );
  expect(inspectModel(model)).toEqual(before);
});

test("deletion includes normalized endpoint anchors and annotation-signature dependencies", async () => {
  const model =
    await load(`ObjectPropertyDomain(Annotation(<urn:note> "A provenance") <urn:p> <urn:A>)
    ObjectPropertyDomain(Annotation(<urn:note> "B provenance") <urn:p> <urn:B>)
    AnnotationAssertion(<urn:note> <urn:q> "keep unless note is deleted")`);
  const before = inspectModel(model);
  const endpoint = before.records.constructs.find(
    ({ kind }) => kind === "object-domain",
  );
  const proposal = prepareCanonicalDeletion(before, { target: endpoint.id });
  expect(proposal.annotationLosses).toHaveLength(2);
  await expect(editModel(model, proposal.changes)).resolves.toBeDefined();
  const removePredicate = prepareCanonicalDeletion(before, {
    target: role(before, "urn:note"),
  });
  expect(removePredicate.annotationLosses).toHaveLength(3);
  const after = inspectModel(
    (await editModel(model, removePredicate.changes)).model,
  );
  expect(after.records.subjects.some(({ iri }) => iri === "urn:note")).toBe(
    false,
  );
  expect(
    after.records.constructs.some(({ kind }) => kind === "object-domain"),
  ).toBe(true);
});

test("characteristic toggles preserve unrelated facts and cannot discard assertion annotations", async () => {
  const model = await load(
    'FunctionalObjectProperty(Annotation(<urn:note> "keep") <urn:p>) TransitiveObjectProperty(<urn:p>)',
  );
  const before = inspectModel(model);
  const target = role(before, "urn:p");
  expect(() =>
    prepareCanonicalCharacteristicEdit(before, {
      target,
      characteristic: "functional",
      enabled: false,
    }),
  ).toThrow(
    expect.objectContaining({
      code: "EDITOR_ANNOTATED_CHARACTERISTIC_REQUIRES_EXACT_DELETION",
    }),
  );
  const proposal = prepareCanonicalCharacteristicEdit(before, {
    target,
    characteristic: "transitive",
    enabled: false,
  });
  const after = inspectModel((await editModel(model, proposal.changes)).model);
  expect(
    after.records.constructs.some(
      ({ characteristic }) => characteristic === "functional",
    ),
  ).toBe(true);
  expect(
    after.records.constructs.some(
      ({ characteristic }) => characteristic === "transitive",
    ),
  ).toBe(false);
});
