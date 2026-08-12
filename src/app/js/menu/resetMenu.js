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
  const untouchedOptions = webvowl.options();

  /**
   * Adds the reset button to the website.
   * @param _resettableModules modules that can be resetted
   */
  resetMenu.setup = function (_resettableModules) {
    resettableModules = _resettableModules;
    document
      .getElementById("reset-button")
      .addEventListener("click", resetGraph);
  };

  let resetFlashTimer;
  function resetGraph() {
    const resetButton = document.getElementById("reset-button");

    // 1. Apply visual feedback SYNCHRONOUSLY before any async work.
    //    will-change: transform on #reset-button and will-change: opacity
    //    on .reset-glow are ALWAYS set in CSS, so their compositor layers
    //    are pre-established — no creation delay at click time.
    clearTimeout(resetFlashTimer);
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
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
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

        // Trigger glow fade-out via CSS transition — runs on the compositor
        // layer of .reset-glow independently of any remaining main-thread work.
        resetButton.classList.remove("flash-active");
        resetButton.classList.add("flash-out");
        resetFlashTimer = setTimeout(function () {
          resetButton.classList.remove("flash-out");
        }, 700);
      });
    });
  }

  resetMenu.setMenuMode = function (enabled) {
    document.getElementById("reset-button").disabled = !enabled;
  };

  return resetMenu;
};
