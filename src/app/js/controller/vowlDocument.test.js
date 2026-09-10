import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let applyVowlDocumentRecordEdit;
let applyVowlOntologyMetadataEdit;
let setVowlDocumentPrefix;
let removeVowlDocumentPrefix;
let describeVowlDocumentDeletion;
let applyVowlDocumentDeletion;
let insertVowlDocumentRecords;
let OwlObjectProperty;
let OwlDatatypeProperty;
beforeAll(async () => {
  ({
    applyVowlDocumentRecordEdit,
    applyVowlOntologyMetadataEdit,
    setVowlDocumentPrefix,
    removeVowlDocumentPrefix,
    describeVowlDocumentDeletion,
    applyVowlDocumentDeletion,
    insertVowlDocumentRecords,
  } = await loadEsmModuleForTest(
    new URL("./vowlDocument.js", import.meta.url),
    import.meta.url,
  ));
  ({ OwlObjectProperty } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/properties/implementations/OwlObjectProperty.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ OwlDatatypeProperty } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
});

function documentFixture() {
  return {
    header: { iri: "https://example.test/", title: { en: "Example" } },
    class: [
      { id: "a", type: "owl:Class" },
      { id: "b", type: "owl:Class" },
    ],
    classAttribute: [
      {
        id: "a",
        iri: "https://example.test/Same",
        label: { en: "First", de: "Erste" },
        pos: [0, 10],
        pinned: true,
      },
      { id: "b", iri: "https://example.test/Same", label: { en: "Second" } },
    ],
    property: [{ id: "p", type: "owl:objectProperty" }],
    propertyAttribute: [
      {
        id: "p",
        iri: "https://example.test/p",
        domain: "a",
        range: "b",
        label: { en: "links" },
      },
    ],
  };
}

