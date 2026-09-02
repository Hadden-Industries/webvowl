import { BaseProperty } from "../BaseProperty.js";

const OwlObjectProperty = (function () {
  const o = function (graph) {
    BaseProperty.apply(this, arguments);

    this.attributes(["object"])
      .styleClass("objectproperty")
      .type("owl:ObjectProperty");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlObjectProperty };
