import { isJsonLdFormat, parseJsonLd } from "./jsonLdParser.js";
import { DOMParser } from "@xmldom/xmldom";

describe("jsonLdParser", () => {
  const parseToDom = async (text) => {
    const xml = await parseJsonLd(text);
    const parser = new DOMParser();
    return parser.parseFromString(xml, "application/xml");
  };

  describe("isJsonLdFormat - Security & Format Detection", () => {
    it("should return false for empty or non-string input", () => {
      expect(isJsonLdFormat("")).toBe(false);
      expect(isJsonLdFormat(null)).toBe(false);
      expect(isJsonLdFormat(undefined)).toBe(false);
    });

    it("should reject XML, Turtle, OFN, Manchester, and KRSS2 inputs without running JSON.parse", () => {
      expect(isJsonLdFormat('<rdf:RDF xmlns:rdf="...">')).toBe(false);
      expect(isJsonLdFormat("@prefix ex: <http://example.org/> .")).toBe(false);
      expect(isJsonLdFormat("PREFIX ex: <http://example.org/>")).toBe(false);
      expect(isJsonLdFormat("Ontology(<http://example.com>)")).toBe(false);
      expect(isJsonLdFormat("Prefix: ex: <http://example.com>")).toBe(false);
      expect(isJsonLdFormat("(define-primitive-concept A B)")).toBe(false);
    });

    it("should reject standard non-JSON-LD JSON objects without @context, @graph, or @id", () => {
      const plainJson = JSON.stringify({ name: "Alice", age: 30 });
      expect(isJsonLdFormat(plainJson)).toBe(false);
    });

    it("should identify valid JSON-LD objects containing @context, @graph, or @id", () => {
      const jsonLd1 = JSON.stringify({
        "@context": "http://schema.org",
        "@type": "Person",
        name: "John Doe",
      });
      expect(isJsonLdFormat(jsonLd1)).toBe(true);

      const jsonLd2 = JSON.stringify({
        "@graph": [
          {
            "@id": "http://example.org/person1",
            "@type": "http://xmlns.com/foaf/0.1/Person",
          },
        ],
      });
      expect(isJsonLdFormat(jsonLd2)).toBe(true);
    });

    it("should safely handle large input text without OOM vulnerabilities", () => {
      // 1MB string of XML tags
      const hugeXml = "<xml>" + "a".repeat(1024 * 1024) + "</xml>";
      expect(isJsonLdFormat(hugeXml)).toBe(false);
    });
  });

  describe("parseJsonLd", () => {
    it("should parse a JSON-LD document into valid RDF/XML containing classes and properties", async () => {
      const jsonLd = JSON.stringify({
        "@context": {
          ex: "http://example.org/vocab#",
          rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#",
          owl: "http://www.w3.org/2002/07/owl#",
        },
        "@graph": [
          {
            "@id": "ex:Person",
            "@type": "owl:Class",
          },
          {
            "@id": "ex:Student",
            "@type": "owl:Class",
            "rdfs:subClassOf": { "@id": "ex:Person" },
          },
        ],
      });

      const doc = await parseToDom(jsonLd);
      const descriptions = doc.getElementsByTagName("rdf:Description");
      expect(descriptions.length).toBeGreaterThanOrEqual(2);

      const subClasses = doc.getElementsByTagName("rdfs:subClassOf");
      expect(subClasses.length).toBeGreaterThan(0);
      expect(subClasses[0].getAttribute("rdf:resource")).toBe(
        "http://example.org/vocab#Person",
      );
    });

    it("should handle literals with language tags and blank nodes correctly", async () => {
      const jsonLd = JSON.stringify({
        "@context": {
          ex: "http://example.org/vocab#",
          rdfs: "http://www.w3.org/2000/01/rdf-schema#",
        },
        "@id": "_:b1",
        "rdfs:label": { "@value": "Person Label", "@language": "en" },
      });

      const doc = await parseToDom(jsonLd);
      const descriptions = doc.getElementsByTagName("rdf:Description");
      expect(descriptions.length).toBe(1);
      expect(descriptions[0].getAttribute("rdf:nodeID")).toBeTruthy();
    });
  });
});
