/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function (graph) {
  const editSidebar = {},
    languageTools = webvowl.util.languageTools(),
    elementTools = webvowl.util.elementTools();

  const prefixModule = webvowl.util.prefixTools(graph);
  let selectedElementForCharacteristics;
  let oldPrefix, oldPrefixURL;
  let prefix_editMode = false;

  editSidebar.clearMetaObjectValue = function () {
    document.querySelector("#titleEditor").value = "";
    document.querySelector("#iriEditor").value = "";
    document.querySelector("#versionEditor").value = "";
    document.querySelector("#authorsEditor").value = "";
    document.querySelector("#descriptionEditor").value = "";
    // todo add clear description;
  };

  editSidebar.updatePrefixUi = function () {
    editSidebar.updateElementWidth();
    const prefixListContainer = d3.select("#prefixURL_Container");
    prefixListContainer.selectAll("*").remove();
    setupPrefixList();
  };

  editSidebar.setup = function () {
    setupCollapsing();
    setupPrefixList();
    setupAddPrefixButton();
    setupSupportedDatatypes();

    document
      .querySelector("#titleEditor")
      .addEventListener("change", function () {
        graph
          .options()
          .addOrUpdateGeneralObjectEntry(
            "title",
            document.querySelector("#titleEditor").value,
          );
      });
    document
      .querySelector("#titleEditor")
      .addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .options()
            .addOrUpdateGeneralObjectEntry(
              "title",
              document.querySelector("#titleEditor").value,
            );
        }
      });
    document
      .querySelector("#iriEditor")
      .addEventListener("change", function () {
        if (
          graph
            .options()
            .addOrUpdateGeneralObjectEntry(
              "iri",
              document.querySelector("#iriEditor").value,
            ) === false
        ) {
          // restore value
          document.querySelector("#iriEditor").value = graph
            .options()
            .getGeneralMetaObjectProperty("iri");
        }
      });
    document
      .querySelector("#iriEditor")
      .addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          if (
            graph
              .options()
              .addOrUpdateGeneralObjectEntry(
                "iri",
                document.querySelector("#iriEditor").value,
              ) === false
          ) {
            // restore value
            document.querySelector("#iriEditor").value = graph
              .options()
              .getGeneralMetaObjectProperty("iri");
          }
        }
      });
    document
      .querySelector("#versionEditor")
      .addEventListener("change", function () {
        graph
          .options()
          .addOrUpdateGeneralObjectEntry(
            "version",
            document.querySelector("#versionEditor").value,
          );
      });
    document
      .querySelector("#versionEditor")
      .addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .options()
            .addOrUpdateGeneralObjectEntry(
              "version",
              document.querySelector("#versionEditor").value,
            );
        }
      });
    document
      .querySelector("#authorsEditor")
      .addEventListener("change", function () {
        graph
          .options()
          .addOrUpdateGeneralObjectEntry(
            "author",
            document.querySelector("#authorsEditor").value,
          );
      });
    document
      .querySelector("#authorsEditor")
      .addEventListener("keydown", function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .options()
            .addOrUpdateGeneralObjectEntry(
              "author",
              document.querySelector("#authorsEditor").value,
            );
        }
      });
    document
      .querySelector("#descriptionEditor")
      .addEventListener("change", function () {
        graph
          .options()
          .addOrUpdateGeneralObjectEntry(
            "description",
            document.querySelector("#descriptionEditor").value,
          );
      });

    editSidebar.updateElementWidth();
  };

  function setupSupportedDatatypes() {
    const datatypeEditorSelection = document.querySelector(
      "#typeEditor_datatype",
    );
    const supportedDatatypes = graph
      .options()
      .supportedDatatypes()
      .filter((d) => d !== "rdfs:Literal");
    for (let i = 0; i < supportedDatatypes.length; i++) {
      const optB = document.createElement("option");
      optB.innerHTML = supportedDatatypes[i];
      datatypeEditorSelection.appendChild(optB);
    }
  }

  function highlightDeleteButton(enable, name) {
    const deletePath = document.querySelector("#del_pathFor_" + name);
    const deleteRect = document.querySelector("#del_rectFor_" + name);

    if (enable === false) {
      deletePath.classList.add("delete-path-style");
      deleteRect.classList.add("non-clickable");
      deleteRect.classList.remove("clickable");
    } else {
      deletePath.classList.add("delete-path-style");
      deleteRect.classList.add("clickable");
      deleteRect.classList.remove("non-clickable");
    }
  }

  function highlightEditButton(enable, name, fill) {
    const editPath = document.querySelector("#pathFor_" + name);
    const editRect = document.querySelector("#rectFor_" + name);

    if (enable === false) {
      editPath.classList.add("edit-path-style");
      editRect.classList.add("non-clickable");
      editRect.classList.remove("clickable");
    } else {
      editPath.classList.add("edit-path-style");
      editRect.classList.add("clickable");
      editRect.classList.remove("non-clickable");
    }
  }

  function setupAddPrefixButton() {
    const btn = document.querySelector("#addPrefixButton");
    btn.addEventListener("click", function () {
      // check if we are still in editMode?
      if (prefix_editMode === false) {
        // create new line entry;
        const name = "emptyPrefixEntry";
        const prefixListContainer = d3.select("#prefixURL_Container");
        const prefixEditContainer = prefixListContainer.append("div");
        prefixEditContainer.classed("prefixIRIElements", true);
        prefixEditContainer.node().id = "prefixContainerFor_" + name;

        const IconContainer = prefixEditContainer.append("div");
        IconContainer.classed("icon-container-abs", true);
        IconContainer.node().id = "containerFor_" + name;
        const editButton = IconContainer.append("svg");
        editButton.classed("edit-btn-svg noselect", true);
        editButton.node().id = "editButtonFor_" + name;

        editButton.node().elementStyle = "save";
        editButton.node().selectorName = name;
        const editIcon = editButton.append("g");
        const editRect = editIcon.append("rect");
        const editPath = editIcon.append("path");
        editIcon.node().id = "iconFor_" + name;
        editPath.node().id = "pathFor_" + name;
        editRect.node().id = "rectFor_" + name;

        editIcon.node().selectorName = name;
        editPath.node().selectorName = name;
        editRect.node().selectorName = name;
        IconContainer.node().title = "Save new prefix and IRI";

        editPath.classed("editPrefixIcon edit-path-style", true);
        editRect.attr("width", "14px");
        editRect.attr("height", "14px");
        editRect.classed("edit-rect-style", true);
        editRect.attr("transform", "matrix(1,0,0,1,-3,4)");

        editButton.selectAll("g").on("mouseover", function () {
          highlightEditButton(true, this.selectorName, true);
        });
        editButton.selectAll("g").on("mouseout", function () {
          highlightEditButton(false, this.selectorName, true);
        });
        // Check mark
        // M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z
        // pencil
        // M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z
        editPath.attr(
          "d",
          "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z",
        );
        editPath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");

        const prefInput = prefixEditContainer.append("input");
        prefInput.classed("prefixInput pref-input-style", true);
        prefInput.node().type = "text";
        prefInput.node().id = "prefixInputFor_" + name;
        prefInput.node().autocomplete = "off";
        prefInput.node().value = "";

        const prefURL = prefixEditContainer.append("input");
        prefURL.classed("prefixURL", true);
        prefURL.node().type = "text";
        prefURL.node().id = "prefixURLFor_" + name;
        prefURL.node().autocomplete = "off";
        prefURL.node().value = "";

        prefInput.node().disabled = false;
        prefURL.node().disabled = false;
        prefix_editMode = true;
        const deleteContainer = prefixEditContainer.append("div");
        deleteContainer.classed("delete-container-style", true);
        const deleteButton = deleteContainer.append("svg");
        deleteButton.node().id = "deleteButtonFor_" + name;
        deleteContainer.node().title = "Delete prefix and IRI";
        deleteButton.classed("delete-btn-svg", true);
        const deleteIcon = deleteButton.append("g");
        const deleteRect = deleteIcon.append("rect");
        const deletePath = deleteIcon.append("path");
        deleteIcon.node().id = "del_iconFor_" + name;
        deletePath.node().id = "del_pathFor_" + name;
        deleteRect.node().id = "del_rectFor_" + name;

        deleteIcon.node().selectorName = name;
        deletePath.node().selectorName = name;
        deleteRect.node().selectorName = name;

        deletePath.classed("delete-path-style", true);
        deleteRect.attr("width", "10px");
        deleteRect.attr("height", "14px");
        deleteRect.classed("delete-rect-style", true);
        deleteRect.attr("transform", "matrix(1,0,0,1,-3,4)");

        deletePath.attr(
          "d",
          "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        );
        deletePath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");

        deleteButton.selectAll("g").on("mouseover", function () {
          highlightDeleteButton(true, this.selectorName);
        });
        deleteButton.selectAll("g").on("mouseout", function () {
          highlightDeleteButton(false, this.selectorName);
        });

        // connect the buttons;
        editButton.on("click", enablePrefixEdit);
        deleteButton.on("click", deletePrefixLine);

        editSidebar.updateElementWidth();
        // swap focus to prefixInput
        prefInput.node().focus();
        oldPrefix = name;
        oldPrefixURL = "";
        document.querySelector("#addPrefixButton").innerHTML = "Save Prefix";
      } else {
        enablePrefixEdit(
          document.querySelector("#editButtonFor_emptyPrefixEntry"),
        );
      }
    });
  }

  function setupPrefixList() {
    if (graph.isEditorMode() === false) {
      return;
    }
    const prefixListContainer = d3.select("#prefixURL_Container");
    const prefixElements = graph.options().prefixList();
    for (const name in prefixElements) {
      if (Object.prototype.hasOwnProperty.call(prefixElements, name)) {
        const prefixEditContainer = prefixListContainer.append("div");
        prefixEditContainer.classed("prefixIRIElements", true);
        prefixEditContainer.node().id = "prefixContainerFor_" + name;

        // create edit button which enables the input fields
        const IconContainer = prefixEditContainer.append("div");
        IconContainer.classed("icon-container-abs", true);
        IconContainer.node().id = "containerFor_" + name;
        const editButton = IconContainer.append("svg");
        editButton.classed("edit-btn-svg noselect", true);
        editButton.node().id = "editButtonFor_" + name;
        IconContainer.node().title = "Edit prefix and IRI";
        editButton.node().elementStyle = "save";
        editButton.node().selectorName = name;

        editButton.node().id = "editButtonFor_" + name;
        editButton.node().elementStyle = "edit";
        const editIcon = editButton.append("g");
        const editRect = editIcon.append("rect");
        const editPath = editIcon.append("path");
        editIcon.node().id = "iconFor_" + name;
        editPath.node().id = "pathFor_" + name;
        editRect.node().id = "rectFor_" + name;

        editIcon.node().selectorName = name;
        editPath.node().selectorName = name;
        editRect.node().selectorName = name;

        editPath.classed("editPrefixIcon edit-path-style", true);
        editRect.attr("width", "14px");
        editRect.attr("height", "14px");
        editRect.classed("edit-rect-style", true);
        editRect.attr("transform", "matrix(1,0,0,1,-3,4)");

        editButton.selectAll("g").on("mouseover", function () {
          const sender = this;
          const enable = true;
          const f_editPath = document.querySelector(
            "#pathFor_" + sender.selectorName,
          );
          const f_editRect = document.querySelector(
            "#rectFor_" + sender.selectorName,
          );

          if (enable === false) {
            f_editPath.classList.add("edit-path-style");
            f_editRect.classList.add("non-clickable");
            f_editRect.classList.remove("clickable");
          } else {
            f_editPath.classList.add("edit-path-style");
            f_editRect.classList.add("clickable");
            f_editRect.classList.remove("non-clickable");
          }
        });
        editButton.selectAll("g").on("mouseout", function () {
          const sender = this;
          const enable = false;
          const f_editPath = document.querySelector(
            "#pathFor_" + sender.selectorName,
          );
          const f_editRect = document.querySelector(
            "#rectFor_" + sender.selectorName,
          );

          if (enable === false) {
            f_editPath.classList.add("edit-path-style");
            f_editRect.classList.add("non-clickable");
            f_editRect.classList.remove("clickable");
          } else {
            f_editPath.classList.add("edit-path-style");
            f_editRect.classList.add("clickable");
            f_editRect.classList.remove("non-clickable");
          }
        });

        editPath.attr(
          "d",
          "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        );
        editPath.attr("transform", "matrix(-0.45,0,0,0.45,10,5)");

        // create input field for prefix
        const prefInput = prefixEditContainer.append("input");
        prefInput.classed("prefixInput pref-input-style", true);
        prefInput.node().type = "text";
        prefInput.node().id = "prefixInputFor_" + name;
        prefInput.node().autocomplete = "off";
        prefInput.node().value = name;

        // create input field for prefix url
        const prefURL = prefixEditContainer.append("input");
        prefURL.classed("prefixURL", true);
        prefURL.node().type = "text";
        prefURL.node().id = "prefixURLFor_" + name;
        prefURL.node().autocomplete = "off";
        prefURL.node().value = prefixElements[name];
        prefURL.node().title = prefixElements[name];
        prefInput.node().disabled = true;
        prefURL.node().disabled = true;

        // create the delete button
        const deleteContainer = prefixEditContainer.append("div");
        deleteContainer.classed("delete-container-style", true);
        const deleteButton = deleteContainer.append("svg");
        deleteButton.node().id = "deleteButtonFor_" + name;
        deleteContainer.node().title = "Delete prefix and IRI";
        deleteButton.classed("delete-btn-svg", true);
        const deleteIcon = deleteButton.append("g");
        const deleteRect = deleteIcon.append("rect");
        const deletePath = deleteIcon.append("path");
        deleteIcon.node().id = "del_iconFor_" + name;
        deletePath.node().id = "del_pathFor_" + name;
        deleteRect.node().id = "del_rectFor_" + name;

        deleteIcon.node().selectorName = name;
        deletePath.node().selectorName = name;
        deleteRect.node().selectorName = name;

        deletePath.classed("delete-path-style", true);
        deleteRect.attr("width", "10px");
        deleteRect.attr("height", "14px");
        deleteRect.classed("delete-rect-style", true);
        deleteRect.attr("transform", "matrix(1,0,0,1,-3,4)");

        deletePath.attr(
          "d",
          "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
        );
        deletePath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");

        deleteButton.selectAll("g").on("mouseover", function () {
          const selector = this;
          const enable = true;
          const f_deletePath = document.querySelector(
            "#del_pathFor_" + selector.selectorName,
          );
          const f_deleteRect = document.querySelector(
            "#del_rectFor_" + selector.selectorName,
          );

          if (enable === false) {
            f_deletePath.classList.add("delete-path-style");
            f_deleteRect.classList.add("non-clickable");
            f_deleteRect.classList.remove("clickable");
          } else {
            f_deletePath.classList.add("delete-path-style");
            f_deleteRect.classList.add("clickable");
            f_deleteRect.classList.remove("non-clickable");
          }
        });
        deleteButton.selectAll("g").on("mouseout", function () {
          const selector = this;
          const enable = false;
          const f_deletePath = document.querySelector(
            "#del_pathFor_" + selector.selectorName,
          );
          const f_deleteRect = document.querySelector(
            "#del_rectFor_" + selector.selectorName,
          );

          if (enable === false) {
            f_deletePath.classList.add("delete-path-style");
            f_deleteRect.classList.add("non-clickable");
            f_deleteRect.classList.remove("clickable");
          } else {
            f_deletePath.classList.add("delete-path-style");
            f_deleteRect.classList.add("clickable");
            f_deleteRect.classList.remove("non-clickable");
          }
        });

        editButton.on("click", enablePrefixEdit);
        deleteButton.on("click", deletePrefixLine);

        // EXPERIMENTAL

        if (
          name === "rdf" ||
          name === "rdfs" ||
          name === "xsd" ||
          name === "dc" ||
          name === "owl"
        ) {
          // make them invis so the spacing does not change
          IconContainer.classed("hidden", true);
          deleteContainer.classed("hidden", true);
        }
      }
    }
    prefixModule.updatePrefixModel();
  }

  function deletePrefixLine() {
    if (this.disabled === true) {
      return;
    }
    document.querySelector("#addPrefixButton").innerHTML = "Add Prefix";
    const selector = this.id.split("_")[1];
    document.querySelector("#prefixContainerFor_" + selector).remove();
    graph.options().removePrefix(selector);
    prefix_editMode = false; // <<TODO make some sanity checks
    prefixModule.updatePrefixModel();
  }

  function enablePrefixEdit(item) {
    let agent = this;
    if (item && !(item instanceof Event) && item.id) {
      agent = item;
    }
    if (!agent || agent.disabled === true || !agent.id) {
      return;
    }
    const selector = agent.id.split("_")[1];
    const stl = agent.elementStyle;
    if (stl === "edit") {
      document.querySelector("#prefixInputFor_" + selector).disabled = false;
      document.querySelector("#prefixURLFor_" + selector).disabled = false;
      // change the button content
      //  this.innerHTML = "\u2714";
      agent.elementStyle = "save";
      oldPrefix = document.querySelector("#prefixInputFor_" + selector).value;
      oldPrefixURL = document.querySelector("#prefixURLFor_" + selector).value;
      prefix_editMode = true;
      if (document.querySelector("#containerFor_" + selector)) {
        document.querySelector("#containerFor_" + selector).title =
          "Save new prefix and IRI";
      }

      agent.querySelectorAll("g").forEach(function (g) {
        g.addEventListener("mouseover", function () {
          highlightEditButton(true, agent.selectorName, true);
        });
        g.addEventListener("mouseout", function () {
          highlightEditButton(false, agent.selectorName, true);
        });
      });

      const editPath = document.querySelector("#pathFor_" + agent.selectorName);
      editPath.setAttribute(
        "d",
        "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z",
      );
      editPath.setAttribute("transform", "matrix(0.45,0,0,0.45,0,5)");

      highlightEditButton(true, agent.selectorName, true);
    }
    if (stl === "save") {
      const newPrefixURL = document.querySelector(
        "#prefixURLFor_" + selector,
      ).value;
      const newPrefix = document.querySelector(
        "#prefixInputFor_" + selector,
      ).value;

      if (
        graph
          .options()
          .updatePrefix(oldPrefix, newPrefix, oldPrefixURL, newPrefixURL) ===
        true
      ) {
        document.querySelector("#prefixInputFor_" + newPrefix).disabled = true;
        document.querySelector("#prefixURLFor_" + newPrefix).disabled = true;
        document.querySelector("#addPrefixButton").innerHTML = "Add Prefix";
        if (document.querySelector("#containerFor_" + selector)) {
          document.querySelector("#containerFor_" + selector).title =
            "Edit prefix and IRI";
        }

        // change the button content

        agent.elementStyle = "edit";
        prefix_editMode = false;
        prefixModule.updatePrefixModel();
        agent.querySelectorAll("g").forEach(function (g) {
          g.addEventListener("mouseover", function () {
            highlightEditButton(true, agent.selectorName, false);
          });
          g.addEventListener("mouseout", function () {
            highlightEditButton(false, agent.selectorName, false);
          });
        });

        const savePath = document.querySelector(
          "#pathFor_" + agent.selectorName,
        );
        savePath.setAttribute(
          "d",
          "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
        );
        savePath.setAttribute("transform", "matrix(-0.45,0,0,0.45,10,5)");
        highlightEditButton(true, agent.selectorName, false);
      }
    }
  }

  function changeDatatypeType(element) {
    const datatypeEditorSelection = document.querySelector(
      "#typeEditor_datatype",
    );
    const givenName = datatypeEditorSelection.value;
    const prefix = givenName.includes(":") ? givenName.split(":")[0] : "";
    let identifier = givenName.includes(":")
      ? givenName.split(":")[1]
      : givenName;

    let baseNs = "http://www.w3.org/2001/XMLSchema#";
    if (prefix === "owl") {
      baseNs = "http://www.w3.org/2002/07/owl#";
    } else if (prefix === "rdfs") {
      baseNs = "http://www.w3.org/2000/01/rdf-schema#";
    }

    if (datatypeEditorSelection.value !== "undefined") {
      document.querySelector("#element_iriEditor").disabled = true;
      document.querySelector("#element_labelEditor").disabled = true;
    } else {
      identifier = "undefined";
      document.querySelector("#element_iriEditor").disabled = false;
      document.querySelector("#element_labelEditor").disabled = false;
    }
    element.label(identifier);
    element.dType(givenName);
    element.iri(baseNs + identifier);
    element.baseIri(baseNs);
    element.redrawLabelText();

    document.querySelector("#element_iriEditor").value =
      element.title() || element.iri();
    document.querySelector("#element_iriEditor").title = element.iri();
    document.querySelector("#element_labelEditor").value =
      element.labelForCurrentLanguage();
  }

  function identifyExternalCharacteristicForElement(ontoIRI, elementIRI) {
    return elementIRI.indexOf(ontoIRI) === -1;
  }

  function defaultIriValue(element) {
    // get the iri of that element;
    if (graph.options().getGeneralMetaObject().iri) {
      const str2Compare =
        graph.options().getGeneralMetaObject().iri + element.id();
      return element.iri() === str2Compare;
    }
    return false;
  }

  function getURLFROMPrefixedVersion(element) {
    let url = document.querySelector("#element_iriEditor").value;
    const base = graph.options().getGeneralMetaObjectProperty("iri");
    if (validURL(url) === false) {
      // make better usability
      // try to split element;
      const tokens = url.split(":");

      //console.warn("try to split the input into prefix:name")
      console.warn("Tokens");
      console.warn(tokens);
      console.warn("---------------");
      // TODO MORE VALIDATION TESTS
      if (tokens.length === 2) {
        const pr = tokens[0];
        const name = tokens[1];
        if (pr.length > 0) {
          const basePref = graph.options().prefixList()[pr];
          if (basePref === undefined) {
            console.warn("ERROR __________________");
            graph
              .options()
              .warningModule()
              .showWarning(
                "Invalid Element IRI",
                "Could not resolve prefix '" + basePref + "'",
                "Restoring previous IRI for Element" + element.iri(),
                1,
                false,
              );
            document.querySelector("#element_iriEditor").value = element.iri();
            return;
          }
          // check if url is not empty

          if (name.length === 0) {
            graph
              .options()
              .warningModule()
              .showWarning(
                "Invalid Element IRI",
                "Input IRI is EMPTY",
                "Restoring previous IRI for Element" + element.iri(),
                1,
                false,
              );
            console.warn("NO INPUT PROVIDED");
            document.querySelector("#element_iriEditor").value = element.iri();
            return;
          }
          url = basePref + name;
        } else {
          url = base + name;
        }
      } else {
        if (url.length === 0) {
          //
          console.warn("NO INPUT PROVIDED");
          document.querySelector("#element_iriEditor").value = element.iri();
          return;
        }
        // failed to identify anything useful
        console.warn("Tryig to use the input!");
        url = base + url;
      }
    }
    return url;
  }

  function changeIriForElement(element) {
    const url = getURLFROMPrefixedVersion(element);
    const base = graph.options().getGeneralMetaObjectProperty("iri");
    let sanityCheckResult;
    if (elementTools.isNode(element)) {
      sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
      if (sanityCheckResult === false) {
        element.iri(url);
      } else {
        // throw warnign
        graph
          .options()
          .warningModule()
          .showWarning(
            "Already seen this class",
            "Input IRI: " +
              url +
              " for element: " +
              element.labelForCurrentLanguage() +
              " already been set",
            "Restoring previous IRI for Element : " + element.iri(),
            2,
            false,
            sanityCheckResult,
          );

        editSidebar.updateSelectionInformation(element);
        return;
      }
    }
    if (elementTools.isProperty(element) === true) {
      sanityCheckResult = editSidebar.checkProperIriChange(element, url);
      if (sanityCheckResult !== false) {
        graph
          .options()
          .warningModule()
          .showWarning(
            "Already seen this property",
            "Input IRI: " +
              url +
              " for element: " +
              element.labelForCurrentLanguage() +
              " already been set",
            "Restoring previous IRI for Element : " + element.iri(),
            1,
            false,
            sanityCheckResult,
          );

        editSidebar.updateSelectionInformation(element);
        return;
      }
    }

    // if (element.existingPropertyIRI(url)===true){
    //     console.warn("I Have seen this Particular URL already "+url);
    //     graph.options().warningModule().showWarning("Already Seen This one ",
    //         "Input IRI For Element"+ element.labelForCurrentLanguage()+" already been set  ",
    //         "Restoring previous IRI for Element"+element.iri(),1,false);
    //     document.querySelector("#element_iriEditor").value =
    graph
      .options()
      .prefixModule()
      .getPrefixRepresentationForFullURI(element.iri());
    //     editSidebar.updateSelectionInformation(element);
    //     return;
    // }

    element.iri(url);
    if (identifyExternalCharacteristicForElement(base, url) === true) {
      addAttribute(element, "external");
      // background color for external element;
      element.backgroundColor("#36C");
      element.redrawElement();
      element.redrawLabelText();
      // handle visual selection
    } else {
      removeAttribute(element, "external");
      // background color for external element;
      element.backgroundColor(undefined);
      element.redrawElement();
      element.redrawLabelText();
    }

    if (element.focused()) {
      graph.options().focuserModule().handle(element, true); // unfocus
      graph.options().focuserModule().handle(element, true); // focus
    }
    // graph.options().focuserModule().handle(undefined);

    document.querySelector("#element_iriEditor").value =
      prefixModule.getPrefixRepresentationForFullURI(url);
    editSidebar.updateSelectionInformation(element);
  }

  function validURL(str) {
    const urlregex =
      /^(https?|ftp):\/\/([a-zA-Z0-9.-]+(:[a-zA-Z0-9.&%$-]+)*@)*((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}|([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.(com|edu|gov|int|mil|net|org|biz|arpa|info|name|pro|aero|coop|museum|[a-zA-Z]{2}))(:[0-9]+)*(\/($|[a-zA-Z0-9.,?'\\+&%$#=~_-]+))*$/;
    return urlregex.test(str);
  }

  function changeLabelForElement(element) {
    element.label(document.querySelector("#element_labelEditor").value);
    element.redrawLabelText();
    graph.dispatchEvent(new CustomEvent("dictionarychange"));
  }

  editSidebar.updateEditDeleteButtonIds = function (oldPrefix, newPrefix) {
    document.querySelector("#prefixInputFor_" + oldPrefix).id =
      "prefixInputFor_" + newPrefix;
    document.querySelector("#prefixURLFor_" + oldPrefix).id =
      "prefixURLFor_" + newPrefix;
    document.querySelector("#deleteButtonFor_" + oldPrefix).id =
      "deleteButtonFor_" + newPrefix;
    document.querySelector("#editButtonFor_" + oldPrefix).id =
      "editButtonFor_" + newPrefix;

    document.querySelector("#prefixContainerFor_" + oldPrefix).id =
      "prefixContainerFor_" + newPrefix;
  };

  editSidebar.checkForExistingURL = function (url) {
    let i;
    const allProps = graph.getUnfilteredData().properties;
    for (i = 0; i < allProps.length; i++) {
      if (allProps[i].iri() === url) {
        return true;
      }
    }
    return false;
  };
  editSidebar.checkProperIriChange = function (element, url) {
    console.warn("Element changed Label");
    console.warn("Testing URL " + url);
    if (
      element.type() === "rdfs:subClassOf" ||
      element.type() === "owl:disjointWith"
    ) {
      console.warn(
        "ignore this for now, already handled in the type and domain range changer",
      );
    } else {
      let i;
      const allProps = graph.getUnfilteredData().properties;
      for (i = 0; i < allProps.length; i++) {
        if (allProps[i] === element) {
          continue;
        }
        if (allProps[i].iri() === url) {
          return allProps[i];
        }
      }
    }
    return false;
  };

  editSidebar.updateSelectionInformation = function (element) {
    if (element === undefined) {
      document
        .querySelector("#selectedElementProperties")
        .classList.add("hidden");
      document
        .querySelector("#selectedElementPropertiesEmptyHint")
        .classList.remove("hidden");
      selectedElementForCharacteristics = null;
      editSidebar.updateElementWidth();
    } else {
      document
        .querySelector("#selectedElementProperties")
        .classList.remove("hidden");
      document
        .querySelector("#selectedElementPropertiesEmptyHint")
        .classList.add("hidden");
      document.querySelector("#typeEditForm_datatype").classList.add("hidden");

      // set the element IRI, and labels
      document.querySelector("#element_iriEditor").value = element.iri();
      document.querySelector("#element_labelEditor").value =
        element.labelForCurrentLanguage();
      document.querySelector("#element_iriEditor").title = element.iri();

      document
        .querySelector("#element_iriEditor")
        .addEventListener("change", function () {
          const elementIRI = element.iri();
          const prefixed = graph
            .options()
            .prefixModule()
            .getPrefixRepresentationForFullURI(elementIRI);
          if (prefixed === document.querySelector("#element_iriEditor").value) {
            console.warn("Iri is identical, nothing has changed!");
            return;
          }

          changeIriForElement(element);
        });
      document
        .querySelector("#element_iriEditor")
        .addEventListener("keydown", function (event) {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            console.warn("IRI CHANGED Via ENTER pressed");
            changeIriForElement(element);
            document.querySelector("#element_iriEditor").title = element.iri();
          }
        });

      const forceIRISync = defaultIriValue(element);
      document
        .querySelector("#element_labelEditor")
        .addEventListener("change", function () {
          let sanityCheckResult;
          console.warn("Element changed Label");
          const url = getURLFROMPrefixedVersion(element);
          if (element.iri() !== url) {
            if (elementTools.isProperty(element) === true) {
              sanityCheckResult = editSidebar.checkProperIriChange(
                element,
                url,
              );
              if (sanityCheckResult !== false) {
                graph
                  .options()
                  .warningModule()
                  .showWarning(
                    "Already seen this property",
                    "Input IRI: " +
                      url +
                      " for element: " +
                      element.labelForCurrentLanguage() +
                      " already been set",
                    "Continuing with duplicate property!",
                    1,
                    false,
                    sanityCheckResult,
                  );
                editSidebar.updateSelectionInformation(element);
                return;
              }
            }

            if (elementTools.isNode(element) === true) {
              sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
              if (sanityCheckResult !== false) {
                graph
                  .options()
                  .warningModule()
                  .showWarning(
                    "Already seen this Class",
                    "Input IRI: " +
                      url +
                      " for element: " +
                      element.labelForCurrentLanguage() +
                      " already been set",
                    "Restoring previous IRI for Element : " + element.iri(),
                    2,
                    false,
                    sanityCheckResult,
                  );

                editSidebar.updateSelectionInformation(element);
                return;
              }
            }
            element.iri(url);
          }
          changeLabelForElement(element);
          editSidebar.updateSelectionInformation(element); // prevents that it will be changed if node is still active
        });
      document
        .querySelector("#element_labelEditor")
        .addEventListener("keydown", function (event) {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            let sanityCheckResult;
            console.warn("Element changed Label");
            const url = getURLFROMPrefixedVersion(element);
            if (element.iri() !== url) {
              if (elementTools.isProperty(element) === true) {
                sanityCheckResult = editSidebar.checkProperIriChange(
                  element,
                  url,
                );
                if (sanityCheckResult !== false) {
                  graph
                    .options()
                    .warningModule()
                    .showWarning(
                      "Already seen this property",
                      "Input IRI: " +
                        url +
                        " for element: " +
                        element.labelForCurrentLanguage() +
                        " already been set",
                      "Continuing with duplicate property!",
                      1,
                      false,
                      sanityCheckResult,
                    );

                  editSidebar.updateSelectionInformation(element);
                  return;
                }
              }

              if (elementTools.isNode(element) === true) {
                sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
                if (sanityCheckResult !== false) {
                  graph
                    .options()
                    .warningModule()
                    .showWarning(
                      "Already seen this Class",
                      "Input IRI: " +
                        url +
                        " for element: " +
                        element.labelForCurrentLanguage() +
                        " already been set",
                      "Restoring previous IRI for Element : " + element.iri(),
                      2,
                      false,
                      sanityCheckResult,
                    );

                  editSidebar.updateSelectionInformation(element);
                  return;
                }
              }
              element.iri(url);
            }
            changeLabelForElement(element);
          }
        });
      document
        .querySelector("#element_labelEditor")
        .addEventListener("keyup", function () {
          if (forceIRISync) {
            const labelName = document.querySelector(
              "#element_labelEditor",
            ).value;
            const resourceName = labelName.replaceAll(" ", "_");
            const syncedIRI = element.baseIri() + resourceName;

            //element.iri(syncedIRI);
            document.querySelector("#element_iriEditor").title = element.iri();
            document.querySelector("#element_iriEditor").value =
              prefixModule.getPrefixRepresentationForFullURI(syncedIRI);
          }
        });
      // check if we are allowed to change IRI OR LABEL
      document.querySelector("#element_iriEditor").disabled = false;
      document.querySelector("#element_labelEditor").disabled = false;

      if (element.type() === "rdfs:subClassOf") {
        document.querySelector("#element_iriEditor").value =
          "http://www.w3.org/2000/01/rdf-schema#subClassOf";
        document.querySelector("#element_iriEditor").title =
          "http://www.w3.org/2000/01/rdf-schema#subClassOf";
        document.querySelector("#element_labelEditor").value = "Subclass of";
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;
      }
      if (element.type() === "owl:Thing") {
        document.querySelector("#element_iriEditor").value =
          "http://www.w3.org/2002/07/owl#Thing";
        document.querySelector("#element_iriEditor").title =
          "http://www.w3.org/2002/07/owl#Thing";
        document.querySelector("#element_labelEditor").value = "Thing";
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;
      }

      if (element.type() === "owl:disjointWith") {
        document.querySelector("#element_iriEditor").value =
          "http://www.w3.org/2002/07/owl#disjointWith";
        document.querySelector("#element_iriEditor").title =
          "http://www.w3.org/2002/07/owl#disjointWith";
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;
      }

      if (element.type() === "rdfs:Literal") {
        document.querySelector("#element_iriEditor").value =
          "http://www.w3.org/2000/01/rdf-schema#Literal";
        document.querySelector("#element_iriEditor").title =
          "http://www.w3.org/2000/01/rdf-schema#Literal";
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;
        element.iri("http://www.w3.org/2000/01/rdf-schema#Literal");
      }

      if (element.type() === "rdfs:Datatype") {
        const datatypeEditorSelection = document.querySelector(
          "#typeEditor_datatype",
        );
        document
          .querySelector("#typeEditForm_datatype")
          .classList.remove("hidden");
        element.iri("http://www.w3.org/2000/01/rdf-schema#Datatype");

        document.querySelector("#element_iriEditor").value =
          "http://www.w3.org/2000/01/rdf-schema#Datatype";
        document.querySelector("#element_iriEditor").title =
          "http://www.w3.org/2000/01/rdf-schema#Datatype";
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;

        datatypeEditorSelection.value = element.dType();
        if (datatypeEditorSelection.value === "undefined") {
          document.querySelector("#element_iriEditor").disabled = true; // always prevent IRI modifications
          document.querySelector("#element_labelEditor").disabled = false;
        }
        // reconnect the element
        datatypeEditorSelection.addEventListener("change", function () {
          changeDatatypeType(element);
        });
      }

      // add type selector
      const typeEditorSelection = document.querySelector("#typeEditor");
      const htmlCollection = typeEditorSelection.children;
      const numEntries = htmlCollection.length;
      let i;
      const elementPrototypes = getElementPrototypes(element);
      for (i = 0; i < numEntries; i++) {
        typeEditorSelection.removeChild(htmlCollection[0]);
      }

      for (i = 0; i < elementPrototypes.length; i++) {
        const optA = document.createElement("option");
        optA.innerHTML = elementPrototypes[i];
        typeEditorSelection.appendChild(optA);
      }
      // set the proper value in the selection
      typeEditorSelection.value = element.type();
      document
        .querySelector("#typeEditor")
        .addEventListener("change", function () {
          elementTypeSelectionChanged(element);
        });

      // add characteristics selection
      const needChar = elementNeedsCharacteristics(element);
      if (!needChar) {
        document
          .querySelector("#property_characteristics_Container")
          .classList.add("hidden");
      } else {
        document
          .querySelector("#property_characteristics_Container")
          .classList.remove("hidden");
      }
      if (needChar === true) {
        addElementsCharacteristics(element);
      }
      const fullURI = document.querySelector("#element_iriEditor").value;
      document.querySelector("#element_iriEditor").value =
        prefixModule.getPrefixRepresentationForFullURI(fullURI);
      document.querySelector("#element_iriEditor").title = fullURI;
      editSidebar.updateElementWidth();
    }
  };

  editSidebar.updateGeneralOntologyInfo = function () {
    const preferredLanguage = graph && graph.language ? graph.language() : null;

    // get it from graph.options
    const generalMetaObj = graph.options().getGeneralMetaObject();
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "title")) {
      // title has language to it -.-
      if (typeof generalMetaObj.title === "object") {
        document.querySelector("#titleEditor").value =
          languageTools.textInLanguage(generalMetaObj.title, preferredLanguage);
      } else {
        document.querySelector("#titleEditor").value = generalMetaObj.title;
      }
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "iri")) {
      document.querySelector("#iriEditor").value = generalMetaObj.iri;
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "version")) {
      document.querySelector("#versionEditor").value = generalMetaObj.version;
    }
    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "author")) {
      document.querySelector("#authorsEditor").value = generalMetaObj.author;
    }

    if (Object.prototype.hasOwnProperty.call(generalMetaObj, "description")) {
      if (typeof generalMetaObj.description === "object") {
        document.querySelector("#descriptionEditor").value =
          languageTools.textInLanguage(
            generalMetaObj.description,
            preferredLanguage,
          );
      } else {
        document.querySelector("#descriptionEditor").value =
          generalMetaObj.description;
      }
    } else {
      document.querySelector("#descriptionEditor").value = "No Description";
    }
  };

  editSidebar.updateElementWidth = function () {};

  function addElementsCharacteristics(element) {
    // save selected element for checkbox handler
    selectedElementForCharacteristics = element;
    let i;
    // KILL old elements
    const charSelectionNode = document.querySelector(
      "#property_characteristics_Selection",
    );
    while (charSelectionNode.firstChild) {
      charSelectionNode.removeChild(charSelectionNode.firstChild);
    }
    // datatypes kind of ignored by the elementsNeedCharacteristics function
    // so we need to check if we are a node or not
    if (element.attributes().indexOf("external") > -1) {
      // add external span to the div;
      const externalCharSpan = document.createElement("span");
      externalCharSpan.classList.add("spanForCharSelection");
      externalCharSpan.innerHTML = "external";
      charSelectionNode.appendChild(externalCharSpan);
    }
    let filterContainer, filterCheckbox, filterLabel;
    if (elementTools.isNode(element) === true) {
      // add the deprecated characteristic;
      const arrayOfNodeChars = ["deprecated"];
      for (i = 0; i < arrayOfNodeChars.length; i++) {
        filterContainer = document.createElement("div");
        filterContainer.classList.add("checkboxContainer", "warning-row");

        filterCheckbox = document.createElement("input");
        filterCheckbox.classList.add("filterCheckbox");
        filterCheckbox.id = "CharacteristicsCheckbox" + i;
        filterCheckbox.type = "checkbox";
        filterCheckbox.setAttribute("characteristics", arrayOfNodeChars[i]);
        filterCheckbox.checked = getPresentAttribute(
          element,
          arrayOfNodeChars[i],
        );

        filterLabel = document.createElement("label");
        filterLabel.setAttribute("for", "CharacteristicsCheckbox" + i);
        filterLabel.textContent = arrayOfNodeChars[i];

        filterContainer.appendChild(filterCheckbox);
        filterContainer.appendChild(filterLabel);
        charSelectionNode.appendChild(filterContainer);

        filterCheckbox.addEventListener("click", handleCheckBoxClick);
      }
    } else {
      // add the deprecated characteristic;
      let arrayOfPropertyChars = [
        "deprecated",
        "inverse functional",
        "functional",
        "transitive",
      ];
      if (elementTools.isDatatypeProperty(element) === true) {
        arrayOfPropertyChars = ["deprecated", "functional"];
      }
      for (i = 0; i < arrayOfPropertyChars.length; i++) {
        filterContainer = document.createElement("div");
        filterContainer.classList.add("checkboxContainer", "warning-row");

        filterCheckbox = document.createElement("input");
        filterCheckbox.classList.add("filterCheckbox");
        filterCheckbox.id = "CharacteristicsCheckbox" + i;
        filterCheckbox.type = "checkbox";
        filterCheckbox.setAttribute("characteristics", arrayOfPropertyChars[i]);
        filterCheckbox.checked = getPresentAttribute(
          element,
          arrayOfPropertyChars[i],
        );

        filterLabel = document.createElement("label");
        filterLabel.setAttribute("for", "CharacteristicsCheckbox" + i);
        filterLabel.textContent = arrayOfPropertyChars[i];

        filterContainer.appendChild(filterCheckbox);
        filterContainer.appendChild(filterLabel);
        charSelectionNode.appendChild(filterContainer);

        filterCheckbox.addEventListener("click", handleCheckBoxClick);
      }
    }
  }

  function getPresentAttribute(selectedElement, element) {
    return selectedElement.attributes().indexOf(element) >= 0;
  }

  function handleCheckBoxClick() {
    const checked = this.checked;
    const char = this.getAttribute("characteristics");
    if (checked === true) {
      addAttribute(selectedElementForCharacteristics, char);
    } else {
      removeAttribute(selectedElementForCharacteristics, char);
    }
    // graph.executeColorExternalsModule();
    selectedElementForCharacteristics.redrawElement();
    // workaround to have the node still be focused as rendering element
    selectedElementForCharacteristics.focused(false);
    selectedElementForCharacteristics.toggleFocus();
  }

  function addAttribute(selectedElement, char) {
    if (selectedElement.attributes().indexOf(char) === -1) {
      // not found add it
      const attr = selectedElement.attributes();
      attr.push(char);
      selectedElement.attributes(attr);
    } // indications string update;
    if (selectedElement.indications().indexOf(char) === -1) {
      const indications = selectedElement.indications();
      indications.push(char);
      selectedElement.indications(indications);
    }
    // add visual attributes
    let visAttr;
    if (selectedElement.visualAttributes().indexOf(char) === -1) {
      visAttr = selectedElement.visualAttributes();
      visAttr.push(char);
      selectedElement.visualAttributes(visAttr);
    }
    if (
      getPresentAttribute(selectedElement, "external") &&
      getPresentAttribute(selectedElement, "deprecated")
    ) {
      visAttr = selectedElement.visualAttributes();
      const visInd = visAttr.indexOf("external");
      if (visInd > -1) {
        visAttr.splice(visInd, 1);
      }
      selectedElement.visualAttributes(visAttr);
    }
  }

  function removeAttribute(selectedElement, element) {
    const attr = selectedElement.attributes();
    const indications = selectedElement.indications();
    const visAttr = selectedElement.visualAttributes();
    const attrInd = attr.indexOf(element);
    if (attrInd >= 0) {
      attr.splice(attrInd, 1);
    }
    const indInd = indications.indexOf(element);
    if (indInd > -1) {
      indications.splice(indInd, 1);
    }
    const visInd = visAttr.indexOf(element);
    if (visInd > -1) {
      visAttr.splice(visInd, 1);
    }
    selectedElement.attributes(attr);
    selectedElement.indications(indications);
    selectedElement.visualAttributes(visAttr);
    if (element === "deprecated") {
      // set its to its original Style
      //typeBaseThign
      // todo : fix all different types
      if (selectedElement.type() === "owl:Class") {
        selectedElement.styleClass("class");
      }
      if (selectedElement.type() === "owl:DatatypeProperty") {
        selectedElement.styleClass("datatypeproperty");
      }
      if (selectedElement.type() === "owl:ObjectProperty") {
        selectedElement.styleClass("objectproperty");
      }
      if (selectedElement.type() === "owl:disjointWith") {
        selectedElement.styleClass("disjointwith");
      }
    }
  }

  function elementNeedsCharacteristics(element) {
    //TODO: Add more types
    if (
      element.type() === "owl:Thing" ||
      element.type() === "rdfs:subClassOf" ||
      element.type() === "rdfs:Literal" ||
      element.type() === "rdfs:Datatype" ||
      element.type() === "rdfs:disjointWith"
    ) {
      return false;
    }

    // if (element.attributes().indexOf("external")||
    //     element.attributes().indexOf("deprecated"))
    //     return true;
    return true;
  }

  function elementTypeSelectionChanged(element) {
    const typeString = document.querySelector("#typeEditor").value;
    if (elementTools.isNode(element)) {
      if (graph.changeNodeType(element, typeString) === false) {
        //restore old value
        editSidebar.updateSelectionInformation(element);
      }
    }

    if (elementTools.isProperty(element)) {
      if (graph.changePropertyType(element, typeString) === false) {
        //restore old value
        editSidebar.updateSelectionInformation(element);
      }
    }
  }

  function getElementPrototypes(selectedElement) {
    const availiblePrototypes = [];
    // TODO the text should be also complied with the prefixes loaded into the ontology
    if (elementTools.isProperty(selectedElement)) {
      if (selectedElement.type() === "owl:DatatypeProperty") {
        availiblePrototypes.push("owl:DatatypeProperty");
      } else {
        availiblePrototypes.push("owl:ObjectProperty");
        // handling loops !
        if (selectedElement.domain() !== selectedElement.range()) {
          availiblePrototypes.push("rdfs:subClassOf");
        }
        availiblePrototypes.push("owl:disjointWith");
        availiblePrototypes.push("owl:allValuesFrom");
        availiblePrototypes.push("owl:someValuesFrom");
      }
      return availiblePrototypes;
    }
    if (selectedElement.renderType() === "rect") {
      availiblePrototypes.push("rdfs:Literal");
      availiblePrototypes.push("rdfs:Datatype");
    } else {
      availiblePrototypes.push("owl:Class");
      availiblePrototypes.push("owl:Thing");
      //  TODO: ADD MORE TYPES
      // availiblePrototypes.push("owl:complementOf");
      // availiblePrototypes.push("owl:disjointUnionOf");
    }
    return availiblePrototypes;
  }

  function setupCollapsing() {
    // TODO : Decision , for now I want to have the control over the collapse expand operation of the
    // TODO : elements, otherwise the old approach will also randomly collapse other containers

    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    function collapseContainers(container) {
      container.classList.add("hidden");
    }

    function expandContainers(container) {
      container.classList.remove("hidden");
    }

    const triggers = document.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      trigger.addEventListener("keydown", function (event) {
        const evt = event || window.event;
        if (evt && (evt.key === "Enter" || evt.key === " ")) {
          evt.preventDefault();
          this.click();
        }
      });

      trigger.addEventListener("click", function () {
        if (this.classList.contains("accordion-trigger-active")) {
          // Collapse the active (which is also the selected) trigger
          collapseContainers(this.nextElementSibling);
          this.classList.remove("accordion-trigger-active");
        } else {
          // Collapse the other trigger ...
          // collapseContainers(document.querySelectorAll(".accordion-trigger-active + div"));

          // ... and expand the selected one
          expandContainers(this.nextElementSibling);
          this.classList.add("accordion-trigger-active");
        }
        editSidebar.updateElementWidth();
      });
    });
  }

  return editSidebar;
};
