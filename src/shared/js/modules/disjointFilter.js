const OwlDisjointWith = require("../../../webvowl/js/elements/properties/implementations/OwlDisjointWith");

module.exports = function () {
  const filter = {};
  let nodes;
  let properties;
  // According to the specification enabled by default
  let enabled = true;
  let filteredNodes;
  let filteredProperties;

  /**
   * If enabled, all disjoint with properties are filtered.
   * @param untouchedNodes
   * @param untouchedProperties
   */
  filter.filter = function (untouchedNodes, untouchedProperties) {
    nodes = untouchedNodes;
    properties = untouchedProperties;

    if (this.enabled()) {
      removeDisjointWithProperties();
    }

    filteredNodes = nodes;
    filteredProperties = properties;
  };

  function removeDisjointWithProperties() {
    const cleanedProperties = [];
    let i, l, property;

    for (i = 0, l = properties.length; i < l; i++) {
      property = properties[i];

      if (!(property instanceof OwlDisjointWith)) {
        cleanedProperties.push(property);
      }
    }

    properties = cleanedProperties;
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
};
