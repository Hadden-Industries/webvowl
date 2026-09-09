import { applicationUiModule } from "../ui/applicationUiRegistry.js";
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

function createOntologyMenu(
  graph,
  {
    documentObject = globalThis.document,
    locationObject = globalThis.location,
    webVowlController,
    windowObject = globalThis.window,
  } = {},
) {
  const ontologyMenu = {};
  const loadingInfo = documentObject.getElementById("loading-info");
  const loadingProgress = documentObject.getElementById("loading-progress");

  let stopTimer = false;
  const loadingError = false;
  let loadingStatusTimer;
  let conversion_sessionId;
  const cachedConversions = {};
  let loadingModule;
  let currentLoadedOntologyName = "";

  ontologyMenu.clearCachedVersion = function () {
    if (cachedConversions[currentLoadedOntologyName]) {
      cachedConversions[currentLoadedOntologyName] = undefined;
    }
  };

  ontologyMenu.reloadCachedOntology = function () {
    ontologyMenu.clearCachedVersion();
    loadingModule.loadRemoteSource({
      source: loadingModule.ontologySourceFromLocation(),
      shouldCache: false,
    });
  };

  ontologyMenu.cachedOntology = function (ontoName) {
    currentLoadedOntologyName = ontoName;
    if (cachedConversions[ontoName]) {
      const locStr = String(locationObject.hash);
      const reloadBtn = documentObject.getElementById("reloadCachedOntology");
      if (reloadBtn) {
        reloadBtn.disabled = false;
      }
      if (typeof graph.showReloadButtonAfterLayoutOptimization === "function") {
        graph.showReloadButtonAfterLayoutOptimization(true);
      }
      if (locStr.indexOf("#file") > -1) {
        if (reloadBtn) {
          reloadBtn.disabled = true;
          reloadBtn.title =
            "reloading original version not possible, please reload the file";
        }
      } else {
        if (reloadBtn) {
          reloadBtn.title =
            "generate new visualization and overwrite cached ontology";
        }
      }
    } else {
      if (typeof graph.showReloadButtonAfterLayoutOptimization === "function") {
        graph.showReloadButtonAfterLayoutOptimization(false);
      }
    }
    return cachedConversions[ontoName];
  };
  ontologyMenu.setCachedOntology = function (ontoName, ontoContent) {
    cachedConversions[ontoName] = ontoContent;
    currentLoadedOntologyName = ontoName;
  };

  ontologyMenu.getErrorStatus = function () {
    return loadingError;
  };

  ontologyMenu.setup = function () {
    loadingModule = applicationUiModule("loadingModule");

    setupConverterButtons();
    setupUploadButton();
    setupEmptyButton();

    setupUriListener();
    loadingModule.setOntologyMenu(ontologyMenu);
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
        loadingModule.loadRemoteSource({
          source: loadingModule.ontologySourceFromLocation(),
        });
      }
    });
  }

  ontologyMenu.stopLoadingTimer = function () {
    stopTimer = true;
    clearTimeout(loadingStatusTimer);
  };

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
    loadingModule.scrollDownDetails();
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
    loadingModule.scrollDownDetails();
  }

  function append_bulletPoint(msg) {
    const bp_container = documentObject.getElementById("bulletPoint_container");
    const bp = documentObject.createElement("li");
    bp.textContent = msg;
    bp_container.appendChild(bp);
    documentObject.getElementById("currentLoadingStep").textContent = msg;
    loadingModule.scrollDownDetails();
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
        graph.options().navigationMenu().hideAllMenus();
      }
    });

    uploadButton.addEventListener("click", function () {
      const selectedFile = input.files[0];
      if (!selectedFile) {
        return false;
      }
      // The selected file itself is the source; the route only records it.
      locationObject.hash = "file=" + selectedFile.name;
      loadingModule.loadDroppedFile(selectedFile);
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

  function setupEmptyButton() {
    const emptyButton = documentObject.getElementById("empty");
    if (emptyButton) {
      emptyButton.addEventListener("click", function () {
        if (emptyButton.disabled) {
          return false;
        }
        loadingModule.createNewOntology();
        graph.options().navigationMenu().hideAllMenus();
      });
    }
    updateEditorModeDependentControls(graph.editorMode());
    graph.addEventListener("editorchange", function (event) {
      updateEditorModeDependentControls(event.detail.value);
    });
  }

  function appendLoadingStatusText(container, message) {
    const validatorUrl = "http://visualdataweb.de/validator/";
    const parts = String(message).split(validatorUrl);
    parts.forEach(function (part, index) {
      const span = documentObject.createElement("span");
      span.textContent = part;
      container.appendChild(span);
      if (index < parts.length - 1) {
        const a = documentObject.createElement("a");
        a.setAttribute("href", validatorUrl);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        a.textContent = "OWL Validator";
        container.appendChild(a);
      }
    });
  }

  function setLoadingStatusInfo(message, errorMessage) {
    // check if there is a owl2vowl li item;
    let o2vConverterContainer = documentObject.getElementById(
      "o2vConverterContainer",
    );
    if (!o2vConverterContainer) {
      const bp_container = documentObject.getElementById(
        "bulletPoint_container",
      );
      const div = documentObject.createElement("div");
      bp_container.appendChild(div);
      o2vConverterContainer = documentObject.createElement("ul");
      o2vConverterContainer.setAttribute("id", "o2vConverterContainer");
      div.appendChild(o2vConverterContainer);
    }
    o2vConverterContainer.innerHTML = "";
    // split tokens provided by o2v messages
    const tokens = message.split("* ");
    for (let t = 0; t < tokens.length; t++) {
      const tokenMessage = tokens[t];
      // create li for tokens;
      if (tokenMessage.length > 0) {
        const liForToken = documentObject.createElement("li");
        o2vConverterContainer.appendChild(liForToken);
        liForToken.setAttribute("type", "disc");
        liForToken.classList.add("loading-status-entry");
        appendLoadingStatusText(liForToken, tokenMessage);
      }
    }
    if (errorMessage) {
      const errorEntry = documentObject.createElement("li");
      o2vConverterContainer.appendChild(errorEntry);
      errorEntry.setAttribute("type", "disc");
      errorEntry.classList.add("loading-status-entry");
      errorEntry.classList.add("loading-message--error");
      appendLoadingStatusText(errorEntry, errorMessage);
    }

    loadingModule.scrollDownDetails();
  }

  ontologyMenu.setLoadingStatusInfo = function (message) {
    // forward call
    setLoadingStatusInfo(message);
  };

  function getLoadingStatusOnceCallBacked(callback, parameter) {
    fetch("loadingStatus?sessionId=" + conversion_sessionId, {
      headers: { Accept: "application/text" },
    })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .then(function (responseText) {
        setLoadingStatusInfo(responseText);
        callback(parameter);
      })
      .catch(function (error) {
        console.warn(
          "ontologyMenu getLoadingStatusOnceCallBacked throws error",
        );
        console.warn("---------Error -----------");
        console.warn(error);
        callback(parameter);
      });
  }

  function getLoadingStatusTimeLooped() {
    fetch("loadingStatus?sessionId=" + conversion_sessionId, {
      headers: { Accept: "application/text" },
    })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .then(function (responseText) {
        if (stopTimer === false) {
          setLoadingStatusInfo(responseText);
          timedLoadingStatusLogger();
        }
      })
      .catch(function (error) {
        console.warn("ontologyMenu getLoadingStatusTimeLooped throws error");
        console.warn("---------Error -----------");
        console.warn(error);
        if (stopTimer === false) {
          timedLoadingStatusLogger();
        }
      });
  }

  function timedLoadingStatusLogger() {
    clearTimeout(loadingStatusTimer);
    if (stopTimer === false) {
      loadingStatusTimer = setTimeout(function () {
        getLoadingStatusTimeLooped();
      }, 1000);
    }
  }

  function callbackUpdateLoadingMessage(msg) {
    fetch("loadingStatus", { headers: { Accept: "application/text" } })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .then(function (responseText) {
        setLoadingStatusInfo(responseText, msg);
      })
      .catch(function (error) {
        append_message(msg, { tone: "error" });
      });
  }

  ontologyMenu.setConversionID = function (id) {
    conversion_sessionId = id;
  };

  ontologyMenu.callbackLoad_Ontology_FromIRI = function (parameter) {
    const relativePath = parameter[0];
    const ontoName = parameter[1];
    const localThreadId = parameter[2];
    stopTimer = false;
    timedLoadingStatusLogger();
    fetch(relativePath, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .then(function (responseText) {
        if (responseText.length === 0) {
          clearTimeout(loadingStatusTimer);
          stopTimer = true;
          getLoadingStatusOnceCallBacked(callbackFromIRI_URL_ERROR, [
            null,
            { responseText: responseText },
            localThreadId,
          ]);
        } else {
          clearTimeout(loadingStatusTimer);
          stopTimer = true;
          const jsonText = responseText;
          getLoadingStatusOnceCallBacked(callbackFromIRI_Success, [
            jsonText,
            ontoName,
            localThreadId,
          ]);
        }
      })
      .catch(function (error) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        getLoadingStatusOnceCallBacked(callbackFromIRI_URL_ERROR, [
          error,
          null,
          localThreadId,
        ]);
      });
  };

  ontologyMenu.callbackLoad_Ontology_From_DirectInput = function (
    text,
    parameter,
  ) {
    const input = text;
    const sessionId = parameter[1];
    stopTimer = false;
    timedLoadingStatusLogger();

    const formData = new FormData();
    formData.append("input", input);
    formData.append("sessionId", sessionId);
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "directInput", true);
    xhr.onload = function () {
      clearTimeout(loadingStatusTimer);
      stopTimer = true;
      getLoadingStatusOnceCallBacked(callbackForConvert, [
        xhr,
        input,
        sessionId,
      ]);
    };
    timedLoadingStatusLogger();
    xhr.send(formData);
  };
  function callbackFromIRI_Success(parameter) {
    const local_conversionId = parameter[2];
    if (local_conversionId !== conversion_sessionId) {
      console.warn(
        "The conversion process for file:" +
          parameter[1] +
          " has been canceled!",
      );
      ontologyMenu.conversionFinished(local_conversionId);
      return;
    }
    ontologyMenu.loadConvertedVowlModel(parameter[0], parameter[1]);
    ontologyMenu.conversionFinished();
  }

  // A converter response is VOWL JSON. It is parsed once here and enters the
  // controller as a model, never as text forwarded through another module.
  ontologyMenu.loadConvertedVowlModel = async function (
    vowlJsonText,
    displayName,
  ) {
    let vowlModel;
    try {
      vowlModel = JSON.parse(vowlJsonText);
    } catch (parseError) {
      ontologyMenu.append_message_toLastBulletPoint("failed", {
        tone: "error",
      });
      ontologyMenu.append_bulletPoint(
        "The conversion result is not valid VOWL JSON: " + parseError.message,
      );
      return;
    }
    ontologyMenu.setCachedOntology(displayName, vowlModel);
    await webVowlController.loadOntology({
      source: { kind: "vowl-model", model: vowlModel, displayName },
    });
  };

  ontologyMenu.getConversionId = function () {
    return conversion_sessionId;
  };

  ontologyMenu.callbackLoad_JSON_FromURL = function (parameter) {
    const relativePath = parameter[0];
    const ontoName = parameter[1];
    const local_conversionId = parameter[2];
    stopTimer = false;
    timedLoadingStatusLogger();
    fetch(relativePath, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .then(function (responseText) {
        if (responseText.length === 0) {
          clearTimeout(loadingStatusTimer);
          stopTimer = true;
          getLoadingStatusOnceCallBacked(callbackFromJSON_URL_ERROR, [
            null,
            { responseText: responseText },
            local_conversionId,
          ]);
        } else {
          clearTimeout(loadingStatusTimer);
          stopTimer = true;
          const jsonText = responseText;
          getLoadingStatusOnceCallBacked(callbackFromJSON_Success, [
            jsonText,
            ontoName,
            local_conversionId,
          ]);
        }
      })
      .catch(function (error) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        getLoadingStatusOnceCallBacked(callbackFromJSON_URL_ERROR, [
          error,
          null,
          local_conversionId,
        ]);
      });
  };

  function callbackFromJSON_Success(parameter) {
    const local_conversionId = parameter[2];
    if (local_conversionId !== conversion_sessionId) {
      console.warn(
        "The conversion process for file:" +
          parameter[1] +
          " has been canceled!",
      );
      return;
    }
    ontologyMenu.loadConvertedVowlModel(parameter[0], parameter[1]);
  }

  function callbackFromJSON_URL_ERROR(parameter) {
    const error = parameter[0];
    const request = parameter[1];
    const local_conversionId = parameter[2];
    if (local_conversionId !== conversion_sessionId) {
      console.warn("This thread has been canceled!!");
      ontologyMenu.conversionFinished(local_conversionId);
      return;
    }
    callbackUpdateLoadingMessage(
      "Failed to convert the file. Ontology could not be loaded. " +
        "Is it a valid OWL ontology? Check with http://visualdataweb.de/validator/",
    );

    if (error !== null && error.status === 500) {
      append_message("Could not find ontology at the URL", { tone: "error" });
    }
    if (request && request.responseText.length === 0) {
      append_message("Received empty graph", { tone: "error" });
    }
    graph.handleOnLoadingError();
    ontologyMenu.conversionFinished();
  }

  function callbackFromIRI_URL_ERROR(parameter) {
    const error = parameter[0];
    const request = parameter[1];
    const local_conversionId = parameter[2];
    if (local_conversionId !== conversion_sessionId) {
      console.warn("This thread has been canceled!!");
      ontologyMenu.conversionFinished(local_conversionId);
      return;
    }
    callbackUpdateLoadingMessage(
      "Failed to convert the file. Ontology could not be loaded. " +
        "Is it a valid OWL ontology? Check with http://visualdataweb.de/validator/",
    );

    if (error !== null && error.status === 500) {
      append_message("Could not find ontology at the URL", { tone: "error" });
    }
    if (request && request.responseText.length === 0) {
      append_message("Received empty graph", { tone: "error" });
    }
    graph.handleOnLoadingError();
    ontologyMenu.conversionFinished();
  }

  ontologyMenu.callbackLoadFromOntology = function (
    selectedFile,
    filename,
    local_threadId,
  ) {
    callbackLoadFromOntology(selectedFile, filename, local_threadId);
  };

  function callbackLoadFromOntology(selectedFile, filename, local_threadId) {
    stopTimer = false;
    timedLoadingStatusLogger();

    const formData = new FormData();
    formData.append("ontology", selectedFile);
    formData.append("sessionId", local_threadId);
    const xhr = new XMLHttpRequest();

    xhr.open("POST", "convert", true);
    xhr.onload = function () {
      clearTimeout(loadingStatusTimer);
      stopTimer = true;
      console.warn(xhr);
      getLoadingStatusOnceCallBacked(callbackForConvert, [
        xhr,
        filename,
        local_threadId,
      ]);
    };
    timedLoadingStatusLogger();
    xhr.send(formData);
  }

  function callbackForConvert(parameter) {
    const xhr = parameter[0];
    const filename = parameter[1];
    const local_threadId = parameter[2];
    if (local_threadId !== conversion_sessionId) {
      console.warn(
        "The conversion process for file:" + filename + " has been canceled!",
      );
      ontologyMenu.conversionFinished(local_threadId);
      return;
    }
    if (xhr.status === 200) {
      ontologyMenu.loadConvertedVowlModel(xhr.responseText, filename);
      ontologyMenu.conversionFinished();
    } else {
      const uglyJson = xhr.responseText;
      const jsonResut = JSON.parse(uglyJson);
      const niceJSON = JSON.stringify(jsonResut, null, 2);
      callbackUpdateLoadingMessage(
        "Failed to convert the file.\nServer answer:\n" +
          niceJSON +
          "\nOntology could not be loaded. Is it a valid OWL ontology? " +
          "Check with http://visualdataweb.de/validator/",
      );

      graph.handleOnLoadingError();
      ontologyMenu.conversionFinished();
    }
  }

  ontologyMenu.conversionFinished = function (id) {
    let local_id = conversion_sessionId;
    if (id) {
      local_id = id;
    }
    fetch("conversionDone?sessionId=" + local_id, {
      headers: { Accept: "application/text" },
    })
      .then(function (response) {
        if (!response.ok) {
          throw response;
        }
        return response.text();
      })
      .catch(function (error) {
        console.warn("ontologyMenu conversionFinished throws error");
        console.warn("---------Error -----------");
        console.warn(error);
      });
  };

  ontologyMenu.showLoadingStatus = function (visible) {
    if (visible === true) {
      displayLoadingIndicators();
    } else {
      hideLoadingInformations();
    }
  };

  function displayLoadingIndicators() {
    documentObject
      .getElementById("layoutLoadingProgressBarContainer")
      .classList.remove("hidden");
    if (loadingInfo) {
      loadingInfo.classList.remove("hidden");
    }
    if (loadingProgress) {
      loadingProgress.classList.remove("hidden");
    }
  }

  function hideLoadingInformations() {
    if (loadingInfo) {
      loadingInfo.classList.add("hidden");
    }
  }

  return ontologyMenu;
}

export { createOntologyMenu, normalizeOntologyUrl };
