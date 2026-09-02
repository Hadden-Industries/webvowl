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
        { context: directInputModuleContext, identifier: specifier },
      );
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

async function flushMicrotasks(flushCount = 6) {
  for (let flushIndex = 0; flushIndex < flushCount; flushIndex += 1) {
    await Promise.resolve();
  }
}

describe("direct ontology input controls", () => {
  let controls;
  let directInputModule;
  let loadingModule;
  let requestedLoads;
  let webVowlController;

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
    requestedLoads = [];
    webVowlController = {
      loadOntology: jest.fn((loadRequest) => {
        requestedLoads.push(loadRequest);
        return Promise.resolve({ status: "ready" });
      }),
    };
    loadingModule = {
      directInput: jest.fn(),
      initializeLoader: jest.fn(),
    };
    // Direct input reaches the loading module through the interface registry.
    registeredUiModulesForTest.set("loadingModule", loadingModule);
    const graph = {
      handleOnLoadingError: jest.fn(),
    };
    directInputModule = createDirectInputModule(graph, { webVowlController });
  });

  afterEach(() => {
    directInputModule?.dispose();
    directInputModuleContext.document = undefined;
    delete global.document;
  });

  test("sends an already parsed VOWL model to the controller", async () => {
    directInputModule.setDirectInputMode(true);
    const vowlModel = { class: [{ id: "1", type: "owl:Class" }] };
    controls.get("#directInputTextArea").value = JSON.stringify(vowlModel);

    controls.get("#directUploadBtn").dispatchEvent(new Event("click"));
    await flushMicrotasks();

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "vowl-model",
          model: vowlModel,
          displayName: "Direct input",
        },
      },
    ]);
    expect(controls.get("#DirectInputContent").classes).toContain("hidden");
  });

  test("sends any other ontology text to the controller as ontology text", async () => {
    directInputModule.setDirectInputMode(true);
    const ontologyText = "@prefix ex: <http://example.test/> .";
    controls.get("#directInputTextArea").value = ontologyText;

    controls.get("#directUploadBtn").dispatchEvent(new Event("click"));
    await flushMicrotasks();

    expect(requestedLoads).toEqual([
      {
        source: {
          kind: "ontology-text",
          text: ontologyText,
          displayName: "Direct input",
        },
      },
    ]);
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

    expect(webVowlController.loadOntology).not.toHaveBeenCalled();
  });
});
