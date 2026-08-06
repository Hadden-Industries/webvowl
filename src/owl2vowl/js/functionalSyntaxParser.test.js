import { parseFunctionalSyntax } from "./functionalSyntaxParser.js";

describe("Functional Syntax Parser", () => {
  describe("Slice 1: Lexer and Basic Wrapper", () => {
    it("should parse an empty Ontology declaration into a valid RDF/XML skeleton", () => {
      const input = `Ontology(<http://example.com/onto>)`;
      const result = parseFunctionalSyntax(input);

      expect(result).toContain("<rdf:RDF");
      expect(result).toContain('xml:base="http://example.com/onto"');
      expect(result).toContain('<owl:Ontology rdf:about="http://example.com/onto"/>');
      expect(result).toContain("</rdf:RDF>");
    });

    it("should reject invalid syntax gracefully", () => {
      const input = `NotAnOntology(<http://example.com/onto>)`;
      expect(() => parseFunctionalSyntax(input)).toThrow(/Expected keyword Ontology/);
    });
  });

  describe("Slice 2: Prefix directives and URI resolution", () => {
    it("should parse Prefix declarations and resolve prefixed names in the ontology IRI", () => {
      const input = `Prefix(:=<http://example.com/default#>)
Prefix(ex:=<http://example.com/ex#>)
Ontology(ex:MyOntology)`;
      
      const result = parseFunctionalSyntax(input);
      expect(result).toContain('xml:base="http://example.com/ex#MyOntology"');
      expect(result).toContain('xml:base="http://example.com/ex#MyOntology"');
      expect(result).toContain('<owl:Ontology rdf:about="http://example.com/ex#MyOntology"/>');
    });
  });

  describe("Slice 3: Entity Declarations", () => {
    it("should parse Declarations for Class, ObjectProperty, DataProperty, NamedIndividual, Datatype, and AnnotationProperty", () => {
      const input = `Prefix(:=<http://example.com/default#>)
Ontology(
  Declaration(Class(:Person))
  Declaration(ObjectProperty(:hasChild))
  Declaration(DataProperty(:hasAge))
  Declaration(NamedIndividual(:John))
  Declaration(Datatype(:customType))
  Declaration(AnnotationProperty(:hasNote))
)`;
      const result = parseFunctionalSyntax(input);
      expect(result).toContain('<owl:Class rdf:about="http://example.com/default#Person"/>');
      expect(result).toContain('<owl:ObjectProperty rdf:about="http://example.com/default#hasChild"/>');
      expect(result).toContain('<owl:DatatypeProperty rdf:about="http://example.com/default#hasAge"/>');
      expect(result).toContain('<owl:NamedIndividual rdf:about="http://example.com/default#John"/>');
      expect(result).toContain('<rdfs:Datatype rdf:about="http://example.com/default#customType"/>');
      expect(result).toContain('<owl:AnnotationProperty rdf:about="http://example.com/default#hasNote"/>');
    });
  });

  describe("Slice 4: Axioms", () => {
    it("should parse SubClassOf, EquivalentClasses, and SubObjectPropertyOf axioms", () => {
      const input = `Prefix(:=<http://example.com/default#>)
Ontology(
  Declaration(Class(:Animal))
  Declaration(Class(:Dog))
  Declaration(Class(:Canine))
  Declaration(ObjectProperty(:hasParent))
  Declaration(ObjectProperty(:hasFather))
  SubClassOf(:Dog :Animal)
  EquivalentClasses(:Dog :Canine)
  SubObjectPropertyOf(:hasFather :hasParent)
)`;
      const result = parseFunctionalSyntax(input);
      // We expect the emitter to serialize triples. Since WebVOWL's internal format
      // expects standard RDF/XML, let's verify standard representations.
      expect(result).toContain('<owl:Class rdf:about="http://example.com/default#Dog">');
      expect(result).toContain('<rdfs:subClassOf rdf:resource="http://example.com/default#Animal"/>');
      expect(result).toContain('<owl:equivalentClass rdf:resource="http://example.com/default#Canine"/>');
      expect(result).toContain('<owl:ObjectProperty rdf:about="http://example.com/default#hasFather">');
      expect(result).toContain('<rdfs:subPropertyOf rdf:resource="http://example.com/default#hasParent"/>');
    });
  });

  describe("Slice 5: Nested Class Expressions", () => {
    it("should parse and serialize nested class expressions like ObjectSomeValuesFrom and ObjectIntersectionOf", () => {
      const input = `Prefix(:=<http://example.com/default#>)
Ontology(
  Declaration(Class(:Person))
  Declaration(Class(:Parent))
  Declaration(ObjectProperty(:hasChild))
  SubClassOf(
    :Parent
    ObjectIntersectionOf(
      :Person
      ObjectSomeValuesFrom(:hasChild :Person)
    )
  )
)`;
      const result = parseFunctionalSyntax(input);
      // We expect the nested expression to generate blank nodes.
      // Since it's an intersection, we expect owl:intersectionOf
      // And for the restriction we expect owl:Restriction
      expect(result).toContain('<owl:Class rdf:about="http://example.com/default#Parent">');
      expect(result).toContain('<owl:Restriction>');
      expect(result).toContain('<owl:onProperty rdf:resource="http://example.com/default#hasChild"/>');
      expect(result).toContain('<owl:someValuesFrom rdf:resource="http://example.com/default#Person"/>');
    });
  });

  describe("Slice 6: Full Document Integration", () => {
    it("should parse a complete ontology document accurately", () => {
      const input = `Prefix(:=<http://example.com/test#>)
Prefix(owl:=<http://www.w3.org/2002/07/owl#>)
Prefix(rdf:=<http://www.w3.org/1999/02/22-rdf-syntax-ns#>)
Prefix(xml:=<http://www.w3.org/XML/1998/namespace>)
Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>)
Prefix(rdfs:=<http://www.w3.org/2000/01/rdf-schema#>)

Ontology(<http://example.com/test>
Declaration(Class(:A))
Declaration(Class(:B))
Declaration(ObjectProperty(:p))
Declaration(DataProperty(:dp))
Declaration(NamedIndividual(:ind))
Declaration(Datatype(:dt))
Declaration(AnnotationProperty(:ap))

SubClassOf(:A :B)
EquivalentClasses(:A ObjectIntersectionOf(:B ObjectSomeValuesFrom(:p :B)))
)`;
      const result = parseFunctionalSyntax(input);
      expect(result).toContain('<owl:Ontology rdf:about="http://example.com/test"/>');
      expect(result).toContain('<owl:Class rdf:about="http://example.com/test#A">');
      expect(result).toContain('<rdfs:subClassOf rdf:resource="http://example.com/test#B"/>');
      expect(result).toContain('<owl:equivalentClass>');
      expect(result).toContain('<owl:intersectionOf rdf:parseType="Collection">');
      expect(result).toContain('<owl:Restriction>');
      expect(result).toContain('<owl:someValuesFrom rdf:resource="http://example.com/test#B"/>');
    });
  });
});
