import {
  VOWL_EDITOR_CLASS_TYPES,
  VOWL_EDITOR_DATATYPE_NAMES,
  VOWL_EDITOR_PROPERTY_TYPES,
} from "./vowlDocument.js";

export const DEFAULT_ONTOLOGY_EDITOR_OPTIONS = Object.freeze({
  isEditorMode: false,
  defaultClass: "owl:Class",
  defaultDatatype: "rdfs:Literal",
  defaultProperty: "owl:objectProperty",
  useAccuracyHelper: true,
  showDraggerObject: false,
});

export const ONTOLOGY_CREATION_TYPES = Object.freeze({
  supportedClasses: VOWL_EDITOR_CLASS_TYPES,
  supportedDatatypes: VOWL_EDITOR_DATATYPE_NAMES,
  supportedProperties: Object.freeze(
    VOWL_EDITOR_PROPERTY_TYPES.filter(
      (type) => type !== "owl:datatypeProperty",
    ),
  ),
});

function assertRecord(request) {
  if (
    request === null ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    throw new TypeError("Interaction settings must be a plain object.");
  }
}

export function createOntologyEditorOptionsRequest(request) {
  assertRecord(request);
  const types = {
    defaultClass: ONTOLOGY_CREATION_TYPES.supportedClasses,
    defaultDatatype: ONTOLOGY_CREATION_TYPES.supportedDatatypes,
    defaultProperty: ONTOLOGY_CREATION_TYPES.supportedProperties,
  };
  for (const [name, value] of Object.entries(request)) {
    if (!Object.hasOwn(DEFAULT_ONTOLOGY_EDITOR_OPTIONS, name)) {
      throw new TypeError(`Unknown ontology editor option: ${name}.`);
    }
    if (
      types[name] ? !types[name].includes(value) : typeof value !== "boolean"
    ) {
      throw new TypeError(`Invalid ontology editor option: ${name}.`);
    }
  }
  return Object.freeze({ ...request });
}

export function createVisualizationViewportSize(request) {
  assertRecord(request);
  const names = ["widthPx", "heightPx", "occludedLeftWidthPx", "isTouchDevice"];
  for (const name of Object.keys(request)) {
    if (!names.includes(name)) {
      throw new TypeError(`Unknown viewport measurement: ${name}.`);
    }
  }
  const result = { occludedLeftWidthPx: 0, isTouchDevice: false, ...request };
  for (const name of names.slice(0, 3)) {
    if (!Number.isFinite(result[name]) || result[name] < 0) {
      throw new TypeError(`${name} must be a nonnegative finite number.`);
    }
  }
  if (
    result.occludedLeftWidthPx > result.widthPx ||
    typeof result.isTouchDevice !== "boolean"
  ) {
    throw new TypeError("Invalid viewport occlusion or input modality.");
  }
  return Object.freeze(result);
}
