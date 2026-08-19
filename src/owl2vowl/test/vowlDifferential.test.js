import { describe, expect, it } from "@jest/globals";

import { compareVowlSemantics, parseVowlJson } from "./vowlDifferential.js";

// The corpus differential compared seven dimensions and was blind to several
// fields the diagram actually draws. Two real cutover regressions - an empty
// `header.prefixList` and a dropped `predicateNs` - were found by hand rather
// than by the gate, which is the symptom of a projection that omits too much.
//
// These three dimensions are the user-visible tier: what an entity is called,
// what shape it is drawn as, and which visual markers it carries.
const CLASS_IRI = "http://example.org/vocab#Person";
const PROPERTY_IRI = "http://example.org/vocab#knows";

const document = ({
  classLabel = { en: "Person" },
  classType = "owl:Class",
  classAttributes,
  propertyLabel = { en: "knows" },
  propertyType = "owl:objectProperty",
  propertyAttributes,
} = {}) => ({
  header: { iri: "http://example.org/vocab" },
  class: [{ id: "1", type: classType }],
  classAttribute: [
    {
      id: "1",
      iri: CLASS_IRI,
      label: classLabel,
      ...(classAttributes ? { attributes: classAttributes } : {}),
    },
  ],
  property: [{ id: "2", type: propertyType }],
  propertyAttribute: [
    {
      id: "2",
      iri: PROPERTY_IRI,
      label: propertyLabel,
      ...(propertyAttributes ? { attributes: propertyAttributes } : {}),
    },
  ],
});

const compare = (referenceOptions, candidateOptions) =>
  compareVowlSemantics(
    parseVowlJson(document(referenceOptions)),
    parseVowlJson(document(candidateOptions)),
  );

describe("corpus differential comparison", () => {
  it("reports no difference between identical documents", () => {
    const { isExactMatch, failedChecks } = compare({}, {});

    expect(failedChecks).toEqual([]);
    expect(isExactMatch).toBe(true);
  });

  it("reports a class label difference", () => {
    const { failedChecks } = compare({}, { classLabel: { en: "Human" } });

    expect(failedChecks).toContain("labels");
  });

  it("reports a property label difference", () => {
    const { failedChecks } = compare({}, { propertyLabel: { en: "isFor" } });

    expect(failedChecks).toContain("labels");
  });

  it("reports a class node type difference", () => {
    const { failedChecks } = compare({}, { classType: "rdfs:Datatype" });

    expect(failedChecks).toContain("types");
  });

  it("reports a property node type difference", () => {
    const { failedChecks } = compare(
      {},
      { propertyType: "owl:datatypeProperty" },
    );

    expect(failedChecks).toContain("types");
  });

  it("reports a class attribute difference", () => {
    const { failedChecks } = compare({}, { classAttributes: ["external"] });

    expect(failedChecks).toContain("attributes");
  });

  it("reports a property attribute difference", () => {
    const { failedChecks } = compare(
      {},
      { propertyAttributes: ["functional"] },
    );

    expect(failedChecks).toContain("attributes");
  });

  it("ignores the order in which attributes are listed", () => {
    const { failedChecks } = compare(
      { classAttributes: ["external", "equivalent"] },
      { classAttributes: ["equivalent", "external"] },
    );

    expect(failedChecks).not.toContain("attributes");
  });
});
