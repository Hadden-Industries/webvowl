import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS;
let createVisualizationArtifactDownloadAdapter;

const ADAPTER_MODULE_URL = new URL(
  "./visualizationArtifactDownloadAdapter.js",
  import.meta.url,
);

beforeAll(async () => {
  const adapterModule = new SourceTextModule(
    readFileSync(fileURLToPath(ADAPTER_MODULE_URL), "utf8"),
    { identifier: ADAPTER_MODULE_URL.href },
  );
  await adapterModule.link((specifier) => {
    throw new Error(`Unexpected download adapter dependency: ${specifier}`);
  });
  await adapterModule.evaluate();

  ({
    VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS,
    createVisualizationArtifactDownloadAdapter,
  } = adapterModule.namespace);
});

class DownloadElementFixture {
  constructor() {
    this.assignedInnerHtml = null;
    this.attributes = new Map();
    this.hidden = true;
    this.textContent = "";
  }

  getAttribute(attributeName) {
    return this.attributes.get(attributeName) ?? null;
  }

  setAttribute(attributeName, attributeValue) {
    this.attributes.set(attributeName, String(attributeValue));
  }

  removeAttribute(attributeName) {
    this.attributes.delete(attributeName);
  }

  set innerHTML(markup) {
    this.assignedInnerHtml = markup;
  }
}

class DownloadDocumentFixture {
  constructor(presentElementIds) {
    this.elementsById = new Map(
      presentElementIds.map((elementId) => [
        elementId,
        new DownloadElementFixture(),
      ]),
    );
  }

  getElementById(elementId) {
    return this.elementsById.get(elementId) ?? null;
  }
}

function createArtifactMetadata(overrides = {}) {
  return {
    format: "svg",
    pageLocalArtifactId: "svg-artifact-1-1",
    filename: "person-organization.svg",
    mediaType: "image/svg+xml",
    byteLength: 2048,
    sha256Hex: "a".repeat(64),
    pageLocalViewRecipeId: "svg-view-recipe-1-1",
    ...overrides,
  };
}

