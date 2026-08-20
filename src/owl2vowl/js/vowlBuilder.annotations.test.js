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

// VOWL-JSON holds one label per language, so a class stating two in the same
// language forces a choice. Making it on the values rather than on the order
// they were read is necessary but not sufficient: code-point order is arbitrary,
// and on `iso-iec_11179_-3_ed-4_20260714` it picks the acronym "DEC" over "Data
// Element Concept".
//
// Where the document states a `skos:prefLabel` it has ranked them itself. SKOS
// defines that property as the preferred lexical label for a resource in a given
// language, which is exactly the question being asked, so it decides and
// code-point order remains the fallback for everything else. That keeps the
// outcome a total function of the values - no dependence on document order -
// while no longer discarding a ranking the author supplied.
const SKOS_PREF_LABEL = "http://www.w3.org/2004/02/skos/core#prefLabel";

describe("VOWLBuilder competing labels in one language", () => {
  const CLASS_IRI = "http://example.org/vocab#DataElementConcept";

  const labelled = (...values) => {
    const subject = factory.getOWLClass(iri(CLASS_IRI));
    const assertion = (propertyIri, text) =>
      factory.getOWLAnnotationAssertionAxiom(
        factory.getOWLAnnotationProperty(iri(propertyIri)),
        subject.iri,
        factory.getOWLLiteral(text, "en"),
      );
    return new VOWLBuilder()
      .build(
        new OWLOntology({
          axioms: [
            factory.getOWLDeclarationAxiom(subject),
            ...values.map(([propertyIri, text]) =>
              assertion(propertyIri, text),
            ),
          ],
        }),
      )
      .classAttribute.find(({ iri: classIri }) => classIri === CLASS_IRI).label;
  };

  const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

  it("prefers the label the document marks preferred", () => {
    const label = labelled(
      [RDFS_LABEL, "DEC"],
      [RDFS_LABEL, "Data Element Concept"],
      [SKOS_PREF_LABEL, "Data Element Concept"],
    );

    expect(label.en).toBe("Data Element Concept");
  });

  // Reversed input must give the same answer.
  it("does not depend on the order the labels arrive in", () => {
    const forwards = labelled(
      [RDFS_LABEL, "DEC"],
      [RDFS_LABEL, "Data Element Concept"],
      [SKOS_PREF_LABEL, "Data Element Concept"],
    );
    const backwards = labelled(
      [SKOS_PREF_LABEL, "Data Element Concept"],
      [RDFS_LABEL, "Data Element Concept"],
      [RDFS_LABEL, "DEC"],
    );

    expect(backwards.en).toBe(forwards.en);
  });

  // With nothing to rank them, the code-point rule still decides.
  it("falls back to code-point order when nothing is preferred", () => {
    const label = labelled(
      [RDFS_LABEL, "stakeholder"],
      [RDFS_LABEL, "interested party"],
    );

    expect(label.en).toBe("interested party");
  });

  // A preferred label in another language cannot decide this one.
  it("only ranks within the language it was stated for", () => {
    const subject = factory.getOWLClass(iri(CLASS_IRI));
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(RDFS_LABEL)),
            subject.iri,
            factory.getOWLLiteral("DEC", "en"),
          ),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(RDFS_LABEL)),
            subject.iri,
            factory.getOWLLiteral("Data Element Concept", "en"),
          ),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(SKOS_PREF_LABEL)),
            subject.iri,
            factory.getOWLLiteral("Data Element Concept", "fr"),
          ),
        ],
      }),
    );

    expect(
      result.classAttribute.find(({ iri: classIri }) => classIri === CLASS_IRI)
        .label.en,
    ).toBe("DEC");
  });
});

// VOWL 2 gives deprecated classes and properties their own representation, with
// the indication "deprecated" in brackets and the deprecated colour. OWL 2
// states deprecation with the built-in annotation property `owl:deprecated`
// carrying the boolean true; the OWL 1 spellings `owl:DeprecatedClass` and
// `owl:DeprecatedProperty` are normalised into that same form when the RDF is
// translated, so this is the single place the marker has to be recognised.
//
// `goodrelations.owl` marks twelve entities this way. The pinned oracle draws
// five of them deprecated and VOWLBuilder drew none.
const OWL_DEPRECATED = "http://www.w3.org/2002/07/owl#deprecated";
const XSD_BOOLEAN = "http://www.w3.org/2001/XMLSchema#boolean";

