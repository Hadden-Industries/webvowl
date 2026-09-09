import { createPrefixRepresentationModule as prefixRepresentationModule } from "./util/prefixRepresentationModule.js";

// Ontology and application state: prefixes, ontology metadata, supported
// element types, default elements, and editor configuration. Split out of
// the retired options god-object during the D3 cutover.
export function createOntologyEditingState() {
  const ontologyEditingState = {};

  // Settings-level warnings travel through a caller-supplied channel; the
  // settings object holds no presentation module of its own.
  let raiseSettingsWarning = () => undefined;

  // some filters
  const metadataObject = {};
  let generalOntologyMetaData = {};
  let prefixModule = prefixRepresentationModule({
    options: () => ontologyEditingState,
  });
  let hideDebugOptions = true;
  let onDebugFeatureVisibilityChanged = () => undefined;
  // Sourced from the W3C OWL 2 Specification (https://www.w3.org/TR/owl2-syntax/#Real_Numbers.2C_Decimal_Numbers.2C_and_Integers)
  const supportedDatatypes = [
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
  ];
  const supportedClasses = ["owl:Thing", "owl:Class", "owl:DeprecatedClass"];
  const supportedProperties = [
    "owl:objectProperty",
    "rdfs:subClassOf",
    "owl:disjointWith",
    "owl:allValuesFrom",
    "owl:someValuesFrom",
  ];
  const prefixList = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    owl: "http://www.w3.org/2002/07/owl#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    dc: "http://purl.org/dc/elements/1.1/#",
    xml: "http://www.w3.org/XML/1998/namespace",
  };

  const defaultOptionsConfig = {};
  defaultOptionsConfig.sidebar = "1";
  defaultOptionsConfig.doc = -1;
  defaultOptionsConfig.cd = 200;
  defaultOptionsConfig.dd = 120;
  defaultOptionsConfig.editorMode = "false";
  defaultOptionsConfig.filter_datatypes = "false";
  defaultOptionsConfig.filter_objectProperties = "false";
  defaultOptionsConfig.filter_sco = "false";
  defaultOptionsConfig.filter_disjoint = "true";
  defaultOptionsConfig.filter_setOperator = "false";
  defaultOptionsConfig.mode_dynamic = "true";
  defaultOptionsConfig.mode_scaling = "true";
  defaultOptionsConfig.mode_compact = "false";
  defaultOptionsConfig.mode_colorExt = "true";
  defaultOptionsConfig.mode_multiColor = "false";
  defaultOptionsConfig.debugFeatures = "false";
  defaultOptionsConfig.rect = 0;

  let defaultClass = "owl:Class";
  let defaultProperty = "owl:objectProperty";
  let defaultDatatype = "rdfs:Literal";
  let baseIri = "http://www.w3.org/2002/07/owl#";
  // Presentation supplies the channel that surfaces a rejected setting; the
  // settings object never holds a presentation module itself.

  ontologyEditingState.clearMetaObject = function () {
    generalOntologyMetaData = {};
  };
  ontologyEditingState.clearGeneralMetaObject = function () {
    generalOntologyMetaData = {};
  };
  ontologyEditingState.getHideDebugFeatures = function () {
    return hideDebugOptions;
  };
  ontologyEditingState.setDebugFeaturesVisible = function (isVisible) {
    if (typeof isVisible !== "boolean") {
      throw new TypeError("Debug feature visibility must be a Boolean.");
    }
    hideDebugOptions = !isVisible;
    for (const debugOptionElement of globalThis.document.querySelectorAll(
      ".debugOption",
    )) {
      debugOptionElement.classList.toggle("hidden", hideDebugOptions);
    }
    // The renderer and the debug menu are notified through injected callbacks
    // so this state holds neither a graph nor a menu.
    onDebugFeatureVisibilityChanged(hideDebugOptions);
    ontologyEditingState.setHideDebugFeaturesForDefaultObject(hideDebugOptions);
  };
  ontologyEditingState.addOrUpdateGeneralObjectEntry = function (
    property,
    value,
  ) {
    // If updating the ontology IRI, ensure it is a valid absolute URL/URI
    if (property === "iri") {
      if (prefixModule.validURL(value) === false) {
        raiseSettingsWarning(
          "INVALID_ONTOLOGY_IRI",
          "Input IRI does not represent a URL.",
        );
        return false;
      }
    }
    generalOntologyMetaData[property] = value;
    return true;
  };
  ontologyEditingState.getGeneralMetaObjectProperty = function (property) {
    if (
      Object.prototype.hasOwnProperty.call(generalOntologyMetaData, property)
    ) {
      return generalOntologyMetaData[property];
    }
  };
  ontologyEditingState.getGeneralMetaObject = function () {
    return generalOntologyMetaData;
  };
  ontologyEditingState.addOrUpdateMetaObjectEntry = function (property, value) {
    if (Object.prototype.hasOwnProperty.call(metadataObject, property)) {
      metadataObject[property] = value;
    } else {
      metadataObject[property] = value;
    }
  };
  ontologyEditingState.getMetaObjectProperty = function (property) {
    if (Object.prototype.hasOwnProperty.call(metadataObject, property)) {
      return metadataObject[property];
    }
  };
  ontologyEditingState.getMetaObject = function () {
    return metadataObject;
  };
  ontologyEditingState.prefixList = function () {
    return prefixList;
  };
  ontologyEditingState.addPrefix = function (prefix, url) {
    prefixList[prefix] = url;
  };
  ontologyEditingState.updatePrefix = function (
    oldPrefix,
    newPrefix,
    oldURL,
    newURL,
  ) {
    if (oldPrefix === newPrefix && oldURL === newURL) {
      // Nothing to update
      return true;
    }
    if (
      oldPrefix === newPrefix &&
      oldURL !== newURL &&
      prefixModule.validURL(newURL) === true
    ) {
      prefixList[oldPrefix] = newURL;
      return true;
    } else if (
      oldPrefix === newPrefix &&
      oldURL !== newURL &&
      prefixModule.validURL(newURL) === false
    ) {
      raiseSettingsWarning(
        "PREFIX_SETTING_REJECTED",
        "Input IRI does not represent an IRI",
      );
      return false;
    }
    if (oldPrefix !== newPrefix && prefixModule.validURL(newURL) === true) {
      // Check if new prefix name already exists
      if (Object.prototype.hasOwnProperty.call(prefixList, newPrefix)) {
        raiseSettingsWarning(
          "PREFIX_SETTING_REJECTED",
          "Prefix: " + newPrefix + " is already defined",
        );
        return false;
      }
      ontologyEditingState.removePrefix(oldPrefix);
      ontologyEditingState.addPrefix(newPrefix, newURL);

      return true;
    }

    if (prefixModule.validURL(newURL) === false) {
      raiseSettingsWarning(
        "PREFIX_SETTING_REJECTED",
        "Input IRI does not represent an URL",
      );
    }
    return false;
  };
  ontologyEditingState.removePrefix = function (prefix) {
    delete prefixList[prefix];
  };
  ontologyEditingState.supportedDatatypes = function () {
    return supportedDatatypes;
  };
  ontologyEditingState.supportedClasses = function () {
    return supportedClasses;
  };
  ontologyEditingState.supportedProperties = function () {
    return supportedProperties;
  };
  ontologyEditingState.prefixModule = function (val) {
    if (!arguments.length) {
      return prefixModule;
    }
    prefixModule = val;
  };
  ontologyEditingState.initialConfig = function () {
    const initCfg = {};
    initCfg.sidebar = "1";
    initCfg.doc = -1;
    initCfg.cd = 200;
    initCfg.dd = 120;
    initCfg.editorMode = "false";
    initCfg.filter_datatypes = "false";
    initCfg.filter_objectProperties = "false";
    initCfg.filter_sco = "false";
    initCfg.filter_disjoint = "true";
    initCfg.filter_setOperator = "false";
    initCfg.mode_dynamic = "true";
    initCfg.mode_scaling = "true";
    initCfg.mode_compact = "false";
    initCfg.mode_colorExt = "true";
    initCfg.mode_multiColor = "false";
    initCfg.mode_pnp = "false";
    initCfg.debugFeatures = "false";
    initCfg.rect = 0;
    return initCfg;
  };
  ontologyEditingState.setEditorModeForDefaultObject = function (val) {
    defaultOptionsConfig.editorMode = String(val);
  };
  ontologyEditingState.setHideDebugFeaturesForDefaultObject = function (val) {
    defaultOptionsConfig.debugFeatures = String(!val);
  };
  ontologyEditingState.defaultClass = function (val) {
    if (!arguments.length) {
      return defaultClass;
    }
    defaultClass = val;
  };
  ontologyEditingState.defaultProperty = function (val) {
    if (!arguments.length) {
      return defaultProperty;
    }
    defaultProperty = val;
  };
  ontologyEditingState.defaultDatatype = function (val) {
    if (!arguments.length) {
      return defaultDatatype;
    }
    defaultDatatype = val;
  };
  ontologyEditingState.baseIri = function (val) {
    if (!arguments.length) {
      if (generalOntologyMetaData && generalOntologyMetaData.iri) {
        return generalOntologyMetaData.iri;
      }
      return baseIri;
    }
    baseIri = val;
  };
  ontologyEditingState.setSettingsWarningChannel = function (nextChannel) {
    raiseSettingsWarning = nextChannel;
  };

  ontologyEditingState.setDebugFeatureVisibilityListener = function (
    nextListener,
  ) {
    onDebugFeatureVisibilityChanged = nextListener;
  };

  return ontologyEditingState;
}
