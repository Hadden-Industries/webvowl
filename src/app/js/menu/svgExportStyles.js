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

module.exports = function createExportSvgClone(liveSvg, getComputedStyle) {
  const readComputedStyle =
    getComputedStyle || window.getComputedStyle.bind(window);
  const exportedSvg = liveSvg.cloneNode(true);
  const liveElements = [liveSvg].concat(
    Array.from(liveSvg.querySelectorAll("*")),
  );
  const exportedElements = [exportedSvg].concat(
    Array.from(exportedSvg.querySelectorAll("*")),
  );

  liveElements.forEach(function (liveElement, index) {
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
  });

  exportedSvg.querySelectorAll(".hidden-in-export").forEach(function (element) {
    element.remove();
  });
  exportedSvg.setAttribute("version", "1.1");
  exportedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return exportedSvg;
};
