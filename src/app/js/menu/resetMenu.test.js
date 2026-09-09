import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let createResetMenu;

class ResetControl {
  constructor() {
    this.classes = new Set();
    this.listeners = {};
    this.offsetWidth = 0;
    this.classList = {
      add: (...classNames) =>
        classNames.forEach((className) => this.classes.add(className)),
      contains: (className) => this.classes.has(className),
      remove: (...classNames) =>
        classNames.forEach((className) => this.classes.delete(className)),
    };
  }

  addEventListener(eventName, listener) {
    this.listeners[eventName] = listener;
  }

  click() {
    this.listeners.click?.();
  }
}

beforeAll(async () => {
  ({ createResetMenu } = await loadEsmModuleForTest(
    new URL("./resetMenu.js", import.meta.url),
    import.meta.url,
    {
      "../ui/applicationUiRegistry.js": {
        applicationUiModule: (moduleName) =>
          globalThis.__resetMenuUiModules?.get(moduleName),
        registerApplicationUiModule: () => undefined,
      },
    },
  ));
});

function createResetMenuHarness() {
  const controls = new Map();
  const controlFor = (elementId) => {
    if (!controls.has(elementId)) {
      controls.set(elementId, new ResetControl());
    }
    return controls.get(elementId);
  };
  global.document = { getElementById: controlFor };

  const clearedSelectionReports = [];
  globalThis.__resetMenuUiModules = new Map([
    [
      "searchMenu",
      {
        clearText: () => clearedSelectionReports.push("presentation-cleared"),
        reportClearedOntologySelection: () =>
          clearedSelectionReports.push("cleared"),
      },
    ],
  ]);

  const pauseRequests = [];
  const visualizationResets = [];
  // The menu takes no renderer at all: a reset control states that the reader
  // asked for defaults back, and what that means for the drawn graph is the
  // renderer's business.
  const resetMenu = createResetMenu({
    clearTimeout: () => undefined,
    documentObject: global.document,
    requestAnimationFrame: (frameCallback) => frameCallback(),
    setTimeout: (timerCallback) => timerCallback(),
    webVowlController: {
      resetVisualization: () => visualizationResets.push("reset"),
      setGraphLayoutPaused: (request) => {
        pauseRequests.push(request);
        return { isPaused: request.isPaused };
      },
    },
  });
  return {
    clearedSelectionReports,
    controlFor,
    pauseRequests,
    resetMenu,
    visualizationResets,
  };
}

describe("reset menu", () => {
  test("requests one shared reset without composing separate menu or pause actions", () => {
    const harness = createResetMenuHarness();
    harness.resetMenu.setup();

    expect(() => harness.controlFor("reset-button").click()).not.toThrow();
    expect(harness.visualizationResets).toEqual(["reset"]);
    expect(harness.pauseRequests).toEqual([]);
  });

  test("clears local search presentation while the controller owns selection and layout", () => {
    const harness = createResetMenuHarness();
    harness.resetMenu.setup();

    harness.controlFor("reset-button").click();

    expect(harness.pauseRequests).toEqual([]);
    expect(harness.clearedSelectionReports).toEqual(["presentation-cleared"]);
  });

  test("reports that the visualization should return to its defaults", () => {
    const harness = createResetMenuHarness();
    harness.resetMenu.setup();

    harness.controlFor("reset-button").click();

    expect(harness.visualizationResets).toEqual(["reset"]);
  });
});
