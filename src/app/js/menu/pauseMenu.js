/**
 * Contains the logic for the pause and resume button.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  const pauseMenu = {};
  let pauseButton;
  
  
  /**
   * Adds the pause button to the website.
   */
  pauseMenu.setup = function (){
    pauseButton = d3.select("#pause-button")
      .datum({ paused: false })
      .on("click", function (){
        const d = pauseButton.datum();
        graph.paused(!d.paused);
        d.paused = !d.paused;
        updatePauseButton();
      });
    // Set these properties the first time manually
    updatePauseButton();
  };
  
  pauseMenu.setPauseValue = function ( value ){
    pauseButton.datum().paused = value;
    graph.paused(value);
    updatePauseButton();
  };
  
  function updatePauseButton(){
    const isPaused = pauseButton.datum().paused;
    pauseButton
      .classed("paused", isPaused)
      .attr("aria-pressed", isPaused ? "true" : "false")
      .attr("title", isPaused ? "Resume graph physics simulation" : "Pause graph physics simulation")
      .select(".menuElementLabel")
      .text(isPaused ? "Resume" : "Pause");
  }
  
  pauseMenu.reset = function (){
    // resuming
    pauseMenu.setPauseValue(false);
  };
  
  
  pauseMenu.setMenuMode = function ( enabled ){
    d3.select("#pause-button").property("disabled", !enabled);
  };

  return pauseMenu;
};
