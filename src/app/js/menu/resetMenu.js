/**
 * Contains the logic for the reset button.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const resetMenu = {};
  const options = graph.graphOptions();
  let resettableModules;
  const untouchedOptions = require("../../../shared/js/options")();

  /**
   * Adds the reset button to the website.
   * @param _resettableModules modules that can be resetted
   */
  resetMenu.setup = function (_resettableModules) {
    resettableModules = _resettableModules;
    document
      .getElementById("reset-button")
      .addEventListener("click", resetGraph);
    const menuEntry = d3.select("#resetOption");
    menuEntry.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
  };

  function resetGraph() {
  let resetFlashTimer;
    const resetButton = document.getElementById("reset-button");

    // 1. Apply visual feedback SYNCHRONOUSLY before any async work.
    //    will-change: transform on #reset-button and will-change: opacity
    //    on .reset-glow are ALWAYS set in CSS, so their compositor layers
    //    are pre-established — no creation delay at click time.
    clearTimeout(resetFlashTimer);
    resetButton.classList.remove("flash-out", "flash-active");
    const _reflow = resetButton.offsetWidth; // eslint-disable-line no-unused-vars
    resetButton.classList.add("flash-active");

    graph.resetSearchHighlight();
    graph.options().searchMenu().clearText();
    options.classDistance(untouchedOptions.classDistance());
    options.datatypeDistance(untouchedOptions.datatypeDistance());
    options.charge(untouchedOptions.charge());
    options.gravity(untouchedOptions.gravity());
    options.linkStrength(untouchedOptions.linkStrength());
    graph.reset();

    resettableModules.forEach(function (module) {
      module.reset();
    });

    graph.updateStyle();
  }

  resetMenu.setMenuMode = function ( enabled ){
    document.getElementById("reset-button").disabled = !enabled;
  };

  return resetMenu;
};
