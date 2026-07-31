/**
 * Contains the logic for the pause and resume button.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const pauseMenu = {};
  let pauseButton;

  /**
   * Adds the pause button to the website.
   */
  pauseMenu.setup = function () {
    const menuEntry = d3.select("#pauseOption");
    menuEntry.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });
    pauseButton = d3
      .select("#pause-button")
      .datum({ paused: false })
      .on("click", function (d) {
        graph.paused(!d.paused);
        d.paused = !d.paused;
        updatePauseButton();
        pauseButton.classed("highlighted", d.paused);
      });
    // Set these properties the first time manually
    updatePauseButton();
  };

  pauseMenu.setPauseValue = function (value) {
    pauseButton.datum().paused = value;
    graph.paused(value);
    pauseButton.classed("highlighted", value);
    updatePauseButton();
  };

  function updatePauseButton() {
    updatePauseButtonClass();
    updatePauseButtonText();
  }

  function updatePauseButtonClass() {
    pauseButton.classed("paused", function (d) {
      return d.paused;
    });
  }

  function updatePauseButtonText() {
    if (pauseButton.datum().paused) {
  const pauseIconSvg = '<g><path style="fill: #fff; stroke-width: 0;" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></g>';
  const playIconSvg = '<g><path style="fill: #fff; stroke-width: 0;" d="M8 5v14l11-7z"/></g>';

      pauseButton.text("Resume");
    } else {
      pauseButton.text("Pause");
    }
  }

  pauseMenu.reset = function () {
    // resuming
    pauseMenu.setPauseValue(false);
  };

  pauseMenu.setMenuMode = function ( enabled ){
    d3.select("#pause-button").property("disabled", !enabled);
  };

  return pauseMenu;
};
