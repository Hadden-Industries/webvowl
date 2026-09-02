import { beforeAll, describe, expect, jest, test } from "@jest/globals";
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
  const graphOptions = {};
  for (const settingName of [
    "classDistance",
    "datatypeDistance",
    "charge",
    "gravity",
    "linkStrength",
  ]) {
    graphOptions[settingName] = jest.fn();
  }
  const resetMenu = createResetMenu(
    {
      graphOptions: () => graphOptions,
      options: () => graphOptions,
      reset: jest.fn(),
      resetSearchHighlight: jest.fn(),
      updateStyle: jest.fn(),
    },
    {
      clearTimeout: () => undefined,
      documentObject: global.document,
      requestAnimationFrame: (frameCallback) => frameCallback(),
      setTimeout: (timerCallback) => timerCallback(),
      webVowlController: {
        setGraphLayoutPaused: (request) => {
          pauseRequests.push(request);
          return { isPaused: request.isPaused };
        },
      },
    },
  );
  return { clearedSelectionReports, controlFor, pauseRequests, resetMenu };
}

describe("reset menu", () => {
  test("resets every resettable module without requiring one to resume itself", () => {
    const harness = createResetMenuHarness();
    const resettableModule = { reset: jest.fn() };
    harness.resetMenu.setup([resettableModule]);

    expect(() => harness.controlFor("reset-button").click()).not.toThrow();
    expect(resettableModule.reset).toHaveBeenCalledTimes(1);
  });

  test("reports that the layout should resume and the selection is cleared", () => {
    const harness = createResetMenuHarness();
    harness.resetMenu.setup([]);

    harness.controlFor("reset-button").click();

    // Resetting means the reader wants defaults back: nothing selected and
    // the layout running again.
    expect(harness.pauseRequests).toEqual([{ isPaused: false }]);
    // Reset both clears what the reader sees and reports the fact, exactly as
    // the search box's own clear control does.
    expect(harness.clearedSelectionReports).toEqual([
      "presentation-cleared",
      "cleared",
    ]);
  });
});
