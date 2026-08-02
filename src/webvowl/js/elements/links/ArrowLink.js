const PlainLink = require("./PlainLink");


module.exports = ArrowLink;

function ArrowLink( domain, range, property ){
  PlainLink.apply(this, arguments);
}

ArrowLink.prototype = Object.create(PlainLink.prototype);
ArrowLink.prototype.constructor = ArrowLink;


ArrowLink.prototype.draw = function ( linkGroup, markerContainer ){
  const property = this.label().property();
  const inverse = this.label().inverse();
  
  createPropertyMarker(markerContainer, property);
  if ( inverse ) {
    createInverseMarker(markerContainer, inverse);
  }
  
  PlainLink.prototype.draw.apply(this, arguments);
  
  // Attach markers to the markable SVG path instead of relying on inheritance from its group.
  const path = this.pathObj();
  path.attr("marker-end", "url(#" + property.markerId() + ")");
  if ( inverse ) {
    path.attr("marker-start", "url(#" + inverse.markerId() + ")");
  }
};

function createPropertyMarker( markerContainer, property ){
  const marker = appendBasicMarker(markerContainer, property);
  marker.append("path")
    .attr("d", "M0,0L-12,8L-12,-8Z")
    .classed(property.markerType(), true);
  
  property.markerElement(marker);
}

function createInverseMarker( markerContainer, inverse ){
  const inverseMarker = appendBasicMarker(markerContainer, inverse);
  inverseMarker.append("path")
    .attr("d", "M0,0L12,-8L12,8Z")
    .classed(inverse.markerType(), true);
  
  inverse.markerElement(inverseMarker);
}

function appendBasicMarker( markerContainer, property ){
  return markerContainer.append("marker")
    .datum(property)
    .attr("id", property.markerId())
    .attr("viewBox", "-14 -10 28 20")
    .attr("refX", 0)
    .attr("refY", 0)
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("orient", "auto");
}
