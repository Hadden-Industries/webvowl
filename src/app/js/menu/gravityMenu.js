/**
 * Contains the logic for setting up the gravity sliders.
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  const gravityMenu = {},
    sliders = [],
    options = graph.graphOptions(),
    defaultCharge = options.charge();
  
  
  /**
   * Adds the gravity sliders to the website.
   */
  gravityMenu.setup = function (){
    addDistanceSlider("#classSliderOption", "class", "Class distance", options.classDistance);
    addDistanceSlider("#datatypeSliderOption", "datatype", "Datatype distance", options.datatypeDistance);
  };
  
  function addDistanceSlider( selector, identifier, label, distanceFunction ){
    const defaultLinkDistance = distanceFunction();
    const sliderContainer = d3.select(selector)
      .datum({ distanceFunction: distanceFunction });

    const sliderValueLabel = sliderContainer.select("#" + identifier + "DistanceSliderValue")
      .text(distanceFunction());

    const slider = sliderContainer.select("#" + identifier + "DistanceSlider")
      .datum({ distanceFunction: distanceFunction })
      .attr("value", distanceFunction());
    
    // Store slider for easier resetting
    sliders.push(slider);
    
    slider.on("focusout", function (){
      graph.updateStyle();
    });
    
    slider.on("input", function (){
      const distance = slider.property("value");
      distanceFunction(distance);
      adjustCharge(defaultLinkDistance);
      sliderValueLabel.text(distance);
      graph.updateStyle();
    });
    
    // add wheel event to the slider
    slider.on("wheel", function (event){
      const wheelEvent = event;
      let offset;
      if ( wheelEvent.deltaY < 0 ) {offset = 10;}
      if ( wheelEvent.deltaY > 0 ) {offset = -10;}
      const oldVal = parseInt(slider.property("value"));
      const newSliderValue = oldVal + offset;
      if ( newSliderValue !== oldVal ) {
        slider.property("value", newSliderValue);
        distanceFunction(newSliderValue);
        slider.on("input")(); // << set text and update the graphStyles
      }
      event.preventDefault();
    });
  }
  
  function adjustCharge( defaultLinkDistance ){
    const greaterDistance = Math.max(options.classDistance(), options.datatypeDistance()),
      ratio = greaterDistance / defaultLinkDistance,
      newCharge = defaultCharge * ratio;
    
    options.charge(newCharge);
  }
  
  /**
   * Resets the gravity sliders to their default.
   */
  gravityMenu.reset = function (){
    sliders.forEach(function ( slider ){
      slider.property("value", function ( d ){
        // Simply reload the distance from the options
        return d.distanceFunction();
      });
      slider.on("input")();
    });
  };
  
  
  return gravityMenu;
};
