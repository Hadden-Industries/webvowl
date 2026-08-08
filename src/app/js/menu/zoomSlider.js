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

  function stopContinuousZoom() {
    if (activeAnimationFrame !== undefined) {
      cancelAnimationFrame(activeAnimationFrame);
    }
    activeAnimationFrame = undefined;
    activeDirection = 0;
    activePointerId = undefined;
    previousFrameTime = undefined;
  }

  function applyZoomStep(direction, elapsedFrames) {
    if (!controlsEnabled) {
      return false;
    }
    const factor = direction > 0 ? zoomInFactor : zoomOutFactor;
    zoomValue *= Math.pow(factor, elapsedFrames);
    const reachedBoundary =
      direction > 0 ? zoomValue >= maxMag : zoomValue <= minMag;
    if (reachedBoundary) {
      zoomValue = direction > 0 ? maxMag : minMag;
    }
    graph.setSliderZoom(zoomValue);
    updateZoomButtonStates(zoomValue);
    return !reachedBoundary;
  }

  function zoomAvailable(direction, value) {
    const numericValue = Number(value);
    return direction > 0 ? numericValue < maxMag : numericValue > minMag;
  }

  function updateZoomButtonStates(value) {
    const zoomInDisabled = !controlsEnabled || !zoomAvailable(1, value);
    const zoomOutDisabled = !controlsEnabled || !zoomAvailable(-1, value);
    d3.select("#zoomInButton").property("disabled", zoomInDisabled);
    d3.select("#zoomOutButton").property("disabled", zoomOutDisabled);
  }

  function timedZoom(timestamp) {
    activeAnimationFrame = undefined;
    if (activeDirection === 0) {
      return;
    }

    const elapsed = Math.min(
      maxFrameDuration,
      Math.max(0, timestamp - previousFrameTime),
    );
    previousFrameTime = timestamp;
    if (applyZoomStep(activeDirection, elapsed / nominalFrameDuration)) {
      activeAnimationFrame = requestAnimationFrame(timedZoom);
    }
  }

  function startContinuousZoom(direction) {
    if (!controlsEnabled || activeDirection !== 0) {
      return false;
    }

    zoomValue = Number(graph.scaleFactor());
    if (!zoomAvailable(direction, zoomValue)) {
      return false;
    }
    graph.options().navigationMenu().hideAllMenus();
    activeDirection = direction;
    previousFrameTime = performance.now();

    if (applyZoomStep(direction, 1)) {
      activeAnimationFrame = requestAnimationFrame(timedZoom);
    }
    return true;
  }

  function applySingleZoom(direction) {
    if (!controlsEnabled) {
      return;
    }
    zoomValue = Number(graph.scaleFactor());
    if (!zoomAvailable(direction, zoomValue)) {
      return;
    }
    graph.options().navigationMenu().hideAllMenus();
    applyZoomStep(direction, 1);
  }

  function zoomPercentage(value) {
    return Math.round(Number(value) * 100) + "%";
  }

  zoomSlider.setup = function () {
    slider = d3
      .select("#zoomSliderElement")
      .datum({})
      .attr("value", defZoom)
      .attr("min", minMag)
      .attr("max", maxMag)
      .attr("step", (maxMag - minMag) / 40)
      .attr("aria-valuetext", zoomPercentage(defZoom))
      .property("disabled", !controlsEnabled)
      .on("input", function () {
        zoomSlider.zooming();
      });

    function handleContainerTouch(event) {
      if (
        !controlsEnabled ||
        !event ||
        !event.touches ||
        event.touches.length === 0
      ) {
        return;
      }
      const touch = event.touches[0];
      const container = d3.select("#zoomSliderParagraph").node();
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const touchY = touch.clientY;
      let fraction = (rect.bottom - touchY) / rect.height;
      fraction = Math.max(0, Math.min(1, fraction));
      const newZoom = minMag + fraction * (maxMag - minMag);
      slider.node().value = newZoom;
      zoomSlider.zooming();
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    d3.select("#zoomSliderParagraph")
      .on("touchstart", handleContainerTouch)
      .on("touchmove", handleContainerTouch);

    function bindZoomButton(selector, direction, title) {
      d3.select(selector)
        .on("pointerdown.zoomSlider", function (event) {
          if (!event || event.isPrimary === false || event.button !== 0) {
            return;
          }
          if (!startContinuousZoom(direction)) {
            return;
          }

          activePointerId = event.pointerId;
          if (
            activePointerId !== undefined &&
            typeof this.setPointerCapture === "function"
          ) {
            try {
              this.setPointerCapture(activePointerId);
            } catch {
              // Window-level release listeners remain as the fallback.
            }
          }
        })
        .on(
          "pointerup.zoomSlider pointercancel.zoomSlider lostpointercapture.zoomSlider",
          function (event) {
            if (activePointerId === undefined) {
              return;
            }
            if (
              event &&
              event.pointerId !== undefined &&
              event.pointerId !== activePointerId
            ) {
              return;
            }
            stopContinuousZoom();
          },
        )
        .on("click.zoomSlider", function (event) {
          // Pointer interactions are handled on pointerdown. A zero-detail click
          // is generated by keyboard, assistive technology, or script.
          if (event && event.detail > 0) {
            return;
          }
          if (activeDirection !== 0) {
            return;
          }
          applySingleZoom(direction);
        })
        .on("contextmenu.zoomSlider", function (event) {
          if (event) {
            event.preventDefault();
          }
        })
        .attr("title", title);
    }

    function stopPointerZoom(event) {
      if (activePointerId === undefined) {
        return;
      }
      if (
        event &&
        event.pointerId !== undefined &&
        event.pointerId !== activePointerId
      ) {
        return;
      }
      stopContinuousZoom();
    }

    bindZoomButton("#zoomOutButton", -1, "zoom out");
    bindZoomButton("#zoomInButton", 1, "zoom in");
    updateZoomButtonStates(graph.scaleFactor());

    d3.select(window)
      .on("pointerup.zoomSlider pointercancel.zoomSlider", stopPointerZoom)
      .on("blur.zoomSlider", stopContinuousZoom);

    d3.select(document).on("visibilitychange.zoomSlider", function () {
      if (document.hidden) {
        stopContinuousZoom();
      }
    });

    d3.select("#centerGraphButton")
      .on("click", function () {
        if (!controlsEnabled) {
          return;
        }
        graph.options().navigationMenu().hideAllMenus();
        graph.forceRelocationEvent();
      })
      .attr("title", "center graph");
  };

  zoomSlider.showSlider = function (val) {
    if (!arguments.length) {
      return showSlider;
    }
    d3.select("#zoomSlider").classed("hidden", !val);
    showSlider = val;
    if (graph.options().sidebar && graph.options().sidebar()) {
      graph.options().sidebar().updateDockedControlsPosition();
    }
  };

  zoomSlider.zooming = function () {
    if (!controlsEnabled) {
      return;
    }
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

  zoomSlider.setMenuMode = function (enabled) {
    controlsEnabled = Boolean(enabled);
    if (!controlsEnabled) {
      stopContinuousZoom();
    }
    d3.select("#centerGraphButton").property("disabled", !controlsEnabled);
    if (slider) {
      slider.property("disabled", !controlsEnabled);
    }
    updateZoomButtonStates(graph.scaleFactor());
  };

  return zoomSlider;
};
