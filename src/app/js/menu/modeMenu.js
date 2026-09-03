/**
 * Contains the logic for connecting the modes with the website.
 *
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
export function createModeMenu(
  graph,
  {
    webVowlController,
    documentObject = globalThis.document,
    windowObject = globalThis.window,
  } = {},
) {
  // The states the renderer's own modules start from. Supplied here rather
  // than read back out of the renderer, which is what let this menu drop its
  // module references.
  const DEFAULT_DISPLAY_MODES = Object.freeze({
    colorExternals: true,
    compactNotation: false,
    nodeScaling: true,
    pickAndPin: false,
  });
  const dynamicLabelWidthDefault = true;

  const SAME_COLOR_MODE = { text: "Multicolor", type: "same" };
  const GRADIENT_COLOR_MODE = { text: "Multicolor", type: "gradient" };

  const modeMenu = {};
  const checkboxes = [];
  let colorModeSwitch;

  // A checkbox states which display mode a reader chose. What that mode means
  // for the drawn graph — which module enforces it, and when to recompute — is
  // renderer behaviour and stays behind the seam.
  function requestVisualizationMode(requestedMode) {
    webVowlController?.setVisualizationMode(requestedMode);
  }

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
      dynamicLabelWidthDefault,
    );
    addCheckBox("editorMode", "Editing ", "#editMode", graph.editorMode);
    addModeItem(
      "pickAndPin",
      DEFAULT_DISPLAY_MODES.pickAndPin,
      "pickandpin",
      "Pick & pin",
      "#pickAndPinOption",
    );
    addModeItem(
      "nodeScaling",
      DEFAULT_DISPLAY_MODES.nodeScaling,
      "nodescaling",
      "Node scaling",
      "#nodeScalingOption",
    );
    addModeItem(
      "compactNotation",
      DEFAULT_DISPLAY_MODES.compactNotation,
      "compactnotation",
      "Compact notation",
      "#compactNotationOption",
    );
    const container = addModeItem(
      "colorExternals",
      DEFAULT_DISPLAY_MODES.colorExternals,
      "colorexternals",
      "Color externals",
      "#colorExternalsOption",
    );
    colorModeSwitch = addExternalModeSelection(container);
  };
  function addCheckBoxD(identifier, modeName, selector, defaultState) {
    const moduleOptionContainer = documentObject.querySelector(selector);
    if (!moduleOptionContainer) {
      return;
    }
    const moduleCheckbox = moduleOptionContainer.querySelector(
      "#" + identifier + "ModuleCheckbox",
    );
    if (!moduleCheckbox) {
      return;
    }
    moduleCheckbox.checked = defaultState;

    moduleCheckbox.addEventListener("click", function () {
      const isEnabled = moduleCheckbox.checked;
      requestVisualizationMode({ dynamicLabelWidth: isEnabled });
      const slider = documentObject.querySelector("#maxLabelWidthSlider");
      if (slider) {
        slider.disabled = !isEnabled;
      }
      const sliderVal = documentObject.querySelector(
        "#maxLabelWidthSliderValue",
      );
      if (sliderVal) {
        sliderVal.classList.toggle("disabledLabelForSlider", !isEnabled);
      }
      const descLabel = documentObject.querySelector(
        "#maxLabelWidthDescriptionLabel",
      );
      if (descLabel) {
        descLabel.classList.toggle("disabledLabelForSlider", !isEnabled);
      }
    });

    dynamicLabelWidthCheckBox = moduleCheckbox;
  }

  function addCheckBox(identifier, modeName, selector, onChangeFunc) {
    const moduleOptionContainer = documentObject.querySelector(selector);
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
    visualizationModeName,
    defaultState,
    identifier,
    modeName,
    selector,
  ) {
    const moduleOptionContainer = documentObject.querySelector(selector);
    if (!moduleOptionContainer) {
      return null;
    }
    const moduleCheckbox = moduleOptionContainer.querySelector(
      "#" + identifier + "ModuleCheckbox",
    );
    if (!moduleCheckbox) {
      return moduleOptionContainer;
    }
    moduleCheckbox.checked = defaultState;

    // Store for easier resetting all modes
    checkboxes.push({
      id: moduleCheckbox.id,
      element: moduleCheckbox,
      visualizationModeName,
      defaultState: defaultState,
      update: null,
    });

    const clickHandler = function () {
      requestVisualizationMode({
        [visualizationModeName]: moduleCheckbox.checked,
      });
    };
    moduleCheckbox.addEventListener("click", clickHandler);
    checkboxes[checkboxes.length - 1].update = clickHandler;

    return moduleOptionContainer;
  }

  function addExternalModeSelection(container) {
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
    applyColorModeSwitchState(button, isActive);

    const clickHandler = function () {
      isActive = !isActive;
      applyColorModeSwitchState(button, isActive);
      requestVisualizationMode({
        colorExternalsMode: getColorModeByState(isActive).type,
      });
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

  function applyColorModeSwitchState(element, isActive) {
    const activeColorMode = getColorModeByState(isActive);

    element.classList.toggle("active", isActive);
    element.textContent = activeColorMode.text;
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

      if (item.visualizationModeName !== undefined) {
        requestVisualizationMode({
          [item.visualizationModeName]: defaultState,
        });
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

  // Every checkbox state in one request, so importing settings costs one
  // recomputation rather than one per checkbox. This is what the former silent
  // flag was for.
  function reportEveryDisplayMode(includeColorMode) {
    const requestedMode = {};
    for (const item of checkboxes) {
      if (item.visualizationModeName !== undefined) {
        requestedMode[item.visualizationModeName] = item.element.checked;
      }
    }
    if (includeColorMode && colorModeSwitch) {
      requestedMode.colorExternalsMode = getColorModeByState(
        colorModeSwitch.getActive(),
      ).type;
    }
    if (Object.keys(requestedMode).length > 0) {
      requestVisualizationMode(requestedMode);
    }
  }

  modeMenu.updateSettingsUsingURL = function () {
    reportEveryDisplayMode(false);
  };

  modeMenu.updateSettings = function () {
    reportEveryDisplayMode(true);
  };

  modeMenu.syncEditorState = function (editMode) {
    const editorCheckbox = documentObject.querySelector(
      "#editorModeModuleCheckbox",
    );
    if (editorCheckbox) {
      editorCheckbox.checked = editMode;
    }

    const create_entry = documentObject.querySelector("#empty");
    const create_container = documentObject.querySelector("#emptyContainer");
    const emptyHint = documentObject.querySelector("#empty-disabled-hint");
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

    const accuracyHelper = documentObject.querySelector("#useAccuracyHelper");
    if (accuracyHelper) {
      if (!editMode) {
        accuracyHelper.classList.add("disabled");
        accuracyHelper.setAttribute("aria-disabled", "true");
      } else {
        accuracyHelper.classList.remove("disabled");
        accuracyHelper.removeAttribute("aria-disabled");
      }
    }
    const accuracyCheckbox = documentObject.querySelector(
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

    const compactNotationContainer = documentObject.querySelector(
      "#compactnotationModuleCheckbox",
    );
    const compactNotationOption = documentObject.querySelector(
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
}
