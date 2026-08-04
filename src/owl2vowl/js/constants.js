export const EXTERNAL_ONTOLOGY_BASE_URL =
  "https://haddenindustries.com/ontology/external/";

const externalOntology = filename =>
  `${EXTERNAL_ONTOLOGY_BASE_URL}${filename}`;

export const NAMESPACES = Object.freeze({
  RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  RDFS: "http://www.w3.org/2000/01/rdf-schema#",
  OWL: "http://www.w3.org/2002/07/owl#",
  DC: "http://purl.org/dc/elements/1.1/",
  DCTERMS: "http://purl.org/dc/terms/"
});

export const ONTOLOGY_CATALOG = Object.freeze({
  "http://blankdots.com/open/personasonto.owl": externalOntology("personasonto.owl"),
  "http://bubb.ghb.fh-furtwangen.de/TagOnt/tagont.owl": externalOntology("tagont.owl"),
  "http://geovocab.org/spatial": externalOntology("spatial.rdf"),
  "http://ontovibe.visualdataweb.org": externalOntology("BenchmarkOntology.ttl"),
  "http://ontovibe.visualdataweb.org/cardinalities": externalOntology("ontovibe_cardinalities.ttl"),
  "http://ontovibe.visualdataweb.org/imported": externalOntology("BenchmarkOntologyModule.ttl"),
  "http://protege.stanford.edu/plugins/owl/dc/protege-dc.owl": externalOntology("protege-dc.owl"),
  "http://purl.org/dc/dcmitype": externalOntology("dcmitype.rdf"),
  "http://purl.org/dc/elements/1.1": externalOntology("dc.rdf"),
  "http://purl.org/dc/terms": externalOntology("dcterms.rdf"),
  "http://purl.org/goodrelations/v1": externalOntology("goodrelations.owl"),
  "http://purl.org/linked-data/cube": externalOntology("cube.rdf"),
  "http://purl.org/muto/core": externalOntology("muto.rdf"),
  "http://purl.org/ontology/bibo": externalOntology("bibo.rdf.xml"),
  "http://purl.org/ontology/mo/": externalOntology("musicontology.rdfs"),
  "http://purl.org/vocab/vann": externalOntology("vann-vocab-20100607.rdf"),
  "http://rdf.vis.uni-stuttgart.de/stackexchange": externalOntology("StackExchange.ttl"),
  "http://rdfs.org/ns/void": externalOntology("void.ttl"),
  "http://rdfs.org/sioc/ns": externalOntology("sioc.rdf"),
  "http://schema.org": externalOntology("schemaorg.owl"),
  "http://usefulinc.com/ns/doap": externalOntology("doap.rdf"),
  "http://webvowl.steffen-lohmann.de/ontobench-1.1.0-SNAPSHOT/ontology/1": externalOntology("fullontobench.ttl"),
  "http://webvowl.steffen-lohmann.de/ontobench-1.1.0-SNAPSHOT/ontology/39": externalOntology("allvalues.ttl"),
  "http://webvowl.steffen-lohmann.de/ontology/1": externalOntology("full_ontobench_test.ttl"),
  "http://www.cadmos.cirma.unito.it/drammar/2012/4/drammar.owl": externalOntology("Drammar_NunnaryScene_Optimized_Rules.owl"),
  "http://www.ics.forth.gr/isl/MarineTLO/v3/marinetlo.owl": externalOntology("marinetlo.owl"),
  "http://www.ics.forth.gr/isl/ontology/iMarineTLO": externalOntology("imarinetlo.owl"),
  "http://www.mindswap.org/2003/owl/foaf": externalOntology("foaf.rdf"),
  "http://www.w3.org/2003/01/geo/wgs84_pos": externalOntology("wgs84_pos.rdf"),
  "http://www.w3.org/2004/02/skos/core": externalOntology("skos.rdf"),
  "http://www.w3.org/2006/time": externalOntology("time.rdf"),
  "http://www.w3.org/TR/2003/PR-owl-guide-20031209/food": externalOntology("food.rdf"),
  "http://www.w3.org/TR/2003/PR-owl-guide-20031209/wine": externalOntology("wine.rdf"),
  "http://www.w3.org/ns/dcat": externalOntology("dcat3.rdf"),
  "http://www.w3.org/ns/org": externalOntology("org.rdf"),
  "http://www.w3.org/ns/prov": externalOntology("prov.owl"),
  "http://www.w3.org/ns/prov-o": "https://raw.githubusercontent.com/w3c/ns/refs/heads/main/prov-o.rdf",
  "http://www.w3.org/ns/sosa": externalOntology("sosa.ttl"),
  "http://www.w3.org/ns/ssn": externalOntology("ssn.ttl"),
  "http://www.w3.org/ns/time/gregorian": externalOntology("time-gregorian.ttl"),
  "http://xmlns.com/foaf/0.1": externalOntology("foaf.rdf"),
  "https://schema.org": externalOntology("schemaorg.owl"),
  "https://www.geonames.org/ontology": externalOntology("ontology_v3.3.rdf")
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
