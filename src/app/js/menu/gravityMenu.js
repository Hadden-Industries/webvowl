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

    const sliderValueLabel = sliderContainer.querySelector(
      "#" + identifier + "DistanceSliderValue",
    );
    sliderValueLabel.textContent = defaultLinkDistance;

    const slider = sliderContainer.querySelector(
      "#" + identifier + "DistanceSlider",
    );
    slider.setAttribute("value", defaultLinkDistance);

    // Store slider for easier resetting
    sliders.push({
      reset: function () {
        slider.value = defaultLinkDistance;
        slider.dispatchEvent(new Event("input"));
      },
    });

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
        slider.dispatchEvent(new Event("input"));
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
    sliders.forEach(function (s) {
      s.reset();
    });
  };

  return gravityMenu;
};
