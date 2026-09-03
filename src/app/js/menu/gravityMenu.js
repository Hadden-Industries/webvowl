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
  const sliders = [];

  gravityMenu.setup = function () {
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
    sliderValueLabel.textContent = defaultDistancePx;

    const slider = sliderContainer.querySelector(
      "#" + identifier + "DistanceSlider",
    );
    slider.setAttribute("value", defaultDistancePx);

    // Stored so the reset control can return every slider to its default.
    sliders.push({
      reset: function () {
        slider.value = defaultDistancePx;
        slider.dispatchEvent(new Event("input"));
      },
    });

    function handleInput() {
      const requestedDistancePx = Number(slider.value);
      if (!Number.isFinite(requestedDistancePx) || requestedDistancePx < 1) {
        return;
      }
      sliderValueLabel.textContent = slider.value;
      webVowlController?.setForceLayoutDistances({
        [distanceFieldName]: requestedDistancePx,
      });
    }
    slider.addEventListener("input", handleInput);

    slider.addEventListener("wheel", function (event) {
      let offset = 0;
      if (event.deltaY < 0) {
        offset = 10;
      } else if (event.deltaY > 0) {
        offset = -10;
      }
      const previousDistancePx = parseInt(slider.value, 10);
      const nextDistancePx = previousDistancePx + offset;
      if (nextDistancePx !== previousDistancePx && !isNaN(nextDistancePx)) {
        slider.value = nextDistancePx;
        slider.dispatchEvent(new Event("input"));
      }
      event.preventDefault();
    });
  }

  /**
   * Resets the gravity sliders to their default.
   */
  gravityMenu.reset = function () {
    sliders.forEach(function (s) {
      s.reset();
    });
  };

  return gravityMenu;
}
