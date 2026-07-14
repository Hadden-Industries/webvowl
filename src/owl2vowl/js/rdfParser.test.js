import { describe, test, expect, beforeEach } from "@jest/globals";
import { PerformanceIriResolver } from "./iriResolver.js";
import { VowlParserContext } from "./parserContext.js";
import { parseRdfXml } from "./rdfParser.js";

describe("rdfParser.js unit tests", () => {
  let resolver;
  let context;

  beforeEach(() => {
    resolver = new PerformanceIriResolver("http://example.org/");
    context = new VowlParserContext();
  });

  test("Parses basic RDF/XML document containing owl:Class, rdfs:label, and rdfs:comment", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#Person">
          <rdfs:label xml:lang="en">Person</rdfs:label>
          <rdfs:comment>Represents a human being</rdfs:comment>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    expect(result.ontologyBaseIri).toBe("http://example.org/");
    expect(result.prefixList.owl).toBe("http://www.w3.org/2002/07/owl#");

    const person = result.subjects["http://example.org/#Person"];
    expect(person).toBeDefined();
    expect(person.types.has("http://www.w3.org/2002/07/owl#Class")).toBe(true);
    expect(person.labels.en).toBe("Person");
    expect(person.comments.undefined).toBe("Represents a human being");
    expect(result.languagesSet.has("en")).toBe(true);
    expect(result.languagesSet.has("undefined")).toBe(true);
  });

  test("Parses owl:ObjectProperty and owl:DatatypeProperty with domains and ranges", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:ObjectProperty rdf:about="#hasFriend">
          <rdfs:domain rdf:resource="#Person"/>
          <rdfs:range rdf:resource="#Person"/>
        </owl:ObjectProperty>
        <owl:DatatypeProperty rdf:about="#age">
          <rdfs:domain rdf:resource="#Person"/>
          <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#integer"/>
        </owl:DatatypeProperty>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);

    const hasFriend = result.subjects["http://example.org/#hasFriend"];
    expect(hasFriend).toBeDefined();
    expect(hasFriend.types.has("http://www.w3.org/2002/07/owl#ObjectProperty")).toBe(true);
    expect(hasFriend.domains).toContain("http://example.org/#Person");
    expect(hasFriend.ranges).toContain("http://example.org/#Person");

    const age = result.subjects["http://example.org/#age"];
    expect(age).toBeDefined();
    expect(age.types.has("http://www.w3.org/2002/07/owl#DatatypeProperty")).toBe(true);
    expect(age.domains).toContain("http://example.org/#Person");
    expect(age.ranges).toContain("http://www.w3.org/2001/XMLSchema#integer");
  });

  test("Parses class restrictions (someValuesFrom, allValuesFrom, cardinalities)", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#Student">
          <rdfs:subClassOf>
            <owl:Restriction>
              <owl:onProperty rdf:resource="#enrolledIn"/>
              <owl:someValuesFrom rdf:resource="#Course"/>
            </owl:Restriction>
          </rdfs:subClassOf>
          <rdfs:subClassOf>
            <owl:Restriction>
              <owl:onProperty rdf:resource="#enrolledIn"/>
              <owl:minCardinality rdf:datatype="http://www.w3.org/2001/XMLSchema#nonNegativeInteger">1</owl:minCardinality>
            </owl:Restriction>
          </rdfs:subClassOf>
        </owl:Class>
      </rdf:RDF>
    `;

    parseRdfXml(xml, resolver, context);

    expect(context.parsedRestrictions.length).toBe(1);
    expect(context.parsedRestrictions[0]).toEqual({
      domainIri: "http://example.org/#Student",
      propertyIri: "http://example.org/#enrolledIn",
      rangeIri: "http://example.org/#Course",
      type: "owl:someValuesFrom"
    });

    expect(context.parsedCardinalities.length).toBe(1);
    expect(context.parsedCardinalities[0]).toEqual({
      propertyIri: "http://example.org/#enrolledIn",
      minCardinality: "1",
      maxCardinality: null,
      cardinality: null
    });
  });

  test("Parses owl:unionOf collections", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#StudentOrTeacher">
          <owl:equivalentClass>
            <owl:Class>
              <owl:unionOf rdf:parseType="Collection">
                <owl:Class rdf:about="#Student"/>
                <owl:Class rdf:about="#Teacher"/>
              </owl:unionOf>
            </owl:Class>
          </owl:equivalentClass>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const subject = result.subjects["http://example.org/#StudentOrTeacher"];
    expect(subject).toBeDefined();
    
    // Check that union class exists in equivalentClasses and has members
    const unionClassId = subject.equivalentClasses[0];
    expect(unionClassId).toBeDefined();

    const unionCls = context.classMap.get(unionClassId);
    expect(unionCls).toBeDefined();
    expect(unionCls.type).toBe("owl:unionOf");
    expect(unionCls.unionMembers).toContain("http://example.org/#Student");
    expect(unionCls.unionMembers).toContain("http://example.org/#Teacher");
  });
});
