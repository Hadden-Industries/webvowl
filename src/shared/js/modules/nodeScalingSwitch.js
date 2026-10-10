/**
 * This module abuses the filter function a bit like the statistics module. Nothing is filtered.
 *
 * @returns {{}}
 */
import { DEFAULT_VISUALIZATION_MODES } from "../visualizationDefaults.js";

export function createNodeScalingSwitch(graph) {
  const DEFAULT_STATE = DEFAULT_VISUALIZATION_MODES.nodeScaling;

  const filter = {};
  let nodes;
  let properties;
  let enabled = DEFAULT_STATE;
  let filteredNodes;
  let filteredProperties;

  /**
   * If enabled, the scaling of nodes according to individuals will be enabled.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function (untouchedNodes, untouchedProperties) {
    nodes = untouchedNodes;
    properties = untouchedProperties;

    graph.options().scaleNodesByIndividuals(enabled);

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  filter.enabled = function (p) {
    if (!arguments.length) {
      return enabled;
    }
    enabled = p;
    return filter;
  };

  filter.reset = function () {
    enabled = DEFAULT_STATE;
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
