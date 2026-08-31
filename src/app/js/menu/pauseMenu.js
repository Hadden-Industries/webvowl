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
    pauseButton = document.getElementById("pause-button");
    pauseButton.datum = { paused: false };
    pauseButton.addEventListener("click", function () {
      const d = pauseButton.datum;
      graph.paused(!d.paused);
      d.paused = !d.paused;
      updatePauseButton();
    });
    // Set these properties the first time manually
    updatePauseButton();
  };

  pauseMenu.setPauseValue = function (value) {
    pauseButton.datum.paused = value;
    graph.paused(value);
    updatePauseButton();
  };

  function updatePauseButton() {
    const isPaused = pauseButton.datum.paused;
    if (isPaused) {
      pauseButton.classList.add("paused");
    } else {
      pauseButton.classList.remove("paused");
    }
    pauseButton.setAttribute("aria-pressed", isPaused ? "true" : "false");
    pauseButton.setAttribute(
      "title",
      isPaused
        ? "Resume graph physics simulation"
        : "Pause graph physics simulation",
    );
    pauseButton.querySelector(".menuElementLabel").textContent = isPaused
      ? "Resume"
      : "Pause";
  }

  pauseMenu.reset = function () {
    // resuming
    pauseMenu.setPauseValue(false);
  };

  pauseMenu.setMenuMode = function (enabled) {
    document.getElementById("pause-button").disabled = !enabled;
  };

  return pauseMenu;
};
