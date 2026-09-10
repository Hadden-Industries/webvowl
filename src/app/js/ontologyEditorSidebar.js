import {
  describeVowlDocumentRecord,
  readVowlDocumentPrefixes,
  resolveVowlEditorIri,
  VOWL_EDITOR_CLASS_TYPES,
  VOWL_EDITOR_PROPERTY_TYPES,
  VOWL_EDITOR_DATATYPE_NAMES,
  DEFAULT_VOWL_EDITOR_PREFIXES,
} from "./controller/vowlDocument.js";
import { createLanguageTools } from "../../shared/js/util/languageTools.js";

// This presentation reads immutable document records. Only application
// operations can accept an edit; no drawn element is an editing authority.
export function createOntologyEditorSidebar({
  webVowlController,
  documentObject,
  showWarning,
  confirmDeletion,
}) {
  const document = documentObject;
  const languageTools = createLanguageTools();
  const lifecycle = new AbortController();
  let prefixControlsAbortController = new AbortController();
  let selectionControlsAbortController = new AbortController();
  let unsubscribe;
  let isSetup = false;
  let isDisposed = false;
  let isPrefixEditMode = false;
  let previousPrefixName;
  let snapshot;
  let selectedRecord;
  let selectedTarget;
  let language = "default";
  let presentedSelectionKey;
  let presentedPrefixKey;
  let presentedMetadataKey;

  function localizedText(value) {
    return languageTools.textInLanguage(value, language) ?? "";
  }

  async function perform(operation) {
    if (isDisposed) {
      return;
    }
    try {
      await operation();
    } catch (error) {
      if (!isDisposed) {
        showWarning(error.message);
        render(webVowlController.getState(), true);
      }
    }
  }

  function bindTextEdit(element, operation, signal) {
    element.addEventListener(
      "change",
      () => {
        if (!element.disabled) {
          void perform(operation);
        }
      },
      { signal },
    );
    element.addEventListener(
      "keydown",
      (event) => {
        event.stopPropagation();
        if (event.key === "Enter" && !element.disabled) {
          event.preventDefault();
          void perform(operation);
        }
      },
      { signal },
    );
  }

  function editSelectedRecord(changes) {
    return webVowlController.editOntologyRecord({
      loadGeneration: snapshot.loadGeneration,
      recordTarget: selectedTarget,
      changes,
    });
  }

  function presentOptions(select, values, selected) {
    select.replaceChildren();
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
    select.value = selected;
  }

  function prefixedIri(iri) {
    for (const [name, prefixIri] of Object.entries(
      readVowlDocumentPrefixes(snapshot.vowlModel),
    )) {
      if (typeof prefixIri === "string" && iri.startsWith(prefixIri)) {
        return `${name}:${iri.slice(prefixIri.length)}`;
      }
    }
    return iri;
  }

  function renderSelectedRecord() {
    selectionControlsAbortController.abort();
    selectionControlsAbortController = new AbortController();
    const signal = selectionControlsAbortController.signal;
    document
      .getElementById("selectedElementProperties")
      .classList.toggle("hidden", selectedRecord === undefined);
    document
      .getElementById("selectedElementPropertiesEmptyHint")
      .classList.toggle("hidden", selectedRecord !== undefined);
    if (selectedRecord === undefined) {
      return;
    }
    const iriInput = document.getElementById("element_iriEditor");
    const labelInput = document.getElementById("element_labelEditor");
    const typeInput = document.getElementById("typeEditor");
    const datatypeInput = document.getElementById("typeEditor_datatype");
    const type = selectedRecord.type;
    const isProperty = selectedTarget.collection === "property";
    const isDatatype = ["rdfs:Datatype", "rdfs:Literal"].includes(type);
    const iri = selectedRecord.iri ?? "";
    const fixedLabel = {
      "owl:Thing": "Thing",
      "rdfs:Literal": "Literal",
      "rdfs:subClassOf": "Subclass of",
    }[type];
    const datatypeName =
      VOWL_EDITOR_DATATYPE_NAMES.find((name) => {
        if (!name.includes(":")) {
          return false;
        }
        const [prefix, local] = name.split(":");
        return iri === `${DEFAULT_VOWL_EDITOR_PREFIXES[prefix]}${local}`;
      }) ?? "undefined";
    const isFixedDatatype = isDatatype && datatypeName !== "undefined";
    const isUndefinedDatatype =
      iri === `${DEFAULT_VOWL_EDITOR_PREFIXES.xsd}undefined`;
    iriInput.value = prefixedIri(iri);
    iriInput.title = iri;
    iriInput.disabled =
      fixedLabel !== undefined ||
      type === "owl:disjointWith" ||
      (isDatatype && !isUndefinedDatatype);
    labelInput.value = fixedLabel ?? localizedText(selectedRecord.label);
    labelInput.disabled = fixedLabel !== undefined || isFixedDatatype;
    typeInput.disabled = false;
    datatypeInput.disabled = false;
    document
      .getElementById("typeEditForm_datatype")
      .classList.toggle("hidden", !isDatatype || type === "rdfs:Literal");
    presentOptions(
      typeInput,
      isDatatype
        ? ["rdfs:Literal", "rdfs:Datatype"]
        : isProperty
          ? type === "owl:datatypeProperty"
            ? ["owl:datatypeProperty"]
            : VOWL_EDITOR_PROPERTY_TYPES.filter(
                (value) => value !== "owl:datatypeProperty",
              )
          : VOWL_EDITOR_CLASS_TYPES,
      type,
    );
    presentOptions(
      datatypeInput,
      VOWL_EDITOR_DATATYPE_NAMES.filter((name) => name !== "rdfs:Literal"),
      datatypeName,
    );
    bindTextEdit(
      iriInput,
      () =>
        editSelectedRecord({
          iri: resolveVowlEditorIri(iriInput.value, snapshot.vowlModel),
        }),
      signal,
    );
    const hasDefaultDerivedIri =
      iri === `${snapshot.vowlModel.header?.iri}${selectedRecord.id}`;
    const labelChange = () => ({
      label: { language, text: labelInput.value },
      ...(hasDefaultDerivedIri
        ? {
            iri: `${snapshot.vowlModel.header.iri}${labelInput.value.replaceAll(" ", "_")}`,
          }
        : {}),
    });
    bindTextEdit(labelInput, () => editSelectedRecord(labelChange()), signal);
    labelInput.addEventListener(
      "keyup",
      () => {
        if (hasDefaultDerivedIri) {
          iriInput.value = prefixedIri(labelChange().iri);
        }
      },
      { signal },
    );
    typeInput.addEventListener(
      "change",
      () => {
        void perform(() => editSelectedRecord({ type: typeInput.value }));
      },
      { signal },
    );
    datatypeInput.addEventListener(
      "change",
      () => {
        void perform(() =>
          editSelectedRecord({ datatypeName: datatypeInput.value }),
        );
      },
      { signal },
    );

    const characteristics = document.getElementById(
      "property_characteristics_Selection",
    );
    characteristics.replaceChildren();
    const names =
      fixedLabel !== undefined || isDatatype
        ? []
        : !isProperty
          ? ["deprecated"]
          : type === "owl:datatypeProperty"
            ? ["deprecated", "functional"]
            : ["deprecated", "inverse functional", "functional", "transitive"];
    document
      .getElementById("property_characteristics_Container")
      .classList.toggle("hidden", names.length === 0);
    if ((selectedRecord.attributes ?? []).includes("external")) {
      const indicator = document.createElement("span");
      indicator.classList.add("spanForCharSelection");
      indicator.textContent = "external";
      characteristics.appendChild(indicator);
    }
    names.forEach((name, index) => {
      const row = document.createElement("div");
      row.classList.add("checkboxContainer", "warning-row");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `CharacteristicsCheckbox${index}`;
      checkbox.classList.add("filterCheckbox");
      checkbox.checked = (selectedRecord.attributes ?? []).includes(name);
      checkbox.setAttribute("characteristics", name);
      const label = document.createElement("label");
      label.setAttribute("for", checkbox.id);
      label.textContent = name;
      row.appendChild(checkbox);
      row.appendChild(label);
      characteristics.appendChild(row);
      checkbox.addEventListener(
        "change",
        () => {
          void perform(() =>
            editSelectedRecord({
              characteristics: { [name]: checkbox.checked },
            }),
          );
        },
        { signal },
      );
    });
  }

  function render(state, force = false) {
    if (isDisposed) {
      return;
    }
    const isBusy = ["loading", "parsing", "rendering"].includes(state.status);
    if (isBusy) {
      for (const input of document
        .getElementById("generalDetailsEdit")
        .querySelectorAll("input, select, button")) {
        input.disabled = true;
      }
      return;
    }
    if (state.loadGeneration === 0) {
      return;
    }
    snapshot = webVowlController.getOntologyDocument();
    language = state.view?.language ?? "default";
    const metadataKey = `${snapshot.loadGeneration}:${language}`;
    if (force || presentedMetadataKey !== metadataKey) {
      for (const [id, field] of [
        ["titleEditor", "title"],
        ["iriEditor", "iri"],
        ["versionEditor", "version"],
        ["authorsEditor", "author"],
        ["descriptionEditor", "description"],
      ]) {
        const input = document.getElementById(id);
        input.value = localizedText(snapshot.vowlModel.header?.[field]);
        input.disabled = false;
      }
      presentedMetadataKey = metadataKey;
    }
    selectedTarget = state.selectedDocumentRecord;
    selectedRecord =
      selectedTarget === null || selectedTarget === undefined
        ? undefined
        : describeVowlDocumentRecord(snapshot.vowlModel, selectedTarget);
    const selectionKey = JSON.stringify([
      snapshot.loadGeneration,
      language,
      selectedTarget,
    ]);
    if (force || presentedSelectionKey !== selectionKey) {
      renderSelectedRecord();
      presentedSelectionKey = selectionKey;
    }
    const prefixKey = JSON.stringify([
      state.editorMode?.isEditorMode,
      readVowlDocumentPrefixes(snapshot.vowlModel),
    ]);
    if (force || prefixKey !== presentedPrefixKey) {
      prefixControlsAbortController.abort();
      prefixControlsAbortController = new AbortController();
      document.getElementById("prefixURL_Container").replaceChildren();
      isPrefixEditMode = false;
      const add = document.getElementById("addPrefixButton");
      add.textContent = "Add Prefix";
      add.disabled = false;
      if (state.editorMode?.isEditorMode) {
        for (const [prefixName, namespaceIri] of Object.entries(
          readVowlDocumentPrefixes(snapshot.vowlModel),
        )) {
          appendPrefixEditorRow({
            isNewPrefix: false,
            prefixName,
            namespaceIri,
          });
        }
      }
      presentedPrefixKey = prefixKey;
    }
  }

  function enablePrefixEdit(controlOrEvent) {
    const button = controlOrEvent?.currentTarget ?? controlOrEvent;
    if (!button || button.disabled || !button.prefixName) {
      return;
    }
    const nameInput = document.getElementById(
      `prefixInputFor_${button.prefixName}`,
    );
    const iriInput = document.getElementById(
      `prefixURLFor_${button.prefixName}`,
    );
    if (button.prefixEditorAction === "edit") {
      previousPrefixName = button.prefixName;
      nameInput.disabled = false;
      iriInput.disabled = false;
      isPrefixEditMode = true;
      setPrefixEditorAction(button, "save");
      nameInput.focus();
      return;
    }
    const request = {
      loadGeneration: snapshot.loadGeneration,
      ...(previousPrefixName === undefined
        ? {}
        : { previousName: previousPrefixName }),
      name: nameInput.value,
      iri: iriInput.value,
    };
    void perform(() => webVowlController.setOntologyPrefix(request));
  }

  function deletePrefixLine(controlOrEvent) {
    const button = controlOrEvent?.currentTarget ?? controlOrEvent;
    if (!button || button.disabled) {
      return;
    }
    if (
      button.prefixName === "emptyPrefixEntry" &&
      previousPrefixName === undefined
    ) {
      render(webVowlController.getState(), true);
      return;
    }
    void perform(() =>
      webVowlController.removeOntologyPrefix({
        loadGeneration: snapshot.loadGeneration,
        name: button.prefixName,
      }),
    );
  }

  function setup() {
    if (isSetup || isDisposed) {
      return;
    }
    isSetup = true;
    for (const [id, field] of [
      ["titleEditor", "title"],
      ["iriEditor", "iri"],
      ["versionEditor", "version"],
      ["authorsEditor", "author"],
      ["descriptionEditor", "description"],
    ]) {
      const input = document.getElementById(id);
      bindTextEdit(
        input,
        () =>
          webVowlController.editOntologyMetadata({
            loadGeneration: snapshot.loadGeneration,
            changes: {
              [field]: ["title", "description"].includes(field)
                ? { language, text: input.value }
                : input.value,
            },
          }),
        lifecycle.signal,
      );
    }
    document.getElementById("addPrefixButton").addEventListener(
      "click",
      () => {
        if (isPrefixEditMode) {
          enablePrefixEdit(
            document.getElementById("editButtonFor_emptyPrefixEntry"),
          );
          return;
        }
        previousPrefixName = undefined;
        isPrefixEditMode = true;
        appendPrefixEditorRow({
          isNewPrefix: true,
          namespaceIri: "",
          prefixName: "emptyPrefixEntry",
        }).focus();
        document.getElementById("addPrefixButton").textContent = "Save Prefix";
      },
      { signal: lifecycle.signal },
    );
    for (const id of [
      "class_deleteButton",
      "property_deleteButton",
      "datatype_deleteButton",
    ]) {
      document.getElementById(id)?.addEventListener(
        "click",
        () => {
          void perform(async () => {
            if (!selectedTarget) {
              return;
            }
            const proposal = webVowlController.proposeOntologyDeletion({
              loadGeneration: snapshot.loadGeneration,
              recordTarget: selectedTarget,
            });
            if (await confirmDeletion(proposal)) {
              await webVowlController.confirmOntologyDeletion(proposal);
            }
          });
        },
        { signal: lifecycle.signal },
      );
    }
    for (const trigger of document
      .getElementById("generalDetailsEdit")
      .querySelectorAll(".accordion-trigger")) {
      trigger.setAttribute("tabindex", "0");
      trigger.setAttribute("role", "button");
      const toggle = () => {
        const active = trigger.classList.toggle("accordion-trigger-active");
        trigger.nextElementSibling.classList.toggle("hidden", !active);
      };
      trigger.addEventListener("click", toggle, { signal: lifecycle.signal });
      trigger.addEventListener(
        "keydown",
        (event) => {
          if (isKeyboardActivationEvent(event)) {
            event.preventDefault();
            toggle();
          }
        },
        { signal: lifecycle.signal },
      );
    }
    unsubscribe = webVowlController.subscribeToState((state, fields) => {
      if (
        fields.some((field) =>
          [
            "status",
            "loadGeneration",
            "selectedDocumentRecord",
            "view",
            "editorMode",
          ].includes(field),
        )
      ) {
        render(state);
      }
    });
    render(webVowlController.getState());
  }

  function highlightDeleteButton(enable, name) {
    const deletePath = document.getElementById("del_pathFor_" + name);
    const deleteRect = document.getElementById("del_rectFor_" + name);

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
    const editPath = document.getElementById("pathFor_" + name);
    const editRect = document.getElementById("rectFor_" + name);

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

  return Object.freeze({
    setup,
    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      lifecycle.abort();
      prefixControlsAbortController.abort();
      selectionControlsAbortController.abort();
      unsubscribe?.();
    },
  });
}
