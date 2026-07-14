import { describe, test, expect } from "@jest/globals";
import { isTurtleFormat, tokenizeTurtle, parseTurtleTokens, serializeTriplesToRdfXml } from "./turtleParser.js";

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

describe("turtleParser.js - tokenizeTurtle", () => {
  test("tokenizes URIs, literals, and keywords", () => {
    const ttl = "<http://example.org/s> a <http://example.org/o> .";
    const tokens = tokenizeTurtle(ttl);
    expect(tokens).toEqual([
      { type: "URI", value: "http://example.org/s" },
      { type: "KEYWORD", value: "a" },
      { type: "URI", value: "http://example.org/o" },
      { type: "PUNCT", value: "." }
    ]);
  });

  test("tokenizes literals with lang tags and datatypes", () => {
    const ttl = `"hello"@en "world"^^<http://example.org/dt> "test"^^ex:string`;
    const tokens = tokenizeTurtle(ttl);
    expect(tokens[0]).toEqual({ type: "LITERAL", value: "hello", lang: "en" });
    expect(tokens[1]).toEqual({
      type: "LITERAL",
      value: "world",
      datatype: { type: "URI", value: "http://example.org/dt" }
    });
    expect(tokens[2]).toEqual({
      type: "LITERAL",
      value: "test",
      datatype: { type: "QNAME", value: "ex:string" }
    });
  });

  test("tokenizes syntax markers and comments", () => {
    const ttl = `
      # Comment here
      [ ; , ] ( )
    `;
    const tokens = tokenizeTurtle(ttl);
    expect(tokens).toEqual([
      { type: "PUNCT", value: "[" },
      { type: "PUNCT", value: ";" },
      { type: "PUNCT", value: "," },
      { type: "PUNCT", value: "]" },
      { type: "PUNCT", value: "(" },
      { type: "PUNCT", value: ")" }
    ]);
  });
});

describe("turtleParser.js - parseTurtleTokens", () => {
  test("parses prefix and base directives", () => {
    const tokens = [
      { type: "DIRECTIVE", value: "PREFIX" },
      { type: "QNAME", value: "ex:" },
      { type: "URI", value: "http://example.org/" },
      { type: "DIRECTIVE", value: "BASE" },
      { type: "URI", value: "http://base.org/" }
    ];
    const result = parseTurtleTokens(tokens);
    expect(result.prefixes.ex).toBe("http://example.org/");
    expect(result.baseIri).toBe("http://base.org/");
  });

  test("parses blank node descriptions", () => {
    const tokens = [
      { type: "URI", value: "http://example.org/s" },
      { type: "QNAME", value: "ex:hasProp" },
      { type: "PUNCT", value: "[" },
      { type: "QNAME", value: "ex:nestedProp" },
      { type: "URI", value: "http://example.org/nestedObj" },
      { type: "PUNCT", value: "]" },
      { type: "PUNCT", value: "." }
    ];
    const result = parseTurtleTokens(tokens);
    expect(result.triples.length).toBe(2);

    // Triple 1: Bnode -> ex:nestedProp -> nestedObj
    expect(result.triples[0].subject.type).toBe("BNODE");
    expect(result.triples[0].predicate.value).toBe("ex:nestedProp");
    expect(result.triples[0].object.value).toBe("http://example.org/nestedObj");

    // Triple 2: s -> ex:hasProp -> Bnode
    expect(result.triples[1].subject.value).toBe("http://example.org/s");
    expect(result.triples[1].predicate.value).toBe("ex:hasProp");
    expect(result.triples[1].object.type).toBe("BNODE");
    expect(result.triples[1].object.value).toBe(result.triples[0].subject.value);
  });

  test("parses collection lists", () => {
    const tokens = [
      { type: "URI", value: "http://example.org/s" },
      { type: "QNAME", value: "ex:list" },
      { type: "PUNCT", value: "(" },
      { type: "URI", value: "http://example.org/item1" },
      { type: "URI", value: "http://example.org/item2" },
      { type: "PUNCT", value: ")" },
      { type: "PUNCT", value: "." }
    ];
    const result = parseTurtleTokens(tokens);
    // Should produce list triples (first/rest) + statement triple
    expect(result.triples.length).toBe(5); 
  });
});

describe("turtleParser.js - serializeTriplesToRdfXml", () => {
  test("serializes triples back to valid RDF/XML string structure", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/s" },
        predicate: { type: "KEYWORD", value: "a" },
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
});
