import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";

export function createConfigMenu({
  webVowlController,
  maxLabelWidthPx,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
} = {}) {
  const configMenu = {},
    checkboxes = [];

  configMenu.setup = function (zoomSlider) {
    addCheckBox(
      "showZoomSlider",
      "Zoom controls",
      "#zoomSliderOption",
      zoomSlider.showSlider,
    );
    addLabelWidthSlider(
      "#maxLabelWidthSliderOption",
      "maxLabelWidth",
      "Max label width",
      maxLabelWidthPx,
    );
  };

  function addLabelWidthSlider(selector, identifier, label, defaultWidthPx) {
    const sliderContainer = documentObject.querySelector(selector);
    const sliderValueLabel = sliderContainer.querySelector(
      "#" + identifier + "SliderValue",
    );
    sliderValueLabel.textContent = defaultWidthPx;
    const slider = sliderContainer.querySelector("#" + identifier + "Slider");
    slider.setAttribute("value", defaultWidthPx);

    // The slider states the width a reader asked for. Whether that width is
    // currently visible, and whether to animate labels into it, is renderer
    // behaviour.
    function requestLabelWidth() {
      const requestedWidthPx = Number(slider.value);
      if (!Number.isFinite(requestedWidthPx) || requestedWidthPx < 1) {
        return;
      }
      sliderValueLabel.textContent = slider.value;
      void runVisualizationControlAction(
        () =>
          webVowlController.setVisualizationModes({
            maxLabelWidthPx: requestedWidthPx,
          }),
        documentObject,
      );
    }

    slider.addEventListener("input", requestLabelWidth);

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
        slider.dispatchEvent(new Event("input"));
      }
      event.preventDefault();
    });
  }

  function addCheckBox(identifier, modeName, selector, onChangeFunc) {
    const configOptionContainer = documentObject.querySelector(selector);
    const configCheckbox = configOptionContainer.querySelector(
      "#" + identifier + "ConfigCheckbox",
    );
    configCheckbox.checked = onChangeFunc();

    // Showing or hiding the zoom controls is presentation, so it needs no
    // recomputation of the drawn graph.
    const clickHandler = function () {
      onChangeFunc(configCheckbox.checked);
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
    checkboxes.forEach(function (item) {
      item.update();
    });
  };

  return configMenu;
}
