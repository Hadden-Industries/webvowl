import { describe, test, expect } from "@jest/globals";
import { resolveXmlEntities } from "./xmlUtils.js";

describe("xmlUtils.js - resolveXmlEntities", () => {
  test("resolves basic entity declarations", () => {
    const xml = `
      <!DOCTYPE rdf:RDF [
        <!ENTITY xsd "http://www.w3.org/2001/XMLSchema#" >
        <!ENTITY vin "http://example.org/wine#" >
      ]>
      <rdf:RDF rdf:datatype="&xsd;integer" rdf:resource="&vin;Merlot">
      </rdf:RDF>
    `;
    const resolved = resolveXmlEntities(xml);
    expect(resolved).toContain('rdf:datatype="http://www.w3.org/2001/XMLSchema#integer"');
    expect(resolved).toContain('rdf:resource="http://example.org/wine#Merlot"');
  });

  test("resolves nested entity declarations", () => {
    const xml = `
      <!DOCTYPE rdf:RDF [
        <!ENTITY base "http://example.org/" >
        <!ENTITY ontology "&base;ontology#" >
      ]>
      <rdf:RDF rdf:resource="&ontology;Class">
      </rdf:RDF>
    `;
    const resolved = resolveXmlEntities(xml);
    expect(resolved).toContain('rdf:resource="http://example.org/ontology#Class"');
  });
});
