// Renderer-owned settings: force and dimension parameters, graph style
// choices, and the filter and selection registries the renderer drives.
// Split out of the retired options god-object during the D3 cutover.
import {
  RENDERED_GRAPH_CONFIGURATION_DEFAULTS as defaults,
  DEFAULT_RENDERER_INTERACTION_SETTINGS as interactionDefaults,
} from "../../../shared/js/visualizationDefaults.js";
export function createRenderedGraphSettings() {
  const renderedGraphSettings = {};

  // Settings-level warnings travel through a caller-supplied channel; the
  // settings object holds no presentation module of its own.
  let data,
    graphContainerElement,
    classDistance = defaults.classDistance,
    datatypeDistance = defaults.datatypeDistance,
    loopDistance = defaults.loopDistance,
    charge = defaults.charge,
    gravity = defaults.gravity,
    linkStrength = defaults.linkStrength,
    height = defaults.heightPx,
    width = defaults.widthPx,
    filterModules = [],
    minMagnification = defaults.minMagnification,
    maxMagnification = defaults.maxMagnification,
    compactNotation = defaults.compactNotation,
    dynamicLabelWidth = defaults.dynamicLabelWidth,
    // some filters
    literalFilter,
    datatypeFilter,
    focuserModule;
  let colorExternalsModule;
  let compactNotationModule;
  let nodeScalingModule;
  let objectPropertyFilter;
  let subclassFilter;
  let setOperatorFilter;
  let maxLabelWidth = defaults.maxLabelWidth;
  let disjointPropertyFilter;
  let rectangularRep = defaults.rectangularRepresentation;
  let drawPropertyDraggerOnHover =
    interactionDefaults.drawPropertyDraggerOnHover;
  let showDraggerObject = interactionDefaults.showDraggerObject;
  let scaleNodesByIndividuals = defaults.scaleNodesByIndividuals;
  let useAccuracyHelper = interactionDefaults.useAccuracyHelper;
  let showRenderingStatistic = interactionDefaults.showRenderingStatistic;
  let showInputModality = interactionDefaults.showInputModality;
  let pickAndPinModule;

  // Presentation supplies the channel that surfaces a rejected setting; the
  // settings object never holds a presentation module itself.

  renderedGraphSettings.datatypeFilter = function (val) {
    if (!arguments.length) {
      return datatypeFilter;
    }
    datatypeFilter = val;
  };
  renderedGraphSettings.showDraggerObject = function (val) {
    if (!arguments.length) {
      return showDraggerObject;
    }
    showDraggerObject = val;
  };
  renderedGraphSettings.useAccuracyHelper = function (val) {
    if (!arguments.length) {
      return useAccuracyHelper;
    }
    useAccuracyHelper = val;
  };
  renderedGraphSettings.showAccuracyHelper = function (val) {
    if (!arguments.length) {
      return renderedGraphSettings.showDraggerObject();
    }
    renderedGraphSettings.showDraggerObject(val);
  };
  renderedGraphSettings.showRenderingStatistic = function (val) {
    if (!arguments.length) {
      return showRenderingStatistic;
    }
    showRenderingStatistic = val;
  };
  renderedGraphSettings.showInputModality = function (val) {
    if (!arguments.length) {
      return showInputModality;
    }
    showInputModality = val;
  };
  renderedGraphSettings.drawPropertyDraggerOnHover = function (val) {
    if (!arguments.length) {
      return drawPropertyDraggerOnHover;
    }
    drawPropertyDraggerOnHover = val;
  };
  renderedGraphSettings.focuserModule = function (val) {
    if (!arguments.length) {
      return focuserModule;
    }
    focuserModule = val;
  };
  renderedGraphSettings.colorExternalsModule = function (val) {
    if (!arguments.length) {
      return colorExternalsModule;
    }
    colorExternalsModule = val;
  };
  renderedGraphSettings.compactNotationModule = function (val) {
    if (!arguments.length) {
      return compactNotationModule;
    }
    compactNotationModule = val;
  };
  renderedGraphSettings.nodeScalingModule = function (val) {
    if (!arguments.length) {
      return nodeScalingModule;
    }
    nodeScalingModule = val;
  };
  renderedGraphSettings.maxLabelWidth = function (val) {
    if (!arguments.length) {
      return maxLabelWidth;
    }
    maxLabelWidth = val;
  };
  renderedGraphSettings.objectPropertyFilter = function (val) {
    if (!arguments.length) {
      return objectPropertyFilter;
    }
    objectPropertyFilter = val;
  };
  renderedGraphSettings.disjointPropertyFilter = function (val) {
    if (!arguments.length) {
      return disjointPropertyFilter;
    }
    disjointPropertyFilter = val;
  };
  renderedGraphSettings.subclassFilter = function (val) {
    if (!arguments.length) {
      return subclassFilter;
    }
    subclassFilter = val;
  };
  renderedGraphSettings.setOperatorFilter = function (val) {
    if (!arguments.length) {
      return setOperatorFilter;
    }
    setOperatorFilter = val;
  };
  renderedGraphSettings.rectangularRepresentation = function (val) {
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
  renderedGraphSettings.dynamicLabelWidth = function (val) {
    if (!arguments.length) {
      return dynamicLabelWidth;
    } else {
      dynamicLabelWidth = val;
    }
  };
  renderedGraphSettings.charge = function (p) {
    if (!arguments.length) {
      return charge;
    }
    charge = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.classDistance = function (p) {
    if (!arguments.length) {
      return classDistance;
    }
    classDistance = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.compactNotation = function (p) {
    if (!arguments.length) {
      return compactNotation;
    }
    compactNotation = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.data = function (p) {
    if (!arguments.length) {
      return data;
    }
    data = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.datatypeDistance = function (p) {
    if (!arguments.length) {
      return datatypeDistance;
    }
    datatypeDistance = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.filterModules = function (p) {
    if (!arguments.length) {
      return filterModules;
    }
    filterModules = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.graphContainerElement = function (p) {
    if (!arguments.length) {
      return graphContainerElement;
    }
    graphContainerElement = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.gravity = function (p) {
    if (!arguments.length) {
      return gravity;
    }
    gravity = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.height = function (p) {
    if (!arguments.length) {
      return height;
    }
    height = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.linkStrength = function (p) {
    if (!arguments.length) {
      return linkStrength;
    }
    linkStrength = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.loopDistance = function (p) {
    if (!arguments.length) {
      return loopDistance;
    }
    loopDistance = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.minMagnification = function (p) {
    if (!arguments.length) {
      return minMagnification;
    }
    minMagnification = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.maxMagnification = function (p) {
    if (!arguments.length) {
      return maxMagnification;
    }
    maxMagnification = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.scaleNodesByIndividuals = function (p) {
    if (!arguments.length) {
      return scaleNodesByIndividuals;
    }
    scaleNodesByIndividuals = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.width = function (p) {
    if (!arguments.length) {
      return width;
    }
    width = +p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.literalFilter = function (p) {
    if (!arguments.length) {
      return literalFilter;
    }
    literalFilter = p;
    return renderedGraphSettings;
  };
  renderedGraphSettings.pickAndPinModule = function (val) {
    if (!arguments.length) {
      return pickAndPinModule;
    }
    pickAndPinModule = val;
  };
  return renderedGraphSettings;
}
