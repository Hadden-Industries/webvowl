import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (local) => IRI.create(`https://example.com/vocab#${local}`);
const owlClass = (local) => factory.getOWLClass(iri(local));
const OWL_THING = "http://www.w3.org/2002/07/owl#Thing";

// Every class is a subclass of `owl:Thing` by definition, so an edge saying so
// carries no information and would tie every node in the graph to one point.
// VOWL draws none: across the 46 pinned reference outputs there are 2358
// subclass edges and not one of them points at `owl:Thing`, and the retained
// legacy exporter skips them explicitly for the same reason.
//
// Deferred decomposition: this rule belongs with subclass edge generation,
// which OWL2VOWL keeps in `VowlSubclassPropertyGenerator`.
const build = (...axioms) =>
  new VOWLBuilder().build(new OWLOntology({ axioms }));

const subclassEdges = (result) => {
  const subclassIds = new Set(
    result.property
      .filter(({ type }) => type === "rdfs:SubClassOf")
      .map(({ id }) => id),
  );
  const classIri = new Map(
    result.classAttribute.map(({ id, iri: classIri }) => [id, classIri]),
  );
  return result.propertyAttribute
    .filter(({ id }) => subclassIds.has(id))
    .map(
      ({ domain, range }) =>
        `${classIri.get(domain)} -> ${classIri.get(range)}`,
    );
};

describe("subclass edges", () => {
  it("draws no edge to owl:Thing", () => {
    const result = build(
      factory.getOWLSubClassOfAxiom(
        owlClass("Person"),
        factory.getOWLClass(IRI.create(OWL_THING)),
      ),
    );

    expect(subclassEdges(result)).toEqual([]);
  });

  it("still draws an edge to an ordinary superclass", () => {
    const result = build(
      factory.getOWLSubClassOfAxiom(owlClass("Person"), owlClass("Agent")),
    );

    expect(subclassEdges(result)).toEqual([
      `${iri("Person").value} -> ${iri("Agent").value}`,
    ]);
  });
});
