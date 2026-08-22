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
const PUNNED = "http://xmlns.com/foaf/0.1/mbox_sha1sum";

// ADR 0005 resolves an IRI declared in more than one property category to a
// single category by the fixed precedence data > object > annotation, and names
// `foaf:mbox_sha1sum` as the motivating case: the live WebVOWL v1.1.7 service,
// the pinned OWL2VOWL 0.3.7 oracle and the pre-cutover legacy pipeline all render
// it as a datatype property.
//
// The translator resolves the declaration correctly, but FOAF also asserts
// InverseFunctionalObjectProperty over the same IRI, and the axiom-level reuse
// recovery that ADR 0005 requires puts it back into the object-property
// signature. VOWLBuilder took whichever category it saw first, so the rendered
// node contradicted the decision the translator had already made.
//
// A characteristic that only applies to object properties must not be drawn on a
// property resolved to data either: the oracle emits exactly ["datatype"] here,
// dropping the inverse-functional marker as inapplicable.
// The ontology is given FOAF's own IRI so the punned property is local. Without
// it every entity would also carry `external`, which is correct but would clutter
// assertions aimed at the category resolution.
const build = (...axioms) => {
  const result = new VOWLBuilder().build(
    new OWLOntology({
      axioms,
      ontologyID: createOntologyID(IRI.create("http://xmlns.com/foaf/0.1")),
    }),
  );
  const attribute = result.propertyAttribute.find(({ iri: i }) => i === PUNNED);
  const node = result.property.find(({ id }) => id === attribute.id);
  return { attributes: attribute.attributes, type: node.type };
};

const dataDeclaration = factory.getOWLDeclarationAxiom(
  factory.getOWLDataProperty(iri(PUNNED)),
);
const objectDeclaration = factory.getOWLDeclarationAxiom(
  factory.getOWLObjectProperty(iri(PUNNED)),
);
const inverseFunctional = factory.getOWLInverseFunctionalObjectPropertyAxiom(
  factory.getOWLObjectProperty(iri(PUNNED)),
);

describe("VOWL rendering of a cross-category punned property", () => {
  it("renders it as a datatype property whichever declaration comes first", () => {
    expect(build(dataDeclaration, objectDeclaration).type).toBe(
      "owl:datatypeProperty",
    );
    expect(build(objectDeclaration, dataDeclaration).type).toBe(
      "owl:datatypeProperty",
    );
  });

  it("omits an object-only characteristic once resolved to data", () => {
    const { attributes } = build(
      dataDeclaration,
      objectDeclaration,
      inverseFunctional,
    );

    expect(attributes).toEqual(["datatype"]);
  });

  it("still records the characteristic on a genuine object property", () => {
    const { attributes, type } = build(objectDeclaration, inverseFunctional);

    expect(type).toBe("owl:objectProperty");
    expect(attributes).toEqual(["object", "inverse functional"]);
  });
});
