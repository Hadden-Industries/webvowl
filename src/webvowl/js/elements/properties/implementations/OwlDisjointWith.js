const BaseProperty = require("../BaseProperty");
const CenteringTextElement = require("../../../util/CenteringTextElement");

module.exports = (function (){
  
  const o = function ( graph ){
    BaseProperty.apply(this, arguments);
    
    const label = "Disjoint With";
    let shapeElement;
    // Disallow overwriting the label
    this.label = function ( p ){
      if ( !arguments.length ) {return label;}
      return this;
    };
    
    this.linkType("dashed")
      .styleClass("disjointwith")
      .type("owl:disjointWith");
    
    this.drawLabel = function ( labelContainer ){
      shapeElement = this.addRect(labelContainer);
      
      labelContainer.append("circle")
        .classed("symbol", true)
        .classed("fineline", true)
        .classed("embedded", true)
        .attr("cx", -12.5)
        .attr("r", 10);
      
      labelContainer.append("circle")
        .classed("symbol", true)
        .classed("fineline", true)
        .classed("embedded", true)
        .attr("cx", 12.5)
        .attr("r", 10);
      
      const textElement = new CenteringTextElement(labelContainer, this.backgroundColor());
      if ( !graph.options().compactNotation() ) {
        textElement.addSubText("disjoint");
      }
      textElement.translation(0, 20);
    };
    this.getShapeElement = function (){
      return shapeElement;
    };
    this.markerElement = function (){
      return undefined;
    };
    
  };
  o.prototype = Object.create(BaseProperty.prototype);
  o.prototype.constructor = o;
  
  return o;
}());
