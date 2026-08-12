const SetOperatorNode = require("../../../webvowl/js/elements/nodes/SetOperatorNode");
const OwlThing = require("../../../webvowl/js/elements/nodes/implementations/OwlThing");
const OwlNothing = require("../../../webvowl/js/elements/nodes/implementations/OwlNothing");
const elementTools = require("../util/elementTools")();

module.exports = function () {
  const statistics = {};
  let nodeCount;
  const occurencesOfClassAndDatatypeTypes = {};
  let edgeCount;
  const occurencesOfPropertyTypes = {};
  let classCount;
  let datatypeCount;
  let datatypePropertyCount;
  let objectPropertyCount;
  let propertyCount;
  let totalIndividualCount;
  let filteredNodes;
  let filteredProperties;

  statistics.filter = function (classesAndDatatypes, properties) {
    resetStoredData();

    storeTotalCounts(classesAndDatatypes, properties);
    storeClassAndDatatypeCount(classesAndDatatypes);
    storePropertyCount(properties);

    storeOccurencesOfTypes(
      classesAndDatatypes,
      occurencesOfClassAndDatatypeTypes,
    );
    storeOccurencesOfTypes(properties, occurencesOfPropertyTypes);

    storeTotalIndividualCount(classesAndDatatypes);

    filteredNodes = classesAndDatatypes;
    filteredProperties = properties;
  };

  function resetStoredData() {
    nodeCount = 0;
    edgeCount = 0;
    classCount = 0;
    datatypeCount = 0;
    datatypePropertyCount = 0;
    objectPropertyCount = 0;
    propertyCount = 0;
    totalIndividualCount = 0;
  }

  function storeTotalCounts(classesAndDatatypes, properties) {
    nodeCount = classesAndDatatypes.length;

    const seenProperties = require("../util/set")();
    let i;
    let l;
    let property;
    for (i = 0, l = properties.length; i < l; i++) {
      property = properties[i];
      if (!seenProperties.has(property)) {
        edgeCount += 1;
      }

      seenProperties.add(property);
      if (property.inverse()) {
        seenProperties.add(property.inverse());
      }
    }
  }

  function storeClassAndDatatypeCount(classesAndDatatypes) {
    // Each datatype should be counted just a single time
    const datatypeSet = d3.set();
    classCount = 0;
    classesAndDatatypes.forEach(function (node) {
      if (elementTools.isDatatype(node)) {
        datatypeSet.add(node.defaultLabel());
      } else if (!(node instanceof SetOperatorNode)) {
        if (node instanceof OwlThing) {
          // Counted through the existing class-count policy below.
        } else if (node instanceof OwlNothing) {
          // Counted through the existing class-count policy below.
        } else {
          const adds = 1 + countElementArray(node.equivalents());
          classCount += adds;
        }
      } else if (node instanceof SetOperatorNode) {
        classCount += 1;
      }
    });

    // count things and nothings just a single time
    // classCount += hasThing ? 1 : 0;
    // classCount += hasNothing ? 1 : 0;

    datatypeCount = datatypeSet.size;
  }

  function storePropertyCount(properties) {
    let attr;
    for (let i = 0, l = properties.length; i < l; i++) {
      const property = properties[i];

      let result = false;
      if (property.attributes) {
        attr = property.attributes();
        if (attr && attr.indexOf("datatype") !== -1) {
          result = true;
        }
      }
      if (result === true) {
        datatypePropertyCount += getExtendedPropertyCount(property);
      } else if (elementTools.isObjectProperty(property)) {
        objectPropertyCount += getExtendedPropertyCount(property);
      }
    }
    propertyCount = objectPropertyCount + datatypePropertyCount;
  }

  function getExtendedPropertyCount(property) {
    // count the property itself
    let count = 1;

    // and count properties this property represents
    count += countElementArray(property.equivalents());
    count += countElementArray(property.redundantProperties());

    return count;
  }

  function countElementArray(properties) {
    if (properties) {
      return properties.length;
    }
    return 0;
  }

  function storeOccurencesOfTypes(elements, storage) {
    elements.forEach(function (element) {
      const type = element.type();
      let typeCount = storage[type];

      if (typeof typeCount === "undefined") {
        typeCount = 0;
      } else {
        typeCount += 1;
      }
      storage[type] = typeCount;
    });
  }

  function storeTotalIndividualCount(nodes) {
    const sawIndividuals = {};
    let totalCount = 0;
    for (let i = 0, l = nodes.length; i < l; i++) {
      const individuals = nodes[i].individuals();

      let tempCount = 0;
      for (let iA = 0; iA < individuals.length; iA++) {
        if (sawIndividuals[individuals[iA].iri()] === undefined) {
          sawIndividuals[individuals[iA].iri()] = 1; // this iri for that individual is now set to 1 >> seen it
          tempCount++;
        }
      }
      totalCount += tempCount;
    }
    totalIndividualCount = totalCount;
  }

  statistics.nodeCount = function () {
    return nodeCount;
  };

  statistics.occurencesOfClassAndDatatypeTypes = function () {
    return occurencesOfClassAndDatatypeTypes;
  };

  statistics.edgeCount = function () {
    return edgeCount;
  };

  statistics.occurencesOfPropertyTypes = function () {
    return occurencesOfPropertyTypes;
  };

  statistics.classCount = function () {
    return classCount;
  };

  statistics.datatypeCount = function () {
    return datatypeCount;
  };

  statistics.datatypePropertyCount = function () {
    return datatypePropertyCount;
  };

  statistics.objectPropertyCount = function () {
    return objectPropertyCount;
  };

  statistics.propertyCount = function () {
    return propertyCount;
  };

  statistics.totalIndividualCount = function () {
    return totalIndividualCount;
  };

  // Functions a filter must have
  statistics.filteredNodes = function () {
    return filteredNodes;
  };

  statistics.filteredProperties = function () {
    return filteredProperties;
  };

  return statistics;
};
