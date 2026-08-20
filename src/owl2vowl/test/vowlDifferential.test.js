import { describe, expect, it } from "@jest/globals";

import { ONTOLOGY_CATALOG } from "../js/constants.js";
import {
  compareVowlSemantics,
  installLocalOntologyFetch,
  parseVowlJson,
} from "./vowlDifferential.js";

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

  // A property IRI appears once for the declared property and once more for
  // every restriction edge drawn with it, so `propertyAttribute` routinely
  // holds several entries sharing one IRI. Keying the projection by IRI kept
  // only the last of them, which made the verdict depend on the order the
  // entries happen to be serialised in - the ordering rule this repository
  // rejects everywhere else. `food.rdf` shows the effect: both engines draw
  // `food:course` from `Meal` to `MealCourse`, but our extra restriction edge
  // sorts last and the dimension was reported as a range difference.
  const withEdges = (edges) => ({
    header: { iri: "http://example.org/vocab" },
    class: [
      { id: "1", type: "owl:Class" },
      { id: "9", type: "owl:Class" },
    ],
    classAttribute: [
      { id: "1", iri: CLASS_IRI, label: { en: "Person" } },
      {
        id: "9",
        iri: "http://example.org/vocab#Other",
        label: { en: "Other" },
      },
    ],
    property: edges.map((edge) => ({
      id: edge.id,
      type: "owl:objectProperty",
    })),
    propertyAttribute: edges.map((edge) => ({
      id: edge.id,
      iri: PROPERTY_IRI,
      label: { en: "knows" },
      domain: edge.domain,
      range: edge.range,
    })),
  });

  const compareEdges = (reference, candidate) =>
    compareVowlSemantics(
      parseVowlJson(withEdges(reference)),
      parseVowlJson(withEdges(candidate)),
    );

  it("does not let the order of same-IRI entries decide the verdict", () => {
    const edges = [
      { id: "2", domain: "1", range: "9" },
      { id: "3", domain: "1", range: "1" },
    ];

    const { failedChecks } = compareEdges(edges, [edges[1], edges[0]]);

    expect(failedChecks).toEqual([]);
  });

  it("still reports a genuine domain or range difference", () => {
    const { failedChecks } = compareEdges(
      [{ id: "2", domain: "1", range: "9" }],
      [{ id: "2", domain: "1", range: "1" }],
    );

    expect(failedChecks).toContain("props");
  });

  // An edge the other engine does not draw is a real difference, and must not
  // be hidden by comparing only the distinct pairs one engine happens to have.
  it("reports an extra edge drawn for the same property", () => {
    const { failedChecks } = compareEdges(
      [{ id: "2", domain: "1", range: "9" }],
      [
        { id: "2", domain: "1", range: "9" },
        { id: "3", domain: "1", range: "1" },
      ],
    );

    expect(failedChecks).toContain("props");
  });

  // The same defect as the property collection above, in the projections that
  // describe each entry. A property IRI covers the declared property and every
  // restriction edge drawn with it, and those genuinely differ - a restriction
  // edge is typed `owl:allValuesFrom` where the property itself is typed
  // `owl:objectProperty`. Keeping only the last entry made the verdict depend on
  // which one the converter happened to serialise last.
  //
  // `food.rdf` is the case: both engines emit exactly the two node types
  // `owl:allValuesFrom` and `owl:objectProperty` for `food:course`, in opposite
  // orders, and the dimension was reported as a type difference.
  const withTypedEdges = (entries) => ({
    header: { iri: "http://example.org/vocab" },
    class: [{ id: "1", type: "owl:Class" }],
    classAttribute: [{ id: "1", iri: CLASS_IRI, label: { en: "Person" } }],
    property: entries.map((entry) => ({ id: entry.id, type: entry.type })),
    propertyAttribute: entries.map((entry) => ({
      id: entry.id,
      iri: PROPERTY_IRI,
      label: { en: "knows" },
      ...(entry.attributes ? { attributes: entry.attributes } : {}),
    })),
  });

  const compareTyped = (reference, candidate) =>
    compareVowlSemantics(
      parseVowlJson(withTypedEdges(reference)),
      parseVowlJson(withTypedEdges(candidate)),
    );

  it("does not let entry order decide the node type verdict", () => {
    const entries = [
      { id: "2", type: "owl:objectProperty" },
      { id: "3", type: "owl:allValuesFrom" },
    ];

    const { failedChecks } = compareTyped(entries, [entries[1], entries[0]]);

    expect(failedChecks).not.toContain("types");
  });

  it("still reports a genuine node type difference", () => {
    const { failedChecks } = compareTyped(
      [{ id: "2", type: "owl:objectProperty" }],
      [{ id: "2", type: "owl:datatypeProperty" }],
    );

    expect(failedChecks).toContain("types");
  });

  it("ignores the order in which attributes are listed", () => {
    const { failedChecks } = compare(
      { classAttributes: ["external", "equivalent"] },
      { classAttributes: ["equivalent", "external"] },
    );

    expect(failedChecks).not.toContain("attributes");
  });
});

// A differential is only meaningful when both sides convert the same ontology.
// The pinned reference outputs were produced by running the jar against local
// files, so any import that run could not fetch is simply absent from the
// fixture. Where this project's catalog resolves such an IRI, the two sides see
// different closures and the resulting difference says nothing about either
// engine.
//
// The harness must therefore be able to withhold a named import, so it can
// reproduce the conditions the reference run actually had. Production import
// resolution is untouched: this is test infrastructure aligning inputs.
describe("withholding an import the reference run did not have", () => {
  const UNAVAILABLE = "http://www.mindswap.org/2003/owl/foaf";

  it("serves a withheld import as not found", async () => {
    const restore = installLocalOntologyFetch({
      unavailableImports: [UNAVAILABLE],
    });

    const response = await globalThis.fetch(UNAVAILABLE);
    restore();

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  // The import resolver maps an IRI through the catalog before fetching, so the
  // request carries the mapped target rather than the IRI the document declared.
  // Withholding only the declared form would silently do nothing.
  it("withholds the catalog target the declared IRI maps to", async () => {
    const restore = installLocalOntologyFetch({
      unavailableImports: [UNAVAILABLE],
    });

    const response = await globalThis.fetch(ONTOLOGY_CATALOG[UNAVAILABLE]);
    restore();

    expect(ONTOLOGY_CATALOG[UNAVAILABLE]).toBeDefined();
    expect(response.ok).toBe(false);
  });

  it("still serves an unrelated import", async () => {
    const restore = installLocalOntologyFetch({
      unavailableImports: [UNAVAILABLE],
    });

    const response = await globalThis.fetch(
      "https://haddenindustries.com/ontology/external/skos.rdf",
    );
    restore();

    expect(response.ok).toBe(true);
  });
});
