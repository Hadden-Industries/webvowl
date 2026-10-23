import { hierarchy, tree } from "d3";

/** Pure coordinates for an application-owned, temporary spanning tree. */
export function layoutInitialTree(root, radius) {
  const forest = hierarchy(root);
  tree().size([2 * Math.PI, radius])(forest);
  return forest.descendants().map((node) => ({
    index: node.data.index,
    x: node.y * Math.cos(node.x),
    y: node.y * Math.sin(node.x),
  }));
}
