import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import loadEsmModuleForTest from "../test/loadEsmModuleForTest.js";

let createOntologyEditorSidebar;
let documentOperations;
beforeAll(async () => {
  documentOperations = await loadEsmModuleForTest(
    new URL("./controller/vowlDocument.js", import.meta.url),
    import.meta.url,
  );
  ({ createOntologyEditorSidebar } = await loadEsmModuleForTest(
    new URL("./ontologyEditorSidebar.js", import.meta.url),
    import.meta.url,
  ));
});

class EditorControl extends EventTarget {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName;
    this.children = [];
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, force = !this.classes.has(name)) => {
        if (force) {
          this.classes.add(name);
        } else {
          this.classes.delete(name);
        }
        return force;
      },
    };
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }
  setAttribute(name, value) {
    this[name] = value;
  }
  getAttribute(name) {
    return this[name] ?? null;
  }
  querySelectorAll() {
    return [];
  }
  focus() {}
  click() {
    if (!this.disabled) {
      this.dispatchEvent(new Event("click"));
    }
  }
  remove() {
    this.parentNode.children = this.parentNode.children.filter(
      (child) => child !== this,
    );
  }
}

function findById(element, id) {
  if (element.id === id) {
    return element;
  }
  for (const child of element.children) {
    const match = findById(child, id);
    if (match) {
      return match;
    }
  }
  return undefined;
}

function keyboardEvent(key) {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  return event;
}

async function flushOperations() {
  for (let index = 0; index < 12; index++) {
    await Promise.resolve();
  }
}

