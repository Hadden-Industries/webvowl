import { RoundNode } from "../RoundNode.js";

const OwlDeprecatedClass = (function () {
  const o = function (graph) {
    RoundNode.apply(this, arguments);

    this.attributes(["deprecated"])
      .type("owl:DeprecatedClass")
      .styleClass("deprecated")
      .indications(["deprecated"]);
  };
  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlDeprecatedClass };
