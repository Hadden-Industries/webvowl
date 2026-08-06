import { isOwlXmlFormat, convertOwlXmlToRdfXml } from "./owlXmlParser.js";

describe("owlXmlParser.js unit tests", () => {
  test("Detects OWL/XML format correctly", () => {
    const owlXml = `<?xml version="1.0"?>
    <Ontology xmlns="http://www.w3.org/2002/07/owl#" ontologyIRI="http://example.org/myonto">
      <Prefix name="ex" IRI="http://example.org/"/>
    </Ontology>`;
    expect(isOwlXmlFormat(owlXml)).toBe(true);

    const rdfXml = `<?xml version="1.0"?>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <owl:Ontology rdf:about="http://example.org/myonto"/>
    </rdf:RDF>`;
    expect(isOwlXmlFormat(rdfXml)).toBe(false);
  });

  test("Converts basic OWL/XML declarations and annotations to RDF/XML", () => {
    const owlXml = `<?xml version="1.0"?>
    <Ontology xmlns="http://www.w3.org/2002/07/owl#"
              xml:base="http://blankdots.com/open/personasonto.owl"
              ontologyIRI="http://blankdots.com/open/personasonto.owl">
      <Prefix name="dc" IRI="http://purl.org/dc/elements/1.1/"/>
      <Prefix name="rdfs" IRI="http://www.w3.org/2000/01/rdf-schema#"/>
      <Annotation>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <Literal xml:lang="en">PersonasOnto description.</Literal>
      </Annotation>
      <Declaration>
        <Class IRI="#Persona"/>
      </Declaration>
      <Declaration>
        <ObjectProperty IRI="#hasGoal"/>
      </Declaration>
      <SubClassOf>
        <Class IRI="#Persona"/>
        <Class IRI="#Agent"/>
      </SubClassOf>
      <ObjectPropertyDomain>
        <ObjectProperty IRI="#hasGoal"/>
        <Class IRI="#Persona"/>
      </ObjectPropertyDomain>
      <ObjectPropertyRange>
        <ObjectProperty IRI="#hasGoal"/>
        <Class IRI="#Goal"/>
      </ObjectPropertyRange>
    </Ontology>`;

    const rdfXml = convertOwlXmlToRdfXml(owlXml);
    expect(rdfXml).toContain('<owl:Ontology rdf:about="http://blankdots.com/open/personasonto.owl">');
    expect(rdfXml).toContain('<rdfs:comment xml:lang="en">PersonasOnto description.</rdfs:comment>');
    expect(rdfXml).toContain('<owl:Class rdf:about="http://blankdots.com/open/personasonto.owl#Persona"/>');
    expect(rdfXml).toContain('<owl:ObjectProperty rdf:about="http://blankdots.com/open/personasonto.owl#hasGoal"/>');
    expect(rdfXml).toContain('<rdfs:subClassOf rdf:resource="http://blankdots.com/open/personasonto.owl#Agent"/>');
    expect(rdfXml).toContain('<rdfs:domain rdf:resource="http://blankdots.com/open/personasonto.owl#Persona"/>');
    expect(rdfXml).toContain('<rdfs:range rdf:resource="http://blankdots.com/open/personasonto.owl#Goal"/>');
  });

  test("Properly resolves tags for default namespaces without double colons", () => {
    const owlXml = `<?xml version="1.0"?>
    <Ontology xmlns="http://www.w3.org/2002/07/owl#" ontologyIRI="http://example.com/test#">
      <Prefix name="" IRI="http://example.com/test#"/>
      <Annotation>
        <AnnotationProperty IRI="#hasChild"/>
        <Literal>Timmy</Literal>
      </Annotation>
    </Ontology>`;

    const rdfXml = convertOwlXmlToRdfXml(owlXml);
    // Should emit standard naked tag for default namespaces, not <::hasChild>
    expect(rdfXml).toContain('<hasChild>Timmy</hasChild>');
    expect(rdfXml).not.toContain('<::hasChild>');
    
    // Should correctly emit xmlns="..." declaration
    expect(rdfXml).toContain('xmlns="http://example.com/test#"');
    expect(rdfXml).not.toContain('xmlns:=""');
  });
});
