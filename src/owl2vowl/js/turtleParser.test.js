import { describe, test, expect } from "@jest/globals";
import { isTurtleFormat, parseTurtle, serializeTriplesToRdfXml } from "./turtleParser.js";

describe("turtleParser.js - isTurtleFormat", () => {
  test("identifies turtle format correctly", () => {
    expect(isTurtleFormat("@prefix ex: <http://example.org/> .")).toBe(true);
    expect(isTurtleFormat("PREFIX ex: <http://example.org/>")).toBe(true);
    expect(isTurtleFormat("# This is a comment")).toBe(true);
    expect(isTurtleFormat("ex:Subject ex:Predicate ex:Object ;")).toBe(true);
    expect(isTurtleFormat("ex:Subject ex:Predicate ex:Object .")).toBe(true);
  });

  test("rejects non-turtle format correctly", () => {
    expect(isTurtleFormat("<rdf:RDF xmlns:rdf=\"...\">")).toBe(false);
    expect(isTurtleFormat("{ \"json\": true }")).toBe(false);
    expect(isTurtleFormat("[ 1, 2, 3 ]")).toBe(false);
  });
});

describe("turtleParser.js - parseTurtle", () => {
  test("parses prefix and base directives using N3.js", () => {
    const ttl = `
      @base <http://base.org/> .
      @prefix ex: <http://example.org/> .
      ex:s a ex:o .
    `;
    const result = parseTurtle(ttl);
    expect(result.prefixes.ex).toBe("http://example.org/");
    expect(result.baseIri).toBe("http://base.org/");
    expect(result.triples.length).toBe(1);
    expect(result.triples[0]).toEqual({
      subject: { type: "URI", value: "http://example.org/s" },
      predicate: { type: "URI", value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" },
      object: { type: "URI", value: "http://example.org/o" }
    });
  });

  test("parses blank nodes and literals correctly", () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      ex:s ex:hasProp _:b1 .
      _:b1 ex:nestedProp "hello"@en .
      _:b1 ex:number 42 .
    `;
    const result = parseTurtle(ttl);
    expect(result.triples.length).toBe(3);

    // Subject of second and third triples should match object of first triple
    const bnodeId = result.triples[0].object.value;
    expect(result.triples[0].object.type).toBe("BNODE");
    expect(bnodeId).toMatch(/^b/);

    expect(result.triples[1].subject.value).toBe(bnodeId);
    expect(result.triples[1].object).toEqual({
      type: "LITERAL",
      value: "hello",
      lang: "en"
    });

    expect(result.triples[2].subject.value).toBe(bnodeId);
    expect(result.triples[2].object).toEqual({
      type: "LITERAL",
      value: "42",
      datatype: { type: "URI", value: "http://www.w3.org/2001/XMLSchema#integer" }
    });
  });

  test("parses lists and collections using N3.js syntax", () => {
    const ttl = `
      @prefix ex: <http://example.org/> .
      ex:s ex:list ( ex:item1 ex:item2 ) .
    `;
    const result = parseTurtle(ttl);
    // N3.js parses RDF collections recursively into blank nodes with first/rest predicates
    expect(result.triples.length).toBe(5);
    const hasListTriple = result.triples.find(t => t.predicate.value === "http://example.org/list");
    expect(hasListTriple).toBeDefined();
    expect(hasListTriple.object.type).toBe("BNODE");
  });
});

describe("turtleParser.js - serializeTriplesToRdfXml", () => {
  test("serializes triples back to valid RDF/XML string structure", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/s" },
        predicate: { type: "URI", value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type" },
        object: { type: "URI", value: "http://example.org/Class" }
      },
      {
        subject: { type: "URI", value: "http://example.org/s" },
        predicate: { type: "URI", value: "http://example.org/label" },
        object: { type: "LITERAL", value: "test label", lang: "en" }
      }
    ];
    const prefixes = { ex: "http://example.org/" };
    const baseIri = "http://example.org/ontology";
    
    const xml = serializeTriplesToRdfXml(triples, prefixes, baseIri);
    expect(xml).toContain("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
    expect(xml).toContain("<rdf:RDF");
    expect(xml).toContain("xml:base=\"http://example.org/ontology\"");
    expect(xml).toContain("xmlns:ex=\"http://example.org/\"");
    expect(xml).toContain("<rdf:Description rdf:about=\"http://example.org/s\">");
    expect(xml).toContain("<rdf:type rdf:resource=\"http://example.org/Class\" />");
    expect(xml).toContain("xml:lang=\"en\">test label</ex:label>");
  });

  test("generates dynamic auto-prefixes for un-prefixed predicate namespaces", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/s" },
        predicate: { type: "URI", value: "http://custom-namespace.org/vocab#hasCustomProp" },
        object: { type: "LITERAL", value: "custom value" }
      }
    ];
    const xml = serializeTriplesToRdfXml(triples, {}, "http://example.org/");
    expect(xml).toContain('xmlns:ns0="http://custom-namespace.org/vocab#"');
    expect(xml).toContain('<ns0:hasCustomProp>custom value</ns0:hasCustomProp>');
  });

  test("handles empty/default prefix mappings securely to prevent invalid QNames or xmlns attributes", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/s" },
        predicate: { type: "URI", value: "http://default-namespace.org/#hasDefaultProp" },
        object: { type: "LITERAL", value: "default value" }
      }
    ];
    const prefixes = { "": "http://default-namespace.org/#" }; // Empty prefix
    
    const xml = serializeTriplesToRdfXml(triples, prefixes, "http://example.org/ontology");
    expect(xml).toContain('xmlns="http://default-namespace.org/#"'); // Correctly uses xmlns="..." instead of xmlns:="..."
    expect(xml).not.toContain('xmlns:="http://default-namespace.org/#"');
    expect(xml).toContain('<hasDefaultProp>default value</hasDefaultProp>'); // Naked tag without dangling colons
    expect(xml).not.toContain('<:hasDefaultProp>');
  });
});
