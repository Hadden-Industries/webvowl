export const NAMESPACES = Object.freeze({
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  OWL: "http://www.w3.org/2002/07/owl#",
  DC: "http://purl.org/dc/elements/1.1/",
  DCTERMS: "http://purl.org/dc/terms/"
});

export const ONTOLOGY_CATALOG = Object.freeze({
  "http://purl.org/dc/elements/1.1": "../external/dc.rdf",
  "http://purl.org/dc/terms": "../external/dcterms.rdf",
  "http://purl.org/goodrelations/v1": "../external/goodrelations.owl",
  "http://purl.org/linked-data/cube": "../external/cube.rdf",
  "http://purl.org/ontology/bibo": "../external/bibo.rdf.xml",
  "http://purl.org/vocab/vann": "../external/vann-vocab-20100607.rdf",
  "http://rdfs.org/ns/void": "../external/void.ttl",
  "http://rdfs.org/sioc/ns": "../external/sioc.rdf",
  "http://schema.org": "../external/schemaorg.owl",
  "http://usefulinc.com/ns/doap": "../external/doap.rdf",
  "http://www.w3.org/2003/01/geo/wgs84_pos": "../external/wgs84_pos.rdf",
  "http://www.w3.org/2004/02/skos/core": "../external/skos.rdf",
  "http://www.w3.org/2006/time": "../external/time.rdf",
  "http://www.w3.org/ns/dcat": "../external/dcat3.rdf",
  "http://www.w3.org/ns/org": "../external/org.rdf",
  "http://www.w3.org/ns/prov": "../external/prov.owl",
  "http://www.w3.org/ns/sosa": "../external/sosa.ttl",
  "http://www.w3.org/ns/ssn": "../external/ssn.ttl",
  "http://www.w3.org/ns/time/gregorian": "../external/time-gregorian.rdf",
  "http://xmlns.com/foaf/0.1": "../external/foaf.rdf",
  "https://schema.org": "../external/schemaorg.owl"
});

const ignoredSet = new Set([
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2000/01/rdf-schema#comment",
  "http://www.w3.org/2000/01/rdf-schema#seeAlso",
  "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
  "http://www.w3.org/2002/07/owl#versionInfo",
  "http://www.w3.org/2002/07/owl#priorVersion",
  "http://www.w3.org/2002/07/owl#backwardCompatibleWith",
  "http://www.w3.org/2002/07/owl#incompatibleWith"
]);

// Prevent mutations on the Set instance methods to make it truly immutable
ignoredSet.add = function() {
  throw new TypeError("Cannot add to a frozen Set");
};
ignoredSet.delete = function() {
  throw new TypeError("Cannot delete from a frozen Set");
};
ignoredSet.clear = function() {
  throw new TypeError("Cannot clear a frozen Set");
};

export const IGNORED_PROPERTIES = Object.freeze(ignoredSet);
