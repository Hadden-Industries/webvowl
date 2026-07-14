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
});
