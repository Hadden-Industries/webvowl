import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AXIOM_KINDS, OWLObjectKind } from "../../owlapi-js/model/index.js";

const BUILDER_PATH = fileURLToPath(
  new URL("./vowlBuilder.js", import.meta.url),
);
const SRC_PATH = path.resolve(path.dirname(BUILDER_PATH), "../..");
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/gu;

const localDependencies = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const dependencies = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) {
      continue;
    }
    const resolved = path.resolve(path.dirname(filePath), specifier);
    const candidates = [
      resolved,
      `${resolved}.js`,
      path.join(resolved, "index.js"),
    ];
    const dependency = candidates.find((candidate) => existsSync(candidate));
    if (!dependency) {
      throw new Error(`Cannot resolve ${specifier} from ${filePath}`);
    }
    dependencies.push(dependency);
  }
  return dependencies;
};

const reachableModules = (entryPath) => {
  const visited = new Set();
  const pending = [entryPath];
  while (pending.length > 0) {
    const filePath = pending.pop();
    if (visited.has(filePath)) {
      continue;
    }
    visited.add(filePath);
    pending.push(...localDependencies(filePath));
  }
  return [...visited];
};

describe("VOWLBuilder architecture", () => {
  test("its complete local import graph remains independent of concrete syntax", () => {
    const reachable = reachableModules(BUILDER_PATH).map((filePath) =>
      path.relative(SRC_PATH, filePath).replaceAll("\\", "/"),
    );
    const forbidden = reachable.filter(
      (filePath) =>
        filePath.startsWith("owlapi-js/parser/") ||
        filePath.startsWith("owlapi-js/rdf/"),
    );

    expect(forbidden).toEqual([]);
    expect(readFileSync(BUILDER_PATH, "utf8")).not.toMatch(
      /DOMParser|XMLSerializer|parseFromString|formatDetection|functionalSyntax|manchesterSyntax|owlXml|rdfParser|turtleParser/iu,
    );
  });

  test("records an explicit disposition for every canonical axiom kind", () => {
    const source = readFileSync(BUILDER_PATH, "utf8");
    const applyAxiomsSource = source.slice(
      source.indexOf("  applyAxioms()"),
      source.indexOf("  applyOntologyAnnotations()"),
    );
    const handledConstantNames = [
      ...applyAxiomsSource.matchAll(/\[OWLObjectKind\.([A-Z_]+)\]/gu),
    ].map((match) => match[1]);
    const expectedConstantNames = Object.entries(OWLObjectKind)
      .filter(([, kind]) => AXIOM_KINDS.includes(kind))
      .map(([name]) => name)
      .sort();

    expect([...new Set(handledConstantNames)].sort()).toEqual(
      expectedConstantNames,
    );
    expect(applyAxiomsSource).not.toContain("AXIOM_KINDS.map");
  });
});
