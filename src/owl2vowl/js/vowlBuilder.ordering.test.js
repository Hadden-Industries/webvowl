import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

const factory = new OWLDataFactory();
const iri = (value) => IRI.create(value);

// Canonical ordering must be a function of the ontology, never of the machine.
// `String.prototype.localeCompare` is neither: it depends on the runtime's
// default locale and ICU build. It also treats `#` and `-` as low-weight
// punctuation, which on the PROV namespaces inverts the result completely -
// locale collation sorts `prov#` last where code-point comparison sorts it
// first.
//
// These namespaces differ in case, where the two orderings disagree reliably:
// code-point puts `Zeta` first because `Z` is 0x5A and `a` is 0x61, while
// collation groups by letter and puts `alpha` first.
const NAMESPACES = ["http://example.org/Zeta#", "http://example.org/alpha#"];

const build = () =>
  new VOWLBuilder().build(
    new OWLOntology({
      axioms: NAMESPACES.map((namespace, index) =>
        factory.getOWLDeclarationAxiom(
          factory.getOWLClass(iri(`${namespace}Thing${index}`)),
        ),
      ),
    }),
  );

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const SUBJECT = "http://example.org/vocab#Thing";

// A document may state two labels for the same language. VOWL-JSON holds one
// value per language, so one has to be dropped, and which one must not depend on
// the order the axioms happen to be visited. Keeping the code-point-smaller
// value makes the outcome a total function of the values themselves.
const buildWithLabels = (...values) =>
  new VOWLBuilder().build(
    new OWLOntology({
      axioms: [
        factory.getOWLDeclarationAxiom(factory.getOWLClass(iri(SUBJECT))),
        ...values.map((value) =>
          factory.getOWLAnnotationAssertionAxiom(
            factory.getOWLAnnotationProperty(iri(RDFS_LABEL)),
            iri(SUBJECT),
            factory.getOWLLiteral(value, "en"),
          ),
        ),
      ],
    }),
  );

const labelOf = (result) =>
  result.classAttribute.find(({ iri: classIri }) => classIri === SUBJECT).label
    .en;

describe("competing values for one language", () => {
  it("keeps the same label whichever order the axioms arrive in", () => {
    expect(labelOf(buildWithLabels("Zebra", "Aardvark"))).toBe(
      labelOf(buildWithLabels("Aardvark", "Zebra")),
    );
  });

  it("keeps the code-point-smaller value", () => {
    expect(labelOf(buildWithLabels("Zebra", "Aardvark"))).toBe("Aardvark");
  });

  it("prefers an uppercase value, which collation would order second", () => {
    expect(labelOf(buildWithLabels("apple", "Apple"))).toBe("Apple");
  });
});

describe("canonical ordering in VOWL output", () => {
  it("orders base IRIs by code point rather than locale collation", () => {
    const { header } = build();

    const localeOrder = [...header.baseIris].sort((left, right) =>
      left.localeCompare(right),
    );
    const binaryOrder = [...header.baseIris].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );

    // Guard the guard: if these ever agree, the fixture stopped exercising the
    // difference and the assertion below would pass vacuously.
    expect(localeOrder).not.toEqual(binaryOrder);
    expect(header.baseIris).toEqual(binaryOrder);
  });
});
