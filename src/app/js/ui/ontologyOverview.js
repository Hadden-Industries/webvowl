import { runVisualizationControlAction } from "./visualizationControlAction.js";
import {
  formatSourceDate,
  presentOntologySources,
  sourceCheckDescription,
  sourceWebUrl,
} from "./ontologySourcePresentation.js";

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
  const sourcesInvoker = doc.getElementById("ontology-sources-open");
  const sourceHeading = doc.getElementById("ontology-source-heading");
  const sourceStatus = doc.getElementById("ontology-overview-source-status");
  const sourceHelp = doc.getElementById("ontology-source-check-help");
  const sourceActions = doc.getElementById("ontology-overview-source-actions");
  const checkSources = doc.getElementById("ontology-overview-check-sources");
  const applySources = doc.getElementById("ontology-overview-apply-sources");
  const chip = doc.getElementById("ontology-title-chip");
  const facts = doc.getElementById("ontology-overview-facts");
  const reload = doc.getElementById("ontology-overview-reload");
  const provenance = doc.getElementById("ontology-source-provenance");
  const warnings = doc.getElementById("ontology-overview-warnings");
  const notes = doc.getElementById("ontology-overview-notes");
  const notesSummary = doc.getElementById("ontology-overview-notes-summary");
  const content = doc.getElementById("ontology-overview-content");
  const sourceCards = new Map();
  let returnFocus = invoker;
  let importedIris = [];
  let summaryGeneration;
  doc.getElementById("ontology-overview-body").append(content);

  function on(element, type, listener) {
    element.addEventListener(type, listener, { signal: lifecycle.signal });
  }
  function open(fromSources) {
    returnFocus = fromSources
      ? sourcesInvoker
      : doc.getElementById("ontology-menu-open");
    hideNavigationMenus();
    dialog.showModal();
    (fromSources
      ? sourceHeading
      : doc.getElementById("ontology-overview-heading")
    ).focus();
  }
  on(invoker, "click", () => open(false));
  on(sourcesInvoker, "click", () => open(true));
  on(dialog, "close", () => {
    (returnFocus.closest("[hidden]")
      ? doc.getElementById("ontology-menu-open")
      : returnFocus
    ).focus();
  });
  for (const [button, action] of [
    [checkSources, "refreshOntologySource"],
    [applySources, "applyOntologySourceUpdate"],
  ]) {
    on(button, "click", async () => {
      button.disabled = true;
      if (action === "applyOntologySourceUpdate") {
        returnFocus = doc.getElementById("ontology-menu-open");
        dialog.close();
      }
      try {
        await controller[action]();
      } catch {
        // The source observer publishes the scoped failure and preserves the graph.
      } finally {
        if (!lifecycle.signal.aborted) {
          renderState(controller.getState());
        }
      }
    });
  }
  on(facts, "click", () => openFacts(facts));
  on(reload, "click", () => {
    dialog.close();
    void runVisualizationControlAction(reloadSource, doc);
  });

  function element(tag, parent, text) {
    const child = doc.createElement(tag);
    if (text !== undefined) {
      child.textContent = text;
    }
    parent.append(child);
    return child;
  }

  function field(rows, list, label, value, link = false) {
    let row = rows.get(label);
    if (!row) {
      const group = element("div", list);
      element("dt", group, label);
      row = { group, definition: element("dd", group) };
      rows.set(label, row);
    }
    row.group.hidden = value === undefined || value === null;
    const url = link && sourceWebUrl(value);
    if (url) {
      if (!row.link) {
        row.definition.replaceChildren();
        row.link = element("a", row.definition);
      }
      row.link.href = url;
      row.link.textContent = value;
    } else {
      row.link = undefined;
      row.definition.textContent = value ?? "";
    }
  }

  function renderSources(state) {
    const presentation = presentOntologySources(
      state,
      summaryGeneration === state.loadGeneration ? importedIris : [],
    );
    const hasSavedCopies = Boolean(state.source?.cache?.sources.length);
    sourceStatus.hidden = !hasSavedCopies;
    if (sourceStatus.textContent !== presentation.message) {
      sourceStatus.textContent = presentation.message;
    }
    sourceHelp.hidden = !hasSavedCopies;
    sourceActions.hidden = !hasSavedCopies;
    checkSources.textContent = presentation.checkLabel;
    checkSources.disabled =
      !presentation.visible || presentation.expired || presentation.checking;
    applySources.hidden = !presentation.hasUpdate;
    applySources.disabled =
      !presentation.visible || presentation.expired || presentation.checking;
    const present = new Set();
    for (const source of presentation.sources) {
      const key = source.requestedDocumentIri ?? source.kind;
      present.add(key);
      let card = sourceCards.get(key);
      if (!card) {
        const article = doc.createElement("article");
        if (source.role === "ontology") {
          provenance.prepend(article);
        } else {
          provenance.append(article);
        }
        article.className = "ontology-source-document";
        const heading = element("h4", article);
        const description = element("p", article);
        const status = element("p", article);
        const list = element("dl", article);
        const technical = element("details", article);
        element("summary", technical, "Technical details");
        card = {
          article,
          heading,
          description,
          status,
          list,
          technical,
          technicalList: element("dl", technical),
          rows: new Map(),
          technicalRows: new Map(),
        };
        sourceCards.set(key, card);
      }
      const role =
        source.role === "ontology"
          ? source.kind?.startsWith("vowl-json")
            ? "Selected visualization"
            : "Selected ontology"
          : "Imported ontology";
      card.heading.textContent =
        source.label === source.requestedDocumentIri
          ? role
          : `${role}: ${source.label}`;
      card.description.textContent = source.description;
      card.status.textContent = source.saved
        ? sourceCheckDescription(source)
        : "";
      card.status.hidden = !card.status.textContent;
      field(
        card.rows,
        card.list,
        "Document identifier",
        source.requestedDocumentIri,
        true,
      );
      field(
        card.rows,
        card.list,
        "Publisher document URL",
        source.retrievalIri === source.requestedDocumentIri
          ? undefined
          : source.retrievalIri,
        true,
      );
      field(
        card.rows,
        card.list,
        "Loaded copy saved",
        source.saved ? formatSourceDate(source.acquiredAt) : undefined,
      );
      field(
        card.rows,
        card.list,
        "Last successful check for source changes",
        source.saved ? formatSourceDate(source.checkedAt) : undefined,
      );
      for (const [label, value] of [
        ["Saved document URL", source.artifactIri],
        ["Recorded retrieval URL", source.retrievalIri],
        ["Loaded source version", source.sourceVersionIdentity],
        ["Loaded resolution", source.resolutionIdentity],
        ["Source key", source.sourceKey],
        ["Copy saved (UTC)", source.acquiredAt],
        ["Last successful check (UTC)", source.checkedAt],
        ["Check outcome", source.checkOutcome],
        ["Diagnostic code", source.code],
        ["Update selection diagnostic", source.updateFailure?.code],
        ["Source kind", source.kind],
        [
          "SHA-256",
          source.role === "ontology" ? state.source?.sha256 : undefined,
        ],
      ]) {
        field(card.technicalRows, card.technicalList, label, value);
      }
    }
    for (const [key, card] of sourceCards) {
      if (!present.has(key)) {
        card.article.remove();
        sourceCards.delete(key);
      }
    }
  }

  function renderState(state) {
    const hasDocument = state.loadGeneration > 0 && state.source !== null;
    const readable =
      hasDocument && !["idle", "loading", "disposed"].includes(state.status);
    facts.disabled = !readable;
    reload.disabled =
      !readable ||
      !["ontology-document-iri", "vowl-json-url"].includes(state.source?.kind);
    content.hidden = !hasDocument;
    renderSources(state);
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
    const messages = [...(state.warnings ?? [])].map((warning) =>
      typeof warning === "string"
        ? warning
        : (warning.message ?? warning.code ?? ""),
    );
    notes.hidden = messages.length === 0 && !state.error;
    const descriptions = [];
    if (messages.some((message) => message.includes("assessment (invalid)"))) {
      descriptions.push("Source assessment reported issues.");
    }
    if (
      messages.some((message) => message.includes("assessment (unverified)"))
    ) {
      descriptions.push(
        "Some source assessment results could not be verified.",
      );
    }
    if (
      messages.some((message) =>
        message.includes("Excluded source constructor"),
      )
    ) {
      descriptions.push(
        "Some ontology statements are not shown in this visualization.",
      );
    }
    notesSummary.textContent =
      [state.error?.message, ...descriptions].filter(Boolean).join(" ") ||
      "Loading reported additional notes. Review the details below.";
    if (!hasDocument) {
      chip.textContent = "No ontology loaded";
    }
  }
  renderState(controller.getState());
  const unsubscribe = controller.subscribeToState((state, fields) => {
    if (
      fields.some((field) =>
        [
          "status",
          "source",
          "warnings",
          "error",
          "loadGeneration",
          "documentRevision",
        ].includes(field),
      )
    ) {
      renderState(state);
    }
  });
  return Object.freeze({
    renderSummary(summary) {
      chip.textContent = summary.ontologyHeader.title || "Untitled ontology";
      importedIris = (summary.imports ?? []).map(
        (source) => source.importedOntologyIri,
      );
      summaryGeneration = controller.getState().loadGeneration;
      renderSources(controller.getState());
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