const deprecationOf = (entity, lexicalForm = "true") =>
  factory.getOWLAnnotationAssertionAxiom(
    factory.getOWLAnnotationProperty(iri(OWL_DEPRECATED)),
    entity.iri,
    factory.getOWLLiteral(lexicalForm, iri(XSD_BOOLEAN)),
  );

// An `owl:Axiom` reification annotates an axiom rather than an entity. OWL 2
// keeps that distinction, and so does the translator: the note below annotates
// the `dcterms:source` assertion on the class, not the class itself.
//
// VOWL-JSON has no such distinction. Its `annotations` map is keyed by property
// and hangs off the entity, so an axiom annotation either appears there or is
// not shown at all. The pinned oracle puts it there, and VOWL-JSON is the one
// artifact ADR 0004 assigns to the implementation rather than a specification,
// so that rendering is the contract. Keeping it on the axiom means the sidebar
// silently loses what the document states.
//
// `iso_31073_ed-1_20260626` states 33 of these, all `skos:note` explaining how
// a definition was modified from the source standard.
describe("VOWLBuilder annotations carried on an axiom", () => {
  const SKOS_NOTE = "http://www.w3.org/2004/02/skos/core#note";
  const SUBJECT_CLASS = "http://example.org/vocab#RiskReporting";

  const buildWithAxiomAnnotation = () => {
    const subject = factory.getOWLClass(iri(SUBJECT_CLASS));
    return new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(DCTERMS_SOURCE)),
            subject.iri,
            factory.getOWLLiteral("ISO Guide 73:2009", "en"),
            [
              factory.getOWLAnnotation(
                factory.getOWLAnnotationProperty(iri(SKOS_NOTE)),
                factory.getOWLLiteral(
                  "interested party replaced stakeholder",
                  "en",
                ),
              ),
            ],
          ),
        ],
      }),
    );
  };

  const annotationsFor = (result) =>
    result.classAttribute.find(
      ({ iri: classIri }) => classIri === SUBJECT_CLASS,
    )?.annotations ?? {};

  it("nests the axiom's annotation under the annotation it describes", () => {
    const annotations = annotationsFor(buildWithAxiomAnnotation());

    expect(
      annotations.source?.[0]?.annotations?.note?.map(({ value }) => value),
    ).toEqual(["interested party replaced stakeholder"]);
  });

  // The entity must not acquire it. `skos:note` describes the source
  // statement, not the class, and promoting it says the class has a note.
  it("does not promote it to the entity", () => {
    const annotations = annotationsFor(buildWithAxiomAnnotation());

    expect(annotations.note).toBeUndefined();
  });

  it("keeps the annotation the axiom itself asserts", () => {
    const annotations = annotationsFor(buildWithAxiomAnnotation());

    expect(annotations.source?.map(({ value }) => value)).toEqual([
      "ISO Guide 73:2009",
    ]);
  });

  // The whole reason `owl:annotatedTarget` exists is to say which assertion is
  // meant when a property is asserted more than once. Flattening computed that
  // and then discarded it, leaving two sources on the entity with no way to
  // pair them back to their definitions.
  it("keeps two assertions of one property apart", () => {
    const subject = factory.getOWLClass(iri(SUBJECT_CLASS));
    const definitionWithSource = (text, source) =>
      factory.getOWLAnnotationAssertionAxiom(
        factory.getOWLAnnotationProperty(iri(DCTERMS_SOURCE)),
        subject.iri,
        factory.getOWLLiteral(text, "en"),
        [
          factory.getOWLAnnotation(
            factory.getOWLAnnotationProperty(iri(SKOS_NOTE)),
            factory.getOWLLiteral(source, "en"),
          ),
        ],
      );

    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          definitionWithSource("first statement", "note for the first"),
          definitionWithSource("second statement", "note for the second"),
        ],
      }),
    );

    const paired = annotationsFor(result)
      .source.map(
        ({ value, annotations }) =>
          `${value} :: ${annotations.note.map((n) => n.value).join(",")}`,
      )
      .sort();

    expect(paired).toEqual([
      "first statement :: note for the first",
      "second statement :: note for the second",
    ]);
  });

  // `rdfs:label`, `rdfs:comment` and a description land in their own fields
  // rather than as annotation items, so an axiom annotating one of those has no
  // item to nest on and its annotations were being dropped. The assertion is
  // therefore surfaced as an annotation item as well, but only when the axiom
  // carries something that would otherwise be lost - a plain label keeps the
  // shape it always had.
  //
  // Thirteen `rdfs:label` reifications in the corpus depend on this.
  it("surfaces an annotated label so its annotations have a home", () => {
    const subject = factory.getOWLClass(iri(SUBJECT_CLASS));
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(
              iri("http://www.w3.org/2000/01/rdf-schema#label"),
            ),
            subject.iri,
            factory.getOWLLiteral("Risk Reporting", "en"),
            [
              factory.getOWLAnnotation(
                factory.getOWLAnnotationProperty(iri(SKOS_NOTE)),
                factory.getOWLLiteral("renamed in edition 2", "en"),
              ),
            ],
          ),
        ],
      }),
    );
    const entity = result.classAttribute.find(
      ({ iri: classIri }) => classIri === SUBJECT_CLASS,
    );

    expect(entity.label.en).toBe("Risk Reporting");
    expect(
      entity.annotations.label[0].annotations.note.map(({ value }) => value),
    ).toEqual(["renamed in edition 2"]);
  });

  it("leaves a plain label out of the annotations map", () => {
    const subject = factory.getOWLClass(iri(SUBJECT_CLASS));
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(
              iri("http://www.w3.org/2000/01/rdf-schema#label"),
            ),
            subject.iri,
            factory.getOWLLiteral("Risk Reporting", "en"),
          ),
        ],
      }),
    );
    const entity = result.classAttribute.find(
      ({ iri: classIri }) => classIri === SUBJECT_CLASS,
    );

    expect(entity.label.en).toBe("Risk Reporting");
    expect(entity.annotations?.label).toBeUndefined();
  });

  // An annotation with none of its own carries no empty container.
  it("adds nothing to an annotation the axiom does not describe", () => {
    const subject = factory.getOWLClass(iri(SUBJECT_CLASS));
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(subject),
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(DCTERMS_SOURCE)),
            subject.iri,
            factory.getOWLLiteral("plain", "en"),
          ),
        ],
      }),
    );

    expect(annotationsFor(result).source[0]).not.toHaveProperty("annotations");
  });
});

