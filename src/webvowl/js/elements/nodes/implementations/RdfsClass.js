import { RoundNode } from "../RoundNode.js";

const RdfsClass = (function () {
  const o = function (graph) {
    RoundNode.apply(this, arguments);

    this.attributes(["rdf"]).type("rdfs:Class");
  };
  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { RdfsClass };
