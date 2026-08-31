import { describe, expect, it } from "@jest/globals";

import { IRI, OWLDataFactory, OWLOntology } from "owlapi/model";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (local) => IRI.create(`https://example.com/vocab#${local}`);

// `instances` and `individuals` count different things, which is easy to miss
// because the names suggest otherwise.
//
// `individuals` holds the ordinary members of a class. `instances` counts only
// those members whose IRI is *also* a class in the ontology - the class-and-
// individual punning OWL 2 permits. The pinned oracle bears this out: across its
// 46 reference outputs only 6 of 9102 class entries carry a non-zero
// `instances`, and `time-gregorian.ttl` renders `MonthOfYear` with
// `instances: 1` beside an `individuals` array of eleven. The two are
// independent quantities, so `instances` can never be read as the length of
// `individuals`.
//
// Deferred decomposition: this belongs with individual handling, which OWL2VOWL
// keeps in `IndividualsVisitor`.
const build = (...axioms) =>
  new VOWLBuilder().build(new OWLOntology({ axioms }));

const attributeFor = (result, local) =>
  result.classAttribute.find(
    ({ iri: classIri }) => classIri === iri(local).value,
  );

describe("instances and individuals", () => {
  it("does not count an ordinary individual as an instance", () => {
    const result = build(
      factory.getOWLDeclarationAxiom(factory.getOWLClass(iri("Person"))),
      factory.getOWLClassAssertionAxiom(
        factory.getOWLClass(iri("Person")),
        factory.getOWLNamedIndividual(iri("alice")),
      ),
    );

    const person = attributeFor(result, "Person");

    expect(person.individuals).toHaveLength(1);
    expect(person.instances).toBe(0);
  });

  it("counts a member whose IRI is also a class as an instance", () => {
    const result = build(
      factory.getOWLDeclarationAxiom(factory.getOWLClass(iri("MonthOfYear"))),
      factory.getOWLDeclarationAxiom(factory.getOWLClass(iri("January"))),
      factory.getOWLClassAssertionAxiom(
        factory.getOWLClass(iri("MonthOfYear")),
        factory.getOWLNamedIndividual(iri("January")),
      ),
    );

    const month = attributeFor(result, "MonthOfYear");

    expect(month.instances).toBe(1);
    expect(month.individuals ?? []).toHaveLength(0);
  });
});
