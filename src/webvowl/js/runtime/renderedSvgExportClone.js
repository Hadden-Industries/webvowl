// Builds the detached, fully styled SVG the export serializes.
//
// The visualization is styled by a stylesheet, so a bare clone of the live SVG
// carries no appearance at all: opened on its own it renders as black shapes.
// Every visual property is therefore resolved from the live element's computed
// style onto its counterpart in the clone.
//
// The live SVG is never touched. Everything here happens on the clone.

const EXPORTED_VISUAL_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "visibility",
];

// Content the file has no use for: one exists only to catch a pointer, the
// other is marked as not for export. Written as literal selectors so the
// style boundary stays auditable by reading this list.
const EXCLUDED_FROM_EXPORT_SELECTORS = [
  ".vowl-interaction-only",
  ".hidden-in-export",
];

export function createRenderedSvgExportClone(
  liveSvg,
  getComputedStyle,
  viewportDimensions,
) {
  // Resolving styles needs a browser to compute them. Outside one there is
  // nothing to read, so the clone is still framed and cleaned but carries no
  // resolved appearance; the module's own tests supply a reader directly.
  const readComputedStyle =
    getComputedStyle ?? globalThis.getComputedStyle?.bind(globalThis);
  const exportedSvg = liveSvg.cloneNode(true);
  const liveElements = [liveSvg].concat(
    Array.from(liveSvg.querySelectorAll("*")),
  );
  const exportedElements = [exportedSvg].concat(
    Array.from(exportedSvg.querySelectorAll("*")),
  );

  (readComputedStyle ? liveElements : []).forEach(
    function (liveElement, index) {
      const exportedElement = exportedElements[index];
      if (!exportedElement || !exportedElement.style) {
        return;
      }
      const computedStyle = readComputedStyle(liveElement);
      EXPORTED_VISUAL_PROPERTIES.forEach(function (propertyName) {
        const propertyValue = computedStyle.getPropertyValue(propertyName);
        if (propertyValue) {
          exportedElement.style.setProperty(propertyName, propertyValue);
        }
      });
    },
  );

  EXCLUDED_FROM_EXPORT_SELECTORS.forEach(function (selector) {
    exportedSvg.querySelectorAll(selector).forEach(function (element) {
      element.remove();
    });
  });
  exportedSvg.setAttribute("version", "1.1");
  exportedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  // An exported view is the view on screen. The drawn content is positioned
  // for the live viewport, so framing the clone on any other canvas would clip
  // a graph the reader can see.
  if (viewportDimensions) {
    const { widthPx, heightPx } = viewportDimensions;
    exportedSvg.setAttribute("width", String(widthPx));
    exportedSvg.setAttribute("height", String(heightPx));
    exportedSvg.setAttribute("viewBox", `0 0 ${widthPx} ${heightPx}`);
  }
  return exportedSvg;
}
