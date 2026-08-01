module.exports = function (graph) {
  const ontologyMenu = {};
  const loadingInfo = d3.select("#loading-info");
  const loadingProgress = d3.select("#loading-progress");
  let stopTimer = false;
  const loadingError = false;
  let loadingStatusTimer;
  let conversion_sessionId;
  const cachedConversions = {};
  let loadingModule;
  let loadOntologyFromText;
  let currentLoadedOntologyName = "";

  String.prototype.beginsWith = function (string) {
    return this.indexOf(string) === 0;
  };

  ontologyMenu.getLoadingFunction = function () {
    return loadOntologyFromText;
  };

  ontologyMenu.clearCachedVersion = function () {
    if (cachedConversions[currentLoadedOntologyName]) {
      cachedConversions[currentLoadedOntologyName] = undefined;
    }
  };

  ontologyMenu.reloadCachedOntology = function () {
    ontologyMenu.clearCachedVersion();
    graph.clearGraphData();
    loadingModule.parseUrlAndLoadOntology(false);
  };

  ontologyMenu.cachedOntology = function (ontoName) {
    currentLoadedOntologyName = ontoName;
    if (cachedConversions[ontoName]) {
      const locStr = String(location.hash);
      d3.select("#reloadSvgIcon").node().disabled = false;
      graph.showReloadButtonAfterLayoutOptimization(true);
      if (locStr.indexOf("#file") > -1) {
        d3.select("#reloadSvgIcon").node().disabled = true;
        d3.select("#reloadCachedOntology").node().title =
          "reloading original version not possible, please reload the file";
        d3.select("#reloadSvgIcon").classed("disabledReloadElement", true);
        d3.select("#svgStringText").classed("svg-text-disabled", true);
        d3.select("#svgStringText").classed("noselect", true);
      } else {
        d3.select("#reloadCachedOntology").node().title =
          "generate new visualization and overwrite cached ontology";
        d3.select("#reloadSvgIcon").classed("disabledReloadElement", false);
        d3.select("#svgStringText").classed("svg-text-disabled", false);
        d3.select("#svgStringText").classed("noselect", true);
      }
    } else {
      graph.showReloadButtonAfterLayoutOptimization(false);
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

  ontologyMenu.setup = function (_loadOntologyFromText) {
    loadOntologyFromText = _loadOntologyFromText;
    loadingModule = graph.options().loadingModule();
    const menuEntry = d3.select("#m_select");
    menuEntry.on("mouseover", function () {
      const searchMenu = graph.options().searchMenu();
      searchMenu.hideSearchEntries();
    });

    setupConverterButtons();
    setupUploadButton();
    setupEmptyButton();

    const descriptionButton = d3
      .select("#error-description-button")
      .datum({ open: false });
    descriptionButton.on("click", function (data) {
      const errorContainer = d3.select("#error-description-container");
      const errorDetailsButton = d3.select(this);

      // toggle the state
      data.open = !data.open;
      const descriptionVisible = data.open;
      if (descriptionVisible) {
        errorDetailsButton.text("Hide error details");
      } else {
        errorDetailsButton.text("Show error details");
      }
      errorContainer.classed("hidden", !descriptionVisible);
    });

    setupUriListener();
    loadingModule.setOntologyMenu(ontologyMenu);
  };

  function setupUriListener() {
    // reload ontology when hash parameter gets changed manually
    d3.select(window).on("hashchange", function () {
      const oldURL = d3.event.oldURL,
        newURL = d3.event.newURL;
      if (oldURL !== newURL) {
        // don't reload when just the hash parameter gets appended
        if (newURL === oldURL + "#") {
          return;
        }
        updateNavigationHrefs();
        loadingModule.parseUrlAndLoadOntology();
      }
    });
    updateNavigationHrefs();
  }

  ontologyMenu.stopLoadingTimer = function () {
    stopTimer = true;
    clearTimeout(loadingStatusTimer);
  };

  /**
   * Quick fix: update all anchor tags that are used as buttons because a click on them
   * changes the url and this will load an other ontology.
   */
  function updateNavigationHrefs() {
    d3.selectAll("#menuElementContainer > li > a").attr(
      "href",
      location.hash || "#",
    );
  }

  ontologyMenu.setIriText = function (text) {
    d3.select("#iri-converter-input").node().value = text;
    d3.select("#iri-converter-button").attr("disabled", false);
    d3.select("#iri-converter-form").on("submit")();
  };

  ontologyMenu.clearDetailInformation = function () {
    const bpContainer = d3.select("#bulletPoint_container");
    const htmlCollection = bpContainer.node().children;
    const numEntries = htmlCollection.length;

    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
    }
  };
  ontologyMenu.append_message = function (msg) {
    // forward call
    append_message(msg, options);
  };
  function append_message(msg) {
    const bpContainer = d3.select("#bulletPoint_container");
    const div = bpContainer.append("div");
    appendStructuredMessage(div, msg, options);
    loadingModule.scrollDownDetails();
  }

  ontologyMenu.append_message_toLastBulletPoint = function (msg) {
    // forward call
    append_message_toLastBulletPoint(msg, options);
  };

  ontologyMenu.append_bulletPoint = function (msg) {
    // forward call
    append_bulletPoint(msg);
  };
  function append_message_toLastBulletPoint(msg) {
    const bpContainer = d3.select("#bulletPoint_container");
    const htmlCollection = bpContainer.node().getElementsByTagName("LI");
    const lastItem = htmlCollection.length - 1;
    if (lastItem >= 0) {
      appendStructuredMessage(d3.select(htmlCollection[lastItem]), msg, options);
    }
    loadingModule.scrollDownDetails();
  }

  function append_bulletPoint(msg) {
    const bp_container = d3.select("#bulletPoint_container");
    const bp = bp_container.append("li");
    bp.text(msg);
    d3.select("#currentLoadingStep").text(msg);
    loadingModule.scrollDownDetails();
  }

  function setupConverterButtons() {
    const iriConverterButton = d3.select("#iri-converter-button");
    const iriConverterInput = d3.select("#iri-converter-input");

    iriConverterInput
      .on("input", function () {
        keepOntologySelectionOpenShortly();

        const inputIsEmpty = iriConverterInput.property("value") === "";
        iriConverterButton.attr("disabled", inputIsEmpty || undefined);
      })
      .on("click", function () {
        keepOntologySelectionOpenShortly();
      });

    d3.select("#iri-converter-form").on("submit", function () {
      let inputName = iriConverterInput.property("value");

      // remove first spaces
      let clearedName = inputName.replace(/%20/g, " ");
      while (clearedName.beginsWith(" ")) {
        clearedName = clearedName.substr(1, clearedName.length);
      }
      // remove ending spaces
      while (clearedName.endsWith(" ")) {
        clearedName = clearedName.substr(0, clearedName.length - 1);
      }
      // check if iri is actually an url for a json file (ends with .json)
      // create lowercase filenames;
      inputName = clearedName;
      const lc_iri = inputName.toLowerCase();
      if (lc_iri.endsWith(".json")) {
        location.hash = "url=" + inputName;
        iriConverterInput.property("value", "");
        iriConverterInput.on("input")();
      } else {
        location.hash = "iri=" + inputName;
        iriConverterInput.property("value", "");
        iriConverterInput.on("input")();
      }
      event.preventDefault();
      return false;
    });
  }

  function setupUploadButton() {
    const input = d3.select("#file-converter-input"),
      inputLabel = d3.select("#file-converter-label"),
      uploadButton = d3.select("#file-converter-button");

    input.on("change", function () {
      const selectedFiles = input.property("files");
      if (selectedFiles.length <= 0) {
        inputLabel.text("Select ontology file");
        uploadButton.property("disabled", true);
      } else {
        inputLabel.text(selectedFiles[0].name);
        uploadButton.property("disabled", false);
        uploadButton.node().click();
        // close menu;
        graph.options().navigationMenu().hideAllMenus();
      }
    });

    uploadButton.on("click", function () {
      const selectedFile = input.property("files")[0];
      if (!selectedFile) {
        return false;
      }
      const newHashParameter = "file=" + selectedFile.name;
      // Trigger the reupload manually, because the iri is not changing
      if (location.hash === "#" + newHashParameter) {
        loadingModule.parseUrlAndLoadOntology();
      } else {
        location.hash = newHashParameter;
      }
    });
  }

  function setupEmptyButton(){
    const emptyButton = d3.select("#empty");
    emptyButton.on("click", function (event){
      if ( emptyButton.property("disabled") ) {
        if ( event && typeof event.preventDefault === "function" ) {
          event.preventDefault();
        }
        return false;
      }
      loadingModule.createNewOntology();
      if ( event && typeof event.preventDefault === "function" ) {
        event.preventDefault();
      }
      graph.options().navigationMenu().hideAllMenus();
    });
    graph.updateEditorModeDependentControls();
  }

  function setLoadingStatusInfo(message) {
    // check if there is a owl2vowl li item;
    let o2vConverterContainer = d3.select("#o2vConverterContainer");
    if (!o2vConverterContainer.node()) {
      const bp_container = d3.select("#bulletPoint_container");
      const div = bp_container.append("div");
      o2vConverterContainer = div.append("ul");
      o2vConverterContainer.attr("id", "o2vConverterContainer");
    }
    // clear o2vConverterContainer;
    const htmlCollection = o2vConverterContainer.node().children;
    const numEntries = htmlCollection.length;
    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
    }
    // split tokens provided by o2v messages
    const tokens = message.split("* ");
    for (let t = 0; t < tokens.length; t++) {
      const tokenMessage = tokens[t];
      // create li for tokens;
      if (tokenMessage.length > 0) {
        const liForToken = o2vConverterContainer.append("li");
        liForToken.attr("type", "disc")
          .classed("loading-status-entry", true);
        appendLoadingStatusText(liForToken, tokenMessage);
      }
    }
    if (liForToken) {
      liForToken.node().innerHTML += "<br>";
    }

    loadingModule.scrollDownDetails();
  }

  ontologyMenu.setLoadingStatusInfo = function (message) {
    // forward call
    setLoadingStatusInfo(message);
  };

  function getLoadingStatusOnceCallBacked(callback, parameter) {
    d3.xhr(
      "loadingStatus?sessionId=" + conversion_sessionId,
      "application/text",
      function (error, request) {
        if (error) {
          console.warn(
            "ontologyMenu getLoadingStatusOnceCallBacked throws error",
          );
          console.warn("---------Error -----------");
          console.warn(error);
          console.warn("---------Request -----------");
          console.warn(request);
        }
        setLoadingStatusInfo(request.responseText);
        callback(parameter);
      },
    );
  }

  function getLoadingStatusTimeLooped() {
    d3.xhr(
      "loadingStatus?sessionId=" + conversion_sessionId,
      "application/text",
      function (error, request) {
        if (error) {
          console.warn("ontologyMenu getLoadingStatusTimeLooped throws error");
          console.warn("---------Error -----------");
          console.warn(error);
          console.warn("---------Request -----------");
          console.warn(request);
        }
        if (stopTimer === false) {
          setLoadingStatusInfo(request.responseText);
          timedLoadingStatusLogger();
        }
      },
    );
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
    d3.xhr("loadingStatus", "application/text", function (error, request) {
      if (request !== undefined) {
        setLoadingStatusInfo(request.responseText + "<br>" + msg);
      } else {
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
    d3.xhr(relativePath, "application/json", function (error, request) {
      const loadingSuccessful = !error;
      // check if error occurred or responseText is empty
      if (
        (error !== null && error.status === 500) ||
        (request && request.responseText.length === 0)
      ) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        getLoadingStatusOnceCallBacked(callbackFromIRI_URL_ERROR, [
          error,
          request,
          localThreadId,
        ]);
      }
      let jsonText;
      if (loadingSuccessful) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        jsonText = request.responseText;
        getLoadingStatusOnceCallBacked(callbackFromIRI_Success, [
          jsonText,
          ontoName,
          localThreadId,
        ]);
      }
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
    loadingModule.loadFromOWL2VOWL(parameter[0], parameter[1]);
    ontologyMenu.conversionFinished();
  }

  ontologyMenu.getConversionId = function () {
    return conversion_sessionId;
  };

  ontologyMenu.callbackLoad_JSON_FromURL = function (parameter) {
    const relativePath = parameter[0];
    const ontoName = parameter[1];
    const local_conversionId = parameter[2];
    stopTimer = false;
    timedLoadingStatusLogger();
    d3.xhr(relativePath, "application/json", function (error, request) {
      let loadingSuccessful = !error;
      // check if error occurred or responseText is empty
      if (
        (error !== null && error.status === 500) ||
        (request && request.responseText.length === 0)
      ) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        loadingSuccessful = false;
        console.warn(request);
        console.warn(request.responseText.length);
        getLoadingStatusOnceCallBacked(callbackFromJSON_URL_ERROR, [
          error,
          request,
          local_conversionId,
        ]);
      }
      if (loadingSuccessful) {
        clearTimeout(loadingStatusTimer);
        stopTimer = true;
        const jsonText = request.responseText;
        getLoadingStatusOnceCallBacked(callbackFromJSON_Success, [
          jsonText,
          ontoName,
          local_conversionId,
        ]);
      }
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
    loadingModule.loadFromOWL2VOWL(parameter[0], parameter[1]);
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
      "<br><span style='color:red'> Failed to convert the file.</span> " +
        ' Ontology could not be loaded.<br>Is it a valid OWL ontology? Please check with <a target="_blank"' +
        'href="http://visualdataweb.de/validator/">OWL Validator</a>',
    );

    if (error !== null && error.status === 500) {
      append_message(
        "<span style='color:red'>Could not find ontology  at the URL</span>",
      );
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
      "<br><span style='color:red'> Failed to convert the file.</span> " +
        ' Ontology could not be loaded.<br>Is it a valid OWL ontology? Please check with <a target="_blank"' +
        'href="http://visualdataweb.de/validator/">OWL Validator</a>',
    );

    if (error !== null && error.status === 500) {
      append_message(
        "<span style='color:red'>Could not find ontology  at the URL</span>",
      );
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
      loadingModule.loadFromOWL2VOWL(xhr.responseText, filename);
      ontologyMenu.conversionFinished();
    } else {
      const uglyJson = xhr.responseText;
      const jsonResut = JSON.parse(uglyJson);
      let niceJSON = JSON.stringify(jsonResut, "null", "  ");
      // The constructor receives escaped CR/LF text, not literal control bytes.
      // eslint-disable-next-line no-control-regex
      niceJSON = niceJSON.replace(new RegExp("\r?\n", "g"), "<br />");
      callbackUpdateLoadingMessage(
        "Failed to convert the file. " +
          "<br />Server answer: <br />" +
          "<hr>" +
          niceJSON +
          "<hr>" +
          'Ontology could not be loaded.<br />Is it a valid OWL ontology? Please check with <a target="_blank"' +
          'href="http://visualdataweb.de/validator/">OWL Validator</a>',
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
    d3.xhr(
      "conversionDone?sessionId=" + local_id,
      "application/text",
      function (error, request) {
        if (error) {
          console.warn("ontologyMenu conversionFinished throws error");
          console.warn("---------Error -----------");
          console.warn(error);
          console.warn("---------Request -----------");
          console.warn(request);
        }
      },
    );
  };

  function keepOntologySelectionOpenShortly() {
    // Events in the menu should not be considered
    const ontologySelection = d3.select("#select .toolTipMenu");
    ontologySelection
      .on("click", function () {
        d3.event.stopPropagation();
      })
      .on("keydown", function () {
        d3.event.stopPropagation();
      });

    ontologySelection.classed("hidden", false);

    function disableKeepingOpen() {
      ontologySelection.classed("hidden", true);

      clearTimeout(ontologyMenuTimeout);
      d3.select(window).on("click", undefined).on("keydown", undefined);
      ontologySelection.on("mouseover", undefined);
    }

    // Clear the timeout to handle fast calls of this function
    clearTimeout(ontologyMenuTimeout);
    ontologyMenuTimeout = setTimeout(function () {
      disableKeepingOpen();
    }, 3000);

    // Disable forced open selection on interaction
    d3.select(window)
      .on("click", function () {
        disableKeepingOpen();
      })
      .on("keydown", function () {
        disableKeepingOpen();
      });

    ontologySelection.on("mouseover", function () {
      disableKeepingOpen();
    });
  }

  ontologyMenu.showLoadingStatus = function (visible) {
    if (visible === true) {
      displayLoadingIndicators();
    } else {
      hideLoadingInformations();
    }
  };

  function displayLoadingIndicators() {
    d3.select("#layoutLoadingProgressBarContainer").classed("hidden", false);
    loadingInfo.classed("hidden", false);
    loadingProgress.classed("hidden", false);
  }

  function hideLoadingInformations() {
    loadingInfo.classed("hidden", true);
  }

  return ontologyMenu;
};
