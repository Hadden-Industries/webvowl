// A detached value description of the rendered shapes. Coordinates, bounds
// and widths use graph pixels; neither DOM nor renderer objects cross this seam.
export function createRenderedDrawingSnapshot(snapshot) {
  if (
    !Number.isSafeInteger(snapshot?.loadGeneration) ||
    snapshot.loadGeneration < 1
  ) {
    throw new TypeError(
      "A rendered drawing needs its accepted load generation.",
    );
  }
  const copy = structuredClone(snapshot);
  function freezeValue(value) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Rendered drawing measurements must be finite.");
    }
    if (value !== null && typeof value === "object") {
      if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype
      ) {
        throw new TypeError("Rendered drawings contain plain values only.");
      }
      Object.values(value).forEach(freezeValue);
      Object.freeze(value);
    } else if (
      !["number", "string", "boolean"].includes(typeof value) &&
      value !== null
    ) {
      throw new TypeError("Rendered drawings contain plain values only.");
    }
  }
  freezeValue(copy);
  return copy;
}
