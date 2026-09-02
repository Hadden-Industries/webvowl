import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

// Interface modules collaborate through the application registry.
const registeredUiModulesForTest = new Map();
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let createSidebar;
let navigableOntologyIri;
let renderOntologyIri;
let sidebarModuleContext;

beforeAll(async () => {
  const moduleUrl = new URL("./sidebar.js", import.meta.url);
  sidebarModuleContext = createContext({
    AbortController,
    URL,
    cancelAnimationFrame: undefined,
    document: undefined,
    navigator: undefined,
    requestAnimationFrame: undefined,
    window: undefined,
  });
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { context: sidebarModuleContext, identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    if (specifier.endsWith("applicationUiRegistry.js")) {
      return new SyntheticModule(
        ["applicationUiModule", "registerApplicationUiModule"],
        function provideApplicationUiRegistry() {
          this.setExport("applicationUiModule", (moduleName) =>
            registeredUiModulesForTest.get(moduleName),
          );
          this.setExport(
            "registerApplicationUiModule",
            (moduleName, uiModule) =>
              registeredUiModulesForTest.set(moduleName, uiModule),
          );
        },
        { context: sidebarModuleContext, identifier: specifier },
      );
    }
    throw new Error(`Unexpected sidebar dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ createSidebar, navigableOntologyIri, renderOntologyIri } =
    sourceModule.namespace);
});

class SidebarElement extends EventTarget {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.innerHTML = "";
    this.nextElementSibling = null;
    this.parentNode = null;
    this.selectedIndex = -1;
    this.textContent = "";
    this.value = "";
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      contains: (className) => this.classes.has(className),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
      toggle: (className, isPresent) => {
        if (isPresent) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }
      },
    };
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  click() {
    this.dispatchEvent(new Event("click"));
  }

  querySelector() {
    return new SidebarElement();
  }

  querySelectorAll() {
    return [];
  }

  remove() {
    const childIndex = this.parentNode?.children.indexOf(this) ?? -1;
    if (childIndex >= 0) {
      this.parentNode.children.splice(childIndex, 1);
    }
    this.parentNode = null;
  }

  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }
}

function createStatistics() {
  return {
    classCount: () => 0,
    datatypePropertyCount: () => 0,
    edgeCount: () => 0,
    individualCount: () => 0,
    nodeCount: () => 0,
    objectPropertyCount: () => 0,
    totalIndividualCount: () => 0,
  };
}

describe("sidebar ontology IRI links", () => {
  test.each([
    ["http://example.org/ontology", "http://example.org/ontology"],
    ["https://example.org/ontology", "https://example.org/ontology"],
    ["urn:isbn:9780141036144", "urn:isbn:9780141036144"],
    ["  urn:example:ontology  ", "urn:example:ontology"],
  ])("allows an explicitly supported IRI scheme for %p", (iri, expected) => {
    expect(navigableOntologyIri(iri)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "file:///tmp/ontology.owl",
    "ftp://example.org/ontology",
    "//example.org/ontology",
    "/relative/ontology",
    "not an IRI",
    "",
    "   ",
    null,
    undefined,
  ])("rejects unsupported or invalid IRI %p", (iri) => {
    expect(navigableOntologyIri(iri)).toBeUndefined();
  });

  test("replaces placeholder text with a link for an allowed IRI", () => {
    const container = new SidebarElement("p");
    container.textContent = "not given";
    const originalDocument = global.document;
    global.document = {
      createElement: (tagName) => new SidebarElement(tagName),
    };
    sidebarModuleContext.document = global.document;

    try {
      renderOntologyIri(container, "urn:example:ontology");
    } finally {
      sidebarModuleContext.document = undefined;
      global.document = originalDocument;
    }

    expect(container.textContent).toBe("");
    expect(container.children).toHaveLength(1);
    expect(container.children[0]).toMatchObject({
      attributes: {
        href: "urn:example:ontology",
        target: "_blank",
        title: "urn:example:ontology",
      },
      tagName: "A",
      textContent: "urn:example:ontology",
    });
    expect(container.children[0].attributes.rel).toBeUndefined();
  });
});

describe("sidebar native language and lifecycle controls", () => {
  let controls;
  let graph;
  let language;
  let sidebar;

  beforeEach(() => {
    controls = new Map();
    const controlFor = (selector) => {
      if (!controls.has(selector)) {
        controls.set(selector, new SidebarElement());
      }
      return controls.get(selector);
    };
    global.document = {
      createElement: (tagName) => new SidebarElement(tagName),
      querySelector: controlFor,
      querySelectorAll: () => [],
    };
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { language: "en-US", languages: ["en-US"] },
    });
    global.requestAnimationFrame = jest.fn((callback) => callback());
    global.cancelAnimationFrame = jest.fn();
    sidebarModuleContext.cancelAnimationFrame = global.cancelAnimationFrame;
    sidebarModuleContext.document = global.document;
    sidebarModuleContext.navigator = global.navigator;
    sidebarModuleContext.requestAnimationFrame = global.requestAnimationFrame;
    sidebarModuleContext.window = { innerWidth: 1280 };
    language = "undefined";
    const languageOperation = jest.fn((nextLanguage) => {
      if (nextLanguage !== undefined) {
        language = nextLanguage;
      }
      return language;
    });
    graph = {
      language: languageOperation,
      options: () => ({
        sidebar: () => ({ showSidebar: jest.fn() }),
      }),
      ontologyEditingState: () => ({
        sidebar: () => ({ showSidebar: jest.fn() }),
      }),
      updateCanvasContainerSize: jest.fn(),
    };
    sidebar = createSidebar(graph, {
      elementTools: {
        isNode: () => false,
        isProperty: () => false,
      },
      languageConstants: {
        iriBasedLanguage: "id",
        undefinedLanguage: "undefined",
      },
      languageTools: {
        textInLanguage: (localizedText) =>
          typeof localizedText === "string" ? localizedText : undefined,
      },
    });
  });

  afterEach(() => {
    sidebar?.dispose();
    sidebarModuleContext.document = undefined;
    sidebarModuleContext.cancelAnimationFrame = undefined;
    sidebarModuleContext.navigator = undefined;
    sidebarModuleContext.requestAnimationFrame = undefined;
    sidebarModuleContext.window = undefined;
    delete global.document;
    delete global.cancelAnimationFrame;
    delete global.navigator;
    delete global.requestAnimationFrame;
  });

  test("renders native option elements without setting the renderer language", () => {
    sidebar.setup();
    sidebar.updateOntologyInformation(
      {
        header: {
          author: [],
          description: "Description",
          languages: ["fr", "en"],
          other: [],
          title: "Title",
        },
      },
      createStatistics(),
    );
    const languageSelect = controls.get("#language");
    expect(languageSelect.children.map(({ value }) => value)).toEqual([
      "en",
      "fr",
    ]);
    expect(languageSelect.value).toBe("en");

    // The language change reaches the controller through the view-controls
    // adapter, so the sidebar must not set it on the renderer itself.
    languageSelect.value = "fr";
    languageSelect.dispatchEvent(new Event("change"));

    expect(language).toBe("en");
  });

  test("renders ontology metadata as inert text", () => {
    graph.ontologyEditingState = () => ({
      getGeneralMetaObject: () => ({
        author: '<img src="invalid" onerror="alert(1)">',
        description: "<script>unexpected()</script>",
        title: "<strong>Ontology title</strong>",
        version: "<em>1.0</em>",
      }),
    });

    sidebar.updateGeneralOntologyInfo();

    expect(controls.get("#title").textContent).toBe(
      "<strong>Ontology title</strong>",
    );
    expect(controls.get("#version").textContent).toBe("<em>1.0</em>");
    expect(controls.get("#authors").textContent).toBe(
      '<img src="invalid" onerror="alert(1)">',
    );
    expect(controls.get("#description").textContent).toBe(
      "<script>unexpected()</script>",
    );
  });

  test("owns only accordion triggers inside the ontology details section", () => {
    const ontologyDetailsSection =
      global.document.querySelector("#generalDetails");
    const ontologyDetailsTrigger = new SidebarElement("h3");
    ontologyDetailsTrigger.nextElementSibling = new SidebarElement();
    const editingDetailsTrigger = new SidebarElement("h3");
    editingDetailsTrigger.nextElementSibling = new SidebarElement();
    ontologyDetailsSection.querySelectorAll = jest.fn((selector) => {
      if (selector === ".accordion-trigger") {
        return [ontologyDetailsTrigger];
      }
      return [];
    });
    global.document.querySelectorAll = jest.fn((selector) => {
      if (selector === ".accordion-trigger") {
        return [ontologyDetailsTrigger, editingDetailsTrigger];
      }
      return [];
    });

    sidebar.setup();

    const simulatedClick = jest.spyOn(ontologyDetailsTrigger, "click");
    const keyboardActivationEvent = new Event("keydown", {
      cancelable: true,
    });
    Object.defineProperty(keyboardActivationEvent, "key", { value: "Enter" });
    ontologyDetailsTrigger.dispatchEvent(keyboardActivationEvent);

    expect(ontologyDetailsTrigger.attributes.role).toBe("button");
    expect(editingDetailsTrigger.attributes.role).toBeUndefined();
    expect(keyboardActivationEvent.defaultPrevented).toBe(true);
    expect(simulatedClick).not.toHaveBeenCalled();
    expect(ontologyDetailsTrigger.classes).toContain(
      "accordion-trigger-active",
    );
  });

  test("setup is idempotent and disposal detaches the language listener", () => {
    sidebar.setup();
    sidebar.setup();
    sidebar.updateOntologyInformation(
      { header: { languages: ["en", "fr"], other: [] } },
      createStatistics(),
    );
    const languageSelect = controls.get("#language");
    graph.language.mockClear();
    sidebar.dispose();
    sidebar.dispose();

    languageSelect.value = "fr";
    languageSelect.dispatchEvent(new Event("change"));

    expect(graph.language).not.toHaveBeenCalled();
  });

  test("replaces and disposes pending transition-suppression frames", () => {
    let nextAnimationFrameId = 0;
    const pendingAnimationFrames = new Map();
    global.requestAnimationFrame = jest.fn((callback) => {
      nextAnimationFrameId += 1;
      pendingAnimationFrames.set(nextAnimationFrameId, callback);
      return nextAnimationFrameId;
    });
    global.cancelAnimationFrame = jest.fn((animationFrameId) => {
      pendingAnimationFrames.delete(animationFrameId);
    });
    sidebarModuleContext.requestAnimationFrame = global.requestAnimationFrame;
    sidebarModuleContext.cancelAnimationFrame = global.cancelAnimationFrame;
    const pageBody = global.document.querySelector("body");

    sidebar.showSidebar(0, true);
    sidebar.showSidebar(1, true);

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(pageBody.classList.contains("no-transition")).toBe(true);

    sidebar.dispose();

    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(pendingAnimationFrames).toEqual(new Map());
    expect(pageBody.classList.contains("no-transition")).toBe(false);
  });
});

describe("sidebar ontology summary presentation", () => {
  let controls;
  let sidebar;

  beforeEach(() => {
    controls = new Map();
    const controlFor = (selector) => {
      if (!controls.has(selector)) {
        controls.set(selector, new SidebarElement());
      }
      return controls.get(selector);
    };
    global.document = {
      createElement: (tagName) => new SidebarElement(tagName),
      querySelector: controlFor,
      querySelectorAll: () => [],
    };
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: { language: "en-US", languages: ["en-US"] },
    });
    global.requestAnimationFrame = jest.fn((callback) => callback());
    global.cancelAnimationFrame = jest.fn();
    sidebarModuleContext.cancelAnimationFrame = global.cancelAnimationFrame;
    sidebarModuleContext.document = global.document;
    sidebarModuleContext.navigator = global.navigator;
    sidebarModuleContext.requestAnimationFrame = global.requestAnimationFrame;
    sidebarModuleContext.window = { innerWidth: 1280 };
    sidebar = createSidebar(
      {
        language: () => "undefined",
        options: () => ({ sidebar: () => ({ showSidebar: jest.fn() }) }),
        ontologyEditingState: () => ({
          sidebar: () => ({ showSidebar: jest.fn() }),
        }),
        updateCanvasContainerSize: jest.fn(),
      },
      {
        elementTools: { isNode: () => false, isProperty: () => false },
        languageConstants: {
          iriBasedLanguage: "id",
          undefinedLanguage: "undefined",
        },
        languageTools: {
          textInLanguage: (localizedText) =>
            typeof localizedText === "string" ? localizedText : undefined,
        },
      },
    );
  });

  afterEach(() => {
    sidebar?.dispose();
    sidebarModuleContext.document = undefined;
    sidebarModuleContext.cancelAnimationFrame = undefined;
    sidebarModuleContext.navigator = undefined;
    sidebarModuleContext.requestAnimationFrame = undefined;
    sidebarModuleContext.window = undefined;
    delete global.document;
  });

  test("renders the header and element counts from a controller summary", () => {
    sidebar.renderOntologySummary({
      ontologyHeader: {
        ontologyIri: "http://xmlns.com/foaf/0.1/",
        versionInformationText: "0.99",
        title: "Friend of a Friend",
        description: "The FOAF vocabulary.",
        authorNames: ["Dan Brickley", "Libby Miller"],
      },
      elementCounts: {
        classCount: 21,
        propertyCount: 44,
        datatypeCount: 6,
        individualCount: 0,
      },
      availableLabelLanguages: ["en", "undefined"],
      selectedLanguage: "en",
    });

    expect(controls.get("#title").textContent).toBe("Friend of a Friend");
    expect(controls.get("#version").textContent).toBe("0.99");
    expect(controls.get("#authors").textContent).toBe(
      "Dan Brickley, Libby Miller",
    );
    expect(controls.get("#description").textContent).toBe(
      "The FOAF vocabulary.",
    );
    expect(controls.get("#classCount").textContent).toBe(21);
  });

  test("falls back to placeholders when the summary omits header text", () => {
    sidebar.renderOntologySummary({
      ontologyHeader: {
        ontologyIri: null,
        versionInformationText: null,
        title: null,
        description: null,
        authorNames: [],
      },
      elementCounts: {
        classCount: 0,
        propertyCount: 0,
        datatypeCount: 0,
        individualCount: 0,
      },
      availableLabelLanguages: [],
      selectedLanguage: null,
    });

    expect(controls.get("#title").textContent).toBe("No title available");
    expect(controls.get("#version").textContent).toBe("--");
    expect(controls.get("#authors").textContent).toBe("--");
    expect(controls.get("#description").textContent).toBe(
      "No description available.",
    );
  });
});
