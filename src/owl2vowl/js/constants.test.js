import {
  ONTOLOGY_BASE_URL,
  NAMESPACES,
  ONTOLOGY_CATALOG,
  IGNORED_PROPERTIES
} from "./constants.js";

describe("NAMESPACES contract", () => {
  test("defines standard RDF, RDFS, OWL, and DC namespace URIs", () => {
    const requiredPrefixes = ["RDF", "RDFS", "OWL", "DC", "DCTERMS"];
    
    for (const prefix of requiredPrefixes) {
      expect(NAMESPACES[prefix]).toBeDefined();
      expect(typeof NAMESPACES[prefix]).toBe("string");
      expect(NAMESPACES[prefix]).toMatch(/^https?:\/\/.+[#/]$/);
    }
  });
});

describe("ONTOLOGY_CATALOG contract", () => {
  test("maps ontology IRIs to valid absolute target URLs", () => {
    const entries = Object.entries(ONTOLOGY_CATALOG);
    expect(entries.length).toBeGreaterThan(0);

    for (const [iri, targetUrl] of entries) {
      expect(iri).toMatch(/^https?:\/\//);
      expect(() => new URL(targetUrl)).not.toThrow();
    }
  });

  test("resolves known standard ontologies to host infrastructure", () => {
    expect(ONTOLOGY_CATALOG["http://purl.org/dc/elements/1.1"]).toBe(
      `${ONTOLOGY_BASE_URL}external/dc.rdf`
    );
    expect(ONTOLOGY_CATALOG["http://schema.org"]).toBe(
      `${ONTOLOGY_BASE_URL}external/schemaorg.owl`
    );
  });
});

describe("IGNORED_PROPERTIES contract", () => {
  test("contains standard annotation metadata properties to filter", () => {
    const expectedIgnored = [
      "http://www.w3.org/2000/01/rdf-schema#label",
      "http://www.w3.org/2000/01/rdf-schema#comment",
      "http://www.w3.org/2000/01/rdf-schema#seeAlso",
      "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
      "http://www.w3.org/2002/07/owl#versionInfo",
      "http://www.w3.org/2002/07/owl#priorVersion",
      "http://www.w3.org/2002/07/owl#backwardCompatibleWith",
      "http://www.w3.org/2002/07/owl#incompatibleWith"
    ];

    for (const prop of expectedIgnored) {
      expect(IGNORED_PROPERTIES.has(prop)).toBe(true);
    }
  });

  test("does not contain non-annotation domain predicates", () => {
    expect(IGNORED_PROPERTIES.has("http://www.w3.org/2000/01/rdf-schema#subClassOf")).toBe(false);
    expect(IGNORED_PROPERTIES.has("http://www.w3.org/2002/07/owl#equivalentClass")).toBe(false);
  });
});

describe("Immutability invariants", () => {
  test("prevents mutation of exported constants", () => {
    expect(Object.isFrozen(NAMESPACES)).toBe(true);
    expect(Object.isFrozen(ONTOLOGY_CATALOG)).toBe(true);
    expect(Object.isFrozen(IGNORED_PROPERTIES)).toBe(true);

    expect(() => {
      NAMESPACES.NEW_NS = "http://example.org/";
    }).toThrow();

    expect(() => {
      ONTOLOGY_CATALOG["http://example.org/"] = "test.rdf";
    }).toThrow();

    expect(() => {
      IGNORED_PROPERTIES.add("http://example.org/prop");
    }).toThrow();
  });
});
