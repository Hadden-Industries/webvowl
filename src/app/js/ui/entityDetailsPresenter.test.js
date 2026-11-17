import { expect, jest, test } from "@jest/globals";
import { createEntityDetailsPresenter } from "./entityDetailsPresenter.js";

// A small real tree: the presenter builds content by appending elements, so
// the tests read back what a reader would see rather than recorded calls.
class FakeElement extends EventTarget {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.hidden = false;
    this.className = "";
    this.ownText = "";
  }
  set textContent(text) {
    this.children = [];
    this.ownText = String(text);
  }
  get textContent() {
    return (
      this.ownText + this.children.map((child) => child.textContent).join("")
    );
  }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    this.ownText = "";
    this.append(...children);
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  contains(candidate) {
    for (let node = candidate; node; node = node.parentElement) {
      if (node === this) {
        return true;
      }
    }
    return false;
  }
  matches(selector) {
    return selector.split(",").some((alternative) => {
      const simple = alternative.trim();
      if (simple.startsWith("#")) {
        return this.id === simple.slice(1);
      }
      if (simple.startsWith(".")) {
        return this.className.split(" ").includes(simple.slice(1));
      }
      const attribute = /^\[([a-z-]+)="([^"]*)"\]$/u.exec(simple);
      return attribute
        ? this.getAttribute(attribute[1]) === attribute[2]
        : this.tagName === simple.toUpperCase();
    });
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) {
        return node;
      }
    }
    return null;
  }
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelectorAll(selector) {
    return this.descendants().filter((element) => element.matches(selector));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  focus() {
    this.ownerDocument.activeElement = this;
  }
  click() {
    this.dispatchEvent(new Event("click"));
  }
}

/** What a reader sees: one `tag.class: text` line per leaf, in order. */
function visibleLines(element) {
  return element.children.flatMap((child) =>
    child.children.length &&
    !["P", "BUTTON", "H2", "H3", "DT"].includes(child.tagName)
      ? visibleLines(child)
      : [
          child.tagName.toLowerCase() +
            (child.className ? "." + child.className : "") +
            ": " +
            child.textContent,
        ],
  );
}

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const classReference = Object.freeze({
  kind: "class",
  roleKind: "class",
  iri: "https://example.test/Organization",
});

function describeOrganization(more = {}) {
  return {
    ontologyElementReference: classReference,
    kind: "class",
    elementTypeName: "class",
    displayLabel: "Organization",
    iri: classReference.iri,
    commentText: "A body of people. With a second sentence.",
    descriptionText: null,
    annotationRecords: [
      {
        localName: "definition",
        propertyIri: SKOS + "definition",
        languageTag: "en",
        text: "An organised group with a purpose.",
        valueKind: "literal",
      },
      {
        localName: "definition",
        propertyIri: SKOS + "definition",
        languageTag: "de",
        text: "Eine Gruppe mit einem Zweck.",
        valueKind: "literal",
      },
      {
        localName: "source",
        propertyIri: "http://purl.org/dc/terms/source",
        languageTag: null,
        text: "ISO/IEC 11179-3",
        valueKind: "literal",
      },
    ],
    characteristicNames: [],
    unclassifiedAttributeNames: [],
    superclassElements: [
      {
        ontologyElementReference: {
          kind: "class",
          roleKind: "class",
          iri: "https://example.test/Agent",
        },
        displayLabel: "Agent",
        iri: "https://example.test/Agent",
      },
    ],
    equivalentClassElements: [],
    disjointClassElements: [],
    individualElements: [],
    ...more,
  };
}

