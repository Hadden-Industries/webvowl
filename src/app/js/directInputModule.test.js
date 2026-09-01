import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

let createDirectInputModule;
let directInputModuleContext;

beforeAll(async () => {
  const moduleUrl = new URL("./directInputModule.js", import.meta.url);
  directInputModuleContext = createContext({
    AbortController,
    console,
    document: undefined,
  });
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { context: directInputModuleContext, identifier: moduleUrl.href },
  );
  const owl2VowlModule = new SyntheticModule(
    ["loadWithImports"],
    function initializeOwl2VowlModule() {
      this.setExport("loadWithImports", jest.fn());
    },
    { context: directInputModuleContext, identifier: "test:owl2vowl" },
  );
  await sourceModule.link((specifier) => {
    if (specifier === "../../owl2vowl/js/index.js") {
      return owl2VowlModule;
    }
    throw new Error(`Unexpected direct-input dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ createDirectInputModule } = sourceModule.namespace);
});

class DirectInputControl extends EventTarget {
  constructor() {
    super();
    this.value = "";
    this.innerHTML = "";
    this.classes = new Set();
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
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
}

describe("direct ontology input controls", () => {
  let controls;
  let directInputModule;
  let loadingModule;

  beforeEach(() => {
    controls = new Map(
      [
        "#DirectInputContent",
        "#directInputTextArea",
        "#directUploadBtn",
        "#close_directUploadBtn",
        "#Error_onLoad",
      ].map((selector) => [selector, new DirectInputControl()]),
    );
    global.document = {
      querySelector: (selector) => controls.get(selector),
    };
    directInputModuleContext.document = global.document;
    loadingModule = {
      directInput: jest.fn(),
      initializeLoader: jest.fn(),
    };
    const graph = {
      handleOnLoadingError: jest.fn(),
      options: () => ({ loadingModule: () => loadingModule }),
    };
    directInputModule = createDirectInputModule(graph);
  });

  afterEach(() => {
    directInputModule?.dispose();
    directInputModuleContext.document = undefined;
    delete global.document;
  });

  test("loads VOWL JSON from the upload button and closes the input panel", () => {
    directInputModule.setDirectInputMode(true);
    controls.get("#directInputTextArea").value = JSON.stringify({
      class: [{ id: "1", type: "owl:Class" }],
    });

    controls.get("#directUploadBtn").dispatchEvent(new Event("click"));

    expect(loadingModule.initializeLoader).toHaveBeenCalledTimes(1);
    expect(loadingModule.directInput).toHaveBeenCalledWith(
      controls.get("#directInputTextArea").value,
    );
    expect(controls.get("#DirectInputContent").classes).toContain("hidden");
  });

  test("treats an explicit visibility value as state rather than a toggle", () => {
    directInputModule.setDirectInputMode(true);
    directInputModule.setDirectInputMode(false);
    directInputModule.setDirectInputMode(false);

    expect(controls.get("#DirectInputContent").classes).toContain("hidden");
  });

  test("disposal detaches both owned click listeners and is idempotent", () => {
    directInputModule.dispose();
    directInputModule.dispose();
    controls.get("#directInputTextArea").value = JSON.stringify({
      class: [{ id: "1", type: "owl:Class" }],
    });

    controls.get("#directUploadBtn").dispatchEvent(new Event("click"));
    controls.get("#close_directUploadBtn").dispatchEvent(new Event("click"));

    expect(loadingModule.initializeLoader).not.toHaveBeenCalled();
    expect(loadingModule.directInput).not.toHaveBeenCalled();
  });
});
