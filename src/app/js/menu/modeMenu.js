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
    if (!arguments.length) {
      return colorModeSwitch.__data__.active;
    }
    colorModeSwitch.__data__.active = s;
    return modeMenu;
  };

  modeMenu.setDynamicLabelWidth = function (val) {
    dynamicLabelWidthCheckBox.checked = val;
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
    const menuEntry = d3.select("#m_modes");
    menuEntry.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
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
    const moduleOptionContainer = d3
      .select(selector)
      .append("div")
      .classed("checkboxContainer", true);

    const moduleCheckbox = moduleOptionContainer
      .append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ModuleCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());

    moduleCheckbox.addEventListener("click", function () {
      const isEnabled = moduleCheckbox.checked;
      onChangeFunc(isEnabled);
      document.querySelector("#maxLabelWidthSlider").disabled = !isEnabled;
      document
        .querySelector("#maxLabelWidthSliderValue")
        .classList.toggle("disabledLabelForSlider", !isEnabled);
      document
        .querySelector("#maxLabelWidthDescriptionLabel")
        .classList.toggle("disabledLabelForSlider", !isEnabled);

      if (updateLvl > 0) {
        graph.animateDynamicLabelWidth();
        // graph.lazyRefresh();
      }
    });
    moduleOptionContainer
      .append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);
    if (identifier === "editorMode") {
      moduleOptionContainer
        .append("label")
        .attr("class", "experimental-label")
        .text("(experimental)");
    }

    dynamicLabelWidthCheckBox = moduleCheckbox;
  }

  function addCheckBox(identifier, modeName, selector, onChangeFunc) {
    const moduleOptionContainer = d3
      .select(selector)
      .append("div")
      .classed("checkboxContainer", true);

    const moduleCheckbox = moduleOptionContainer
      .append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ModuleCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());

    moduleCheckbox.addEventListener("click", function () {
      const isEnabled = moduleCheckbox.checked;
      onChangeFunc(isEnabled);
      if (isEnabled === true) {
        graph.showEditorHintIfNeeded();
      }
    });
    moduleOptionContainer
      .append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);
    if (identifier === "editorMode") {
      moduleOptionContainer
        .append("label")
        .attr("class", "experimental-label")
        .text(" (experimental)");
    }
  }

  function addModeItem(
    module,
    identifier,
    modeName,
    selector,
    updateGraphOnClick,
  ) {
    const moduleOptionContainer = d3
      .select(selector)
      .append("div")
      .classed("checkboxContainer", true)
      .datum({ module: module, defaultState: module.enabled() });

    const moduleCheckbox = moduleOptionContainer
      .append("input")
      .datum({ module: module, defaultState: module.enabled() })
      .property("checked", module.enabled());

    // Store for easier resetting all modes
    checkboxes.push(moduleCheckbox);

    moduleCheckbox.on("click", function (d, silent) {
      const isEnabled = moduleCheckbox.property("checked");
      module.enabled(isEnabled);
      var silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      if (updateGraphOnClick && silent !== true) {
        graph.executeColorExternalsModule();
        graph.executeCompactNotationModule();
        graph.executeNodeScalingModule();
        graph.lazyRefresh();
      }
    };
    moduleCheckbox.addEventListener("click", clickHandler);
    moduleCheckbox.__clickHandler__ = clickHandler;

    moduleOptionContainer
      .append("label")
      .attr("for", identifier + "ModuleCheckbox")
      .text(modeName);

    return moduleOptionContainer;
  }

  function addExternalModeSelection(container, colorExternalsMode) {
    const button = container
      .append("button")
      .datum({ active: false })
      .classed("color-mode-switch", true);
    applyColorModeSwitchState(button, colorExternalsMode);

    button.on("click", function (silent) {
      const data = button.datum();
      data.active = !data.active;
      applyColorModeSwitchState(button, colorExternalsMode);
      var silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      if (colorExternalsMode.enabled() && silent !== true) {
        graph.executeColorExternalsModule();
        graph.lazyRefresh();
      }
    };
    button.addEventListener("click", clickHandler);
    button.__clickHandler__ = clickHandler;

    return button;
  }

  function applyColorModeSwitchState(element, colorExternalsMode) {
    const isActive = element.__data__.active;
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
    checkboxes.forEach(function (checkbox) {
      const defaultState = checkbox.__data__.defaultState,
        isChecked = checkbox.checked;

      if (isChecked !== defaultState) {
        checkbox.checked = defaultState;
        // Call onclick event handlers programmatically
        checkbox.__clickHandler__(checkbox.__data__);
      }

      // Reset the module that is connected with the checkbox
      checkbox.__data__.module.reset();
    });

    // set the switch to active and simulate disabling
    colorModeSwitch.__data__.active = true;
    colorModeSwitch.__clickHandler__();
  };

  /** importer functions **/
  // setting manually the values of the filter
  // no update of the gui settings, these are updated in updateSettings
  modeMenu.setCheckBoxValue = function (id, checked) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;

      if (cbdId === id) {
        checkboxes[i].checked = checked;
        break;
      }
    }
  };
  modeMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;
      if (cbdId === id) {
        return checkboxes[i].checked;
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
    colorModeSwitch.__clickHandler__(true);
  };

  modeMenu.updateSettingsUsingURL = function () {
    const silent = true;
    checkboxes.forEach(function (checkbox) {
      checkbox.__clickHandler__(checkbox.__data__, silent);
    });
  };

  modeMenu.updateSettings = function () {
    const silent = true;
    checkboxes.forEach(function (checkbox) {
      checkbox.__clickHandler__(checkbox.__data__, silent);
    });
    // this simulates onclick and inverts its state
    colorModeSwitch.__clickHandler__(silent);
  };
  return modeMenu;
};
