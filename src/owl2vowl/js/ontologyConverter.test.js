import { describe, test, expect, beforeEach } from "@jest/globals";
import { PerformanceIriResolver } from "./iriResolver.js";
import { VowlParserContext } from "./parserContext.js";
import { convertOntology } from "./ontologyConverter.js";

describe("ontologyConverter.js unit tests", () => {
  let resolver;
  let context;
  let header;

  beforeEach(() => {
    resolver = new PerformanceIriResolver("http://example.org/");
    context = new VowlParserContext();
    header = {
      languages: [],
      baseIris: [],
      prefixList: {},
      title: {},
      iri: "http://example.org/",
      version: "",
      author: [],
      description: {},
      labels: {},
      comments: {},
      other: {}
    };
  });

  test("Maps raw subjects to classes, properties, and individuals", () => {
    const subjects = {
      "http://example.org/Person": {
        iri: "http://example.org/Person",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: { en: "Person" },
        comments: { en: "A human class" },
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/knows": {
        iri: "http://example.org/knows",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: { en: "knows" },
        comments: {},
        domains: ["http://example.org/Person"],
        ranges: ["http://example.org/Person"],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/john": {
        iri: "http://example.org/john",
        types: new Set(["http://www.w3.org/2002/07/owl#NamedIndividual", "http://example.org/Person"]),
        labels: { en: "John" },
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    const languagesSet = new Set(["en", "undefined"]);
    convertOntology(subjects, languagesSet, resolver, context, header);

    // Verify Person class in classMap
    const person = context.classMap.get("http://example.org/Person");
    expect(person).toBeDefined();
    expect(person.type).toBe("owl:Class");
    expect(person.label.en).toBe("Person");

    // Verify Knows property in propertyMap
    const knows = context.propertyMap.get("http://example.org/knows");
    expect(knows).toBeDefined();
    expect(knows.type).toBe("owl:objectProperty");
    expect(knows.domain).toBe(person.id);
    expect(knows.range).toBe(person.id);

    // Verify John individual is attached to Person class
    expect(person.individuals.length).toBe(1);
    expect(person.individuals[0].iri).toBe("http://example.org/john");
  });

  test("Infures class status from usage relationships", () => {
    const subjects = {
      "http://example.org/Student": {
        iri: "http://example.org/Student",
        types: new Set(), // Implicit class
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: ["http://example.org/Person"], // Person is implicitly a Class
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const person = context.classMap.get("http://example.org/Person");
    expect(person).toBeDefined();
    expect(person.type).toBe("owl:Class");

    const student = context.classMap.get("http://example.org/Student");
    expect(student).toBeDefined();
    expect(student.type).toBe("owl:Class");
  });

  test("Resolves domains, ranges, inverses, disjointWith, and subclass relations", () => {
    const subjects = {
      "http://example.org/Person": {
        iri: "http://example.org/Person",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: ["http://example.org/Pet"]
      },
      "http://example.org/Pet": {
        iri: "http://example.org/Pet",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/hasPet": {
        iri: "http://example.org/hasPet",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/Person"],
        ranges: ["http://example.org/Pet"],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: ["http://example.org/petOf"],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    // Setup a subclass relation in context
    context.subclassRelations.push({
      subclassIri: "http://example.org/Pet",
      superclassIri: "http://example.org/Animal"
    });

    convertOntology(subjects, new Set(), resolver, context, header);

    const person = context.classMap.get("http://example.org/Person");
    const pet = context.classMap.get("http://example.org/Pet");
    const animal = context.classMap.get("http://example.org/Animal");

    expect(person).toBeDefined();
    expect(pet).toBeDefined();
    expect(animal).toBeDefined();

    // Verify subClassOf relationship mutates subClasses/superClasses arrays
    expect(pet.superClasses).toContain(animal.id);
    expect(animal.subClasses).toContain(pet.id);

    // Verify Inverse
    const hasPet = context.propertyMap.get("http://example.org/hasPet");
    const petOf = context.propertyMap.get("http://example.org/petOf");
    expect(hasPet).toBeDefined();
    expect(petOf).toBeDefined();
    expect(hasPet.inverse).toBe(petOf.id);
    expect(petOf.inverse).toBe(hasPet.id);
  });

  test("Resolves Restrictions and Cardinalities", () => {
    // Setup restriction in context
    context.parsedRestrictions.push({
      domainIri: "http://example.org/Student",
      propertyIri: "http://example.org/enrolledIn",
      rangeIri: "http://example.org/Course",
      type: "owl:someValuesFrom"
    });

    // Setup cardinality in context
    context.parsedCardinalities.push({
      propertyIri: "http://example.org/enrolledIn",
      minCardinality: "1",
      maxCardinality: "5",
      cardinality: null
    });

    const subjects = {
      "http://example.org/Student": {
        iri: "http://example.org/Student",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/Course": {
        iri: "http://example.org/Course",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const student = context.classMap.get("http://example.org/Student");
    const course = context.classMap.get("http://example.org/Course");

    expect(student).toBeDefined();
    expect(course).toBeDefined();

    // Verify cardinality mapping in propertyMap
    const enrolledIn = context.propertyMap.get("http://example.org/enrolledIn");
    expect(enrolledIn).toBeDefined();
    expect(enrolledIn.minCardinality).toBe("1");
    expect(enrolledIn.maxCardinality).toBe("5");
  });

  test("generates multiple separate virtual owl:Thing nodes for properties connected to different classes", () => {
    const subjects = {
      "http://example.org/Student": {
        iri: "http://example.org/Student",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/Course": {
        iri: "http://example.org/Course",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/prop1": {
        iri: "http://example.org/prop1",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/Student"],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/prop2": {
        iri: "http://example.org/prop2",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/Course"],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const prop1 = context.propertyMap.get("http://example.org/prop1");
    const prop2 = context.propertyMap.get("http://example.org/prop2");

    expect(prop1).toBeDefined();
    expect(prop2).toBeDefined();

    // The ranges should be virtual Thing nodes
    expect(prop1.range).toBeDefined();
    expect(prop2.range).toBeDefined();

    // Since they are connected to different regular classes, they cannot share a free Thing node
    expect(prop1.range).not.toBe(prop2.range);

    // Two virtual things should have been created (since Java's generateThing is called for each when only one domain/range is empty)
    expect(context.virtualThings.length).toBe(2);
    expect(prop1.range).not.toBe("0");
    expect(prop2.range).not.toBe("0");
  });
});
