/**
 * Contains the logic for setting up the gravity sliders.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const gravityMenu = {},
    sliders = [],
    options = graph.graphOptions(),
    defaultCharge = options.charge();

  /**
   * Adds the gravity sliders to the website.
   */
  gravityMenu.setup = function () {
    addDistanceSlider(
      "#classSliderOption",
      "class",
      "Class distance",
      options.classDistance,
    );
    addDistanceSlider(
      "#datatypeSliderOption",
      "datatype",
      "Datatype distance",
      options.datatypeDistance,
    );
  };

  function addDistanceSlider(selector, identifier, label, distanceFunction) {
    const defaultLinkDistance = distanceFunction();
    const sliderContainer = document.querySelector(selector);
    sliderContainer.__data__ = { distanceFunction: distanceFunction };

    const sliderValueLabel = sliderContainer.querySelector("#" + identifier + "DistanceSliderValue");
    sliderValueLabel.textContent = distanceFunction();

    const slider = sliderContainer.querySelector("#" + identifier + "DistanceSlider");
    slider.__data__ = { distanceFunction: distanceFunction };
    slider.setAttribute("value", distanceFunction());

    // Store slider for easier resetting
    sliders.push(slider);

    slider.addEventListener("focusout", function () {
      graph.updateStyle();
    });

    function handleInput() {
      const distance = slider.value;
      distanceFunction(distance);
      adjustCharge(defaultLinkDistance);
      sliderValueLabel.textContent = distance;
      graph.updateStyle();
    }
    slider.addEventListener("input", handleInput);
    slider.__inputHandler = handleInput;

    // add wheel event to the slider
    slider.addEventListener("wheel", function (event) {
      let offset = 0;
      if (event.deltaY < 0) {
        offset = 10;
      } else if (event.deltaY > 0) {
        offset = -10;
      }
      const oldVal = parseInt(slider.value, 10);
      const newSliderValue = oldVal + offset;
      if (newSliderValue !== oldVal && !isNaN(newSliderValue)) {
        slider.value = newSliderValue;
        distanceFunction(newSliderValue);
        slider.__inputHandler(); // << set text and update the graphStyles
      }
      event.preventDefault();
    });
  }

  function adjustCharge(defaultLinkDistance) {
    const greaterDistance = Math.max(
        options.classDistance(),
        options.datatypeDistance(),
      ),
      ratio = greaterDistance / defaultLinkDistance,
      newCharge = defaultCharge * ratio;

    options.charge(newCharge);
  }

  /**
   * Resets the gravity sliders to their default.
   */
  gravityMenu.reset = function () {
    sliders.forEach(function (slider) {
      const distanceFunction = slider.__data__.distanceFunction;
      slider.value = distanceFunction();
      slider.__inputHandler();
    });
  };

  return gravityMenu;
};
