import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { createCanonicalVowlDocumentSession } from "./controller/canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "./controller/canonicalVowlWorkerOperations.js";
import { applyCanonicalEditorCommand } from "./controller/canonicalVowlEditorCommands.js";

let createOntologyEditorSidebar;
let pendingEdit;
beforeAll(async () => {
  ({ createOntologyEditorSidebar } =
    await import("./ontologyEditorSidebar.js"));
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
  await pendingEdit;
  for (let index = 0; index < 12; index++) {
    await Promise.resolve();
  }
}

describe("ontology editor sidebar through application document operations", () => {
  let controls,
    document,
    session,
    state,
    controller,
    sidebar,
    warning,
    subscribers;
  let target;
  beforeEach(async () => {
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
    session = createCanonicalVowlDocumentSession({
      workerClient: {
        async run(request, context) {
          const received = JSON.parse(
            JSON.stringify({ ...request, bytes: undefined }),
          );
          if (request.bytes) {
            received.bytes = new Uint8Array(request.bytes);
          }
          if (request.checkpoint?.source) {
            received.checkpoint.source.sources =
              request.checkpoint.source.sources.map(({ document, bytes }) => ({
                document,
                bytes: new Uint8Array(bytes),
              }));
          }
          return {
            ...(await runCanonicalVowlOperation(received, undefined, context)),
            loadGeneration: context.loadGeneration,
            baseRevision: context.baseRevision,
          };
        },
        dispose() {},
      },
    });
    const loaded = await session.load({
      operation: "open-owl-model",
      documentIri: "https://example.com/ontology#",
      mediaType: "text/owl-functional",
      bytes: new TextEncoder().encode(`Ontology(<https://example.com/ontology#>
      Annotation(<http://purl.org/dc/elements/1.1/title> "Example"@en)
      Declaration(Class(<https://example.com/ontology#Person>))
      Declaration(Class(<https://example.com/ontology#Peer>))
      AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <https://example.com/ontology#Person> "Person"@en)
      AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <https://example.com/ontology#Person> "Person DE"@de)
      AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <https://example.com/ontology#Peer> "Peer"@en))`),
    });
    session.setPrefix({ name: "ex", iri: "https://example.com/ontology#" });
    const person = loaded.inspection.records.subjects.find(({ iri }) =>
      iri.endsWith("#Person"),
    );
    target = session.target(
      loaded.inspection.records.roles.find(
        ({ subject }) => subject === person.id,
      ).id,
    );
    state = {
      status: "ready",
      loadGeneration: loaded.loadGeneration,
      documentRevision: session.snapshot().documentRevision,
      selectedDocumentRecord: target,
      editorMode: { isEditorMode: true },
      view: { language: "en" },
    };
    subscribers = new Set();
    const accepted = (result) => {
      state = { ...state, documentRevision: result.documentRevision };
      subscribers.forEach((listener) => listener(state, ["documentRevision"]));
      return state;
    };
    const command = (change) =>
      (pendingEdit = applyCanonicalEditorCommand(session, {
        ...change,
        documentRevision: state.documentRevision,
      }).then(accepted));
    controller = {
      getState: () => state,
      getOntologyEditorView: (reference) => session.inspectEditor(reference),
      resolveOntologyEditorIri: (input) => session.resolveEditorIri(input),
      subscribeToState: (listener) => {
        subscribers.add(listener);
        return () => subscribers.delete(listener);
      },
      editOntologyRecord: jest.fn((request) =>
        command({
          kind: "record",
          target: request.recordTarget,
          changes: request.changes,
        }),
      ),
      editOntologyMetadata: jest.fn((request) =>
        command({ kind: "metadata", changes: request.changes }),
      ),
      setOntologyPrefix: jest.fn(
        ({ loadGeneration: _generation, ...request }) =>
          (pendingEdit = Promise.resolve(session.setPrefix(request)).then(
            accepted,
          )),
      ),
      removeOntologyPrefix: jest.fn(
        ({ name }) =>
          (pendingEdit = Promise.resolve(session.removePrefix(name)).then(
            accepted,
          )),
      ),
      proposeOntologyDeletion: jest.fn(() =>
        Object.freeze({
          loadGeneration: state.loadGeneration,
          recordTargets: [target],
        }),
      ),
      confirmOntologyDeletion: jest.fn(async () => state),
    };
    pendingEdit = undefined;
    warning = jest.fn();
    sidebar = createOntologyEditorSidebar({
      webVowlController: controller,
      documentObject: document,
      showWarning: warning,
    });
  });
  afterEach(() => sidebar?.dispose());

  test("the existing label control edits canonical semantic records and retains annotation provenance", async () => {
    const session = createCanonicalVowlDocumentSession({
      workerClient: {
        async run(request, context) {
          const received = JSON.parse(
            JSON.stringify({ ...request, bytes: undefined }),
          );
          if (request.bytes) {
            received.bytes = new Uint8Array(request.bytes);
          }
          if (request.checkpoint?.source) {
            received.checkpoint.source.sources =
              request.checkpoint.source.sources.map(({ document, bytes }) => ({
                document,
                bytes: new Uint8Array(bytes),
              }));
          }
          const result = await runCanonicalVowlOperation(
            received,
            undefined,
            context,
          );
          return {
            ...result,
            loadGeneration: context.loadGeneration,
            baseRevision: context.baseRevision,
          };
        },
        dispose() {},
      },
    });
    try {
      const loaded = await session.load({
        operation: "open-owl-model",
        documentIri: "urn:root",
        mediaType: "text/owl-functional",
        bytes: new TextEncoder()
          .encode(`Ontology(<urn:root> Declaration(Class(<urn:A>))
        AnnotationAssertion(Annotation(<urn:note> "provenance") <http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Old"@en)
        AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:A> "Alt"@de))`),
      });
      const subject = loaded.inspection.records.subjects.find(
        ({ iri }) => iri === "urn:A",
      );
      const role = loaded.inspection.records.roles.find(
        (entry) => entry.subject === subject.id,
      );
      const selected = session.target(role.id);
      state = {
        ...state,
        selectedDocumentRecord: selected,
        documentRevision: loaded.documentRevision,
        loadGeneration: loaded.loadGeneration,
      };
      controller.getOntologyEditorView = (target) =>
        session.inspectEditor(target);
      let completed;
      controller.editOntologyRecord = (request) => {
        completed = applyCanonicalEditorCommand(session, {
          kind: "record",
          documentRevision: state.documentRevision,
          target: request.recordTarget,
          changes: request.changes,
        }).then((result) => {
          state = { ...state, documentRevision: result.documentRevision };
          subscribers.forEach((listener) =>
            listener(state, ["documentRevision"]),
          );
          return result;
        });
        return completed;
      };
      sidebar.setup();
      const label = document.getElementById("element_labelEditor");
      expect(label.value).toBe("Old");
      label.value = "Updated through the sidebar";
      label.dispatchEvent(new Event("change"));
      await completed;
      const after = session.snapshot();
      const anchor = after.inspection.records.constructs.find(
        ({ kind }) => kind === "assertion-anchor",
      );
      expect(anchor.assertion.value.lexical).toBe(
        "Updated through the sidebar",
      );
      expect(anchor.annotations[0].value.lexical).toBe("provenance");
      expect(session.inspectEditor(selected).selectedRecord.label.de).toBe(
        "Alt",
      );
      expect(warning).not.toHaveBeenCalled();
    } finally {
      session.dispose();
    }
  });

  test("restores control availability after a failed load of the same document", () => {
    sidebar.setup();
    const title = document.getElementById("titleEditor");
    const description = document.getElementById("descriptionEditor");
    const prefix = document.getElementById("addPrefixButton");
    const fixedControl = document.getElementById("element_datatypeEditor");
    fixedControl.disabled = true;
    document.getElementById("generalDetailsEdit").querySelectorAll = () => [
      title,
      description,
      prefix,
      fixedControl,
    ];
    subscribers.forEach((listener) =>
      listener({ ...state, status: "loading" }, ["status"]),
    );
    expect(
      [title, description, prefix].every((control) => control.disabled),
    ).toBe(true);
    subscribers.forEach((listener) => listener(state, ["status"]));
    expect(
      [title, description, prefix].every((control) => !control.disabled),
    ).toBe(true);
    expect(fixedControl.disabled).toBe(true);
  });

  test("preserves author arrays and multiline description input", async () => {
    const getEditorView = controller.getOntologyEditorView;
    controller.getOntologyEditorView = (reference) => {
      const view = getEditorView(reference);
      return {
        ...view,
        metadata: { ...view.metadata, author: ["Ada", "Grace"] },
      };
    };
    const description = document.getElementById("descriptionEditor");
    description.tagName = "TEXTAREA";
    sidebar.setup();
    expect(document.getElementById("authorsEditor").value).toBe("Ada,Grace");
    description.value = "First line\nSecond line";
    const enter = keyboardEvent("Enter");
    description.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    expect(controller.editOntologyMetadata).not.toHaveBeenCalled();
    description.dispatchEvent(new Event("change"));
    await flushOperations();
    expect(controller.editOntologyMetadata).toHaveBeenCalledWith({
      loadGeneration: 1,
      changes: {
        description: { language: "en", text: "First line\nSecond line" },
      },
    });
  });

  test("edits the selected semantic record while preserving another subject and other label languages", async () => {
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
    expect(session.inspectEditor(target).selectedRecord.label).toEqual({
      en: "Renamed",
      de: "Person DE",
    });
    const peer = session
      .snapshot()
      .inspection.records.subjects.find(({ iri }) => iri.endsWith("#Peer"));
    const role = session
      .snapshot()
      .inspection.records.roles.find(({ subject }) => subject === peer.id);
    expect(
      session.inspectEditor(session.target(role.id)).selectedRecord.label,
    ).toEqual({ en: "Peer" });
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
      expect(session.inspectEditor(target).selectedRecord.iri).toBe(iri);
      expect(control.title).toBe(iri);
    },
  );

  test("rejects a malformed IRI and restores the accepted IRI", async () => {
    sidebar.setup();
    const control = document.getElementById("element_iriEditor");
    control.value = "missing:Invalid Person";
    control.dispatchEvent(keyboardEvent("Enter"));
    await flushOperations();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(controller.editOntologyRecord).not.toHaveBeenCalled();
    expect(control.title).toBe("https://example.com/ontology#Person");
  });

  test("refreshes a custom datatype without changing its identity or disabling its label", async () => {
    const iri =
      "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/textDatatype";
    const loaded = await session.load({
      operation: "open-owl-model",
      documentIri: "urn:datatype",
      mediaType: "text/owl-functional",
      bytes: new TextEncoder().encode(
        `Ontology(<urn:datatype> Declaration(Datatype(<${iri}>)) AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <${iri}> "Text"@en))`,
      ),
    });
    const role = loaded.inspection.records.roles.find(
      ({ kind }) => kind === "datatype",
    );
    target = session.target(role.id);
    state = {
      ...state,
      loadGeneration: loaded.loadGeneration,
      documentRevision: loaded.documentRevision,
      selectedDocumentRecord: target,
    };
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
    expect(session.inspectEditor(target).selectedRecord.iri).toBe(
      "http://www.w3.org/2001/XMLSchema#string",
    );
    expect(document.getElementById("element_labelEditor")).toMatchObject({
      value: "Text",
      disabled: true,
    });
  });

  test("updates ontology metadata using its current language", async () => {
    sidebar.setup();
    const title = document.getElementById("titleEditor");
    title.value = "New title";
    title.dispatchEvent(keyboardEvent("Enter"));
    await flushOperations();
    expect(session.inspectEditor().metadata.title).toEqual({ en: "New title" });
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
