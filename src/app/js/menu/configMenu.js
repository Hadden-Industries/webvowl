module.exports = function (graph) {
  const configMenu = {},
    checkboxes = [];

  configMenu.setup = function () {
    const menuEntry = d3.select("#m_modes");
    menuEntry.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });

    addCheckBox(
      "showZoomSlider",
      "Zoom controls",
      "#zoomSliderOption",
      graph.options().zoomSlider().showSlider,
      0,
    );
    addLabelWidthSlider(
      "#maxLabelWidthSliderOption",
      "maxLabelWidth",
      "Max label width",
      graph.options().maxLabelWidth,
    );
  };

  function addLabelWidthSlider(selector, identifier, label, onChangeFunction) {
    const sliderContainer = d3
      .select(selector)
      .append("div")
      .classed("distanceSliderContainer", true);

    const slider = sliderContainer
      .append("input")
      .attr("id", identifier + "Slider")
      .attr("type", "range")
      .attr("min", 20)
      .attr("max", 600)
      .attr("value", onChangeFunction())
      .attr("step", 10);
    sliderContainer
      .append("label")
      .classed("description", true)
      .attr("for", identifier + "Slider")
      .attr("id", identifier + "DescriptionLabel")
      .text(label);
    const sliderValueLabel = sliderContainer
      .append("label")
      .classed("value", true)
      .attr("for", identifier + "Slider")
      .attr("id", identifier + "valueLabel")
      .text(onChangeFunction());

    slider.addEventListener("input", function () {
      const value = slider.value;
      onChangeFunction(value);
      sliderValueLabel.textContent = value;
      if (graph.options().dynamicLabelWidth() === true) {
        graph.animateDynamicLabelWidth();
      }
    });

    // add wheel event to the slider
    slider.on("wheel", function () {
      if (slider.node().disabled === true) {
        return;
      }
      const wheelEvent = d3.event;
      let offset;
      if (wheelEvent.deltaY < 0) {
        offset = 10;
      }
      if (wheelEvent.deltaY > 0) {
        offset = -10;
      }
      const oldVal = parseInt(slider.value);
      const newSliderValue = oldVal + offset;
      if (newSliderValue !== oldVal) {
        slider.value = newSliderValue;
        onChangeFunction(newSliderValue);
        slider.dispatchEvent(new Event("input")); // << set text and update the graphStyles
      }
      event.preventDefault();
    });
  }

  function addCheckBox(
    identifier,
    modeName,
    selector,
    onChangeFunc,
    updateLvl,
  ) {
    const configOptionContainer = d3
      .select(selector)
      .append("div")
      .classed("checkboxContainer", true);
    const configCheckbox = configOptionContainer
      .append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ConfigCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());

    configCheckbox.on("click", function (silent) {
      const isEnabled = configCheckbox.property("checked");
      onChangeFunc(isEnabled);
      var silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      if (silent !== true) {
        // updating graph when silent is false or the parameter is not given.
        if (updateLvl === 1) {
          graph.lazyRefresh();
          //graph.redrawWithoutForce
        }
        if (updateLvl === 2) {
          graph.update();
        }

        if (updateLvl === 3) {
          graph.updateDraggerElements();
        }
      }
    };

    configCheckbox.addEventListener("click", clickHandler);
    configCheckbox.__clickHandler = clickHandler;
    checkboxes.push(configCheckbox);
    configOptionContainer
      .append("label")
      .attr("for", identifier + "ConfigCheckbox")
      .text(modeName);
  }

  configMenu.setCheckBoxValue = function (identifier, value) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;
      if (cbdId === identifier) {
        checkboxes[i].property("checked", value);
        if ( checkboxes[i].on("click") ) {
          checkboxes[i].on("click")();
        }
        break;
      }
    }
  };

  configMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;
      if (cbdId === id) {
        return checkboxes[i].checked;
      }
    }
  };

  configMenu.updateSettings = function () {
    const silent = true;
    checkboxes.forEach(function (checkbox) {
      if (checkbox.__clickHandler) {
        checkbox.__clickHandler(silent);
      }
    });
  };

  return configMenu;
};
