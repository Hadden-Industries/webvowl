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
        pauseButton.classed("highlighted", d.paused);
      });
    // Set these properties the first time manually
    updatePauseButton();
  };
  
  pauseMenu.setPauseValue = function ( value ){
    pauseButton.datum().paused = value;
    graph.paused(value);
    pauseButton.classed("highlighted", value);
    updatePauseButton();
  };
  
  function updatePauseButton(){
    updatePauseButtonClass();
    updatePauseButtonText();
  }
  
  function updatePauseButtonClass(){
    const isPaused = pauseButton.datum().paused;
    pauseButton.classed("paused", isPaused);
    pauseButton.attr("aria-pressed", isPaused ? "true" : "false");
  }
  
  const pauseIconSvg = '<g><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></g>';
  const playIconSvg = '<g><path d="M8 5v14l11-7z"/></g>';

  function updatePauseButtonText(){
    const isPaused = pauseButton.datum().paused;
    const iconMarkup = isPaused ? playIconSvg : pauseIconSvg;
    const labelText = isPaused ? "Resume" : "Pause";

    let iconContainer = pauseButton.select("i");
    if ( iconContainer.empty() ) {
      iconContainer = pauseButton.insert("i", ":first-child");
    }
    let svgElement = iconContainer.select("svg");
    if ( svgElement.empty() ) {
      svgElement = iconContainer.append("svg")
        .attr("viewBox", "0 0 24 24")
        .attr("class", "menuElementSvgElement")
        .attr("aria-hidden", "true");
    }
    svgElement.html(iconMarkup);

    // Update text node following <i>
    const buttonNode = pauseButton.node();
    if ( buttonNode ) {
      for ( let i = 0; i < buttonNode.childNodes.length; i++ ) {
        const child = buttonNode.childNodes[i];
        if ( child.nodeType === 3 ) {
          child.textContent = labelText;
          return;
        }
      }
      buttonNode.appendChild(document.createTextNode(labelText));
    }
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
