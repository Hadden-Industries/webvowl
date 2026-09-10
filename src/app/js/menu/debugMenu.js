import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";

// Hidden diagnostic presentation stays in the UI; rendering and native editing
// helpers receive their own plain controller requests.
export function createDebugMenu({
  webVowlController,
  documentObject = globalThis.document,
}) {
  const lifecycle = new AbortController();
  let visible = false;
  let showStatistics = true;
  let showInputModality = false;
  let isSetup = false;
  let unsubscribe;
  const control = (id) => documentObject.querySelector(`#${id}ConfigCheckbox`);

  function renderAvailability() {
    const options = webVowlController.getOntologyEditorOptions();
    documentObject.querySelectorAll(".debugOption").forEach((element) => {
      element.classList.toggle("hidden", !visible);
    });
    for (const id of ["useAccuracyHelper", "showDraggerObject"]) {
      const enabled =
        options.isEditorMode &&
        (id !== "showDraggerObject" || options.useAccuracyHelper);
      control(id).disabled = !enabled;
      control(id).checked = options[id];
      documentObject
        .querySelector(`#${id}`)
        .classList.toggle("disabled", !enabled);
    }
    documentObject
      .querySelector("#FPS_Statistics")
      .classList.toggle("hidden", !visible || !showStatistics);
    documentObject
      .querySelector("#modeOfOperationString")
      .classList.toggle("hidden", !visible || !showInputModality);
  }

  function reportStatisticsChoice() {
    webVowlController.setRenderingDiagnosticsEnabled(visible && showStatistics);
    renderAvailability();
  }

  return Object.freeze({
    setup() {
      if (isSetup || lifecycle.signal.aborted) {
        return;
      }
      isSetup = true;
      for (const id of ["useAccuracyHelper", "showDraggerObject"]) {
        control(id).addEventListener(
          "click",
          () => {
            const enabled = control(id).checked;
            void runVisualizationControlAction(
              () =>
                webVowlController.setOntologyEditorOptions({
                  [id]: enabled,
                  ...(id === "useAccuracyHelper" && !enabled
                    ? { showDraggerObject: false }
                    : {}),
                }),
              documentObject,
            ).then(renderAvailability);
          },
          { signal: lifecycle.signal },
        );
      }
      control("showFPS_Statistics").checked = showStatistics;
      control("showFPS_Statistics").addEventListener(
        "click",
        () => {
          showStatistics = control("showFPS_Statistics").checked;
          reportStatisticsChoice();
        },
        { signal: lifecycle.signal },
      );
      control("showModeOfOperation").checked = showInputModality;
      control("showModeOfOperation").addEventListener(
        "click",
        () => {
          showInputModality = control("showModeOfOperation").checked;
          renderAvailability();
        },
        { signal: lifecycle.signal },
      );
      unsubscribe = webVowlController.subscribeToState((state, fields) => {
        if (fields.includes("editorMode")) {
          renderAvailability();
        }
        if (
          fields.includes("renderingStatistics") &&
          state.renderingStatistics !== null
        ) {
          const statistics = state.renderingStatistics;
          documentObject
            .querySelector("#FPS_Statistics")
            .replaceChildren(
              `FPS: ${statistics.framesPerSecond}`,
              documentObject.createElement("br"),
              `Nodes: ${statistics.nodeCount}`,
              documentObject.createElement("br"),
              `Links: ${statistics.linkCount}`,
            );
        }
      });
      reportStatisticsChoice();
    },
    isVisible: () => visible,
    setVisible(value) {
      visible = Boolean(value);
      if (isSetup) {
        reportStatisticsChoice();
      }
    },
    renderInputModality(isTouchDevice) {
      documentObject.querySelector("#modeOfOperationString").textContent =
        isTouchDevice
          ? "touch able device detected"
          : "point & click device detected";
    },
    dispose() {
      lifecycle.abort();
      unsubscribe?.();
    },
  });
}
