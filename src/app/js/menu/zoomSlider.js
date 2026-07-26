/** The zoom Slider **/
module.exports = function ( graph ){
  const zoomSlider = {};
  const minMag = graph.options().minMagnification();
  const maxMag = graph.options().maxMagnification();
  let t_zoomOut;
  let t_zoomIn;
  let zoomValue;
  let showSlider = true;
  const w = graph.options().width();
  const h = graph.options().height();
  let slider;
  
  const defZoom = Math.min(w, h) / 1000;
  
  function clearAllTimers(){
    cancelAnimationFrame(t_zoomOut);
    cancelAnimationFrame(t_zoomIn);
  }
  
  function timed_zoomOut(){
    zoomValue = 0.98 * zoomValue;
    // fail saves
    if ( zoomValue < minMag ) {
      zoomValue = minMag;
    }
    graph.setSliderZoom(zoomValue);
    t_zoomOut = requestAnimationFrame(timed_zoomOut);
  }
  
  function timed_zoomIn(){
    zoomValue = 1.02 * zoomValue;
    // fail saves
    if ( zoomValue > maxMag ) {
      zoomValue = maxMag;
    }
    graph.setSliderZoom(zoomValue);
    t_zoomIn = requestAnimationFrame(timed_zoomIn);
  }
  
  zoomSlider.setup = function (){
    slider = d3.select("#zoomSliderParagraph").append("input")
      .datum({})
      .attr("id", "zoomSliderElement")
      .attr("type", "range")
      .attr("value", defZoom)
      .attr("min", minMag)
      .attr("max", maxMag)
      .attr("step", (maxMag - minMag) / 40)
      .attr("title", "zoom factor")
      .on("input", function (){
        zoomSlider.zooming();
      });
    
    function handleContainerTouch(event){
      if ( !event || !event.touches || event.touches.length === 0 ) {return;}
      const touch = event.touches[0];
      const container = d3.select("#zoomSliderParagraph").node();
      if ( !container ) {return;}
      const rect = container.getBoundingClientRect();
      const touchY = touch.clientY;
      let fraction = (rect.bottom - touchY) / rect.height;
      fraction = Math.max(0, Math.min(1, fraction));
      const newZoom = minMag + fraction * (maxMag - minMag);
      slider.node().value = newZoom;
      zoomSlider.zooming();
      if ( event.cancelable ) {event.preventDefault();}
    }

    d3.select("#zoomSliderParagraph")
      .on("touchstart", handleContainerTouch)
      .on("touchmove", handleContainerTouch);
    
    d3.select("#zoomOutButton").on("mousedown", function (){
      graph.options().navigationMenu().hideAllMenus();
      zoomValue = graph.scaleFactor();
      t_zoomOut = requestAnimationFrame(timed_zoomOut);
    })
      .on("touchstart", function (){
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomOut = requestAnimationFrame(timed_zoomOut);
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers)
      .attr("title", "zoom out");
    
    d3.select("#zoomInButton").on("mousedown", function (){
      graph.options().navigationMenu().hideAllMenus();
      zoomValue = graph.scaleFactor();
      t_zoomIn = requestAnimationFrame(timed_zoomIn);
    })
      .on("touchstart", function (){
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomIn = requestAnimationFrame(timed_zoomIn);
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers)
      .attr("title", "zoom in");
    
    d3.select("#centerGraphButton").on("click", function (){
      graph.options().navigationMenu().hideAllMenus();
      graph.forceRelocationEvent();
    }).attr("title", "center graph");
    
  };
  
  zoomSlider.showSlider = function ( val ){
    if ( !arguments.length ) {return showSlider;}
    d3.select("#zoomSlider").classed("hidden", !val);
    showSlider = val;
    if ( graph.options().sidebar && graph.options().sidebar() ) {
      graph.options().sidebar().updateDockedControlsPosition();
    }
  };
  
  zoomSlider.zooming = function (){
    graph.options().navigationMenu().hideAllMenus();
    const zoomValue = slider.property("value");
    slider.attr("value", zoomValue);
    graph.setSliderZoom(zoomValue);
  };
  
  zoomSlider.updateZoomSliderValue = function ( val ){
    if ( slider ) {
      slider.attr("value", val);
      slider.property("value", val);
    }
  };
  
  return zoomSlider;
};
