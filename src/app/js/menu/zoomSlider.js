/** The zoom Slider **/
module.exports = function (graph) {
  const zoomSlider = {};
  const minMag = graph.options().minMagnification();
  const maxMag = graph.options().maxMagnification();

  const nominalFrameDuration = 1000 / 60;
  const maxFrameDuration = 100;
  const zoomInFactor = 1.02;
  const zoomOutFactor = 0.98;
  let activeAnimationFrame;
  let activeDirection = 0;
  let activePointerId;
  let previousFrameTime;
  let zoomValue;
  let showSlider = true;
  let controlsEnabled = true;
  const w = graph.options().width();
  const h = graph.options().height();
  let slider;

  const defZoom = Math.min(w, h) / 1000;

  function clearAllTimers() {
    cancelAnimationFrame(t_zoomOut);
    cancelAnimationFrame(t_zoomIn);
  }

  function timed_zoomOut() {
    zoomValue = 0.98 * zoomValue;
    // fail saves
    if (zoomValue < minMag) {
      zoomValue = minMag;
    if ( !controlsEnabled ) {return false;}
    }
    graph.setSliderZoom(zoomValue);
    updateZoomButtonStates(zoomValue);
    return !reachedBoundary;
  }

  function zoomAvailable(direction, value){
    const numericValue = Number(value);
    return direction > 0 ? numericValue < maxMag : numericValue > minMag;
  }

  function updateZoomButtonStates(value){
    const zoomInDisabled = !controlsEnabled || !zoomAvailable(1, value);
    const zoomOutDisabled = !controlsEnabled || !zoomAvailable(-1, value);
    d3.select("#zoomInButton")
      .property("disabled", zoomInDisabled);
    d3.select("#zoomOutButton")
      .property("disabled", zoomOutDisabled);
  }

  function timed_zoomIn() {
    zoomValue = 1.02 * zoomValue;
    // fail saves
    if (zoomValue > maxMag) {
      zoomValue = maxMag;
    }
  }

  function startContinuousZoom(direction){
    if ( !controlsEnabled || activeDirection !== 0 ) {return false;}

    zoomValue = Number(graph.scaleFactor());
    if ( !zoomAvailable(direction, zoomValue) ) {return false;}
    graph.options().navigationMenu().hideAllMenus();
    activeDirection = direction;
    previousFrameTime = performance.now();

    if ( applyZoomStep(direction, 1) ) {
      activeAnimationFrame = requestAnimationFrame(timedZoom);
    }
    return true;
  }

  function applySingleZoom(direction){
    if ( !controlsEnabled ) {return;}
    zoomValue = Number(graph.scaleFactor());
    if ( !zoomAvailable(direction, zoomValue) ) {return;}
    graph.options().navigationMenu().hideAllMenus();
    applyZoomStep(direction, 1);
  }

  function zoomPercentage(value){
    return Math.round(Number(value) * 100) + "%";
  }

  zoomSlider.setup = function () {
    slider = d3
      .select("#zoomSliderParagraph")
      .append("input")
      .datum({})
      .attr("id", "zoomSliderElement")
      .attr("type", "range")
      .attr("value", defZoom)
      .attr("min", minMag)
      .attr("max", maxMag)
      .attr("step", (maxMag - minMag) / 40)
      .attr("aria-label", "Zoom level")
      .attr("aria-orientation", "vertical")
      .attr("aria-valuetext", zoomPercentage(defZoom))
      .attr("title", "Zoom level")
      .property("disabled", !controlsEnabled)
      .on("input", function () {
        zoomSlider.zooming();
      });
    
    function handleContainerTouch(event){
      if ( !event || !event.touches || event.touches.length === 0 ) return;
      var touch = event.touches[0];
      var container = d3.select("#zoomSliderParagraph").node();
      if ( !container ) return;
      var rect = container.getBoundingClientRect();
      var touchY = touch.clientY;
      var fraction = (rect.bottom - touchY) / rect.height;
      fraction = Math.max(0, Math.min(1, fraction));
      var newZoom = minMag + fraction * (maxMag - minMag);
      slider.node().value = newZoom;
      zoomSlider.zooming();
      if ( event.cancelable ) event.preventDefault();
    }

    d3.select("#zoomSliderParagraph")
      .on("touchstart", handleContainerTouch)
      .on("touchmove", handleContainerTouch);

    d3.select("#zoomOutButton")
      .on("mousedown", function () {
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomOut = requestAnimationFrame(timed_zoomOut);
      })
      .on("touchstart", function () {
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomOut = requestAnimationFrame(timed_zoomOut);
      })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers)
      .attr("title", "zoom out");

    d3.select("#zoomInButton")
      .on("mousedown", function () {
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomIn = requestAnimationFrame(timed_zoomIn);
      })
      .on("touchstart", function () {
        graph.options().navigationMenu().hideAllMenus();
        zoomValue = graph.scaleFactor();
        t_zoomIn = requestAnimationFrame(timed_zoomIn);
      })
      .on("contextmenu", function (event){
        if ( event ) {
          event.preventDefault();
        }
      })
      .on("mouseup", clearAllTimers)
      .on("touchend", clearAllTimers)
      .on("touchcancel", clearAllTimers)
      .attr("title", "zoom in");

    d3.select("#centerGraphButton")
      .on("click", function () {
        graph.options().navigationMenu().hideAllMenus();
        graph.forceRelocationEvent();
      })
      .attr("title", "center graph");
  };

  zoomSlider.showSlider = function (val) {
    if (!arguments.length) {
      return showSlider;
    }
    updateZoomButtonStates(graph.scaleFactor());
      if ( !controlsEnabled ) {return;}
    d3.select("#zoomSlider").classed("hidden", !val);
    showSlider = val;
    if ( graph.options().sidebar && graph.options().sidebar() ) {
      graph.options().sidebar().updateDockedControlsPosition();
    }
  };

  zoomSlider.zooming = function () {
    if ( !controlsEnabled ) {return;}
    graph.options().navigationMenu().hideAllMenus();
    const zoomValue = slider.property("value");
    slider.attr("value", zoomValue);
    slider.attr("aria-valuetext", zoomPercentage(zoomValue));
    updateZoomButtonStates(zoomValue);
    graph.setSliderZoom(zoomValue);
  };

  zoomSlider.updateZoomSliderValue = function (val) {
    if (slider) {
      slider.attr("value", val);
      slider.property("value", val);
      slider.attr("aria-valuetext", zoomPercentage(val));
      updateZoomButtonStates(val);
    }
  };

  zoomSlider.setMenuMode = function ( enabled ){
    controlsEnabled = Boolean(enabled);
    if ( !controlsEnabled ) {stopContinuousZoom();}
    d3.select("#centerGraphButton").property("disabled", !controlsEnabled);
    if ( slider ) {slider.property("disabled", !controlsEnabled);}
    updateZoomButtonStates(graph.scaleFactor());
  };

  return zoomSlider;
};
