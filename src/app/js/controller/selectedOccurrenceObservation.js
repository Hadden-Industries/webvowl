import { createRenderedOccurrenceReference } from "./renderedArrangementContracts.js";

/** Renderer observation in CSS pixels relative to the graph viewport's origin. */
export function createSelectedOccurrenceObservation(value) {
  if (value === null) {
    return null;
  }
  const keys = [
    "loadGeneration",
    "documentRevision",
    "reference",
    "coordinateSpace",
    "xPx",
    "yPx",
    "widthPx",
    "heightPx",
    "shape",
    "occurrenceCount",
  ];
  if (
    !value ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new TypeError("Invalid selected-occurrence observation fields.");
  }
  const reference = createRenderedOccurrenceReference(value.reference);
  if (
    reference.loadGeneration !== value.loadGeneration ||
    !Number.isSafeInteger(value.documentRevision) ||
    value.documentRevision < 0
  ) {
    throw new RangeError(
      "Selected-occurrence observation has a stale or invalid identity.",
    );
  }
  if (
    value.coordinateSpace !== "graph-viewport-css-pixels" ||
    !["ellipse", "rectangle"].includes(value.shape) ||
    !Number.isSafeInteger(value.occurrenceCount) ||
    value.occurrenceCount < 1 ||
    ["xPx", "yPx", "widthPx", "heightPx"].some(
      (key) =>
        !Number.isFinite(value[key]) ||
        Math.abs(value[key]) > Number.MAX_SAFE_INTEGER,
    ) ||
    value.widthPx <= 0 ||
    value.heightPx <= 0
  ) {
    throw new TypeError("Invalid selected-occurrence geometry.");
  }
  return Object.freeze({ ...value, reference });
}
