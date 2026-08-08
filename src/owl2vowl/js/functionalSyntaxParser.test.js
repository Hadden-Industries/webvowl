import { parseFunctionalSyntax } from "./functionalSyntaxParser.js";
import { DOMParser } from "@xmldom/xmldom";

describe("Functional Syntax Parser", () => {
  const parseToDom = (text) => {
    const xml = parseFunctionalSyntax(text);
    const parser = new DOMParser();
    return parser.parseFromString(xml, "application/xml");
  };

  describe("Slice 1: Lexer and Basic Wrapper", () => {
    it("should parse an empty Ontology declaration into a valid RDF/XML skeleton", () => {
      const input = `Ontology(<http://example.com/onto>)`;
      const result = parseFunctionalSyntax(input);

      expect(result).toContain("<rdf:RDF");
      expect(result).toContain('xml:base="http://example.com/onto"');
      expect(result).toContain('<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Ontology" />');
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
      expect(result).toContain('rdf:about="http://example.com/ex#MyOntology"');
      expect(result).toContain('<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Ontology" />');
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
      const doc = parseToDom(input);
      const descriptions = doc.getElementsByTagName("rdf:Description");
      expect(descriptions.length).toBeGreaterThanOrEqual(6);

      const findResource = (aboutIri) => {
        for (let i = 0; i < descriptions.length; i++) {
          if (descriptions[i].getAttribute("rdf:about") === aboutIri) {
            const types = descriptions[i].getElementsByTagName("rdf:type");
            if (types.length > 0) {
              return types[0].getAttribute("rdf:resource");
            }
          }
        }
        return null;
      };

      expect(findResource("http://example.com/default#Person")).toBe("http://www.w3.org/2002/07/owl#Class");
      expect(findResource("http://example.com/default#hasChild")).toBe("http://www.w3.org/2002/07/owl#ObjectProperty");
      expect(findResource("http://example.com/default#hasAge")).toBe("http://www.w3.org/2002/07/owl#DatatypeProperty");
      expect(findResource("http://example.com/default#John")).toBe("http://www.w3.org/2002/07/owl#NamedIndividual");
      expect(findResource("http://example.com/default#customType")).toBe("http://www.w3.org/2000/01/rdf-schema#Datatype");
      expect(findResource("http://example.com/default#hasNote")).toBe("http://www.w3.org/2002/07/owl#AnnotationProperty");
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
      const doc = parseToDom(input);
      const subClasses = doc.getElementsByTagName("rdfs:subClassOf");
      expect(subClasses.length).toBeGreaterThan(0);
      expect(subClasses[0].getAttribute("rdf:resource")).toBe("http://example.com/default#Animal");

      const equivs = doc.getElementsByTagName("owl:equivalentClass");
      expect(equivs.length).toBeGreaterThan(0);
      expect(equivs[0].getAttribute("rdf:resource")).toBe("http://example.com/default#Canine");

      const subProps = doc.getElementsByTagName("rdfs:subPropertyOf");
      expect(subProps.length).toBeGreaterThan(0);
      expect(subProps[0].getAttribute("rdf:resource")).toBe("http://example.com/default#hasParent");
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
      const doc = parseToDom(input);
      const restrictions = doc.getElementsByTagName("owl:onProperty");
      expect(restrictions.length).toBeGreaterThan(0);
      expect(restrictions[0].getAttribute("rdf:resource")).toBe("http://example.com/default#hasChild");

      const someValues = doc.getElementsByTagName("owl:someValuesFrom");
      expect(someValues.length).toBeGreaterThan(0);
      expect(someValues[0].getAttribute("rdf:resource")).toBe("http://example.com/default#Person");
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
      const doc = parseToDom(input);
      const subClasses = doc.getElementsByTagName("rdfs:subClassOf");
      expect(subClasses.length).toBeGreaterThan(0);
      expect(subClasses[0].getAttribute("rdf:resource")).toBe("http://example.com/test#B");

      const equivs = doc.getElementsByTagName("owl:equivalentClass");
      expect(equivs.length).toBeGreaterThan(0);
    });
  });
});
