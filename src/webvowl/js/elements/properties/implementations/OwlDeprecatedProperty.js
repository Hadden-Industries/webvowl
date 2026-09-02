import { BaseProperty } from "../BaseProperty.js";

const OwlDeprecatedProperty = (function () {
  const o = function (graph) {
    BaseProperty.apply(this, arguments);

    this.attributes(["deprecated"])
      .styleClass("deprecatedproperty")
      .type("owl:DeprecatedProperty");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlDeprecatedProperty };
