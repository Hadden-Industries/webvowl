import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let nextContinuousZoomScale;

beforeAll(async () => {
  ({ nextContinuousZoomScale } = await loadEsmModuleForTest(
    new URL("./continuousZoomRamp.js", import.meta.url),
    import.meta.url,
  ));
});

const MAGNIFICATION_BOUNDS = Object.freeze({
  minimumMagnification: 0.1,
  maximumMagnification: 4,
});

describe("continuous zoom ramp", () => {
  test.each([60, 120])(
    "reaches the same magnification at %i Hz for the same elapsed time",
    (refreshRate) => {
      let zoomScale = 1;
      for (let frame = 0; frame < refreshRate; frame += 1) {
        // One second of holding, however often the display refreshes.
        ({ zoomScale } = nextContinuousZoomScale({
          ...MAGNIFICATION_BOUNDS,
          zoomScale,
          zoomDirection: 1,
          elapsedFrames: 60 / refreshRate,
        }));
      }

      expect(zoomScale).toBeCloseTo(Math.pow(1.02, 60), 6);
    },
  );

  test("zooming out is the exact inverse ramp of zooming in", () => {
    const zoomedIn = nextContinuousZoomScale({
      ...MAGNIFICATION_BOUNDS,
      zoomScale: 1,
      zoomDirection: 1,
      elapsedFrames: 1,
    });
    const zoomedOut = nextContinuousZoomScale({
      ...MAGNIFICATION_BOUNDS,
      zoomScale: 1,
      zoomDirection: -1,
      elapsedFrames: 1,
    });

    expect(zoomedIn.zoomScale).toBeCloseTo(1.02, 10);
    expect(zoomedOut.zoomScale).toBeCloseTo(0.98, 10);
  });

  test.each([
    ["in", 1, 3.99, 4],
    ["out", -1, 0.101, 0.1],
  ])(
    "clamps at the %s boundary and reports that the ramp ended",
    (label, zoomDirection, zoomScale, expectedZoomScale) => {
      const rampStep = nextContinuousZoomScale({
        ...MAGNIFICATION_BOUNDS,
        zoomScale,
        zoomDirection,
        elapsedFrames: 1,
      });

      expect(rampStep.zoomScale).toBe(expectedZoomScale);
      expect(rampStep.hasReachedBoundary).toBe(true);
    },
  );

  test("reports that the ramp continues while inside the bounds", () => {
    const rampStep = nextContinuousZoomScale({
      ...MAGNIFICATION_BOUNDS,
      zoomScale: 1,
      zoomDirection: 1,
      elapsedFrames: 1,
    });

    expect(rampStep.hasReachedBoundary).toBe(false);
  });
});
