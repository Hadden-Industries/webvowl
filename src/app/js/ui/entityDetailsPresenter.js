import {
  createEntityPresentation,
  readableFieldName,
  relatedEntityRoleReferences,
  sameSemanticSelection,
} from "./entityPresentationModel.js";
import { ontologyElementReferenceKey } from "../controller/webVowlControllerContracts.js";
import { navigableOntologyIri } from "../sidebar.js";
import { runVisualizationControlAction } from "./visualizationControlAction.js";

// A press inside one of these never dismisses the selection: the graph settles
// its own presses, its zoom control only moves the view, and the Details
// surfaces are showing the very selection a dismissal would clear.
const SELECTION_KEEPING_SURFACES = "#graph, #zoomSlider, #detailsArea, dialog";

/**
 * One current presentation of the selection, written into the slots the page
 * nests inside the graph's expansion element: a summary, and the complete view
 * the renderer reveals when the reader asks for more. The renderer sizes and
 * animates those slots and never reads them. The older Details surface shows
 * the same complete view when something opens it.
 *
 * The name is the exception among the slots. It is one element the page keeps:
 * the renderer names it as the node is drawn the moment the node expands, and
 * carries it from the node's label to its place and back. So it is only ever
 * given new text here, never replaced, and never cleared.
 */
