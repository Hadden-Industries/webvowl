/** Renderer-local SVG presentation. Geometry and event ownership stay with callers. */
export function appendDragHandleGroup(layer) {
  return layer.append("g");
}

export function drawDragHandle({
  pathLayer,
  rootNodeLayer,
  pathData,
  useAccuracyHelper,
  createAccuracyTarget = useAccuracyHelper,
  showDraggerObject,
}) {
  const pathElement = pathLayer
    .append("line")
    .classed("classNodeDragPath", true)
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", 0);
  const nodeElement = rootNodeLayer
    .append("path")
    .attr("d", pathData)
    .classed("classDraggerNode", true);
  const draggerObject = createAccuracyTarget
    ? rootNodeLayer.append("circle")
    : undefined;
  if (useAccuracyHelper) {
    draggerObject
      .attr("r", 40)
      .attr("cx", 0)
      .attr("cy", 0)
      .classed("superHiddenElement", true)
      .classed("superOpacityElement", !showDraggerObject);
  }
  return { pathElement, nodeElement, draggerObject };
}

export function hideDragHandle(
  { pathElement, nodeElement, draggerObject },
  hidden,
) {
  for (const element of [pathElement, nodeElement, draggerObject]) {
    if (element) {
      element.classed("hidden", hidden);
    }
  }
}
