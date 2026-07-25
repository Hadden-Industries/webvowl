const BaseProperty = require("../BaseProperty");

module.exports = (function (){
  
  const o = function ( graph ){
    BaseProperty.apply(this, arguments);
    
    this.attributes(["deprecated"])
      .styleClass("deprecatedproperty")
      .type("owl:DeprecatedProperty");
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;
  
  return o;
}());
