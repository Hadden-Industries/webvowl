// Native controls can issue another choice while a transition is still running.
// The controller remains responsible for the action; this module owns its UI
// feedback and consumes expected cancellation of the previous choice.
export async function runVisualizationControlAction(action, documentObject) {
  const status = documentObject.getElementById("visualizationActionStatus");
  if (status) {
    status.hidden = true;
  }
  try {
    await action();
  } catch (error) {
    if (error?.name === "AbortError" || error?.code === "LOAD_ABORTED") {
      return;
    }
    if (status) {
      status.textContent =
        "The visualization could not be updated. Please try again.";
      status.hidden = false;
    }
  }
}
