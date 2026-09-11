import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let createDegreeFilterControl;
beforeAll(async () => {
  ({ createDegreeFilterControl } = await loadEsmModuleForTest(
    new URL("./degreeFilterControl.js", import.meta.url),
    import.meta.url,
  ));
});

class ControlElement extends EventTarget {
  constructor() {
    super();
    this.value = "0";
    this.min = "0";
    this.max = "100";
    this.textContent = "";
    const classes = new Set();
    this.classList = {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, enabled) =>
        enabled ? classes.add(name) : classes.delete(name),
    };
  }
}

function createHarness({ withHint = true } = {}) {
  const elements = new Map(
    [
      "#nodeDegreeDistanceSlider",
      "#nodeDegreeSliderValue",
      "#c_filter button",
      "#nodeDegreeFilteringOption",
    ].map((id) => [id, new ControlElement()]),
  );
  if (withHint) {
    elements.set("#degree-of-collapsing-hint", new ControlElement());
  }
  const control = createDegreeFilterControl({
    documentObject: {
      querySelector: (selector) => elements.get(selector) ?? null,
    },
  });
  control.setup();
  return {
    control,
    elements,
    slider: elements.get("#nodeDegreeDistanceSlider"),
    badge: elements.get("#nodeDegreeSliderValue"),
  };
}

describe("degree filter control", () => {
  test("presents the observed initial range and degree together, then preserves the zero endpoint", () => {
    const { control, elements, slider, badge } = createHarness();
    control.renderDegreeFilterRange(
      Object.freeze({ maximumDegree: 20, automaticMinimumDegree: 5 }),
      5,
    );
    expect({
      max: slider.max,
      value: slider.value,
      badge: badge.textContent,
    }).toEqual({ max: "20", value: "5", badge: "5" });
    expect(
      elements
        .get("#nodeDegreeFilteringOption")
        .classList.contains("highlighted"),
    ).toBe(true);
    expect(
      elements.get("#degree-of-collapsing-hint").classList.contains("hidden"),
    ).toBe(false);
    control.renderDegreeFilterRange(
      { maximumDegree: 20, automaticMinimumDegree: 5 },
      0,
    );
    expect({ value: slider.value, badge: badge.textContent }).toEqual({
      value: "0",
      badge: "0",
    });
    expect(
      elements
        .get("#nodeDegreeFilteringOption")
        .classList.contains("highlighted"),
    ).toBe(false);
    expect(
      elements.get("#degree-of-collapsing-hint").classList.contains("hidden"),
    ).toBe(true);
    control.dispose();
  });

  test("clears the highlight and updates the badge when the reader drags to zero", () => {
    const { control, elements, slider, badge } = createHarness();
    control.renderDegreeFilterRange(
      { maximumDegree: 20, automaticMinimumDegree: 5 },
      5,
    );
    slider.value = "0";
    slider.dispatchEvent(new Event("input"));
    expect(badge.textContent).toBe("0");
    expect(
      elements
        .get("#nodeDegreeFilteringOption")
        .classList.contains("highlighted"),
    ).toBe(false);
    expect(
      elements.get("#degree-of-collapsing-hint").classList.contains("hidden"),
    ).toBe(true);
    control.dispose();
  });

  test("works when the optional hint is absent and remains setup-idempotent", () => {
    const { control, slider, badge } = createHarness({ withHint: false });
    control.setup();
    control.renderDegreeFilterRange(
      { maximumDegree: 125, automaticMinimumDegree: 5 },
      5,
    );
    const onChange = jest.fn();
    slider.addEventListener("change", onChange);
    const wheel = new Event("wheel", { cancelable: true });
    Object.defineProperty(wheel, "deltaY", { value: -1 });
    slider.dispatchEvent(wheel);
    expect({ value: slider.value, badge: badge.textContent }).toEqual({
      value: "6",
      badge: "6",
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(wheel.defaultPrevented).toBe(true);
    control.dispose();
    slider.value = "0";
    slider.dispatchEvent(new Event("input"));
    expect(badge.textContent).toBe("6");
    control.renderDegreeFilterRange(
      { maximumDegree: 10, automaticMinimumDegree: 0 },
      0,
    );
    expect(slider.max).toBe("125");
  });
});
