/** The zoom Slider **/
export function createZoomSlider({
  webVowlController,
  hideNavigationMenus = () => {},
  onControlsVisibilityChanged,
  minimumMagnification,
  maximumMagnification,
  graphWidthPx,
  graphHeightPx,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
} = {}) {
  const zoomSlider = {};
  const minMag = minimumMagnification;
  const maxMag = maximumMagnification;
  let activeDirection = 0;
  let activePointerId;
  // The magnification the controller last published. The renderer owns the
  // live value; this is the control's view of it.
  let zoomValue = Math.min(graphWidthPx, graphHeightPx) / 1000;
  let showSlider = true;
  let controlsEnabled = true;
  let slider;

  function requestMagnification(nextZoomValue) {
    webVowlController?.setVisualizationView({ zoomScale: nextZoomValue });
  }

  function stopContinuousZoom() {
    if (activeDirection !== 0) {
      webVowlController?.setContinuousZoom({ zoomDirection: "none" });
    }
    activeDirection = 0;
    activePointerId = undefined;
  }

  function zoomAvailable(direction, value) {
    const numericValue = Number(value);
    return direction > 0 ? numericValue < maxMag : numericValue > minMag;
  }

  function updateZoomButtonStates(value) {
    const zoomInDisabled = !controlsEnabled || !zoomAvailable(1, value);
    const zoomOutDisabled = !controlsEnabled || !zoomAvailable(-1, value);
    documentObject.getElementById("zoomInButton").disabled = zoomInDisabled;
    documentObject.getElementById("zoomOutButton").disabled = zoomOutDisabled;
  }

  // The renderer runs the ramp because the viewport is renderer-owned; the
  // control reports that the gesture started and, later, that it ended.
  function startContinuousZoom(direction) {
    if (!controlsEnabled || activeDirection !== 0) {
      return false;
    }
    if (!zoomAvailable(direction, zoomValue)) {
      return false;
    }
    hideNavigationMenus();
    activeDirection = direction;
    webVowlController?.setContinuousZoom({
      zoomDirection: direction > 0 ? "in" : "out",
    });
    return true;
  }

  // Keyboard activation is a discrete step rather than a held gesture.
  function applySingleZoom(direction) {
    if (!controlsEnabled || !zoomAvailable(direction, zoomValue)) {
      return;
    }
    hideNavigationMenus();
    const singleStepFactor = direction > 0 ? 1.2 : 1 / 1.2;
    requestMagnification(
      Math.min(maxMag, Math.max(minMag, zoomValue * singleStepFactor)),
    );
  }

  function zoomPercentage(value) {
    return Math.round(Number(value) * 100) + "%";
  }

  zoomSlider.setup = function () {
    slider = documentObject.getElementById("zoomSliderElement");
    slider.min = minMag;
    slider.max = maxMag;
    // Native range inputs round values to their step grid. The renderer can
    // report any magnification after a gesture or saved-view load.
    slider.step = "any";
    slider.value = zoomValue;
    slider.setAttribute("aria-valuetext", zoomPercentage(zoomValue));
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
      const container = documentObject.getElementById("zoomSliderParagraph");
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

    const sliderParagraph = documentObject.getElementById(
      "zoomSliderParagraph",
    );
    sliderParagraph.addEventListener("touchstart", handleContainerTouch);
    sliderParagraph.addEventListener("touchmove", handleContainerTouch);

    function bindZoomButton(selector, direction, title) {
      const el = documentObject.querySelector(selector);
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
    updateZoomButtonStates(zoomValue);

    windowObject.addEventListener("pointerup", stopPointerZoom);
    windowObject.addEventListener("pointercancel", stopPointerZoom);
    windowObject.addEventListener("blur", stopContinuousZoom);

    documentObject.addEventListener("visibilitychange", function () {
      if (documentObject.hidden) {
        stopContinuousZoom();
      }
    });

    const centerGraphButton =
      documentObject.getElementById("centerGraphButton");
    // Fitting the viewport reaches the controller through the view-controls
    // adapter; this only closes the menus that would cover the result.
    centerGraphButton.addEventListener("click", function () {
      if (!controlsEnabled) {
        return;
      }
      hideNavigationMenus();
    });
    centerGraphButton.setAttribute("title", "Zoom and center graph");
  };

  zoomSlider.showSlider = function (val) {
    if (!arguments.length) {
      return showSlider;
    }
    const sliderContainer = documentObject.getElementById("zoomSlider");
    if (val) {
      sliderContainer.classList.remove("hidden");
    } else {
      sliderContainer.classList.add("hidden");
    }
    showSlider = val;
    onControlsVisibilityChanged?.();
  };

  zoomSlider.zooming = function () {
    if (!controlsEnabled) {
      return;
    }
    hideNavigationMenus();
    const requestedZoom = Number(slider.value);
    slider.setAttribute("value", requestedZoom);
    slider.setAttribute("aria-valuetext", zoomPercentage(requestedZoom));
    updateZoomButtonStates(requestedZoom);
    requestMagnification(requestedZoom);
  };

  // Presentation only: the magnification the controller published, however it
  // was reached - a slider drag, a held button, or a wheel gesture the reader
  // made on the visualization itself.
  zoomSlider.renderViewport = function (zoomScale) {
    if (!Number.isFinite(zoomScale)) {
      return;
    }
    zoomValue = zoomScale;
    if (slider) {
      slider.setAttribute("value", zoomScale);
      slider.value = zoomScale;
      slider.setAttribute("aria-valuetext", zoomPercentage(zoomScale));
    }
    updateZoomButtonStates(zoomScale);
  };

  zoomSlider.setMenuMode = function (enabled) {
    controlsEnabled = Boolean(enabled);
    if (!controlsEnabled) {
      stopContinuousZoom();
    }
    documentObject.getElementById("centerGraphButton").disabled =
      !controlsEnabled;
    if (slider) {
      slider.disabled = !controlsEnabled;
    }
    updateZoomButtonStates(zoomValue);
  };

  return zoomSlider;
}
