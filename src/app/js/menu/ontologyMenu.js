import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";
const ONTOLOGY_URL_HINT = "Enter an ontology URL";
const ONTOLOGY_URL_ERROR = "Enter a valid HTTP or HTTPS URL";

function normalizeOntologyUrl(value) {
  const enteredValue = typeof value === "string" ? value.trim() : "";
  if (!enteredValue) {
    return { valid: false, empty: true, message: ONTOLOGY_URL_HINT };
  }
  for (let index = 0; index < enteredValue.length; index++) {
    const characterCode = enteredValue.charCodeAt(index);
    if (characterCode <= 32 || characterCode === 127) {
      return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
    }
  }

  let candidate = enteredValue;
  const explicitScheme = candidate.match(/^([a-z][a-z\d+.-]*):/i);
  const hostWithPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(candidate);
  if (!explicitScheme || hostWithPort) {
    candidate = "https://" + candidate;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
  }

  if (parsedUrl.protocol === "http:") {
    parsedUrl.protocol = "https:";
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.hostname.includes("%") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
  }

  return {
    valid: true,
    empty: false,
    normalizedUrl: parsedUrl.href,
    isJson: parsedUrl.pathname.toLowerCase().endsWith(".json"),
    wasNormalized: parsedUrl.href !== enteredValue,
  };
}

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
    documentObject
      .getElementById("reloadOntologySource")
      ?.addEventListener("click", () => {
        void runVisualizationControlAction(
          () => ontologyMenu.reloadOntologySource(),
          documentObject,
        );
      });

    setupUriListener();
  };

  function setupUriListener() {
    // reload ontology when hash parameter gets changed manually
    windowObject.addEventListener("hashchange", function (event) {
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

  ontologyMenu.setIriText = function (text) {
    const iriInput = documentObject.getElementById("iri-converter-input");
    const iriForm = documentObject.getElementById("iri-converter-form");
    iriInput.value = text;
    iriInput.dispatchEvent(new Event("input"));
    iriForm.dispatchEvent(new Event("submit"));
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
    const iriConverterButton = documentObject.getElementById(
      "iri-converter-button",
    );
    const iriConverterInput = documentObject.getElementById(
      "iri-converter-input",
    );
    const iriConverterHint =
      documentObject.getElementById("iri-converter-hint");
    let validationWasShown = false;

    function updateConverterState(options) {
      const stateOptions = options || {};
      const result = normalizeOntologyUrl(iriConverterInput.value);

      if (stateOptions.normalize && result.valid) {
        iriConverterInput.value = result.normalizedUrl;
      }

      const showError =
        stateOptions.showError && !result.empty && !result.valid;
      iriConverterButton.disabled = !result.valid;
      if (showError) {
        iriConverterInput.setAttribute("aria-invalid", "true");
      } else {
        iriConverterInput.removeAttribute("aria-invalid");
      }
      iriConverterHint.textContent = showError
        ? result.message
        : ONTOLOGY_URL_HINT;
      if (showError) {
        iriConverterHint.classList.add("converter-input-hint--error");
      } else {
        iriConverterHint.classList.remove("converter-input-hint--error");
      }

      return result;
    }

    iriConverterInput.addEventListener("input", function () {
      const result = updateConverterState({ showError: validationWasShown });
      if (result.valid || result.empty) {
        validationWasShown = false;
      }
    });

    iriConverterInput.addEventListener("change", function () {
      validationWasShown = true;
      updateConverterState({ normalize: true, showError: true });
    });

    iriConverterInput.addEventListener("keydown", function (event) {
      if (event && event.key === "Enter") {
        validationWasShown = true;
        const result = updateConverterState({
          normalize: true,
          showError: true,
        });
        if (!result.valid) {
          event.preventDefault();
        }
      }
    });

    iriConverterButton.addEventListener("click", function (event) {
      validationWasShown = true;
      const result = updateConverterState({ normalize: true, showError: true });
      if (
        !result.valid &&
        event &&
        typeof event.preventDefault === "function"
      ) {
        event.preventDefault();
      }
    });

    documentObject
      .getElementById("iri-converter-form")
      .addEventListener("submit", function (event) {
        if (event && typeof event.preventDefault === "function") {
          event.preventDefault();
        }

        validationWasShown = true;
        const result = updateConverterState({
          normalize: true,
          showError: true,
        });
        if (!result.valid) {
          if (
            iriConverterInput &&
            typeof iriConverterInput.focus === "function"
          ) {
            iriConverterInput.focus();
          }
          return false;
        }

        const routeKey = result.isJson ? "url=" : "iri=";
        locationObject.hash =
          routeKey + encodeURIComponent(result.normalizedUrl);
        iriConverterInput.value = "";
        validationWasShown = false;
        updateConverterState();
        return false;
      });

    updateConverterState();
  }

  function setupUploadButton() {
    const input = documentObject.getElementById("file-converter-input"),
      inputLabel = documentObject.getElementById("file-converter-label"),
      uploadButton = documentObject.getElementById("file-converter-button");

    input.addEventListener("change", function () {
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

    uploadButton.addEventListener("click", function () {
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
      emptyButton.addEventListener("click", function () {
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

export { createOntologyMenu, normalizeOntologyUrl };
