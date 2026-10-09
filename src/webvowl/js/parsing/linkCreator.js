import { createSet as addedPropertiesFactory } from "../../../shared/js/util/set.js";
import { ArrowLink } from "../elements/links/ArrowLink.js";
import { BoxArrowLink } from "../elements/links/BoxArrowLink.js";
import { PlainLink } from "../elements/links/PlainLink.js";
import { OwlDisjointWith } from "../elements/properties/implementations/OwlDisjointWith.js";
import { SetOperatorProperty } from "../elements/properties/implementations/SetOperatorProperty.js";

/**
 * Stores the passed properties in links.
 * @returns {Function}
 */
const createLinkCreator = (function () {
  const linkCreator = {};

  /**
   * Creates links from the passed properties.
   * @param properties
   */
  linkCreator.createLinks = function (properties) {
    const links = groupPropertiesToLinks(properties);

    const pairs = new Map();
    const loopsByNode = new Map();
    for (const link of links) {
      const domain = link.domain();
      const range = link.range();
      let layers = pairs.get(domain)?.get(range);
      if (!layers) {
        layers = [];
        for (const [from, to] of [
          [domain, range],
          [range, domain],
        ]) {
          if (!pairs.has(from)) {
            pairs.set(from, new Map());
          }
          pairs.get(from).set(to, layers);
        }
      }
      link.layerIndex(layers.length);
      layers.push(link);
      link.layers(layers);
      if (domain === range) {
        if (!loopsByNode.has(domain)) {
          loopsByNode.set(domain, []);
        }
        const loops = loopsByNode.get(domain);
        link.loopIndex(loops.length);
        loops.push(link);
        link.loops(loops);
      }
    }

    return links;
  };

  /**
   * Creates links of properties and - if existing - their inverses.
   * @param properties the properties
   * @returns {Array}
   */
  function groupPropertiesToLinks(properties) {
    const links = [];
    let property;
    const addedProperties = addedPropertiesFactory();

    for (let i = 0, l = properties.length; i < l; i++) {
      property = properties[i];

      if (!addedProperties.has(property)) {
        const link = createLink(property);

        property.link(link);
        if (property.inverse()) {
          property.inverse().link(link);
        }

        links.push(link);

        addedProperties.add(property);
        if (property.inverse()) {
          addedProperties.add(property.inverse());
        }
      }
    }

    return links;
  }

  function createLink(property) {
    const domain = property.domain();
    const range = property.range();

    if (property instanceof OwlDisjointWith) {
      return new PlainLink(domain, range, property);
    } else if (property instanceof SetOperatorProperty) {
      return new BoxArrowLink(domain, range, property);
    }
    return new ArrowLink(domain, range, property);
  }

  return function () {
    // Return a function to keep module interfaces consistent
    return linkCreator;
  };
})();

export { createLinkCreator };
