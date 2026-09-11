import { BaseProperty } from "../../../webvowl/js/elements/properties/BaseProperty.js";
import { BaseNode } from "../../../webvowl/js/elements/nodes/BaseNode.js";
import { DatatypeNode } from "../../../webvowl/js/elements/nodes/DatatypeNode.js";
import { OwlThing as Thing } from "../../../webvowl/js/elements/nodes/implementations/OwlThing.js";
import { OwlObjectProperty as ObjectProperty } from "../../../webvowl/js/elements/properties/implementations/OwlObjectProperty.js";
import { OwlDatatypeProperty as DatatypeProperty } from "../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty.js";
import { RdfsSubClassOf } from "../../../webvowl/js/elements/properties/implementations/RdfsSubClassOf.js";
import { Label } from "../../../webvowl/js/elements/links/Label.js";

const tools = {};
export function createElementTools() {
  return tools;
}

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
