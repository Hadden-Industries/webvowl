import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (local) => IRI.create(`https://example.com/split#${local}`);
const owlClass = (local) => factory.getOWLClass(iri(local));
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const OWL_THING = "http://www.w3.org/2002/07/owl#Thing";
const RDFS_LITERAL = "http://www.w3.org/2000/01/rdf-schema#Literal";

const buildWith = (...axioms) =>
  new VOWLBuilder().build(new OWLOntology({ axioms }));

const nodesFor = (result, classIri) =>
  result.classAttribute.filter(({ iri: nodeIri }) => nodeIri === classIri);

const edgesTouching = (result, id) =>
  result.propertyAttribute.filter(
    ({ domain, range }) => domain === id || range === id,
  );

// VOWL 2 defines splitting rules for the generic elements, because they carry
// no domain information yet attract a great many links: drawn once each they
// become hubs that dominate the layout and suggest an importance they do not
// have. Table 3 gives two rules - `rdfs:Datatype` and `rdfs:Literal` are drawn
// once for every property they are linked to, and `owl:Thing` and
// `rdfs:Resource` once for every class - and notes that each link connects to
// only one representation.
//
// The renderer implements none of this, so it falls to whatever produces the
// VOWL-JSON. The pinned oracle does it: across ten corpus documents it emits 651
// generic node instances where we emitted 44, one per distinct IRI. In
// `schemaorg.owl` that is 371 against 2.
//
// The corpus differential cannot see the difference, because its `classes`
// dimension compares distinct IRIs as a set. It is nonetheless the difference
// between one `owl:Thing` bubble with 185 edges and 185 small ones beside the
// properties they belong to.
describe("VOWLBuilder splitting of generic nodes", () => {
  const datatypeProperty = (local) => factory.getOWLDataProperty(iri(local));
  const stringRange = (local) =>
    factory.getOWLDataPropertyRangeAxiom(
      datatypeProperty(local),
      factory.getOWLDatatype(IRI.create(XSD_STRING)),
    );
  const domainOf = (local, className) =>
    factory.getOWLDataPropertyDomainAxiom(
      datatypeProperty(local),
      owlClass(className),
    );

  it("draws a datatype once for each property that links to it", () => {
    const result = buildWith(
      domainOf("name", "Person"),
      stringRange("name"),
      domainOf("title", "Book"),
      stringRange("title"),
    );

    expect(nodesFor(result, XSD_STRING)).toHaveLength(2);
  });

  it("connects each link to only one representation", () => {
    const result = buildWith(
      domainOf("name", "Person"),
      stringRange("name"),
      domainOf("title", "Book"),
      stringRange("title"),
    );

    for (const node of nodesFor(result, XSD_STRING)) {
      expect(edgesTouching(result, node.id)).toHaveLength(1);
    }
  });

  it("draws a datatype once when only one property links to it", () => {
    const result = buildWith(domainOf("name", "Person"), stringRange("name"));

    expect(nodesFor(result, XSD_STRING)).toHaveLength(1);
  });

  // `owl:Thing` splits by class, not by property: an element linked to n
  // classes is drawn n times, however many links each class contributes.
  it("draws owl:Thing once for each class that links to it", () => {
    const result = buildWith(
      factory.getOWLObjectPropertyDomainAxiom(
        factory.getOWLObjectProperty(iri("knows")),
        owlClass("Person"),
      ),
      factory.getOWLObjectPropertyDomainAxiom(
        factory.getOWLObjectProperty(iri("owns")),
        owlClass("Person"),
      ),
      factory.getOWLObjectPropertyDomainAxiom(
        factory.getOWLObjectProperty(iri("cites")),
        owlClass("Book"),
      ),
    );

    expect(nodesFor(result, OWL_THING)).toHaveLength(2);
  });

  // A datatype property with no declared range takes `rdfs:Literal`, which
  // splits by property like any other datatype node.
  it("draws rdfs:Literal once for each property that links to it", () => {
    const result = buildWith(
      domainOf("name", "Person"),
      domainOf("title", "Book"),
    );

    expect(nodesFor(result, RDFS_LITERAL)).toHaveLength(2);
  });

  // Named classes are not generic and are never multiplied.
  it("does not split a named class", () => {
    const result = buildWith(
      factory.getOWLObjectPropertyDomainAxiom(
        factory.getOWLObjectProperty(iri("knows")),
        owlClass("Person"),
      ),
      factory.getOWLObjectPropertyDomainAxiom(
        factory.getOWLObjectProperty(iri("owns")),
        owlClass("Person"),
      ),
    );

    expect(nodesFor(result, iri("Person").value)).toHaveLength(1);
  });

  it("does not depend on the order the axioms arrive in", () => {
    const axioms = [
      domainOf("name", "Person"),
      stringRange("name"),
      domainOf("title", "Book"),
      stringRange("title"),
    ];
    const forwards = buildWith(...axioms);
    const backwards = buildWith(...[...axioms].reverse());

    const shape = (result) =>
      nodesFor(result, XSD_STRING)
        .map((node) =>
          edgesTouching(result, node.id)
            .map(({ iri: edgeIri }) => edgeIri)
            .sort()
            .join(","),
        )
        .sort();

    expect(shape(backwards)).toEqual(shape(forwards));
  });
});
