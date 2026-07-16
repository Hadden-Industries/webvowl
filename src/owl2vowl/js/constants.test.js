import { NAMESPACES, ONTOLOGY_CATALOG, IGNORED_PROPERTIES } from "./constants.js";

describe("constants.js structure and values", () => {
  test("NAMESPACES is an object with correct entries", () => {
    expect(typeof NAMESPACES).toBe("object");
    expect(NAMESPACES).not.toBeNull();
    expect(NAMESPACES.RDF).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    expect(NAMESPACES.RDFS).toBe("http://www.w3.org/2000/01/rdf-schema#");
    expect(NAMESPACES.OWL).toBe("http://www.w3.org/2002/07/owl#");
    expect(NAMESPACES.DC).toBe("http://purl.org/dc/elements/1.1/");
    expect(NAMESPACES.DCTERMS).toBe("http://purl.org/dc/terms/");
  });

  test("ONTOLOGY_CATALOG is an object with correct entries", () => {
    expect(typeof ONTOLOGY_CATALOG).toBe("object");
    expect(ONTOLOGY_CATALOG).not.toBeNull();
    expect(ONTOLOGY_CATALOG["http://purl.org/dc/elements/1.1"]).toBe("../ontology/external/dc.rdf");
    expect(ONTOLOGY_CATALOG["https://schema.org"]).toBe("../ontology/external/schemaorg.owl");
    expect(Object.keys(ONTOLOGY_CATALOG).length).toBe(25);
  });

  test("IGNORED_PROPERTIES is a Set with correct entries", () => {
    expect(IGNORED_PROPERTIES).toBeInstanceOf(Set);
    expect(IGNORED_PROPERTIES.has("http://www.w3.org/2000/01/rdf-schema#label")).toBe(true);
    expect(IGNORED_PROPERTIES.has("http://www.w3.org/2002/07/owl#incompatibleWith")).toBe(true);
    expect(IGNORED_PROPERTIES.size).toBe(8);
  });
});

describe("constants.js immutability (frozen)", () => {
  test("NAMESPACES is frozen", () => {
    expect(Object.isFrozen(NAMESPACES)).toBe(true);
    expect(() => {
      NAMESPACES.NEW_NS = "http://example.org/";
    }).toThrow();
  });

  test("ONTOLOGY_CATALOG is frozen", () => {
    expect(Object.isFrozen(ONTOLOGY_CATALOG)).toBe(true);
    expect(() => {
      ONTOLOGY_CATALOG["http://example.org/"] = "test.rdf";
    }).toThrow();
  });

  test("IGNORED_PROPERTIES is frozen and immutable", () => {
    expect(Object.isFrozen(IGNORED_PROPERTIES)).toBe(true);
    
    // Check that adding throws
    expect(() => {
      IGNORED_PROPERTIES.add("http://example.org/prop");
    }).toThrow();

    // Check that deleting throws
    expect(() => {
      IGNORED_PROPERTIES.delete("http://www.w3.org/2000/01/rdf-schema#label");
    }).toThrow();

    // Check that clearing throws
    expect(() => {
      IGNORED_PROPERTIES.clear();
    }).toThrow();

    // Check that size didn't change
    expect(IGNORED_PROPERTIES.size).toBe(8);
  });
});
