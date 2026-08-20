/**
 * Contains the logic for connecting the modes with the website.
 *
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function (graph) {
  const SAME_COLOR_MODE = { text: "Multicolor", type: "same" };
  const GRADIENT_COLOR_MODE = { text: "Multicolor", type: "gradient" };

  const modeMenu = {};
  const checkboxes = [];
  let colorModeSwitch;

  let dynamicLabelWidthCheckBox;
  // getter and setter for the state of color modes
  modeMenu.colorModeState = function (s) {
    if (!colorModeSwitch) {
      return false;
    }
    if (!arguments.length) {
      return colorModeSwitch.getActive();
    }
    colorModeSwitch.setActive(s);
    return modeMenu;
  };

  modeMenu.setDynamicLabelWidth = function (val) {
    if (dynamicLabelWidthCheckBox) {
      dynamicLabelWidthCheckBox.checked = val;
    }
  };
  // getter for checkboxes
  modeMenu.getCheckBoxContainer = function () {
    return checkboxes;
  };
  // getter for the color switch [needed? ]
  modeMenu.colorModeSwitch = function () {
    return colorModeSwitch;
  };

  /**
   * Connects the website with the available graph modes.
   */
  modeMenu.setup = function (
    pickAndPin,
    nodeScaling,
    compactNotation,
    colorExternals,
  ) {
    addCheckBoxD(
      "labelWidth",
      "Dynamic label width",
      "#dynamicLabelWidth",
      graph.options().dynamicLabelWidth,
      1,
    );
    addCheckBox("editorMode", "Editing ", "#editMode", graph.editorMode);
    addModeItem(
      pickAndPin,
      "pickandpin",
      "Pick & pin",
      "#pickAndPinOption",
      false,
    );
    addModeItem(
      nodeScaling,
      "nodescaling",
      "Node scaling",
      "#nodeScalingOption",
      true,
    );
    addModeItem(
      compactNotation,
      "compactnotation",
      "Compact notation",
      "#compactNotationOption",
      true,
    );
    const container = addModeItem(
      colorExternals,
      "colorexternals",
      "Color externals",
      "#colorExternalsOption",
      true,
    );
    colorModeSwitch = addExternalModeSelection(container, colorExternals);
  };
  function addCheckBoxD(
    identifier,
    modeName,
    selector,
    onChangeFunc,
    updateLvl,
  ) {
    const moduleOptionContainer = document.querySelector(selector);
    if (!moduleOptionContainer) {
      return;
    }
    const moduleCheckbox = moduleOptionContainer.querySelector(
      "#" + identifier + "ModuleCheckbox",
    );
    if (!moduleCheckbox) {
      return;
    }
    moduleCheckbox.checked = onChangeFunc();

    moduleCheckbox.addEventListener("click", function () {
      const isEnabled = moduleCheckbox.checked;
      onChangeFunc(isEnabled);
      const slider = document.querySelector("#maxLabelWidthSlider");
      if (slider) {
        slider.disabled = !isEnabled;
      }
      const sliderVal = document.querySelector("#maxLabelWidthSliderValue");
      if (sliderVal) {
        sliderVal.classList.toggle("disabledLabelForSlider", !isEnabled);
      }
      const descLabel = document.querySelector(
        "#maxLabelWidthDescriptionLabel",
      );
      if (descLabel) {
        descLabel.classList.toggle("disabledLabelForSlider", !isEnabled);
      }

      if (updateLvl > 0) {
        graph.animateDynamicLabelWidth();
        // graph.lazyRefresh();
      }
    });

    dynamicLabelWidthCheckBox = moduleCheckbox;
  }

  function addCheckBox(identifier, modeName, selector, onChangeFunc) {
    const moduleOptionContainer = document.querySelector(selector);
    if (!moduleOptionContainer) {
      return;
    }
    const moduleCheckbox = moduleOptionContainer.querySelector(
      "#" + identifier + "ModuleCheckbox",
    );
    if (!moduleCheckbox) {
      return;
    }
    moduleCheckbox.checked = onChangeFunc();

    moduleCheckbox.addEventListener("click", function () {
      const isEnabled = moduleCheckbox.checked;
      onChangeFunc(isEnabled);
      if (isEnabled === true) {
        graph.showEditorHintIfNeeded();
      }
    });
  }

  function addModeItem(
    module,
    identifier,
    modeName,
    selector,
    updateGraphOnClick,
  ) {
    const moduleOptionContainer = document.querySelector(selector);
    if (!moduleOptionContainer) {
      return null;
    }
    const moduleCheckbox = moduleOptionContainer.querySelector(
      "#" + identifier + "ModuleCheckbox",
    );
    if (!moduleCheckbox) {
      return moduleOptionContainer;
    }
    const defaultState = module.enabled();
    moduleCheckbox.checked = defaultState;

    // Store for easier resetting all modes
    checkboxes.push({
      id: moduleCheckbox.id,
      element: moduleCheckbox,
      module: module,
      defaultState: defaultState,
      update: null,
    });

    const clickHandler = function (arg1, arg2) {
      const isEnabled = moduleCheckbox.checked;
      module.enabled(isEnabled);
      const silent =
        typeof arg1 === "boolean"
          ? arg1
          : typeof arg2 === "boolean"
            ? arg2
            : false;
      if (updateGraphOnClick && silent !== true) {
        graph.executeColorExternalsModule();
        graph.executeCompactNotationModule();
        graph.executeNodeScalingModule();
        graph.lazyRefresh();
      }
    };
    moduleCheckbox.addEventListener("click", clickHandler);
    checkboxes[checkboxes.length - 1].update = clickHandler;

    return moduleOptionContainer;
  }

  function addExternalModeSelection(container, colorExternalsMode) {
    if (!container) {
      return {
        element: null,
        getActive: function () {
          return false;
        },
        setActive: function () {},
        update: function () {},
      };
    }
    const button = container.querySelector(".color-mode-switch");
    if (!button) {
      return {
        element: null,
        getActive: function () {
          return false;
        },
        setActive: function () {},
        update: function () {},
      };
    }
    let isActive = false;
    applyColorModeSwitchState(button, colorExternalsMode, isActive);

    const clickHandler = function (arg1, arg2) {
      isActive = !isActive;
      applyColorModeSwitchState(button, colorExternalsMode, isActive);
      const silent =
        typeof arg1 === "boolean"
          ? arg1
          : typeof arg2 === "boolean"
            ? arg2
            : false;
      if (colorExternalsMode.enabled() && silent !== true) {
        graph.executeColorExternalsModule();
        graph.lazyRefresh();
      }
    };
    button.addEventListener("click", clickHandler);

    return {
      element: button,
      getActive: function () {
        return isActive;
      },
      setActive: function (state) {
        isActive = state;
      },
      update: clickHandler,
    };
  }

  function applyColorModeSwitchState(element, colorExternalsMode, isActive) {
    const activeColorMode = getColorModeByState(isActive);

    element.classList.toggle("active", isActive);
    element.textContent = activeColorMode.text;

    if (colorExternalsMode) {
      colorExternalsMode.colorModeType(activeColorMode.type);
    }
  }

  function getColorModeByState(isActive) {
    return isActive ? GRADIENT_COLOR_MODE : SAME_COLOR_MODE;
  }

  /**
   * Resets the modes to their default.
   */
  modeMenu.reset = function () {
    checkboxes.forEach(function (item) {
      const defaultState = item.defaultState,
        isChecked = item.element.checked;

      if (isChecked !== defaultState) {
        item.element.checked = defaultState;
        // Call onclick event handlers programmatically
        if (typeof item.update === "function") {
          item.update();
        }
      }

      // Reset the module that is connected with the checkbox
      if (item.module && typeof item.module.reset === "function") {
        item.module.reset();
      }
    });

    // set the switch to active and simulate disabling
    if (colorModeSwitch) {
      colorModeSwitch.setActive(true);
      colorModeSwitch.update();
    }
  };

  /** importer functions **/
  // setting manually the values of the filter
  // no update of the gui settings, these are updated in updateSettings
  modeMenu.setCheckBoxValue = function (id, checked) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];

      if (item.id === id) {
        item.element.checked = checked;
        break;
      }
    }
  };
  modeMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];
      if (item.id === id) {
        return item.element.checked;
      }
    }
  };

  modeMenu.setColorSwitchState = function (state) {
    // need the !state because we simulate later a click
    modeMenu.colorModeState(!state);
  };
  modeMenu.setColorSwitchStateUsingURL = function (state) {
    // need the !state because we simulate later a click
    modeMenu.colorModeState(!state);
    if (colorModeSwitch) {
      colorModeSwitch.update(true);
    }
  };

  modeMenu.updateSettingsUsingURL = function () {
    const silent = true;
    checkboxes.forEach(function (item) {
      if (typeof item.update === "function") {
        item.update(silent);
      }
    });
  };

  modeMenu.updateSettings = function () {
    const silent = true;
    checkboxes.forEach(function (item) {
      if (typeof item.update === "function") {
        item.update(silent);
      }
    });
    // this simulates onclick and inverts its state
    if (colorModeSwitch) {
      colorModeSwitch.update(silent);
    }
  };

  modeMenu.syncEditorState = function (editMode) {
    const editorCheckbox = document.querySelector("#editorModeModuleCheckbox");
    if (editorCheckbox) {
      editorCheckbox.checked = editMode;
    }

    const create_entry = document.querySelector("#empty");
    const create_container = document.querySelector("#emptyContainer");
    const emptyHint = document.querySelector("#empty-disabled-hint");
    const createMessage = editMode
      ? "Creates a new empty ontology"
      : "Enable editing in Modes menu to be able to create a new ontology";

    if (create_entry) {
      create_entry.disabled = !editMode;
      create_entry.title = createMessage;
    }
    if (create_container) {
      create_container.title = createMessage;
    }

    const accuracyHelper = document.querySelector("#useAccuracyHelper");
    if (accuracyHelper) {
      if (!editMode) {
        accuracyHelper.classList.add("disabled");
        accuracyHelper.setAttribute("aria-disabled", "true");
      } else {
        accuracyHelper.classList.remove("disabled");
        accuracyHelper.removeAttribute("aria-disabled");
      }
    }
    const accuracyCheckbox = document.querySelector(
      "#useAccuracyHelperConfigCheckbox",
    );
    if (accuracyCheckbox) {
      accuracyCheckbox.disabled = !editMode;
    }

    if (emptyHint) {
      emptyHint.textContent = createMessage;
      if (editMode) {
        emptyHint.classList.add("hidden");
      } else {
        emptyHint.classList.remove("hidden");
      }
    }

    const compactNotationContainer = document.querySelector(
      "#compactnotationModuleCheckbox",
    );
    const compactNotationOption = document.querySelector(
      "#compactNotationOption",
    );
    if (compactNotationContainer) {
      if (editMode) {
        compactNotationOption.classList.add("disabled");
        compactNotationOption.setAttribute("aria-disabled", "true");
      } else {
        compactNotationOption.classList.remove("disabled");
        compactNotationOption.removeAttribute("aria-disabled");
        compactNotationContainer.title = "";
        compactNotationContainer.disabled = false;
        compactNotationOption.title = "";
      }
    }
  };

  return modeMenu;
};
