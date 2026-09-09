import { createFilterTools as filterToolsFactory } from "../util/filterTools.js";
import { createElementTools as elementToolsFactory } from "../util/elementTools.js";
const elementTools = elementToolsFactory();
const filterTools = filterToolsFactory();

export function createNodeDegreeFilter() {
  const filter = {};
  let nodes;
  let properties;
  let enabled = true;
  let filteredNodes;
  let filteredProperties;
  let requestedMinimumDegree;
  let minimumDegree = 0;
  let maximumDegree = 0;
  let automaticMinimumDegree = 0;

  const NODE_COUNT_LIMIT_FOR_AUTO_ENABLING = 50;

  filter.initialize = function (nodes, properties) {
    maximumDegree = findMaxLinkCount(nodes);
    automaticMinimumDegree = findAutoDefaultDegree(
      nodes,
      properties,
      maximumDegree,
    );
    minimumDegree = Math.min(
      requestedMinimumDegree ?? automaticMinimumDegree,
      maximumDegree,
    );
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

  /**
   * If enabled, all nodes are filter by their node degree.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function (untouchedNodes, untouchedProperties) {
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if (this.enabled()) {
      filterByNodeDegreeAndApply(minimumDegree);
    }

    filteredNodes = nodes;
    filteredProperties = properties;

    if (filteredNodes.length === 0) {
      filter.minDegree(0);
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

  filter.minDegree = function (nextMinimumDegree) {
    if (!arguments.length) {
      return minimumDegree;
    }
    if (!Number.isSafeInteger(nextMinimumDegree) || nextMinimumDegree < 0) {
      throw new RangeError(
        "Minimum node degree must be a non-negative safe integer.",
      );
    }
    requestedMinimumDegree = nextMinimumDegree;
    minimumDegree = nextMinimumDegree;
    return filter;
  };

  filter.readDegreeRange = function () {
    return Object.freeze({ maximumDegree, automaticMinimumDegree });
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
}
