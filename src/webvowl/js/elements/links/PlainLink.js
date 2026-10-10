import { createLinkPart } from "./linkPart.js";
import { Label } from "./Label.js";

export { PlainLink };

const states = new WeakMap();

/**
 * A link connects at least two VOWL nodes.
 * The properties connecting the VOWL nodes are stored separately into the label.
 * @param domain
 * @param range
 * @param property
 */
function PlainLink(domain, range, property) {
  const label = new Label(property, this);
  states.set(this, {
    domain,
    range,
    label,
    frontPart: createLinkPart(label, range, this),
    backPart: createLinkPart(domain, label, this),
    layers: undefined,
    layerIndex: undefined,
    loops: undefined,
    loopIndex: undefined,
    pathEl: undefined,
  });
}

PlainLink.prototype.layers = function (value) {
  if (!arguments.length) {
    return states.get(this).layers;
  }
  states.get(this).layers = value;
  return this;
};

PlainLink.prototype.layerIndex = function (value) {
  if (!arguments.length) {
    return states.get(this).layerIndex;
  }
  states.get(this).layerIndex = value;
  return this;
};

PlainLink.prototype.loops = function (value) {
  if (!arguments.length) {
    return states.get(this).loops;
  }
  states.get(this).loops = value;
  return this;
};

PlainLink.prototype.loopIndex = function (value) {
  if (!arguments.length) {
    return states.get(this).loopIndex;
  }
  states.get(this).loopIndex = value;
  return this;
};

PlainLink.prototype.domain = function () {
  return states.get(this).domain;
};
PlainLink.prototype.range = function () {
  return states.get(this).range;
};
PlainLink.prototype.label = function () {
  return states.get(this).label;
};
PlainLink.prototype.linkParts = function () {
  const { frontPart, backPart } = states.get(this);
  return [frontPart, backPart];
};
PlainLink.prototype.pathObj = function (value) {
  if (!arguments.length) {
    return states.get(this).pathEl;
  }
  states.get(this).pathEl = value;
};

PlainLink.prototype.draw = function (linkGroup) {
  const property = this.label().property();
  const inverse = this.label().inverse();

  property.linkGroup(linkGroup);
  if (inverse) {
    inverse.linkGroup(linkGroup);
  }

  const pathElement = linkGroup.append("path");
  pathElement
    .classed("link-path", true)
    .classed(this.domain().cssClassOfNode(), true)
    .classed(this.range().cssClassOfNode(), true)
    .classed(property.linkType(), true);
  this.pathObj(pathElement);
};

PlainLink.prototype.inverse = function () {
  return this.label().inverse();
};

PlainLink.prototype.isLoop = function () {
  return this.domain().equals(this.range());
};

PlainLink.prototype.property = function () {
  return this.label().property();
};
