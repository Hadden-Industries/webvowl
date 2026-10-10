import { namespaces } from "vowl";
import { DEFAULT_RENDERER_INTERACTION_SETTINGS } from "./visualizationDefaults.js";

export const VOWL_EDITOR_CLASS_TYPES = Object.freeze([
  "owl:Thing",
  "owl:Class",
  "owl:DeprecatedClass",
]);
export const VOWL_EDITOR_PROPERTY_TYPES = Object.freeze([
  "owl:objectProperty",
  "rdfs:subClassOf",
  "owl:disjointWith",
  "owl:allValuesFrom",
  "owl:someValuesFrom",
  "owl:datatypeProperty",
]);
export const VOWL_EDITOR_CREATABLE_PROPERTY_TYPES = Object.freeze(
  VOWL_EDITOR_PROPERTY_TYPES.filter((type) => type !== "owl:datatypeProperty"),
);
export const VOWL_EDITOR_DATATYPE_NAMES = Object.freeze([
  "rdfs:Literal",
  "owl:real",
  "owl:rational",
  "xsd:decimal",
  "xsd:integer",
  "xsd:nonNegativeInteger",
  "xsd:nonPositiveInteger",
  "xsd:positiveInteger",
  "xsd:negativeInteger",
  "xsd:long",
  "xsd:int",
  "xsd:short",
  "xsd:byte",
  "xsd:unsignedLong",
  "xsd:unsignedInt",
  "xsd:unsignedShort",
  "xsd:unsignedByte",
  "xsd:boolean",
  "xsd:double",
  "xsd:float",
  "xsd:string",
  "xsd:dateTime",
  "undefined",
]);

export const DEFAULT_VOWL_EDITOR_PREFIXES = Object.freeze({
  rdf: namespaces.rdf,
  rdfs: namespaces.rdfs,
  owl: namespaces.owl,
  xsd: namespaces.xsd,
  // Preserve the legacy editor spelling, distinct from the DC terms namespace.
  dc: `${namespaces.dc}#`,
  xml: namespaces.xml,
});

export const DEFAULT_ONTOLOGY_EDITOR_OPTIONS = Object.freeze({
  isEditorMode: false,
  defaultClass: "owl:Class",
  defaultDatatype: "rdfs:Literal",
  defaultProperty: "owl:objectProperty",
  useAccuracyHelper: DEFAULT_RENDERER_INTERACTION_SETTINGS.useAccuracyHelper,
  showDraggerObject: DEFAULT_RENDERER_INTERACTION_SETTINGS.showDraggerObject,
});
