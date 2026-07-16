import { describe, test, expect, beforeEach } from "@jest/globals";
import { PerformanceIriResolver } from "./iriResolver.js";
import { VowlParserContext } from "./parserContext.js";
import { exportToJson } from "./jsonExporter.js";

describe("jsonExporter.js unit tests", () => {
  let resolver;
  let context;
  let header;

  beforeEach(() => {
    resolver = new PerformanceIriResolver("http://example.org/");
    context = new VowlParserContext();
    header = {
      languages: ["en"],
      baseIris: [],
      prefixList: {},
      title: { en: "Test" },
      iri: "http://example.org/",
      version: "",
      author: [],
      description: {},
      labels: {},
      comments: {},
      other: {}
    };
  });

  test("exportToJson generates correct VOWL-JSON structure", () => {
    // Setup a dummy class
    context.classMap.set("http://example.org/Person", {
      id: "0",
      type: "owl:Class",
      iri: "http://example.org/Person",
      baseIri: "http://example.org/",
      label: { en: "Person" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: [],
      individuals: []
    });

    const result = exportToJson(resolver, context, header);

    expect(result).toHaveProperty("_comment");
    expect(result).toHaveProperty("header");
    expect(result).toHaveProperty("metrics");
    expect(result).toHaveProperty("class");
    expect(result).toHaveProperty("classAttribute");
    expect(result).toHaveProperty("property");
    expect(result).toHaveProperty("propertyAttribute");
  });

  test("Active classes/properties metrics counts are correct", () => {
    // Add 2 classes
    context.classMap.set("http://example.org/Person", {
      id: "0",
      type: "owl:Class",
      iri: "http://example.org/Person",
      baseIri: "http://example.org/",
      label: { en: "Person" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: [],
      individuals: [{ iri: "http://example.org/john" }]
    });

    context.classMap.set("http://example.org/Organization", {
      id: "1",
      type: "owl:Class",
      iri: "http://example.org/Organization",
      baseIri: "http://example.org/",
      label: { en: "Organization" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: [],
      individuals: []
    });

    // Add 1 property
    context.propertyMap.set("http://example.org/worksFor", {
      id: "2",
      type: "owl:objectProperty",
      iri: "http://example.org/worksFor",
      baseIri: "http://example.org/",
      label: { en: "worksFor" },
      comment: {},
      attributes: ["object"],
      domain: "0",
      range: "1",
      superproperty: [],
      subproperty: [],
      inverse: null
    });

    const result = exportToJson(resolver, context, header);

    expect(result.metrics.classCount).toBe(2);
    expect(result.metrics.objectPropertyCount).toBe(1);
    expect(result.metrics.nodeCount).toBe(2); // Datatypes not added yet
    expect(result.metrics.individualCount).toBe(1);
  });

  test("Datatype cleaning skips floating and preserves connected datatypes", () => {
    // Connected datatype class
    context.classMap.set("http://example.org/integer-connected", {
      id: "0",
      type: "rdfs:Datatype",
      iri: "http://example.org/integer",
      baseIri: "http://example.org/",
      label: { en: "integer" },
      comment: {},
      attributes: ["datatype"],
      subClasses: [],
      superClasses: [],
      individuals: []
    });

    // Floating/disconnected duplicate datatype class
    context.classMap.set("http://example.org/integer-floating", {
      id: "1",
      type: "rdfs:Datatype",
      iri: "http://example.org/integer",
      baseIri: "http://example.org/",
      label: { en: "integer" },
      comment: {},
      attributes: ["datatype"],
      subClasses: [],
      superClasses: [],
      individuals: []
    });

    // Add a property referencing 'integer-connected' but not 'integer-floating'
    context.propertyMap.set("http://example.org/age", {
      id: "2",
      type: "owl:datatypeProperty",
      iri: "http://example.org/age",
      baseIri: "http://example.org/",
      label: { en: "age" },
      comment: {},
      attributes: ["datatype"],
      domain: "3", // dummy domain id
      range: "0",  // referencing connected integer datatype
      superproperty: [],
      subproperty: [],
      inverse: null
    });

    const result = exportToJson(resolver, context, header);

    // Verify 'integer-connected' (ID 0) is in result but 'integer-floating' (ID 1) is skipped
    const includedClasses = result.class.map(c => c.id);
    expect(includedClasses).toContain("0"); // connected
    expect(includedClasses).not.toContain("1"); // floating duplicate
  });

  test("baseIris are properly collected, filtered, and sorted", () => {
    context.classMap.set("http://z-example.org/Class", {
      id: "0",
      type: "owl:Class",
      iri: "http://z-example.org/Class",
      baseIri: "http://z-example.org/",
      label: {},
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });

    context.classMap.set("http://a-example.org/Class", {
      id: "1",
      type: "owl:Class",
      iri: "http://a-example.org/Class",
      baseIri: "http://a-example.org/",
      label: {},
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });

    // Reserved namespace should be ignored
    context.classMap.set("http://www.w3.org/2002/07/owl#Thing", {
      id: "2",
      type: "owl:Class",
      iri: "http://www.w3.org/2002/07/owl#Thing",
      baseIri: "http://www.w3.org/2002/07/owl#",
      label: {},
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });

    const result = exportToJson(resolver, context, header);

    // Should only contain z-example and a-example, sorted alphabetically
    expect(result.header.baseIris).toEqual([
      "http://a-example.org",
      "http://z-example.org"
    ]);
  });

  test("exportToJson respects skipExport and serializes inferred attributes", () => {
    // Add a class for domain/range references
    context.classMap.set("http://example.org/ClassA", {
      id: "c1",
      type: "owl:Class",
      iri: "http://example.org/ClassA",
      baseIri: "http://example.org/",
      label: { en: "ClassA" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });
    context.classMap.set("http://example.org/ClassB", {
      id: "c2",
      type: "owl:Class",
      iri: "http://example.org/ClassB",
      baseIri: "http://example.org/",
      label: { en: "ClassB" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });

    // Property to skip
    context.propertyMap.set("http://example.org/skippedProp", {
      id: "p1",
      type: "owl:objectProperty",
      iri: "http://example.org/skippedProp",
      baseIri: "http://example.org/",
      label: { en: "skipped" },
      comment: {},
      attributes: ["object"],
      domain: "c1",
      range: "c2",
      superproperty: [],
      subproperty: [],
      inverse: null,
      skipExport: true
    });

    // Inferred property
    context.propertyMap.set("http://example.org/inferredProp", {
      id: "p2",
      type: "owl:objectProperty",
      iri: "http://example.org/inferredProp",
      baseIri: "http://example.org/",
      label: { en: "inferred" },
      comment: {},
      attributes: ["object", "inferred"],
      domain: "c1",
      range: "c2",
      superproperty: [],
      subproperty: [],
      inverse: null
    });

    // Restriction that generates a restriction property
    context.parsedRestrictions.push({
      domainIri: "http://example.org/ClassA",
      propertyIri: "http://example.org/inferredProp",
      rangeIri: "http://example.org/ClassB",
      type: "owl:someValuesFrom"
    });

    const result = exportToJson(resolver, context, header);

    // Verify skippedProp is NOT in exported properties
    const exportedIds = result.property.map(p => p.id);
    expect(exportedIds).not.toContain("p1");
    const exportedAttrIds = result.propertyAttribute.map(p => p.id);
    expect(exportedAttrIds).not.toContain("p1");

    // Verify inferredProp is exported with inferred attribute
    const infPropAttr = result.propertyAttribute.find(p => p.id === "p2");
    expect(infPropAttr).toBeDefined();
    expect(infPropAttr.attributes).toContain("inferred");

    // Verify generated restriction property is exported and has inferred attribute
    const restProp = result.property.find(p => p.id !== "p2" && p.type === "owl:someValuesFrom" || p.id.startsWith("val_") || p.id === "3"); // context.nextId would assign ID 3
    expect(restProp).toBeDefined();
    const restPropAttr = result.propertyAttribute.find(p => p.id !== "p2" && (p.attributes.includes("someValuesFrom") || p.attributes.includes("allValuesFrom")));
    expect(restPropAttr).toBeDefined();
    expect(restPropAttr.attributes).toContain("inferred");
    expect(restPropAttr.attributes).toContain("someValuesFrom");
  });

  test("exportToJson skips disconnected anonymous classes", () => {
    // Add a connected anonymous class (union node) and a disconnected anonymous class
    context.classMap.set("_:anonUnion", {
      id: "anonUnionId",
      type: "owl:unionOf",
      iri: "_:anonUnion",
      baseIri: null,
      label: {},
      comment: {},
      attributes: ["anonymous", "union"],
      unionMembers: ["c1", "c2"]
    });

    context.classMap.set("_:disconnectedAnon", {
      id: "disconnectedAnonId",
      type: "owl:Class",
      iri: "_:disconnectedAnon",
      baseIri: null,
      label: {},
      comment: {},
      attributes: ["anonymous"],
      subClasses: [],
      superClasses: []
    });

    // To make sure _:anonUnion is connected, add a subclassRelation or restriction pointing to it
    context.classMap.set("http://example.org/ClassParent", {
      id: "parentClassId",
      type: "owl:Class",
      iri: "http://example.org/ClassParent",
      baseIri: "http://example.org/",
      label: { en: "ParentClass" },
      comment: {},
      attributes: [],
      subClasses: [],
      superClasses: []
    });

    context.subclassRelations.push({
      subclassIri: "http://example.org/ClassParent",
      superclassIri: "_:anonUnion"
    });

    const result = exportToJson(resolver, context, header);

    const exportedIds = result.class.map(c => c.id);
    // parentClassId and anonUnionId should be exported since they are connected
    expect(exportedIds).toContain("parentClassId");
    expect(exportedIds).toContain("anonUnionId");

    // disconnectedAnonId should be skipped because it is anonymous and not referenced anywhere (disconnected)
    expect(exportedIds).not.toContain("disconnectedAnonId");
  });
});

