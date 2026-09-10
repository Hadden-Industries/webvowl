import { describe, expect, test } from "@jest/globals";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The agent surface is a leaf of this application, not a layer inside it.
// Nothing below it may know it exists, and it may not reach past the
// controller. These are static checks over authored source, because an import
// that appears once in a rarely taken branch would otherwise be found only in
// a browser.

const REPOSITORY_ROOT_PATH = fileURLToPath(
  new URL("../../../..", import.meta.url),
);

const WEB_MCP_DIRECTORY_PATH = "src/app/js/webmcp";
const APPLICATION_COMPOSITION_MODULE_PATH = "src/app/js/app.js";

const APPLICATION_SOURCE_DIRECTORIES = Object.freeze([
  "src/app/js",
  "src/shared/js",
  "src/webvowl/js",
]);

// The layers that answer for the ontology and the drawing. None of them may
// learn that an agent exists.
const LAYER_MODULE_PATH_FRAGMENTS = Object.freeze([
  "src/app/js/controller/",
  "src/owl2vowl/",
  "src/webvowl/js/",
]);

// Vocabulary that belongs to the protocol, not to this application.
const WEB_MCP_ONLY_IDENTIFIERS = Object.freeze([
  "modelContext",
  "registerTool",
]);

const WEB_MCP_TOOL_NAMES = Object.freeze([
  "load_ontology",
  "get_ontology_summary",
  "find_ontology_elements",
  "set_visualization_view",
  "export_visualization",
]);

// One implementation of each concern, so a caller never has to work out which
// of two routes it is on.
const SINGLE_IMPLEMENTATION_FACTORY_NAMES = Object.freeze([
  "createWebVowlController",
  "createOntologySourceLoader",
  "createVisualizationArtifactService",
  "registerWebMcpTools",
]);

// Names that would mean a second way to do something this migration unified.
const PROHIBITED_SHIM_IDENTIFIERS = Object.freeze([
  "loadOntologyFromText",
  "setController",
  "getLoadingFunction",
  "createLegacyController",
  "createCompatibilityAdapter",
]);

// Reaching the renderer, not merely naming something of its. The adapter
// legitimately takes an injected `documentObject` to find the host API, and
// the contracts module names a live SVG root only to list it as something a
// tool result must never carry.
const RENDERER_IDENTIFIERS_WEB_MCP_MAY_NOT_REACH = Object.freeze([
  "d3",
  "createD3RenderedGraphAdapter",
  "createRenderedGraphConfiguration",
  "createRenderedGraphInternals",
  "renderedGraphRuntime",
  "renderedGraphSettings",
]);

function collectAuthoredJavaScriptModulePaths(relativeDirectoryPath) {
  const absoluteDirectoryPath = path.join(
    REPOSITORY_ROOT_PATH,
    relativeDirectoryPath,
  );
  let directoryEntryNames;
  try {
    directoryEntryNames = readdirSync(absoluteDirectoryPath);
  } catch {
    return [];
  }

  const modulePaths = [];
  for (const directoryEntryName of directoryEntryNames) {
    const relativeEntryPath = path.posix.join(
      relativeDirectoryPath,
      directoryEntryName,
    );
    const absoluteEntryPath = path.join(
      REPOSITORY_ROOT_PATH,
      relativeEntryPath,
    );
    if (statSync(absoluteEntryPath).isDirectory()) {
      modulePaths.push(
        ...collectAuthoredJavaScriptModulePaths(relativeEntryPath),
      );
      continue;
    }
    if (
      directoryEntryName.endsWith(".js") &&
      !directoryEntryName.endsWith(".test.js")
    ) {
      modulePaths.push(relativeEntryPath);
    }
  }
  return modulePaths;
}

function readModuleSource(modulePath) {
  return readFileSync(path.join(REPOSITORY_ROOT_PATH, modulePath), "utf8");
}

function namesIdentifier(moduleSource, identifier) {
  return new RegExp(
    `(?<![A-Za-z0-9_$])${identifier}(?![A-Za-z0-9_$])`,
    "u",
  ).test(moduleSource);
}

