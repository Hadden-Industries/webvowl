import { BaseProperty } from "../BaseProperty.js";

const OwlTransitiveProperty = (function () {
  const o = function (graph) {
    BaseProperty.apply(this, arguments);

    this.attributes(["transitive"])
      .styleClass("transitiveproperty")
      .type("owl:TransitiveProperty");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlTransitiveProperty };
