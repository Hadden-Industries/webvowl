import { runVisualizationControlAction } from "./visualizationControlAction.js";

/** Owns the overview surface; metadata remains with its existing summary reader. */
export function createOntologyOverview({
  controller,
  documentObject = document,
  openFacts,
  reloadSource,
  hideNavigationMenus,
}) {
  const doc = documentObject;
  const lifecycle = new AbortController();
  const dialog = doc.getElementById("ontology-overview-dialog");
  const invoker = doc.getElementById("ontology-overview-open");
  const chip = doc.getElementById("ontology-title-chip");
  const facts = doc.getElementById("ontology-overview-facts");
  const reload = doc.getElementById("ontology-overview-reload");
  const provenance = doc.getElementById("ontology-source-provenance");
  const warnings = doc.getElementById("ontology-overview-warnings");
  const content = doc.getElementById("ontology-overview-content");
  doc.getElementById("ontology-overview-body").append(content);

  function on(element, type, listener) {
    element.addEventListener(type, listener, { signal: lifecycle.signal });
  }
  on(invoker, "click", () => {
    hideNavigationMenus();
    dialog.showModal();
    doc.getElementById("ontology-overview-heading").focus();
  });
  on(dialog, "close", () => invoker.focus());
  on(facts, "click", () => openFacts(facts));
  on(reload, "click", () => {
    dialog.close();
    void runVisualizationControlAction(reloadSource, doc);
  });

  function renderState(state) {
    const hasDocument = state.loadGeneration > 0 && state.source !== null;
    const readable =
      hasDocument && !["idle", "loading", "disposed"].includes(state.status);
    facts.disabled = !readable;
    reload.disabled =
      !readable ||
      !["ontology-document-iri", "vowl-json-url"].includes(state.source?.kind);
    content.hidden = !hasDocument;
    provenance.replaceChildren();
    for (const [label, value] of [
      ["Source kind", state.source?.kind],
      ["Identity", state.source?.identity],
      ["Name", state.source?.displayName],
      ["SHA-256", state.source?.sha256],
      ["Status", state.status],
    ]) {
      if (value !== undefined && value !== null) {
        const term = doc.createElement("dt");
        term.textContent = label;
        const definition = doc.createElement("dd");
        definition.textContent = String(value);
        provenance.append(term, definition);
      }
    }
    warnings.replaceChildren();
    for (const warning of state.warnings ?? []) {
      const item = doc.createElement("li");
      item.textContent =
        typeof warning === "string"
          ? warning
          : (warning.message ?? warning.code ?? "Source qualification");
      warnings.append(item);
    }
    if (state.error?.message) {
      const item = doc.createElement("li");
      item.textContent = state.error.message;
      warnings.append(item);
    }
    if (!hasDocument) {
      chip.textContent = "No ontology loaded";
    }
  }
  renderState(controller.getState());
  const unsubscribe = controller.subscribeToState((state, fields) => {
    if (
      fields.some((field) =>
        ["status", "source", "warnings", "error", "loadGeneration"].includes(
          field,
        ),
      )
    ) {
      renderState(state);
    }
  });
  return Object.freeze({
    renderSummary(summary) {
      chip.textContent = summary.ontologyHeader.title || "Untitled ontology";
    },
    dispose() {
      lifecycle.abort();
      unsubscribe();
      if (dialog.open) {
        dialog.close();
      }
    },
  });
}