function productionModulePaths() {
  return APPLICATION_SOURCE_DIRECTORIES.flatMap((directoryPath) =>
    collectAuthoredJavaScriptModulePaths(directoryPath),
  );
}

function webMcpModulePaths() {
  return collectAuthoredJavaScriptModulePaths(WEB_MCP_DIRECTORY_PATH);
}

function isWebMcpModulePath(modulePath) {
  return modulePath.startsWith(`${WEB_MCP_DIRECTORY_PATH}/`);
}

describe("WebMCP layering", () => {
  test("imports the agent surface from nothing but the composition root", () => {
    const importingModulePaths = productionModulePaths().filter(
      (modulePath) =>
        !isWebMcpModulePath(modulePath) &&
        readModuleSource(modulePath).includes("webmcp/"),
    );

    expect(importingModulePaths).toEqual([APPLICATION_COMPOSITION_MODULE_PATH]);
  });

  test("keeps the agent surface unknown to the controller, parser and renderer", () => {
    const violations = [];
    for (const modulePath of productionModulePaths()) {
      if (
        !LAYER_MODULE_PATH_FRAGMENTS.some((pathFragment) =>
          modulePath.includes(pathFragment),
        )
      ) {
        continue;
      }
      const moduleSource = readModuleSource(modulePath);
      if (moduleSource.includes("webmcp")) {
        violations.push(`${modulePath}: webmcp`);
      }
      for (const webMcpIdentifier of WEB_MCP_ONLY_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, webMcpIdentifier)) {
          violations.push(`${modulePath}: ${webMcpIdentifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("keeps protocol vocabulary inside the agent surface", () => {
    const violations = [];
    for (const modulePath of productionModulePaths()) {
      if (isWebMcpModulePath(modulePath)) {
        continue;
      }
      const moduleSource = readModuleSource(modulePath);
      for (const webMcpIdentifier of WEB_MCP_ONLY_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, webMcpIdentifier)) {
          violations.push(`${modulePath}: ${webMcpIdentifier}`);
        }
      }
      for (const toolName of WEB_MCP_TOOL_NAMES) {
        if (moduleSource.includes(toolName)) {
          violations.push(`${modulePath}: ${toolName}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("reaches no further than the controller from the agent surface", () => {
    const violations = [];
    for (const modulePath of webMcpModulePaths()) {
      const moduleSource = readModuleSource(modulePath);
      for (const rendererIdentifier of RENDERER_IDENTIFIERS_WEB_MCP_MAY_NOT_REACH) {
        if (namesIdentifier(moduleSource, rendererIdentifier)) {
          violations.push(`${modulePath}: ${rendererIdentifier}`);
        }
      }
      if (moduleSource.includes("../../../webvowl/")) {
        violations.push(`${modulePath}: renderer import`);
      }
    }

    expect(violations).toEqual([]);
  });

  test("publishes the agent surface through no browser global", () => {
    for (const modulePath of webMcpModulePaths()) {
      const moduleSource = readModuleSource(modulePath);

      expect(moduleSource).not.toContain("window.webvowl");
      expect(moduleSource).not.toContain("globalThis.webMcp");
      expect(moduleSource).not.toMatch(/export\s+default/u);
    }
  });
});

describe("single implementation of each concern", () => {
  test("declares each factory exactly once across production source", () => {
    const declarationCountsByFactoryName = Object.fromEntries(
      SINGLE_IMPLEMENTATION_FACTORY_NAMES.map((factoryName) => [
        factoryName,
        productionModulePaths().filter((modulePath) =>
          new RegExp(`export function ${factoryName}\\b`, "u").test(
            readModuleSource(modulePath),
          ),
        ).length,
      ]),
    );

    for (const factoryName of SINGLE_IMPLEMENTATION_FACTORY_NAMES) {
      expect(declarationCountsByFactoryName[factoryName]).toBe(1);
    }
  });

  test("keeps every retired alias and second transport out of production source", () => {
    const violations = [];
    for (const modulePath of productionModulePaths()) {
      const moduleSource = readModuleSource(modulePath);
      for (const prohibitedIdentifier of PROHIBITED_SHIM_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, prohibitedIdentifier)) {
          violations.push(`${modulePath}: ${prohibitedIdentifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
