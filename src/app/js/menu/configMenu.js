import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";
import { bindNumericRangeControl } from "../ui/numericRangeControl.js";

export function createConfigMenu({
  webVowlController,
  maxLabelWidthPx,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
} = {}) {
  const configMenu = {},
    checkboxes = [],
    bindings = [];

  configMenu.setup = function (zoomSlider) {
    bindings.splice(0).forEach((dispose) => dispose());
    checkboxes.length = 0;
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
    const slider = sliderContainer.querySelector("#" + identifier + "Slider");

    // The slider states the width a reader asked for. Whether that width is
    // currently visible, and whether to animate labels into it, is renderer
    // behaviour.
    bindings.push(
      bindNumericRangeControl(
        slider,
        sliderValueLabel,
        defaultWidthPx,
        (requestedWidthPx) => {
          void runVisualizationControlAction(
            () =>
              webVowlController.setVisualizationModes({
                maxLabelWidthPx: requestedWidthPx,
              }),
            documentObject,
          );
        },
      ),
    );
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
    bindings.push(() =>
      configCheckbox.removeEventListener("click", clickHandler),
    );
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
