import { jest } from "@jest/globals";
import { createNodesShownControl } from "./nodesShownControl.js";
class Element extends EventTarget {
  value = "0";
  textContent = "";
  attributes = new Map();
  get valueAsNumber() {
    return this.value === "" ? NaN : Number(this.value);
  }
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
}
function setup() {
  const controls = Object.fromEntries(
    [
      "range",
      "exact",
      "minus",
      "plus",
      "all",
      "auto",
      "total-value",
      "error",
    ].map((name) => [name, new Element()]),
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
test("endpoint total, native maximum, zero and accessible shortfall follow eligibility", () => {
  const { controls, control, render } = setup();
  render(73, 73, { mode: "exact", requestedCount: 100 });
  expect(controls["total-value"].textContent).toBe("73");
  expect(controls.exact.max).toBe("73");
  expect(controls.range.attributes.get("aria-valuetext")).toContain(
    "Target 100",
  );
  render(0, 0);
  expect(controls.minus.disabled).toBe(true);
  expect(controls["total-value"].textContent).toBe("0");
  expect(controls.range.attributes.get("aria-valuetext")).toContain("No nodes");
  control.renderNodeCountStatus(null);
  expect(controls.exact.disabled).toBe(true);
  expect(controls.exact.value).toBe("0");
  expect(controls.range.attributes.has("aria-valuetext")).toBe(false);
  control.dispose();
});

test("a delayed successful request keeps the current count and total without status timers", async () => {
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
  expect(controls.exact.value).toBe("37");
  expect(controls["total-value"].textContent).toBe("109");
  resolve();
  await flush();
  await flush();
  expect(controls.exact.value).toBe("37");
  expect(controls["total-value"].textContent).toBe("109");
  control.dispose();
});

test.each(["", "-1", "1.5", "110", "9007199254740992"])(
  "native numeric draft %j rejects without changing membership",
  async (value) => {
    const { controls, onChange, control } = setup();
    controls.exact.value = value;
    controls.exact.dispatchEvent(new Event("input"));
    key(controls.exact, "Enter");
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(controls.exact.attributes.get("aria-invalid")).toBe("true");
    control.dispose();
  },
);

test("native integer numeric notation and zero commit as exact counts", async () => {
  const { controls, onChange, control } = setup();
  for (const value of ["1e2", "100.0", "0"]) {
    controls.exact.value = value;
    controls.exact.dispatchEvent(new Event("input"));
    key(controls.exact, "Enter");
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "exact",
      requestedCount: Number(value),
    });
  }
  control.dispose();
});
