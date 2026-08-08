const RoundNode = require("../RoundNode");

module.exports = (function () {
  const o = function (graph) {
    RoundNode.apply(this, arguments);

    const superDrawFunction = this.draw;

    this.attributes(["rdf"])
      .label("Resource")
      .radius(30)
      .styleClass("rdfsresource")
      .type("rdfs:Resource");

    this.draw = function (element) {
      superDrawFunction(element, ["rdf", "dashed"]);
    };
  };
  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;

  return o;
})();
