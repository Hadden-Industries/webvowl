import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import exportMenuFactory from "./exportMenu.js";

describe("export menu downloads", () => {
  let anchor;
  let originalDocument;
  let originalUrl;

  beforeEach(() => {
    jest.useFakeTimers();
    originalDocument = global.document;
    originalUrl = global.URL;
    anchor = {
      click: jest.fn(),
      download: "",
      hidden: false,
      href: "",
      remove: jest.fn()
    };
    global.document = {
      body: { appendChild: jest.fn() },
      createElement: jest.fn(() => anchor)
    };
    global.URL = {
      createObjectURL: jest.fn(() => "blob:webvowl-export"),
      revokeObjectURL: jest.fn()
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    global.document = originalDocument;
    global.URL = originalUrl;
  });

  test("downloads generated content through a temporary object URL", async () => {
    exportMenuFactory.downloadFile(
      "ontology content",
      "text/turtle;charset=utf-8",
      "ontology.ttl"
    );

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(document.body.appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.href).toBe("blob:webvowl-export");
    expect(anchor.download).toBe("ontology.ttl");
    expect(anchor.hidden).toBe(true);
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);

    const blob = URL.createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("text/turtle;charset=utf-8");
    await expect(blob.text()).resolves.toBe("ontology content");

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.runOnlyPendingTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:webvowl-export");
  });
});
