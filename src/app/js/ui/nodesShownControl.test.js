import { jest } from "@jest/globals";
import { createNodesShownControl } from "./nodesShownControl.js";
import { createNodeCountAdjustment } from "../controller/nodeCountAdjustment.js";
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
    [
      "range",
      "exact",
      "minus",
      "plus",
      "fifty",
      "markers",
      "total-value",
      "total-description",
      "status",
    ].map((name) => [name, new Element()]),
  );
  const onChange = jest.fn();
  let control = null;
  const popover = new EventTarget();
  const documentObject = new EventTarget();
  documentObject.visibilityState = "visible";
  documentObject.getElementById = (id) =>
    id === "m_filter" ? popover : controls[id.slice(11)];
  let status = { shownNodeCount: 50, eligibleNodeCount: 109 };
  let acceptedIntent = { mode: "auto" };
  let adjustmentState = null;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const apply = async (intent) => {
    await onChange(intent);
    acceptedIntent = intent;
    status = {
      ...status,
      shownNodeCount:
        intent.mode === "all"
          ? status.eligibleNodeCount
          : Math.min(intent.requestedCount, status.eligibleNodeCount),
    };
    control.renderNodeCountStatus(status, intent, adjustmentState);
  };
  const adjustment = createNodeCountAdjustment({
    readAccepted: () => ({
      loadGeneration: 1,
      documentRevision: 0,
      nodesShown: acceptedIntent,
    }),
    apply,
    holdLayout: () => ({ prepareInstallation() {}, release() {} }),
    publish(next) {
      adjustmentState = next;
      control.renderNodeCountStatus(status, acceptedIntent, next);
    },
    reportError: (error) => {
      throw error;
    },
    clock: {
      now: () => now,
      setTimeout(callback, delay) {
        const id = ++nextTimer;
        timers.set(id, { callback, due: now + delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  });
  control = createNodesShownControl({
    documentObject,
    onChange: (intent) => {
      adjustment.cancel();
      return apply(intent);
    },
    onAdjust: (intent) => adjustment.stage(intent),
    onFlush: () => adjustment.flush(),
    onVisibility: (visible) => adjustment.setVisible(visible),
  });
  control.setup();
  const render = (shown = 50, eligible = 109, intent = { mode: "auto" }) => {
    status = { shownNodeCount: shown, eligibleNodeCount: eligible };
    acceptedIntent = intent;
    control.renderNodeCountStatus(status, intent, adjustmentState);
  };
  render();
  return {
    controls,
    onChange,
    popover,
    documentObject,
    render,
    control: {
      ...control,
      dispose() {
        adjustment.dispose();
        control.dispose();
      },
    },
    async advance(ms) {
      await flush();
      now += ms;
      for (const [id, entry] of [...timers]) {
        if (entry.due <= now) {
          timers.delete(id);
          entry.callback();
        }
      }
      await flush();
    },
  };
}
const key = (element, value) => {
  const event = new Event("keydown", { cancelable: true });
  event.key = value;
  element.dispatchEvent(event);
};
async function flush() {
  for (let turn = 0; turn < 20; turn++) {
    await Promise.resolve();
  }
}

test.each(["preparing", "failed"])(
  "%s ordering disables count inputs with an accessible status",
  async (orderingStatus) => {
    const { controls, onChange, control } = setup();
    try {
      control.renderNodeCountStatus(
        { shownNodeCount: 50, eligibleNodeCount: 109, orderingStatus },
        { mode: "auto" },
      );
      for (const name of [
        "range",
        "exact",
        "minus",
        "plus",
        "fifty",
        "total-value",
      ]) {
        expect(controls[name].disabled).toBe(true);
      }
      expect(controls.status.hidden).toBe(false);
      expect(controls.status.textContent).toMatch(
        orderingStatus === "preparing" ? /Preparing/ : /Reload/,
      );
      controls.plus.dispatchEvent(new Event("click"));
      controls["total-value"].dispatchEvent(new Event("click"));
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      control.renderNodeCountStatus(
        { shownNodeCount: 50, eligibleNodeCount: 109, orderingStatus: "ready" },
        { mode: "auto" },
      );
      expect(controls.range.disabled).toBe(false);
      expect(controls.exact.disabled).toBe(false);
      expect(controls.status.hidden).toBe(true);
    } finally {
      control.dispose();
    }
  },
);

test("a range burst spanning animation frames does not apply intermediate counts", async () => {
  const { controls, onChange, control, advance } = setup();
  try {
    controls.range.value = "61";
    controls.range.dispatchEvent(new Event("input"));
    await advance(16);
    controls.range.value = "73";
    controls.range.dispatchEvent(new Event("input"));
    await advance(16);
    expect(controls.exact.value).toBe("73");
    expect(onChange).not.toHaveBeenCalled();
    await advance(33);
    expect(onChange).not.toHaveBeenCalled();
    await advance(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      mode: "exact",
      requestedCount: 73,
    });
  } finally {
    control.dispose();
  }
});

test("a burst updates requested counts without inserting adjustment helper text", async () => {
  const h = setup();
  const announcements = [];
  let text = "";
  Object.defineProperty(h.controls.status, "textContent", {
    get: () => text,
    set(value) {
      text = value;
      announcements.push(value);
    },
  });
  try {
    for (const count of [61, 72, 73]) {
      h.controls.range.value = String(count);
      h.controls.range.dispatchEvent(new Event("input"));
      await h.advance(16);
    }
    expect(announcements).toEqual([]);
    expect(h.controls.status.hidden).toBe(true);
    expect(h.controls.exact.value).toBe("73");
    await h.advance(50);
    expect(announcements).toEqual([]);
    expect(h.controls.status.hidden).toBe(true);
  } finally {
    h.control.dispose();
  }
});

test("closing Filters flushes the latest range input once even at the timer boundary", async () => {
  const h = setup();
  try {
    h.controls.range.value = "73";
    h.controls.range.dispatchEvent(new Event("input"));
    const close = new Event("toggle");
    close.newState = "closed";
    h.popover.dispatchEvent(close);
    await h.advance(1000);
    expect(h.onChange.mock.calls).toEqual([
      [{ mode: "exact", requestedCount: 73 }],
    ]);
    expect(h.controls.status.hidden).toBe(true);
  } finally {
    h.control.dispose();
  }
});

test("requested count is announced separately, and the preset replaces a pending count immediately", async () => {
  const h = setup();
  try {
    h.controls.range.value = "73";
    h.controls.range.dispatchEvent(new Event("input"));
    await flush();
    expect(h.controls.range.attributes.get("aria-valuetext")).toBe(
      "Requested 73; currently showing 50 of 109 available nodes.",
    );
    expect(h.controls.status.hidden).toBe(true);
    expect(h.controls.fifty.disabled).toBe(false);
    h.controls.fifty.dispatchEvent(new Event("click"));
    await flush();
    expect(h.onChange.mock.calls).toEqual([
      [{ mode: "exact", requestedCount: 50 }],
    ]);
    await h.advance(2000);
    expect(h.onChange).toHaveBeenCalledTimes(1);
    expect(h.controls.exact.value).toBe("50");
    expect(h.controls.status.hidden).toBe(true);
  } finally {
    h.control.dispose();
  }
});

test("a hidden page defers the draft and applies it when visible again", async () => {
  const h = setup();
  try {
    h.controls.range.value = "73";
    h.controls.range.dispatchEvent(new Event("input"));
    await flush();
    h.documentObject.visibilityState = "hidden";
    h.documentObject.dispatchEvent(new Event("visibilitychange"));
    await h.advance(2000);
    expect(h.onChange).not.toHaveBeenCalled();
    h.documentObject.visibilityState = "visible";
    h.documentObject.dispatchEvent(new Event("visibilitychange"));
    await h.advance(0);
    expect(h.onChange).toHaveBeenCalledTimes(1);
    expect(h.controls.exact.value).toBe("73");
  } finally {
    h.control.dispose();
  }
});

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
  const { controls, onChange, control, advance } = setup();
  for (const value of ["37", "38", "109"]) {
    controls.range.value = value;
    controls.range.dispatchEvent(new Event("input"));
  }
  expect(controls.exact.value).toBe("109");
  await advance(1000);
  expect(onChange).toHaveBeenLastCalledWith({ mode: "all" });
  controls.range.dispatchEvent(new Event("change"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({ mode: "all" });
  for (const value of ["0", "49", "50", "51", "108"]) {
    controls.range.value = value;
    controls.range.dispatchEvent(new Event("change"));
    await advance(1000);
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

test("the total shortcut selects All immediately and replaces a pending count", async () => {
  const h = setup();
  try {
    expect(h.controls["total-value"].disabled).toBe(false);
    expect(h.controls["total-value"].attributes.get("aria-label")).toBe(
      "Show all 109 available nodes",
    );
    expect(h.controls["total-description"].textContent).toBe(
      "Available nodes: 109.",
    );
    h.controls.range.value = "73";
    h.controls.range.dispatchEvent(new Event("input"));
    await flush();
    h.controls["total-value"].dispatchEvent(new Event("click"));
    await flush();
    expect(h.onChange.mock.calls).toEqual([[{ mode: "all" }]]);
    expect(h.controls.exact.value).toBe("109");
    expect(h.controls["total-value"].disabled).toBe(true);
    h.controls["total-value"].dispatchEvent(new Event("click"));
    await h.advance(2000);
    expect(h.onChange).toHaveBeenCalledTimes(1);
    h.render(50, 953);
    expect(h.controls["total-value"].disabled).toBe(false);
    expect(h.controls["total-value"].attributes.get("aria-label")).toBe(
      "Show all 953 available nodes",
    );
    h.render(0, 0);
    expect(h.controls["total-value"].disabled).toBe(true);
    h.controls["total-value"].dispatchEvent(new Event("click"));
    h.control.renderNodeCountStatus(null);
    expect(h.controls["total-value"].disabled).toBe(true);
    await flush();
    expect(h.onChange).toHaveBeenCalledTimes(1);
  } finally {
    h.control.dispose();
  }
});

test("the selectable 50 marker follows eligibility and restores an unfinished draft", async () => {
  const { controls, onChange, control, render } = setup();
  render(50, 100);
  expect(controls.fifty.hidden).toBe(false);
  expect(controls.fifty.disabled).toBe(true);
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).not.toHaveBeenCalled();
  expect(controls.markers.style.setProperty).toHaveBeenLastCalledWith(
    "--nodes-shown-fifty-position",
    "50%",
  );
  render(49, 100);
  expect(controls.fifty.disabled).toBe(false);
  controls.exact.value = "1.5";
  controls.exact.dispatchEvent(new Event("input"));
  key(controls.exact, "Enter");
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 50,
  });
  render(50, 100, { mode: "exact", requestedCount: 50 });
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
test("FOAF's filter cycle restores the 50 shortcut only when another count is shown", async () => {
  const { controls, onChange, control, render } = setup();
  render(50, 56);
  expect(controls.fifty.hidden).toBe(false);
  render(29, 29);
  expect(controls.fifty.hidden).toBe(true);
  expect(controls.fifty.disabled).toBe(true);
  render(50, 56);
  expect(controls.fifty.hidden).toBe(false);
  expect(controls.fifty.disabled).toBe(true);
  render(51, 56);
  expect(controls.fifty.disabled).toBe(false);
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 50,
  });
  render(50, 56, { mode: "exact", requestedCount: 50 });
  expect(controls.fifty.disabled).toBe(true);
  controls.fifty.dispatchEvent(new Event("click"));
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  control.dispose();
});
test("wheel scrolling is never cancelled or bound to count; buttons accumulate requested counts", async () => {
  const { controls, onChange, control, advance } = setup();
  const wheel = new Event("wheel", { cancelable: true });
  controls.range.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(false);
  expect(onChange).not.toHaveBeenCalled();
  controls.plus.dispatchEvent(new Event("click"));
  controls.plus.dispatchEvent(new Event("click"));
  controls.plus.dispatchEvent(new Event("click"));
  expect(controls.exact.value).toBe("53");
  await advance(1000);
  expect(onChange).toHaveBeenLastCalledWith({
    mode: "exact",
    requestedCount: 53,
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
