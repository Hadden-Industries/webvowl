/**
 * Contains the logic for connecting the filters with the website.
 *
 * @param graph required for calling a refresh after a filter change
 * @returns {{}}
 */
module.exports = function (graph) {
  const filterMenu = {};
  const checkboxData = [];
  let menuControl;
  let nodeDegreeContainer;
  let graphDegreeLevel;
  let defaultDegreeValue = 0;
  let degreeSlider;

  function getMenuControl() {
    if (!menuControl) {
      menuControl = document.querySelector("#c_filter button");
    }
    return menuControl;
  }

  function getNodeDegreeContainer() {
    if (!nodeDegreeContainer) {
      nodeDegreeContainer = document.querySelector(
        "#nodeDegreeFilteringOption",
      );
    }
    return nodeDegreeContainer;
  }

  filterMenu.setDefaultDegreeValue = function (val) {
    defaultDegreeValue = val;
  };
  filterMenu.getDefaultDegreeValue = function () {
    return defaultDegreeValue;
  };

  filterMenu.getGraphObject = function () {
    return graph;
  };
  /** some getter function  **/
  filterMenu.getCheckBoxContainer = function () {
    return checkboxData;
  };

  filterMenu.getDegreeSliderValue = function () {
    return degreeSlider ? degreeSlider.value : 0;
  };
  /**
   * Connects the website with graph filters.
   * @param datatypeFilter filter for all datatypes
   * @param objectPropertyFilter filter for all object properties
   * @param subclassFilter filter for all subclasses
   * @param disjointFilter filter for all disjoint with properties
   * @param setOperatorFilter filter for all set operators with properties
   * @param nodeDegreeFilter filters nodes by their degree
   */
  filterMenu.setup = function (
    datatypeFilter,
    objectPropertyFilter,
    subclassFilter,
    disjointFilter,
    setOperatorFilter,
    nodeDegreeFilter,
  ) {
    menuControl = getMenuControl();
    nodeDegreeContainer = getNodeDegreeContainer();
    // TODO: is this here really necessarry? << new menu visualization style?
    menuControl.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
    menuControl.on("mouseleave", function () {
      filterMenu.highlightForDegreeSlider(false);
    });

    addFilterItem(
      datatypeFilter,
      "datatype",
      "Datatype properties",
      "#datatypeFilteringOption",
    );
    addFilterItem(
      objectPropertyFilter,
      "objectProperty",
      "Object properties",
      "#objectPropertyFilteringOption",
    );
    addFilterItem(
      subclassFilter,
      "subclass",
      "Solitary subclasses",
      "#subclassFilteringOption",
    );
    addFilterItem(
      disjointFilter,
      "disjoint",
      "Class disjointness",
      "#disjointFilteringOption",
    );
    addFilterItem(
      setOperatorFilter,
      "setoperator",
      "Set operators",
      "#setOperatorFilteringOption",
    );

    addNodeDegreeFilter(nodeDegreeFilter, nodeDegreeContainer);
    addAnimationFinishedListener();
  };

  function addFilterItem(
    filter,
    identifier,
    pluralNameOfFilteredItems,
    selector,
  ) {
    const filterContainer = d3
      .select(selector)
      .append("div")
      .classed("checkboxContainer", true);

    const filterCheckbox = filterContainer
      .append("input")
      .classed("filterCheckbox", true)
      .attr("id", identifier + "FilterCheckbox")
      .attr("type", "checkbox")
      .property("checked", filter.enabled());
    if (!filterContainer) {
      return;
    }
    if (!filterCheckbox) {
      return;
    }

    // Store for easier resetting
    checkboxData.push({
      checkbox: filterCheckbox,
      defaultState: filter.enabled(),
    });

    filterCheckbox.on("click", function (silent) {
      // There might be no parameters passed because of a manual
      // invocation when resetting the filters
      const isEnabled = filterCheckbox.checked;
      filter.enabled(isEnabled);
      var silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      if (silent !== true) {
        // updating graph when silent is false or the parameter is not given.
        graph.update();
      }
    };
    filterCheckbox.addEventListener("click", onClickHandler);
    filterCheckbox.__onclick = onClickHandler;

    filterContainer
      .append("label")
      .attr("for", identifier + "FilterCheckbox")
      .text(pluralNameOfFilteredItems);
  }

  function addNodeDegreeFilter(nodeDegreeFilter, container) {
    if (!container) {
      return;
    }
    const sliderValueLabel = container.querySelector("#nodeDegreeSliderValue");
    degreeSlider = container.querySelector("#nodeDegreeDistanceSlider");
    if (!degreeSlider) {
      return;
    }

    nodeDegreeFilter.setMaxDegreeSetter(function (maxDegree) {
      degreeSlider.max = maxDegree;
      setSliderValue(degreeSlider, Math.min(maxDegree, degreeSlider.value));
    });

    nodeDegreeFilter.setDegreeGetter(function () {
      return degreeSlider.value;
    });

    nodeDegreeFilter.setDegreeSetter(function (value) {
      setSliderValue(degreeSlider, value);
    });

    const sliderContainer = container
      .append("div")
      .classed("distanceSliderContainer", true);

    degreeSlider = sliderContainer
      .append("input")
      .attr("id", "nodeDegreeDistanceSlider")
      .attr("type", "range")
      .attr("min", 0)
      .attr("step", 1);

    sliderContainer
      .append("label")
      .classed("description", true)
      .attr("for", "nodeDegreeDistanceSlider")
      .text("Degree of collapsing");

    const sliderValueLabel = sliderContainer
      .append("label")
      .classed("value", true)
      .attr("for", "nodeDegreeDistanceSlider")
      .text(0);

    degreeSlider.on("change", function (silent) {
      if (silent !== true) {
      const degree = degreeSlider.property("value");
      if ( parseInt(degree, 10) === 0 ) {
        filterMenu.highlightForDegreeSlider(false);
      }
        graph.update();
        graphDegreeLevel = degree;
      }
    };
    degreeSlider.addEventListener("change", onChangeHandler);
    degreeSlider.__onchange = onChangeHandler;

    const onInputHandler = function () {
      const degree = degreeSlider.value;
      if (sliderValueLabel) {
        sliderValueLabel.textContent = degree;
      }
      if ( parseInt(degree, 10) === 0 ) {
        filterMenu.highlightForDegreeSlider(false);
      }
    };
    degreeSlider.addEventListener("input", onInputHandler);
    degreeSlider.__oninput = onInputHandler;

    // adding wheel events
    degreeSlider.addEventListener("wheel", handleWheelEvent);
    degreeSlider.addEventListener("focusout", function () {
      if (degreeSlider.value !== graphDegreeLevel) {
        graph.update();
      }
    });
  }

  function handleWheelEvent() {
    const wheelEvent = d3.event;
    if (!degreeSlider) {
      return;
    }

    let offset;
    if (wheelEvent.deltaY < 0) {
      offset = 1;
    }
    if (wheelEvent.deltaY > 0) {
      offset = -1;
    }
    const maxDeg = parseInt(degreeSlider.max, 10);
    const oldVal = parseInt(degreeSlider.value, 10);
    const newSliderValue = oldVal + offset;
    if (
      oldVal !== newSliderValue &&
      newSliderValue >= 0 &&
      newSliderValue <= maxDeg
    ) {
      // only update when they are different [reducing redundant updates]
      // set the new value and emit an update signal
      degreeSlider.value = newSliderValue;
      if (typeof degreeSlider.__oninput === "function") {
        degreeSlider.__oninput(); // <<-- sets the text value
      }
      graph.update();
    }
    event.preventDefault();
  }

  function setSliderValue(slider, value) {
    if (!slider) {
      return;
    }
    slider.value = value;
    if (typeof slider.__oninput === "function") {
      slider.__oninput();
    }
  }

  /**
   * Resets the filters (and also filtered elements) to their default.
   */
  filterMenu.reset = function () {
    checkboxData.forEach(function (checkboxData) {
      const checkbox = checkboxData.checkbox,
        enabledByDefault = checkboxData.defaultState,
        isChecked = checkbox.checked;

      if (isChecked !== enabledByDefault) {
        checkbox.checked = enabledByDefault;
        // Call onclick event handlers programmatically
        if (typeof checkbox.__onclick === "function") {
          checkbox.__onclick();
        }
      }
    });

    if (degreeSlider) {
      setSliderValue(degreeSlider, 0);
      if (typeof degreeSlider.__onchange === "function") {
        degreeSlider.__onchange();
      }
    }
  };

  function addAnimationFinishedListener() {
    const ctrl = getMenuControl();
    if (!ctrl) {
      return;
    }
    ctrl.addEventListener("animationend", function () {
      ctrl.classList.remove("buttonPulse");
      ctrl.classList.add("filterMenuButtonHighlight");
    });
  }

  filterMenu.killButtonAnimation = function () {
    const ctrl = getMenuControl();
    if (!ctrl) {
      return;
    }
    ctrl.classList.remove("buttonPulse");
    ctrl.classList.remove("filterMenuButtonHighlight");
  };

  filterMenu.highlightForDegreeSlider = function (enable) {
    let timer;
    if (!arguments.length) {
      enable = true;
    }
    const ctrl = getMenuControl();
    const container = getNodeDegreeContainer();
    if (ctrl) {
      ctrl.classList.toggle("highlighted", enable);
    }
    if (container) {
      container.classList.toggle("highlighted", enable);
    }
    const hint = document.querySelector("#degree-of-collapsing-hint");
    if (hint) {
      hint.classList.toggle("hidden", !enable);
    }
    if (!ctrl) {
      return;
    }
    // pulse button handling
    if (ctrl.classList.contains("buttonPulse") === true && enable === true) {
      ctrl.classList.remove("buttonPulse");
      timer = setTimeout(function () {
        ctrl.classList.toggle("buttonPulse", enable);
        clearTimeout(timer);
        // after the time is done, remove the pulse but stay highlighted
      }, 100);
    } else {
      ctrl.classList.toggle("buttonPulse", enable);
      ctrl.classList.toggle("filterMenuButtonHighlight", enable);
    }
  };

  /** importer functions **/
  // setting manually the values of the filter
  // no update of the gui settings, these are updated in updateSettings
  filterMenu.setCheckBoxValue = function (id, checked) {
    for (let i = 0; i < checkboxData.length; i++) {
      const cbdId = checkboxData[i].checkbox.id;
      if (cbdId === id) {
        checkboxData[i].checkbox.checked = checked;
        break;
      }
    }
  };

  filterMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxData.length; i++) {
      const cbdId = checkboxData[i].checkbox.id;
      if (cbdId === id) {
        return checkboxData[i].checkbox.checked;
      }
    }
  };
  // set the value of the slider
  filterMenu.setDegreeSliderValue = function (val) {
    if (degreeSlider) {
      degreeSlider.value = val;
    }
  };

  // update the gui without invoking graph update (calling silent onclick function)
  filterMenu.updateSettings = function () {
    const silent = true;
    const sliderValue = degreeSlider ? degreeSlider.value : 0;
    if (sliderValue > 0) {
      filterMenu.highlightForDegreeSlider(true);
    } else {
      filterMenu.highlightForDegreeSlider(false);
    }
    checkboxData.forEach(function (checkboxData) {
      const checkbox = checkboxData.checkbox;
      if (typeof checkbox.__onclick === "function") {
        checkbox.__onclick(silent);
      }
    });

    if (degreeSlider) {
      if (typeof degreeSlider.__oninput === "function") {
        degreeSlider.__oninput();
      }
      if (typeof degreeSlider.__onchange === "function") {
        degreeSlider.__onchange();
      }
    }
  };

  return filterMenu;
};
