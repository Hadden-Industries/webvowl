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

// VOWL 2 draws a cardinality as a number near the end of the property's arrow,
// so a cardinality restriction contributes a label to an edge rather than an
// edge of its own. Where the restricted class and filler are the property's own
// domain and range, the edge it would otherwise add is the edge that is already
// there, and drawing both says nothing the first said.
// `universal_reference-data_20260714` produced 297 such duplicate pairs.
//
// The merge is deliberately confined to cardinality. A quantified restriction
// has no representation in VOWL 2 at all, so its edge is an extension whose
// shape no specification governs, and the pinned oracle draws it separately
// even when the endpoints coincide. Following the specification where it speaks
// and the oracle where it is silent leaves the two cases on opposite sides.
//
// The merge happens once every axiom has been applied, so it cannot depend on
// whether the restriction or the domain and range were read first.
describe("VOWLBuilder cardinality merged into the declared edge", () => {
  const knows = () => factory.getOWLObjectProperty(iri("knows"));

  const declared = () => [
    factory.getOWLObjectPropertyDomainAxiom(knows(), owlClass("Person")),
    factory.getOWLObjectPropertyRangeAxiom(knows(), owlClass("Agent")),
  ];

  const cardinalityOn = (local, filler) =>
    factory.getOWLSubClassOfAxiom(
      owlClass(local),
      factory.getOWLObjectMinCardinality(1, knows(), owlClass(filler)),
    );

  const existentialOn = (local, filler) =>
    factory.getOWLSubClassOfAxiom(
      owlClass(local),
      factory.getOWLObjectSomeValuesFrom(knows(), owlClass(filler)),
    );

  const edgesFor = (result) =>
    result.propertyAttribute.filter(
      ({ iri: propertyIri }) => propertyIri === iri("knows").value,
    );

  it("labels the declared edge instead of adding one", () => {
    const result = buildWith(...declared(), cardinalityOn("Person", "Agent"));
    const edges = edgesFor(result);

    expect(edges).toHaveLength(1);
    expect(edges[0].minCardinality).toBe("1");
  });

  // VOWL 2 gives a property one arrow and puts the figure near its end, and
  // Table 6 covers only the unqualified forms - a qualifying class has no
  // representation at all. So a qualified cardinality restricting the same class
  // still labels that class's arrow, whatever class it names as the filler.
  //
  // `iso-iec_11179_-3_ed-4_20260714` states `AdministeredItem_registration_state`
  // with range `RegistrationState` and a cardinality restriction naming
  // `RegistrationStatus`; the oracle draws one edge and we drew two.
  it("labels the arrow even when the filler is not the declared range", () => {
    const result = buildWith(...declared(), cardinalityOn("Person", "Robot"));
    const edges = edgesFor(result);

    expect(edges).toHaveLength(1);
    expect(edges[0].minCardinality).toBe("1");
    expect(attributeFor(result, edges[0].range).iri).toBe(iri("Agent").value);
  });

  // A restriction on a different class is a different arrow, so it keeps one.
  it("keeps its own edge when the restricted class is not the domain", () => {
    const result = buildWith(...declared(), cardinalityOn("Robot", "Agent"));

    expect(edgesFor(result)).toHaveLength(2);
  });

  it("does not depend on the order the axioms arrive in", () => {
    const forwards = buildWith(...declared(), cardinalityOn("Person", "Agent"));
    const backwards = buildWith(
      cardinalityOn("Person", "Agent"),
      ...declared(),
    );

    expect(edgesFor(backwards)).toEqual(edgesFor(forwards));
  });

  // The surviving edge is declared, so it must not claim to have been inferred.
  it("does not mark the labelled edge inferred", () => {
    const result = buildWith(...declared(), cardinalityOn("Person", "Agent"));

    expect(edgesFor(result)[0].attributes).not.toContain("inferred");
  });

  // The narrowing: a quantified restriction keeps its own edge even where the
  // endpoints coincide, because nothing in VOWL 2 governs that edge's shape.
  it("does not merge a quantified restriction that coincides", () => {
    const result = buildWith(...declared(), existentialOn("Person", "Agent"));

    expect(edgesFor(result)).toHaveLength(2);
  });
});

