import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The adapter and its unit tests both speak to renderedGraphInternals through
// doubles. Nothing in those tests compares a double's shape to the real
// module, so a call to a member that does not exist stays green until the
// application is loaded in a browser. These checks close that gap statically:
// every member the adapter reaches for must be declared by the module that
// actually implements it.
const ADAPTER_SOURCE = readFileSync(
  fileURLToPath(new URL("./d3RenderedGraphAdapter.js", import.meta.url)),
  "utf8",
);
const ADAPTER_TEST_SOURCE = readFileSync(
  fileURLToPath(new URL("./d3RenderedGraphAdapter.test.js", import.meta.url)),
  "utf8",
);
const RENDERED_GRAPH_INTERNALS_SOURCE = readFileSync(
  fileURLToPath(new URL("./renderedGraphInternals.js", import.meta.url)),
  "utf8",
);
const RENDERED_GRAPH_SETTINGS_SOURCE = readFileSync(
  fileURLToPath(new URL("./renderedGraphSettings.js", import.meta.url)),
  "utf8",
);

// Every renderer module the adapter reaches through a settings accessor.
const FILTER_MODULE_SOURCE_PATHS = Object.freeze({
  datatypeFilter: "../../../shared/js/modules/datatypeFilter.js",
  disjointPropertyFilter: "../../../shared/js/modules/disjointFilter.js",
  nodeDegreeFilter: "../../../shared/js/modules/nodeDegreeFilter.js",
  objectPropertyFilter: "../../../shared/js/modules/objectPropertyFilter.js",
  setOperatorFilter: "../../../shared/js/modules/setOperatorFilter.js",
  subclassFilter: "../../../shared/js/modules/subclassFilter.js",
});

function membersCalledOn(moduleSource, receiverName) {
  const memberPattern = new RegExp(
    `(?<![A-Za-z0-9_$])${receiverName}\\s*(?:\\?\\.)?\\.\\s*([A-Za-z_$][A-Za-z0-9_$]*)`,
    "gu",
  );
  return new Set(
    [...moduleSource.matchAll(memberPattern)].map(
      ([, memberName]) => memberName,
    ),
  );
}

function membersDeclaredOn(moduleSource, receiverName) {
  const declarationPattern = new RegExp(
    `(?<![A-Za-z0-9_$])${receiverName}\\.([A-Za-z_$][A-Za-z0-9_$]*)\\s*=`,
    "gu",
  );
  return new Set(
    [...moduleSource.matchAll(declarationPattern)].map(
      ([, memberName]) => memberName,
    ),
  );
}

describe("rendered graph seam conformance", () => {
  test("calls only renderer members the internals module declares", () => {
    const calledMembers = membersCalledOn(
      ADAPTER_SOURCE,
      "renderedGraphInternals",
    );
    const declaredMembers = membersDeclaredOn(
      RENDERED_GRAPH_INTERNALS_SOURCE,
      "graph",
    );

    const undeclaredMembers = [...calledMembers]
      .filter((memberName) => !declaredMembers.has(memberName))
      .sort();

    expect(undeclaredMembers).toEqual([]);
  });

  test("reads only settings the renderer settings module declares", () => {
    const readMembers = membersCalledOn(
      ADAPTER_SOURCE,
      "renderedGraphSettings",
    );
    const declaredMembers = membersDeclaredOn(
      RENDERED_GRAPH_SETTINGS_SOURCE,
      "renderedGraphSettings",
    );

    const undeclaredMembers = [...readMembers]
      .filter((memberName) => !declaredMembers.has(memberName))
      .sort();

    expect(undeclaredMembers).toEqual([]);
  });

  test("calls only filter members the filter modules declare", () => {
    // The settings object hands back filter modules, so a member called on one
    // of them crosses the same seam and needs the same proof.
    const filterModuleSources = Object.entries(FILTER_MODULE_SOURCE_PATHS).map(
      ([accessorName, modulePath]) => [
        accessorName,
        readFileSync(
          fileURLToPath(new URL(modulePath, import.meta.url)),
          "utf8",
        ),
      ],
    );

    const undeclaredMembers = [];
    for (const [accessorName, filterModuleSource] of filterModuleSources) {
      const declaredMembers = membersDeclaredOn(filterModuleSource, "filter");
      const calledPattern = new RegExp(
        `${accessorName}\\(\\)\\s*(?:\\?\\.)?\\.\\s*([A-Za-z_$][A-Za-z0-9_$]*)`,
        "gu",
      );
      const boundNamePattern = new RegExp(
        `const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*renderedGraphSettings\\.${accessorName}\\(\\)`,
        "u",
      );
      const boundName = ADAPTER_SOURCE.match(boundNamePattern)?.[1];
      const calledMembers = new Set(
        [...ADAPTER_SOURCE.matchAll(calledPattern)].map(
          ([, memberName]) => memberName,
        ),
      );
      if (boundName !== undefined) {
        for (const memberName of membersCalledOn(ADAPTER_SOURCE, boundName)) {
          calledMembers.add(memberName);
        }
      }
      for (const memberName of calledMembers) {
        if (!declaredMembers.has(memberName)) {
          undeclaredMembers.push(`${accessorName}: ${memberName}`);
        }
      }
    }

    expect(undeclaredMembers.sort()).toEqual([]);
  });

  test("gives the adapter's renderer double every member the adapter calls", () => {
    const calledMembers = membersCalledOn(
      ADAPTER_SOURCE,
      "renderedGraphInternals",
    );
    const doubleMembers = membersDeclaredOn(
      ADAPTER_TEST_SOURCE,
      "renderedGraphInternalsFixture",
    );
    const doubleLiteralPattern =
      /renderedGraphInternalsFixture\s*=\s*\{([\s\S]*?)\n {2}\};/u;
    const doubleLiteral =
      ADAPTER_TEST_SOURCE.match(doubleLiteralPattern)?.[1] ?? "";
    for (const [, memberName] of doubleLiteral.matchAll(
      /^ {4}(?:async\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*[(:]/gmu,
    )) {
      doubleMembers.add(memberName);
    }

    const missingFromDouble = [...calledMembers]
      .filter((memberName) => !doubleMembers.has(memberName))
      .sort();

    expect(missingFromDouble).toEqual([]);
  });
});
