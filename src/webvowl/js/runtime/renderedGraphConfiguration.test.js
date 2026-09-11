import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let RENDERED_GRAPH_CONFIGURATION_DEFAULTS;
let createRenderedGraphConfiguration;

const CONFIGURATION_MODULE_URL = new URL(
  "./renderedGraphConfiguration.js",
  import.meta.url,
);

beforeAll(async () => {
  const configurationModule = new SourceTextModule(
    readFileSync(fileURLToPath(CONFIGURATION_MODULE_URL), "utf8"),
    { identifier: CONFIGURATION_MODULE_URL.href },
  );
  await configurationModule.link((specifier) => {
    throw new Error(`Unexpected configuration dependency: ${specifier}`);
  });
  await configurationModule.evaluate();

  ({ RENDERED_GRAPH_CONFIGURATION_DEFAULTS, createRenderedGraphConfiguration } =
    configurationModule.namespace);
});

describe("renderer-owned graph configuration", () => {
  test("preserves the existing WebVOWL force and dimension defaults", () => {
    expect(RENDERED_GRAPH_CONFIGURATION_DEFAULTS).toEqual({
      charge: -500,
      classDistance: 200,
      compactNotation: false,
      datatypeDistance: 120,
      dynamicLabelWidth: true,
      gravity: 0.025,
      heightPx: 600,
      linkStrength: 1,
      loopDistance: 150,
      maxLabelWidth: 120,
      maxMagnification: 4,
      minMagnification: 0.01,
      rectangularRepresentation: false,
      scaleNodesByIndividuals: true,
      widthPx: 800,
    });
    expect(Object.isFrozen(RENDERED_GRAPH_CONFIGURATION_DEFAULTS)).toBe(true);
  });

  test("returns a frozen configuration built from the defaults", () => {
    const renderedGraphConfiguration = createRenderedGraphConfiguration();

    expect(renderedGraphConfiguration).toEqual(
      RENDERED_GRAPH_CONFIGURATION_DEFAULTS,
    );
    expect(Object.isFrozen(renderedGraphConfiguration)).toBe(true);
  });

  test("accepts an explicit renderer-owned override", () => {
    const renderedGraphConfiguration = createRenderedGraphConfiguration({
      charge: -750,
      widthPx: 1280,
      heightPx: 720,
    });

    expect(renderedGraphConfiguration.charge).toBe(-750);
    expect(renderedGraphConfiguration.widthPx).toBe(1280);
    expect(renderedGraphConfiguration.heightPx).toBe(720);
    expect(renderedGraphConfiguration.gravity).toBe(
      RENDERED_GRAPH_CONFIGURATION_DEFAULTS.gravity,
    );
  });

  test.each([
    ["graphObject", { graphObject: {} }],
    ["graphContainerSelector", { graphContainerSelector: "#graph" }],
    ["filterModules", { filterModules: [] }],
    ["warningModule", { warningModule: {} }],
    ["directInputModule", { directInputModule: {} }],
    ["focuserModule", { focuserModule: {} }],
    ["searchMenu", { searchMenu: {} }],
    ["exportMenu", { exportMenu: {} }],
    ["ontologyMenu", { ontologyMenu: {} }],
    ["pausedMenu", { pausedMenu: {} }],
    ["zoomSlider", { zoomSlider: {} }],
    ["sidebar", { sidebar: {} }],
    ["loadingModule", { loadingModule: {} }],
    ["controllerState", { controllerState: {} }],
    ["sourceProvenance", { sourceProvenance: {} }],
    ["objectUrl", { objectUrl: "blob:example" }],
    ["onSelectionChanged", { onSelectionChanged: () => undefined }],
  ])("rejects the %s setting as renderer-foreign", (_settingName, override) => {
    expect(() => createRenderedGraphConfiguration(override)).toThrow(
      "renderer-owned",
    );
  });

  test.each([
    ["a non-numeric charge", { charge: "strong" }],
    ["a negative width", { widthPx: -1 }],
    ["a non-finite gravity", { gravity: Number.POSITIVE_INFINITY }],
    ["a non-boolean compact notation", { compactNotation: "yes" }],
    ["an inverted magnification range", { minMagnification: 8 }],
  ])("rejects %s", (_scenario, override) => {
    expect(() => createRenderedGraphConfiguration(override)).toThrow();
  });

  test("names no UI, controller, or WebMCP identifier in its source", () => {
    const configurationSource = readFileSync(
      fileURLToPath(CONFIGURATION_MODULE_URL),
      "utf8",
    );

    for (const forbiddenIdentifier of [
      "d3",
      "document",
      "window",
      "controller",
      "sidebar",
      "webMcp",
    ]) {
      expect(configurationSource).not.toMatch(
        new RegExp(
          `(?<![A-Za-z0-9_$])${forbiddenIdentifier}(?![A-Za-z0-9_$])`,
          "iu",
        ),
      );
    }
  });
});
