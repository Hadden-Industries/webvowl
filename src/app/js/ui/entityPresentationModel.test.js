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
