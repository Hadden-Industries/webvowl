import "../../css/canonicalMergeDialog.css";

function words(value) {
  const text = value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Native, paged inspection. Ontology text is never parsed as HTML or a URL. */
export function createCanonicalFactsDialog({
  controller,
  documentObject = document,
}) {
  const doc = documentObject;
  const button = doc.querySelector("#ontology-facts");
  const lifecycle = new AbortController();
  let dialog;
  let restoreFocus;
  const close = () => {
    if (!dialog) {
      return;
    }
    dialog.close();
    dialog.remove();
    dialog = undefined;
    restoreFocus?.focus();
  };
  const refresh = (state, fields = []) => {
    const retainedAfterFailure =
      state.status === "error" &&
      state.source &&
      state.loadGeneration > 0 &&
      state.layout?.status !== "unavailable";
    button.disabled = !(
      ["ready", "relaxing"].includes(state.status) || retainedAfterFailure
    );
    if (
      button.disabled ||
      fields.some((field) =>
        ["loadGeneration", "documentRevision"].includes(field),
      )
    ) {
      close();
    }
  };
  const unsubscribe = controller.subscribeToState(refresh);
  button.hidden = false;
  refresh(controller.getState());

  function open() {
    close();
    restoreFocus = doc.querySelector("#c_select > button") ?? doc.activeElement;
    doc.querySelector("#m_select")?.hidePopover();
    dialog = doc.createElement("dialog");
    dialog.className = "canonical-merge-dialog canonical-input-dialog";
    dialog.setAttribute("closedby", "any");
    dialog.setAttribute("aria-labelledby", "ontology-facts-title");
    const append = (tag, text, parent = dialog) => {
      const element = doc.createElement(tag);
      if (text !== undefined) {
        element.textContent = text;
      }
      parent.append(element);
      return element;
    };
    append("h2", "Ontology facts").id = "ontology-facts-title";
    append(
      "p",
      "Inspect retained meaning, source evidence and qualifications. Some facts have no shape in the graph. Expand a record to read every field; reference identifiers connect records across sections.",
    );
    const label = append("label", "Section");
    label.htmlFor = "ontology-facts-section";
    const select = append("select");
    select.id = label.htmlFor;
    const page = controller.getOntologyFacts();
    for (const section of page.sections) {
      append("option", `${section.label} (${section.count})`, select).value =
        section.key;
    }
    const status = append("p");
    status.setAttribute("role", "status");
    const records = append("div");
    records.className = "canonical-facts-records";
    const actions = append("div");
    actions.className = "canonical-merge-actions";
    const previous = append("button", "Previous page", actions);
    const next = append("button", "Next page", actions);
    const dismiss = append("button", "Close", actions);
    for (const control of [previous, next, dismiss]) {
      control.type = "button";
    }
    let offset = 0;

    function value(parent, entry) {
      if (entry === null || typeof entry !== "object") {
        append(
          "span",
          entry === null ? "Not available" : String(entry),
          parent,
        );
        return;
      }
      const keys = Array.isArray(entry) ? null : Object.keys(entry);
      const count = keys ? keys.length : entry.length;
      const list = append("dl", undefined, parent);
      let cursor = 0;
      const more = append("button", "Show more fields", parent);
      more.type = "button";
      const add = () => {
        const end = Math.min(cursor + 25, count);
        for (; cursor < end; cursor++) {
          const key = keys ? keys[cursor] : String(cursor + 1);
          const child = entry[keys ? key : cursor];
          append("dt", words(key), list);
          const field = append("dd", undefined, list);
          if (child && typeof child === "object") {
            const details = append("details", undefined, field);
            append(
              "summary",
              `${Array.isArray(child) ? "Items" : "Fields"}: ${Object.keys(child).length}`,
              details,
            );
            let expanded = false;
            details.addEventListener("toggle", () => {
              if (details.open && !expanded) {
                expanded = true;
                value(details, child);
              }
            });
          } else {
            value(field, child);
          }
        }
        more.hidden = cursor === count;
      };
      more.addEventListener("click", add);
      add();
    }
    const render = () => {
      const result = controller.getOntologyFacts({
        section: select.value,
        offset,
      });
      records.replaceChildren();
      status.textContent = result.total
        ? `${offset + 1}–${offset + result.entries.length} of ${result.total}. Document revision ${result.documentRevision}.`
        : "No records in this section.";
      for (const [index, entry] of result.entries.entries()) {
        const details = append("details", undefined, records);
        append(
          "summary",
          `${offset + index + 1}. ${words(entry?.kind ?? "Record")}${entry?.iri ? ` — ${entry.iri}` : ""}`,
          details,
        );
        let expanded = false;
        details.addEventListener("toggle", () => {
          if (details.open && !expanded) {
            expanded = true;
            value(details, entry);
          }
        });
      }
      previous.disabled = offset === 0;
      next.disabled = offset + result.entries.length >= result.total;
    };
    select.addEventListener("change", () => {
      offset = 0;
      render();
    });
    previous.addEventListener("click", () => {
      offset = Math.max(0, offset - 25);
      render();
    });
    next.addEventListener("click", () => {
      offset += 25;
      render();
    });
    dismiss.addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => {
      if (dialog && !dialog.open) {
        close();
      }
    });
    render();
    doc.body.append(dialog);
    dialog.showModal();
    select.focus();
  }
  button.addEventListener("click", open, { signal: lifecycle.signal });
  return {
    dispose() {
      lifecycle.abort();
      unsubscribe();
      close();
      button.hidden = true;
    },
  };
}
