const RoundNode = require("../RoundNode");
const drawTools = require("../../drawTools")();

module.exports = (function (){
  
  const o = function ( graph ){
    RoundNode.apply(this, arguments);
    
    const CIRCLE_SIZE_DIFFERENCE = 4;
    let renderingElement;
    const that = this,
      superActualRadiusFunction = that.actualRadius;
    
    this.styleClass("equivalentclass")
      .type("owl:equivalentClass");
    
    this.actualRadius = function (){
      return superActualRadiusFunction() + CIRCLE_SIZE_DIFFERENCE;
    };
    
    this.redrawElement = function (){
      renderingElement.remove();
      that.textBlock().remove();
      let bgColor = that.backgroundColor();
      
      if ( that.attributes().indexOf("deprecated") > -1 ) {
        bgColor = undefined;
      }
      const cssClasses = that.collectCssClasses();
      renderingElement = that.nodeElement().append("g");
      
      if ( that.getRectangularRepresentation() === true ) {
        drawTools.appendRectangularClass(renderingElement, 84, 84, ["white", "embedded"]);
        drawTools.appendRectangularClass(renderingElement, 80 - CIRCLE_SIZE_DIFFERENCE, 80 - CIRCLE_SIZE_DIFFERENCE, cssClasses, that.labelForCurrentLanguage(), bgColor);
      } else {
        drawTools.appendCircularClass(renderingElement, that.actualRadius(), ["white", "embedded"]);
        console.warn(cssClasses);
        console.warn(that.attributes());
        console.warn("what is bgColor" + bgColor);
        drawTools.appendCircularClass(renderingElement, that.actualRadius() - CIRCLE_SIZE_DIFFERENCE, cssClasses, that.labelForCurrentLanguage(), bgColor);
        
      }
      that.postDrawActions(that.nodeElement());
      
    };
    this.draw = function ( parentElement ){
      const cssClasses = that.collectCssClasses();
      
      that.nodeElement(parentElement);
      renderingElement = parentElement.append("g");
      let bgColor = that.backgroundColor();
      if ( that.attributes().indexOf("deprecated") > -1 ) {
        bgColor = undefined;
      }
      // draw the outer circle at first and afterwards the inner circle
      if ( that.getRectangularRepresentation() === true ) {
        drawTools.appendRectangularClass(renderingElement, 84, 84, ["white", "embedded"]);
        drawTools.appendRectangularClass(renderingElement, 80 - CIRCLE_SIZE_DIFFERENCE, 80 - CIRCLE_SIZE_DIFFERENCE, cssClasses, that.labelForCurrentLanguage(), bgColor);
      } else {
        drawTools.appendCircularClass(renderingElement, that.actualRadius(), ["white", "embedded"]);
        drawTools.appendCircularClass(renderingElement, that.actualRadius() - CIRCLE_SIZE_DIFFERENCE, cssClasses, that.labelForCurrentLanguage(), bgColor);
        
      }
      
      that.postDrawActions();
    };
    
    /**
     * Sets the hover highlighting of this node.
     * @param enable
     */
    that.setHoverHighlighting = function ( enable ){
      that.nodeElement().selectAll("circle:last-of-type").classed("hovered", enable);
    };
  };
  o.prototype = Object.create(RoundNode.prototype);
  o.prototype.constructor = o;
  
  return o;
}());
