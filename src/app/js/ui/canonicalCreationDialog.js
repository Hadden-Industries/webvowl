import "../../css/canonicalMergeDialog.css";
import { DEFAULT_VOWL_EDITOR_PREFIXES } from "../controller/vowlDocument.js";

let nextId = 0;

/** Ask only for semantic information the drawing gesture cannot supply. */
export function requestCanonicalCreation(
  { type, datatype, properties, resolveIri },
  { signal, documentObject = document } = {},
) {
  signal?.throwIfAborted();
  const relation = {
    "rdfs:subClassOf": "subclass",
    "owl:disjointWith": "disjoint",
  }[type];
  if (relation) {
    return Promise.resolve({ relation });
  }
  if (type === "owl:Thing") {
    return Promise.resolve({ iri: "http://www.w3.org/2002/07/owl#Thing" });
  }
  const restriction = {
    "owl:someValuesFrom": "some",
    "owl:allValuesFrom": "all",
  }[type];
  const isData = type === "owl:datatypeProperty";
  const doc = documentObject;
  const previousFocus = doc.activeElement;
  const dialog = doc.createElement("dialog");
  dialog.className = "canonical-merge-dialog canonical-input-dialog";
  dialog.setAttribute("closedby", "any");
  const id = `canonical-create-${++nextId}`;
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  function append(tag, text, parent = dialog) {
    const node = doc.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    parent.append(node);
    return node;
  }
  append(
    "h2",
    restriction
      ? "Create restriction"
      : type === "owl:Ontology"
        ? "Create ontology"
        : type.includes("Class")
          ? "Create class"
          : "Create property",
  ).id = `${id}-title`;
  const form = append("form");
  function field(name, text, tag = "input") {
    const label = append("label", text, form);
    label.htmlFor = `${id}-${name}`;
    const control = append(tag, undefined, form);
    control.id = label.htmlFor;
    if (tag === "input") {
      control.type = "text";
    }
    control.addEventListener("input", () => control.setCustomValidity(""));
    return control;
  }
  let iri, label, data, property;
  if (restriction) {
    append(
      "p",
      "Select the object property restricted between the two classes. The property is part of the restriction's meaning.",
      form,
    );
    property = field("property", "Object property", "select");
    property.required = true;
    const option = append("option", "Choose a property", property);
    option.value = "";
    option.disabled = true;
    option.selected = true;
    for (const [index, choice] of properties.entries()) {
      const option = append("option", choice.iri, property);
      option.value = String(index);
    }
    if (!properties.length) {
      append(
        "p",
        "This document has no named object properties. Create one before adding a restriction.",
        form,
      );
    }
  } else {
    iri = field(
      "iri",
      type === "owl:Ontology" ? "Ontology IRI" : "IRI or prefixed name",
    );
    iri.required = true;
    label = field(
      "label",
      type === "owl:Ontology" ? "Title (optional)" : "Label (optional)",
    );
    if (isData) {
      data = field("datatype", "Datatype IRI or prefixed name");
      data.required = true;
      const [prefix, local] = datatype.split(":");
      data.value =
        datatype === "undefined"
          ? ""
          : DEFAULT_VOWL_EDITOR_PREFIXES[prefix] + local;
    }
  }
  const actions = append("div", undefined, form);
  actions.className = "canonical-merge-actions";
  const cancel = append("button", "Cancel", actions);
  cancel.type = "button";
  const create = append("button", "Create", actions);
  create.type = "submit";
  create.disabled = Boolean(restriction && !properties.length);
  return new Promise((resolve, reject) => {
    let finished = false;
    const abort = () => finish(undefined, signal.reason);
    function finish(value, error) {
      if (finished) {
        return;
      }
      finished = true;
      signal?.removeEventListener("abort", abort);
      dialog.close();
      dialog.remove();
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }
    cancel.addEventListener("click", () => finish(null));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("close", () => finish(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (restriction) {
        const choice = properties[Number(property.value)];
        if (property.value && choice) {
          finish({ relation: restriction, property: choice.target });
        }
        return;
      }
      const values = {};
      for (const [name, control] of [
        ["iri", iri],
        ["datatypeIri", data],
      ]) {
        if (!control) {
          continue;
        }
        try {
          values[name] = resolveIri(control.value);
        } catch (error) {
          control.setCustomValidity(error.message);
          control.reportValidity();
          return;
        }
      }
      finish({ ...values, ...(label.value ? { text: label.value } : {}) });
    });
    signal?.addEventListener("abort", abort, { once: true });
    doc.body.append(dialog);
    dialog.showModal();
    (property ?? iri).focus();
  });
}
