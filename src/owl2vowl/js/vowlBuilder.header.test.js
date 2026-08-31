import { describe, expect, it } from "@jest/globals";

import { IRI, OWLDataFactory, OWLOntology } from "owlapi/model";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (value) => IRI.create(value);

// Four corpus documents - dc.rdf, dcmitype.rdf, dcterms.rdf and wgs84_pos.rdf -
// declare no `owl:Ontology` header at all. The pinned OWL2VOWL oracle serialises
// the header IRI of such a document as the literal string "No IRI set", and that
// is what WebVOWL v1.1.7 displayed in its sidebar. VOWL-JSON has no
// specification, so the oracle's rendering is the contract.
//
// The placeholder is presentation only and must not reach the graph logic:
// `isExternalEntityIri` treats an empty ontology IRI as "cannot judge" and marks
// nothing external, but any non-empty value as a prefix to compare against. A
// truthy placeholder in that comparison would mark every entity in these four
// documents external, which is a far worse regression than the blank IRI.
const buildWithOntologyIri = (ontologyIRI) =>
  new VOWLBuilder().build(
    new OWLOntology({
      axioms: [
        factory.getOWLDeclarationAxiom(
          factory.getOWLClass(iri("http://example.org/vocab#Thing")),
        ),
      ],
      ontologyID: ontologyIRI
        ? factory.getOWLOntologyID(iri(ontologyIRI))
        : factory.getOWLOntologyID(undefined),
    }),
  );

describe("VOWL header IRI", () => {
  it("renders a missing ontology IRI the way the oracle does", () => {
    const result = buildWithOntologyIri(undefined);

    expect(result.header.iri).toBe("No IRI set");
  });

  // A document that names no ontology has no namespace of its own, so nothing
  // can belong to it and every entity is external. The oracle agrees: in
  // `dcmitype.rdf` all 12 entities are marked external, and in `wgs84_pos.rdf`
  // 3 of 4, the exception being `owl:Thing`.
  //
  // The guard that matters here is that the `"No IRI set"` placeholder is a
  // serialisation concern and must not reach this comparison. Were it to, it
  // would be compared as an ordinary IRI, and the outcome would depend on a
  // display string rather than on the ontology.
  it("marks entities external when the ontology has no IRI", () => {
    const result = buildWithOntologyIri(undefined);

    const attribute = result.classAttribute.find(
      ({ iri: classIri }) => classIri === "http://example.org/vocab#Thing",
    );

    expect(attribute.attributes ?? []).toContain("external");
    expect(result.header.iri).toBe("No IRI set");
  });

  it("leaves a declared ontology IRI unchanged", () => {
    const result = buildWithOntologyIri("http://example.org/vocab");

    expect(result.header.iri).toBe("http://example.org/vocab");
  });
});
