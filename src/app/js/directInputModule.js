import { loadWithImports } from "../../owl2vowl/js/index.js";

export function createDirectInputModule(
  graph,
  { convertOntologyTextToVowlModelWithImports = loadWithImports } = {},
) {
  /** variable defs **/
  const directInputModule = {};
  const inputContainer = document.querySelector("#DirectInputContent");
  const textArea = document.querySelector("#directInputTextArea");
  const lifecycleAbortController = new AbortController();
  let isInputContainerVisible = false;

  // connect upload and close button;
  directInputModule.handleDirectUpload = function () {
    const text = textArea.value;
    const loadingModule = graph.options().loadingModule();
    loadingModule.initializeLoader();
    let parsedVowlModel;
    try {
      parsedVowlModel = JSON.parse(text);
      loadingModule.directInput(text);
      // close if successful
      if (
        Array.isArray(parsedVowlModel.class) &&
        parsedVowlModel.class.length > 0
      ) {
        directInputModule.setDirectInputMode(false);
      }
    } catch (_e) {
      try {
        convertOntologyTextToVowlModelWithImports(text)
          .then(function (vowlJson) {
            loadingModule.directInput(JSON.stringify(vowlJson));
            directInputModule.setDirectInputMode(false);
          })
          .catch(function (error2) {
            console.warn("Error " + error2);
            const errorOnLoadElement = document.querySelector("#Error_onLoad");
            errorOnLoadElement.classList.remove("hidden");
            errorOnLoadElement.textContent =
              "Failed to convert the input! " + error2.message;
            graph.handleOnLoadingError();
          });
      } catch (error2) {
        console.warn("Error " + error2);
        const errorOnLoadElement = document.querySelector("#Error_onLoad");
        errorOnLoadElement.classList.remove("hidden");
        errorOnLoadElement.textContent =
          "Failed to convert the input! " + error2.message;
        graph.handleOnLoadingError();
      }
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