// A set expression is built from its members, and a member with no VOWL node
// contributes nothing to draw. Collapsing such a member to `owl:Thing` instead
// changes what the expression means: a union containing the top concept is the
// top concept, so `C subClassOf (R1 or R2)` over two restrictions became
// `C subClassOf owl:Thing` - vacuously true, and an edge VOWL 2 advises against
// drawing at all, since every class is implicitly a subclass of `owl:Thing`.
//
// `time.rdf` states exactly that: `TimePosition` is a subclass of the union of
// two cardinality restrictions, and we drew it as a subclass of a union of two
// `owl:Thing` nodes.
//
// Dropping the unvisualisable members leaves the ordinary degenerate cases: a
// set of one is that one member, and a set of none has nothing to draw.
describe("VOWLBuilder set expressions with unvisualisable members", () => {
  const RDFS_SUBCLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf";

  const cardinalityRestriction = (local) =>
    factory.getOWLObjectExactCardinality(
      1,
      factory.getOWLObjectProperty(iri(local)),
      factory.getOWLClass(IRI.create("http://www.w3.org/2002/07/owl#Thing")),
    );

  const subclassEdges = (result) =>
    result.propertyAttribute.filter(
      ({ iri: edgeIri }) => edgeIri === RDFS_SUBCLASS_OF,
    );

  it("draws no edge when every member is unvisualisable", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("TimePosition"),
        factory.getOWLObjectUnionOf([
          cardinalityRestriction("numericPosition"),
          cardinalityRestriction("nominalPosition"),
        ]),
      ),
    );

    expect(subclassEdges(result)).toEqual([]);
  });

  // One surviving member makes the set that member, so the edge points at it
  // rather than at a union node with a single entry.
  it("collapses to the single member that has a node", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("TimePosition"),
        factory.getOWLObjectUnionOf([
          cardinalityRestriction("numericPosition"),
          owlClass("TemporalPosition"),
        ]),
      ),
    );
    const [edge] = subclassEdges(result);

    expect(attributeFor(result, edge.range).iri).toBe(
      iri("TemporalPosition").value,
    );
  });

  // The ordinary case is untouched: a union of named classes keeps its node.
  it("still builds a union node from members that have nodes", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("TimePosition"),
        factory.getOWLObjectUnionOf([
          owlClass("TemporalPosition"),
          owlClass("GeneralDateTimeDescription"),
        ]),
      ),
    );
    const [edge] = subclassEdges(result);

    expect(nodeFor(result, edge.range).type).toBe("owl:unionOf");
  });
});

// A restriction is drawn as an edge from the restricted class to the filler.
// Where the filler itself has no VOWL node - a nested restriction, an
// enumeration, a `hasValue` - there is nothing for the edge to point at, and
// collapsing it to `owl:Thing` states something the ontology does not: that all
// values are anything at all, which is vacuous. The pinned oracle draws no edge
// in that case.
//
// `food.rdf` shows the cost. Twenty-two of its classes restrict `food:hasDrink`
// to a nested restriction on wine colour, and each produced an edge to
// `owl:Thing`; the oracle draws two edges for that property in total.
describe("VOWLBuilder restrictions whose filler has no node", () => {
  const restrictedProperty = () =>
    factory.getOWLObjectProperty(iri("hasDrink"));

  const edgesFor = (result, local) =>
    result.propertyAttribute.filter(
      ({ iri: propertyIri }) => propertyIri === iri(local).value,
    );

  // The property keeps its own entity record either way; what must not appear
  // is the restriction edge, which is the entry carrying the restriction marker.
  const restrictionEdgesFor = (result, local) =>
    edgesFor(result, local).filter(({ attributes }) =>
      (attributes ?? []).includes("allValuesFrom"),
    );

  it("draws no edge when the filler is a nested restriction", () => {
    const nested = factory.getOWLObjectHasValue(
      factory.getOWLObjectProperty(iri("hasColour")),
      factory.getOWLNamedIndividual(iri("Red")),
    );

    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("DessertCourse"),
        factory.getOWLObjectAllValuesFrom(restrictedProperty(), nested),
      ),
    );

    expect(restrictionEdgesFor(result, "hasDrink")).toEqual([]);
  });

  // A union has a VOWL node, so an edge could point at it - but the oracle never
  // draws one. Across all 46 reference outputs its 298 restriction edges have no
  // anonymous endpoint at all. VOWL 2 governs nothing about restriction edges,
  // so ADR 0006 leaves their shape to the oracle, and that is the shape.
  //
  // `bibo.rdf.xml` draws one such edge and `iso_31073_ed-1_20260626` six.
  it("draws no edge when the filler is an anonymous set expression", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("Collection"),
        factory.getOWLObjectAllValuesFrom(
          restrictedProperty(),
          factory.getOWLObjectUnionOf([
            owlClass("Document"),
            owlClass("Webpage"),
          ]),
        ),
      ),
    );

    expect(restrictionEdgesFor(result, "hasDrink")).toEqual([]);
  });

  // The filler being a named class is the ordinary case and must still draw.
  it("still draws an edge to a named filler", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("MealCourse"),
        factory.getOWLObjectAllValuesFrom(
          restrictedProperty(),
          owlClass("Wine"),
        ),
      ),
    );

    const [edge] = edgesFor(result, "hasDrink");

    expect(attributeFor(result, edge.range).iri).toBe(iri("Wine").value);
  });

  // `owl:Thing` named explicitly by the author is a real filler and is drawn;
  // the rule is about expressions with no node, not about the node itself.
  it("still draws an edge to an explicitly named owl:Thing", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("MealCourse"),
        factory.getOWLObjectAllValuesFrom(
          restrictedProperty(),
          factory.getOWLClass(
            IRI.create("http://www.w3.org/2002/07/owl#Thing"),
          ),
        ),
      ),
    );

    expect(restrictionEdgesFor(result, "hasDrink")).toHaveLength(1);
  });
});

