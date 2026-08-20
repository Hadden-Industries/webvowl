const prefixRepresentationModule = require("./util/prefixRepresentationModule");

module.exports = function createOptions() {
  const options = {};
  let data,
    graphContainerSelector,
    classDistance = 200,
    datatypeDistance = 120,
    loopDistance = 150,
    charge = -500,
    gravity = 0.025,
    linkStrength = 1,
    height = 600,
    width = 800,
    selectionModules = [],
    filterModules = [],
    minMagnification = 0.01,
    maxMagnification = 4,
    compactNotation = false,
    dynamicLabelWidth = true,
    // some filters
    literalFilter,
    // menus
    graphObject,
    datatypeFilter,
    focuserModule;
  let colorExternalsModule;
  let compactNotationModule;
  let nodeScalingModule;
  let objectPropertyFilter;
  let subclassFilter;
  let setOperatorFilter;
  let maxLabelWidth = 120;
  const metadataObject = {};
  let generalOntologyMetaData = {};
  let disjointPropertyFilter;
  let rectangularRep = false;
  let warningModule;
  let prefixModule = prefixRepresentationModule({ options: () => options });
  let drawPropertyDraggerOnHover = true;
  let showDraggerObject = false;
  let directInputModule;
  let scaleNodesByIndividuals = true;
  let useAccuracyHelper = true;
  let showRenderingStatistic = true;
  let showInputModality = false;
  let hideDebugOptions = true;
  let nodeDegreeFilter;
  let debugMenu;
  let searchMenu;
  let exportMenu;
  let gravityMenu;
  let filterMenu;
  let modeMenu;
  let pauseMenu;
  let resetMenu;
  let ontologyMenu;
  let navigationMenu;
  let zoomSlider;
  let sidebar;
  let leftSidebar;
  let editSidebar;
  let loadingModule;
  let pickAndPinModule;

  const supportedDatatypes = [
    "rdfs:Literal",
    "xsd:boolean",
    "xsd:double",
    "xsd:integer",
    "xsd:string",
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

  options.clearMetaObject = function () {
    generalOntologyMetaData = {};
  };
  options.clearGeneralMetaObject = function () {
    generalOntologyMetaData = {};
  };

  options.debugMenu = function (val) {
    if (!arguments.length) {
      return debugMenu;
    }
    debugMenu = val;
  };

  options.getHideDebugFeatures = function () {
    return hideDebugOptions;
  };
  options.executeHiddenDebugFeatures = function () {
    hideDebugOptions = !hideDebugOptions;
    d3.selectAll(".debugOption").classed("hidden", hideDebugOptions);
    if (hideDebugOptions === false) {
      graphObject.setForceTickFunctionWithFPS();
    } else {
      graphObject.setDefaultForceTickFunction();
    }
    if (debugMenu) {
      debugMenu.updateSettings();
    }
    options.setHideDebugFeaturesForDefaultObject(hideDebugOptions);
  };

  options.addOrUpdateGeneralObjectEntry = function (property, value) {
    // If updating the ontology IRI, ensure it is a valid absolute URL/URI
    if (property === "iri") {
      if (prefixModule.validURL(value) === false) {
        if (warningModule && typeof warningModule.showWarning === "function") {
          warningModule.showWarning(
            "Invalid Ontology IRI",
            "Input IRI does not represent an URL",
            "Restoring previous IRI for ontology",
            1,
            false,
          );
        }
        return false;
      }
    }
    generalOntologyMetaData[property] = value;
    return true;
  };

  options.getGeneralMetaObjectProperty = function (property) {
    if (
      Object.prototype.hasOwnProperty.call(generalOntologyMetaData, property)
    ) {
      return generalOntologyMetaData[property];
    }
  };

  options.getGeneralMetaObject = function () {
    return generalOntologyMetaData;
  };

  options.addOrUpdateMetaObjectEntry = function (property, value) {
    if (Object.prototype.hasOwnProperty.call(metadataObject, property)) {
      metadataObject[property] = value;
    } else {
      metadataObject[property] = value;
    }
  };

  options.getMetaObjectProperty = function (property) {
    if (Object.prototype.hasOwnProperty.call(metadataObject, property)) {
      return metadataObject[property];
    }
  };
  options.getMetaObject = function () {
    return metadataObject;
  };

  options.prefixList = function () {
    return prefixList;
  };
  options.addPrefix = function (prefix, url) {
    prefixList[prefix] = url;
  };

  options.updatePrefix = function (oldPrefix, newPrefix, oldURL, newURL) {
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
      if (warningModule && typeof warningModule.showWarning === "function") {
        warningModule.showWarning(
          "Invalid Prefix IRI",
          "Input IRI does not represent an IRI",
          "You should enter a valid IRI in form of a URL",
          1,
          false,
        );
      }
      return false;
    }
    if (oldPrefix !== newPrefix && prefixModule.validURL(newURL) === true) {
      // Check if new prefix name already exists
      if (Object.prototype.hasOwnProperty.call(prefixList, newPrefix)) {
        if (warningModule && typeof warningModule.showWarning === "function") {
          warningModule.showWarning(
            "Prefix Already Exist",
            "Prefix: " + newPrefix + " is already defined",
            "You should use an other one",
            1,
            false,
          );
        }
        return false;
      }
      options.removePrefix(oldPrefix);
      options.addPrefix(newPrefix, newURL);

      return true;
    }

    if (prefixModule.validURL(newURL) === false) {
      if (warningModule && typeof warningModule.showWarning === "function") {
        warningModule.showWarning(
          "Invalid Prefix IRI",
          "Input IRI does not represent an URL",
          "You should enter a valid URL",
          1,
          false,
        );
      }
    }
    return false;
  };

  options.removePrefix = function (prefix) {
    delete prefixList[prefix];
  };

  options.supportedDatatypes = function () {
    return supportedDatatypes;
  };
  options.supportedClasses = function () {
    return supportedClasses;
  };
  options.supportedProperties = function () {
    return supportedProperties;
  };

  options.datatypeFilter = function (val) {
    if (!arguments.length) {
      return datatypeFilter;
    }
    datatypeFilter = val;
  };

  options.showDraggerObject = function (val) {
    if (!arguments.length) {
      return showDraggerObject;
    }
    showDraggerObject = val;
  };
  options.useAccuracyHelper = function (val) {
    if (!arguments.length) {
      return useAccuracyHelper;
    }
    useAccuracyHelper = val;
  };
  options.showAccuracyHelper = function (val) {
    if (!arguments.length) {
      return options.showDraggerObject();
    }
    options.showDraggerObject(val);
  };
  options.showRenderingStatistic = function (val) {
    if (!arguments.length) {
      return showRenderingStatistic;
    }
    showRenderingStatistic = val;
  };
  options.showInputModality = function (val) {
    if (!arguments.length) {
      return showInputModality;
    }
    showInputModality = val;
  };

  options.graphObject = function (val) {
    if (!arguments.length) {
      return graphObject;
    }
    graphObject = val;
  };

  options.drawPropertyDraggerOnHover = function (val) {
    if (!arguments.length) {
      return drawPropertyDraggerOnHover;
    }
    drawPropertyDraggerOnHover = val;
  };

  options.warningModule = function (val) {
    if (!arguments.length) {
      return warningModule;
    }
    warningModule = val;
  };
  options.directInputModule = function (val) {
    if (!arguments.length) {
      return directInputModule;
    }
    directInputModule = val;
  };
  options.prefixModule = function (val) {
    if (!arguments.length) {
      return prefixModule;
    }
    prefixModule = val;
  };

  options.focuserModule = function (val) {
    if (!arguments.length) {
      return focuserModule;
    }
    focuserModule = val;
  };

  options.colorExternalsModule = function (val) {
    if (!arguments.length) {
      return colorExternalsModule;
    }
    colorExternalsModule = val;
  };
  options.compactNotationModule = function (val) {
    if (!arguments.length) {
      return compactNotationModule;
    }
    compactNotationModule = val;
  };
  options.nodeScalingModule = function ( val ){
    if ( !arguments.length ) {return nodeScalingModule;}
    nodeScalingModule = val;
  };

  options.maxLabelWidth = function (val) {
    if (!arguments.length) {
      return maxLabelWidth;
    }
    maxLabelWidth = val;
  };
  options.objectPropertyFilter = function (val) {
    if (!arguments.length) {
      return objectPropertyFilter;
    }
    objectPropertyFilter = val;
  };
  options.disjointPropertyFilter = function (val) {
    if (!arguments.length) {
      return disjointPropertyFilter;
    }
    disjointPropertyFilter = val;
  };
  options.subclassFilter = function (val) {
    if (!arguments.length) {
      return subclassFilter;
    }
    subclassFilter = val;
  };
  options.setOperatorFilter = function (val) {
    if (!arguments.length) {
      return setOperatorFilter;
    }
    setOperatorFilter = val;
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

  options.initialConfig = function () {
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

  options.setEditorModeForDefaultObject = function (val) {
    defaultOptionsConfig.editorMode = String(val);
  };
  options.setHideDebugFeaturesForDefaultObject = function (val) {
    defaultOptionsConfig.debugFeatures = String(!val);
  };

  let defaultClass = "owl:Class";
  let defaultProperty = "owl:objectProperty";
  let defaultDatatype = "rdfs:Literal";
  let baseIri = "http://www.w3.org/2002/07/owl#";

  options.defaultClass = function (val) {
    if (!arguments.length) {
      return defaultClass;
    }
    defaultClass = val;
  };
  options.defaultProperty = function (val) {
    if (!arguments.length) {
      return defaultProperty;
    }
    defaultProperty = val;
  };
  options.defaultDatatype = function (val) {
    if (!arguments.length) {
      return defaultDatatype;
    }
    defaultDatatype = val;
  };
  options.baseIri = function (val) {
    if (!arguments.length) {
      if (generalOntologyMetaData && generalOntologyMetaData.iri) {
        return generalOntologyMetaData.iri;
      }
      return baseIri;
    }
    baseIri = val;
  };

  options.rectangularRepresentation = function (val) {
    if (!arguments.length) {
      return rectangularRep;
    } else {
      const intVal = parseInt(val);
      if (intVal === 0) {
        rectangularRep = false;
      } else {
        rectangularRep = true;
      }
    }
  };

  options.dynamicLabelWidth = function (val) {
    if (!arguments.length) {
      return dynamicLabelWidth;
    } else {
      dynamicLabelWidth = val;
    }
  };

  options.charge = function (p) {
    if (!arguments.length) {
      return charge;
    }
    charge = +p;
    return options;
  };

  options.classDistance = function (p) {
    if (!arguments.length) {
      return classDistance;
    }
    classDistance = +p;
    return options;
  };

  options.compactNotation = function (p) {
    if (!arguments.length) {
      return compactNotation;
    }
    compactNotation = p;
    return options;
  };

  options.data = function (p) {
    if (!arguments.length) {
      return data;
    }
    data = p;
    return options;
  };

  options.datatypeDistance = function (p) {
    if (!arguments.length) {
      return datatypeDistance;
    }
    datatypeDistance = +p;
    return options;
  };

  options.filterModules = function (p) {
    if (!arguments.length) {
      return filterModules;
    }
    filterModules = p;
    return options;
  };

  options.graphContainerSelector = function (p) {
    if (!arguments.length) {
      return graphContainerSelector;
    }
    graphContainerSelector = p;
    return options;
  };

  options.gravity = function (p) {
    if (!arguments.length) {
      return gravity;
    }
    gravity = +p;
    return options;
  };

  options.height = function (p) {
    if (!arguments.length) {
      return height;
    }
    height = +p;
    return options;
  };

  options.linkStrength = function (p) {
    if (!arguments.length) {
      return linkStrength;
    }
    linkStrength = +p;
    return options;
  };

  options.loopDistance = function (p) {
    if (!arguments.length) {
      return loopDistance;
    }
    loopDistance = p;
    return options;
  };

  options.minMagnification = function (p) {
    if (!arguments.length) {
      return minMagnification;
    }
    minMagnification = +p;
    return options;
  };

  options.maxMagnification = function (p) {
    if (!arguments.length) {
      return maxMagnification;
    }
    maxMagnification = +p;
    return options;
  };

  options.scaleNodesByIndividuals = function (p) {
    if (!arguments.length) {
      return scaleNodesByIndividuals;
    }
    scaleNodesByIndividuals = p;
    return options;
  };

  options.selectionModules = function (p) {
    if (!arguments.length) {
      return selectionModules;
    }
    selectionModules = p;
    return options;
  };

  options.width = function (p) {
    if (!arguments.length) {
      return width;
    }
    width = +p;
    return options;
  };

  options.literalFilter = function (p) {
    if (!arguments.length) {
      return literalFilter;
    }
    literalFilter = p;
    return options;
  };
  options.nodeDegreeFilter = function (p) {
    if (!arguments.length) {
      return nodeDegreeFilter;
    }
    nodeDegreeFilter = p;
    return options;
  };

  options.searchMenu = function (val) {
    if (!arguments.length) {
      return searchMenu;
    }
    searchMenu = val;
  };
  options.exportMenu = function (val) {
    if (!arguments.length) {
      return exportMenu;
    }
    exportMenu = val;
  };
  options.gravityMenu = function (val) {
    if (!arguments.length) {
      return gravityMenu;
    }
    gravityMenu = val;
  };
  options.filterMenu = function (val) {
    if (!arguments.length) {
      return filterMenu;
    }
    filterMenu = val;
  };
  options.modeMenu = function (val) {
    if (!arguments.length) {
      return modeMenu;
    }
    modeMenu = val;
  };
  options.pausedMenu = function (val) {
    if (!arguments.length) {
      return pauseMenu;
    }
    pauseMenu = val;
  };
  options.resetMenu = function (val) {
    if (!arguments.length) {
      return resetMenu;
    }
    resetMenu = val;
  };
  options.ontologyMenu = function (val) {
    if (!arguments.length) {
      return ontologyMenu;
    }
    ontologyMenu = val;
  };
  options.navigationMenu = function (val) {
    if (!arguments.length) {
      return navigationMenu;
    }
    navigationMenu = val;
  };
  options.zoomSlider = function (val) {
    if (!arguments.length) {
      return zoomSlider;
    }
    zoomSlider = val;
  };
  options.sidebar = function (val) {
    if (!arguments.length) {
      return sidebar;
    }
    sidebar = val;
  };
  options.leftSidebar = function (val) {
    if (!arguments.length) {
      return leftSidebar;
    }
    leftSidebar = val;
  };
  options.editSidebar = function (val) {
    if (!arguments.length) {
      return editSidebar;
    }
    editSidebar = val;
  };
  options.loadingModule = function (val) {
    if (!arguments.length) {
      return loadingModule;
    }
    loadingModule = val;
  };
  options.pickAndPinModule = function (val) {
    if (!arguments.length) {
      return pickAndPinModule;
    }
    pickAndPinModule = val;
  };

  options.setHideDebugFeatures = function (val) {
    hideDebugOptions = val;
  };
  let globalDOF = -1;
  options.setGlobalDOF = function (val) {
    if (!arguments.length) {
      return globalDOF;
    }
    globalDOF = val;
  };

  return options;
};
