import { expect, jest, test } from "@jest/globals";
import { createVisualViewportMetrics } from "./visualViewportMetrics.js";

test.each([true, false])(
  "publishes before any consumer opens and coalesces viewport events (native=%s)",
  (native) => {
    const windowObject = new EventTarget();
    const properties = new Map();
    const documentObject = {
      documentElement: {
        style: { setProperty: (name, value) => properties.set(name, value) },
      },
    };
    windowObject.innerHeight = 800;
    windowObject.innerWidth = 600;
    windowObject.requestAnimationFrame = jest.fn(() => 1);
    windowObject.cancelAnimationFrame = jest.fn();
    const viewport = Object.assign(new EventTarget(), {
      height: 500,
      width: 375,
      offsetTop: 10,
      offsetLeft: 0,
    });
    if (native) {
      windowObject.visualViewport = viewport;
    }
    const metrics = createVisualViewportMetrics({
      windowObject,
      documentObject,
    });
    expect(properties.get("--visual-viewport-height")).toBe(
      native ? "500px" : "800px",
    );
    windowObject.dispatchEvent(new Event("resize"));
    windowObject.dispatchEvent(new Event("orientationchange"));
    viewport.dispatchEvent(new Event("scroll"));
    expect(windowObject.requestAnimationFrame).toHaveBeenCalledTimes(1);
    viewport.height = 300;
    windowObject.innerHeight = 400;
    windowObject.requestAnimationFrame.mock.calls[0][0]();
    expect(properties.get("--visual-viewport-height")).toBe(
      native ? "300px" : "400px",
    );
    windowObject.dispatchEvent(new Event("resize"));
    metrics.dispose();
    expect(windowObject.cancelAnimationFrame).toHaveBeenCalledWith(1);
    windowObject.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("resize"));
    expect(windowObject.requestAnimationFrame).toHaveBeenCalledTimes(2);
  },
);
