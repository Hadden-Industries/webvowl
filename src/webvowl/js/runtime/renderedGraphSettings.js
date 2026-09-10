// Renderer-owned settings: force and dimension parameters, graph style
// choices, and the filter and selection registries the renderer drives.
// Split out of the retired options god-object during the D3 cutover.
export function createRenderedGraphSettings() {
  const renderedGraphSettings = {};

  // Settings-level warnings travel through a caller-supplied channel; the
  // settings object holds no presentation module of its own.
  let data,
    graphContainerElement,
    classDistance = 200,
    datatypeDistance = 120,
    loopDistance = 150,
    charge = -500,
    gravity = 0.025,
    linkStrength = 1,
    height = 600,
    width = 800,
    filterModules = [],
    minMagnification = 0.01,
    maxMagnification = 4,
    compactNotation = false,
    dynamicLabelWidth = true,
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
  let maxLabelWidth = 120;
  let disjointPropertyFilter;
  let rectangularRep = false;
  let drawPropertyDraggerOnHover = true;
  let showDraggerObject = false;
  let scaleNodesByIndividuals = true;
  let useAccuracyHelper = true;
  let showRenderingStatistic = true;
  let showInputModality = false;
  let nodeDegreeFilter;
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
  renderedGraphSettings.nodeDegreeFilter = function (p) {
    if (!arguments.length) {
      return nodeDegreeFilter;
    }
    nodeDegreeFilter = p;
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
