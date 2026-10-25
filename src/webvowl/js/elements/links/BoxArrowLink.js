import { PlainLink } from "./PlainLink.js";
import { appendLinkMarker } from "./linkMarker.js";

export { BoxArrowLink };

function BoxArrowLink(domain, range, property) {
  PlainLink.apply(this, arguments);
}

BoxArrowLink.prototype = Object.create(PlainLink.prototype);
BoxArrowLink.prototype.constructor = BoxArrowLink;

BoxArrowLink.prototype.draw = function (linkGroup, markerContainer) {
  const property = this.label().property();
  const inverse = this.label().inverse();

  appendLinkMarker(markerContainer, property, "box-start");
  if (inverse) {
    appendLinkMarker(markerContainer, inverse, "box-end");
  }

  PlainLink.prototype.draw.apply(this, arguments);

  // Attach markers to the markable SVG path instead of relying on inheritance from its group.
  const path = this.pathObj();
  path.attr("marker-start", "url(#" + property.markerId() + ")");
  if (inverse) {
    path.attr("marker-end", "url(#" + inverse.markerId() + ")");
  }
};