function setup({
  selection = [classReference],
  language = "en",
  detailsOpen = false,
  occurrenceCount = 1,
} = {}) {
  const documentObject = Object.assign(new EventTarget(), {
    activeElement: null,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      element.ownerDocument = documentObject;
      return element;
    },
    elements: new Map(),
    getElementById(id) {
      if (!this.elements.has(id)) {
        const element = this.createElement("div");
        element.id = id;
        this.elements.set(id, element);
      }
      return this.elements.get(id);
    },
  });
  const element = (id) => documentObject.getElementById(id);
  // The slots the page nests inside the graph's expansion element. The name
  // stands outside the section, which is hidden whenever nothing is described.
  element("graph").append(element("occurrence-expansion"));
  element("occurrence-expansion").append(
    element("entity-preview-heading"),
    element("entity-preview"),
  );
  element("entity-preview-heading").append(element("entity-preview-name"));
  element("entity-preview").append(
    element("entity-preview-body"),
    element("entity-preview-complete"),
  );
  element("detailsArea").append(element("entity-full-details"));
  let state = {
    loadGeneration: 1,
    documentRevision: 0,
    status: "ready",
    selection,
    view: { language },
    editorMode: { isEditorMode: false },
  };
  const controller = {
    getState: () => state,
    getSelectedVisualizationOccurrence: () =>
      state.selection.length ? { occurrenceCount } : null,
    selectVisualizationElement: jest.fn(async ({ reference }) => {
      state = { ...state, selection: reference === null ? [] : [reference] };
    }),
    describeOntologyElements: jest.fn(),
  };
  const surface = {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    openDetails: jest.fn(),
    closeDetails: jest.fn(),
    isOpen: () => detailsOpen,
  };
  const presenter = createEntityDetailsPresenter({
    controller,
    surface,
    documentObject,
    openFacts: jest.fn(),
    scheduleRefresh: jest.fn(),
  });
  return {
    presenter,
    controller,
    surface,
    documentObject,
    element,
    setState(next) {
      state = { ...state, ...next };
    },
    press(target, type = "pointerdown", init = {}) {
      const event = Object.assign(new Event(type, { cancelable: true }), init);
      Object.defineProperty(event, "target", { value: target });
      documentObject.dispatchEvent(event);
      return event;
    },
  };
}

test("the summary shows the label, type symbol, IRI, first sentence, curated annotations and relations", () => {
  const { presenter, element } = setup({ occurrenceCount: 3 });
  presenter.render([describeOrganization()]);
  expect(element("entity-preview").hidden).toBe(false);
  expect(element("entity-preview-name").textContent).toBe("Organization");
  expect(visibleLines(element("entity-preview-body"))).toEqual([
    "p.entity-preview-type: ○class",
    "p.entity-preview-iri: https://example.test/Organization",
    "p: A body of people.",
    "p.entity-preview-annotation: DefinitionAn organised group with a purpose.",
    "p.entity-preview-annotation: SourceISO/IEC 11179-3",
    "p: Superclasses: Agent",
    "p: 0 individuals · 0 disjoint classes",
    "p: Drawn 3 times",
  ]);
  const [symbol] = element("entity-preview-body").querySelectorAll(
    ".entity-type-symbol",
  );
  expect(symbol.getAttribute("aria-hidden")).toBe("true");
  // Everything below the identity is the summary, which the complete view
  // replaces rather than repeats.
  const [summary] = element("entity-preview-body").querySelectorAll(
    ".entity-preview-summary",
  );
  expect(visibleLines(summary)).toHaveLength(6);
});

test("the name is one lasting element: given new text, never replaced or cleared", () => {
  const { presenter, element } = setup();
  const heading = element("entity-preview-heading");
  const name = element("entity-preview-name");
  // The renderer carries this element between the node's label and its place
  // in the expansion, and names it first, before any description arrives.
  name.textContent = "Organisation, as drawn";
  presenter.render([describeOrganization()]);
  expect(name.textContent).toBe("Organization");
  presenter.render([describeOrganization({ displayLabel: "Organisation" })]);
  expect(name.textContent).toBe("Organisation");
  expect(heading.children).toEqual([name]);
  // With nothing described, the name the renderer wrote is all there is.
  name.textContent = "Thing, as drawn";
  presenter.render([]);
  presenter.renderEditorMode(true);
  presenter.dispose();
  expect(name.textContent).toBe("Thing, as drawn");
  expect(heading.children).toEqual([name]);
});

test("a curated annotation is shown in the reader's language and says which", () => {
  const { presenter, element } = setup({ language: "de" });
  presenter.render([describeOrganization()]);
  const [definition] = element("entity-preview-body").querySelectorAll(
    ".entity-preview-annotation",
  );
  expect(definition.textContent).toBe("DefinitionEine Gruppe mit einem Zweck.");
  expect(definition.children.at(-1).lang).toBe("de");
});

