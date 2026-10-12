import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";
import { bindNumericRangeControl } from "../ui/numericRangeControl.js";

/**
 * Contains the logic for setting up the gravity sliders.
 *
 * A slider states the distance the reader asked for. What that distance means
 * for the force simulation — the charge derived from it, and when to restyle —
 * is renderer behaviour and stays behind the seam.
 */
export function createGravityMenu({
  webVowlController,
  classDistancePx,
  datatypeDistancePx,
  documentObject = globalThis.document,
} = {}) {
  const gravityMenu = {};
  const bindings = [];

  gravityMenu.setup = function () {
    bindings.splice(0).forEach((dispose) => dispose());
    addDistanceSlider(
      "#classSliderOption",
      "class",
      classDistancePx,
      "classDistancePx",
    );
    addDistanceSlider(
      "#datatypeSliderOption",
      "datatype",
      datatypeDistancePx,
      "datatypeDistancePx",
    );
  };

  function addDistanceSlider(
    selector,
    identifier,
    defaultDistancePx,
    distanceFieldName,
  ) {
    const sliderContainer = documentObject.querySelector(selector);
    const sliderValueLabel = sliderContainer.querySelector(
      "#" + identifier + "DistanceSliderValue",
    );

    const slider = sliderContainer.querySelector(
      "#" + identifier + "DistanceSlider",
    );
    bindings.push(
      bindNumericRangeControl(
        slider,
        sliderValueLabel,
        defaultDistancePx,
        (requestedDistancePx) => {
          void runVisualizationControlAction(
            () =>
              webVowlController.setForceLayoutDistances({
                [distanceFieldName]: requestedDistancePx,
              }),
            documentObject,
          );
        },
      ),
    );
  }

  return gravityMenu;
}
