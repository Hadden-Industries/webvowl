import { PlainLink } from "./PlainLink.js";
import { appendLinkMarker } from "./linkMarker.js";

export { ArrowLink };

function ArrowLink(domain, range, property) {
  PlainLink.apply(this, arguments);
}

ArrowLink.prototype = Object.create(PlainLink.prototype);
ArrowLink.prototype.constructor = ArrowLink;

ArrowLink.prototype.draw = function (linkGroup, markerContainer) {
  const property = this.label().property();
  const inverse = this.label().inverse();

  appendLinkMarker(markerContainer, property, "arrow-end");
  if (inverse) {
    appendLinkMarker(markerContainer, inverse, "arrow-start");
  }

  PlainLink.prototype.draw.apply(this, arguments);

  // Attach markers to the markable SVG path instead of relying on inheritance from its group.
  const path = this.pathObj();
  path.attr("marker-end", "url(#" + property.markerId() + ")");
  if (inverse) {
    path.attr("marker-start", "url(#" + inverse.markerId() + ")");
  }
};
