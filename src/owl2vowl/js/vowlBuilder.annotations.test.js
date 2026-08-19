import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (value) => IRI.create(value);

const RDFS_IS_DEFINED_BY = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";
const DCTERMS_TITLE = "http://purl.org/dc/terms/title";
const DCTERMS_SOURCE = "http://purl.org/dc/terms/source";
const OTHER_SOURCE = "http://example.org/other#source";
const SUBJECT = "http://example.org/vocab#Thing";

// VOWL-JSON groups annotations under a key derived from the annotation
// property's local name, and the pinned OWL2VOWL oracle repeats that same local
// name in each item's `identifier` field - in every one of the 46 reference
// outputs, `identifier` is exactly the key it sits under. We were emitting the
// full property IRI instead, which is the single cause of the annotation
// differences across 21 corpus documents.
//
// VOWL-JSON has no specification, so the oracle's rendering is the contract.
// It is also what WebVOWL v1.1.7 showed in its sidebar, where "isDefinedBy"
// reads considerably better than the full RDFS IRI.
const buildWithAnnotation = (propertyIri, value) =>
  new VOWLBuilder().build(
    new OWLOntology({
      axioms: [
        factory.getOWLDeclarationAxiom(factory.getOWLClass(iri(SUBJECT))),
        factory.getOWLAnnotationAssertionAxiom(
          factory.getOWLAnnotationProperty(iri(propertyIri)),
          iri(SUBJECT),
          value,
        ),
      ],
    }),
  );

const annotationsOf = (result) =>
  result.classAttribute.find(({ iri: classIri }) => classIri === SUBJECT)
    .annotations;

describe("VOWL annotation identifiers", () => {
  it("identifies a hash-delimited annotation property by its local name", () => {
    const annotations = buildWithAnnotation(
      RDFS_IS_DEFINED_BY,
      iri("http://example.org/vocab"),
    );

    expect(annotationsOf(annotations).isDefinedBy[0].identifier).toBe(
      "isDefinedBy",
    );
  });

  it("identifies a slash-delimited annotation property by its local name", () => {
    const annotations = buildWithAnnotation(
      DCTERMS_TITLE,
      factory.getOWLLiteral("A title", "en"),
    );

    expect(annotationsOf(annotations).title[0].identifier).toBe("title");
  });

  // `identifier` alone cannot distinguish two annotation properties that share a
  // local name, and VOWL-JSON already groups both under that shared name. The
  // oracle has the same flaw; it simply never manifests in the pinned corpus.
  //
  // `predicateNs` restores what the local name discards, without disturbing the
  // field the oracle defines: the corpus differential projects each annotation
  // onto {value, type, language, identifier}, so an added field costs nothing in
  // parity terms. `src/app/js/sidebar.js` already reads it to hyperlink an
  // annotation predicate, and the legacy `rdfParser.js` used to supply it, so
  // emitting it here also restores a feature the cutover silently dropped.
  it.each([
    ["http://www.w3.org/2000/01/rdf-schema#isDefinedBy", "isDefinedBy"],
    ["http://purl.org/dc/terms/title", "title"],
  ])(
    "reconstructs %s from its namespace and local name",
    (propertyIri, key) => {
      const annotations = annotationsOf(
        buildWithAnnotation(
          propertyIri,
          factory.getOWLLiteral("a value", "en"),
        ),
      );
      const item = annotations[key][0];

      expect(item.predicateNs + item.identifier).toBe(propertyIri);
    },
  );

  it("distinguishes two annotation properties that share a local name", () => {
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(factory.getOWLClass(iri(SUBJECT))),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(DCTERMS_SOURCE)),
            iri(SUBJECT),
            factory.getOWLLiteral("from dcterms", "en"),
          ),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(OTHER_SOURCE)),
            iri(SUBJECT),
            factory.getOWLLiteral("from example", "en"),
          ),
        ],
      }),
    );

    const namespaces = annotationsOf(result)
      .source.map(({ predicateNs }) => predicateNs)
      .sort();

    expect(namespaces).toEqual(
      ["http://example.org/other#", "http://purl.org/dc/terms/"].sort(),
    );
  });

  it("keeps the identifier equal to the key it is grouped under", () => {
    const annotations = annotationsOf(
      buildWithAnnotation(RDFS_IS_DEFINED_BY, iri("http://example.org/vocab")),
    );

    for (const [key, items] of Object.entries(annotations)) {
      for (const item of items) {
        expect(item.identifier).toBe(key);
      }
    }
  });
});