describe("application-owned VOWL record editing", () => {
  test("deletes inherited-endpoint relationships with a class and preserves an inverse survivor's endpoints", () => {
    const original = documentFixture();
    original.propertyAttribute[0].inverse = "q";
    original.property.push({ id: "q", type: "owl:objectProperty" });
    const cascade = describeVowlDocumentDeletion(original, {
      collection: "class",
      recordId: "a",
    });
    expect(cascade.recordTargets).toEqual([
      { collection: "class", recordId: "a" },
      { collection: "property", recordId: "p" },
      { collection: "property", recordId: "q" },
    ]);
    const changed = applyVowlDocumentDeletion(original, {
      collection: "property",
      recordId: "p",
    });
    expect(changed.property).toEqual([{ id: "q", type: "owl:objectProperty" }]);
    expect(changed.propertyAttribute).toEqual([
      { id: "q", domain: "b", range: "a" },
    ]);
  });
  test.each([false, true])(
    "splits a one-sided inverse with inherited endpoints=%s",
    (inheritedEndpoints) => {
      const original = documentFixture();
      original.class.push({ id: "c", type: "owl:Class" });
      original.property.push({
        id: "q",
        type: "owl:objectProperty",
        inverse: "p",
      });
      original.propertyAttribute.push({ id: "q", domain: "b", range: "a" });
      if (inheritedEndpoints) {
        delete original.propertyAttribute[0].domain;
        delete original.propertyAttribute[0].range;
      }
      const changed = applyVowlDocumentRecordEdit(original, {
        recordTarget: { collection: "property", recordId: "p" },
        changes: { rangeRecordId: "c" },
      });
      expect(changed.propertyAttribute[0]).toMatchObject({
        domain: "a",
        range: "c",
      });
      expect(changed.property[1]).not.toHaveProperty("inverse");
      expect(changed.propertyAttribute[1]).toMatchObject({
        domain: "b",
        range: "a",
      });
    },
  );
  test.each(["object", "datatype"])(
    "accepts the native %s property constructor's record type",
    (kind) => {
      const Constructor =
        kind === "object" ? OwlObjectProperty : OwlDatatypeProperty;
      const property = new Constructor({});
      const record = {
        collection: "property",
        id: "created",
        type: property.type(),
        label: "Created relation",
        iri: "https://example.test/created",
        baseIri: "https://example.test/",
        domain: "a",
        range: "b",
        pos: [100, 50],
      };
      const result = insertVowlDocumentRecords(documentFixture(), [record]);
      expect(result.property.at(-1)).toEqual({
        id: "created",
        type: kind === "object" ? "owl:ObjectProperty" : "owl:DatatypeProperty",
      });
    },
  );

  test("retains native datatype creation as one atomic document insertion", () => {
    const original = documentFixture();
    const records = [
      {
        collection: "class",
        id: "NodeId0",
        type: "rdfs:Literal",
        label: "Literal",
        iri: "http://www.w3.org/2000/01/rdf-schema#Literal",
        baseIri: "http://www.w3.org/2000/01/rdf-schema#",
        pos: [-150, 160],
      },
      {
        collection: "property",
        id: "datatypeProperty0",
        type: "owl:datatypeProperty",
        label: "newDatatypeProperty",
        iri: "https://example.test/datatypeProperty0",
        baseIri: "https://example.test/",
        domain: "a",
        range: "NodeId0",
        pos: [-75, 85],
      },
    ];
    const changed = insertVowlDocumentRecords(original, records);
    expect(changed.class.at(-1)).toEqual({
      id: "NodeId0",
      type: "rdfs:Literal",
    });
    expect(changed.propertyAttribute.at(-1)).toMatchObject({
      id: "datatypeProperty0",
      domain: "a",
      range: "NodeId0",
      pos: [-75, 85],
    });
    expect(changed.classAttribute.at(-1).pos).toEqual([-150, 160]);
    expect(original.class).toHaveLength(2);
    expect(Object.isFrozen(changed.classAttribute.at(-1))).toBe(true);
    expect(() => insertVowlDocumentRecords(original, [records[1]])).toThrow(
      /endpoint/,
    );
    expect(() => insertVowlDocumentRecords(changed, records)).toThrow(/ID/);
    expect(original.property).toHaveLength(1);
  });

  test("splits both inverse links when the human moves one relationship endpoint", () => {
    const original = documentFixture();
    original.class.push({ id: "c", type: "owl:Class" });
    original.property.push({
      id: "q",
      type: "owl:objectProperty",
      inverse: "p",
    });
    original.propertyAttribute[0].inverse = "q";
    original.propertyAttribute.push({ id: "q", domain: "b", range: "a" });
    const changed = applyVowlDocumentRecordEdit(original, {
      recordTarget: { collection: "property", recordId: "p" },
      changes: { rangeRecordId: "c" },
    });
    expect(changed.propertyAttribute[0].range).toBe("c");
    expect(changed.propertyAttribute[0]).not.toHaveProperty("inverse");
    expect(changed.property[1]).not.toHaveProperty("inverse");
    expect(changed.propertyAttribute[1]).toMatchObject({
      domain: "b",
      range: "a",
    });
    expect(original.propertyAttribute[0].inverse).toBe("q");
  });
  test("prefix changes preserve absolute IRIs and unrelated header-only prefix names", () => {
    const original = documentFixture();
    original.header.prefixList = {
      https: "https://prefix.test/",
      undefined: "https://old.test/",
    };
    const removed = removeVowlDocumentPrefix(original, "https");
    expect(removed.classAttribute[0].iri).toBe("https://example.test/Same");
    const added = setVowlDocumentPrefix(original, {
      name: "ex",
      iri: "https://example.test/",
    });
    expect(added.header.prefixList).toEqual({
      https: "https://prefix.test/",
      undefined: "https://old.test/",
      ex: "https://example.test/",
    });
    expect(added.classAttribute[0].iri).toBe("https://example.test/Same");
  });

  test("validates the resulting datatype identity when a request also changes the IRI", () => {
    const model = {
      datatype: [{ id: "d", type: "rdfs:Datatype" }],
      datatypeAttribute: [{ id: "d", iri: "https://example.test/custom" }],
    };
    const recordTarget = { collection: "datatype", recordId: "d" };
    expect(() =>
      applyVowlDocumentRecordEdit(model, {
        recordTarget,
        changes: {
          datatypeName: "rdfs:Literal",
          iri: "https://example.test/custom",
        },
      }),
    ).toThrow(/fixed IRI/);
    model.datatype[0].type = "rdfs:Literal";
    model.datatypeAttribute[0].iri =
      "http://www.w3.org/2000/01/rdf-schema#Literal";
    expect(
      applyVowlDocumentRecordEdit(model, {
        recordTarget,
        changes: {
          datatypeName: "xsd:string",
          iri: "http://www.w3.org/2001/XMLSchema#string",
        },
      }).datatypeAttribute[0].iri,
    ).toBe("http://www.w3.org/2001/XMLSchema#string");
  });

  test("preserves relationship restrictions for supported saved capitalization variants", () => {
    const model = documentFixture();
    model.property[0].type = "rdfs:SubClassOf";
    expect(() =>
      applyVowlDocumentRecordEdit(model, {
        recordTarget: { collection: "property", recordId: "p" },
        changes: { rangeRecordId: "a" },
      }),
    ).toThrow();
    expect(model.propertyAttribute[0].range).toBe("b");
  });
  test("proposes dependent deletion without deleting a datatype shared by a surviving property", () => {
    const original = documentFixture();
    original.datatype = [{ id: "d", type: "rdfs:Literal" }];
    original.property.push(
      { id: "pa", type: "owl:datatypeProperty" },
      { id: "pb", type: "owl:datatypeProperty" },
    );
    original.propertyAttribute.push(
      { id: "pa", domain: "a", range: "d" },
      { id: "pb", domain: "b", range: "d" },
    );
    const target = { collection: "class", recordId: "a" };
    const proposal = describeVowlDocumentDeletion(original, target);
    expect(proposal.recordTargets).toEqual([
      { collection: "class", recordId: "a" },
      { collection: "property", recordId: "p" },
      { collection: "property", recordId: "pa" },
    ]);
    expect(Object.isFrozen(proposal.recordTargets[0])).toBe(true);
    expect(original.class).toHaveLength(2);
    const changed = applyVowlDocumentDeletion(original, target);
    expect(changed.class).toEqual([{ id: "b", type: "owl:Class" }]);
    expect(changed.property).toEqual([
      { id: "pb", type: "owl:datatypeProperty" },
    ]);
    expect(changed.propertyAttribute).toEqual([
      { id: "pb", domain: "b", range: "d" },
    ]);
    expect(changed.datatype).toEqual([{ id: "d", type: "rdfs:Literal" }]);
    const lastPropertyRemoved = applyVowlDocumentDeletion(changed, {
      collection: "property",
      recordId: "pb",
    });
    expect(lastPropertyRemoved.datatype).toEqual([]);
    expect(lastPropertyRemoved.class).toEqual([{ id: "b", type: "owl:Class" }]);
  });

  test("edits localized ontology metadata without replacing other languages or source annotations", () => {
    const original = documentFixture();
    original.header.title.de = "Beispiel";
    original.header.annotations = { note: "source detail" };
    const changed = applyVowlOntologyMetadataEdit(original, {
      title: { language: "en", text: "New title" },
      iri: "https://example.test/new#",
      author: "Ada, Grace",
      version: "2",
      description: { language: "default", text: "Description" },
    });
    expect(changed.header).toEqual({
      iri: "https://example.test/new#",
      title: { en: "New title", de: "Beispiel" },
      author: "Ada, Grace",
      version: "2",
      description: { undefined: "Description" },
      annotations: { note: "source detail" },
    });
    expect(changed.classAttribute).toEqual(original.classAttribute);
    expect(original.header.title.en).toBe("Example");
  });

  test("renames and removes a prefix while preserving the ontology identities it previously abbreviated", () => {
    const original = documentFixture();
    original.namespace = [{ name: "ex", iri: "https://example.test/" }];
    original.header.prefixList = { ex: "https://example.test/" };
    original.classAttribute[0].iri = "ex:First";
    const renamed = setVowlDocumentPrefix(original, {
      previousName: "ex",
      name: "new",
      iri: "https://different.test/",
    });
    expect(renamed.namespace).toEqual([
      { name: "new", iri: "https://different.test/" },
    ]);
    expect(renamed.header.prefixList).toEqual({
      new: "https://different.test/",
    });
    expect(renamed.classAttribute[0].iri).toBe("https://example.test/First");
    expect(original.classAttribute[0].iri).toBe("ex:First");
    const removed = removeVowlDocumentPrefix(renamed, "new");
    expect(removed.namespace).toEqual([]);
    expect(removed.header.prefixList).toEqual({});
    expect(removed.classAttribute[0].iri).toBe("https://example.test/First");
  });

  test("changes property endpoints and editable characteristics while retaining unrelated attributes", () => {
    const original = documentFixture();
    original.propertyAttribute[0].attributes = [
      "external",
      "transitive",
      "symmetric",
    ];
    original.propertyAttribute[0].annotations = {
      note: [{ value: "Keep this", type: "literal" }],
    };
    const changed = applyVowlDocumentRecordEdit(original, {
      recordTarget: { collection: "property", recordId: "p" },
      changes: {
        iri: "https://example.test/renamed",
        domainRecordId: "b",
        rangeRecordId: "a",
        characteristics: {
          deprecated: true,
          transitive: false,
          functional: true,
        },
      },
    });
    expect(changed.propertyAttribute[0]).toEqual({
      id: "p",
      iri: "https://example.test/renamed",
      domain: "b",
      range: "a",
      label: { en: "links" },
      attributes: ["external", "symmetric", "deprecated", "functional"],
      annotations: { note: [{ value: "Keep this", type: "literal" }] },
    });
    expect(original.propertyAttribute[0].domain).toBe("a");
  });

  test("changes a custom datatype only after an explicit built-in datatype choice", () => {
    const original = {
      header: {},
      datatype: [{ id: "d", type: "rdfs:Datatype" }],
      datatypeAttribute: [
        { id: "d", iri: "https://example.test/Text", label: { en: "Text" } },
      ],
    };
    const changed = applyVowlDocumentRecordEdit(original, {
      recordTarget: { collection: "datatype", recordId: "d" },
      changes: { datatypeName: "xsd:string" },
    });
    expect(changed.datatypeAttribute).toEqual([
      {
        id: "d",
        iri: "http://www.w3.org/2001/XMLSchema#string",
        baseIri: "http://www.w3.org/2001/XMLSchema#",
        label: "string",
      },
    ]);
    expect(original.datatypeAttribute[0].iri).toBe("https://example.test/Text");
    expect(() =>
      applyVowlDocumentRecordEdit(documentFixture(), {
        recordTarget: { collection: "class", recordId: "a" },
        changes: { datatypeName: "xsd:string" },
      }),
    ).toThrow();
  });

  test("rejects invalid relationships and ambiguous record identities without editing the input", () => {
    const original = documentFixture();
    const before = structuredClone(original);
    for (const changes of [
      { domainRecordId: "missing" },
      { type: "rdfs:subClassOf", rangeRecordId: "a" },
      { iri: "relative" },
      { characteristics: { external: true } },
      { characteristics: { functional: "true" } },
    ]) {
      expect(() =>
        applyVowlDocumentRecordEdit(original, {
          recordTarget: { collection: "property", recordId: "p" },
          changes,
        }),
      ).toThrow();
    }
    original.class.push({ id: "a", type: "owl:Class" });
    expect(() =>
      applyVowlDocumentRecordEdit(original, {
        recordTarget: { collection: "class", recordId: "a" },
        changes: { label: { language: "en", text: "Changed" } },
      }),
    ).toThrow(/ambiguous/);
    expect(original.propertyAttribute).toEqual(before.propertyAttribute);
  });

  test("changes the selected record's language without changing its IRI peer or losing arrangement", () => {
    const original = documentFixture();
    const changed = applyVowlDocumentRecordEdit(original, {
      recordTarget: { collection: "class", recordId: "a" },
      changes: { label: { language: "en", text: "Renamed" } },
    });
    expect(changed.classAttribute).toEqual([
      {
        id: "a",
        iri: "https://example.test/Same",
        label: { en: "Renamed", de: "Erste" },
        pos: [0, 10],
        pinned: true,
      },
      { id: "b", iri: "https://example.test/Same", label: { en: "Second" } },
    ]);
    expect(original.classAttribute[0].label.en).toBe("First");
    expect(changed.propertyAttribute).toEqual(original.propertyAttribute);
    expect(Object.isFrozen(changed.classAttribute[0].label)).toBe(true);
  });
});
