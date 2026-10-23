import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";
import { createOntologySourceSubmission } from "../ui/ontologySourceSubmission.js";
import { createOntologyChooser } from "../ui/ontologyChooser.js";

function createOntologyMenu({
  documentObject = globalThis.document,
  locationObject = globalThis.location,
  webVowlController,
  loadOntologyFromLocation,
  loadLocalFile,
  createNewOntology,
  scrollLoadingDetails,
  hideNavigationMenus,
  windowObject = globalThis.window,
} = {}) {
  const ontologyMenu = {};
  const submitSource = createOntologySourceSubmission({
    locationObject,
    loadOntologyFromLocation,
  });
  let chooser;
  const ownedListeners = [];
  function on(target, type, listener) {
    if (!target) {
      return;
    }
    target.addEventListener(type, listener);
    ownedListeners.push(() => target.removeEventListener(type, listener));
  }

  ontologyMenu.reloadOntologySource = async function () {
    const source = webVowlController.getState().source;
    const requestSource =
      source?.kind === "ontology-document-iri"
        ? { kind: source.kind, documentIri: source.identity }
        : source?.kind === "vowl-json-url"
          ? { kind: source.kind, url: source.identity }
          : null;
    if (requestSource === null) {
      return;
    }
    return webVowlController.loadOntology({
      source: requestSource,
      reuseCachedOntology: false,
    });
  };

  ontologyMenu.renderSourceReloadControl = function (
    source,
    { hasReusedCachedVisualization = false } = {},
  ) {
    const reloadButton = documentObject.getElementById("reloadOntologySource");
    if (!reloadButton) {
      return;
    }
    const remote = ["ontology-document-iri", "vowl-json-url"].includes(
      source?.kind,
    );
    const canReloadSource = remote && hasReusedCachedVisualization;
    reloadButton.disabled = !canReloadSource;
    reloadButton.title = remote
      ? "Retrieve the original ontology again and replace its cached visualization"
      : "Select the local file again to reload its original content";
    reloadButton.classList.toggle("hidden", !canReloadSource);
  };

  ontologyMenu.setup = function () {
    setupConverterButtons();
    setupUploadButton();
    setupEmptyButton();
    on(documentObject.getElementById("reloadOntologySource"), "click", () => {
      void runVisualizationControlAction(
        () => ontologyMenu.reloadOntologySource(),
        documentObject,
      );
    });

    setupUriListener();
  };

  function setupUriListener() {
    // reload ontology when hash parameter gets changed manually
    on(windowObject, "hashchange", function (event) {
      const oldURL = event.oldURL,
        newURL = event.newURL;
      if (oldURL !== newURL) {
        // don't reload when just the hash parameter gets appended
        if (newURL === oldURL + "#") {
          return;
        }
        loadOntologyFromLocation();
      }
    });
  }

  ontologyMenu.submitOntologySource = (text) => chooser.submit(text);
  ontologyMenu.renderControllerState = (state) =>
    chooser?.renderControllerState(state);
  ontologyMenu.dispose = () => {
    chooser?.dispose();
    for (const remove of ownedListeners.splice(0)) {
      remove();
    }
  };

  ontologyMenu.clearDetailInformation = function () {
    const bpContainer = documentObject.getElementById("bulletPoint_container");
    const htmlCollection = bpContainer.children;
    const numEntries = htmlCollection.length;

    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
    }
  };
  ontologyMenu.append_message = function (msg, options) {
    // forward call
    append_message(msg, options);
  };
  function appendStructuredMessage(container, msg, options) {
    const messageOptions = options || {};
    if (messageOptions.breakBefore) {
      container.appendChild(documentObject.createElement("br"));
    }
    const messageElement = documentObject.createElement(
      messageOptions.block ? "p" : "span",
    );
    messageElement.classList.add("loading-message");
    if (messageOptions.tone === "error") {
      messageElement.classList.add("loading-message--error");
    }
    messageElement.textContent = String(msg);
    container.appendChild(messageElement);
    if (messageOptions.breakAfter) {
      container.appendChild(documentObject.createElement("br"));
    }
    return messageElement;
  }

  function append_message(msg, options) {
    const bpContainer = documentObject.getElementById("bulletPoint_container");
    const div = documentObject.createElement("div");
    bpContainer.appendChild(div);
    appendStructuredMessage(div, msg, options);
    scrollLoadingDetails?.();
  }

  ontologyMenu.append_message_toLastBulletPoint = function (msg, options) {
    // forward call
    append_message_toLastBulletPoint(msg, options);
  };

  ontologyMenu.append_bulletPoint = function (msg) {
    // forward call
    append_bulletPoint(msg);
  };
  function append_message_toLastBulletPoint(msg, options) {
    const bpContainer = documentObject.getElementById("bulletPoint_container");
    const htmlCollection = bpContainer.getElementsByTagName("LI");
    const lastItem = htmlCollection.length - 1;
    if (lastItem >= 0) {
      appendStructuredMessage(htmlCollection[lastItem], msg, options);
    }
    scrollLoadingDetails?.();
  }

  function append_bulletPoint(msg) {
    const bp_container = documentObject.getElementById("bulletPoint_container");
    const bp = documentObject.createElement("li");
    bp.textContent = msg;
    bp_container.appendChild(bp);
    documentObject.getElementById("currentLoadingStep").textContent = msg;
    scrollLoadingDetails?.();
  }

  function setupConverterButtons() {
    chooser = createOntologyChooser({
      documentObject,
      windowObject,
      submitSource(value) {
        const result = submitSource(value);
        if (result.completion) {
          void runVisualizationControlAction(
            () => result.completion,
            documentObject,
          );
        }
        return result;
      },
    });
  }

  function setupUploadButton() {
    const input = documentObject.getElementById("file-converter-input"),
      inputLabel = documentObject.getElementById("file-converter-label"),
      uploadButton = documentObject.getElementById("file-converter-button");

    on(input, "change", function () {
      const selectedFiles = input.files;
      if (selectedFiles.length <= 0) {
        inputLabel.textContent = "Select ontology file";
        uploadButton.disabled = true;
      } else {
        inputLabel.textContent = selectedFiles[0].name;
        uploadButton.disabled = false;
        uploadButton.click();
        // close menu;
        hideNavigationMenus?.();
      }
    });

    on(uploadButton, "click", function () {
      const selectedFile = input.files[0];
      if (!selectedFile) {
        return false;
      }
      loadLocalFile(selectedFile);
    });
  }

  function updateEditorModeDependentControls(editMode) {
    const create_entry = documentObject.getElementById("empty");
    const create_container = documentObject.getElementById("emptyContainer");
    const emptyHint = documentObject.getElementById("empty-disabled-hint");
    const createMessage = editMode
      ? "Creates a new empty ontology"
      : "Enable editing in Modes menu to be able to create a new ontology";

    if (create_entry) {
      create_entry.disabled = !editMode;
      create_entry.title = createMessage;
    }
    if (create_container) {
      create_container.title = createMessage;
    }

    const useAccuracyHelper =
      documentObject.getElementById("useAccuracyHelper");
    if (useAccuracyHelper) {
      useAccuracyHelper.classList.toggle("disabled", !editMode);
      if (editMode) {
        useAccuracyHelper.removeAttribute("aria-disabled");
      } else {
        useAccuracyHelper.setAttribute("aria-disabled", "true");
      }
    }

    const accuracyCheckbox = documentObject.getElementById(
      "useAccuracyHelperConfigCheckbox",
    );
    if (accuracyCheckbox) {
      accuracyCheckbox.disabled = !editMode;
    }

    if (emptyHint) {
      emptyHint.textContent = createMessage;
      emptyHint.classList.toggle("hidden", editMode);
    }
  }

  ontologyMenu.renderEditorMode = updateEditorModeDependentControls;

  function setupEmptyButton() {
    const emptyButton = documentObject.getElementById("empty");
    if (emptyButton) {
      on(emptyButton, "click", function () {
        if (emptyButton.disabled) {
          return false;
        }
        createNewOntology();
        hideNavigationMenus?.();
      });
    }
    updateEditorModeDependentControls(
      webVowlController.getState().editorMode?.isEditorMode === true,
    );
  }

  return ontologyMenu;
}

export { createOntologyMenu };
