import { expect, jest, test } from "@jest/globals";
import { createOntologyOverview } from "./ontologyOverview.js";

function fixture() {
  const elements = new Map();
  const doc = { activeElement: null };
  class Element extends EventTarget {
    children = [];
    hidden = false;
    open = false;
    value = "";
    set textContent(value) {
      this.value = String(value);
      this.children = [];
    }
    get textContent() {
      return (
        this.value + this.children.map((child) => child.textContent).join(" ")
      );
    }
    append(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    prepend(child) {
      child.parent = this;
      this.children.unshift(child);
    }
    replaceChildren() {
      this.children = [];
      this.value = "";
    }
    remove() {
      this.parent.children = this.parent.children.filter(
        (child) => child !== this,
      );
    }
    closest() {
      return this.hidden ? this : this.parent?.closest();
    }
    focus() {
      doc.activeElement = this;
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    }
  }
  doc.createElement = (tag) => Object.assign(new Element(), { tag });
  doc.getElementById = (id) => {
    if (!elements.has(id)) {
      elements.set(id, doc.createElement("div"));
    }
    return elements.get(id);
  };
  doc
    .getElementById("ontologyCacheSource")
    .append(doc.getElementById("ontology-sources-open"));
  let state = {
    status: "ready",
    loadGeneration: 1,
    documentRevision: 0,
    warnings: [],
    source: {
      kind: "ontology-document-iri",
      identity: "https://example.test/root",
      cache: {
        loadGeneration: 1,
        documentRevision: 0,
        status: "archived",
        hasUpdate: false,
        sources: [
          {
            requestedDocumentIri: "http://www.w3.org/2004/02/skos/core",
            role: "import",
            acquiredAt: "2026-10-31T00:00:00Z",
            checkedAt: "2026-11-02T00:00:00Z",
            artifactIri: "https://haddenindustries.com/copy",
            checkOutcome: "not-checked",
          },
        ],
      },
    },
  };
  let listener;
  const unsubscribe = jest.fn();
  const controller = {
    getState: () => state,
    subscribeToState: (fn) => {
      listener = fn;
      return unsubscribe;
    },
    refreshOntologySource: jest.fn(async () => {}),
  };
  const overview = createOntologyOverview({
    controller,
    documentObject: doc,
    hideNavigationMenus: jest.fn(),
    openFacts: jest.fn(),
    reloadSource: jest.fn(),
  });
  const publish = (next) => {
    state = next;
    listener(state, ["source"]);
  };
  return {
    doc,
    controller,
    overview,
    publish,
    state,
    unsubscribe,
    get: (id) => doc.getElementById(id),
  };
}

test("View sources focuses the source heading and close returns to its visible invoker", () => {
  const h = fixture();
  h.get("ontology-sources-open").dispatchEvent(new Event("click"));
  expect(h.get("ontology-overview-dialog").open).toBe(true);
  expect(h.doc.activeElement).toBe(h.get("ontology-source-heading"));
  h.get("ontology-overview-dialog").close();
  expect(h.doc.activeElement).toBe(h.get("ontology-sources-open"));
  h.get("ontology-sources-open").dispatchEvent(new Event("click"));
  h.get("ontologyCacheSource").hidden = true;
  h.get("ontology-overview-dialog").close();
  expect(h.doc.activeElement).toBe(h.get("ontology-menu-open"));
  h.overview.dispose();
  expect(h.unsubscribe).toHaveBeenCalledTimes(1);
});

test("status changes keep expanded technical details and a focused document link intact", () => {
  const h = fixture();
  const root = h.get("ontology-source-provenance").children[0];
  const technical = root.children.find((child) => child.tag === "details");
  const link = root.children.find((child) => child.tag === "dl").children[0]
    .children[1].children[0];
  technical.open = true;
  link.focus();
  h.publish({
    ...h.state,
    source: {
      ...h.state.source,
      cache: { ...h.state.source.cache, status: "checking" },
    },
  });
  expect(h.get("ontology-source-provenance").children[0]).toBe(root);
  expect(technical.open).toBe(true);
  expect(h.doc.activeElement).toBe(link);
  expect(h.get("ontology-overview-check-sources").disabled).toBe(true);
  h.overview.dispose();
});

test("a replacement root remains before retained imports and clears old source cards", () => {
  const h = fixture();
  h.publish({
    ...h.state,
    source: { ...h.state.source, identity: "https://example.test/replacement" },
  });
  const cards = h.get("ontology-source-provenance").children;
  expect(cards).toHaveLength(2);
  expect(cards[0].children[0].textContent).toBe("Selected ontology");
  expect(cards[0].textContent).toContain("https://example.test/replacement");
  expect(cards[0].textContent).not.toContain("https://example.test/root");
  expect(cards[1].children[0].textContent).toBe("Imported ontology: SKOS");
  h.overview.dispose();
});

test("parsing findings have a readable summary and retain their original diagnostics", () => {
  const h = fixture();
  h.publish({
    ...h.state,
    warnings: [
      "Original source assessment (invalid): UNDECLARED_ENTITY.",
      "Excluded source constructor: DifferentIndividuals; its annotations are excluded.",
    ],
  });
  expect(h.get("ontology-overview-notes").hidden).toBe(false);
  expect(h.get("ontology-overview-notes-summary").textContent).toContain(
    "Source assessment reported issues",
  );
  expect(h.get("ontology-overview-notes-summary").textContent).toContain(
    "not shown in this visualization",
  );
  expect(h.get("ontology-overview-warnings").textContent).toContain(
    "UNDECLARED_ENTITY",
  );
  expect(h.get("ontology-overview-warnings").textContent).toContain(
    "DifferentIndividuals",
  );
  h.overview.dispose();
});

test("an intervening edit disables both update actions in the overview", () => {
  const h = fixture();
  h.publish({
    ...h.state,
    documentRevision: 1,
    source: {
      ...h.state.source,
      cache: { ...h.state.source.cache, hasUpdate: true },
    },
  });
  expect(h.get("ontology-overview-check-sources").disabled).toBe(true);
  expect(h.get("ontology-overview-apply-sources").disabled).toBe(true);
  expect(h.get("ontology-overview-source-status").textContent).toContain(
    "graph has edits",
  );
  h.overview.dispose();
});
