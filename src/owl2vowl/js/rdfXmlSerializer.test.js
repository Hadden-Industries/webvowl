import { serializeTriplesToRdfXml } from "./rdfXmlSerializer.js";
import { DOMParser } from "@xmldom/xmldom";

describe("rdfXmlSerializer", () => {
  const parseXml = (xmlString) => {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, "application/xml");
  };

  it("should serialize basic URI triples into rdf:Description blocks with namespaces", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/test#Subject" },
        predicate: {
          type: "IRI",
          value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        object: { type: "URI", value: "http://www.w3.org/2002/07/owl#Class" },
      },
    ];
    const prefixes = { ex: "http://example.org/test#" };
    const xml = serializeTriplesToRdfXml(
      triples,
      prefixes,
      "http://example.org/test",
    );

    expect(xml).toContain('xml:base="http://example.org/test"');
    expect(xml).toContain('xmlns:ex="http://example.org/test#"');

    const doc = parseXml(xml);
    const descriptions = doc.getElementsByTagName("rdf:Description");
    expect(descriptions.length).toBe(1);
    expect(descriptions[0].getAttribute("rdf:about")).toBe(
      "http://example.org/test#Subject",
    );

    const types = doc.getElementsByTagName("rdf:type");
    expect(types.length).toBe(1);
    expect(types[0].getAttribute("rdf:resource")).toBe(
      "http://www.w3.org/2002/07/owl#Class",
    );
  });

  it("should handle blank nodes (BNODE) using rdf:nodeID and strip leading '_:' if present", () => {
    const triples = [
      {
        subject: { type: "BNODE", value: "_:b1" },
        predicate: {
          type: "IRI",
          value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        object: {
          type: "URI",
          value: "http://www.w3.org/2002/07/owl#Restriction",
        },
      },
      {
        subject: { type: "URI", value: "http://example.org/test#ClassA" },
        predicate: {
          type: "IRI",
          value: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
        },
        object: { type: "BNODE", value: "_:b1" },
      },
    ];
    const xml = serializeTriplesToRdfXml(triples, {}, "");

    const doc = parseXml(xml);
    const descriptions = doc.getElementsByTagName("rdf:Description");
    let bnodeDescFound = false;
    for (let i = 0; i < descriptions.length; i++) {
      if (
        descriptions[i].getAttribute("rdf:nodeID") === "_:b1" ||
        descriptions[i].getAttribute("rdf:nodeID") === "b1"
      ) {
        bnodeDescFound = true;
      }
    }
    expect(bnodeDescFound).toBe(true);

    const subClasses = doc.getElementsByTagName("rdfs:subClassOf");
    expect(subClasses.length).toBe(1);
    expect(subClasses[0].getAttribute("rdf:nodeID")).toBeTruthy();
  });

  it("should serialize literal objects with language tags and datatypes", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://example.org/test#Thing" },
        predicate: {
          type: "IRI",
          value: "http://www.w3.org/2000/01/rdf-schema#label",
        },
        object: { type: "LITERAL", value: "Hello World", lang: "en" },
      },
      {
        subject: { type: "URI", value: "http://example.org/test#Thing" },
        predicate: { type: "IRI", value: "http://example.org/test#count" },
        object: {
          type: "LITERAL",
          value: "42",
          datatype: {
            type: "URI",
            value: "http://www.w3.org/2001/XMLSchema#integer",
          },
        },
      },
    ];
    const xml = serializeTriplesToRdfXml(
      triples,
      { ex: "http://example.org/test#" },
      "",
    );

    const doc = parseXml(xml);
    const labels = doc.getElementsByTagName("rdfs:label");
    expect(labels.length).toBe(1);
    expect(labels[0].textContent).toBe("Hello World");
    expect(labels[0].getAttribute("xml:lang")).toBe("en");

    const counts = doc.getElementsByTagName("ex:count");
    expect(counts.length).toBe(1);
    expect(counts[0].textContent).toBe("42");
    expect(counts[0].getAttribute("rdf:datatype")).toBe(
      "http://www.w3.org/2001/XMLSchema#integer",
    );
  });

  it("should auto-generate prefix mappings for unrecognized namespaces", () => {
    const triples = [
      {
        subject: { type: "URI", value: "http://custom-domain.com/vocab#Item" },
        predicate: {
          type: "IRI",
          value: "http://custom-domain.com/vocab#customProp",
        },
        object: { type: "URI", value: "http://custom-domain.com/vocab#Value" },
      },
    ];
    const xml = serializeTriplesToRdfXml(triples, {}, "");

    expect(xml).toContain('xmlns:ns0="http://custom-domain.com/vocab#"');
    expect(xml).toContain("<ns0:customProp");
  });
});
