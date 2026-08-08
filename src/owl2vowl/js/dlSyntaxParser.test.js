import { isDLSyntaxFormat, parseDLSyntax } from "./dlSyntaxParser.js";
import { DOMParser } from "@xmldom/xmldom";

describe("dlSyntaxParser", () => {
  describe("isDLSyntaxFormat", () => {
    it("returns false for empty input", () => {
      expect(isDLSyntaxFormat("")).toBe(false);
      expect(isDLSyntaxFormat(null)).toBe(false);
    });

    it("returns false for XML, Turtle, Functional, and Manchester syntax", () => {
      expect(isDLSyntaxFormat("<rdf:RDF>")).toBe(false);
      expect(isDLSyntaxFormat("@prefix rdf: <http://>")).toBe(false);
      expect(isDLSyntaxFormat("Prefix(rdf:=<http://>)")).toBe(false);
      expect(isDLSyntaxFormat("Ontology(<http://>)")).toBe(false);
      expect(isDLSyntaxFormat("Prefix: rdf: <http://>")).toBe(false);
    });

    it("returns true for DL syntax characteristic operators", () => {
      expect(isDLSyntaxFormat("A -> B")).toBe(true);
      expect(isDLSyntaxFormat("A \\sqsubseteq B")).toBe(true);
      expect(isDLSyntaxFormat("A ⊑ B")).toBe(true);
      expect(isDLSyntaxFormat("A != B")).toBe(true);
      expect(isDLSyntaxFormat("A == B")).toBe(true);
      expect(isDLSyntaxFormat("A \\equiv B")).toBe(true);
    });
  });

  describe("parseDLSyntax", () => {
    const parse = (text) => {
      const xml = parseDLSyntax(text);
      const parser = new DOMParser();
      return parser.parseFromString(xml, "application/xml");
    };

    it("parses SubClassOf axiom", () => {
      const doc = parse("ClassA \\sqsubseteq ClassB");
      const subClassOfs = doc.getElementsByTagName("rdfs:subClassOf");
      expect(subClassOfs.length).toBeGreaterThan(0);
      expect(subClassOfs[0].getAttribute("rdf:resource")).toContain("ClassB");
    });

    it("parses EquivalentClasses axiom", () => {
      const doc = parse("ClassA == ClassB");
      const equivs = doc.getElementsByTagName("owl:equivalentClass");
      expect(equivs.length).toBeGreaterThan(0);
      expect(equivs[0].getAttribute("rdf:resource")).toContain("ClassB");
    });

    it("parses ClassAssertion axiom", () => {
      const doc = parse("ClassA(Ind1)");
      const types = doc.getElementsByTagName("rdf:Description");
      expect(types.length).toBeGreaterThan(0);
      let found = false;
      for (let i = 0; i < types.length; i++) {
        if (types[i].getAttribute("rdf:about").includes("Ind1")) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });

    it("parses ObjectPropertyAssertion axiom", () => {
      const doc = parse("prop(Ind1, Ind2)");
      const desc = doc.getElementsByTagName("rdf:Description");
      expect(desc.length).toBeGreaterThan(0);
    });
  });
});