describe("VOWLBuilder deprecated entities", () => {
  const deprecatedClass = factory.getOWLClass(
    iri("http://example.org/vocab#Legacy"),
  );
  const deprecatedProperty = factory.getOWLDataProperty(
    iri("http://example.org/vocab#isListPrice"),
  );

  const attributesFor = (result, entity) =>
    [...result.classAttribute, ...result.propertyAttribute].find(
      ({ iri: entityIri }) => entityIri === entity.iri.value,
    )?.attributes ?? [];

  it("marks a deprecated class", () => {
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(deprecatedClass),
          deprecationOf(deprecatedClass),
        ],
      }),
    );

    expect(attributesFor(result, deprecatedClass)).toContain("deprecated");
  });

  it("marks a deprecated property", () => {
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(deprecatedProperty),
          deprecationOf(deprecatedProperty),
        ],
      }),
    );

    expect(attributesFor(result, deprecatedProperty)).toContain("deprecated");
  });

  // `owl:deprecated false` is a statement that the entity is not deprecated, so
  // it must not draw the marker.
  it("does not mark an entity deprecated false", () => {
    const result = new VOWLBuilder().build(
      new OWLOntology({
        axioms: [
          factory.getOWLDeclarationAxiom(deprecatedClass),
          deprecationOf(deprecatedClass, "false"),
        ],
      }),
    );

    expect(attributesFor(result, deprecatedClass)).not.toContain("deprecated");
  });
});
