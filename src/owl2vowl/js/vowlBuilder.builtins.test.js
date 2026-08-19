import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { createOntologyID } from "../../owlapi-js/model/structural.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (value) => IRI.create(value);

const OWL_THING = "http://www.w3.org/2002/07/owl#Thing";
const RDFS_LITERAL = "http://www.w3.org/2000/01/rdf-schema#Literal";

// `owl:Thing` and `rdfs:Literal` are the two nodes VOWL introduces itself rather
// than reading from the ontology, so how they are labelled is a presentation
// convention rather than a fact about the document. The pinned oracle is
// entirely consistent about it across all 46 reference outputs - 340 occurrences
// of `owl:Thing` and 510 of `rdfs:Literal`, each with exactly one label shape -
// and VOWL-JSON has no specification, so the oracle's rendering is the contract.
//
// The two shapes differ from each other, which is why this is pinned rather than
// derived: `owl:Thing` carries only the undefined-language label while
// `rdfs:Literal` carries both.
const buildWithBuiltins = () => {
  const property = factory.getOWLObjectProperty(iri("http://example.org/p"));
  const dataProperty = factory.getOWLDataProperty(iri("http://example.org/d"));
  return new VOWLBuilder().build(
    new OWLOntology({
      axioms: [
        factory.getOWLDeclarationAxiom(property),
        factory.getOWLDeclarationAxiom(dataProperty),
      ],
    }),
  );
};

const labelOf = (result, entityIri) =>
  result.classAttribute.find(({ iri: classIri }) => classIri === entityIri)
    ?.label;

// `external` marks an entity drawn from outside the ontology being displayed.
// A datatype in the OWL 2 datatype map is not that, and the authority is the
// specification rather than the oracle's behaviour: OWL 2 Structural
// Specification section 4 states that `Declaration( Datatype( I ) )` for each
// IRI I in the map is automatically included in every ontology. A map member is
// therefore part of every ontology by definition and cannot be external to one.
//
// A datatype outside the map is user-defined and belongs to some ontology, so it
// stays subject to the ordinary test - which the oracle's blanket silence on all
// datatypes would have obscured.
describe("external marking of datatype nodes", () => {
  it("does not mark an OWL 2 datatype-map member external", () => {
    const dataProperty = factory.getOWLDataProperty(
      iri("http://example.org/vocab#age"),
    );
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(dataProperty),
          factory.getOWLDataPropertyRangeAxiom(
            dataProperty,
            factory.getOWLDatatype(
              iri("http://www.w3.org/2001/XMLSchema#string"),
            ),
          ),
        ],
        ontologyID: createOntologyID(iri("http://example.org/vocab")),
      }),
    );

    const datatype = result.classAttribute.find(
      ({ iri: classIri }) =>
        classIri === "http://www.w3.org/2001/XMLSchema#string",
    );

    expect(datatype).toBeDefined();
    expect(datatype.attributes ?? []).not.toContain("external");
  });
});

// An entity belongs to the ontology being displayed when its base IRI *is* the
// ontology's, not merely when it sits somewhere beneath it. A prefix test treats
// every deeper path as local, so `drammar.owl#Emotion` counts as belonging to
// `http://www.cadmos.cirma.unito.it` even though it is a different document
// entirely. The oracle marks all 136 such entities external and we marked none.
describe("external marking by base IRI", () => {
  const buildWithEntity = (entityIri, ontologyIri) =>
    new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(factory.getOWLClass(iri(entityIri))),
        ],
        ontologyID: createOntologyID(iri(ontologyIri)),
      }),
    );

  const attributesOf = (result, entityIri) =>
    result.classAttribute.find(({ iri: classIri }) => classIri === entityIri)
      ?.attributes ?? [];

  it("treats an entity in the ontology's own namespace as local", () => {
    const entity = "http://example.org/vocab#Thing";

    expect(
      attributesOf(buildWithEntity(entity, "http://example.org/vocab"), entity),
    ).not.toContain("external");
  });

  it("treats an entity in a deeper namespace as external", () => {
    const entity = "http://example.org/vocab/module/doc.owl#Thing";

    expect(
      attributesOf(buildWithEntity(entity, "http://example.org/vocab"), entity),
    ).toContain("external");
  });
});

describe("labels of the VOWL built-in nodes", () => {
  it("labels owl:Thing the way the oracle does", () => {
    expect(labelOf(buildWithBuiltins(), OWL_THING)).toEqual({
      undefined: "Thing",
    });
  });

  it("labels rdfs:Literal the way the oracle does", () => {
    expect(labelOf(buildWithBuiltins(), RDFS_LITERAL)).toEqual({
      "IRI-based": "Literal",
      undefined: "Literal",
    });
  });
});