// A cardinality restriction is drawn as an edge carrying a cardinality label,
// which the WebVOWL renderer reads from `cardinality`, `minCardinality` and
// `maxCardinality`. The same vacuity rule applies to its filler: `hasDrink
// exactly 1 (something red)` has nothing to point at, and an edge to `owl:Thing`
// would claim the restriction ranges over everything.
//
// The cardinality itself is not discarded where the filler is a real class -
// the pinned oracle emits no cardinality anywhere in its 46 outputs, but
// matching it by dropping the information is not the trade being made here.
describe("VOWLBuilder cardinality restrictions", () => {
  const property = () => factory.getOWLObjectProperty(iri("hasDrink"));

  const edgesFor = (result) =>
    result.propertyAttribute.filter(
      ({ iri: propertyIri }) => propertyIri === iri("hasDrink").value,
    );

  it("draws no edge when the filler has no node", () => {
    const nested = factory.getOWLObjectHasValue(
      factory.getOWLObjectProperty(iri("hasColour")),
      factory.getOWLNamedIndividual(iri("Red")),
    );

    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("DessertCourse"),
        factory.getOWLObjectExactCardinality(1, property(), nested),
      ),
    );

    expect(edgesFor(result).some(({ cardinality }) => cardinality)).toBe(false);
  });

  it("keeps the cardinality where the filler is a named class", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("MealCourse"),
        factory.getOWLObjectExactCardinality(1, property(), owlClass("Wine")),
      ),
    );

    expect(edgesFor(result).map(({ cardinality }) => cardinality)).toContain(
      "1",
    );
  });
});

