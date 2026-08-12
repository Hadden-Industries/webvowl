const elementTools = require("../util/elementTools")();
const filterTools = require("../util/filterTools")();

module.exports = function (menu) {
  const filter = {};
  let nodes;
  let properties;
  let enabled = true;
  let filteredNodes;
  let filteredProperties;
  let maxDegreeSetter;
  let degreeGetter;
  let degreeSetter;

  const NODE_COUNT_LIMIT_FOR_AUTO_ENABLING = 50;

  filter.initialize = function (nodes, properties) {
    const maxLinkCount = findMaxLinkCount(nodes);
    if (maxDegreeSetter instanceof Function) {
      maxDegreeSetter(maxLinkCount);
    }

    menu.setDefaultDegreeValue(
      findAutoDefaultDegree(nodes, properties, maxLinkCount),
    );
    const defaultDegree = findDefaultDegree(maxLinkCount);
    if (degreeSetter instanceof Function) {
      degreeSetter(defaultDegree);
      if (defaultDegree > 0) {
        menu.highlightForDegreeSlider(true);
        menu.getGraphObject().setFilterWarning(true);
      }
    } else {
      console.error("No degree setter function set.");
    }
  };

  function findAutoDefaultDegree(nodes, properties, maxDegree) {
    for (let degree = 0; degree < maxDegree; degree++) {
      const filteredData = filterByNodeDegree(nodes, properties, degree);

      if (filteredData.nodes.length <= NODE_COUNT_LIMIT_FOR_AUTO_ENABLING) {
        return degree;
      }
    }
    return 0;
  }

  function findDefaultDegree(maxDegree) {
    const globalDegOfFilter = menu.getGraphObject().getGlobalDOF();
    if (globalDegOfFilter >= 0) {
      if (globalDegOfFilter <= maxDegree) {
        return globalDegOfFilter;
      } else {
        menu.getGraphObject().setGlobalDOF(maxDegree);
        return maxDegree;
      }
    }
    return menu.getDefaultDegreeValue();
  }

  /**
   * If enabled, all nodes are filter by their node degree.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function (untouchedNodes, untouchedProperties) {
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if (this.enabled()) {
      if (degreeGetter instanceof Function) {
        filterByNodeDegreeAndApply(degreeGetter());
      } else {
        console.error("No degree query function set.");
      }
    }

    filteredNodes = nodes;
    filteredProperties = properties;

    if (filteredNodes.length === 0) {
      degreeSetter(0);
      filteredNodes = untouchedNodes;
      filteredProperties = untouchedProperties;
    }
  };

  function findMaxLinkCount(nodes) {
    let maxLinkCount = 0;
    for (let i = 0, l = nodes.length; i < l; i++) {
      const linksWithoutDatatypes = filterOutDatatypes(nodes[i].links());

      maxLinkCount = Math.max(maxLinkCount, linksWithoutDatatypes.length);
    }
    return maxLinkCount;
  }

  function filterOutDatatypes(links) {
    return links.filter(function (link) {
      return !elementTools.isDatatypeProperty(link.property());
    });
  }

  function filterByNodeDegreeAndApply(minDegree) {
    const filteredData = filterByNodeDegree(nodes, properties, minDegree);
    nodes = filteredData.nodes;
    properties = filteredData.properties;
  }

  function filterByNodeDegree(nodes, properties, minDegree) {
    return filterTools.filterNodesAndTidy(
      nodes,
      properties,
      hasRequiredDegree(minDegree),
    );
  }

  function hasRequiredDegree(minDegree) {
    return function (node) {
      return filterOutDatatypes(node.links()).length >= minDegree;
    };
  }

  filter.setMaxDegreeSetter = function (_maxDegreeSetter) {
    maxDegreeSetter = _maxDegreeSetter;
  };

  filter.setDegreeGetter = function (_degreeGetter) {
    degreeGetter = _degreeGetter;
  };

  filter.setDegreeSetter = function (_degreeSetter) {
    degreeSetter = _degreeSetter;
  };

  filter.enabled = function (p) {
    if (!arguments.length) {
      return enabled;
    }
    enabled = p;
    return filter;
  };

  // Functions a filter must have
  filter.filteredNodes = function () {
    return filteredNodes;
  };

  filter.filteredProperties = function () {
    return filteredProperties;
  };

  return filter;
};
