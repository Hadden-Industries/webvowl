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

  test("merges multiple domains and ranges into virtual owl:unionOf classes", () => {
    const subjects = {
      "http://example.org/ClassA": {
        iri: "http://example.org/ClassA",
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
      "http://example.org/ClassB": {
        iri: "http://example.org/ClassB",
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
      "http://example.org/propMulti": {
        iri: "http://example.org/propMulti",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/ClassA", "http://example.org/ClassB"],
        ranges: ["http://example.org/ClassA", "http://example.org/ClassB"],
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

    const propMulti = context.propertyMap.get("http://example.org/propMulti");
    expect(propMulti).toBeDefined();

    // Check virtual union classes are assigned as domain and range
    expect(propMulti.domain).toBeDefined();
    expect(propMulti.range).toBeDefined();

    const domainNode = context.classMap.get(propMulti.domain);
    const rangeNode = context.classMap.get(propMulti.range);

    expect(domainNode).toBeDefined();
    expect(rangeNode).toBeDefined();
    expect(domainNode.type).toBe("owl:unionOf");
    expect(rangeNode.type).toBe("owl:unionOf");

    // The union members should resolve to class IDs of ClassA and ClassB
    const classA = context.classMap.get("http://example.org/ClassA");
    const classB = context.classMap.get("http://example.org/ClassB");

    expect(domainNode.union).toContain(classA.id);
    expect(domainNode.union).toContain(classB.id);
    expect(rangeNode.union).toContain(classA.id);
    expect(rangeNode.union).toContain(classB.id);
  });

  test("filters and sorts equivalent elements following EquivalentSorter rules", () => {
    const subjects = {
      "http://example.org/": {
        iri: "http://example.org/",
        types: new Set(["http://www.w3.org/2002/07/owl#Ontology"]),
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
        disjointWith: [],
        annotations: {}
      },
      "http://example.org/ClassA": {
        iri: "http://example.org/ClassA",
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
        equivalentClasses: ["http://other.org/ClassB"],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://other.org/ClassB": {
        iri: "http://other.org/ClassB",
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
        equivalentClasses: ["http://example.org/ClassA"],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const classA = context.classMap.get("http://example.org/ClassA");
    const classB = context.classMap.get("http://other.org/ClassB");

    expect(classA).toBeDefined();
    expect(classB).toBeDefined();

    // ClassA is internal, so it should retain its equivalent link to ClassB
    expect(classA.equivalent).toBeDefined();
    expect(classA.equivalent).toContain(classB.id);

    // ClassB is external, so its equivalent list should be empty/filtered out to prevent duplicates
    expect(classB.equivalent).toBeUndefined();
  });

  test("correctly parses and resolves owl:intersectionOf, owl:complementOf, disjointUnionOf, and hasKey", () => {
    const subjects = {
      "http://example.org/ClassA": {
        iri: "http://example.org/ClassA",
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
        disjointWith: [],
        intersectionOf: ["http://example.org/ClassB", "http://example.org/ClassC"],
        complementOf: "http://example.org/ClassD",
        disjointUnionOf: ["http://example.org/ClassB", "http://example.org/ClassC"],
        hasKeys: ["http://example.org/propKey"]
      },
      "http://example.org/ClassB": {
        iri: "http://example.org/ClassB",
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
      "http://example.org/ClassC": {
        iri: "http://example.org/ClassC",
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
      "http://example.org/ClassD": {
        iri: "http://example.org/ClassD",
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
      "http://example.org/propKey": {
        iri: "http://example.org/propKey",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/ClassA"],
        ranges: ["http://example.org/ClassB"],
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

    const classA = context.classMap.get("http://example.org/ClassA");
    const classB = context.classMap.get("http://example.org/ClassB");
    const classC = context.classMap.get("http://example.org/ClassC");
    const classD = context.classMap.get("http://example.org/ClassD");
    const propKey = context.propertyMap.get("http://example.org/propKey");

    expect(classA).toBeDefined();
    expect(classA.attributes).toContain("intersection");
    expect(classA.attributes).toContain("complement");
    expect(classA.attributes).toContain("disjointUnion");

    expect(classA.intersection).toContain(classB.id);
    expect(classA.intersection).toContain(classC.id);
    expect(classA.complement).toBe(classD.id);
    expect(classA.disjointUnion).toContain(classB.id);
    expect(classA.disjointUnion).toContain(classC.id);

    expect(propKey.attributes).toContain("key");
  });

  test("correctly infers domain and range for anonymous inverse properties", () => {
    const subjects = {
      "http://example.org/classA": {
        iri: "http://example.org/classA",
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
      "http://example.org/classB": {
        iri: "http://example.org/classB",
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
      "http://example.org/propertyA": {
        iri: "http://example.org/propertyA",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/classA"],
        ranges: ["http://example.org/classB"],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: [],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/propertyB": {
        iri: "http://example.org/propertyB",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: [],
        ranges: [],
        superClasses: [],
        subClasses: [],
        superProperties: [],
        subProperties: [],
        inverses: ["http://example.org/propertyA"],
        equivalentClasses: [],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const classA = context.classMap.get("http://example.org/classA");
    const classB = context.classMap.get("http://example.org/classB");
    const propA = context.propertyMap.get("http://example.org/propertyA");
    const propB = context.propertyMap.get("http://example.org/propertyB");

    expect(classA).toBeDefined();
    expect(classB).toBeDefined();
    expect(propA).toBeDefined();
    expect(propB).toBeDefined();

    expect(propA.domain).toBe(classA.id);
    expect(propA.range).toBe(classB.id);

    expect(propB.domain).toBe(classB.id);
    expect(propB.range).toBe(classA.id);
  });

  test("de-duplicates implicit union classes across multiple properties", () => {
    const subjects = {
      "http://example.org/ClassA": {
        iri: "http://example.org/ClassA",
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
      "http://example.org/ClassB": {
        iri: "http://example.org/ClassB",
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
      "http://example.org/propA": {
        iri: "http://example.org/propA",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/ClassA", "http://example.org/ClassB"],
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
      "http://example.org/propB": {
        iri: "http://example.org/propB",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {},
        comments: {},
        domains: ["http://example.org/ClassA", "http://example.org/ClassB"],
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

    const propA = context.propertyMap.get("http://example.org/propA");
    const propB = context.propertyMap.get("http://example.org/propB");

    expect(propA.domain).toBeDefined();
    expect(propB.domain).toBeDefined();
    // They must share the exact same de-duplicated implicit union class ID!
    expect(propA.domain).toBe(propB.domain);
  });

  test("merges anonymous equivalent class expressions directly into the named class", () => {
    const subjects = {
      "http://example.org/ProductOrService": {
        iri: "http://example.org/ProductOrService",
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
        equivalentClasses: ["_:anon_1"],
        equivalentProperties: [],
        disjointWith: []
      },
      "_:anon_1": {
        iri: "_:anon_1",
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
        equivalentClasses: ["http://example.org/ProductOrService"],
        equivalentProperties: [],
        disjointWith: [],
        unionOf: ["http://example.org/Product", "http://example.org/Service"],
        annotations: {}
      },
      "http://example.org/Product": {
        iri: "http://example.org/Product",
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
      "http://example.org/Service": {
        iri: "http://example.org/Service",
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

    // The anonymous subject node should be deleted and merged
    expect(context.classMap.has("_:anon_1")).toBe(false);

    const mainCls = context.classMap.get("http://example.org/ProductOrService");
    expect(mainCls).toBeDefined();
    // The named class type should be owl:unionOf and attribute "union" should be set
    expect(mainCls.type).toBe("owl:unionOf");
    expect(mainCls.attributes).toContain("union");
    // Equivalent class link to the anonymous node should be removed/filtered out
    expect(mainCls.equivalent).toBeUndefined();
  });

  test("assigns owl:equivalentClass type to named classes with equivalent attribute", () => {
    const subjects = {
      "http://example.org/ClassX": {
        iri: "http://example.org/ClassX",
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
        equivalentClasses: ["http://example.org/ClassY"],
        equivalentProperties: [],
        disjointWith: []
      },
      "http://example.org/ClassY": {
        iri: "http://example.org/ClassY",
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
        equivalentClasses: ["http://example.org/ClassX"],
        equivalentProperties: [],
        disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const classX = context.classMap.get("http://example.org/ClassX");
    const classY = context.classMap.get("http://example.org/ClassY");

    expect(classX).toBeDefined();
    expect(classY).toBeDefined();
    // Both classes should be typed as owl:equivalentClass due to the equivalent attribute
    expect(classX.type).toBe("owl:equivalentClass");
    expect(classY.type).toBe("owl:equivalentClass");
  });

  test("Does not infer classes from the range/target of owl:hasValue restrictions", () => {
    // Add an owl:hasValue restriction in parser context
    context.parsedRestrictions.push({
      domainIri: "http://example.org/GregorianMonth",
      propertyIri: "http://example.org/unitType",
      rangeIri: "http://example.org/unitMonth",
      type: "owl:hasValue"
    });

    const subjects = {
      "http://example.org/GregorianMonth": {
        iri: "http://example.org/GregorianMonth",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {}, comments: {}, domains: [], ranges: [], superClasses: [], subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: []
      },
      "http://example.org/unitMonth": {
        iri: "http://example.org/unitMonth",
        types: new Set(["http://example.org/TemporalUnit"]),
        labels: {}, comments: {}, domains: [], ranges: [], superClasses: [], subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: []
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    // GregorianMonth should exist as class
    const monthClass = context.classMap.get("http://example.org/GregorianMonth");
    expect(monthClass).toBeDefined();

    // unitMonth should NOT exist in the classMap
    const unitMonthClass = context.classMap.get("http://example.org/unitMonth");
    expect(unitMonthClass).toBeUndefined();
  });
});
