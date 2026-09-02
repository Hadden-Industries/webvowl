import { describe, expect, test } from "@jest/globals";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT_PATH = fileURLToPath(new URL("..", import.meta.url));

const D3_RENDERED_GRAPH_ADAPTER_PATH =
  "src/webvowl/js/runtime/d3RenderedGraphAdapter.js";
const RENDERED_GRAPH_RUNTIME_IMPLEMENTATION_SUBTREE = "src/webvowl/js/runtime";
const IN_MEMORY_ADAPTER_PATH = "src/app/test/inMemoryRenderedGraphAdapter.js";

const APPLICATION_SOURCE_DIRECTORIES = Object.freeze([
  "src/app/js",
  "src/shared/js",
]);
const RENDERER_SOURCE_DIRECTORY = "src/webvowl/js";

const RETIRED_RENDERER_MODULE_BASENAMES = Object.freeze([
  "graph.js",
  "options.js",
]);

const PROHIBITED_PUBLIC_RENDERER_ROUTES = Object.freeze([
  "webvowl.graph",
  "webvowl.options",
  "window.webvowl",
]);

// Every legacy loading, rendering, and export route the cutover replaced. A
// name reappearing here means a second way into the graph came back.
const RETIRED_SOURCE_IDENTIFIERS = Object.freeze([
  "loadOntologyFromText",
  "renderVowlModel",
  "parseUrlAndLoadOntology",
  "parseOntologyContent",
  "from_JSON_URL",
  "from_IRI_URL",
  "fromFileDrop",
  "from_FileUpload",
  "from_presetOntology",
  "loadFromOWL2VOWL",
  "getLoadingFunction",
  "setController",
  "btoa",
]);

const RETIRED_SOURCE_LITERALS = Object.freeze(["data:image/svg+xml;base64"]);

const USER_INTERFACE_IDENTIFIERS = Object.freeze([
  "sidebar",
  "searchMenu",
  "exportMenu",
  "ontologyMenu",
  "loadingModule",
  "warningModule",
  "directInputModule",
  "zoomSlider",
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

function applicationModulePaths() {
  return APPLICATION_SOURCE_DIRECTORIES.flatMap((directoryPath) =>
    collectAuthoredJavaScriptModulePaths(directoryPath),
  );
}

function rendererModulePaths() {
  return collectAuthoredJavaScriptModulePaths(RENDERER_SOURCE_DIRECTORY);
}

describe("rendered graph decoupling", () => {
  test("keeps every application and shared module free of D3", () => {
    const modulePathsNamingD3 = applicationModulePaths().filter((modulePath) =>
      namesIdentifier(readModuleSource(modulePath), "d3"),
    );

    expect(modulePathsNamingD3).toEqual([]);
  });

  test("confines D3 to the rendered-graph runtime implementation subtree", () => {
    const rendererModulePathsNamingD3 = rendererModulePaths().filter(
      (modulePath) => namesIdentifier(readModuleSource(modulePath), "d3"),
    );
    const modulePathsOutsideTheRuntimeSubtree =
      rendererModulePathsNamingD3.filter(
        (modulePath) =>
          !modulePath.startsWith(
            `${RENDERED_GRAPH_RUNTIME_IMPLEMENTATION_SUBTREE}/`,
          ),
      );

    expect(modulePathsOutsideTheRuntimeSubtree).toEqual([]);
  });

  test("retires the concrete graph and options implementations", () => {
    const survivingRetiredModulePaths = [
      ...applicationModulePaths(),
      ...rendererModulePaths(),
    ].filter((modulePath) =>
      RETIRED_RENDERER_MODULE_BASENAMES.includes(
        path.posix.basename(modulePath),
      ),
    );

    expect(survivingRetiredModulePaths).toEqual([]);
  });

  test("publishes no global renderer route that bypasses the runtime seam", () => {
    const violations = [];
    for (const modulePath of [
      ...applicationModulePaths(),
      ...rendererModulePaths(),
      "src/main.js",
    ]) {
      let moduleSource;
      try {
        moduleSource = readModuleSource(modulePath);
      } catch {
        continue;
      }
      for (const prohibitedRoute of PROHIBITED_PUBLIC_RENDERER_ROUTES) {
        if (moduleSource.includes(prohibitedRoute)) {
          violations.push(`${modulePath}: ${prohibitedRoute}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("keeps user-interface identifiers out of the renderer subtree", () => {
    const violations = [];
    for (const modulePath of rendererModulePaths()) {
      const moduleSource = readModuleSource(modulePath);
      for (const userInterfaceIdentifier of USER_INTERFACE_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, userInterfaceIdentifier)) {
          violations.push(`${modulePath}: ${userInterfaceIdentifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("imports the in-memory rendered graph adapter from no production module", () => {
    const violations = [
      ...applicationModulePaths(),
      ...rendererModulePaths(),
    ].filter((modulePath) =>
      readModuleSource(modulePath).includes("inMemoryRenderedGraphAdapter"),
    );

    expect(violations).toEqual([]);
  });

  test("declares exactly one production rendered-graph runtime implementation", () => {
    const runtimeImplementationPaths = rendererModulePaths().filter(
      (modulePath) =>
        readModuleSource(modulePath).includes("createRenderedSvgSnapshot") &&
        readModuleSource(modulePath).includes("replaceVowlModel"),
    );

    expect(runtimeImplementationPaths).toEqual([
      D3_RENDERED_GRAPH_ADAPTER_PATH,
    ]);
  });

  test("keeps the SVG serializer free of renderer and live-SVG dependencies", () => {
    const serializerSource = readModuleSource(
      "src/app/js/controller/svgSerializer.js",
    );

    for (const forbiddenIdentifier of ["d3", "graph", "liveSvgRoot"]) {
      expect(namesIdentifier(serializerSource, forbiddenIdentifier)).toBe(
        false,
      );
    }
  });

  test("retires every legacy loading, rendering, and export route", () => {
    const survivingRoutes = [];
    for (const modulePath of [
      ...applicationModulePaths(),
      ...rendererModulePaths(),
    ]) {
      const moduleSource = readModuleSource(modulePath);
      for (const retiredIdentifier of RETIRED_SOURCE_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, retiredIdentifier)) {
          survivingRoutes.push(`${modulePath}: ${retiredIdentifier}`);
        }
      }
      for (const retiredLiteral of RETIRED_SOURCE_LITERALS) {
        if (moduleSource.includes(retiredLiteral)) {
          survivingRoutes.push(`${modulePath}: ${retiredLiteral}`);
        }
      }
    }

    expect(survivingRoutes).toEqual([]);
  });

  test("keeps the in-memory adapter available only to tests", () => {
    expect(() => readModuleSource(IN_MEMORY_ADAPTER_PATH)).not.toThrow();
    expect(IN_MEMORY_ADAPTER_PATH.startsWith("src/app/test/")).toBe(true);
  });
});
