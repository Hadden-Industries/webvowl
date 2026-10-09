import { jest } from "@jest/globals";
import { createNodesShownControl } from "./nodesShownControl.js";
class Element extends EventTarget {
  value = "0";
  textContent = "";
  style = { setProperty: jest.fn() };
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
    ["range", "exact", "minus", "plus", "fifty", "markers", "total-value"].map(
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

test("exact input normalizes on Enter/blur and restores unreadable drafts and Escape", async () => {
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
  render(50, 56);
  controls.exact.value = "5112";
  controls.exact.dispatchEvent(new Event("input"));
  controls.exact.dispatchEvent(new Event("blur"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 56,
  });
  expect(controls.exact.value).toBe("56");
  expect(controls.exact.attributes.has("aria-invalid")).toBe(false);
  render(56, 56, { mode: "exact", requestedCount: 56 });
  controls.exact.value = "1.5";
  controls.exact.dispatchEvent(new Event("input"));
  expect(controls.exact.value).toBe("1.5");
  controls.exact.dispatchEvent(new Event("blur"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 2,
  });
  expect(controls.exact.value).toBe("2");
  render(2, 56, { mode: "exact", requestedCount: 2 });
  controls.exact.value = "";
  controls.exact.dispatchEvent(new Event("input"));
  controls.exact.dispatchEvent(new Event("blur"));
  await flush();
  expect(onChange).toHaveBeenCalledTimes(3);
  expect(controls.exact.value).toBe("2");
  controls.exact.value = "15";
  controls.exact.dispatchEvent(new Event("input"));
  key(controls.exact, "Escape");
  expect(controls.exact.value).toBe("2");
  control.dispose();
});
test("range exploration coalesces and the maximum selects All on input and change", async () => {
  const { controls, onChange, control, frames } = setup();
  for (const value of ["37", "38", "109"]) {
    controls.range.value = value;
    controls.range.dispatchEvent(new Event("input"));
  }
  expect(frames).toHaveLength(1);
  expect(controls.exact.value).toBe("109");
  frames[0]();
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({ mode: "all" });
  controls.range.dispatchEvent(new Event("change"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({ mode: "all" });
  for (const value of ["0", "49", "50", "51", "108"]) {
    controls.range.value = value;
    controls.range.dispatchEvent(new Event("change"));
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "exact",
      requestedCount: Number(value),
    });
  }
  control.dispose();
});

test("typing the current maximum retains an exact target instead of All", async () => {
  const { controls, onChange, control } = setup();
  controls.exact.value = "109";
  controls.exact.dispatchEvent(new Event("input"));
  key(controls.exact, "Enter");
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 109,
  });
  control.dispose();
});

test("the selectable 50 marker follows eligibility and restores an unfinished draft", async () => {
  const { controls, onChange, control, render } = setup();
  render(50, 100);
  expect(controls.fifty.hidden).toBe(false);
  expect(controls.fifty.disabled).toBe(false);
  expect(controls.markers.style.setProperty).toHaveBeenLastCalledWith(
    "--nodes-shown-fifty-position",
    "50%",
  );
  controls.exact.value = "1.5";
  controls.exact.dispatchEvent(new Event("input"));
  key(controls.exact, "Enter");
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 50,
  });
  expect(controls.exact.value).toBe("50");
  expect(controls.exact.attributes.has("aria-invalid")).toBe(false);
  render(50, 10000);
  expect(controls.markers.style.setProperty).toHaveBeenLastCalledWith(
    "--nodes-shown-fifty-position",
    "0.5%",
  );
  render(50, 50);
  expect(controls.fifty.hidden).toBe(true);
  expect(controls.fifty.disabled).toBe(true);
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  render(50, 51);
  expect(controls.fifty.hidden).toBe(false);
  control.renderNodeCountStatus(null);
  expect(controls.fifty.hidden).toBe(true);
  expect(controls.fifty.disabled).toBe(true);
  control.dispose();
});
test("FOAF's 56 to 29 to 56 filter cycle restores the selectable 50 shortcut", async () => {
  const { controls, onChange, control, render } = setup();
  render(50, 56);
  expect(controls.fifty.hidden).toBe(false);
  render(29, 29);
  expect(controls.fifty.hidden).toBe(true);
  expect(controls.fifty.disabled).toBe(true);
  render(50, 56);
  expect(controls.fifty.hidden).toBe(false);
  expect(controls.fifty.disabled).toBe(false);
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 50,
  });
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

test.each(["", "unreadable", "Infinity", "-Infinity", "1e999"])(
  "unreadable numeric draft %j restores the applied count without changing membership",
  async (value) => {
    const { controls, onChange, control } = setup();
    controls.exact.value = value;
    controls.exact.dispatchEvent(new Event("input"));
    key(controls.exact, "Enter");
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(controls.exact.value).toBe("50");
    expect(controls.exact.attributes.has("aria-invalid")).toBe(false);
    control.dispose();
  },
);

test("native numeric drafts round and clamp into exact counts", async () => {
  const { controls, onChange, control } = setup();
  for (const [value, requestedCount] of [
    ["1e2", 100],
    ["100.0", 100],
    ["0", 0],
    ["-11", 0],
    ["12.49", 12],
    ["12.5", 13],
    ["-1.5", 0],
    ["110.5", 109],
    ["5112", 109],
    ["9007199254740992", 109],
  ]) {
    controls.exact.value = value;
    controls.exact.dispatchEvent(new Event("input"));
    key(controls.exact, "Enter");
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "exact",
      requestedCount,
    });
    expect(controls.exact.value).toBe(String(requestedCount));
  }
  control.dispose();
});