export function createEntityDetailsPresenter({
  controller,
  surface,
  documentObject = document,
  openFacts,
  scheduleRefresh,
}) {
  const doc = documentObject;
  const lifecycle = new AbortController();
  const preview = doc.getElementById("entity-preview");
  const previewName = doc.getElementById("entity-preview-name");
  const previewBody = doc.getElementById("entity-preview-body");
  const previewComplete = doc.getElementById("entity-preview-complete");
  const details = doc.getElementById("entity-full-details");
  const message = doc.getElementById("entity-details-status");
  let model = [];
  let selectedRole;
  let relatedModel;
  let relatedReference;
  // The container whose relation was followed, so its new heading takes focus.
  let relatedNavigationContainer;
  let identity;
  let editor = false;
  let disposed = false;

  const on = (element, type, listener, options) =>
    element.addEventListener(type, listener, {
      ...options,
      signal: lifecycle.signal,
    });
  function append(parent, tag, text, className) {
    const element = doc.createElement(tag);
    if (text !== undefined) {
      element.textContent = text;
    }
    if (className) {
      element.className = className;
    }
    parent.append(element);
    return element;
  }
  function button(parent, label, action) {
    const element = append(parent, "button", label);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }
  function current(state = controller.getState()) {
    return (
      !disposed &&
      identity &&
      identity.generation === state.loadGeneration &&
      identity.revision === state.documentRevision &&
      sameSemanticSelection(identity.selection, state.selection) &&
      !["loading", "idle", "disposed"].includes(state.status)
    );
  }
  function readDrawnOccurrenceCount() {
    try {
      return controller.getSelectedVisualizationOccurrence?.()?.occurrenceCount;
    } catch (error) {
      if (!["LOAD_PENDING", "NO_ONTOLOGY"].includes(error.code)) {
        throw error;
      }
      return undefined;
    }
  }
  function renderSummary(role) {
    const summary = append(
      previewBody,
      "div",
      undefined,
      "entity-preview-summary",
    );
    if (role.summary) {
      append(summary, "p", role.summary);
    }
    for (const annotation of role.highlightedAnnotations) {
      for (const value of annotation.values) {
        const line = append(
          summary,
          "p",
          undefined,
          "entity-preview-annotation",
        );
        append(line, "span", annotation.label, "entity-preview-term");
        const text = append(line, "span", value.text);
        if (value.languageTag) {
          text.lang = value.languageTag;
        }
      }
    }
    for (const line of role.summaries) {
      append(summary, "p", line);
    }
    const drawnOccurrenceCount = readDrawnOccurrenceCount();
    if (drawnOccurrenceCount > 1) {
      append(summary, "p", `Drawn ${drawnOccurrenceCount} times`);
    }
  }
  function renderPreview() {
    preview.hidden = !model.length || editor;
    if (preview.hidden && preview.contains(doc.activeElement)) {
      doc.getElementById("ontology-menu-open").focus();
    }
    if (preview.hidden) {
      previewBody.replaceChildren();
      previewComplete.replaceChildren();
      return;
    }
    const role = model.find((entry) => entry.key === selectedRole) ?? model[0];
    const focusedRole = previewBody.contains(doc.activeElement)
      ? doc.activeElement.dataset.roleKey
      : undefined;
    selectedRole = role.key;
    previewBody.replaceChildren();
    previewName.textContent = role.label;
    if (model.length > 1) {
      const group = append(
        previewBody,
        "fieldset",
        undefined,
        "entity-role-switcher",
      );
      append(group, "legend", "Semantic role");
      for (const entry of model) {
        const roleLabel = readableFieldName(entry.role.replaceAll("-", " "));
        const sharedRole = model.some(
          (other) => other.key !== entry.key && other.role === entry.role,
        );
        const label = sharedRole
          ? roleLabel + " · " + entry.compactIri
          : roleLabel;
        const control = button(group, label, () => {
          selectedRole = entry.key;
          renderPreview();
          previewBody.querySelector('[aria-pressed="true"]')?.focus();
        });
        control.setAttribute("aria-pressed", String(entry.key === role.key));
        control.dataset.roleKey = entry.key;
      }
    }
    const type = append(previewBody, "p", undefined, "entity-preview-type");
    append(type, "span", role.typeSymbol, "entity-type-symbol").setAttribute(
      "aria-hidden",
      "true",
    );
    append(type, "span", role.type);
    append(previewBody, "p", role.compactIri, "entity-preview-iri");
    renderSummary(role);
    renderCompleteDetails(previewComplete);
    if (focusedRole) {
      [...previewBody.querySelectorAll("button")]
        .find((control) => control.dataset.roleKey === focusedRole)
        ?.focus();
    }
  }
  function navigate(reference, container) {
    if (!current()) {
      return;
    }
    relatedReference = reference;
    relatedNavigationContainer = container;
    scheduleRefresh();
  }
  function renderValue(parent, value, container) {
    if (value === null || value === undefined || value === "") {
      append(parent, "span", "Not provided");
    } else if (Array.isArray(value)) {
      if (!value.length) {
        append(parent, "span", "None");
      } else {
        const list = append(parent, "ul");
        for (const entry of value) {
          renderValue(append(list, "li"), entry, container);
        }
      }
    } else if (typeof value === "object") {
      if (value.ontologyElementReference) {
        button(
          parent,
          value.displayLabel || value.iri || "Anonymous entity",
          () => navigate(value.ontologyElementReference, container),
        );
        if (value.iri) {
          append(parent, "span", value.iri, "entity-relation-iri");
        }
      } else {
        const list = append(parent, "dl");
        for (const [key, entry] of Object.entries(value)) {
          append(list, "dt", readableFieldName(key));
          const definition = append(list, "dd");
          renderValue(definition, entry, container);
          if (
            key === "text" &&
            typeof value.languageTag === "string" &&
            value.languageTag
          ) {
            definition.lang = value.languageTag;
          }
        }
      }
    } else {
      append(parent, "span", String(value));
    }
  }
  /** Every field of every selected role, into the expansion or the surface. */
  function renderCompleteDetails(container) {
    container.replaceChildren();
    const roles = relatedModel ?? model;
    if (relatedModel) {
      append(container, "p", "Related entity details");
      button(
        container,
        "Back to selected " + (model[0]?.label ?? "entity"),
        () => {
          relatedReference = undefined;
          relatedModel = undefined;
          renderCompleteDetails(container);
          container.querySelector("h3")?.focus();
        },
      );
    }
    if (!roles.length) {
      append(
        container,
        "p",
        relatedModel
          ? "This entity is no longer available."
          : "Select an element in the visualization or use Search.",
      );
    }
    for (const role of roles) {
      const section = append(container, "section");
      const heading = append(
        section,
        "h3",
        role.label + " — " + readableFieldName(role.role.replaceAll("-", " ")),
      );
      heading.tabIndex = -1;
      if (role.iri) {
        const href = navigableOntologyIri(role.iri);
        const iri = append(
          section,
          href ? "a" : "p",
          role.iri,
          "entity-full-iri",
        );
        if (href) {
          iri.href = href;
          iri.target = "_blank";
          iri.rel = "noopener";
        }
        button(section, "Copy full IRI", async () => {
          try {
            await doc.defaultView.navigator.clipboard.writeText(role.iri);
            message.textContent = "IRI copied.";
          } catch {
            message.textContent =
              "Copy is unavailable. Select and copy the full IRI above.";
          }
        });
      } else {
        append(section, "p", "Anonymous — no IRI");
      }
      const fields = append(section, "dl");
      for (const field of role.fields) {
        append(fields, "dt", field.label);
        const definition = append(fields, "dd");
        if (field.key === "annotationRecords" && field.value?.length) {
          const groups = new Map();
          for (const annotation of field.value) {
            const key =
              annotation.propertyIri || annotation.localName || "Annotation";
            if (!groups.has(key)) {
              groups.set(key, []);
            }
            groups.get(key).push(annotation);
          }
          for (const key of [...groups.keys()].sort()) {
            append(definition, "h4", key);
            renderValue(definition, groups.get(key), container);
          }
        } else {
          renderValue(definition, field.value, container);
        }
      }
    }
    if (model.length) {
      const facts = button(container, "Ontology facts", () => openFacts(facts));
    }
  }
  // There is no Close control: pressing anywhere that is not the selection's
  // own surface, or Escape, clears the selection, and the renderer shrinks the
  // expanded occurrence back. A fact is reported; nothing is told to collapse.
  function dismissSelection() {
    if (model.length && !editor && current()) {
      void runVisualizationControlAction(
        () => controller.selectVisualizationElement({ reference: null }),
        doc,
      );
    }
  }
  on(
    doc,
    "pointerdown",
    (event) => {
      if (!event.target?.closest?.(SELECTION_KEEPING_SURFACES)) {
        dismissSelection();
      }
    },
    // Capture: a control that selects something else on this press must find
    // the earlier selection already cleared, not clear its own afterwards.
    { capture: true },
  );
  on(doc, "keydown", (event) => {
    if (
      event.key === "Escape" &&
      !event.defaultPrevented &&
      !event.target?.closest?.("dialog")
    ) {
      dismissSelection();
    }
  });
  surface.onClose(() => {
    relatedReference = undefined;
    relatedModel = undefined;
    renderPreview();
  });
  surface.onOpen(() => renderCompleteDetails(details));
  renderCompleteDetails(details);
  return Object.freeze({
    describe(request) {
      if (!current()) {
        relatedReference = undefined;
      }
      const references = [
        ...request.ontologyElementReferences,
        ...(relatedReference
          ? relatedEntityRoleReferences(relatedReference)
          : []),
      ];
      const unique = new Map(
        references.map((reference) => [
          ontologyElementReferenceKey(reference),
          reference,
        ]),
      );
      return controller.describeOntologyElements({
        ontologyElementReferences: [...unique.values()],
      });
    },
    render(descriptions) {
      const state = controller.getState();
      const changedIdentity =
        !identity ||
        identity.generation !== state.loadGeneration ||
        identity.revision !== state.documentRevision ||
        !sameSemanticSelection(identity.selection, state.selection);
      identity = {
        generation: state.loadGeneration,
        revision: state.documentRevision,
        selection: state.selection,
      };
      const selectedKeys = new Set(
        state.selection.map(ontologyElementReferenceKey),
      );
      const all = createEntityPresentation(descriptions, {
        preferredLanguageTag: state.view?.language,
      });
      model = all.filter((entry) => selectedKeys.has(entry.key));
      if (changedIdentity) {
        relatedModel = undefined;
        relatedReference = undefined;
      } else if (relatedReference) {
        relatedModel = all.filter((entry) =>
          relatedReference.iri
            ? entry.iri === relatedReference.iri
            : entry.key === ontologyElementReferenceKey(relatedReference),
        );
      }
      const detailsOpen = surface.isOpen();
      const focused =
        detailsOpen && details.contains(doc.activeElement)
          ? doc.activeElement.textContent
          : null;
      const scroll = detailsOpen ? details.parentElement?.scrollTop : undefined;
      const navigatedContainer = relatedNavigationContainer;
      relatedNavigationContainer = undefined;
      renderPreview();
      if (navigatedContainer === previewComplete) {
        previewComplete.querySelector("h3")?.focus();
      }
      if (surface.isOpen()) {
        renderCompleteDetails(details);
        if (navigatedContainer === details) {
          details.querySelector("h3")?.focus();
        } else if (focused) {
          const replacement = [
            ...details.querySelectorAll("button, a, h3"),
          ].find((element) => element.textContent === focused);
          (replacement ?? details.querySelector("h3"))?.focus();
        }
        if (details.parentElement && scroll !== undefined) {
          details.parentElement.scrollTop = scroll;
        }
      }
      if (!model.length) {
        surface.closeDetails();
      }
    },
    renderEditorMode(isEditorMode) {
      editor = isEditorMode;
      renderPreview();
    },
    dispose() {
      disposed = true;
      lifecycle.abort();
      model = [];
      relatedModel = undefined;
      relatedReference = undefined;
      preview.hidden = true;
      previewBody.replaceChildren();
      previewComplete.replaceChildren();
      details.replaceChildren();
    },
  });
}
