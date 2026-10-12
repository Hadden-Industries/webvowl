import { jest } from "@jest/globals";
import { createGravityMenu } from "./gravityMenu.js";
import { createConfigMenu } from "./configMenu.js";

// Input dispatch and listener lifetime only. Real-browser evidence owns native
// range normalization/stepping; this double deliberately implements neither.
class Element extends EventTarget {
  constructor(id) {
    super();
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.checked = false;
    this.disabled = false;
  }
  setAttribute(name, value) {
    this[name] = String(value);
  }
}
function setup() {
  const elements = new Map();
  const lookup = (selector) => {
    const id = selector.replace(/^#/, "");
    if (!elements.has(id)) {
      const element = new Element(id);
      element.querySelector = lookup;
      elements.set(id, element);
    }
    return elements.get(id);
  };
  const documentObject = { querySelector: lookup, getElementById: lookup };
  const controller = {
    setForceLayoutDistances: jest.fn(),
    setVisualizationModes: jest.fn(),
  };
  const gravity = createGravityMenu({
    webVowlController: controller,
    classDistancePx: 200,
    datatypeDistancePx: 120,
    documentObject,
  });
  const zoom = { showSlider: jest.fn(() => true) };
  const config = createConfigMenu({
    webVowlController: controller,
    maxLabelWidthPx: 120,
    documentObject,
  });
  gravity.setup();
  config.setup(zoom);
  return { lookup, controller, gravity, config, zoom };
}
const cases = [
  ["classDistance", "setForceLayoutDistances", "classDistancePx", 200],
  ["datatypeDistance", "setForceLayoutDistances", "datatypeDistancePx", 120],
  ["maxLabelWidth", "setVisualizationModes", "maxLabelWidthPx", 120],
];
describe.each(cases)("%s slider", (id, method, field, initial) => {
  test("rebinding disposes the previous input listener", () => {
    const { lookup, controller, gravity, config, zoom } = setup();
    gravity.setup();
    config.setup(zoom);
    const input = lookup("#" + id + "Slider");
    input.value = "240";
    input.dispatchEvent(new Event("input"));
    expect(controller[method]).toHaveBeenCalledTimes(1);
    expect(controller[method]).toHaveBeenCalledWith({ [field]: 240 });
    const checkbox = lookup("#showZoomSliderConfigCheckbox");
    zoom.showSlider.mockClear();
    checkbox.dispatchEvent(new Event("click"));
    expect(zoom.showSlider).toHaveBeenCalledTimes(1);
  });
  test("initializes from passed defaults and requests the menu-specific value once", () => {
    const { lookup, controller } = setup();
    const input = lookup("#" + id + "Slider");
    const label = lookup("#" + id + "SliderValue");
    expect(Number(input.value)).toBe(initial);
    expect(Number(label.textContent)).toBe(initial);
    input.value = "230";
    input.dispatchEvent(new Event("input"));
    expect(controller[method]).toHaveBeenCalledTimes(1);
    expect(controller[method]).toHaveBeenCalledWith({ [field]: 230 });
    expect(String(label.textContent)).toBe("230");
  });
  test.each(["", "invalid", "Infinity", "0", "-10"])(
    "ignores invalid observed value %s",
    (value) => {
      const { lookup, controller } = setup();
      const input = lookup("#" + id + "Slider");
      input.value = value;
      input.dispatchEvent(new Event("input"));
      expect(controller[method]).not.toHaveBeenCalled();
    },
  );
  test("retains controller failure and cancellation feedback", async () => {
    const { lookup, controller } = setup();
    const input = lookup("#" + id + "Slider");
    const status = lookup("visualizationActionStatus");
    controller[method].mockRejectedValueOnce(new Error("rejected"));
    input.value = "230";
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe(
      "The visualization could not be updated. Please try again.",
    );
    controller[method].mockRejectedValueOnce(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    input.dispatchEvent(new Event("input"));
    await Promise.resolve();
    expect(status.hidden).toBe(true);
  });
});
