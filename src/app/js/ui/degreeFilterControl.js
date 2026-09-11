// The renderer publishes the degree range. This control presents that range and
// reports human changes on the same input observed by the view-controls adapter.
export function createDegreeFilterControl({
  documentObject = globalThis.document,
} = {}) {
  const lifecycle = new AbortController();
  let isSetup = false;
  let degreeSlider;
  let valueLabel;
  let menuButton;
  let degreeContainer;
  let highlightTimer;
  let lastMinimumDegree;

  function showDegreeHighlight(enabled) {
    menuButton?.classList.toggle("highlighted", enabled);
    degreeContainer?.classList.toggle("highlighted", enabled);
    documentObject
      .querySelector("#degree-of-collapsing-hint")
      ?.classList.toggle("hidden", !enabled);
    if (!menuButton) {
      return;
    }
    clearTimeout(highlightTimer);
    if (menuButton.classList.contains("buttonPulse") && enabled) {
      menuButton.classList.remove("buttonPulse");
      highlightTimer = setTimeout(() => {
        menuButton.classList.add("buttonPulse");
      }, 100);
    } else {
      menuButton.classList.toggle("buttonPulse", enabled);
      menuButton.classList.toggle("filterMenuButtonHighlight", enabled);
    }
  }

  function presentSliderValue() {
    if (valueLabel) {
      valueLabel.textContent = degreeSlider.value;
    }
    if (Number(degreeSlider.value) === 0) {
      showDegreeHighlight(false);
    }
  }

  function handleWheel(event) {
    event.preventDefault();
    if (event.deltaY === 0) {
      return;
    }
    const oldValue = Number(degreeSlider.value);
    const nextValue = Math.min(
      Number(degreeSlider.max),
      Math.max(
        Number(degreeSlider.min),
        oldValue + (event.deltaY < 0 ? 1 : -1),
      ),
    );
    if (oldValue === nextValue) {
      return;
    }
    degreeSlider.value = String(nextValue);
    degreeSlider.dispatchEvent(new Event("input", { bubbles: true }));
    degreeSlider.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return Object.freeze({
    setup() {
      if (isSetup || lifecycle.signal.aborted) {
        return;
      }
      isSetup = true;
      degreeSlider = documentObject.querySelector("#nodeDegreeDistanceSlider");
      valueLabel = documentObject.querySelector("#nodeDegreeSliderValue");
      menuButton = documentObject.querySelector("#c_filter button");
      degreeContainer = documentObject.querySelector(
        "#nodeDegreeFilteringOption",
      );
      degreeSlider?.addEventListener("input", presentSliderValue, {
        signal: lifecycle.signal,
      });
      degreeSlider?.addEventListener("wheel", handleWheel, {
        signal: lifecycle.signal,
        passive: false,
      });
      menuButton?.addEventListener(
        "animationend",
        () => {
          menuButton.classList.remove("buttonPulse");
          menuButton.classList.add("filterMenuButtonHighlight");
        },
        { signal: lifecycle.signal },
      );
    },
    renderDegreeFilterRange(range, minimumDegree) {
      if (!range || !degreeSlider || lifecycle.signal.aborted) {
        return;
      }
      degreeSlider.max = String(range.maximumDegree);
      degreeSlider.value = String(minimumDegree);
      presentSliderValue();
      if (minimumDegree !== lastMinimumDegree) {
        showDegreeHighlight(minimumDegree > 0);
        lastMinimumDegree = minimumDegree;
      }
    },
    dispose() {
      lifecycle.abort();
      clearTimeout(highlightTimer);
    },
  });
}
