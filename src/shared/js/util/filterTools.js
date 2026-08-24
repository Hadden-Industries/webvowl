const elementTools = require("./elementTools")();

module.exports = (function () {
  const tools = {};

  /**
   * Filters the passed nodes and removes dangling properties.
   * @param nodes
   * @param properties
   * @param shouldKeepNode function that returns true if the node should be kept
   * @returns {{nodes: Array, properties: Array}} the filtered nodes and properties
   */
  tools.filterNodesAndTidy = function (nodes, properties, shouldKeepNode) {
    const removedNodes = require("./set")(),
      cleanedNodes = [],
      cleanedProperties = [],
      referencedNodes = new Set(),
      datatypeRangeCandidates = new Set();

    nodes.forEach(function (node) {
      if (shouldKeepNode(node)) {
        cleanedNodes.push(node);
      } else {
        removedNodes.add(node);
      }
    });

    properties.forEach(function (property) {
      if (propertyHasVisibleNodes(removedNodes, property)) {
        cleanedProperties.push(property);
        referencedNodes.add(property.domain());
        referencedNodes.add(property.range());
      } else if (elementTools.isDatatypeProperty(property)) {
        const range = property.range();
        if (elementTools.isDatatype(range)) {
          datatypeRangeCandidates.add(range);
        }
      }
    });

    // Remove only datatypes/literals that no surviving property references.
    datatypeRangeCandidates.forEach(function (range) {
      if (referencedNodes.has(range)) {
        return;
      }

      const index = cleanedNodes.indexOf(range);
      if (index >= 0) {
        cleanedNodes.splice(index, 1);
      }
    });

    return {
      nodes: cleanedNodes,
      properties: cleanedProperties,
    };
  };

  /**
   * Returns true, if the domain and the range of this property have not been removed.
   * @param removedNodes
   * @param property
   * @returns {boolean} true if property isn't dangling
   */
  function propertyHasVisibleNodes(removedNodes, property) {
    return (
      !removedNodes.has(property.domain()) &&
      !removedNodes.has(property.range())
    );
  }

  return function () {
    return tools;
  };
})();
