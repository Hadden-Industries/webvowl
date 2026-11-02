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
    applyOntologySourceUpdate: jest.fn(async () => {}),
  };
  const overview = createOntologyOverview({
    controller,
    documentObject: doc,
    hideNavigationMenus: jest.fn(),
    openFacts: jest.fn(),
    reloadSource: jest.fn(),
  });
  const publish = (next, fields = ["source"]) => {
    state = next;
    listener(state, fields);
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

test("Overview focuses its heading and returns focus to the Ontology menu button", () => {
  const h = fixture();
  h.get("ontology-overview-open").dispatchEvent(new Event("click"));
  expect(h.get("ontology-overview-dialog").open).toBe(true);
  expect(h.doc.activeElement).toBe(h.get("ontology-overview-heading"));
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
  h.publish(
    {
      ...h.state,
      documentRevision: 1,
      source: {
        ...h.state.source,
        cache: { ...h.state.source.cache, hasUpdate: true },
      },
    },
    ["documentRevision"],
  );
  expect(h.get("ontology-overview-check-sources").disabled).toBe(true);
  expect(h.get("ontology-overview-apply-sources").disabled).toBe(true);
  expect(h.get("ontology-overview-source-status").textContent).toContain(
    "graph has edits",
  );
  h.overview.dispose();
});

test.each([
  [
    "ontology-overview-apply-sources",
    "applyOntologySourceUpdate",
    "update-failed",
    "CACHE_OFFER_SUPERSEDED",
    "The available update changed. Check for source updates again before reloading.",
  ],
  [
    "ontology-overview-check-sources",
    "refreshOntologySource",
    "check-failed",
    "CACHE_UNAVAILABLE",
    "Couldn’t check SKOS for changes. The loaded graph is still available.",
  ],
])(
  "Overview preserves the graph and presents a failed %s action",
  async (button, action, status, code, message) => {
    const h = fixture();
    h.publish({
      ...h.state,
      source: {
        ...h.state.source,
        cache: { ...h.state.source.cache, hasUpdate: true },
      },
    });
    h.get("ontology-overview-open").dispatchEvent(new Event("click"));
    h.controller[action].mockImplementation(async () => {
      h.publish({
        ...h.state,
        source: {
          ...h.state.source,
          cache: { ...h.state.source.cache, status, code, hasUpdate: false },
        },
      });
      throw new Error("Source action failed");
    });
    h.get(button).dispatchEvent(new Event("click"));
    await new Promise((resolve) => setImmediate(resolve));
    expect(h.controller[action]).toHaveBeenCalledTimes(1);
    expect(h.controller.getState().status).toBe("ready");
    expect(h.get("ontology-overview-dialog").open).toBe(true);
    if (action === "applyOntologySourceUpdate") {
      expect(h.doc.activeElement).toBe(h.get("ontology-overview-heading"));
    }
    expect(h.get("ontology-overview-source-status").textContent).toBe(message);
    expect(h.get("ontology-overview-apply-sources").hidden).toBe(true);
    expect(h.get("ontology-overview-check-sources").disabled).toBe(false);
    h.overview.dispose();
  },
);

test("Overview stays open while applying an update and closes after success", async () => {
  const h = fixture();
  h.publish({
    ...h.state,
    source: {
      ...h.state.source,
      cache: { ...h.state.source.cache, hasUpdate: true },
    },
  });
  let finish;
  h.controller.applyOntologySourceUpdate.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  h.get("ontology-overview-open").dispatchEvent(new Event("click"));
  h.get("ontology-overview-apply-sources").dispatchEvent(new Event("click"));
  expect(h.get("ontology-overview-dialog").open).toBe(true);
  expect(h.get("ontology-overview-apply-sources").disabled).toBe(true);
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  expect(h.get("ontology-overview-dialog").open).toBe(false);
  expect(h.doc.activeElement).toBe(h.get("ontology-menu-open"));
  h.overview.dispose();
});