describe("page-local Visualization artifact download presentation", () => {
  let documentObject;
  let visualizationArtifactDownloadAdapter;

  beforeEach(() => {
    documentObject = new DownloadDocumentFixture(
      Object.values(VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS),
    );
    visualizationArtifactDownloadAdapter =
      createVisualizationArtifactDownloadAdapter({
        documentObject,
      });
  });

  function downloadElement(controlName) {
    return documentObject.getElementById(
      VISUALIZATION_ARTIFACT_DOWNLOAD_ELEMENT_IDS[controlName],
    );
  }

  test("publishes the object URL and filename onto the native download link", () => {
    const metadata = createArtifactMetadata();

    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata,
      objectUrl: "blob:webvowl-svg-1",
    });

    expect(downloadElement("svgDownloadLink").getAttribute("href")).toBe(
      "blob:webvowl-svg-1",
    );
    expect(downloadElement("svgDownloadLink").getAttribute("download")).toBe(
      "person-organization.svg",
    );
  });

  test("publishes each format while keeping idle export links keyboard actionable", () => {
    const controls = new DownloadDocumentFixture([
      "exportSvg",
      "exportJson",
      "exportTurtle",
      "exportTex",
      "artifactPublicationStatus",
    ]);
    const adapter = createVisualizationArtifactDownloadAdapter({
      documentObject: controls,
    });
    adapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata(),
      objectUrl: "blob:svg",
    });
    adapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata({
        format: "vowl-json",
        mediaType: "application/json",
        filename: "people.json",
      }),
      objectUrl: "blob:json",
    });
    for (const id of ["exportSvg", "exportTurtle", "exportTex"]) {
      expect(controls.getElementById(id).getAttribute("href")).toBe("#");
      expect(controls.getElementById(id).getAttribute("download")).toBeNull();
    }
    expect(controls.getElementById("exportJson").getAttribute("href")).toBe(
      "blob:json",
    );
    expect(controls.getElementById("exportJson").getAttribute("download")).toBe(
      "people.json",
    );
    adapter.dispose();
    expect(
      controls.getElementById("exportJson").getAttribute("href"),
    ).toBeNull();
  });

  test("shows a bounded status without interpreting it as markup", () => {
    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata({
        filename: "<img src=x onerror=alert(1)>.svg",
      }),
      objectUrl: "blob:webvowl-svg-1",
    });

    const statusElement = downloadElement("publicationStatus");
    expect(statusElement.hidden).toBe(false);
    expect(statusElement.assignedInnerHtml).toBeNull();
    expect(statusElement.textContent).toContain(
      "<img src=x onerror=alert(1)>.svg",
    );
  });

  test("replaces the previous artifact presentation without revoking its URL", () => {
    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata(),
      objectUrl: "blob:webvowl-svg-1",
    });
    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata({
        pageLocalArtifactId: "svg-artifact-1-2",
        filename: "second.svg",
      }),
      objectUrl: "blob:webvowl-svg-2",
    });

    expect(downloadElement("svgDownloadLink").getAttribute("href")).toBe(
      "blob:webvowl-svg-2",
    );
    expect(downloadElement("svgDownloadLink").getAttribute("download")).toBe(
      "second.svg",
    );
    expect(visualizationArtifactDownloadAdapter).not.toHaveProperty(
      "revokeObjectURL",
    );
  });

  test("presents a bounded failure as text and clears the stale download", () => {
    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata(),
      objectUrl: "blob:webvowl-svg-1",
    });
    visualizationArtifactDownloadAdapter.presentArtifactFailure({
      code: "EXPORT_FAILED",
      message: "The SVG artifact could not be created in this browser.",
    });

    const statusElement = downloadElement("publicationStatus");
    expect(statusElement.hidden).toBe(false);
    expect(statusElement.textContent).toContain(
      "The SVG artifact could not be created in this browser.",
    );
    expect(statusElement.assignedInnerHtml).toBeNull();
    for (const name of [
      "svgDownloadLink",
      "turtleDownloadLink",
      "vowlJsonDownloadLink",
      "latexDownloadLink",
    ]) {
      expect(downloadElement(name).getAttribute("href")).toBe("#");
      expect(downloadElement(name).getAttribute("download")).toBeNull();
    }
  });

  test("hides its status and clears the link on disposal, idempotently", () => {
    visualizationArtifactDownloadAdapter.publishPageLocalArtifact({
      metadata: createArtifactMetadata(),
      objectUrl: "blob:webvowl-svg-1",
    });

    visualizationArtifactDownloadAdapter.dispose();
    visualizationArtifactDownloadAdapter.dispose();

    expect(downloadElement("svgDownloadLink").getAttribute("href")).toBeNull();
    expect(
      downloadElement("svgDownloadLink").getAttribute("download"),
    ).toBeNull();
    expect(downloadElement("publicationStatus").hidden).toBe(true);
  });

  test("tolerates a page that provides no export controls", () => {
    const emptyDocument = new DownloadDocumentFixture([]);
    const detachedAdapter = createVisualizationArtifactDownloadAdapter({
      documentObject: emptyDocument,
    });

    expect(() =>
      detachedAdapter.publishPageLocalArtifact({
        metadata: createArtifactMetadata(),
        objectUrl: "blob:webvowl-svg-1",
      }),
    ).not.toThrow();
    expect(() => detachedAdapter.dispose()).not.toThrow();
  });

  test("rejects dependencies outside the presentation interface", () => {
    expect(() =>
      createVisualizationArtifactDownloadAdapter({
        documentObject,
        visualizationArtifactService: {},
      }),
    ).toThrow("invalid dependency field set");
  });

  test("names no object-URL lifecycle or renderer identifier in its source", () => {
    const adapterSource = readFileSync(
      fileURLToPath(ADAPTER_MODULE_URL),
      "utf8",
    );

    for (const forbiddenIdentifier of [
      "createObjectURL",
      "revokeObjectURL",
      "Blob",
      "d3",
      "graph",
    ]) {
      expect(adapterSource).not.toMatch(
        new RegExp(
          `(?<![A-Za-z0-9_$])${forbiddenIdentifier}(?![A-Za-z0-9_$])`,
          "u",
        ),
      );
    }
  });
});
