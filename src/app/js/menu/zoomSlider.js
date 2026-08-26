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
    document.getElementById("zoomInButton").disabled = zoomInDisabled;
    document.getElementById("zoomOutButton").disabled = zoomOutDisabled;
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
    slider = document.getElementById("zoomSliderElement");
    slider.value = defZoom;
    slider.min = minMag;
    slider.max = maxMag;
    slider.step = (maxMag - minMag) / 40;
    slider.setAttribute("aria-valuetext", zoomPercentage(defZoom));
    slider.disabled = !controlsEnabled;
    slider.addEventListener("input", function () {
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
      const container = document.getElementById("zoomSliderParagraph");
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const touchY = touch.clientY;
      let fraction = (rect.bottom - touchY) / rect.height;
      fraction = Math.max(0, Math.min(1, fraction));
      const newZoom = minMag + fraction * (maxMag - minMag);
      slider.value = newZoom;
      zoomSlider.zooming();
      if (event.cancelable) {
        event.preventDefault();
      }
    }

    const sliderParagraph = document.getElementById("zoomSliderParagraph");
    sliderParagraph.addEventListener("touchstart", handleContainerTouch);
    sliderParagraph.addEventListener("touchmove", handleContainerTouch);

    function bindZoomButton(selector, direction, title) {
      const el = document.querySelector(selector);
      if (!el) {
        return;
      }
      el.addEventListener("pointerdown", function (event) {
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
      });
      function handleUp(event) {
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
      el.addEventListener("pointerup", handleUp);
      el.addEventListener("pointercancel", handleUp);
      el.addEventListener("lostpointercapture", handleUp);
      el.addEventListener("click", function (event) {
        // Pointer interactions are handled on pointerdown. A zero-detail click
        // is generated by keyboard, assistive technology, or script.
        if (event && event.detail > 0) {
          return;
        }
        if (activeDirection !== 0) {
          return;
        }
        applySingleZoom(direction);
      });
      el.addEventListener("contextmenu", function (event) {
        if (event) {
          event.preventDefault();
        }
      });
      el.setAttribute("title", title);
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

    window.addEventListener("pointerup", stopPointerZoom);
    window.addEventListener("pointercancel", stopPointerZoom);
    window.addEventListener("blur", stopContinuousZoom);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopContinuousZoom();
      }
    });

    const centerGraphButton = document.getElementById("centerGraphButton");
    centerGraphButton.addEventListener("click", function () {
      if (!controlsEnabled) {
        return;
      }
      graph.options().navigationMenu().hideAllMenus();
      graph.forceRelocationEvent();
    });
    centerGraphButton.setAttribute("title", "center graph");
  };

  zoomSlider.showSlider = function (val) {
    if (!arguments.length) {
      return showSlider;
    }
    const sliderContainer = document.getElementById("zoomSlider");
    if (val) {
      sliderContainer.classList.remove("hidden");
    } else {
      sliderContainer.classList.add("hidden");
    }
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
    const zoomValue = slider.value;
    slider.setAttribute("value", zoomValue);
    slider.setAttribute("aria-valuetext", zoomPercentage(zoomValue));
    updateZoomButtonStates(zoomValue);
    graph.setSliderZoom(zoomValue);
  };

  zoomSlider.updateZoomSliderValue = function (val) {
    if (slider) {
      slider.setAttribute("value", val);
      slider.value = val;
      slider.setAttribute("aria-valuetext", zoomPercentage(val));
      updateZoomButtonStates(val);
    }
  };

  zoomSlider.setMenuMode = function (enabled) {
    controlsEnabled = Boolean(enabled);
    if (!controlsEnabled) {
      stopContinuousZoom();
    }
    document.getElementById("centerGraphButton").disabled = !controlsEnabled;
    if (slider) {
      slider.disabled = !controlsEnabled;
    }
    updateZoomButtonStates(graph.scaleFactor());
  };

  return zoomSlider;
};
