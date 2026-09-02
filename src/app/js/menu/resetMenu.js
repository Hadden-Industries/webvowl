import { applicationUiModule } from "../ui/applicationUiRegistry.js";
import { RENDERED_GRAPH_CONFIGURATION_DEFAULTS } from "../../../webvowl/js/runtime/renderedGraphConfiguration.js";

/**
 * Contains the logic for the reset button.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
export function createResetMenu(
  graph,
  {
    clearTimeout: clearFlashTimer = globalThis.clearTimeout,
    documentObject = globalThis.document,
    requestAnimationFrame:
      requestNextAnimationFrame = globalThis.requestAnimationFrame,
    setTimeout: scheduleFlashTimer = globalThis.setTimeout,
    webVowlController,
    windowObject = globalThis.window,
  } = {},
) {
  const resetMenu = {};
  const options = graph.graphOptions();
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
    //    Frame N+2 (second rAF):         graph.reset() runs — compositor
    //                                    now has N+1's committed state and
    //                                    can animate independently.
    requestNextAnimationFrame(function () {
      requestNextAnimationFrame(function () {
        graph.resetSearchHighlight();
        const searchMenu = applicationUiModule("searchMenu");
        searchMenu?.clearText();
        searchMenu?.reportClearedOntologySelection();
        options.classDistance(
          RENDERED_GRAPH_CONFIGURATION_DEFAULTS.classDistance,
        );
        options.datatypeDistance(
          RENDERED_GRAPH_CONFIGURATION_DEFAULTS.datatypeDistance,
        );
        options.charge(RENDERED_GRAPH_CONFIGURATION_DEFAULTS.charge);
        options.gravity(RENDERED_GRAPH_CONFIGURATION_DEFAULTS.gravity);
        options.linkStrength(
          RENDERED_GRAPH_CONFIGURATION_DEFAULTS.linkStrength,
        );
        graph.reset();

        resettableModules.forEach(function (resettableModule) {
          resettableModule.reset();
        });
        webVowlController?.setGraphLayoutPaused({ isPaused: false });

        graph.updateStyle();

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
