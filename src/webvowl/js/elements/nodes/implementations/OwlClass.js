import { RoundNode } from "../RoundNode.js";

const OwlClass = (function () {
  const o = function (graph) {
    RoundNode.apply(this, arguments);

    this.type("owl:Class");
  };
  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlClass };
