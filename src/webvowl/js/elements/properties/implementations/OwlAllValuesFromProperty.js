const BaseProperty = require("../BaseProperty");

module.exports = (function (){
  
  const o = function ( graph ){
    BaseProperty.apply(this, arguments);
    
    const superGenerateCardinalityText = this.generateCardinalityText;
    
    this.linkType("values-from")
      .markerType("filled values-from")
      .styleClass("allvaluesfromproperty")
      .type("owl:allValuesFrom");
    
    this.generateCardinalityText = function (){
      let cardinalityText = "A";
      
      const superCardinalityText = superGenerateCardinalityText();
      if ( superCardinalityText ) {
        cardinalityText += ", " + superCardinalityText;
      }
      
      return cardinalityText;
    };
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;
  
  return o;
}());


