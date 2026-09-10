const DIRECT_INPUT_DISPLAY_NAME = "Direct input";

export function createDirectInputModule({ webVowlController } = {}) {
  /** variable defs **/
  const directInputModule = {};
  const inputContainer = document.querySelector("#DirectInputContent");
  const textArea = document.querySelector("#directInputTextArea");
  const lifecycleAbortController = new AbortController();
  let isInputContainerVisible = false;

  // Identify the input syntax; the shared source loader validates the text.
  function directInputSource(suppliedText) {
    try {
      const parsedJsonValue = JSON.parse(suppliedText);
      if (
        parsedJsonValue !== null &&
        typeof parsedJsonValue === "object" &&
        !Array.isArray(parsedJsonValue) &&
        (Object.hasOwn(parsedJsonValue, "header") ||
          Array.isArray(parsedJsonValue.class) ||
          Array.isArray(parsedJsonValue.property)) &&
        !["@context", "@graph", "@id", "@type"].some((key) =>
          Object.hasOwn(parsedJsonValue, key),
        )
      ) {
        return {
          kind: "vowl-json-text",
          text: suppliedText,
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
      "The input could not be loaded. " + failureMessage;
  }

  // connect upload and close button;
  directInputModule.loadPastedDocument = async function () {
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
    .querySelector("#loadDirectInputButton")
    .addEventListener("click", directInputModule.loadPastedDocument, {
      signal: lifecycleAbortController.signal,
    });
  document
    .querySelector("#closeDirectInputButton")
    .addEventListener("click", directInputModule.handleCloseButton, {
      signal: lifecycleAbortController.signal,
    });

  return directInputModule;
}
