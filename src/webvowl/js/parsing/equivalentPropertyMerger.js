const OwlThing = require("../elements/nodes/implementations/OwlThing");
const RdfsLiteral = require("../elements/nodes/implementations/RdfsLiteral");
const elementTools = require("../../../shared/js/util/elementTools")();

const equivalentPropertyMerger = {};
module.exports = function () {
  return equivalentPropertyMerger;
};

const PREFIX = "GENERATED-MERGED_RANGE-";
const OBJECT_PROPERTY_DEFAULT_RANGE_TYPE = "owl:Thing";
const DATA_PROPERTY_DEFAULT_RANGE_TYPE = "rdfs:Literal";

equivalentPropertyMerger.merge = function (
  properties,
  nodes,
  propertyMap,
  nodeMap,
  graph,
) {
  const totalNodeIdsToHide = d3.set();
  const processedPropertyIds = d3.set();
  const mergeNodes = [];

  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const equivalents = property
      .equivalents()
      .map(createIdToPropertyMapper(propertyMap));

    if (equivalents.length === 0 || processedPropertyIds.has(property.id())) {
      continue;
    }

    const propertyWithEquivalents = equivalents.concat(property);

    let mergeNode = findMergeNode(propertyWithEquivalents, nodeMap);
    if (!mergeNode) {
      if (mergeNode !== undefined) {
        mergeNode = createDefaultMergeNode(property, graph);
        mergeNodes.push(mergeNode);
      }
    }

    const nodeIdsToHide = replaceRangesAndCollectNodesToHide(
      propertyWithEquivalents,
      mergeNode,
      properties,
      processedPropertyIds,
    );
    for (let j = 0; j < nodeIdsToHide.length; j++) {
      totalNodeIdsToHide.add(nodeIdsToHide[j]);
    }
  }

  return filterVisibleNodes(nodes.concat(mergeNodes), totalNodeIdsToHide);
};

function createIdToPropertyMapper(propertyMap) {
  return function (id) {
    return propertyMap[id];
  };
}

function findMergeNode(propertyWithEquivalents, nodeMap) {
  const typeMap = mapPropertiesRangesToType(propertyWithEquivalents, nodeMap);
  const typeSet = d3.set(typeMap.keys());

  // default types are the fallback values and should be ignored for the type determination
  typeSet.delete(OBJECT_PROPERTY_DEFAULT_RANGE_TYPE);
  typeSet.delete(DATA_PROPERTY_DEFAULT_RANGE_TYPE);

  // exactly one type to chose from -> take the node of this type as range
  if (typeSet.size() === 1) {
    const type = typeSet.values()[0];
    const ranges = typeMap.get(type);

    if (ranges.length === 1) {
      return ranges[0];
    }
  }
}

function mapPropertiesRangesToType(properties, nodeMap) {
  const typeMap = d3.map();

  properties.forEach(function (property) {
    if (property === undefined) //@ WORKAROUND
    {
      return;
    }

    const range = nodeMap[property.range()];
    const type = range.type();

    if (!typeMap.has(type)) {
      typeMap.set(type, []);
    }

    typeMap.get(type).push(range);
  });

  return typeMap;
}

function createDefaultMergeNode(property, graph) {
  let range;

  if (elementTools.isDatatypeProperty(property)) {
    range = new RdfsLiteral(graph);
  } else {
    range = new OwlThing(graph);
  }
  range.id(PREFIX + property.id());

  return range;
}

function replaceRangesAndCollectNodesToHide(
  propertyWithEquivalents,
  mergeNode,
  properties,
  processedPropertyIds,
) {
  const nodesToHide = [];

  propertyWithEquivalents.forEach(function (property) {
    if (property === undefined || mergeNode === undefined) // @ WORKAROUND
    {
      return;
    }
    const oldRangeId = property.range();
    property.range(mergeNode.id());
    if (!isDomainOrRangeOfOtherProperty(oldRangeId, properties)) {
      nodesToHide.push(oldRangeId);
    }

    processedPropertyIds.add(property.id());
  });

  return nodesToHide;
}

function isDomainOrRangeOfOtherProperty(nodeId, properties) {
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    if (property.domain() === nodeId || property.range() === nodeId) {
      return true;
    }
  }

  return false;
}

function filterVisibleNodes(nodes, nodeIdsToHide) {
  const filteredNodes = [];

  nodes.forEach(function (node) {
    if (!nodeIdsToHide.has(node.id())) {
      filteredNodes.push(node);
    }
  });

  return filteredNodes;
}
