import { applicationUiModule } from "../ui/applicationUiRegistry.js";

/**
 * Contains the logic for the reset button.
 *
 * The control states that the reader asked for defaults back. What the drawn
 * graph returns to — its viewport, its force settings, its search highlight —
 * is renderer-owned and reached through the controller, so this menu holds no
 * renderer at all.
 *
 * @returns {{}}
 */
export function createResetMenu({
  clearTimeout: clearFlashTimer = globalThis.clearTimeout,
  documentObject = globalThis.document,
  requestAnimationFrame:
    requestNextAnimationFrame = globalThis.requestAnimationFrame,
  setTimeout: scheduleFlashTimer = globalThis.setTimeout,
  webVowlController,
  windowObject = globalThis.window,
} = {}) {
  const resetMenu = {};
  let resettableModules;

  /**
   * Adds the reset button to the website.
   * @param _resettableModules modules that can be resetted
   */
  resetMenu.setup = function (_resettableModules) {
    resettableModules = _resettableModules;
    documentObject
      .getElementById("reset-button")
      .addEventListener("click", resetGraph);
  };

  let resetFlashTimer;
  function resetGraph() {
    const resetButton = documentObject.getElementById("reset-button");

    // 1. Apply visual feedback SYNCHRONOUSLY before any async work.
    //    will-change: transform on #reset-button and will-change: opacity
    //    on .reset-glow are ALWAYS set in CSS, so their compositor layers
    //    are pre-established — no creation delay at click time.
    clearFlashTimer(resetFlashTimer);
    resetButton.classList.remove("flash-out", "flash-active");
    const _reflow = resetButton.offsetWidth; // eslint-disable-line no-unused-vars
    resetButton.classList.add("flash-active");

    // 2. DOUBLE requestAnimationFrame: guarantees TWO full paint+commit
    //    cycles complete before the heavy work starts.
    //
    //    Frame N   (after click event):  classes set → browser paints
    //    Frame N+1 (first rAF):          scale frame 1 painted & committed
    //    Frame N+2 (second rAF):         the reset runs — compositor now
    //                                    has N+1's committed state and can
    //                                    animate independently.
    requestNextAnimationFrame(function () {
      requestNextAnimationFrame(function () {
        const searchMenu = applicationUiModule("searchMenu");
        searchMenu?.clearText();
        searchMenu?.reportClearedOntologySelection();
        webVowlController?.resetVisualization();

        resettableModules.forEach(function (resettableModule) {
          resettableModule.reset();
        });
        webVowlController?.setGraphLayoutPaused({ isPaused: false });

        // Trigger glow fade-out via CSS transition — runs on the compositor
        // layer of .reset-glow independently of any remaining main-thread work.
        resetButton.classList.remove("flash-active");
        resetButton.classList.add("flash-out");
        resetFlashTimer = scheduleFlashTimer(function () {
          resetButton.classList.remove("flash-out");
        }, 700);
      });
    });
  }

  resetMenu.setMenuMode = function (enabled) {
    documentObject.getElementById("reset-button").disabled = !enabled;
  };

  return resetMenu;
}