describe("ontology editor sidebar through application document operations", () => {
  let controls,
    document,
    model,
    state,
    controller,
    sidebar,
    warning,
    confirmDeletion,
    subscribers;
  const target = { collection: "class", recordId: "a" };
  beforeEach(() => {
    controls = new Map();
    const getControl = (id) => {
      for (const root of controls.values()) {
        const match = findById(root, id);
        if (match) {
          return match;
        }
      }
      if (!controls.has(id)) {
        const control = new EditorControl();
        control.id = id;
        controls.set(id, control);
      }
      return controls.get(id);
    };
    document = {
      querySelector: (selector) => getControl(selector.slice(1)),
      getElementById: getControl,
      createElement: (tag) => new EditorControl(tag),
      createElementNS: (_namespace, tag) => new EditorControl(tag),
    };
    model = {
      header: {
        iri: "https://example.com/ontology#",
        title: { en: "Example" },
        prefixList: { ex: "https://example.com/ontology#" },
      },
      class: [
        { id: "a", type: "owl:Class" },
        { id: "peer", type: "owl:Class" },
      ],
      classAttribute: [
        {
          id: "a",
          iri: "https://example.com/ontology#Person",
          label: { en: "Person", de: "Person DE" },
        },
        {
          id: "peer",
          iri: "https://example.com/ontology#Person",
          label: { en: "Peer" },
        },
      ],
    };
    state = {
      status: "ready",
      loadGeneration: 1,
      selectedDocumentRecord: target,
      editorMode: { isEditorMode: true },
      view: { language: "en" },
    };
    subscribers = new Set();
    const accepted = (changedModel) => {
      model = changedModel;
      state = { ...state, loadGeneration: state.loadGeneration + 1 };
      subscribers.forEach((listener) => listener(state, ["loadGeneration"]));
      return Promise.resolve(state);
    };
    controller = {
      getState: () => state,
      getOntologyDocument: () => ({
        loadGeneration: state.loadGeneration,
        vowlModel: documentOperations.createVowlDocumentSnapshot(model),
      }),
      subscribeToState: (listener) => {
        subscribers.add(listener);
        return () => subscribers.delete(listener);
      },
      editOntologyRecord: jest.fn((request) =>
        accepted(
          documentOperations.applyVowlDocumentRecordEdit(model, {
            recordTarget: request.recordTarget,
            changes: request.changes,
          }),
        ),
      ),
      editOntologyMetadata: jest.fn((request) =>
        accepted(
          documentOperations.applyVowlOntologyMetadataEdit(
            model,
            request.changes,
          ),
        ),
      ),
      setOntologyPrefix: jest.fn(
        ({ loadGeneration: _generation, ...request }) =>
          accepted(documentOperations.setVowlDocumentPrefix(model, request)),
      ),
      removeOntologyPrefix: jest.fn(({ name }) =>
        accepted(documentOperations.removeVowlDocumentPrefix(model, name)),
      ),
      proposeOntologyDeletion: jest.fn(() =>
        Object.freeze({
          loadGeneration: state.loadGeneration,
          recordTargets: [target],
        }),
      ),
      confirmOntologyDeletion: jest.fn(async () => state),
    };
    warning = jest.fn();
    confirmDeletion = jest.fn(async () => false);
    sidebar = createOntologyEditorSidebar({
      webVowlController: controller,
      documentObject: document,
      showWarning: warning,
      confirmDeletion,
    });
  });
  afterEach(() => sidebar?.dispose());

  test("edits the selected record while preserving another occurrence and other label languages", async () => {
    sidebar.setup();
    const label = document.getElementById("element_labelEditor");
    label.value = "Renamed";
    label.dispatchEvent(new Event("change"));
    await flushOperations();
    expect(controller.editOntologyRecord).toHaveBeenCalledWith({
      loadGeneration: 1,
      recordTarget: target,
      changes: { label: { language: "en", text: "Renamed" } },
    });
    expect(model.classAttribute.map((record) => record.label)).toEqual([
      { en: "Renamed", de: "Person DE" },
      { en: "Peer" },
    ]);
  });

  test.each([
    ["https://example.technology/Person", "https://example.technology/Person"],
    ["ex:NewPerson", "https://example.com/ontology#NewPerson"],
    [":NewPerson", "https://example.com/ontology#NewPerson"],
  ])(
    "resolves IRI input %s before requesting the record change",
    async (input, iri) => {
      sidebar.setup();
      const control = document.getElementById("element_iriEditor");
      control.value = input;
      control.dispatchEvent(new Event("change"));
      await flushOperations();
      expect(model.classAttribute[0].iri).toBe(iri);
      expect(control.title).toBe(iri);
    },
  );

  test("rejects an undefined prefix and restores the accepted IRI", async () => {
    sidebar.setup();
    const control = document.getElementById("element_iriEditor");
    control.value = "missing:Person";
    control.dispatchEvent(keyboardEvent("Enter"));
    await flushOperations();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(controller.editOntologyRecord).not.toHaveBeenCalled();
    expect(control.title).toBe("https://example.com/ontology#Person");
  });

  test("refreshes a custom datatype without changing its identity or disabling its label", async () => {
    const iri =
      "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/textDatatype";
    model = {
      header: {},
      datatype: [{ id: "d", type: "rdfs:Datatype" }],
      datatypeAttribute: [{ id: "d", iri, label: { en: "Text" } }],
    };
    state.selectedDocumentRecord = { collection: "datatype", recordId: "d" };
    sidebar.setup();
    expect(document.getElementById("element_iriEditor")).toMatchObject({
      title: iri,
      value: iri,
      disabled: true,
    });
    expect(document.getElementById("element_labelEditor").disabled).toBe(false);
    expect(controller.editOntologyRecord).not.toHaveBeenCalled();
    const datatype = document.getElementById("typeEditor_datatype");
    datatype.value = "xsd:string";
    datatype.dispatchEvent(new Event("change"));
    await flushOperations();
    expect(model.datatypeAttribute[0].iri).toBe(
      "http://www.w3.org/2001/XMLSchema#string",
    );
    expect(document.getElementById("element_labelEditor")).toMatchObject({
      value: "string",
      disabled: true,
    });
  });

  test("updates ontology metadata using its current language", async () => {
    sidebar.setup();
    const title = document.getElementById("titleEditor");
    title.value = "New title";
    title.dispatchEvent(keyboardEvent("Enter"));
    await flushOperations();
    expect(model.header.title).toEqual({ en: "New title" });
    expect(controller.editOntologyMetadata).toHaveBeenCalledTimes(1);
  });

  test.each(["Enter", " "])(
    "saves a prefix once for %p without synthesizing a click",
    async (key) => {
      sidebar.setup();
      document.getElementById("addPrefixButton").click();
      document.getElementById("prefixInputFor_emptyPrefixEntry").value =
        "example";
      document.getElementById("prefixURLFor_emptyPrefixEntry").value =
        "https://example.com/ontology#";
      const save = document.getElementById("editButtonFor_emptyPrefixEntry");
      const click = jest.fn();
      save.addEventListener("click", click);
      const event = keyboardEvent(key);
      save.dispatchEvent(event);
      await flushOperations();
      expect(event.defaultPrevented).toBe(true);
      expect(controller.setOntologyPrefix).toHaveBeenCalledTimes(1);
      expect(controller.setOntologyPrefix).toHaveBeenCalledWith({
        loadGeneration: 1,
        name: "example",
        iri: "https://example.com/ontology#",
      });
      expect(click).not.toHaveBeenCalled();
    },
  );

  test("keeps accordion ownership inside the editing section", () => {
    const trigger = new EditorControl();
    trigger.nextElementSibling = new EditorControl();
    document.getElementById("generalDetailsEdit").querySelectorAll = (
      selector,
    ) => (selector === ".accordion-trigger" ? [trigger] : []);
    sidebar.setup();
    const event = keyboardEvent("Enter");
    trigger.dispatchEvent(event);
    expect(trigger.role).toBe("button");
    expect(trigger.classes).toContain("accordion-trigger-active");
    expect(event.defaultPrevented).toBe(true);
  });

  test("requests confirmation before submitting a deletion proposal", async () => {
    sidebar.setup();
    document.getElementById("class_deleteButton").click();
    await flushOperations();
    expect(confirmDeletion).toHaveBeenCalledTimes(1);
    expect(controller.confirmOntologyDeletion).not.toHaveBeenCalled();
    confirmDeletion.mockResolvedValueOnce(true);
    document.getElementById("class_deleteButton").click();
    await flushOperations();
    expect(controller.confirmOntologyDeletion).toHaveBeenCalledWith(
      controller.proposeOntologyDeletion.mock.results[1].value,
    );
  });

  test("setup is idempotent and disposal detaches listeners and subscriptions", () => {
    sidebar.setup();
    sidebar.setup();
    sidebar.dispose();
    sidebar.dispose();
    document
      .getElementById("element_labelEditor")
      .dispatchEvent(new Event("change"));
    document.getElementById("addPrefixButton").click();
    expect(controller.editOntologyRecord).not.toHaveBeenCalled();
    expect(subscribers.size).toBe(0);
    expect(
      document.getElementById("editButtonFor_emptyPrefixEntry").parentNode,
    ).toBeUndefined();
  });
});
