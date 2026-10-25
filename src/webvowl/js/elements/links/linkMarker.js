const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const arrowAttributes = {
  viewBox: "-14 -10 28 20",
  refX: 0,
  refY: 0,
  markerWidth: 10,
  markerHeight: 10,
  orient: "auto",
};
const boxAttributes = {
  viewBox: "-10 -10 20 20",
  refY: 0,
  markerWidth: 20,
  markerHeight: 20,
  markerUnits: "userSpaceOnUse",
  orient: "auto",
};
const boxPath = "M0,-8L8,0L0,8L-8,0Z";
const definitions = {
  "arrow-end": { attributes: arrowAttributes, path: "M0,0L-12,8L-12,-8Z" },
  "arrow-start": { attributes: arrowAttributes, path: "M0,0L12,-8L12,8Z" },
  "box-start": { attributes: { ...boxAttributes, refX: -8 }, path: boxPath },
  "box-end": { attributes: { ...boxAttributes, refX: 8 }, path: boxPath },
};
const documentTemplates = new WeakMap();

/**
 * Only fixed SVG geometry is shared: at most four detached templates per
 * document. Every mounted marker owns its ID, datum, classes and hover state;
 * templates hold no property, drawing or event-handler references.
 */
export function appendLinkMarker(container, property, kind) {
  const marker = container
    .append(function () {
      const document = this.ownerDocument;
      let templates = documentTemplates.get(document);
      if (!templates) {
        templates = new Map();
        documentTemplates.set(document, templates);
      }
      let template = templates.get(kind);
      if (!template) {
        const { attributes, path } = definitions[kind];
        template = document.createElementNS(SVG_NAMESPACE, "marker");
        for (const [name, value] of Object.entries(attributes)) {
          template.setAttribute(name, value);
        }
        const shape = document.createElementNS(SVG_NAMESPACE, "path");
        shape.setAttribute("d", path);
        template.appendChild(shape);
        templates.set(kind, template);
      }
      return template.cloneNode(true);
    })
    .datum(property)
    .attr("id", property.markerId());
  // D3 selection propagates the owning marker's datum to its cloned path.
  marker
    .select(function () {
      return this.firstChild;
    })
    .classed(property.markerType(), true);
  property.markerElement(marker);
  return marker;
}
