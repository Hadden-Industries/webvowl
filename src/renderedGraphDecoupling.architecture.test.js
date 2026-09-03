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

// Focus and pinning do not outlive a mount, so ADR 0010 decision 5 keeps both
// renderer-local. An application module that builds one, or installs one into
// renderer settings, is doing renderer bookkeeping across the seam.
const RENDERER_LOCAL_SELECTION_IDENTIFIERS = Object.freeze([
  "createFocuser",
  "createPickAndPin",
  "selectionModules",
  "focuserModule",
  "pickAndPinModule",
]);
const APPLICATION_INTERFACE_SOURCE_DIRECTORY = "src/app/js";
// The editing surface is outside this migration's scope, so its remaining
// reach into the focus module is recorded debt rather than a new violation.
const EDITING_SURFACE_MODULE_PATH = "src/app/js/editSidebar.js";

const RENDERED_GRAPH_INTERNALS_PATH =
  "src/webvowl/js/runtime/renderedGraphInternals.js";

function renderedGraphInternalsMemberPattern() {
  return /^ {2}graph\.([A-Za-z0-9_]+)\s*=/gmu;
}

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

// Reachability counts test modules too, so a member a test exercises is not
// reported as unreachable; a member nothing names at all is genuinely dead.
function collectAuthoredJavaScriptModulePathsIncludingTests(
  relativeDirectoryPath,
) {
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
        ...collectAuthoredJavaScriptModulePathsIncludingTests(
          relativeEntryPath,
        ),
      );
      continue;
    }
    if (directoryEntryName.endsWith(".js")) {
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

// Every member the renderer hangs off the graph object it returns, paired with
// the one-based line each definition sits on.
function renderedGraphInternalsMemberDefinitionLines() {
  const internalsSource = readModuleSource(RENDERED_GRAPH_INTERNALS_PATH);
  const definitionLinesByMemberName = new Map();
  for (const definitionMatch of internalsSource.matchAll(
    renderedGraphInternalsMemberPattern(),
  )) {
    const memberName = definitionMatch[1];
    const definitionLine = internalsSource
      .slice(0, definitionMatch.index)
      .split("\n").length;
    definitionLinesByMemberName.set(memberName, [
      ...(definitionLinesByMemberName.get(memberName) ?? []),
      definitionLine,
    ]);
  }
  return definitionLinesByMemberName;
}

// A member is reached through property access or through a quoted name, never
// as a bare word, so prose that happens to spell a member name is not mistaken
// for a call on it.
function isMemberReached(moduleSource, memberName) {
  return new RegExp(`(?:\\.|["'\`])${memberName}(?![A-Za-z0-9_$])`, "u").test(
    moduleSource,
  );
}

// A definition is not a use of the thing it defines, so the definitions are
// blanked before the renderer's own source is scanned for references.
function renderedGraphInternalsSourceWithoutDefinitions() {
  return readModuleSource(RENDERED_GRAPH_INTERNALS_PATH).replace(
    renderedGraphInternalsMemberPattern(),
    "  definedMember =",
  );
}

function everyAuthoredModulePath() {
  return [
    ...APPLICATION_SOURCE_DIRECTORIES,
    RENDERER_SOURCE_DIRECTORY,
    "src/app/test",
  ].flatMap((directoryPath) =>
    collectAuthoredJavaScriptModulePathsIncludingTests(directoryPath),
  );
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

  test("builds the renderer-local selection modules inside the renderer", () => {
    const violations = [];
    for (const modulePath of collectAuthoredJavaScriptModulePaths(
      APPLICATION_INTERFACE_SOURCE_DIRECTORY,
    )) {
      if (modulePath === EDITING_SURFACE_MODULE_PATH) {
        continue;
      }
      const moduleSource = readModuleSource(modulePath);
      for (const rendererLocalIdentifier of RENDERER_LOCAL_SELECTION_IDENTIFIERS) {
        if (namesIdentifier(moduleSource, rendererLocalIdentifier)) {
          violations.push(`${modulePath}: ${rendererLocalIdentifier}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("defines each renderer member exactly once", () => {
    // A second definition silently replaces the first at load time, so the
    // earlier one can never run and no tool reports it.
    const shadowedMembers = [];
    for (const [
      memberName,
      definitionLines,
    ] of renderedGraphInternalsMemberDefinitionLines()) {
      if (definitionLines.length > 1) {
        shadowedMembers.push(`${memberName}: ${definitionLines.join(", ")}`);
      }
    }

    expect(shadowedMembers).toEqual([]);
  });

  test("reaches every member the renderer exposes", () => {
    // A member nothing names is capability the graph carries and cannot
    // deliver: it survives refactors, invites copying, and reads as though it
    // were load-bearing.
    const definitionLinesByMemberName =
      renderedGraphInternalsMemberDefinitionLines();
    const moduleSources = everyAuthoredModulePath().map((modulePath) => ({
      modulePath,
      moduleSource:
        modulePath === RENDERED_GRAPH_INTERNALS_PATH
          ? renderedGraphInternalsSourceWithoutDefinitions()
          : readModuleSource(modulePath),
    }));

    const unreachedMembers = [];
    for (const [memberName, definitionLines] of definitionLinesByMemberName) {
      const isReached = moduleSources.some(({ moduleSource }) =>
        isMemberReached(moduleSource, memberName),
      );
      if (!isReached) {
        unreachedMembers.push(`${memberName}: ${definitionLines.join(", ")}`);
      }
    }

    expect(unreachedMembers).toEqual([]);
  });

  test("listens for every custom event the source dispatches", () => {
    // A dispatch nothing listens for is the same defect as an uncalled
    // member, wearing a different shape: it reads as a working notification
    // and delivers nothing.
    const productionModulePaths = [
      ...applicationModulePaths(),
      ...rendererModulePaths(),
    ];
    const productionModuleSources = productionModulePaths.map((modulePath) =>
      readModuleSource(modulePath),
    );

    const dispatchedEventNames = new Set();
    for (const moduleSource of productionModuleSources) {
      for (const dispatchMatch of moduleSource.matchAll(
        /new CustomEvent\(\s*"([A-Za-z-]+)"/gu,
      )) {
        dispatchedEventNames.add(dispatchMatch[1]);
      }
    }

    expect(dispatchedEventNames.size).toBeGreaterThan(0);

    // Both the DOM route and D3's own selection route count as listening.
    const unheardEventNames = [...dispatchedEventNames]
      .filter(
        (eventName) =>
          !productionModuleSources.some((moduleSource) =>
            new RegExp(
              `(?:addEventListener|\\.on)\\(\\s*"${eventName}"`,
              "u",
            ).test(moduleSource),
          ),
      )
      .sort();

    expect(unheardEventNames).toEqual([]);
  });

  test("publishes every rendered graph event kind the seam declares", () => {
    // The inverse defect: a kind that is contracted and conformance-tested but
    // that no implementation ever emits passes every check while delivering
    // nothing.
    const runtimeImplementationSources = [
      D3_RENDERED_GRAPH_ADAPTER_PATH,
      IN_MEMORY_ADAPTER_PATH,
    ].map((modulePath) => readModuleSource(modulePath));
    const contractSource = readModuleSource(
      "src/app/js/controller/renderedGraphRuntimeContracts.js",
    );
    const declaredEventKinds = [
      ...contractSource
        .slice(contractSource.indexOf("RENDERED_GRAPH_EVENT_KINDS"))
        .split("]);")[0]
        .matchAll(/"([a-z-]+)"/gu),
    ].map((eventKindMatch) => eventKindMatch[1]);

    expect(declaredEventKinds.length).toBeGreaterThan(0);

    const unpublishedEventKinds = declaredEventKinds.filter(
      (eventKind) =>
        !runtimeImplementationSources.some((moduleSource) =>
          moduleSource.includes(`kind: "${eventKind}"`),
        ),
    );

    expect(unpublishedEventKinds).toEqual([]);
  });
});
