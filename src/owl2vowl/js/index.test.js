import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import owl2vowl, { loadWithImports, catalog } from "./index.js";

describe("index.js unit tests", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("catalog export matches ONTOLOGY_CATALOG", () => {
    expect(catalog["http://purl.org/dc/elements/1.1"]).toBeDefined();
  });

  test("owl2vowl parses a basic RDF/XML document", async () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/ontology#">
        <owl:Ontology rdf:about="http://example.org/ontology">
          <rdfs:label xml:lang="en">My Ontology</rdfs:label>
        </owl:Ontology>
        <owl:Class rdf:about="http://example.org/ontology#Person">
          <rdfs:label xml:lang="en">Person</rdfs:label>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = await owl2vowl(xml);

    expect(result).toHaveProperty("_comment");
    expect(result.header.iri).toBe("http://example.org/ontology");
    expect(result.header.title.en).toBe("My Ontology");

    const personNode = result.class.find((c) => c.type === "owl:Class");
    expect(personNode).toBeDefined();
    const personAttr = result.classAttribute.find(
      (ca) => ca.id === personNode.id,
    );
    expect(personAttr.iri).toBe("http://example.org/ontology#Person");
    expect(personAttr.label.en).toBe("Person");
  });

  test("owl2vowl converts and parses a basic Turtle document", async () => {
    const turtle = `
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix : <http://example.org/ontology#> .
      @base <http://example.org/ontology#> .

      <http://example.org/ontology> a owl:Ontology ;
                                    rdfs:label "My Turtle Ontology"@en .

      :Car a owl:Class ;
           rdfs:label "Car"@en .
    `;

    const result = await owl2vowl(turtle);

    expect(result).toHaveProperty("_comment");
    expect(result.header.iri).toBe("http://example.org/ontology");
    expect(result.header.title.en).toBe("My Turtle Ontology");

    const carNode = result.class.find((c) => c.type === "owl:Class");
    expect(carNode).toBeDefined();
    const carAttr = result.classAttribute.find((ca) => ca.id === carNode.id);
    expect(carAttr.iri).toBe("http://example.org/ontology#Car");
    expect(carAttr.label.en).toBe("Car");
  });

  test("loadWithImports loads imports and parses integrated ontology", async () => {
    const mainXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/main#">
        <owl:Ontology rdf:about="http://example.org/main">
          <owl:imports rdf:resource="http://example.org/imported-ontology"/>
        </owl:Ontology>
      </rdf:RDF>
    `;

    const importedXml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xml:base="http://example.org/imported#">
        <owl:Class rdf:about="http://example.org/imported#SpecialClass">
          <rdfs:label xml:lang="en">Special</rdfs:label>
        </owl:Class>
      </rdf:RDF>
    `;

    global.fetch = jest.fn((url) => {
      if (url === "http://example.org/imported-ontology") {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: () => Promise.resolve(importedXml),
        });
      }
      return Promise.reject(new Error("Unexpected fetch url: " + url));
    });

    const result = await loadWithImports(mainXml);

    expect(result).toHaveProperty("_comment");
    expect(result.header.iri).toBe("http://example.org/main");

    const specialClassNode = result.class.find((c) => {
      const attr = result.classAttribute.find((ca) => ca.id === c.id);
      return attr && attr.iri === "http://example.org/imported#SpecialClass";
    });
    expect(specialClassNode).toBeDefined();
  });
});
