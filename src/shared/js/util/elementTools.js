const BaseProperty = require("../../../webvowl/js/elements/properties/BaseProperty");
const BaseNode = require("../../../webvowl/js/elements/nodes/BaseNode");
const DatatypeNode = require("../../../webvowl/js/elements/nodes/DatatypeNode");
const Thing = require("../../../webvowl/js/elements/nodes/implementations/OwlThing");
const ObjectProperty = require("../../../webvowl/js/elements/properties/implementations/OwlObjectProperty");
const DatatypeProperty = require("../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
const RdfsSubClassOf = require("../../../webvowl/js/elements/properties/implementations/RdfsSubClassOf");
const Label = require("../../../webvowl/js/elements/links/Label");

const tools = {};
module.exports = function () {
  return tools;
};

tools.isLabel = function (element) {
  return element instanceof Label;
};

tools.isNode = function (element) {
  return element instanceof BaseNode;
};

tools.isDatatype = function (node) {
  return node instanceof DatatypeNode;
};

tools.isThing = function (node) {
  return node instanceof Thing;
};

tools.isProperty = function (element) {
  return element instanceof BaseProperty;
};

tools.isObjectProperty = function (element) {
  return element instanceof ObjectProperty;
};

tools.isDatatypeProperty = function (element) {
  return element instanceof DatatypeProperty;
};

tools.isRdfsSubClassOf = function (property) {
  return property instanceof RdfsSubClassOf;
};
