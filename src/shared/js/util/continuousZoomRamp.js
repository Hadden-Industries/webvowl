// One step of the ramp a held zoom control produces.
//
// The ramp is exponential so that holding the button feels the same at any
// magnification, and it is expressed per nominal 60 Hz frame so that a display
// refreshing at another rate reaches the same magnification for the same
// elapsed time. The renderer owns the loop that calls this, because the
// viewport is renderer-owned; keeping the arithmetic here keeps it testable
// without standing up a renderer.

const ZOOM_IN_FACTOR_PER_FRAME = 1.02;
const ZOOM_OUT_FACTOR_PER_FRAME = 0.98;

export function nextContinuousZoomScale({
  zoomScale,
  zoomDirection,
  elapsedFrames,
  minimumMagnification,
  maximumMagnification,
}) {
  const stepFactor =
    zoomDirection > 0 ? ZOOM_IN_FACTOR_PER_FRAME : ZOOM_OUT_FACTOR_PER_FRAME;
  const rampedZoomScale = zoomScale * Math.pow(stepFactor, elapsedFrames);
  const hasReachedBoundary =
    zoomDirection > 0
      ? rampedZoomScale >= maximumMagnification
      : rampedZoomScale <= minimumMagnification;
  if (!hasReachedBoundary) {
    return { zoomScale: rampedZoomScale, hasReachedBoundary: false };
  }
  return {
    zoomScale: zoomDirection > 0 ? maximumMagnification : minimumMagnification,
    hasReachedBoundary: true,
  };
}
