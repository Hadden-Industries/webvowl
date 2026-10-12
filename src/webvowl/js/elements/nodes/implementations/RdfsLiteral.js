import { namespaces } from "vowl";
import { DatatypeNode } from "../DatatypeNode.js";

const RdfsLiteral = (function () {
  const o = function (graph) {
    DatatypeNode.apply(this, arguments);

    const superDrawFunction = this.draw,
      superLabelFunction = this.label;

    this.attributes(["datatype"])
      .label("Literal")
      .styleClass("literal")
      .type("rdfs:Literal")
      .iri(namespaces.rdfs + "Literal");

    this.draw = function (element) {
      superDrawFunction(element, ["dashed"]);
    };

    this.label = function (p) {
      if (!arguments.length) {
        return superLabelFunction();
      }
      return this;
    };
  };
  o.prototype = Object.create(DatatypeNode.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { RdfsLiteral };
