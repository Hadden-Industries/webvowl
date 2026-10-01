/** Proposed identities from D6; publication/freeze is intentionally external to bytes. */
export const profiles = Object.freeze({
  structuralContent:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  artifact:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1",
});

export const categories = Object.freeze({
  subjects: "s",
  roles: "r",
  expressions: "x",
  constructs: "c",
  occurrences: "o",
});
export const namespaces = Object.freeze({
  owl: "http://www.w3.org/2002/07/owl#",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  mapping: "https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#",
});
