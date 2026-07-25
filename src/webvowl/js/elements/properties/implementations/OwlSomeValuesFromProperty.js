const BaseProperty = require("../BaseProperty");

module.exports = (function (){
  
  const o = function ( graph ){
    BaseProperty.apply(this, arguments);
    
    const superGenerateCardinalityText = this.generateCardinalityText;
    
    this.linkType("values-from")
      .markerType("filled values-from")
      .styleClass("somevaluesfromproperty")
      .type("owl:someValuesFrom");
    
    this.generateCardinalityText = function (){
      let cardinalityText = "E";
      
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


