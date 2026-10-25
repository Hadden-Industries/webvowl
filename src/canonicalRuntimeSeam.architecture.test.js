import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import {
  CANONICAL_RENDERED_GRAPH_RUNTIME_METHOD_NAMES,
  CANONICAL_RENDERED_GRAPH_EVENT_CLASSES,
} from "./app/js/controller/canonicalRenderedGraphRuntimeContract.js";
import {
  RENDERED_GRAPH_EVENT_KINDS,
  createRenderedGraphEvent,
} from "./app/js/controller/renderedGraphRuntimeContracts.js";

function inspect(source, visitor) {
  const diagnostics = new Linter().verify(source, {
    linterOptions: { reportUnusedDisableDirectives: false },
    plugins: { seam: { rules: { inspect: { create: () => visitor } } } },
    rules: { "seam/inspect": "error" },
  });
  expect(diagnostics).toEqual([]);
}

function productionSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? productionSources(path)
      : path.endsWith(".js") && !path.endsWith(".test.js")
        ? [{ path, source: readFileSync(path, "utf8") }]
        : [];
  });
}

function calledMembers(source) {
  const members = new Set();
  const receivers = new Set(["runtime", "renderedGraphRuntime"]);
  const isReceiver = (node) =>
    (node?.type === "Identifier" && receivers.has(node.name)) ||
    (node?.type === "MemberExpression" &&
      !node.computed &&
      node.property.name === "renderedGraphRuntime");
  inspect(source, {
    MemberExpression(node) {
      if (!isReceiver(node.object)) {
        return;
      }
      if (
        node.parent.type !== "CallExpression" ||
        node.parent.callee !== node
      ) {
        return;
      }
      if (node.computed) {
        throw new Error(
          "Dynamic runtime receiver needs explicit seam analysis.",
        );
      }
      members.add(node.property.name);
    },
    VariableDeclarator(node) {
      if (
        isReceiver(node.init) ||
        (node.init?.type === "MemberExpression" && isReceiver(node.init.object))
      ) {
        throw new Error(
          "Aliased runtime receiver needs explicit seam analysis.",
        );
      }
    },
  });
  return members;
}

function implementationMembers(source) {
  let members;
  inspect(source, {
    VariableDeclarator(node) {
      if (node.id.name !== "renderedGraphRuntime") {
        return;
      }
      const object = node.init?.arguments?.[0];
      if (object?.type !== "ObjectExpression") {
        throw new Error("Unknown runtime implementation shape.");
      }
      members = new Set(
        object.properties.map((property) => {
          if (property.type !== "Property" || property.computed) {
            throw new Error("Dynamic runtime implementation.");
          }
          return property.key.name ?? property.key.value;
        }),
      );
    },
  });
  if (!members) {
    throw new Error("Runtime implementation not found.");
  }
  return members;
}

function missingMembers(required, actual) {
  return [...required].filter((name) => !actual.has(name)).sort();
}

const declared = new Set(CANONICAL_RENDERED_GRAPH_RUNTIME_METHOD_NAMES);
const implementation = implementationMembers(
  readFileSync(
    new URL("./webvowl/js/runtime/d3RenderedGraphAdapter.js", import.meta.url),
    "utf8",
  ),
);

test("independently collected canonical callers fit the declaration and real adapter", () => {
  const called = new Set(
    productionSources(
      fileURLToPath(new URL("./app/js", import.meta.url)),
    ).flatMap(({ source }) => [...calledMembers(source)]),
  );
  expect(called.size).toBeGreaterThan(20);
  expect(declared.size).toBe(
    CANONICAL_RENDERED_GRAPH_RUNTIME_METHOD_NAMES.length,
  );
  expect(missingMembers(called, declared)).toEqual([]);
  expect(missingMembers(declared, implementation)).toEqual([]);
  expect(missingMembers(implementation, declared)).toEqual([]);
});

function retiredInputReferences(source) {
  const retired = new Set([
    "replaceVowlModel",
    "applyVowlModelRevision",
    "indexOntologyElementReferencesByVowlElementId",
    "createVowlModelReplacementRequest",
    "createVowlModelRevisionRequest",
    "createVowlModelReplacementResult",
  ]);
  const found = new Set();
  inspect(source, {
    Identifier(node) {
      if (retired.has(node.name)) {
        found.add(node.name);
      }
    },
    Literal(node) {
      // A string in a retirement guard is allowed; executable member names are not.
      if (
        retired.has(node.value) &&
        ((node.parent.type === "MemberExpression" &&
          node.parent.property === node) ||
          (node.parent.type === "Property" && node.parent.key === node))
      ) {
        found.add(node.value);
      }
    },
  });
  return [...found].sort();
}

test("production has no executable legacy renderer input route", () => {
  const violations = ["./app/js", "./shared/js", "./webvowl/js"].flatMap(
    (directory) =>
      productionSources(
        fileURLToPath(new URL(directory, import.meta.url)),
      ).flatMap(({ path, source }) =>
        retiredInputReferences(source).map((name) => `${path}: ${name}`),
      ),
  );
  expect(violations).toEqual([]);
  expect(retiredInputReferences('runtime["replaceVowlModel"]({});')).toEqual([
    "replaceVowlModel",
  ]);
  expect(
    retiredInputReferences(
      'const runtime = { "applyVowlModelRevision"() {} };',
    ),
  ).toEqual(["applyVowlModelRevision"]);
  expect(
    retiredInputReferences('const retired = ["replaceVowlModel"];'),
  ).toEqual([]);
});

test("contract checks detect a removed implementation and an undeclared call", () => {
  const reduced = new Set(implementation);
  reduced.delete("readCanonicalDrawingState");
  expect(missingMembers(declared, reduced)).toEqual([
    "readCanonicalDrawingState",
  ]);
  expect(
    missingMembers(calledMembers("runtime.readSemanticText();"), declared),
  ).toEqual(["readSemanticText"]);
  expect(() => calledMembers("runtime[method]();")).toThrow("Dynamic runtime");
  expect(() => calledMembers("const alias = runtime;")).toThrow(
    "Aliased runtime",
  );
});

test("every admitted event has exactly one declared payload class", () => {
  expect(Object.keys(CANONICAL_RENDERED_GRAPH_EVENT_CLASSES).sort()).toEqual(
    [...RENDERED_GRAPH_EVENT_KINDS].sort(),
  );
  expect(
    new Set(Object.values(CANONICAL_RENDERED_GRAPH_EVENT_CLASSES)),
  ).toEqual(new Set(["identity", "renderer-observation", "editing-request"]));
  expect(() =>
    createRenderedGraphEvent({
      kind: "semantic-text-read",
      loadGeneration: 1,
      payload: {},
    }),
  ).toThrow("Unsupported");
});

test("identity events reject renderer-derived semantic text", () => {
  expect(() =>
    createRenderedGraphEvent({
      kind: "rendered-element-selection-changed",
      loadGeneration: 1,
      payload: { selectedOntologyElementReferences: [], label: "drawing text" },
    }),
  ).toThrow();
  expect(() =>
    createRenderedGraphEvent({
      kind: "document-record-selection-changed",
      loadGeneration: 1,
      payload: { recordTarget: null, label: "drawing text" },
    }),
  ).toThrow();
});
