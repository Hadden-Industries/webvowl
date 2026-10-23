import { expect, jest, test } from "@jest/globals";
import { createBackgroundSelectionGesture } from "./backgroundSelectionGesture.js";

const event = (more = {}) => ({
  target: "canvas",
  button: 0,
  pointerId: 1,
  pointerType: "mouse",
  clientX: 100,
  clientY: 100,
  ...more,
});
function setup() {
  const clear = jest.fn();
  return {
    clear,
    gesture: createBackgroundSelectionGesture({
      isBackground: (target) => target === "canvas",
      clear,
    }),
  };
}
test("an unmoved canvas click clears once while element clicks stay owned by the renderer", () => {
  const { clear, gesture } = setup();
  gesture.down(event());
  gesture.up(event());
  gesture.click(event());
  expect(clear).toHaveBeenCalledTimes(1);
  gesture.down(event({ target: "node" }));
  gesture.up(event());
  gesture.click(event());
  expect(clear).toHaveBeenCalledTimes(1);
});
test.each(["pan", "touch pan", "cancel", "pinch", "prevented"])(
  "%s does not clear selection",
  (kind) => {
    const { clear, gesture } = setup();
    const start = event({
      pointerType: kind.startsWith("touch") ? "touch" : "mouse",
    });
    gesture.down(start);
    if (kind.includes("pan")) {
      gesture.move(event({ clientX: 120 }));
    }
    if (kind === "cancel") {
      gesture.cancel(event());
    }
    if (kind === "pinch") {
      gesture.down(event({ pointerId: 2 }));
      gesture.up(event({ pointerId: 2 }));
    }
    gesture.up(event());
    gesture.click(event({ defaultPrevented: kind === "prevented" }));
    expect(clear).not.toHaveBeenCalled();
  },
);