test("the complete view lists every field inside the expansion without opening Details", () => {
  const { presenter, surface, element } = setup();
  presenter.render([describeOrganization()]);
  const complete = element("entity-preview-complete");
  expect(complete.querySelector("h3").textContent).toBe("Organization — Class");
  expect(
    complete.querySelectorAll("dt").map((term) => term.textContent),
  ).toEqual(
    expect.arrayContaining([
      "Type",
      "Comment",
      "Annotations",
      "Superclasses",
      "Disjoint classes",
      "Individuals",
    ]),
  );
  // The complete sentence the summary shortened is available here.
  expect(complete.textContent).toContain("With a second sentence.");
  expect(surface.openDetails).not.toHaveBeenCalled();
  expect(element("entity-full-details").textContent).toBe(
    "Select an element in the visualization or use Search.",
  );
});

test("an empty selection and the editor both leave nothing to expand into", () => {
  const { presenter, element } = setup();
  presenter.render([describeOrganization()]);
  presenter.renderEditorMode(true);
  expect(element("entity-preview").hidden).toBe(true);
  presenter.renderEditorMode(false);
  expect(element("entity-preview").hidden).toBe(false);
  presenter.render([]);
  expect(element("entity-preview").hidden).toBe(true);
});

test("pressing a menu clears the selection through the controller; the graph, its zoom control and Details do not", async () => {
  const { presenter, controller, documentObject, element, press } = setup();
  presenter.render([describeOrganization()]);
  const within = (id) => {
    const child = documentObject.createElement("button");
    element(id).append(child);
    return child;
  };
  const dialog = documentObject.createElement("dialog");
  const dialogButton = documentObject.createElement("button");
  dialog.append(dialogButton);
  for (const kept of [
    within("graph"),
    within("entity-preview-body"),
    within("zoomSlider"),
    within("detailsArea"),
    dialogButton,
  ]) {
    press(kept);
  }
  expect(controller.selectVisualizationElement).not.toHaveBeenCalled();
  press(within("optionsContainer"));
  expect(controller.selectVisualizationElement).toHaveBeenCalledTimes(1);
  expect(controller.selectVisualizationElement).toHaveBeenCalledWith({
    reference: null,
  });
  await Promise.resolve();
  // Nothing is selected now, so a further press reports nothing.
  press(within("optionsContainer"));
  expect(controller.selectVisualizationElement).toHaveBeenCalledTimes(1);
});

test("Escape clears the selection unless a dialog or another handler owns the key", () => {
  const { presenter, controller, documentObject, element, press } = setup();
  presenter.render([describeOrganization()]);
  const dialog = documentObject.createElement("dialog");
  press(dialog, "keydown", { key: "Escape" });
  press(element("graph"), "keydown", { key: "Enter" });
  const handled = new Event("keydown", { cancelable: true });
  handled.preventDefault();
  Object.assign(handled, { key: "Escape" });
  Object.defineProperty(handled, "target", { value: element("graph") });
  documentObject.dispatchEvent(handled);
  expect(controller.selectVisualizationElement).not.toHaveBeenCalled();
  press(element("graph"), "keydown", { key: "Escape" });
  expect(controller.selectVisualizationElement).toHaveBeenCalledWith({
    reference: null,
  });
});

test("the editor keeps its selection when a panel is pressed", () => {
  const { presenter, controller, documentObject, press } = setup();
  presenter.render([describeOrganization()]);
  presenter.renderEditorMode(true);
  press(documentObject.createElement("button"));
  press(documentObject.createElement("button"), "keydown", { key: "Escape" });
  expect(controller.selectVisualizationElement).not.toHaveBeenCalled();
});

test("disposal stops listening to the page", () => {
  const { presenter, controller, documentObject, press } = setup();
  presenter.render([describeOrganization()]);
  presenter.dispose();
  press(documentObject.createElement("button"));
  expect(controller.selectVisualizationElement).not.toHaveBeenCalled();
});

test.each([false, true])(
  "Details reads and restores scroll only while open: %s",
  (detailsOpen) => {
    const { presenter, element } = setup({ selection: [], detailsOpen });
    const readScroll = jest.fn(() => 37);
    const restoreScroll = jest.fn();
    element("entity-full-details").parentElement = Object.defineProperty(
      {},
      "scrollTop",
      { get: readScroll, set: restoreScroll },
    );
    try {
      presenter.render([]);
      expect(readScroll).toHaveBeenCalledTimes(detailsOpen ? 1 : 0);
      expect(restoreScroll.mock.calls).toEqual(detailsOpen ? [[37]] : []);
    } finally {
      presenter.dispose();
    }
  },
);
