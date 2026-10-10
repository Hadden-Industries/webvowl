import { createPrefixRepresentationModule as prefixRepresentationModule } from "./util/prefixRepresentationModule.js";
import { namespaces } from "vowl";
import {
  VOWL_EDITOR_DATATYPE_NAMES,
  VOWL_EDITOR_CLASS_TYPES,
  VOWL_EDITOR_CREATABLE_PROPERTY_TYPES,
  DEFAULT_VOWL_EDITOR_PREFIXES,
  DEFAULT_ONTOLOGY_EDITOR_OPTIONS,
} from "./ontologyEditorVocabulary.js";
import {
  DEFAULT_FORCE_LAYOUT_DISTANCES,
  DEFAULT_VISUALIZATION_MODES,
  DEFAULT_VISUALIZATION_FILTERS,
  RENDERED_GRAPH_CONFIGURATION_DEFAULTS,
} from "./visualizationDefaults.js";

function initialOptions(includePickAndPin) {
  return {
    sidebar: "1",
    cd: DEFAULT_FORCE_LAYOUT_DISTANCES.classDistancePx,
    dd: DEFAULT_FORCE_LAYOUT_DISTANCES.datatypeDistancePx,
    editorMode: String(DEFAULT_ONTOLOGY_EDITOR_OPTIONS.isEditorMode),
    filter_datatypes: String(
      DEFAULT_VISUALIZATION_FILTERS.datatypes === "hide",
    ),
    filter_objectProperties: String(
      DEFAULT_VISUALIZATION_FILTERS.objectProperties === "hide",
    ),
    filter_sco: String(DEFAULT_VISUALIZATION_FILTERS.subclasses === "hide"),
    filter_disjoint: String(
      DEFAULT_VISUALIZATION_FILTERS.disjointness === "hide",
    ),
    filter_setOperator: String(
      DEFAULT_VISUALIZATION_FILTERS.setOperators === "hide",
    ),
    mode_dynamic: String(DEFAULT_VISUALIZATION_MODES.dynamicLabelWidth),
    mode_scaling: String(DEFAULT_VISUALIZATION_MODES.nodeScaling),
    mode_compact: String(DEFAULT_VISUALIZATION_MODES.compactNotation),
    mode_colorExt: String(DEFAULT_VISUALIZATION_MODES.colorExternals),
    mode_multiColor: String(
      DEFAULT_VISUALIZATION_MODES.colorExternalsMode === "gradient",
    ),
    ...(includePickAndPin
      ? { mode_pnp: String(DEFAULT_VISUALIZATION_MODES.pickAndPin) }
      : {}),
    debugFeatures: "false",
    rect: Number(
      RENDERED_GRAPH_CONFIGURATION_DEFAULTS.rectangularRepresentation,
    ),
  };
}

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
  const supportedDatatypes = [...VOWL_EDITOR_DATATYPE_NAMES];
  const supportedClasses = [...VOWL_EDITOR_CLASS_TYPES];
  const supportedProperties = [...VOWL_EDITOR_CREATABLE_PROPERTY_TYPES];
  const prefixList = { ...DEFAULT_VOWL_EDITOR_PREFIXES };
  const defaultOptionsConfig = initialOptions(false);

  let defaultClass = DEFAULT_ONTOLOGY_EDITOR_OPTIONS.defaultClass;
  let defaultProperty = DEFAULT_ONTOLOGY_EDITOR_OPTIONS.defaultProperty;
  let defaultDatatype = DEFAULT_ONTOLOGY_EDITOR_OPTIONS.defaultDatatype;
  let baseIri = namespaces.owl;
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
    return initialOptions(true);
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
