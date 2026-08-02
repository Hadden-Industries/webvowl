const PlainLink = require("./PlainLink");


module.exports = BoxArrowLink;

function BoxArrowLink( domain, range, property ){
  PlainLink.apply(this, arguments);
}

BoxArrowLink.prototype = Object.create(PlainLink.prototype);
BoxArrowLink.prototype.constructor = BoxArrowLink;


BoxArrowLink.prototype.draw = function ( linkGroup, markerContainer ){
  const property = this.label().property();
  const inverse = this.label().inverse();
  
  createPropertyMarker(markerContainer, property);
  if ( inverse ) {
    createInverseMarker(markerContainer, inverse);
  }
  
  PlainLink.prototype.draw.apply(this, arguments);
  
  // Attach markers to the markable SVG path instead of relying on inheritance from its group.
  const path = this.pathObj();
  path.attr("marker-start", "url(#" + property.markerId() + ")");
  if ( inverse ) {
    path.attr("marker-end", "url(#" + inverse.markerId() + ")");
  }
};


function createPropertyMarker( markerContainer, inverse ){
  const inverseMarker = appendBasicMarker(markerContainer, inverse);
  inverseMarker.attr("refX", -8);
  inverseMarker.append("path")
    .attr("d", "M0,-8L8,0L0,8L-8,0Z")
    .classed(inverse.markerType(), true);
  
  inverse.markerElement(inverseMarker);
}

function createInverseMarker( markerContainer, property ){
  const marker = appendBasicMarker(markerContainer, property);
  marker.attr("refX", 8);
  marker.append("path")
    .attr("d", "M0,-8L8,0L0,8L-8,0Z")
    .classed(property.markerType(), true);
  
  property.markerElement(marker);
}

function appendBasicMarker( markerContainer, property ){
  return markerContainer.append("marker")
    .datum(property)
    .attr("id", property.markerId())
    .attr("viewBox", "-10 -10 20 20")
    .attr("refY", 0)
    .attr("markerWidth", 20)
    .attr("markerHeight", 20)
    .attr("markerUnits", "userSpaceOnUse")
    .attr("orient", "auto");
}
