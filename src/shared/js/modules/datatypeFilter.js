import { createFilterTools as filterToolsFactory } from "../util/filterTools.js";
import { createElementTools as elementToolsFactory } from "../util/elementTools.js";
const elementTools = elementToolsFactory();
const filterTools = filterToolsFactory();

export function createDatatypeFilter() {
  const filter = {};
  let nodes;
  let properties;
  let enabled = false;
  let filteredNodes;
  let filteredProperties;

  /**
   * If enabled, all datatypes and literals including connected properties are filtered.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function (untouchedNodes, untouchedProperties) {
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if (this.enabled()) {
      removeDatatypesAndLiterals();
    }

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  function removeDatatypesAndLiterals() {
    const filteredData = filterTools.filterNodesAndTidy(
      nodes,
      properties,
      isNoDatatypeOrLiteral,
    );

    nodes = filteredData.nodes;
    properties = filteredData.properties;
  }

  function isNoDatatypeOrLiteral(node) {
    return !elementTools.isDatatype(node);
  }

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
