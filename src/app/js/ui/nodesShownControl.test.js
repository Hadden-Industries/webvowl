import { jest } from "@jest/globals";
import { createNodesShownControl } from "./nodesShownControl.js";
class Element extends EventTarget {
  value = "0";
  textContent = "";
  attributes = new Map();
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
}
function setup() {
  const controls = Object.fromEntries(
    ["range", "exact", "minus", "plus", "all", "auto", "status", "error"].map(
      (name) => [name, new Element()],
    ),
  );
  const onChange = jest.fn();
  const frames = [];
  const control = createNodesShownControl({
    documentObject: { getElementById: (id) => controls[id.slice(11)] },
    onChange,
    requestFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame: jest.fn(),
  });
  control.setup();
  const render = (shown = 50, eligible = 109, intent = { mode: "auto" }) =>
    control.renderNodeCountStatus(
      { shownNodeCount: shown, eligibleNodeCount: eligible },
      intent,
    );
  render();
  return { controls, onChange, control, render, frames };
}
const key = (element, value) => {
  const event = new Event("keydown", { cancelable: true });
  event.key = value;
  element.dispatchEvent(event);
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("exact input commits on Enter/blur; invalid drafts and Escape retain committed membership", async () => {
  const { controls, onChange, control, render } = setup();
  controls.exact.value = "37";
  controls.exact.dispatchEvent(new Event("input"));
  render(50);
  expect(controls.exact.value).toBe("37");
  key(controls.exact, "Enter");
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 37,
  });
  controls.exact.value = "500";
  controls.exact.dispatchEvent(new Event("input"));
  controls.exact.dispatchEvent(new Event("blur"));
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(controls.error.textContent).toContain("0 to 109");
  key(controls.exact, "Escape");
  expect(controls.exact.value).toBe("50");
  control.dispose();
});
test("range exploration coalesces, endpoints remain exact and All is a distinct intent", async () => {
  const { controls, onChange, control, frames } = setup();
  for (const value of ["37", "38", "109"]) {
    controls.range.value = value;
    controls.range.dispatchEvent(new Event("input"));
  }
  expect(frames).toHaveLength(1);
  expect(controls.exact.value).toBe("109");
  frames[0]();
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 109,
  });
  controls.all.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({ mode: "all" });
  control.dispose();
});
test("wheel scrolling is never cancelled or bound to count; buttons use the applied count", async () => {
  const { controls, onChange, control } = setup();
  const wheel = new Event("wheel", { cancelable: true });
  controls.range.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  controls.plus.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 51,
  });
  control.dispose();
});
test("zero, shortfall, disposal and unavailable document status stay truthful", () => {
  jest.useFakeTimers();
  const { controls, control, render } = setup();
  render(73, 73, { mode: "exact", requestedCount: 100 });
  jest.advanceTimersByTime(100);
  expect(controls.status.textContent).toContain("Target 100");
  render(0, 0);
  jest.advanceTimersByTime(100);
  expect(controls.minus.disabled).toBe(true);
  expect(controls.status.textContent).toContain("No nodes");
  control.renderNodeCountStatus(null);
  expect(controls.exact.disabled).toBe(true);
  control.dispose();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test("a delayed successful request restores settled status without a second count publication", async () => {
  jest.useFakeTimers();
  const { controls, onChange, control, render } = setup();
  let resolve;
  const pending = new Promise((yes) => {
    resolve = yes;
  });
  onChange.mockImplementation(() => {
    render(37, 109, { mode: "exact", requestedCount: 37 });
    return pending;
  });
  controls.exact.value = "37";
  controls.exact.dispatchEvent(new Event("input"));
  key(controls.exact, "Enter");
  await flush();
  jest.advanceTimersByTime(250);
  expect(controls.status.textContent).toBe("Updating graph…");
  resolve();
  await flush();
  await flush();
  expect(controls.status.textContent).toBe(
    "Showing 37 of 109 available nodes.",
  );
  control.dispose();
  jest.useRealTimers();
});
