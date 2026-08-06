import { isManchesterSyntaxFormat, convertManchesterSyntaxToRdfXml } from "./manchesterSyntaxParser.js";

describe("Manchester Syntax Parser", () => {
  describe("isManchesterSyntaxFormat", () => {
    it("should detect Ontology keyword", () => {
      expect(isManchesterSyntaxFormat("Ontology: <http://test.com>\nClass: A")).toBe(true);
    });
    
    it("should detect Prefix keyword", () => {
      expect(isManchesterSyntaxFormat("Prefix: : <http://test.com>\nClass: A")).toBe(true);
    });

    it("should reject Turtle format", () => {
      expect(isManchesterSyntaxFormat("@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .")).toBe(false);
    });

    it("should reject OWL/XML format", () => {
      expect(isManchesterSyntaxFormat("<Ontology xmlns=\"http://www.w3.org/2002/07/owl#\"></Ontology>")).toBe(false);
    });
  });

  describe("convertManchesterSyntaxToRdfXml", () => {
    it("should parse a simple class frame and return RDF/XML", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        Class: :Person
          SubClassOf: :Animal
      `;
      
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<rdf:RDF");
      expect(rdfXml).toContain("<rdf:Description rdf:about=\"http://example.com/test#Person\">");
      expect(rdfXml).toContain("<rdf:type rdf:resource=\"http://www.w3.org/2002/07/owl#Class\" />");
      expect(rdfXml).toContain("<rdfs:subClassOf rdf:resource=\"http://example.com/test#Animal\" />");
    });
    
    it("should handle strict mode failures on invalid syntax", () => {
      const input = `
        Class: :Person
          InvalidKeyword: :Animal
      `;
      
      expect(() => {
        convertManchesterSyntaxToRdfXml(input, { strictMode: true });
      }).toThrowError(/Expected EOF but found invalidkeyword:/i);
    });

    it("should recover from invalid syntax in relaxed mode", () => {
      const input = `
        Class: :Person
          InvalidKeyword: :Animal
          
        Class: :Dog
      `;
      
      // In relaxed mode, it will skip the malformed Person frame but successfully parse Dog
      const rdfXml = convertManchesterSyntaxToRdfXml(input, { strictMode: false });
      expect(rdfXml).toContain("<rdf:Description rdf:about=\"http://example.com/test#Dog\">");
    });

    it("should parse existential restrictions", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        Class: :Parent
          EquivalentTo: :Person and :hasChild some :Person
      `;
      
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<owl:Restriction");
      expect(rdfXml).toContain("owl:someValuesFrom");
      expect(rdfXml).toContain("owl:onProperty rdf:resource=\"http://example.com/test#hasChild\"");
    });
    it("should parse complex unions into rdf lists", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        Class: :UnionClass
          EquivalentTo: :A or :B or :C
      `;
      
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<owl:unionOf");
      expect(rdfXml).toContain("<rdf:first");
      expect(rdfXml).toContain("<rdf:rest");
      // Because we have 3 items, there should be multiple rdf:first/rdf:rest
      const restMatches = rdfXml.match(/<rdf:rest/g);
      expect(restMatches.length).toBeGreaterThanOrEqual(3);
    });

    it("should parse top-level n-ary axioms", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        DisjointClasses: :A, :B, :C
      `;
      
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<owl:AllDisjointClasses");
      expect(rdfXml).toContain("<owl:members");
      expect(rdfXml).toContain("<rdf:first");
      expect(rdfXml).toContain("<rdf:rest");
    });
    it("should parse SWRL rules natively into swrl:Imp", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        Rule:
          :Person(?x), :hasChild(?x, ?y) -> :Parent(?x)
      `;
      
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<rdf:type rdf:resource=\"http://www.w3.org/2003/11/swrl#Imp\"");
      expect(rdfXml).toContain("<swrl:body");
      expect(rdfXml).toContain("<swrl:head");
      
      // Class Atom
      expect(rdfXml).toContain("<rdf:type rdf:resource=\"http://www.w3.org/2003/11/swrl#ClassAtom\"");
      expect(rdfXml).toContain("<swrl:classPredicate rdf:resource=\"http://example.com/test#Person\"");
      expect(rdfXml).toContain("urn:swrl:var#x");
      
      // Property Atom
      expect(rdfXml).toContain("<rdf:type rdf:resource=\"http://www.w3.org/2003/11/swrl#IndividualPropertyAtom\"");
      expect(rdfXml).toContain("<swrl:propertyPredicate rdf:resource=\"http://example.com/test#hasChild\"");
      expect(rdfXml).toContain("urn:swrl:var#y");
    });
    
    it("should parse edge-case frames and property characteristics", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Ontology: <http://example.com/test>
        
        ObjectProperty: :hasParent
          Characteristics: Irreflexive, Asymmetric
          Inverses: :hasChild
          SubPropertyChain: :hasFather o :hasParent
          
        Class: :Person
          DisjointUnionOf: :Man, :Woman
          HasKey: :hasSSN
          
        Class: :Adult
          SuperClassOf: :Senior
      `;
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("owl:IrreflexiveProperty");
      expect(rdfXml).toContain("owl:AsymmetricProperty");
      expect(rdfXml).toContain("owl:inverseOf");
      expect(rdfXml).toContain("owl:propertyChainAxiom");
      expect(rdfXml).toContain("owl:disjointUnionOf");
      expect(rdfXml).toContain("owl:hasKey");
      expect(rdfXml).toContain("rdfs:subClassOf rdf:resource=\"http://example.com/test#Person\"");
    });
    
    it("should parse datatype facets and compound restrictions", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Prefix: xsd: <http://www.w3.org/2001/XMLSchema#>
        Ontology: <http://example.com/test>
        
        Class: :Teenager
          EquivalentTo: :Person and :hasAge some xsd:integer[>= 13, <= 19]
          
        Class: :Narcissist
          EquivalentTo: :loves some Self
          
        Class: :OnlySomeExample
          EquivalentTo: :hasPet onlysome :Dog
      `;
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("owl:withRestrictions");
      expect(rdfXml).toContain("xsd:minInclusive");
      expect(rdfXml).toContain("xsd:maxInclusive");
      expect(rdfXml).toContain("owl:hasSelf");
      expect(rdfXml).toContain("owl:someValuesFrom");
      expect(rdfXml).toContain("owl:allValuesFrom");
    });
    
    it("should parse property-value facts and annotations correctly", () => {
      const input = `
        Prefix: : <http://example.com/test#>
        Prefix: rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        Ontology: <http://example.com/test>
        
        Individual: :John
          Annotations: rdfs:label "John Doe"
          Facts: :hasWife :Jane, not :hasChild :Timmy
      `;
      const rdfXml = convertManchesterSyntaxToRdfXml(input);
      expect(rdfXml).toContain("<rdfs:label");
      expect(rdfXml).toContain("John Doe");
      expect(rdfXml).toContain("<hasWife rdf:resource=\"http://example.com/test#Jane\"");
      expect(rdfXml).toContain("owl:NegativePropertyAssertion");
      expect(rdfXml).toContain("owl:assertionProperty rdf:resource=\"http://example.com/test#hasChild\"");
    });
  });
});
