import {
  createEntityPresentation,
  readableFieldName,
  relatedEntityRoleReferences,
  sameSemanticSelection,
} from "./entityPresentationModel.js";
import { ontologyElementReferenceKey } from "../controller/webVowlControllerContracts.js";
import { navigableOntologyIri } from "../sidebar.js";
import { runVisualizationControlAction } from "./visualizationControlAction.js";

/** One current presentation, shared by the preview and complete Details. */
export function createEntityDetailsPresenter({
  controller,
  surface,
  documentObject = document,
  openFacts,
  onPresentationChanged,
  scheduleRefresh,
}) {
  const doc = documentObject;
  const lifecycle = new AbortController();
  const preview = doc.getElementById("entity-preview");
  const previewBody = doc.getElementById("entity-preview-body");
  const details = doc.getElementById("entity-full-details");
  const detailsButton = doc.getElementById("entity-preview-details");
  const closeButton = doc.getElementById("entity-preview-close");
  const message = doc.getElementById("entity-details-status");
  let model = [];
  let selectedRole;
  let relatedModel;
  let relatedReference;
  let focusRelatedHeading = false;
  let identity;
  let editor = false;
  let disposed = false;

  const on = (element, type, listener) =>
    element.addEventListener(type, listener, { signal: lifecycle.signal });
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
  function renderPreview() {
    preview.hidden = !model.length || editor;
    if (preview.hidden && preview.contains(doc.activeElement)) {
      doc.getElementById("ontology-overview-open").focus();
    }
    onPresentationChanged();
    if (preview.hidden) {
      return;
    }
    const role = model.find((entry) => entry.key === selectedRole) ?? model[0];
    const focusedRole = previewBody.contains(doc.activeElement)
      ? doc.activeElement.dataset.roleKey
      : undefined;
    selectedRole = role.key;
    preview.dataset.shape = role.kind === "class" ? "round" : "rectangle";
    previewBody.replaceChildren();
    const heading = append(previewBody, "h2", role.label);
    heading.id = "entity-preview-heading";
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
    append(previewBody, "p", role.type, "entity-preview-type");
    append(previewBody, "p", role.compactIri, "entity-preview-iri");
    if (role.summary) {
      append(previewBody, "p", role.summary);
    }
    for (const line of role.summaries) {
      append(previewBody, "p", line);
    }
    detailsButton.setAttribute("aria-label", "Details for " + role.label);
    if (focusedRole) {
      const replacement = [...previewBody.querySelectorAll("button")].find(
        (control) => control.dataset.roleKey === focusedRole,
      );
      (replacement ?? detailsButton).focus();
    }
  }
  function navigate(reference) {
    if (!current()) {
      return;
    }
    relatedReference = reference;
    focusRelatedHeading = true;
    scheduleRefresh();
  }
  function renderValue(parent, value) {
    if (value === null || value === undefined || value === "") {
      append(parent, "span", "Not provided");
    } else if (Array.isArray(value)) {
      if (!value.length) {
        append(parent, "span", "None");
      } else {
        const list = append(parent, "ul");
        for (const entry of value) {
          renderValue(append(list, "li"), entry);
        }
      }
    } else if (typeof value === "object") {
      if (value.ontologyElementReference) {
        button(
          parent,
          value.displayLabel || value.iri || "Anonymous entity",
          () => navigate(value.ontologyElementReference),
        );
        if (value.iri) {
          append(parent, "span", value.iri, "entity-relation-iri");
        }
      } else {
        const list = append(parent, "dl");
        for (const [key, entry] of Object.entries(value)) {
          append(list, "dt", readableFieldName(key));
          const definition = append(list, "dd");
          renderValue(definition, entry);
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
  function renderDetails() {
    details.replaceChildren();
    const roles = relatedModel ?? model;
    if (relatedModel) {
      append(details, "p", "Related entity details");
      button(
        details,
        "Back to selected " + (model[0]?.label ?? "entity"),
        () => {
          relatedReference = undefined;
          relatedModel = undefined;
          renderDetails();
          details.querySelector("h3")?.focus();
        },
      );
    }
    if (!roles.length) {
      append(
        details,
        "p",
        relatedModel
          ? "This entity is no longer available."
          : "Select an element in the visualization or use Search.",
      );
    }
    for (const role of roles) {
      const section = append(details, "section");
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
            renderValue(definition, groups.get(key));
          }
        } else {
          renderValue(definition, field.value);
        }
      }
    }
    if (model.length) {
      const facts = button(details, "Ontology facts", () => openFacts(facts));
    }
  }
  on(detailsButton, "click", () => {
    relatedReference = undefined;
    relatedModel = undefined;
    surface.openDetails(detailsButton);
  });
  on(closeButton, "click", () => {
    if (current()) {
      void runVisualizationControlAction(
        () => controller.selectVisualizationElement({ reference: null }),
        doc,
      );
    }
  });
  surface.onClose(() => {
    relatedReference = undefined;
    relatedModel = undefined;
    renderPreview();
  });
  surface.onOpen(renderDetails);
  renderDetails();
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
      const all = createEntityPresentation(descriptions);
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
      const focused = details.contains(doc.activeElement)
        ? doc.activeElement.textContent
        : null;
      const scroll = details.parentElement?.scrollTop;
      renderPreview();
      if (surface.isOpen()) {
        renderDetails();
        if (focusRelatedHeading) {
          details.querySelector("h3")?.focus();
          focusRelatedHeading = false;
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
    renderEditorMode(value) {
      editor = value;
      renderPreview();
    },
    dispose() {
      disposed = true;
      lifecycle.abort();
      model = [];
      relatedModel = undefined;
      relatedReference = undefined;
      preview.hidden = true;
      details.replaceChildren();
    },
  });
}
