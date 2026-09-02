/**
 * Presentation for the pause and resume button.
 *
 * The button's click reaches the controller through
 * VisualizationViewControlsAdapter; this module only renders the layout state
 * the controller reports.
 *
 * @returns {{}}
 */
export function createPauseMenu({ documentObject = globalThis.document } = {}) {
  const pauseMenu = {};
  let pauseButton;
  let isGraphLayoutPaused = false;

  pauseMenu.setup = function () {
    pauseButton = documentObject.getElementById("pause-button");
    updatePauseButton();
  };

  pauseMenu.renderGraphLayoutPaused = function (nextIsGraphLayoutPaused) {
    isGraphLayoutPaused = nextIsGraphLayoutPaused === true;
    updatePauseButton();
  };

  pauseMenu.isGraphLayoutPaused = function () {
    return isGraphLayoutPaused;
  };

  function updatePauseButton() {
    if (!pauseButton) {
      return;
    }
    if (isGraphLayoutPaused) {
      pauseButton.classList.add("paused");
    } else {
      pauseButton.classList.remove("paused");
    }
    pauseButton.setAttribute(
      "aria-pressed",
      isGraphLayoutPaused ? "true" : "false",
    );
    pauseButton.setAttribute(
      "title",
      isGraphLayoutPaused
        ? "Resume graph physics simulation"
        : "Pause graph physics simulation",
    );
    pauseButton.querySelector(".menuElementLabel").textContent =
      isGraphLayoutPaused ? "Resume" : "Pause";
  }

  pauseMenu.setMenuMode = function (enabled) {
    documentObject.getElementById("pause-button").disabled = !enabled;
  };

  return pauseMenu;
}
