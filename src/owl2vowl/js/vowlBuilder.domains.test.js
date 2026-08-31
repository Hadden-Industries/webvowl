import { describe, expect, it } from "@jest/globals";

import { IRI, OWLDataFactory, OWLOntology } from "owlapi/model";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const BASE = "https://example.com/domains#";
const iri = (local) => IRI.create(`${BASE}${local}`);
const owlClass = (local) => factory.getOWLClass(iri(local));
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

const buildWith = (...axioms) =>
  new VOWLBuilder().build(new OWLOntology({ axioms }));

const nodeType = (result, id) =>
  result.class.find((node) => String(node.id) === String(id))?.type;

const attributeFor = (result, id) =>
  result.classAttribute.find((entry) => String(entry.id) === String(id));

const edgeFor = (result, local) =>
  result.propertyAttribute.find((entry) => entry.iri === `${BASE}${local}`);

// The members of a property's domain node, named by IRI. Returned in emission
// order; callers that only care which classes are present sort for themselves.
const domainMembers = (result, local) => {
  const attribute = attributeFor(result, edgeFor(result, local).domain);
  return (attribute.intersection ?? []).map(
    (id) => attributeFor(result, id).iri,
  );
};

// Whatever the domain resolved to, named so two builds can be compared: the
// member IRIs when it is a set expression, the class IRI when it is a class.
// Comparing the members alone would let two builds that each kept a different
// single class look identical, which is the bug rather than the fix.
const domainShape = (result, local) => {
  const attribute = attributeFor(result, edgeFor(result, local).domain);
  return attribute.intersection
    ? attribute.intersection.map((id) => attributeFor(result, id).iri)
    : attribute.iri;
};

// OWL 2 reads several domain axioms for one property as a conjunction: every
// one of them holds, so the property's domain is their intersection. The
// builder used to assign `record.attribute.domain` on each axiom in turn, so
// only the last one processed survived.
//
// That was deterministic - `applyAxioms` sorts axioms by structural key before
// dispatching them, so the survivor was the structurally greatest domain rather
// than whichever the document happened to state last - but it discarded the
// rest while still drawing a class node for each. `imarinetlo.owl` is the
// corpus case: `imarinetlo:name` states ten `rdfs:domain` axioms, of which only
// `Country` reached the edge, and four of the other nine became class nodes
// with no edge touching them at all.
describe("VOWLBuilder domains stated more than once", () => {
  const dataProperty = (local) => factory.getOWLDataProperty(iri(local));
  const objectProperty = (local) => factory.getOWLObjectProperty(iri(local));

  const dataDomain = (local, className) =>
    factory.getOWLDataPropertyDomainAxiom(
      dataProperty(local),
      owlClass(className),
    );
  const stringRange = (local) =>
    factory.getOWLDataPropertyRangeAxiom(
      dataProperty(local),
      factory.getOWLDatatype(IRI.create(XSD_STRING)),
    );
  const objectDomain = (local, className) =>
    factory.getOWLObjectPropertyDomainAxiom(
      objectProperty(local),
      owlClass(className),
    );
  const objectRange = (local, className) =>
    factory.getOWLObjectPropertyRangeAxiom(
      objectProperty(local),
      owlClass(className),
    );

  it("draws the domain as an intersection when a data property states two", () => {
    const result = buildWith(
      dataDomain("name", "Actor"),
      dataDomain("name", "Country"),
      stringRange("name"),
    );

    expect(nodeType(result, edgeFor(result, "name").domain)).toBe(
      "owl:intersectionOf",
    );
  });

  it("keeps every stated domain as a member of that intersection", () => {
    const result = buildWith(
      dataDomain("name", "Actor"),
      dataDomain("name", "Country"),
      dataDomain("name", "Ecosystem"),
      stringRange("name"),
    );

    expect([...domainMembers(result, "name")].sort()).toEqual([
      `${BASE}Actor`,
      `${BASE}Country`,
      `${BASE}Ecosystem`,
    ]);
  });

  // Guards the canonical sort in `applyAxioms` as much as the join itself:
  // remove it and this is the test that notices the rendering has become a
  // function of how the ontology was written down rather than of the ontology.
  it("renders the same intersection whichever order the axioms arrive in", () => {
    const forward = buildWith(
      dataDomain("name", "Actor"),
      dataDomain("name", "Country"),
      dataDomain("name", "Ecosystem"),
      stringRange("name"),
    );
    const reversed = buildWith(
      dataDomain("name", "Ecosystem"),
      dataDomain("name", "Country"),
      dataDomain("name", "Actor"),
      stringRange("name"),
    );

    expect(domainShape(reversed, "name")).toEqual(domainShape(forward, "name"));
  });

  it("leaves no class node without an edge once the domains are joined", () => {
    const result = buildWith(
      dataDomain("name", "Actor"),
      dataDomain("name", "Country"),
      stringRange("name"),
    );

    const touched = new Set();
    for (const edge of result.propertyAttribute) {
      touched.add(String(edge.domain));
      touched.add(String(edge.range));
    }
    const intersectionId = String(edgeFor(result, "name").domain);
    for (const member of attributeFor(result, intersectionId).intersection) {
      touched.add(String(member));
    }

    const orphans = result.classAttribute
      .filter((entry) => !touched.has(String(entry.id)))
      .map((entry) => entry.iri);
    expect(orphans).toEqual([]);
  });

  it("draws a single stated domain as the class itself", () => {
    const result = buildWith(dataDomain("name", "Actor"), stringRange("name"));

    const domainId = edgeFor(result, "name").domain;
    expect(nodeType(result, domainId)).toBe("owl:Class");
    expect(attributeFor(result, domainId).iri).toBe(`${BASE}Actor`);
  });

  it("draws the range as an intersection when an object property states two", () => {
    const result = buildWith(
      objectDomain("knows", "Actor"),
      objectRange("knows", "Country"),
      objectRange("knows", "Ecosystem"),
    );

    const rangeId = edgeFor(result, "knows").range;
    expect(nodeType(result, rangeId)).toBe("owl:intersectionOf");
    expect(
      attributeFor(result, rangeId)
        .intersection.map((id) => attributeFor(result, id).iri)
        .sort(),
    ).toEqual([`${BASE}Country`, `${BASE}Ecosystem`]);
  });

  it("collapses a domain stated twice over to the single class", () => {
    const result = buildWith(
      dataDomain("name", "Actor"),
      dataDomain("name", "Actor"),
      stringRange("name"),
    );

    const domainId = edgeFor(result, "name").domain;
    expect(nodeType(result, domainId)).toBe("owl:Class");
    expect(attributeFor(result, domainId).iri).toBe(`${BASE}Actor`);
  });
});
