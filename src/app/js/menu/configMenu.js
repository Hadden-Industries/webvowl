module.exports = function ( graph ){
  const configMenu = {},
    checkboxes = [];
  
  
  configMenu.setup = function (){
    addCheckBox("showZoomSlider", "Zoom controls", "#zoomSliderOption", graph.options().zoomSlider().showSlider, 0);
    addLabelWidthSlider("#maxLabelWidthSliderOption", "maxLabelWidth", "Max label width", graph.options().maxLabelWidth);
  };
  
  
  function addLabelWidthSlider( selector, identifier, label, onChangeFunction ){
    const sliderContainer = d3.select(selector)
      .append("div")
      .classed("distanceSliderContainer", true);

    const sliderHeader = sliderContainer.append("div")
      .classed("slider-header", true);

    sliderHeader.append("label")
      .classed("description", true)
      .attr("for", identifier + "Slider")
      .text(label);

    const sliderValueLabel = sliderHeader.append("span")
      .classed("slider-value", true)
      .attr("id", identifier + "SliderValue")
      .text(onChangeFunction());

    const touchWrapper = sliderContainer.append("div")
      .classed("range-touch-wrapper", true);

    const slider = touchWrapper.append("input")
      .attr("id", identifier + "Slider")
      .attr("type", "range")
      .attr("min", 20)
      .attr("max", 600)
      .attr("value", onChangeFunction())
      .attr("step", 10)
      .attr("aria-label", label);
    
    slider.on("input", function (){
      const value = slider.property("value");
      onChangeFunction(value);
      sliderValueLabel.text(value);
      if ( graph.options().dynamicLabelWidth() === true )
        {graph.animateDynamicLabelWidth();}
    });
    
    // add wheel event to the slider
    slider.on("wheel", function (event){
      if ( slider.node().disabled === true ) {return;}
      const wheelEvent = event;
      let offset;
      if ( wheelEvent.deltaY < 0 ) {offset = 10;}
      if ( wheelEvent.deltaY > 0 ) {offset = -10;}
      const oldVal = parseInt(slider.property("value"));
      const newSliderValue = oldVal + offset;
      if ( newSliderValue !== oldVal ) {
        slider.property("value", newSliderValue);
        onChangeFunction(newSliderValue);
        slider.on("input")(); // << set text and update the graphStyles
      }
      event.preventDefault();
    });
  }
  
  function addCheckBox( identifier, modeName, selector, onChangeFunc, updateLvl ){
    const configOptionContainer = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true);
    const configCheckbox = configOptionContainer.append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ConfigCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());
    
    
    configCheckbox.on("click", function ( arg1, arg2 ){
      const isEnabled = configCheckbox.property("checked");
      onChangeFunc(isEnabled);
      const silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      if ( silent !== true ) {
        // updating graph when silent is false or the parameter is not given.
        if ( updateLvl === 1 ) {
          graph.lazyRefresh();
          //graph.redrawWithoutForce
        }
        if ( updateLvl === 2 ) {
          graph.update();
        }
        
        if ( updateLvl === 3 ) {
          graph.updateDraggerElements();
        }
      }
      
    });
    checkboxes.push(configCheckbox);
    configOptionContainer.append("label")
      .attr("for", identifier + "ConfigCheckbox")
      .text(modeName);
  }
  
  configMenu.setCheckBoxValue = function ( identifier, value ){
    for ( let i = 0; i < checkboxes.length; i++ ) {
      const cbdId = checkboxes[i].attr("id");
      if ( cbdId === identifier ) {
        checkboxes[i].property("checked", value);
        if ( checkboxes[i].on("click") ) {
          checkboxes[i].on("click")();
        }
        break;
      }
    }
  };
  
  configMenu.getCheckBoxValue = function ( id ){
    for ( let i = 0; i < checkboxes.length; i++ ) {
      const cbdId = checkboxes[i].attr("id");
      if ( cbdId === id ) {
        return checkboxes[i].property("checked");
      }
    }
  };
  
  configMenu.updateSettings = function (){
    const silent = true;
    checkboxes.forEach(function ( checkbox ){
      checkbox.on("click")(silent);
    });
  };
  
  return configMenu;
};
