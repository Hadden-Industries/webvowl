module.exports = function (graph) {
  const configMenu = {},
    checkboxes = [];

  configMenu.setup = function (zoomSlider) {
    addCheckBox(
      "showZoomSlider",
      "Zoom controls",
      "#zoomSliderOption",
      zoomSlider.showSlider,
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
    const sliderContainer = document.querySelector(selector);
    const sliderValueLabel = sliderContainer.querySelector(
      "#" + identifier + "SliderValue",
    );
    sliderValueLabel.textContent = onChangeFunction();
    const slider = sliderContainer.querySelector("#" + identifier + "Slider");
    slider.setAttribute("value", onChangeFunction());

    slider.addEventListener("input", function () {
      const value = slider.value;
      onChangeFunction(value);
      sliderValueLabel.textContent = value;
      if (graph.options().dynamicLabelWidth() === true) {
        graph.animateDynamicLabelWidth();
      }
    });

    // add wheel event to the slider
    slider.addEventListener("wheel", function (event) {
      if (slider.disabled === true) {
        return;
      }
      const wheelEvent = event;
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
    const configOptionContainer = document.querySelector(selector);
    const configCheckbox = configOptionContainer.querySelector(
      "#" + identifier + "ConfigCheckbox",
    );
    configCheckbox.checked = onChangeFunc();

    const clickHandler = function (arg1, arg2) {
      const isEnabled = configCheckbox.checked;
      onChangeFunc(isEnabled);
      const silent =
        typeof arg1 === "boolean"
          ? arg1
          : typeof arg2 === "boolean"
            ? arg2
            : false;
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
    checkboxes.push({
      id: configCheckbox.id,
      element: configCheckbox,
      update: clickHandler,
    });
  }

  configMenu.setCheckBoxValue = function (identifier, value) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];
      if (item.id === identifier) {
        item.element.checked = value;
        item.update();
        break;
      }
    }
  };

  configMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];
      if (item.id === id) {
        return item.element.checked;
      }
    }
  };

  configMenu.updateSettings = function () {
    const silent = true;
    checkboxes.forEach(function (item) {
      item.update(silent);
    });
  };

  return configMenu;
};
