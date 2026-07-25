const owl2vowlModule = require("../../owl2vowl/js/index.js");
const owl2vowl = owl2vowlModule.default || owl2vowlModule;
const resolveFetchUrl = require("../../webvowl/js/util/resolveFetchUrl");
if (!owl2vowl.loadWithImports && owl2vowlModule.loadWithImports) {
  owl2vowl.loadWithImports = owl2vowlModule.loadWithImports;
}

module.exports = function (graph) {
  /** some constants **/
  const PREDEFINED = 0,
    FILE_UPLOAD = 1,
    JSON_URL = 2,
    IRI_URL = 3;

  const PROGRESS_BAR_ERROR = 0;
  const PROGRESS_BAR_BUSY = 1;
  const PROGRESS_BAR_PERCENT = 2;
  let progressBarMode = 1;

  let loadingWasSuccessFul = false;
  let missingImportsWarning = false;
  let showLoadingDetails = false;
  let visibilityStatus = true;

  const DEFAULT_JSON_NAME = "foaf"; // This file is loaded by default
  let conversion_sessionId;

  /** variable defs **/
  const loadingModule = {};
  const menuContainer = d3.select("#loading-info");
  const loadingInfoContainer = d3.select("#loadingInfo-container");
  const detailsButton = d3.select("#show-loadingInfo-button");
  const closeButton = d3.select("#loadingIndicator_closeButton");
  let ontologyMenu;
  let ontologyIdentifierFromURL;

  /** functon defs **/
  loadingModule.checkForScreenSize = function () {
    // checks for window size and adjusts the loading indicator
    const w = graph.options().width(),
      h = graph.options().height();

    if (w < 270) {
      d3.select("#loading-info").classed("hidden", true);
    } else {
      // check if it should be visible
      if (visibilityStatus === true) {
        d3.select("#loading-info").classed("hidden", false);
      } else {
        d3.select("#loading-info").classed("hidden", true);
      }
    }
    if (h < 150) {
      d3.select("#loadingInfo_msgBox").classed("hidden", true);
    } else {
      d3.select("#loadingInfo_msgBox").classed("hidden", false);
    }
    if (h < 80) {
      d3.select("#progressBarContext").classed("hidden", true);
      d3.select("#layoutLoadingProgressBarContainer").classed("compact", true);
    } else {
      d3.select("#progressBarContext").classed("hidden", false);
      d3.select("#layoutLoadingProgressBarContainer").classed("compact", false);
    }
  };

  loadingModule.getMessageVisibilityStatus = function () {
    return visibilityStatus;
  };

  loadingModule.getProgressBarMode = function () {
    return progressBarMode;
  };

  loadingModule.successfullyLoadedOntology = function () {
    return loadingWasSuccessFul;
  };

  loadingModule.missingImportsWarning = function () {
    return missingImportsWarning;
  };

  loadingModule.setOntologyMenu = function (m) {
    ontologyMenu = m;
  };

  loadingModule.showErrorDetailsMessage = function () {
    loadingModule.showLoadingIndicator();
    loadingModule.expandDetails();
    d3.select("#loadingIndicator_closeButton").classed("hidden", true);
    loadingModule.scrollDownDetails();
  };

  loadingModule.showWarningDetailsMessage = function () {
    d3.select("#currentLoadingStep").attr("class", "step-warning");
    loadingModule.showLoadingIndicator();
    loadingModule.expandDetails();
    d3.select("#loadingIndicator_closeButton").classed("hidden", false);
    loadingModule.scrollDownDetails();
  };

  loadingModule.scrollDownDetails = function () {
    const scrollingElement = d3.select("#loadingInfo-container").node();
    scrollingElement.scrollTop = scrollingElement.scrollHeight;
  };

  loadingModule.hideLoadingIndicator = function () {
    d3.select("#loading-info").classed("hidden", true);
    visibilityStatus = false;
  };

  loadingModule.showLoadingIndicator = function () {
    d3.select("#loading-info").classed("hidden", false);
    visibilityStatus = true;
  };

  /** -- SETUP -- **/
  loadingModule.setup = function () {
    // create connections for close and details button;
    loadingInfoContainer.classed("hidden", !showLoadingDetails);
    detailsButton.on("click", function () {
      showLoadingDetails = !showLoadingDetails;
      loadingInfoContainer.classed("hidden", !showLoadingDetails);
      detailsButton.classed("accordion-trigger-active", showLoadingDetails);
    });

    closeButton.on("click", function () {
      menuContainer.classed("hidden", true);
    });
    loadingModule.setBusyMode();
  };

  loadingModule.updateSize = function () {
    showLoadingDetails = !loadingInfoContainer.classed("hidden");
    loadingInfoContainer.classed("hidden", !showLoadingDetails);
    detailsButton.classed("accordion-trigger-active", showLoadingDetails);
  };

  loadingModule.getDetailsState = function () {
    return showLoadingDetails;
  };

  loadingModule.expandDetails = function () {
    showLoadingDetails = true;
    loadingInfoContainer.classed("hidden", !showLoadingDetails);
    detailsButton.classed("accordion-trigger-active", showLoadingDetails);
  };

  loadingModule.collapseDetails = function () {
    showLoadingDetails = false;
    loadingInfoContainer.classed("hidden", !showLoadingDetails);
    detailsButton.classed("accordion-trigger-active", showLoadingDetails);
  };

  loadingModule.setBusyMode = function () {
    d3.select("#currentLoadingStep").attr("class", "step-busy");
    d3.select("#progressBarValue").node().innherHTML = "";
    d3.select("#progressBarValue").classed("pct-20", true).classed("pct-0", false);
    d3.select("#progressBarValue").classed("busyProgressBar", true);
    progressBarMode = PROGRESS_BAR_BUSY;
  };

  loadingModule.setSuccessful = function () {
    d3.select("#currentLoadingStep").attr("class", "step-success");
  };

  loadingModule.setErrorMode = function () {
    d3.select("#currentLoadingStep").attr("class", "step-error");
    d3.select("#progressBarValue").classed("pct-20", false).classed("pct-0", true);
    d3.select("#progressBarValue").classed("busyProgressBar", false);
    d3.select("#progressBarValue").node().innherHTML = "";
    progressBarMode = PROGRESS_BAR_ERROR;
  };

  loadingModule.setPercentMode = function () {
    d3.select("#currentLoadingStep").attr("class", "step-busy");
    d3.select("#progressBarValue").classed("busyProgressBar", false);
    d3.select("#progressBarValue").node().innherHTML = "0%";
    d3.select("#progressBarValue").classed("pct-20", false).classed("pct-0", true);
    progressBarMode = PROGRESS_BAR_PERCENT;
  };

  loadingModule.setPercentValue = function (val) {
    d3.select("#progressBarValue").node().innherHTML = val;
  };

  loadingModule.emptyGraphContentError = function () {
    graph.clearGraphData();
    ontologyMenu.append_message_toLastBulletPoint(
      "<span style='color:red;'>failed</span>",
    );
    ontologyMenu.append_message_toLastBulletPoint(
      '<br><span style="color:red;">Error: Received empty graph</span>',
    );
    loadingWasSuccessFul = false;
    graph.handleOnLoadingError();
    loadingModule.setErrorMode();
  };

  loadingModule.isThreadCanceled = function () {};

  loadingModule.initializeLoader = function (storeCache) {
    if (storeCache === true && graph.getCachedJsonObj() !== null) {
      // save cached ontology;
      const cachedContent = JSON.stringify(graph.getCachedJsonObj());
      const cachedName = ontologyIdentifierFromURL;
      ontologyMenu.setCachedOntology(cachedName, cachedContent);
    }
    conversion_sessionId = -10000;
    ontologyMenu.setConversionID(conversion_sessionId);
    ontologyMenu.stopLoadingTimer();
    graph.clearGraphData();
    loadingModule.setBusyMode();
    loadingModule.showLoadingIndicator();
    loadingModule.collapseDetails();
    missingImportsWarning = false;
    d3.select("#loadingIndicator_closeButton").classed("hidden", true);
    ontologyMenu.clearDetailInformation();
  };

  /** ------------------ URL Interpreter -------------- **/
  loadingModule.parseUrlAndLoadOntology = function (storeCache) {
    let autoStore = true;
    if (storeCache === false) {
      autoStore = false;
    }

    graph.clearAllGraphData();
    loadingModule.initializeLoader(autoStore);
    const urlString = String(location);
    const parameterArray = identifyParameter(urlString);
    ontologyIdentifierFromURL = DEFAULT_JSON_NAME;
    loadGraphOptions(parameterArray); // identifies and loads configuration values
    const loadingMethod = identifyOntologyLoadingMethod(
      ontologyIdentifierFromURL,
    );
    d3.select("#progressBarValue").node().innerHTML = " ";
    switch (loadingMethod) {
      case 0:
        loadingModule.from_presetOntology(ontologyIdentifierFromURL);
        break;
      case 1:
        loadingModule.from_FileUpload(ontologyIdentifierFromURL);
        break;
      case 2:
        loadingModule.from_JSON_URL(ontologyIdentifierFromURL);
        break;
      case 3:
        loadingModule.from_IRI_URL(ontologyIdentifierFromURL);
        break;
      default:
        console.warn(
          "Could not identify loading method , or not IMPLEMENTED YET",
        );
    }
  };

  /** ------------------- LOADING --------------------- **/
  // the loading module splits into 3 branches
  // 1] PresetOntology Loading
  // 2] File Upload
  // 3] Load From URL / IRI

  loadingModule.from_JSON_URL = function (fileName) {
    const filename = decodeURIComponent(fileName.slice("url=".length));
    const requestUrl = resolveFetchUrl(filename);
    ontologyIdentifierFromURL = filename;

    if (ontologyMenu.cachedOntology(filename)) {
      ontologyMenu.append_bulletPoint(
        "Loading already cached ontology: " + filename,
      );
      const ontologyContent = ontologyMenu.cachedOntology(filename);
      loadingWasSuccessFul = true; // cached Ontology should be true;
      parseOntologyContent(ontologyContent);
    } else {
      ontologyMenu.append_message(
        "Retrieving ontology from JSON URL " + filename,
      );
      d3.xhr(requestUrl, "application/json", function (error, request) {
        if (error) {
          console.error(error);
          ontologyMenu.append_message_toLastBulletPoint(
            "<span style='color:red;'>failed</span>",
          );
          ontologyMenu.append_bulletPoint(
            "Could not fetch remote JSON: " + filename,
          );
          ontologyMenu.append_message_toLastBulletPoint(
            "<br>CORS restrictions might prevent loading remote files directly in the browser.",
          );
          loadingModule.setErrorMode();
          graph.handleOnLoadingError();
        });
    }
  };

  loadingModule.requestServerTimeStampForDirectInput = function (
    callback,
    text,
  ) {
    // Bypassed timestamp for client side parsing
    callback(text, ["conversionIDClient", "clientSession"]);
  };

  loadingModule.from_IRI_URL = function (fileName) {
    const filename = decodeURIComponent(fileName.slice("iri=".length));
    const requestUrl = resolveFetchUrl(filename);
    ontologyIdentifierFromURL = filename;

    if (ontologyMenu.cachedOntology(filename)) {
      ontologyMenu.append_bulletPoint(
        "Loading already cached ontology: " + filename,
      );
      const ontologyContent = ontologyMenu.cachedOntology(filename);
      loadingWasSuccessFul = true; // cached Ontology should be true;
      parseOntologyContent(ontologyContent);
    } else {
      ontologyMenu.append_bulletPoint(
        "Retrieving ontology from IRI: " + filename,
      );
      d3.xhr(requestUrl, function (error, request) {
        if (error) {
          console.error(error);
          ontologyMenu.append_message_toLastBulletPoint(
            "<span style='color:red;'>failed</span>",
          );
          ontologyMenu.append_bulletPoint(
            "Could not fetch remote IRI: " + filename,
          );
          ontologyMenu.append_message_toLastBulletPoint(
            "<br>CORS restrictions might prevent loading remote files directly in the browser.",
          );
          loadingModule.setErrorMode();
          graph.handleOnLoadingError();
        } else {
          try {
            ontologyMenu.append_bulletPoint(
              "Converting remote ontology client-side...",
            );
            const xmlText = request.responseText;
            // RFC 3986 section 5.1.3: the IRI a document was retrieved from is
            // its base. Passing it lets relative references resolve against the
            // real namespace instead of falling back to a synthetic base.
            owl2vowl
              .loadWithImports(xmlText, { documentIRI: requestUrl })
              .then(function (vowlJson) {
                parseOntologyContent(JSON.stringify(vowlJson));
                ontologyMenu.append_message_toLastBulletPoint("done");
              })
              .catch(function (e) {
                console.error(e);
                ontologyMenu.append_message_toLastBulletPoint(
                  "<span style='color:red;'>failed</span>",
                );
                ontologyMenu.append_bulletPoint(
                  "Failed to convert remote ontology: " + filename,
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<br><span style='color:red'>Error: " + e.message + "</span>",
                );
                loadingModule.setErrorMode();
                graph.handleOnLoadingError();
              });
          } catch (e) {
            console.error(e);
            ontologyMenu.append_message_toLastBulletPoint(
              "<span style='color:red;'>failed</span>",
            );
            ontologyMenu.append_bulletPoint(
              "Failed to convert remote ontology: " + filename,
            );
            ontologyMenu.append_message_toLastBulletPoint(
              "<br><span style='color:red'>Error: " + e.message + "</span>",
            );
            loadingModule.setErrorMode();
            graph.handleOnLoadingError();
          }
        })
        .catch(function(error) {
          console.error(error);
          ontologyMenu.append_message_toLastBulletPoint("<span style='color:red;'>failed</span>");
          ontologyMenu.append_bulletPoint("Could not fetch remote IRI: " + filename);
          ontologyMenu.append_message_toLastBulletPoint("<br>CORS restrictions might prevent loading remote files directly in the browser.");
          loadingModule.setErrorMode();
          graph.handleOnLoadingError();
        });
    }
  };

  loadingModule.fromFileDrop = function (fileName, file) {
    let reader;
    d3.select("#progressBarValue").node().innerHTML = " ";
    loadingModule.initializeLoader(false);

    ontologyMenu.append_bulletPoint(
      "Retrieving ontology from dropped file: " + fileName,
    );
    let ontologyContent = "";

    if (fileName.match(/\.json$/)) {
      ontologyMenu.setConversionID(-10000);
      reader = new FileReader();
      reader.readAsText(file);
      reader.onload = function () {
        ontologyContent = reader.result;
        ontologyIdentifierFromURL = fileName;
        parseOntologyContent(ontologyContent);
      };
    } else {
      reader = new FileReader();
      reader.readAsText(file);
      reader.onload = function () {
        try {
          const xmlText = reader.result;
          ontologyMenu.append_bulletPoint("Converting ontology client-side...");
          // An uploaded file has no retrieval IRI, so no base is supplied and
          // the synthetic one applies. The name is passed for diagnostics only.
          owl2vowl
            .loadWithImports(xmlText, { fileName })
            .then(function (vowlJson) {
              ontologyIdentifierFromURL = fileName;
              parseOntologyContent(JSON.stringify(vowlJson));
              ontologyMenu.append_message_toLastBulletPoint("done");
            })
            .catch(function (e) {
              console.error(e);
              ontologyMenu.append_message_toLastBulletPoint(
                "<span style='color:red;'>failed</span>",
              );
              ontologyMenu.append_bulletPoint("Failed to convert: " + fileName);
              ontologyMenu.append_message_toLastBulletPoint(
                "<br><span style='color:red'>Error: " + e.message + "</span>",
              );
              loadingModule.setErrorMode();
              graph.handleOnLoadingError();
            });
        } catch (e) {
          console.error(e);
          ontologyMenu.append_message_toLastBulletPoint(
            "<span style='color:red;'>failed</span>",
          );
          ontologyMenu.append_bulletPoint("Failed to convert: " + fileName);
          ontologyMenu.append_message_toLastBulletPoint(
            "<br><span style='color:red'>Error: " + e.message + "</span>",
          );
          loadingModule.setErrorMode();
          graph.handleOnLoadingError();
        }
      };
    }
  };

  loadingModule.from_FileUpload = function (fileName) {
    let reader;
    loadingModule.setBusyMode();
    let filename = decodeURIComponent(fileName.slice("file=".length));
    ontologyIdentifierFromURL = filename;
    let ontologyContent = "";
    if (ontologyMenu.cachedOntology(filename)) {
      ontologyMenu.append_bulletPoint(
        "Loading already cached ontology: " + filename,
      );
      ontologyContent = ontologyMenu.cachedOntology(filename);
      loadingWasSuccessFul = true; // cached Ontology should be true;
      parseOntologyContent(ontologyContent);
    } else {
      ontologyMenu.append_bulletPoint(
        "Retrieving ontology from file: " + filename,
      );
      const selectedFile = d3
        .select("#file-converter-input")
        .property("files")[0];
      if (!selectedFile || (filename && filename !== selectedFile.name)) {
        ontologyMenu.append_message_toLastBulletPoint(
          '<br><span style="color:red;">No cached version of "' +
            filename +
            '" was found.</span><br>Please reupload the file.',
        );
        loadingModule.setErrorMode();
        d3.select("#progressBarValue").classed("busyProgressBar", false);
        graph.handleOnLoadingError();
        return;
      } else {
        filename = selectedFile.name;
      }

      if (filename.match(/\.json$/)) {
        ontologyMenu.setConversionID(-10000);
        reader = new FileReader();
        reader.readAsText(selectedFile);
        reader.onload = function () {
          ontologyContent = reader.result;
          ontologyIdentifierFromURL = filename;
          parseOntologyContent(ontologyContent);
        };
      } else {
        reader = new FileReader();
        reader.readAsText(selectedFile);
        reader.onload = function () {
          try {
            const xmlText = reader.result;
            ontologyMenu.append_bulletPoint(
              "Converting ontology client-side...",
            );
            // A dropped or selected file has no retrieval IRI either.
            owl2vowl
              .loadWithImports(xmlText, { fileName: filename })
              .then(function (vowlJson) {
                ontologyIdentifierFromURL = filename;
                parseOntologyContent(JSON.stringify(vowlJson));
                ontologyMenu.append_message_toLastBulletPoint("done");
              })
              .catch(function (e) {
                console.error(e);
                ontologyMenu.append_message_toLastBulletPoint(
                  "<span style='color:red;'>failed</span>",
                );
                ontologyMenu.append_bulletPoint(
                  "Failed to convert: " + filename,
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<br><span style='color:red'>Error: " + e.message + "</span>",
                );
                loadingModule.setErrorMode();
                graph.handleOnLoadingError();
              });
          } catch (e) {
            console.error(e);
            ontologyMenu.append_message_toLastBulletPoint(
              "<span style='color:red;'>failed</span>",
            );
            ontologyMenu.append_bulletPoint("Failed to convert: " + filename);
            ontologyMenu.append_message_toLastBulletPoint(
              "<br><span style='color:red'>Error: " + e.message + "</span>",
            );
            loadingModule.setErrorMode();
            graph.handleOnLoadingError();
          }
        };
      }
    }
  };

  loadingModule.directInput = function (text) {
    ontologyMenu.clearDetailInformation();
    parseOntologyContent(text);
  };

  loadingModule.loadFromOWL2VOWL = function (ontoContent, filename) {
    loadingWasSuccessFul = false;

    const old = d3.select("#bulletPoint_container").node().innerHTML;
    if (old.indexOf("(with warnings)") !== -1) {
      missingImportsWarning = true;
    }

    if (ontologyMenu.cachedOntology(ontoContent)) {
      ontologyMenu.append_bulletPoint(
        "Loading already cached ontology: " + filename,
      );
      parseOntologyContent(ontoContent);
    } else {
      // set parse the ontology content;
      parseOntologyContent(ontoContent);
    }
  };

  loadingModule.from_presetOntology = function (selectedOntology) {
    ontologyMenu.append_bulletPoint("Retrieving ontology: " + selectedOntology);
    loadPresetOntology(selectedOntology);
  };

  function loadPresetOntology(ontology) {
    // check if already cached in ontology menu?
    let f2r;
    let loadingNewOntologyForEditor = false;
    if (ontology.indexOf("new_ontology") !== -1) {
      loadingModule.hideLoadingIndicator();
      graph.showEditorHintIfNeeded();
      f2r = "./data/new_ontology.json";
      loadingNewOntologyForEditor = true;
    }

    loadingWasSuccessFul = false;
    let ontologyContent = "";
    if (ontologyMenu.cachedOntology(ontology)) {
      ontologyMenu.append_bulletPoint(
        "Loading already cached ontology: " + ontology,
      );
      ontologyContent = ontologyMenu.cachedOntology(ontology);
      loadingWasSuccessFul = true; // cached Ontology should be true;
      loadingModule.showLoadingIndicator();
      parseOntologyContent(ontologyContent);
    } else {
      // read the file name

      let fileToRead = "./data/" + ontology + ".json";
      if (f2r) {
        fileToRead = f2r;
      } // overwrite the newOntology Index
      // read file
      d3.xhr(fileToRead, "application/json", function (error, request) {
        const loadingSuccessful = !error;
        if (loadingSuccessful) {
          ontologyContent = request.responseText;
          parseOntologyContent(ontologyContent);
        } else {
          if (loadingNewOntologyForEditor) {
            ontologyContent =
              "{\n" +
              '  "_comment": "Empty ontology for WebVOWL Editor",\n' +
              '  "header": {\n' +
              '    "languages": [\n' +
              '      "en"\n' +
              "    ],\n" +
              '    "baseIris": [\n' +
              '      "http://www.w3.org/2000/01/rdf-schema"\n' +
              "    ],\n" +
              '    "iri": "http://visualdataweb.org/newOntology/",\n' +
              '    "title": {\n' +
              '      "en": "New ontology"\n' +
              "    },\n" +
              '    "description": {\n' +
              '      "en": "New ontology description"\n' +
              "    }\n" +
              "  },\n" +
              '  "namespace": [],\n' +
              '  "metrics": {\n' +
              '    "classCount": 0,\n' +
              '    "datatypeCount": 0,\n' +
              '    "objectPropertyCount": 0,\n' +
              '    "datatypePropertyCount": 0,\n' +
              '    "propertyCount": 0,\n' +
              '    "nodeCount": 0,\n' +
              '    "individualCount": 0\n' +
              "  }\n" +
              "}\n";
            parseOntologyContent(ontologyContent);
          } else {
            // some error occurred
            ontologyMenu.append_bulletPoint("Failed to load: " + ontology);
            if (error.status === 0) {
              // assumption this is CORS error when running locally (error status == 0)
              ontologyMenu.append_message_toLastBulletPoint(
                " <span style='color: red'>ERROR STATUS:</span> " +
                  error.status,
              );
              if (window.location.toString().startsWith("file:/")) {
                ontologyMenu.append_message_toLastBulletPoint(
                  "<br><p>WebVOWL runs in a local instance.</p>",
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<p>CORS prevents to automatically load files on host system.</p>",
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<p>You can load preprocessed ontologies (i.e. VOWL-JSON files) using the upload feature in the ontology menu or by dragging the files and dropping them on the canvas.</p>",
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<p><i>Hint: </i>Note that the conversion of ontologies into the VOWL-JSON format is not part of WebVOWL but requires an additional converter such as OWL2VOWL.</p>",
                );
                ontologyMenu.append_message_toLastBulletPoint(
                  "<p>Ontologies can be created using the editor mode (i.e. activate editing mode in <b>Modes</b> menu and create a new ontology using the <b>Ontology</b> menu.</p>",
                );
              }
            } else {
              ontologyMenu.append_message_toLastBulletPoint(
                " <span style='color: red'>ERROR STATUS:</span> " +
                  error.status,
              );
            }

            graph.handleOnLoadingError();
            loadingModule.setErrorMode();
          }
        });
    }
  }

  /** -- PARSE JSON CONTENT -- **/
  function parseOntologyContent(content) {
    ontologyMenu.append_bulletPoint("Reading ontology graph ... ");
    const _loader = ontologyMenu.getLoadingFunction();
    _loader(content, ontologyIdentifierFromURL, "noAlternativeNameYet");
  }

  loadingModule.notValidJsonFile = function () {
    graph.clearGraphData();
    ontologyMenu.append_message_toLastBulletPoint(
      " <span style='color:red;'>failed</span>",
    );
    ontologyMenu.append_message_toLastBulletPoint(
      "<br><span style='color:red;'>Error: Received empty graph</span>",
    );
    loadingWasSuccessFul = false;
    graph.handleOnLoadingError();
  };

  loadingModule.validJsonFile = function () {
    ontologyMenu.append_message_toLastBulletPoint("done");
    loadingWasSuccessFul = true;
  };

  /** --- HELPER FUNCTIONS **/

  function identifyParameter(url) {
    const numParameters = (url.match(/#/g) || []).length;
    // create parameters array
    const paramArray = [];
    if (numParameters > 0) {
      const tokens = url.split("#");
      // skip the first token since it is the address of the server
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i].length === 0) {
          // this token belongs actually to the last paramArray
          paramArray[paramArray.length - 1] =
            paramArray[paramArray.length - 1] + "#";
        } else {
          paramArray.push(tokens[i]);
        }
      }
    }
    return paramArray;
  }

  function loadGraphOptions(parameterArray) {
    const optString = "opts=";

    function loadDefaultConfig() {
      graph.options().setOptionsFromURL(graph.options().defaultConfig(), false);
    }

    function loadCustomConfig(opts) {
      let changeEditingFlag = false;
      const defObj = graph.options().defaultConfig();
      for (let i = 0; i < opts.length; i++) {
        const keyVal = opts[i].split("=");
        if (keyVal[0] === "editorMode") {
          changeEditingFlag = true;
        }
        defObj[keyVal[0]] = keyVal[1];
      }
      graph.options().setOptionsFromURL(defObj, changeEditingFlag);
    }

    function identifyOptions(paramArray) {
      if (paramArray[0].indexOf(optString) >= 0) {
        // parse the parameters;
        const parameterLength = paramArray[0].length;
        const givenOptionsStr = paramArray[0].substr(5, parameterLength - 6);
        const optionsArray = givenOptionsStr.split(";");
        loadCustomConfig(optionsArray);
      } else {
        ontologyIdentifierFromURL = paramArray[0];
        loadDefaultConfig();
      }
    }

    function identifyOptionsAndOntology(paramArray) {
      if (paramArray[0].indexOf(optString) >= 0) {
        // parse the parameters;
        const parameterLength = paramArray[0].length;
        const givenOptionsStr = paramArray[0].substr(5, parameterLength - 6);
        const optionsArray = givenOptionsStr.split(";");
        loadCustomConfig(optionsArray);
      } else {
        loadDefaultConfig();
      }
      ontologyIdentifierFromURL = paramArray[1];
    }

    switch (parameterArray.length) {
      case 0:
        loadDefaultConfig();
        break;
      case 1:
        identifyOptions(parameterArray);
        break;
      case 2:
        identifyOptionsAndOntology(parameterArray);
        break;
      default:
        console.warn("To many input parameters , loading default config");
        loadDefaultConfig();
        ontologyIdentifierFromURL = "ERROR_TO_MANY_INPUT_PARAMETERS";
    }
  }

  function identifyOntologyLoadingMethod(url) {
    const iriKey = "iri=";
    const urlKey = "url=";
    const fileKey = "file=";

    let method;
    if (url.substr(0, fileKey.length) === fileKey) {
      method = FILE_UPLOAD;
    } else if (url.substr(0, urlKey.length) === urlKey) {
      method = JSON_URL;
    } else if (url.substr(0, iriKey.length) === iriKey) {
      method = IRI_URL;
    } else {
      method = PREDEFINED;
    }
    return method;
  }

  return loadingModule;
};
