// Capture the drawing as values in graph pixels. Renderer objects and native
// path measurements stay on this side of the runtime boundary.
import { color } from "d3";

export function captureRenderedDrawing({
  nodes,
  propertyLabels,
  links,
  math,
  viewport,
  svgRoot,
  compactNotation,
  readComputedStyle,
}) {
  const point = (value) => ({ x: value.x, y: value.y });
  function backgroundColor(element) {
    const value = element.backgroundColor();
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = color(value);
    if (parsed === null) {
      throw new TypeError("The rendered background color is invalid.");
    }
    return parsed.formatHex();
  }
  function textAppearance(element) {
    const textElement = element.textBlock?.()?._textBlock?.()?.node();
    return {
      label: element.labelForCurrentLanguage() ?? "",
      textColor: textElement ? readComputedStyle(textElement).fill : "",
      textLines: textElement
        ? Array.from(textElement.children, (span) => span.textContent ?? "")
        : [],
    };
  }
  function propertyAppearance(property) {
    return {
      ...textAppearance(property),
      vowlType: property.type(),
      attributes: [...property.attributes()],
      backgroundColor: backgroundColor(property),
      widthPx: property.textWidth(),
    };
  }
  const svgBounds = svgRoot.getBoundingClientRect();
  let contentBounds = null;
  for (const element of svgRoot.querySelectorAll(
    ".nodeContainer .class, .labelContainer .property, .linkContainer path, .cardinalityContainer > *",
  )) {
    if (element.closest(".hidden-in-export, .hidden")) {
      continue;
    }
    const rectangle = element.getBoundingClientRect();
    const clipped = {
      left: Math.max(0, rectangle.left - svgBounds.left),
      top: Math.max(0, rectangle.top - svgBounds.top),
      right: Math.min(viewport.widthPx, rectangle.right - svgBounds.left),
      bottom: Math.min(viewport.heightPx, rectangle.bottom - svgBounds.top),
    };
    if (
      clipped.right < clipped.left ||
      clipped.bottom < clipped.top ||
      (clipped.right === clipped.left && clipped.bottom === clipped.top)
    ) {
      continue;
    }
    contentBounds =
      contentBounds === null
        ? clipped
        : {
            left: Math.min(contentBounds.left, clipped.left),
            top: Math.min(contentBounds.top, clipped.top),
            right: Math.max(contentBounds.right, clipped.right),
            bottom: Math.max(contentBounds.bottom, clipped.bottom),
          };
  }
  // Keep the previous content-tightened framing, using native shape measurements
  // without hiding/restoring live halos. A very small magnification must not turn
  // a small drawing into viewport coordinates outside TeX's dimension range.
  const bounds =
    contentBounds === null
      ? { leftPx: 0, topPx: 0, rightPx: 1, bottomPx: 1 }
      : {
          leftPx:
            (contentBounds.left - viewport.translationXPx) / viewport.zoomScale,
          topPx:
            (contentBounds.top - viewport.translationYPx) / viewport.zoomScale,
          rightPx:
            (contentBounds.right - viewport.translationXPx) /
            viewport.zoomScale,
          bottomPx:
            (contentBounds.bottom - viewport.translationYPx) /
            viewport.zoomScale,
        };
  return {
    bounds,
    compactNotation,
    nodes: nodes.map((node) => ({
      ...point(node),
      ...textAppearance(node),
      vowlType: node.type(),
      attributes: [...node.attributes()],
      backgroundColor: backgroundColor(node),
      widthPx: ["rdfs:Literal", "rdfs:Datatype"].includes(node.type())
        ? node.width()
        : 2 * node.actualRadius(),
      individualCount: node.individuals?.()?.length ?? 0,
    })),
    propertyLabels: propertyLabels.map((label) => ({
      ...point(label),
      ...propertyAppearance(label.property()),
      inverse: label.property().inverse()
        ? propertyAppearance(label.property().inverse())
        : null,
    })),
    links: links.map((link) => {
      const property = link.property();
      const isSingle = link.layers().length === 1 && !link.loops();
      let points;
      if (isSingle) {
        const start = math.calculateIntersection(
          link.range(),
          link.domain(),
          1,
        );
        const end = math.calculateIntersection(link.domain(), link.range(), 1);
        points = [start, math.calculateCenter(start, end), end];
      } else if (link.isLoop()) {
        points = math.calculateLoopPoints(link);
      } else {
        const center = link.label();
        points = [
          math.calculateIntersection(center, link.domain(), 1),
          center,
          math.calculateIntersection(center, link.range(), 1),
        ];
      }
      const result = {
        vowlType: property.type(),
        linkType: property.linkType?.() ?? "",
        isSingle,
        isLoop: Boolean(link.isLoop?.()),
        points: points.map(point),
        marker: null,
        inverseMarker: null,
        cardinalityText: property.generateCardinalityText?.() ?? "",
      };
      if (property.markerElement() !== undefined) {
        const path = link.pathObj().node();
        const length = Math.floor(path.getTotalLength());
        const sample = (distance) =>
          point(path.getPointAtLength(Math.max(0, Math.min(length, distance))));
        const isSetOperator = property.type() === "setOperatorProperty";
        result.marker = {
          start: sample(isSetOperator ? 4 : length - 4),
          end: sample(isSetOperator ? 0 : length),
          center: sample(isSetOperator ? 8 : length - 6),
          cardinalityCenter: sample(length - 18),
        };
        if (property.inverse()) {
          result.inverseMarker = {
            start: sample(4),
            end: sample(0),
            center: sample(6),
          };
        }
      }
      return result;
    }),
  };
}
