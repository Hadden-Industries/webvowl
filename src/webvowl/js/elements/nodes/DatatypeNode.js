import { RectangularNode } from "./RectangularNode.js";

const DatatypeNode = (function () {
  const o = function (graph) {
    RectangularNode.apply(this, arguments);
  };
  o.prototype = Object.create(RectangularNode.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { DatatypeNode };
