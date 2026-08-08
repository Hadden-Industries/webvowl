const BaseProperty = require("../BaseProperty");

module.exports = (function () {
  const o = function (graph) {
    BaseProperty.apply(this, arguments);

    this.styleClass("equivalentproperty").type("owl:equivalentProperty");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;

  return o;
})();
