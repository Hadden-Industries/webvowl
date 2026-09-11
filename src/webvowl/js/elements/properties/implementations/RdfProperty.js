import { BaseProperty } from "../BaseProperty.js";

const RdfProperty = (function () {
  const o = function (graph) {
    BaseProperty.apply(this, arguments);

    this.attributes(["rdf"]).styleClass("rdfproperty").type("rdf:Property");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { RdfProperty };