// VOWL 2 settles how a cardinality is drawn, and it is not an edge. Table 6
// renders `owl:cardinality`, `owl:minCardinality` and `owl:maxCardinality` as
// numbers near the end of the property arrow, in the manner of UML
// multiplicity, and Table 5 gives a property exactly one arrow, from its domain
// to its range.
//
// The rule that makes the current output wrong is the one on owl:Thing, which
// "should only be used if either no domain and/or range axiom is defined" for
// the property, or where the author named owl:Thing themselves. `food:hasDrink`
// has both a domain and a range axiom, so an edge from a restricted subclass to
// owl:Thing is not a rendering the specification permits.
//
// OWL 2 makes the class expression of a cardinality optional and identical to
// owl:Thing when omitted, so an owl:Thing filler names no target at all; there
// is nothing for an edge to point at, and the number belongs on the arrow the
// property already has.
describe("VOWLBuilder cardinality drawn as a label", () => {
  const hasDrink = () => factory.getOWLObjectProperty(iri("hasDrink"));

  const entriesFor = (result) =>
    result.propertyAttribute.filter(
      ({ iri: propertyIri }) => propertyIri === iri("hasDrink").value,
    );

  const declared = () => [
    factory.getOWLObjectPropertyDomainAxiom(hasDrink(), owlClass("MealCourse")),
    factory.getOWLObjectPropertyRangeAxiom(
      hasDrink(),
      owlClass("PotableLiquid"),
    ),
  ];

  const restrictionOn = (local, cardinality) =>
    factory.getOWLSubClassOfAxiom(
      owlClass(local),
      factory.getOWLObjectMinCardinality(cardinality, hasDrink()),
    );

  it("labels the property's arrow and draws no new edge", () => {
    const result = buildWith(...declared(), restrictionOn("MealCourse", 1));
    const entries = entriesFor(result);

    expect(entries).toHaveLength(1);
    expect(entries[0].minCardinality).toBe("1");
    expect(attributeFor(result, entries[0].range).iri).toBe(
      iri("PotableLiquid").value,
    );
  });

  // The restriction is stated on a subclass of the declared domain, which is
  // the ordinary shape in real ontologies - `food:madeFromFruit` is declared on
  // `ConsumableThing` and restricted on `Juice`. VOWL has no per-class arrow to
  // carry it, so it goes on the property's own arrow just the same.
  it("labels the arrow when the restriction is on a subclass", () => {
    const result = buildWith(
      ...declared(),
      restrictionOn("SweetFruitCourse", 1),
    );
    const entries = entriesFor(result);

    expect(entries).toHaveLength(1);
    expect(entries[0].minCardinality).toBe("1");
  });

  // Two subclasses may state different bounds, and one arrow can carry only one
  // number. The weaker bound is kept, so the figure shown is implied by every
  // restriction the ontology states rather than overstating any of them - and
  // the outcome cannot depend on which restriction was read first.
  it("keeps the weaker bound when restrictions disagree", () => {
    const forwards = buildWith(
      ...declared(),
      restrictionOn("SweetFruitCourse", 3),
      restrictionOn("DessertCourse", 1),
    );
    const backwards = buildWith(
      ...declared(),
      restrictionOn("DessertCourse", 1),
      restrictionOn("SweetFruitCourse", 3),
    );

    expect(entriesFor(forwards)[0].minCardinality).toBe("1");
    expect(entriesFor(backwards)[0].minCardinality).toBe("1");
  });
});

// The same rule on the data side. VOWL 2 substitutes `rdfs:Literal` as the
// range of a datatype property that has none defined, so an `rdfs:Literal`
// filler names no target any more than `owl:Thing` does, and a constructed data
// range has no node of its own to point at either.
//
// `time.rdf` states 42 exact and 36 maximum cardinalities this way, all on
// datatype properties and none qualified with `owl:onClass`.
describe("VOWLBuilder data cardinality drawn as a label", () => {
  const age = () => factory.getOWLDataProperty(iri("day"));
  const literal = () =>
    factory.getOWLDatatype(
      IRI.create("http://www.w3.org/2000/01/rdf-schema#Literal"),
    );

  const entriesFor = (result) =>
    result.propertyAttribute.filter(
      ({ iri: propertyIri }) => propertyIri === iri("day").value,
    );

  const declared = () => [
    factory.getOWLDataPropertyDomainAxiom(
      age(),
      owlClass("GeneralDateTimeDescription"),
    ),
    factory.getOWLDataPropertyRangeAxiom(
      age(),
      factory.getOWLDatatype(
        IRI.create("http://www.w3.org/2001/XMLSchema#nonNegativeInteger"),
      ),
    ),
  ];

  it("labels the arrow rather than drawing one to rdfs:Literal", () => {
    const result = buildWith(
      ...declared(),
      factory.getOWLSubClassOfAxiom(
        owlClass("MonthOfYear"),
        factory.getOWLDataExactCardinality(1, age(), literal()),
      ),
    );
    const entries = entriesFor(result);

    expect(entries).toHaveLength(1);
    expect(entries[0].cardinality).toBe("1");
  });

  // A named datatype filler is a real node and keeps its own edge, exactly as a
  // named class filler does on the object side.
  it("still draws an edge to a named datatype filler", () => {
    const result = buildWith(
      factory.getOWLSubClassOfAxiom(
        owlClass("MonthOfYear"),
        factory.getOWLDataExactCardinality(
          1,
          age(),
          factory.getOWLDatatype(
            IRI.create("http://www.w3.org/2001/XMLSchema#gDay"),
          ),
        ),
      ),
    );

    expect(
      entriesFor(result).some(({ cardinality }) => cardinality === "1"),
    ).toBe(true);
  });
});

