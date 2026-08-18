import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (local) => IRI.create(`https://example.com/phase8#${local}`);
const owlClass = (local) => factory.getOWLClass(iri(local));

const buildWith = (...axioms) =>
  new VOWLBuilder().build(new OWLOntology({ axioms }));

const attributeFor = (result, id) =>
  result.classAttribute.find((attribute) => attribute.id === id);

const nodeFor = (result, id) => result.class.find((node) => node.id === id);

describe("VOWLBuilder anonymous class expressions", () => {
  it("maps a union used as an object property domain", () => {
    const property = factory.getOWLObjectProperty(iri("knows"));
    const union = factory.getOWLObjectUnionOf([
      owlClass("Person"),
      owlClass("Organisation"),
    ]);

    const result = buildWith(
      factory.getOWLObjectPropertyDomainAxiom(property, union),
    );

    const domainId = result.propertyAttribute.find(
      ({ iri: propertyIri }) => propertyIri === iri("knows").value,
    ).domain;
    const domain = attributeFor(result, domainId);

    expect(nodeFor(result, domainId).type).toBe("owl:unionOf");
    expect(domain.attributes).toEqual(
      expect.arrayContaining(["union", "anonymous"]),
    );
    expect(domain.iri).toBeUndefined();
    expect(
      domain.union.map((memberId) => attributeFor(result, memberId).iri).sort(),
    ).toEqual([iri("Organisation").value, iri("Person").value]);
  });

  // The pinned OWL2VOWL oracle emits no node type for any restriction and never
  // emits `owl:hasValue` at all across the 44 reference outputs. A restriction
  // in a node position is therefore not visualisable, and collapses to
  // `owl:Thing`, which is already the builder's default for an unspecified
  // domain or range.
  it("collapses a restriction used as a domain to owl:Thing", () => {
    const property = factory.getOWLObjectProperty(iri("knows"));
    const hasValue = factory.getOWLObjectHasValue(
      factory.getOWLObjectProperty(iri("memberOf")),
      factory.getOWLNamedIndividual(iri("Acme")),
    );

    const result = buildWith(
      factory.getOWLObjectPropertyDomainAxiom(property, hasValue),
    );

    const domainId = result.propertyAttribute.find(
      ({ iri: propertyIri }) => propertyIri === iri("knows").value,
    ).domain;

    expect(attributeFor(result, domainId).iri).toBe(
      "http://www.w3.org/2002/07/owl#Thing",
    );
  });

  // `addRelation` deliberately draws no edge when domain and range are the same
  // node, and returns nothing in that case. Collapsing a non-visualisable
  // filler to `owl:Thing` made that path reachable from a class whose domain is
  // also `owl:Thing`, so the caller has to tolerate the absent relation rather
  // than dereference it.
  it("skips a cardinality restriction whose domain and range coincide", () => {
    const property = factory.getOWLObjectProperty(iri("relatesTo"));
    const restriction = factory.getOWLObjectExactCardinality(
      1,
      property,
      owlClass("Thing"),
    );

    expect(() =>
      buildWith(factory.getOWLSubClassOfAxiom(owlClass("Thing"), restriction)),
    ).not.toThrow();
  });
});
