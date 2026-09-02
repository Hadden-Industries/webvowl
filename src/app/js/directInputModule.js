const DIRECT_INPUT_DISPLAY_NAME = "Direct input";

export function createDirectInputModule(graph, { webVowlController } = {}) {
  /** variable defs **/
  const directInputModule = {};
  const inputContainer = document.querySelector("#DirectInputContent");
  const textArea = document.querySelector("#directInputTextArea");
  const lifecycleAbortController = new AbortController();
  let isInputContainerVisible = false;

  // A VOWL model the reader already pasted needs no conversion; every other
  // text goes to the controller's source loader as ontology text.
  function directInputSource(suppliedText) {
    try {
      const parsedVowlModel = JSON.parse(suppliedText);
      if (
        parsedVowlModel !== null &&
        typeof parsedVowlModel === "object" &&
        !Array.isArray(parsedVowlModel)
      ) {
        return {
          kind: "vowl-model",
          model: parsedVowlModel,
          displayName: DIRECT_INPUT_DISPLAY_NAME,
        };
      }
    } catch {
      // Ontology documents are not VOWL JSON; the controller converts them.
    }
    return {
      kind: "ontology-text",
      text: suppliedText,
      displayName: DIRECT_INPUT_DISPLAY_NAME,
    };
  }

  function reportDirectInputFailure(failureMessage) {
    const errorOnLoadElement = document.querySelector("#Error_onLoad");
    errorOnLoadElement.classList.remove("hidden");
    errorOnLoadElement.textContent =
      "Failed to convert the input! " + failureMessage;
    graph.handleOnLoadingError();
  }

  // connect upload and close button;
  directInputModule.handleDirectUpload = async function () {
    try {
      await webVowlController.loadOntology({
        source: directInputSource(textArea.value),
      });
      directInputModule.setDirectInputMode(false);
    } catch (loadError) {
      console.warn("Error " + loadError);
      reportDirectInputFailure(loadError?.message ?? String(loadError));
    }
  };

  directInputModule.handleCloseButton = function () {
    directInputModule.setDirectInputMode(false);
  };

  directInputModule.updateLayout = function () {};

  directInputModule.setDirectInputMode = function (shouldShowInputContainer) {
    if (shouldShowInputContainer === undefined) {
      isInputContainerVisible = !isInputContainerVisible;
    } else {
      isInputContainerVisible = shouldShowInputContainer;
    }
    // update visibility;
    directInputModule.updateLayout();
    document.querySelector("#Error_onLoad").classList.add("hidden");
    inputContainer.classList.toggle("hidden", !isInputContainerVisible);
  };

  directInputModule.dispose = function () {
    lifecycleAbortController.abort();
  };

  document
    .querySelector("#directUploadBtn")
    .addEventListener("click", directInputModule.handleDirectUpload, {
      signal: lifecycleAbortController.signal,
    });
  document
    .querySelector("#close_directUploadBtn")
    .addEventListener("click", directInputModule.handleCloseButton, {
      signal: lifecycleAbortController.signal,
    });

  return directInputModule;
}
