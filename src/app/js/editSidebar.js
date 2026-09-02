/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
export function createEditSidebar(
  graph,
  { elementTools, languageTools, prefixModule },
) {
  const editSidebar = {};
  const lifecycleAbortController = new AbortController();
  let prefixControlsAbortController = new AbortController();
  let selectionControlsAbortController = new AbortController();
  let selectedElementForCharacteristics;
  let previousPrefixName;
  let previousPrefixNamespaceIri;
  let isPrefixEditMode = false;
  let isSetup = false;

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
    prefixControlsAbortController.abort();
    prefixControlsAbortController = new AbortController();
    document.querySelector("#prefixURL_Container").replaceChildren();
    setupPrefixList();
  };

  editSidebar.setup = function () {
    if (isSetup) {
      return;
    }
    isSetup = true;
    setupCollapsing();
    setupPrefixList();
    setupAddPrefixButton();
    setupSupportedDatatypes();

    document.querySelector("#titleEditor").addEventListener(
      "change",
      function () {
        graph
          .ontologyEditingState()
          .addOrUpdateGeneralObjectEntry(
            "title",
            document.querySelector("#titleEditor").value,
          );
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#titleEditor").addEventListener(
      "keydown",
      function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry(
              "title",
              document.querySelector("#titleEditor").value,
            );
        }
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#iriEditor").addEventListener(
      "change",
      function () {
        if (
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry(
              "iri",
              document.querySelector("#iriEditor").value,
            ) === false
        ) {
          // restore value
          document.querySelector("#iriEditor").value = graph
            .ontologyEditingState()
            .getGeneralMetaObjectProperty("iri");
        }
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#iriEditor").addEventListener(
      "keydown",
      function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          if (
            graph
              .ontologyEditingState()
              .addOrUpdateGeneralObjectEntry(
                "iri",
                document.querySelector("#iriEditor").value,
              ) === false
          ) {
            // restore value
            document.querySelector("#iriEditor").value = graph
              .ontologyEditingState()
              .getGeneralMetaObjectProperty("iri");
          }
        }
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#versionEditor").addEventListener(
      "change",
      function () {
        graph
          .ontologyEditingState()
          .addOrUpdateGeneralObjectEntry(
            "version",
            document.querySelector("#versionEditor").value,
          );
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#versionEditor").addEventListener(
      "keydown",
      function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry(
              "version",
              document.querySelector("#versionEditor").value,
            );
        }
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#authorsEditor").addEventListener(
      "change",
      function () {
        graph
          .ontologyEditingState()
          .addOrUpdateGeneralObjectEntry(
            "author",
            document.querySelector("#authorsEditor").value,
          );
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#authorsEditor").addEventListener(
      "keydown",
      function (event) {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry(
              "author",
              document.querySelector("#authorsEditor").value,
            );
        }
      },
      { signal: lifecycleAbortController.signal },
    );
    document.querySelector("#descriptionEditor").addEventListener(
      "change",
      function () {
        graph
          .ontologyEditingState()
          .addOrUpdateGeneralObjectEntry(
            "description",
            document.querySelector("#descriptionEditor").value,
          );
      },
      { signal: lifecycleAbortController.signal },
    );

    editSidebar.updateElementWidth();
  };

  function setupSupportedDatatypes() {
    const datatypeEditorSelection = document.querySelector(
      "#typeEditor_datatype",
    );
    const supportedDatatypes = graph
      .ontologyEditingState()
      .supportedDatatypes()
      .filter((datatypeName) => datatypeName !== "rdfs:Literal");
    for (const supportedDatatype of supportedDatatypes) {
      const datatypeOption = document.createElement("option");
      datatypeOption.textContent = supportedDatatype;
      datatypeEditorSelection.appendChild(datatypeOption);
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

  const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";
  const PROTECTED_PREFIX_NAMES = new Set(["rdf", "rdfs", "xsd", "dc", "owl"]);
  const PREFIX_EDITOR_ICON_PATHS = Object.freeze({
    edit: {
      pathData:
        "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z",
      transform: "matrix(-0.45,0,0,0.45,10,5)",
    },
    save: {
      pathData: "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z",
      transform: "matrix(0.45,0,0,0.45,0,5)",
    },
  });

  function setPrefixEditorAction(editButton, prefixEditorAction) {
    editButton.prefixEditorAction = prefixEditorAction;
    const iconPresentation = PREFIX_EDITOR_ICON_PATHS[prefixEditorAction];
    editButton.prefixEditorIconPath.setAttribute(
      "d",
      iconPresentation.pathData,
    );
    editButton.prefixEditorIconPath.setAttribute(
      "transform",
      iconPresentation.transform,
    );
  }

  function isKeyboardActivationEvent(event) {
    return event.key === "Enter" || event.key === " ";
  }

  function activatePrefixEditorControlFromKeyboard(event) {
    if (isKeyboardActivationEvent(event)) {
      event.preventDefault();
      enablePrefixEdit(event.currentTarget);
    }
  }

  function activatePrefixDeleteControlFromKeyboard(event) {
    if (isKeyboardActivationEvent(event)) {
      event.preventDefault();
      deletePrefixLine(event.currentTarget);
    }
  }

  function appendPrefixEditorRow({ isNewPrefix, namespaceIri, prefixName }) {
    const prefixListContainer = document.querySelector("#prefixURL_Container");
    const prefixEditorRow = document.createElement("div");
    prefixEditorRow.classList.add("prefixIRIElements");
    prefixEditorRow.id = "prefixContainerFor_" + prefixName;
    prefixListContainer.appendChild(prefixEditorRow);

    const editControlContainer = document.createElement("div");
    editControlContainer.classList.add("icon-container-abs");
    editControlContainer.id = "containerFor_" + prefixName;
    editControlContainer.title = isNewPrefix
      ? "Save new prefix and IRI"
      : "Edit prefix and IRI";
    prefixEditorRow.appendChild(editControlContainer);

    const editButton = document.createElementNS(SVG_NAMESPACE_IRI, "svg");
    editButton.classList.add("edit-btn-svg", "noselect");
    editButton.id = "editButtonFor_" + prefixName;
    editButton.prefixName = prefixName;
    editButton.setAttribute("role", "button");
    editButton.setAttribute("tabindex", "0");
    editButton.setAttribute(
      "aria-label",
      isNewPrefix ? "Save prefix" : "Edit prefix",
    );
    editControlContainer.appendChild(editButton);

    const editIcon = document.createElementNS(SVG_NAMESPACE_IRI, "g");
    editIcon.id = "iconFor_" + prefixName;
    editIcon.prefixName = prefixName;
    editButton.appendChild(editIcon);

    const editRectangle = document.createElementNS(SVG_NAMESPACE_IRI, "rect");
    editRectangle.id = "rectFor_" + prefixName;
    editRectangle.classList.add("edit-rect-style");
    editRectangle.setAttribute("width", "14px");
    editRectangle.setAttribute("height", "14px");
    editRectangle.setAttribute("transform", "matrix(1,0,0,1,-3,4)");
    editIcon.appendChild(editRectangle);

    const editPath = document.createElementNS(SVG_NAMESPACE_IRI, "path");
    editPath.id = "pathFor_" + prefixName;
    editPath.classList.add("editPrefixIcon", "edit-path-style");
    editIcon.appendChild(editPath);
    editButton.prefixEditorIconPath = editPath;

    const initialEditorAction = isNewPrefix ? "save" : "edit";
    setPrefixEditorAction(editButton, initialEditorAction);
    editIcon.addEventListener(
      "mouseover",
      function (event) {
        highlightEditButton(true, event.currentTarget.prefixName);
      },
      { signal: prefixControlsAbortController.signal },
    );
    editIcon.addEventListener(
      "mouseout",
      function (event) {
        highlightEditButton(false, event.currentTarget.prefixName);
      },
      { signal: prefixControlsAbortController.signal },
    );
    editButton.addEventListener("click", enablePrefixEdit, {
      signal: prefixControlsAbortController.signal,
    });
    editButton.addEventListener(
      "keydown",
      activatePrefixEditorControlFromKeyboard,
      { signal: prefixControlsAbortController.signal },
    );

    const prefixNameInput = document.createElement("input");
    prefixNameInput.classList.add("prefixInput", "pref-input-style");
    prefixNameInput.type = "text";
    prefixNameInput.id = "prefixInputFor_" + prefixName;
    prefixNameInput.autocomplete = "off";
    prefixNameInput.value = isNewPrefix ? "" : prefixName;
    prefixNameInput.disabled = !isNewPrefix;
    prefixEditorRow.appendChild(prefixNameInput);

    const namespaceIriInput = document.createElement("input");
    namespaceIriInput.classList.add("prefixURL");
    namespaceIriInput.type = "text";
    namespaceIriInput.id = "prefixURLFor_" + prefixName;
    namespaceIriInput.autocomplete = "off";
    namespaceIriInput.value = namespaceIri;
    namespaceIriInput.title = namespaceIri;
    namespaceIriInput.disabled = !isNewPrefix;
    prefixEditorRow.appendChild(namespaceIriInput);

    const deleteControlContainer = document.createElement("div");
    deleteControlContainer.classList.add("delete-container-style");
    deleteControlContainer.title = "Delete prefix and IRI";
    prefixEditorRow.appendChild(deleteControlContainer);

    const deleteButton = document.createElementNS(SVG_NAMESPACE_IRI, "svg");
    deleteButton.classList.add("delete-btn-svg");
    deleteButton.id = "deleteButtonFor_" + prefixName;
    deleteButton.prefixName = prefixName;
    deleteButton.setAttribute("role", "button");
    deleteButton.setAttribute("tabindex", "0");
    deleteButton.setAttribute("aria-label", "Delete prefix");
    deleteControlContainer.appendChild(deleteButton);

    const deleteIcon = document.createElementNS(SVG_NAMESPACE_IRI, "g");
    deleteIcon.id = "del_iconFor_" + prefixName;
    deleteIcon.prefixName = prefixName;
    deleteButton.appendChild(deleteIcon);

    const deleteRectangle = document.createElementNS(SVG_NAMESPACE_IRI, "rect");
    deleteRectangle.id = "del_rectFor_" + prefixName;
    deleteRectangle.classList.add("delete-rect-style");
    deleteRectangle.setAttribute("width", "10px");
    deleteRectangle.setAttribute("height", "14px");
    deleteRectangle.setAttribute("transform", "matrix(1,0,0,1,-3,4)");
    deleteIcon.appendChild(deleteRectangle);

    const deletePath = document.createElementNS(SVG_NAMESPACE_IRI, "path");
    deletePath.id = "del_pathFor_" + prefixName;
    deletePath.classList.add("delete-path-style");
    deletePath.setAttribute(
      "d",
      "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
    );
    deletePath.setAttribute("transform", "matrix(0.45,0,0,0.45,0,5)");
    deleteIcon.appendChild(deletePath);

    deleteIcon.addEventListener(
      "mouseover",
      function (event) {
        highlightDeleteButton(true, event.currentTarget.prefixName);
      },
      { signal: prefixControlsAbortController.signal },
    );
    deleteIcon.addEventListener(
      "mouseout",
      function (event) {
        highlightDeleteButton(false, event.currentTarget.prefixName);
      },
      { signal: prefixControlsAbortController.signal },
    );
    deleteButton.addEventListener("click", deletePrefixLine, {
      signal: prefixControlsAbortController.signal,
    });
    deleteButton.addEventListener(
      "keydown",
      activatePrefixDeleteControlFromKeyboard,
      { signal: prefixControlsAbortController.signal },
    );

    if (PROTECTED_PREFIX_NAMES.has(prefixName)) {
      editControlContainer.classList.add("hidden");
      deleteControlContainer.classList.add("hidden");
    }

    return prefixNameInput;
  }

  function setupAddPrefixButton() {
    document.querySelector("#addPrefixButton").addEventListener(
      "click",
      function () {
        if (!isPrefixEditMode) {
          const temporaryPrefixName = "emptyPrefixEntry";
          const prefixNameInput = appendPrefixEditorRow({
            isNewPrefix: true,
            namespaceIri: "",
            prefixName: temporaryPrefixName,
          });
          isPrefixEditMode = true;
          previousPrefixName = temporaryPrefixName;
          previousPrefixNamespaceIri = "";
          document.querySelector("#addPrefixButton").textContent =
            "Save Prefix";
          editSidebar.updateElementWidth();
          prefixNameInput.focus();
          return;
        }
        enablePrefixEdit(
          document.querySelector("#editButtonFor_emptyPrefixEntry"),
        );
      },
      { signal: lifecycleAbortController.signal },
    );
  }

  function setupPrefixList() {
    if (!graph.isEditorMode()) {
      return;
    }
    for (const [prefixName, namespaceIri] of Object.entries(
      graph.ontologyEditingState().prefixList(),
    )) {
      appendPrefixEditorRow({
        isNewPrefix: false,
        namespaceIri,
        prefixName,
      });
    }
    prefixModule.updatePrefixModel();
  }

  function deletePrefixLine(prefixDeleteControlOrEvent) {
    const deleteButton =
      prefixDeleteControlOrEvent?.currentTarget ?? prefixDeleteControlOrEvent;
    if (!deleteButton) {
      return;
    }
    if (deleteButton.disabled === true) {
      return;
    }
    document.querySelector("#addPrefixButton").textContent = "Add Prefix";
    graph.ontologyEditingState().removePrefix(deleteButton.prefixName);
    isPrefixEditMode = false;
    editSidebar.updatePrefixUi();
  }

  function enablePrefixEdit(prefixEditorControlOrEvent) {
    const editButton =
      prefixEditorControlOrEvent?.currentTarget ?? prefixEditorControlOrEvent;
    if (!editButton || editButton.disabled === true || !editButton.prefixName) {
      return;
    }
    const prefixName = editButton.prefixName;
    const prefixEditorAction = editButton.prefixEditorAction;
    if (prefixEditorAction === "edit") {
      document.querySelector("#prefixInputFor_" + prefixName).disabled = false;
      document.querySelector("#prefixURLFor_" + prefixName).disabled = false;
      previousPrefixName = document.querySelector(
        "#prefixInputFor_" + prefixName,
      ).value;
      previousPrefixNamespaceIri = document.querySelector(
        "#prefixURLFor_" + prefixName,
      ).value;
      isPrefixEditMode = true;
      if (document.querySelector("#containerFor_" + prefixName)) {
        document.querySelector("#containerFor_" + prefixName).title =
          "Save new prefix and IRI";
      }
      setPrefixEditorAction(editButton, "save");
      highlightEditButton(true, prefixName);
      return;
    }
    if (prefixEditorAction === "save") {
      const newPrefixNamespaceIri = document.querySelector(
        "#prefixURLFor_" + prefixName,
      ).value;
      const newPrefix = document.querySelector(
        "#prefixInputFor_" + prefixName,
      ).value;

      if (
        graph
          .ontologyEditingState()
          .updatePrefix(
            previousPrefixName,
            newPrefix,
            previousPrefixNamespaceIri,
            newPrefixNamespaceIri,
          ) === true
      ) {
        document.querySelector("#addPrefixButton").textContent = "Add Prefix";
        isPrefixEditMode = false;
        editSidebar.updatePrefixUi();
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

    document.querySelector("#element_iriEditor").value = element.iri();
    document.querySelector("#element_iriEditor").title = element.iri();
    document.querySelector("#element_labelEditor").value =
      element.labelForCurrentLanguage();
  }

  function identifyExternalCharacteristicForElement(ontoIRI, elementIRI) {
    return elementIRI.indexOf(ontoIRI) === -1;
  }

  function usesDefaultDerivedIri(element) {
    // get the iri of that element;
    if (graph.ontologyEditingState().getGeneralMetaObject().iri) {
      const defaultDerivedIri =
        graph.ontologyEditingState().getGeneralMetaObject().iri + element.id();
      return element.iri() === defaultDerivedIri;
    }
    return false;
  }

  /**
   * Resolves user input from the IRI editor into an absolute IRI:
   * - If input is already a valid absolute URL (including modern TLDs/localhost), returns it as-is.
   * - If input is a prefixed CURIE ("prefix:name" or ":name"), expands it using registered prefixes or ontology base IRI.
   * - If prefix is invalid/unknown or input is empty, triggers a warning and returns undefined.
   *
   * @param {Object} element - The currently selected graph element.
   * @returns {string|undefined} The resolved absolute IRI string, or undefined on error.
   */
  function resolveElementIriInput(element) {
    let resolvedIri = document.querySelector("#element_iriEditor").value;
    const ontologyBaseIri = graph
      .ontologyEditingState()
      .getGeneralMetaObjectProperty("iri");

    if (!resolvedIri || resolvedIri.trim().length === 0) {
      graph
        .options()
        .warningModule()
        .showWarning(
          "Invalid Element IRI",
          "Input IRI is EMPTY",
          "Restoring previous IRI for Element: " + element.iri(),
          1,
          false,
        );
      document.querySelector("#element_iriEditor").value = element.iri();
      return undefined;
    }

    // If already a valid absolute URL, accept it directly without mangling
    if (prefixModule.validURL(resolvedIri) === true) {
      return resolvedIri;
    }

    // Attempt CURIE / prefix expansion
    const curieSegments = resolvedIri.split(":");
    if (curieSegments.length === 2) {
      const prefixName = curieSegments[0];
      const localIdentifier = curieSegments[1];

      if (localIdentifier.length === 0) {
        graph
          .options()
          .warningModule()
          .showWarning(
            "Invalid Element IRI",
            "Input IRI is EMPTY",
            "Restoring previous IRI for Element: " + element.iri(),
            1,
            false,
          );
        document.querySelector("#element_iriEditor").value = element.iri();
        return undefined;
      }

      if (prefixName.length > 0) {
        const prefixNamespaceIri = graph.ontologyEditingState().prefixList()[
          prefixName
        ];
        if (prefixNamespaceIri === undefined) {
          graph
            .options()
            .warningModule()
            .showWarning(
              "Invalid Element IRI",
              "Could not resolve prefix '" + prefixName + "'",
              "Restoring previous IRI for Element: " + element.iri(),
              1,
              false,
            );
          document.querySelector("#element_iriEditor").value = element.iri();
          return undefined;
        }
        resolvedIri = prefixNamespaceIri + localIdentifier;
      } else {
        resolvedIri = ontologyBaseIri + localIdentifier;
      }
    } else {
      // Append input string to ontology base IRI
      resolvedIri = ontologyBaseIri + resolvedIri;
    }
    return resolvedIri;
  }

  function changeIriForElement(element) {
    const resolvedIri = resolveElementIriInput(element);
    if (!resolvedIri) {
      return;
    }
    const ontologyBaseIri = graph
      .ontologyEditingState()
      .getGeneralMetaObjectProperty("iri");
    let sanityCheckResult;
    if (elementTools.isNode(element)) {
      sanityCheckResult = graph.checkIfIriClassAlreadyExist(resolvedIri);
      if (sanityCheckResult === false) {
        element.iri(resolvedIri);
      } else {
        // throw warning
        graph
          .options()
          .warningModule()
          .showWarning(
            "Already seen this class",
            "Input IRI: " +
              resolvedIri +
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
      sanityCheckResult = editSidebar.checkProperIriChange(
        element,
        resolvedIri,
      );
      if (sanityCheckResult !== false) {
        graph
          .options()
          .warningModule()
          .showWarning(
            "Already seen this property",
            "Input IRI: " +
              resolvedIri +
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

    element.iri(resolvedIri);
    if (
      identifyExternalCharacteristicForElement(ontologyBaseIri, resolvedIri) ===
      true
    ) {
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
      prefixModule.getPrefixRepresentationForFullURI(resolvedIri);
    editSidebar.updateSelectionInformation(element);
  }

  function changeLabelForElement(element) {
    element.label(document.querySelector("#element_labelEditor").value);
    element.redrawLabelText();
    graph.dispatchEvent(new CustomEvent("dictionarychange"));
  }

  editSidebar.checkForExistingURL = function (candidateIri) {
    const ontologyProperties = graph.getUnfilteredData().properties;
    for (const ontologyProperty of ontologyProperties) {
      if (ontologyProperty.iri() === candidateIri) {
        return true;
      }
    }
    return false;
  };
  editSidebar.checkProperIriChange = function (element, candidateIri) {
    console.warn("Element changed Label");
    console.warn("Testing URL " + candidateIri);
    if (
      element.type() === "rdfs:subClassOf" ||
      element.type() === "owl:disjointWith"
    ) {
      console.warn(
        "ignore this for now, already handled in the type and domain range changer",
      );
    } else {
      const ontologyProperties = graph.getUnfilteredData().properties;
      for (const ontologyProperty of ontologyProperties) {
        if (ontologyProperty === element) {
          continue;
        }
        if (ontologyProperty.iri() === candidateIri) {
          return ontologyProperty;
        }
      }
    }
    return false;
  };

  editSidebar.updateSelectionInformation = function (element) {
    selectionControlsAbortController.abort();
    selectionControlsAbortController = new AbortController();
    const selectionControlsSignal = selectionControlsAbortController.signal;
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

      document.querySelector("#element_iriEditor").addEventListener(
        "change",
        function () {
          const elementIri = element.iri();
          const prefixedIri =
            prefixModule.getPrefixRepresentationForFullURI(elementIri);
          if (
            prefixedIri === document.querySelector("#element_iriEditor").value
          ) {
            console.warn("Iri is identical, nothing has changed!");
            return;
          }

          changeIriForElement(element);
        },
        { signal: selectionControlsSignal },
      );
      document.querySelector("#element_iriEditor").addEventListener(
        "keydown",
        function (event) {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            console.warn("IRI CHANGED Via ENTER pressed");
            changeIriForElement(element);
            document.querySelector("#element_iriEditor").title = element.iri();
          }
        },
        { signal: selectionControlsSignal },
      );

      const shouldSynchronizeIriWithLabel = usesDefaultDerivedIri(element);
      document.querySelector("#element_labelEditor").addEventListener(
        "change",
        function () {
          let sanityCheckResult;
          console.warn("Element changed Label");
          const resolvedIri = resolveElementIriInput(element);
          if (element.iri() !== resolvedIri) {
            if (elementTools.isProperty(element) === true) {
              sanityCheckResult = editSidebar.checkProperIriChange(
                element,
                resolvedIri,
              );
              if (sanityCheckResult !== false) {
                graph
                  .options()
                  .warningModule()
                  .showWarning(
                    "Already seen this property",
                    "Input IRI: " +
                      resolvedIri +
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
              sanityCheckResult =
                graph.checkIfIriClassAlreadyExist(resolvedIri);
              if (sanityCheckResult !== false) {
                graph
                  .options()
                  .warningModule()
                  .showWarning(
                    "Already seen this Class",
                    "Input IRI: " +
                      resolvedIri +
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
            element.iri(resolvedIri);
          }
          changeLabelForElement(element);
          editSidebar.updateSelectionInformation(element); // prevents that it will be changed if node is still active
        },
        { signal: selectionControlsSignal },
      );
      document.querySelector("#element_labelEditor").addEventListener(
        "keydown",
        function (event) {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            let sanityCheckResult;
            console.warn("Element changed Label");
            const resolvedIri = resolveElementIriInput(element);
            if (element.iri() !== resolvedIri) {
              if (elementTools.isProperty(element) === true) {
                sanityCheckResult = editSidebar.checkProperIriChange(
                  element,
                  resolvedIri,
                );
                if (sanityCheckResult !== false) {
                  graph
                    .options()
                    .warningModule()
                    .showWarning(
                      "Already seen this property",
                      "Input IRI: " +
                        resolvedIri +
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
                sanityCheckResult =
                  graph.checkIfIriClassAlreadyExist(resolvedIri);
                if (sanityCheckResult !== false) {
                  graph
                    .options()
                    .warningModule()
                    .showWarning(
                      "Already seen this Class",
                      "Input IRI: " +
                        resolvedIri +
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
              element.iri(resolvedIri);
            }
            changeLabelForElement(element);
          }
        },
        { signal: selectionControlsSignal },
      );
      document.querySelector("#element_labelEditor").addEventListener(
        "keyup",
        function () {
          if (shouldSynchronizeIriWithLabel) {
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
        },
        { signal: selectionControlsSignal },
      );
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

        document.querySelector("#element_iriEditor").value = element.iri();
        document.querySelector("#element_iriEditor").title = element.iri();
        document.querySelector("#element_iriEditor").disabled = true;
        document.querySelector("#element_labelEditor").disabled = true;

        datatypeEditorSelection.value = element.dType();
        if (datatypeEditorSelection.value === "undefined") {
          document.querySelector("#element_iriEditor").disabled = true; // always prevent IRI modifications
          document.querySelector("#element_labelEditor").disabled = false;
        }
        // reconnect the element
        datatypeEditorSelection.addEventListener(
          "change",
          function () {
            changeDatatypeType(element);
          },
          { signal: selectionControlsSignal },
        );
      }

      // add type selector
      const typeEditorSelection = document.querySelector("#typeEditor");
      const existingTypeOptions = typeEditorSelection.children;
      const existingTypeOptionCount = existingTypeOptions.length;
      const elementPrototypes = getElementPrototypes(element);
      for (
        let optionIndex = 0;
        optionIndex < existingTypeOptionCount;
        optionIndex++
      ) {
        typeEditorSelection.removeChild(existingTypeOptions[0]);
      }

      for (const elementPrototype of elementPrototypes) {
        const elementTypeOption = document.createElement("option");
        elementTypeOption.textContent = elementPrototype;
        typeEditorSelection.appendChild(elementTypeOption);
      }
      // set the proper value in the selection
      typeEditorSelection.value = element.type();
      document.querySelector("#typeEditor").addEventListener(
        "change",
        function () {
          elementTypeSelectionChanged(element);
        },
        { signal: selectionControlsSignal },
      );

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
    const generalMetaObj = graph.ontologyEditingState().getGeneralMetaObject();
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

        filterCheckbox.addEventListener("click", handleCheckBoxClick, {
          signal: selectionControlsAbortController.signal,
        });
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

        filterCheckbox.addEventListener("click", handleCheckBoxClick, {
          signal: selectionControlsAbortController.signal,
        });
      }
    }
  }

  function getPresentAttribute(selectedElement, element) {
    return selectedElement.attributes().indexOf(element) >= 0;
  }

  function handleCheckBoxClick(event) {
    const characteristicCheckbox = event.currentTarget;
    const checked = characteristicCheckbox.checked;
    const char = characteristicCheckbox.getAttribute("characteristics");
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
    const availablePrototypes = [];
    // TODO the text should be also complied with the prefixes loaded into the ontology
    if (elementTools.isProperty(selectedElement)) {
      if (selectedElement.type() === "owl:DatatypeProperty") {
        availablePrototypes.push("owl:DatatypeProperty");
      } else {
        availablePrototypes.push("owl:ObjectProperty");
        // handling loops !
        if (selectedElement.domain() !== selectedElement.range()) {
          availablePrototypes.push("rdfs:subClassOf");
        }
        availablePrototypes.push("owl:disjointWith");
        availablePrototypes.push("owl:allValuesFrom");
        availablePrototypes.push("owl:someValuesFrom");
      }
      return availablePrototypes;
    }
    if (selectedElement.renderType() === "rect") {
      availablePrototypes.push("rdfs:Literal");
      availablePrototypes.push("rdfs:Datatype");
    } else {
      availablePrototypes.push("owl:Class");
      availablePrototypes.push("owl:Thing");
      //  TODO: ADD MORE TYPES
      // availablePrototypes.push("owl:complementOf");
      // availablePrototypes.push("owl:disjointUnionOf");
    }
    return availablePrototypes;
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

    function toggleEditingDetailsAccordionTrigger(selectedTrigger) {
      if (selectedTrigger.classList.contains("accordion-trigger-active")) {
        collapseContainers(selectedTrigger.nextElementSibling);
        selectedTrigger.classList.remove("accordion-trigger-active");
      } else {
        expandContainers(selectedTrigger.nextElementSibling);
        selectedTrigger.classList.add("accordion-trigger-active");
      }
      editSidebar.updateElementWidth();
    }

    const editingDetailsSection = document.querySelector("#generalDetailsEdit");
    const triggers =
      editingDetailsSection.querySelectorAll(".accordion-trigger");

    triggers.forEach(function (trigger) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      trigger.addEventListener(
        "keydown",
        function (event) {
          if (isKeyboardActivationEvent(event)) {
            event.preventDefault();
            toggleEditingDetailsAccordionTrigger(event.currentTarget);
          }
        },
        { signal: lifecycleAbortController.signal },
      );

      trigger.addEventListener(
        "click",
        function (event) {
          toggleEditingDetailsAccordionTrigger(event.currentTarget);
        },
        { signal: lifecycleAbortController.signal },
      );
    });
  }

  editSidebar.dispose = function () {
    lifecycleAbortController.abort();
    prefixControlsAbortController.abort();
    selectionControlsAbortController.abort();
  };

  return editSidebar;
}
