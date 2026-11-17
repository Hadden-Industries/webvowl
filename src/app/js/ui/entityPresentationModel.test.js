import { expect, test } from "@jest/globals";
import {
  createEntityPresentation,
  relatedEntityRoleReferences,
} from "./entityPresentationModel.js";

const role = (kind, more = {}) => ({
  kind,
  ontologyElementReference: { kind, iri: "urn:example:Thing" },
  displayLabel: "Thing",
  iri: "urn:example:Thing",
  elementTypeName: "owl:" + kind,
  annotationRecords: [],
  commentText: "First sentence. Another sentence.",
  descriptionText: "Complete definition",
  characteristicNames: [],
  unclassifiedAttributeNames: [],
  ...more,
});

test("all roles use stable semantic order independent of selection order", () => {
  const descriptions = [
    role("property"),
    role("class"),
    role("individual"),
    role("datatype"),
  ];
  const result = createEntityPresentation(descriptions);
  expect(result.map((entry) => entry.kind)).toEqual([
    "class",
    "datatype",
    "individual",
    "property",
  ]);
  expect(createEntityPresentation([...descriptions].reverse())).toEqual(result);
  expect(descriptions.map((entry) => entry.kind)).toEqual([
    "property",
    "class",
    "individual",
    "datatype",
  ]);
});

test("preview truncation never discards complete fields, language tags or zero cardinalities", () => {
  const description = role("property", {
    commentText: "x".repeat(400),
    cardinalityRecord: { exact: 0, minimum: null, maximum: 12 },
    annotationRecords: [
      { propertyIri: "urn:label", text: "étiquette", languageTag: "fr" },
    ],
    domainElements: [1, 2, 3].map((id) => ({
      displayLabel: "Class " + id,
      ontologyElementReference: { kind: "class", iri: "urn:" + id },
    })),
    rangeElements: [],
  });
  const [result] = createEntityPresentation([description]);
  expect(result.summary.length).toBe(150);
  expect(result.summaries).toEqual(["Domain: Class 1, Class 2 and 1 more"]);
  expect(
    Object.fromEntries(result.fields.map(({ key, value }) => [key, value])),
  ).toEqual({
    elementTypeName: "owl:property",
    annotationRecords: description.annotationRecords,
    commentText: "x".repeat(400),
    descriptionText: "Complete definition",
    characteristicNames: [],
    unclassifiedAttributeNames: [],
    cardinalityRecord: { exact: 0, minimum: null, maximum: 12 },
    domainElements: description.domainElements,
    rangeElements: [],
  });
});

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DCTERMS = "http://purl.org/dc/terms/";
const annotation = (propertyIri, text, languageTag = null) => ({
  localName: propertyIri.split(/[#/]/u).at(-1),
  propertyIri,
  languageTag,
  text,
  valueKind: "literal",
});

test("the summary highlights the four curated annotations in one fixed order", () => {
  const [result] = createEntityPresentation([
    role("class", {
      annotationRecords: [
        annotation(DCTERMS + "references", "urn:example:reference"),
        annotation("urn:example:unrelated", "Never highlighted"),
        annotation(DCTERMS + "source", "ISO/IEC 11179-3"),
        annotation(SKOS + "scopeNote", "Used for legal entities."),
        annotation(SKOS + "definition", "An organised body."),
      ],
    }),
  ]);
  expect(result.highlightedAnnotations).toEqual([
    {
      propertyIri: SKOS + "definition",
      label: "Definition",
      values: [{ text: "An organised body.", languageTag: null }],
    },
    {
      propertyIri: SKOS + "scopeNote",
      label: "Scope note",
      values: [{ text: "Used for legal entities.", languageTag: null }],
    },
    {
      propertyIri: DCTERMS + "source",
      label: "Source",
      values: [{ text: "ISO/IEC 11179-3", languageTag: null }],
    },
    {
      propertyIri: DCTERMS + "references",
      label: "References",
      values: [{ text: "urn:example:reference", languageTag: null }],
    },
  ]);
  expect(createEntityPresentation([role("class")])[0]).toHaveProperty(
    "highlightedAnnotations",
    [],
  );
});

test("a highlighted annotation prefers the reader's language, then untagged text, then every language", () => {
  const records = [
    annotation(SKOS + "definition", "An organised body.", "en"),
    annotation(SKOS + "definition", "Eine Körperschaft.", "de"),
    annotation(SKOS + "definition", "Eine Körperschaft.", "de"),
    annotation(SKOS + "scopeNote", "Untagged note."),
    annotation(SKOS + "scopeNote", "Note en français.", "fr"),
  ];
  const texts = (preferredLanguageTag) =>
    createEntityPresentation([role("class", { annotationRecords: records })], {
      preferredLanguageTag,
    })[0].highlightedAnnotations.map(({ values }) =>
      values.map(({ text, languageTag }) => [text, languageTag]),
    );
  expect(texts("DE")).toEqual([
    [["Eine Körperschaft.", "de"]],
    [["Untagged note.", null]],
  ]);
  expect(texts("ja")).toEqual([
    [
      ["An organised body.", "en"],
      ["Eine Körperschaft.", "de"],
    ],
    [["Untagged note.", null]],
  ]);
  const long = createEntityPresentation([
    role("class", {
      annotationRecords: [annotation(SKOS + "definition", "x".repeat(900))],
    }),
  ])[0];
  expect(long.highlightedAnnotations[0].values[0].text).toHaveLength(280);
  expect(
    long.fields.find(({ key }) => key === "annotationRecords").value[0].text,
  ).toHaveLength(900);
});

test("the type symbol names the semantic role without consulting the drawing", () => {
  const symbol = (kind, roleKind, elementTypeName = roleKind) =>
    createEntityPresentation([
      role(kind, {
        ontologyElementReference: { kind, roleKind, iri: "urn:example:Thing" },
        elementTypeName,
      }),
    ])[0].typeSymbol;
  expect(symbol("class", "class")).toBe("○");
  expect(symbol("class", "rdf-class")).toBe("○");
  expect(symbol("datatype", "datatype")).toBe("▭");
  expect(symbol("individual", "individual")).toBe("◆");
  expect(symbol("property", "object-property")).toBe("→");
  expect(symbol("property", "annotation-property")).toBe("→");
  expect(symbol("class", "class", "owl:unionOf")).toBe("∪");
  expect(symbol("class", "class", "owl:intersectionOf")).toBe("∩");
  expect(symbol("class", "class", "owl:complementOf")).toBe("¬");
  expect(symbol("class", "class", "owl:disjointUnionOf")).toBe("⊎");
});

test("anonymous identities remain generation-scoped and named relations enumerate every supported role", () => {
  const reference = { kind: "class", loadGeneration: 7, localId: "blank-1" };
  const [result] = createEntityPresentation([
    role("class", { ontologyElementReference: reference, iri: null }),
  ]);
  expect(result.compactIri).toBe("Anonymous — no IRI");
  expect(relatedEntityRoleReferences(reference)).toEqual([reference]);
  expect(
    relatedEntityRoleReferences({ kind: "class", iri: "urn:Thing" }).map(
      (entry) => entry.roleKind,
    ),
  ).toEqual([
    "class",
    "rdf-class",
    "datatype",
    "individual",
    "object-property",
    "data-property",
    "annotation-property",
    "rdf-property",
  ]);
});