// VOWL 2 draws an inverse pair as a single line between two classes with
// arrowheads at both ends, labelled with the property and its inverse
// counterpart. One line between two classes means the pair necessarily shares
// the same two endpoints, so a property that states no domain or range of its
// own takes them from its inverse - the inverse's range is its domain, and the
// inverse's domain is its range.
//
// This is not inference beyond the notation; it is what drawing the pair as one
// bidirectional edge requires. `marinetlo.owl` declares `P39WasMeasuredBy` and
// `P40WasObservedIn` with an `owl:inverseOf` and nothing else, and both were
// drawn from `owl:Thing` to `owl:Thing`.
describe("VOWLBuilder inverse property endpoints", () => {
  const measured = () => factory.getOWLObjectProperty(iri("P39Measured"));
  const wasMeasuredBy = () =>
    factory.getOWLObjectProperty(iri("P39WasMeasuredBy"));

  const endpointsOf = (result, local) => {
    const entry = result.propertyAttribute.find(
      ({ iri: propertyIri }) => propertyIri === iri(local).value,
    );
    return [
      attributeFor(result, entry.domain)?.iri,
      attributeFor(result, entry.range)?.iri,
    ];
  };

  const declaredPair = () => [
    factory.getOWLObjectPropertyDomainAxiom(
      measured(),
      owlClass("Measurement"),
    ),
    factory.getOWLObjectPropertyRangeAxiom(
      measured(),
      owlClass("MarineTLOEntity"),
    ),
    factory.getOWLInverseObjectPropertiesAxiom(measured(), wasMeasuredBy()),
  ];

  it("takes its endpoints from the inverse when it states none", () => {
    const result = buildWith(...declaredPair());

    expect(endpointsOf(result, "P39WasMeasuredBy")).toEqual([
      iri("MarineTLOEntity").value,
      iri("Measurement").value,
    ]);
  });

  it("does not depend on the order the axioms arrive in", () => {
    const [domain, range, inverse] = declaredPair();
    const forwards = buildWith(domain, range, inverse);
    const backwards = buildWith(inverse, range, domain);

    expect(endpointsOf(backwards, "P39WasMeasuredBy")).toEqual(
      endpointsOf(forwards, "P39WasMeasuredBy"),
    );
  });

  // A property that states its own endpoints keeps them; the inverse only fills
  // a gap, it never overrides what the author wrote.
  it("keeps its own endpoints when it states them", () => {
    const result = buildWith(
      ...declaredPair(),
      factory.getOWLObjectPropertyDomainAxiom(
        wasMeasuredBy(),
        owlClass("Site"),
      ),
    );

    expect(endpointsOf(result, "P39WasMeasuredBy")[0]).toBe(iri("Site").value);
  });
});

// VOWL 2's splitting rules make a datatype node exist only in relation to the
// properties that use it: an `rdfs:Datatype` or `rdfs:Literal` "is visualized
// once for every property it is linked to", so an element linked to no property
// is drawn zero times. `owl:Thing` splits by class on the same principle.
//
// A datatype can reach the ontology's signature without any edge surviving to
// point at it - through a declaration, or through a construct VOWL does not
// draw. `marinetlo.owl` ends up with `xsd:date` and `rdfs:Literal` as nodes that
// no edge references at all.
describe("VOWLBuilder generic nodes nothing links to", () => {
  const iriOf = (result, local) =>
    result.classAttribute.find(({ iri: classIri }) => classIri === local);

  it("draws no datatype node when no property links to it", () => {
    const result = buildWith(
      factory.getOWLDeclarationAxiom(
        factory.getOWLDatatype(
          IRI.create("http://www.w3.org/2001/XMLSchema#date"),
        ),
      ),
      factory.getOWLDeclarationAxiom(owlClass("Measurement")),
    );

    expect(
      iriOf(result, "http://www.w3.org/2001/XMLSchema#date"),
    ).toBeUndefined();
  });

  // A class with no properties is still a class and is still drawn; the rule is
  // about the generic elements the splitting rules name, not about isolation.
  it("still draws a class that no property links to", () => {
    const result = buildWith(
      factory.getOWLDeclarationAxiom(owlClass("Orphan")),
    );

    expect(iriOf(result, iri("Orphan").value)).toBeDefined();
  });

  it("still draws a datatype a property points at", () => {
    const date = factory.getOWLDatatype(
      IRI.create("http://www.w3.org/2001/XMLSchema#date"),
    );
    const result = buildWith(
      factory.getOWLDataPropertyRangeAxiom(
        factory.getOWLDataProperty(iri("observedOn")),
        date,
      ),
    );

    expect(
      iriOf(result, "http://www.w3.org/2001/XMLSchema#date"),
    ).toBeDefined();
  });
});
