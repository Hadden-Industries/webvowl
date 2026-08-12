const modeMenuFactory = require("./modeMenu.js");

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
  let mockGraph,
    modeMenu,
    pickAndPin,
    nodeScaling,
    compactNotation,
    colorExternals;
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

    mockGraph = {
      options: () => ({ dynamicLabelWidth: jest.fn().mockReturnValue(true) }),
      editorMode: jest.fn().mockReturnValue(false),
      animateDynamicLabelWidth: jest.fn(),
    };
    pickAndPin = { enabled: jest.fn().mockReturnValue(false) };
    nodeScaling = { enabled: jest.fn().mockReturnValue(true) };
    compactNotation = { enabled: jest.fn().mockReturnValue(true) };
    colorExternals = {
      enabled: jest.fn().mockReturnValue(true),
      colorModeType: jest.fn(),
    };

    modeMenu = modeMenuFactory(mockGraph);
  });

  afterEach(() => {
    delete global.document;
  });

  test("toggling dynamic label width applies 'disabledLabelForSlider' to slider values and disables slider", () => {
    modeMenu.setup(pickAndPin, nodeScaling, compactNotation, colorExternals);

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
});
