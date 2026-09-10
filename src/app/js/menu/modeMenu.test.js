import { beforeAll, jest } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let modeMenuFactory;

beforeAll(async () => {
  ({ createModeMenu: modeMenuFactory } = await loadEsmModuleForTest(
    new URL("./modeMenu.js", import.meta.url),
    import.meta.url,
  ));
});

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.attributes = {};
    this.children = [];
    this.textContent = "";
    this._classList = new Set();
    this.listeners = {};
    this.disabled = false;
    this.checked = false;
  }
  setAttribute(name, val) {
    this.attributes[name] = val;
  }
  appendChild(child) {
    this.children.push(child);
  }
  addEventListener(type, fn) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(fn);
  }
  querySelector(selector) {
    if (selector.startsWith("#")) {
      const el = new MockElement(selector.substring(1));
      this.children.push(el);
      return el;
    }
    if (selector === ".color-mode-switch") {
      return new MockElement("color-mode-switch");
    }
    return new MockElement();
  }
  get classList() {
    return {
      add: (c) => this._classList.add(c),
      remove: (c) => this._classList.delete(c),
      toggle: (c, state) =>
        state ? this._classList.add(c) : this._classList.delete(c),
      contains: (c) => this._classList.has(c),
    };
  }
}

describe("mode menu bug fixes", () => {
  let modeMenu, setVisualizationModes, webVowlController;
  let dynamicLabelWidthContainer,
    editModeContainer,
    pickAndPinContainer,
    nodeScalingContainer,
    compactNotationContainer,
    colorExternalsContainer;
  let maxLabelWidthSlider,
    maxLabelWidthSliderValue,
    maxLabelWidthDescriptionLabel;

  beforeEach(() => {
    maxLabelWidthSlider = new MockElement("maxLabelWidthSlider");
    maxLabelWidthSliderValue = new MockElement("maxLabelWidthSliderValue");
    maxLabelWidthDescriptionLabel = new MockElement(
      "maxLabelWidthDescriptionLabel",
    );
    dynamicLabelWidthContainer = new MockElement("dynamicLabelWidth");
    editModeContainer = new MockElement("editMode");
    pickAndPinContainer = new MockElement("pickAndPinOption");
    nodeScalingContainer = new MockElement("nodeScalingOption");
    compactNotationContainer = new MockElement("compactNotationOption");
    colorExternalsContainer = new MockElement("colorExternalsOption");

    global.document = {
      getElementById: () => null,
      querySelector: jest.fn((selector) => {
        if (selector === "#maxLabelWidthSlider") {
          return maxLabelWidthSlider;
        }
        if (selector === "#maxLabelWidthSliderValue") {
          return maxLabelWidthSliderValue;
        }
        if (selector === "#maxLabelWidthDescriptionLabel") {
          return maxLabelWidthDescriptionLabel;
        }
        if (selector === "#dynamicLabelWidth") {
          return dynamicLabelWidthContainer;
        }
        if (selector === "#editMode") {
          return editModeContainer;
        }
        if (selector === "#pickAndPinOption") {
          return pickAndPinContainer;
        }
        if (selector === "#nodeScalingOption") {
          return nodeScalingContainer;
        }
        if (selector === "#compactNotationOption") {
          return compactNotationContainer;
        }
        if (selector === "#colorExternalsOption") {
          return colorExternalsContainer;
        }
        return new MockElement();
      }),
    };

    setVisualizationModes = jest.fn();
    webVowlController = {
      setVisualizationModes,
      getOntologyEditorOptions: () => ({ isEditorMode: false }),
      setOntologyEditorOptions: jest.fn(),
    };

    modeMenu = modeMenuFactory({
      webVowlController,
      documentObject: global.document,
      windowObject: global.window,
    });
  });

  afterEach(() => {
    delete global.document;
  });

  test("toggling dynamic label width applies 'disabledLabelForSlider' to slider values and disables slider", () => {
    modeMenu.setup();

    const dynamicCheckbox = dynamicLabelWidthContainer.children.find(
      (c) => c.id === "labelWidthModuleCheckbox",
    );
    expect(dynamicCheckbox).toBeDefined();

    // Toggle off
    dynamicCheckbox.checked = false;
    dynamicCheckbox.listeners["click"][0]();

    expect(maxLabelWidthSlider.disabled).toBe(true);
    expect(
      maxLabelWidthSliderValue._classList.has("disabledLabelForSlider"),
    ).toBe(true);
    expect(
      maxLabelWidthDescriptionLabel._classList.has("disabledLabelForSlider"),
    ).toBe(true);

    // Toggle on
    dynamicCheckbox.checked = true;
    dynamicCheckbox.listeners["click"][0]();

    expect(maxLabelWidthSlider.disabled).toBe(false);
    expect(
      maxLabelWidthSliderValue._classList.has("disabledLabelForSlider"),
    ).toBe(false);
    expect(
      maxLabelWidthDescriptionLabel._classList.has("disabledLabelForSlider"),
    ).toBe(false);
  });

  test("modeMenu setup handles missing optional DOM containers gracefully", () => {
    const documentWithoutOptionalContainers = {
      querySelector: () => null,
    };
    const menuWithoutOptionalContainers = modeMenuFactory({
      webVowlController,
      documentObject: documentWithoutOptionalContainers,
      windowObject: global.window,
    });

    expect(() => {
      menuWithoutOptionalContainers.setup();
      menuWithoutOptionalContainers.setDynamicLabelWidth(true);
      menuWithoutOptionalContainers.reset();
    }).not.toThrow();
  });

  test("a mode checkbox reports the mode the reader chose", () => {
    modeMenu.setup();

    const nodeScalingCheckbox = nodeScalingContainer.children.find(
      (c) => c.id === "nodescalingModuleCheckbox",
    );
    nodeScalingCheckbox.checked = false;

    nodeScalingCheckbox.listeners["click"][0]({ type: "click" });

    expect(setVisualizationModes).toHaveBeenCalledWith({ nodeScaling: false });
  });

  test("importing settings reports every mode in one request", () => {
    modeMenu.setup();
    setVisualizationModes.mockClear();

    modeMenu.updateSettingsUsingURL();

    // One request rather than one per checkbox, so the graph recomputes once.
    expect(setVisualizationModes).toHaveBeenCalledTimes(1);
    expect(setVisualizationModes.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        colorExternals: expect.any(Boolean),
        compactNotation: expect.any(Boolean),
        nodeScaling: expect.any(Boolean),
        pickAndPin: expect.any(Boolean),
      }),
    );
  });

  test("resetting reports each mode's default rather than resetting a module", () => {
    modeMenu.setup();
    const nodeScalingCheckbox = nodeScalingContainer.children.find(
      (c) => c.id === "nodescalingModuleCheckbox",
    );
    nodeScalingCheckbox.checked = false;
    setVisualizationModes.mockClear();

    modeMenu.reset();

    expect(setVisualizationModes).toHaveBeenCalledWith({ nodeScaling: true });
  });
});
