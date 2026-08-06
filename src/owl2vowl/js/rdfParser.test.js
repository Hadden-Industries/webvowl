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

  test("Inherits parent xml:lang attribute when child element omits explicit language tag", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#Agent" xml:lang="fr">
          <rdfs:label>Agent Label</rdfs:label>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const agent = result.subjects["http://example.org/#Agent"];
    expect(agent).toBeDefined();
    expect(agent.labels.fr).toBe("Agent Label");
    expect(result.languagesSet.has("fr")).toBe(true);
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

  test("Parses owl:unionOf standard rdf:first/rdf:rest lists", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#StudentOrTeacher">
          <owl:equivalentClass>
            <owl:Class>
              <owl:unionOf rdf:nodeID="n3-1" />
            </owl:Class>
          </owl:equivalentClass>
        </owl:Class>
        <rdf:Description rdf:nodeID="n3-1">
          <rdf:first rdf:resource="#Student" />
          <rdf:rest rdf:nodeID="n3-2" />
        </rdf:Description>
        <rdf:Description rdf:nodeID="n3-2">
          <rdf:first rdf:resource="#Teacher" />
          <rdf:rest rdf:resource="http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" />
        </rdf:Description>
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
    expect(unionCls.unionMembers).toBeDefined();
    expect(unionCls.unionMembers).toContain("http://example.org/#Student");
    expect(unionCls.unionMembers).toContain("http://example.org/#Teacher");
    
    // Intermediate list nodes should be cleaned up
    expect(result.subjects["_:n3-1"]).toBeUndefined();
    expect(result.subjects["_:n3-2"]).toBeUndefined();
  });


  test("Parses owl:oneOf standard rdf:first/rdf:rest lists", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#MyEnum">
          <owl:equivalentClass>
            <owl:Class>
              <owl:oneOf rdf:nodeID="n4-1" />
            </owl:Class>
          </owl:equivalentClass>
        </owl:Class>
        <rdf:Description rdf:nodeID="n4-1">
          <rdf:first rdf:resource="#ValueA" />
          <rdf:rest rdf:nodeID="n4-2" />
        </rdf:Description>
        <rdf:Description rdf:nodeID="n4-2">
          <rdf:first rdf:resource="#ValueB" />
          <rdf:rest rdf:resource="http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" />
        </rdf:Description>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const subject = result.subjects["http://example.org/#MyEnum"];
    expect(subject).toBeDefined();
    
    const enumClassId = subject.equivalentClasses[0];
    expect(enumClassId).toBeDefined();

    const enumCls = context.classMap.get(enumClassId);
    expect(enumCls).toBeDefined();
    expect(enumCls.type).toBe("owl:oneOf");
    expect(enumCls.oneOfMembers).toBeDefined();
    expect(enumCls.oneOfMembers).toContain("http://example.org/#ValueA");
    expect(enumCls.oneOfMembers).toContain("http://example.org/#ValueB");
    
    // Intermediate list nodes should be cleaned up
    expect(result.subjects["_:n4-1"]).toBeUndefined();
    expect(result.subjects["_:n4-2"]).toBeUndefined();
  });


  test("Parses flat blank node restrictions (via nodeID)", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#Student">
          <rdfs:subClassOf rdf:nodeID="genid1"/>
        </owl:Class>
        <owl:Restriction rdf:nodeID="genid1">
          <owl:onProperty rdf:resource="#enrolledIn"/>
          <owl:someValuesFrom rdf:resource="#Course"/>
        </owl:Restriction>
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
  });

  test("De-duplicates identical anonymous unionOf, intersectionOf, and complementOf expressions", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:ObjectProperty rdf:about="#prop1">
          <rdfs:range>
            <owl:Class>
              <owl:unionOf rdf:parseType="Collection">
                <owl:Class rdf:about="#A"/>
                <owl:Class rdf:about="#B"/>
              </owl:unionOf>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>
        <owl:ObjectProperty rdf:about="#prop2">
          <rdfs:range>
            <owl:Class>
              <owl:unionOf rdf:parseType="Collection">
                <owl:Class rdf:about="#A"/>
                <owl:Class rdf:about="#B"/>
              </owl:unionOf>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>

        <owl:ObjectProperty rdf:about="#prop3">
          <rdfs:range>
            <owl:Class>
              <owl:intersectionOf rdf:parseType="Collection">
                <owl:Class rdf:about="#C"/>
                <owl:Class rdf:about="#D"/>
              </owl:intersectionOf>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>
        <owl:ObjectProperty rdf:about="#prop4">
          <rdfs:range>
            <owl:Class>
              <owl:intersectionOf rdf:parseType="Collection">
                <owl:Class rdf:about="#C"/>
                <owl:Class rdf:about="#D"/>
              </owl:intersectionOf>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>

        <owl:ObjectProperty rdf:about="#prop5">
          <rdfs:range>
            <owl:Class>
              <owl:complementOf rdf:resource="#E"/>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>
        <owl:ObjectProperty rdf:about="#prop6">
          <rdfs:range>
            <owl:Class>
              <owl:complementOf rdf:resource="#E"/>
            </owl:Class>
          </rdfs:range>
        </owl:ObjectProperty>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);

    // Verify union de-duplication
    const range1 = result.subjects["http://example.org/#prop1"].ranges[0];
    const range2 = result.subjects["http://example.org/#prop2"].ranges[0];
    expect(range1).toBeDefined();
    expect(range2).toBeDefined();
    expect(range1).toBe(range2);

    // Verify intersection de-duplication
    const range3 = result.subjects["http://example.org/#prop3"].ranges[0];
    const range4 = result.subjects["http://example.org/#prop4"].ranges[0];
    expect(range3).toBeDefined();
    expect(range4).toBeDefined();
    expect(range3).toBe(range4);

    // Verify complement de-duplication
    const range5 = result.subjects["http://example.org/#prop5"].ranges[0];
    const range6 = result.subjects["http://example.org/#prop6"].ranges[0];
    expect(range5).toBeDefined();
    expect(range6).toBeDefined();
    expect(range5).toBe(range6);
  });

  test("Parses owl:unionOf collection members only from immediate child nodes, ignoring deep nested elements", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#UnionClass">
          <owl:unionOf rdf:parseType="Collection">
            <owl:Restriction>
              <owl:onProperty rdf:resource="#numericPosition"/>
              <owl:cardinality>1</owl:cardinality>
            </owl:Restriction>
            <owl:Restriction>
              <owl:onProperty rdf:resource="#nominalPosition"/>
              <owl:cardinality>1</owl:cardinality>
            </owl:Restriction>
          </owl:unionOf>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const subject = result.subjects["http://example.org/#UnionClass"];
    expect(subject).toBeDefined();
    
    // The union members must be the two anonymous restrictions, NOT the properties 'numericPosition' or 'nominalPosition'
    expect(subject.unionOf.length).toBe(2);
    expect(subject.unionOf[0]).toMatch(/^_:anon_/);
    expect(subject.unionOf[1]).toMatch(/^_:anon_/);

    expect(subject.unionOf).not.toContain("http://example.org/#numericPosition");
    expect(subject.unionOf).not.toContain("http://example.org/#nominalPosition");
  });

  test("Resolves owl:onProperty declared with a nested typed element (not rdf:resource)", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#Person">
          <rdfs:subClassOf>
            <owl:Restriction>
              <owl:onProperty>
                <owl:DatatypeProperty rdf:about="#age"/>
              </owl:onProperty>
              <owl:allValuesFrom rdf:resource="http://www.w3.org/2001/XMLSchema#integer"/>
            </owl:Restriction>
          </rdfs:subClassOf>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);

    // The restriction blank node should have onProperty resolved to the age property IRI
    const personSuperClasses = result.subjects["http://example.org/#Person"]?.superClasses || [];
    expect(personSuperClasses.length).toBeGreaterThan(0);
    const restrictionIri = personSuperClasses[0];
    const restriction = result.subjects[restrictionIri];
    expect(restriction).toBeDefined();
    const onProp = restriction?.annotations?.["onProperty"]?.[0];
    expect(onProp).toBeDefined();
    expect(onProp.value).toBe("http://example.org/#age");

    // parsedRestrictions should contain the allValuesFrom entry with correct propertyIri
    expect(context.parsedRestrictions.length).toBeGreaterThan(0);
    const restEntry = context.parsedRestrictions.find(r => r.propertyIri === "http://example.org/#age");
    expect(restEntry).toBeDefined();
    expect(restEntry.type).toBe("owl:allValuesFrom");
    expect(restEntry.rangeIri).toBe("http://www.w3.org/2001/XMLSchema#integer");
  });

  test("Suppresses anonymous union in subClassOf where all members are anonymous restrictions (TimePosition pattern)", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xml:base="http://example.org/">
        <owl:Class rdf:about="#TimePosition">
          <rdfs:subClassOf>
            <owl:Class>
              <owl:unionOf rdf:parseType="Collection">
                <owl:Restriction>
                  <owl:onProperty>
                    <owl:DatatypeProperty rdf:about="#numericPosition"/>
                  </owl:onProperty>
                  <owl:cardinality rdf:datatype="http://www.w3.org/2001/XMLSchema#nonNegativeInteger">1</owl:cardinality>
                </owl:Restriction>
                <owl:Restriction>
                  <owl:onProperty>
                    <owl:DatatypeProperty rdf:about="#nominalPosition"/>
                  </owl:onProperty>
                  <owl:cardinality rdf:datatype="http://www.w3.org/2001/XMLSchema#nonNegativeInteger">1</owl:cardinality>
                </owl:Restriction>
              </owl:unionOf>
            </owl:Class>
          </rdfs:subClassOf>
        </owl:Class>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const subject = result.subjects["http://example.org/#TimePosition"];
    expect(subject).toBeDefined();

    // TimePosition must have a superClass that is an anonymous union
    expect(subject.superClasses.length).toBe(1);
    const unionIri = subject.superClasses[0];
    expect(unionIri.startsWith("_:")).toBe(true);

    const unionSubject = result.subjects[unionIri];
    expect(unionSubject).toBeDefined();
    // Its unionOf members should each be anonymous restriction IDs, NOT the property IRIs
    expect(unionSubject.unionOf).toBeDefined();
    expect(unionSubject.unionOf.length).toBe(2);
    expect(unionSubject.unionOf[0].startsWith("_:")).toBe(true);
    expect(unionSubject.unionOf[1].startsWith("_:")).toBe(true);
    expect(unionSubject.unionOf).not.toContain("http://example.org/#numericPosition");
    expect(unionSubject.unionOf).not.toContain("http://example.org/#nominalPosition");
  });

  test("Parses XML property attributes on subject elements (e.g. rdfs:label, rdfs:comment, vs:term_status)", () => {
    const xml = `
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:vs="http://www.w3.org/2003/06/sw-vocab-status/ns#"
               xml:base="http://xmlns.com/foaf/0.1/">
        <rdf:Property rdf:about="http://xmlns.com/foaf/0.1/isPrimaryTopicOf"
                      vs:term_status="stable"
                      rdfs:label="is primary topic of"
                      rdfs:comment="A document that this thing is the primary topic of.">
          <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#InverseFunctionalProperty"/>
        </rdf:Property>
      </rdf:RDF>
    `;

    const result = parseRdfXml(xml, resolver, context);
    const subject = result.subjects["http://xmlns.com/foaf/0.1/isPrimaryTopicOf"];
    expect(subject).toBeDefined();

    // Verify label extracted from XML attribute
    expect(subject.labels.undefined).toBe("is primary topic of");
    // Verify comment extracted from XML attribute
    expect(subject.comments.undefined).toBe("A document that this thing is the primary topic of.");
    // Verify vs:term_status extracted from XML attribute into annotations
    expect(subject.annotations.term_status).toBeDefined();
    expect(subject.annotations.term_status[0].value).toBe("stable");
    // Verify InverseFunctionalProperty type
    expect(subject.types.has("http://www.w3.org/2002/07/owl#InverseFunctionalProperty")).toBe(true);
  });
});
