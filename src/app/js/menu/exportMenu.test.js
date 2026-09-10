import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

const exportMenuFactory = {};
let WebVowlOperationError;

beforeAll(async () => {
  ({ WebVowlOperationError } = await loadEsmModuleForTest(
    new URL("../controller/webVowlControllerContracts.js", import.meta.url),
    import.meta.url,
  ));
  Object.assign(
    exportMenuFactory,
    await loadEsmModuleForTest(
      new URL("./exportMenu.js", import.meta.url),
      import.meta.url,
    ),
  );
});

describe("export menu clipboard copying", () => {
  function createLegacyCopyFixture(execCommandResult = true) {
    const popover = { scrollTop: 12 };
    const content = { scrollTop: 34 };
    const previousFocus = { focus: jest.fn() };
    const documentNode = {
      activeElement: previousFocus,
      execCommand: jest.fn(() => execCommandResult),
    };
    const input = {
      value: "https://example.com/#ontology",
      closest: jest.fn((selector) =>
        selector === ".modern-popover" ? popover : content,
      ),
      focus: jest.fn(() => {
        popover.scrollTop = 80;
        content.scrollTop = 90;
      }),
      select: jest.fn(() => {
        popover.scrollTop = 100;
        content.scrollTop = 110;
      }),
    };

    return { content, documentNode, input, popover, previousFocus };
  }

  test("uses the Clipboard API without focusing or selecting the URL input", async () => {
    const input = {
      value: "https://example.com/#ontology",
      focus: jest.fn(),
      select: jest.fn(),
    };
    const clipboard = { writeText: jest.fn(() => Promise.resolve()) };
    const documentNode = { execCommand: jest.fn() };

    await expect(
      exportMenuFactory.copyInputValue(input, clipboard, documentNode),
    ).resolves.toBe(true);

    expect(clipboard.writeText).toHaveBeenCalledWith(input.value);
    expect(input.focus).not.toHaveBeenCalled();
    expect(input.select).not.toHaveBeenCalled();
    expect(documentNode.execCommand).not.toHaveBeenCalled();
  });

  test("gives every repeated successful copy distinct visible feedback", () => {
    const firstCopy = exportMenuFactory.nextCopyFeedback(true, 0);
    const secondCopy = exportMenuFactory.nextCopyFeedback(
      true,
      firstCopy.successfulCopyCount,
    );
    const thirdCopy = exportMenuFactory.nextCopyFeedback(
      true,
      secondCopy.successfulCopyCount,
    );

    expect([firstCopy.text, secondCopy.text, thirdCopy.text]).toEqual([
      "Copied!",
      "Copied ×2",
      "Copied ×3",
    ]);
  });

  test("falls back after Clipboard API rejection and restores focus and scroll positions", async () => {
    const fixture = createLegacyCopyFixture();
    const clipboard = {
      writeText: jest.fn(() => Promise.reject(new Error("denied"))),
    };

    await expect(
      exportMenuFactory.copyInputValue(
        fixture.input,
        clipboard,
        fixture.documentNode,
      ),
    ).resolves.toBe(true);

    expect(fixture.input.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(fixture.input.select).toHaveBeenCalledTimes(1);
    expect(fixture.documentNode.execCommand).toHaveBeenCalledWith("copy");
    expect(fixture.previousFocus.focus).toHaveBeenCalledWith({
      preventScroll: true,
    });
    expect(fixture.popover.scrollTop).toBe(12);
    expect(fixture.content.scrollTop).toBe(34);
  });

  test("reports failure when the legacy copy command is rejected", async () => {
    const fixture = createLegacyCopyFixture(false);

    await expect(
      exportMenuFactory.copyInputValue(
        fixture.input,
        null,
        fixture.documentNode,
      ),
    ).resolves.toBe(false);

    expect(fixture.popover.scrollTop).toBe(12);
    expect(fixture.content.scrollTop).toBe(34);
  });
});

describe("export menu share-link presentation", () => {
  test("publishes the accepted source link and explains when a local document cannot be shared as a URL", () => {
    const controls = new Map(
      ["#exportedUrl", "#copyBt", "#exportUrlError"].map((id) => [
        id,
        { value: "", textContent: "", classList: { toggle: jest.fn() } },
      ]),
    );
    const state = { source: { kind: "vowl-json-url" } };
    const getVisualizationShareLink = jest.fn(() => {
      if (state.source.kind === "vowl-json-text") {
        throw new Error("Export JSON to share a local document.");
      }
      return {
        url: "https://viewer.test/#url=https%3A%2F%2Fexample.test%2Faccepted.json",
      };
    });
    const menu = exportMenuFactory.createExportMenu({
      readShareLinkPresentation: () => ({
        editorMode: false,
        debugFeatures: false,
      }),
      documentObject: { querySelector: (id) => controls.get(id) },
      locationObject: "https://viewer.test/#stale",
      webVowlController: { getVisualizationShareLink },
    });
    menu.exportAsUrl();
    expect(controls.get("#exportedUrl").value).toContain(
      "#url=https%3A%2F%2Fexample.test%2Faccepted.json",
    );
    expect(controls.get("#copyBt").disabled).toBe(false);
    expect(getVisualizationShareLink).toHaveBeenCalledWith({
      presentation: { editorMode: false, debugFeatures: false },
    });
    state.source = { kind: "vowl-json-text", displayName: "local.json" };
    expect(() => menu.exportAsUrl()).not.toThrow();
    expect(controls.get("#exportedUrl").value).toBe("");
    expect(controls.get("#copyBt").disabled).toBe(true);
    expect(controls.get("#exportUrlError").textContent).toContain(
      "Export JSON",
    );
  });
});

async function flushPendingWork() {
  for (let round = 0; round < 20; round += 1) {
    await Promise.resolve();
  }
}

describe("export menu SVG artifact route", () => {
  let originalDocument;
  let controls;
  let exportMenu;
  let exportRequests;
  let hideAllMenus;

  function controlFor(selector) {
    if (!controls.has(selector)) {
      const control = {
        addEventListener(eventName, listener) {
          this.listeners = this.listeners ?? {};
          this.listeners[eventName] = listener;
        },
        listeners: {},
        defaultActionCount: 0,
        clickCount: 0,
        getAttribute: (name) => controls.get(selector)[name] ?? null,
        matches: () => selector === "#m_export",
        hidePopover: () => hideAllMenus(),
      };
      // Dispatches to its own listener the way a real element does, so a
      // handler that clicks the element it is bound to re-enters itself here
      // as it would in a browser.
      control.click = jest.fn(function performClick() {
        control.clickCount += 1;
        let isDefaultPrevented = false;
        const clickEvent = {
          preventDefault() {
            isDefaultPrevented = true;
          },
        };
        control.listeners?.click?.(clickEvent);
        if (!isDefaultPrevented) {
          // What a browser would do: follow the link and save the file.
          control.defaultActionCount += 1;
        }
      });
      controls.set(selector, control);
    }
    return controls.get(selector);
  }

  beforeEach(() => {
    originalDocument = global.document;
    controls = new Map();
    global.document = {
      querySelector: controlFor,
      querySelectorAll: () => [],
      getElementById: (id) => controlFor("#" + id),
    };
    exportRequests = [];
    hideAllMenus = jest.fn();
    exportMenu = exportMenuFactory.createExportMenu({
      documentObject: global.document,
      locationObject: { href: "https://example.test/" },
      webVowlController: {
        exportVisualization: jest.fn((exportRequest) => {
          exportRequests.push(exportRequest);
          return Promise.resolve({
            artifactMetadata: { filename: "graph.svg", byteLength: 12 },
          });
        }),
      },
    });
  });

  afterEach(() => {
    global.document = originalDocument;
  });

  test("asks the controller for the artifact instead of serializing inline", async () => {
    const exportEvent = { preventDefault: jest.fn() };

    await exportMenu.exportVisualizationArtifact(exportEvent);

    // The link must not navigate before the artifact URL is published.
    expect(exportEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(exportRequests).toEqual([{ format: "svg" }]);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
  });

  test("uses the shared JSON export and its matching download control", async () => {
    const link = controlFor("#exportJson");
    link.href = "blob:people-json";
    await exportMenu.exportVisualizationArtifact(
      { preventDefault: jest.fn() },
      "vowl-json",
    );
    expect(exportRequests).toEqual([{ format: "vowl-json" }]);
    expect(link.click).toHaveBeenCalledTimes(1);
  });

  test("routes the human LaTeX click to the shared drawing export", async () => {
    const link = controlFor("#exportTex");
    link.href = "blob:drawing-tex";
    exportMenu.setup();
    link.click();
    await flushPendingWork();
    expect(exportRequests).toEqual([{ format: "latex" }]);
    expect(link.defaultActionCount).toBe(1);
  });

  test("routes the human Turtle click to the same controller artifact action", async () => {
    const link = controlFor("#exportTurtle");
    link.href = "blob:ontology-turtle";
    exportMenu.setup();
    link.click();
    await flushPendingWork();
    expect(exportRequests).toEqual([{ format: "turtle" }]);
    expect(link.defaultActionCount).toBe(1);
  });

  test("triggers exactly one programmatic download once the link is published", async () => {
    const downloadLink = controlFor("#exportSvg");
    downloadLink.href = "blob:webvowl-artifact";

    await exportMenu.exportVisualizationArtifact({ preventDefault: jest.fn() });

    expect(downloadLink.click).toHaveBeenCalledTimes(1);
  });

  test("downloads once for a reader's click without re-entering itself", async () => {
    const downloadLink = controlFor("#exportSvg");
    downloadLink.href = "blob:webvowl-artifact";
    exportMenu.setup();

    // What a reader does: one click on the export entry.
    downloadLink.click();
    await flushPendingWork();

    // One export, one saved file, and the menus hidden once. Clicking the very
    // element the handler is bound to previously re-entered it without end,
    // which prevented every download and hid the menus on every pass.
    expect(exportRequests).toHaveLength(1);
    expect(downloadLink.defaultActionCount).toBe(1);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
  });

  test("does not click the link when the export fails", async () => {
    const downloadLink = controlFor("#exportSvg");
    const presentArtifactFailure = jest.fn();
    exportMenu = exportMenuFactory.createExportMenu({
      documentObject: global.document,
      visualizationArtifactDownloadAdapter: { presentArtifactFailure },
      locationObject: { href: "https://example.test/" },
      webVowlController: {
        exportVisualization: () =>
          Promise.reject(
            new WebVowlOperationError({
              code: "NO_ONTOLOGY",
              message: "no ontology",
            }),
          ),
      },
    });

    await exportMenu.exportVisualizationArtifact({ preventDefault: jest.fn() });

    expect(downloadLink.click).not.toHaveBeenCalled();
    expect(presentArtifactFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: "no ontology" }),
    );
  });
});
