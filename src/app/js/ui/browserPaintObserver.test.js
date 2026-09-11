import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let createBrowserPaintObserver;
beforeAll(async () => {
  ({ createBrowserPaintObserver } = await loadEsmModuleForTest(
    new URL("./browserPaintObserver.js", import.meta.url),
    import.meta.url,
  ));
});

function createFrames() {
  const scheduled = new Map();
  let nextHandle = 0;
  return {
    scheduled,
    requestAnimationFrame(callback) {
      scheduled.set(++nextHandle, callback);
      return nextHandle;
    },
    cancelAnimationFrame(handle) {
      scheduled.delete(handle);
    },
    frame() {
      const callbacks = [...scheduled.values()];
      scheduled.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

describe("browser paint observation", () => {
  test("allows a paint between two animation frames before completing", async () => {
    const frames = createFrames();
    const observe = createBrowserPaintObserver(frames);
    let complete = false;
    const observation = observe().then(() => {
      complete = true;
    });
    frames.frame();
    for (let turn = 0; turn < 3; turn++) {
      await Promise.resolve();
    }
    expect(complete).toBe(false);
    frames.frame();
    await observation;
    expect(complete).toBe(true);
    expect(frames.scheduled.size).toBe(0);
  });

  test.each([0, 1])(
    "cancels every pending frame after %i frames",
    async (elapsedFrames) => {
      const frames = createFrames();
      const observe = createBrowserPaintObserver(frames);
      const caller = new AbortController();
      const observation = observe({ signal: caller.signal });
      const outcome = observation.then(
        () => "completed",
        (error) => error.name,
      );
      for (let frame = 0; frame < elapsedFrames; frame++) {
        frames.frame();
      }
      caller.abort();
      expect(frames.scheduled.size).toBe(0);
      expect(await outcome).toBe("AbortError");
    },
  );
});
