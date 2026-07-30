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

  test("Suppresses subclass relation to anonymous restriction-only union (TimePosition structural axiom pattern)", () => {
    // Set up: TimePosition has superClass = anonymous union {_:r1, _:r2} where both are restrictions
    const anonUnionIri = "_:anonUnion_1";
    const anonRestr1 = "_:anonRestr_1";
    const anonRestr2 = "_:anonRestr_2";

    const subjects = {
      "http://example.org/TimePosition": {
        iri: "http://example.org/TimePosition",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [anonUnionIri],
        subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        unionOf: null, intersectionOf: null
      },
      [anonUnionIri]: {
        iri: anonUnionIri,
        types: new Set([]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        unionOf: [anonRestr1, anonRestr2]
      },
      [anonRestr1]: {
        iri: anonRestr1,
        types: new Set(["http://www.w3.org/2002/07/owl#Restriction"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: { onProperty: [{ value: "http://example.org/#numericPosition", type: "iri" }] }
      },
      [anonRestr2]: {
        iri: anonRestr2,
        types: new Set(["http://www.w3.org/2002/07/owl#Restriction"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [], inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: { onProperty: [{ value: "http://example.org/#nominalPosition", type: "iri" }] }
      }
    };

    convertOntology(subjects, new Set(), resolver, context, header);

    const timePosClass = context.classMap.get("http://example.org/TimePosition");
    expect(timePosClass).toBeDefined();

    // No subclass relation should be created from TimePosition to the anonymous restriction-only union
    const subclassRelations = context.subclassRelations.filter(
      r => r.subclassIri === "http://example.org/TimePosition"
    );
    expect(subclassRelations.length).toBe(0);
  });

  test("Correctly parses ontology-level header details matching Java OWL2VOWL specification", () => {
    const subjects = {
      "http://purl.org/goodrelations/v1": {
        iri: "http://purl.org/goodrelations/v1",
        types: new Set(["http://www.w3.org/2002/07/owl#Ontology"]),
        labels: { en: "GoodRelations Ontology" },
        comments: { en: "The GoodRelations ontology provides..." },
        domains: [], ranges: [], superClasses: [], subClasses: [],
        superProperties: [], subProperties: [], inverses: [],
        equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {
          title: [{ value: "The GoodRelations Vocabulary", language: "en", type: "label" }],
          creator: [{ value: "Martin Hepp", language: "en", type: "label" }],
          versionInfo: [{ value: "V 1.0", language: "en", type: "label" }],
          label: [{ value: "GoodRelations Ontology", language: "en", type: "label" }],
          comment: [{ value: "The GoodRelations ontology provides...", language: "en", type: "label" }],
          rights: [{ value: "CC-BY 3.0", language: "en", type: "label" }]
        }
      }
    };

    const languagesSet = new Set(["undefined", "en"]);
    convertOntology(subjects, languagesSet, resolver, context, header);

    // Title should be taken from dc:title / title annotation
    expect(header.title).toEqual({ en: "The GoodRelations Vocabulary" });
    // Labels should be taken from rdfs:label
    expect(header.labels).toEqual({ en: "GoodRelations Ontology" });
    // Comments should be taken from rdfs:comment
    expect(header.comments).toEqual({ en: "The GoodRelations ontology provides..." });
    // Author & Version
    expect(header.author).toEqual(["Martin Hepp"]);
    expect(header.version).toBe("V 1.0");

    // header.other should contain title, creator, versionInfo, rights but NOT label or comment
    expect(header.other).toHaveProperty("title");
    expect(header.other).toHaveProperty("creator");
    expect(header.other).toHaveProperty("versionInfo");
    expect(header.other).toHaveProperty("rights");
    expect(header.other).not.toHaveProperty("label");
    expect(header.other).not.toHaveProperty("comment");

    // Languages should put defined language first, undefined last
    expect(header.languages).toEqual(["en", "undefined"]);
  });

  test("Correctly maps InverseFunctionalProperty and avoids marking explicit inverse properties as inferred", () => {
    const subjects = {
      "http://xmlns.com/foaf/0.1/primaryTopic": {
        iri: "http://xmlns.com/foaf/0.1/primaryTopic",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty", "http://www.w3.org/2002/07/owl#FunctionalProperty"]),
        labels: { en: "primary topic" },
        comments: {}, domains: ["http://xmlns.com/foaf/0.1/Document"], ranges: ["http://www.w3.org/2002/07/owl#Thing"],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [],
        inverses: ["http://xmlns.com/foaf/0.1/isPrimaryTopicOf"], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {}
      },
      "http://xmlns.com/foaf/0.1/isPrimaryTopicOf": {
        iri: "http://xmlns.com/foaf/0.1/isPrimaryTopicOf",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty", "http://www.w3.org/2002/07/owl#InverseFunctionalProperty"]),
        labels: { en: "is primary topic of" },
        comments: { en: "A document that this thing is the primary topic of." },
        domains: ["http://www.w3.org/2002/07/owl#Thing"], ranges: ["http://xmlns.com/foaf/0.1/Document"],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [],
        inverses: ["http://xmlns.com/foaf/0.1/primaryTopic"], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {}
      }
    };

    convertOntology(subjects, new Set(["en"]), resolver, context, header);

    const isPrimaryTopicOf = context.propertyMap.get("http://xmlns.com/foaf/0.1/isPrimaryTopicOf");
    expect(isPrimaryTopicOf).toBeDefined();
    expect(isPrimaryTopicOf.attributes).toContain("inverse functional");
    expect(isPrimaryTopicOf.attributes).not.toContain("inferred");
    expect(isPrimaryTopicOf.label.en).toBe("is primary topic of");

    const primaryTopic = context.propertyMap.get("http://xmlns.com/foaf/0.1/primaryTopic");
    expect(primaryTopic).toBeDefined();
    expect(primaryTopic.attributes).toContain("functional");
    expect(primaryTopic.attributes).not.toContain("inferred");
  });

  test("Deduplicates subClasses, superClasses, subproperty, superproperty, and disjointWith entries", () => {
    const subjects = {
      "http://example.org/ClassA": {
        iri: "http://example.org/ClassA",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: ["http://example.org/ClassB", "http://example.org/ClassB"],
        subClasses: [], superProperties: [], subProperties: [],
        inverses: [], equivalentClasses: [], equivalentProperties: [],
        disjointWith: ["http://example.org/ClassB", "http://example.org/ClassB"],
        annotations: {}
      },
      "http://example.org/ClassB": {
        iri: "http://example.org/ClassB",
        types: new Set(["http://www.w3.org/2002/07/owl#Class"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [],
        inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {}
      },
      "http://example.org/propSub": {
        iri: "http://example.org/propSub",
        types: new Set(["http://www.w3.org/2002/07/owl#ObjectProperty"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [],
        superProperties: ["http://example.org/propSuper"], subProperties: [],
        inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {}
      },
      "http://example.org/propSuper": {
        iri: "http://example.org/propSuper",
        types: new Set(["http://example.org/owl#ObjectProperty"]),
        labels: {}, comments: {}, domains: [], ranges: [],
        superClasses: [], subClasses: [], superProperties: [], subProperties: [],
        inverses: [], equivalentClasses: [], equivalentProperties: [], disjointWith: [],
        annotations: {}
      }
    };

    context.subclassRelations.push(
      { subclassIri: "http://example.org/ClassA", superclassIri: "http://example.org/ClassB" },
      { subclassIri: "http://example.org/ClassA", superclassIri: "http://example.org/ClassB" }
    );

    context.subpropertyRelations.push(
      { subpropIri: "http://example.org/propSub", superpropIri: "http://example.org/propSuper" },
      { subpropIri: "http://example.org/propSub", superpropIri: "http://example.org/propSuper" }
    );

    convertOntology(subjects, new Set(["en"]), resolver, context, header);

    const clsA = context.classMap.get("http://example.org/ClassA");
    expect(clsA.disjointWith).toEqual(["http://example.org/ClassB"]);
    expect(clsA.superClasses.length).toBe(1);

    const propSub = context.propertyMap.get("http://example.org/propSub");
    expect(propSub.superproperty.length).toBe(1);

    const propSuper = context.propertyMap.get("http://example.org/propSuper");
    expect(propSuper.subproperty.length).toBe(1);
  });
});
