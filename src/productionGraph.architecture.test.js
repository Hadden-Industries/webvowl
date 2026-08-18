import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY_PATH = fileURLToPath(new URL("./main.js", import.meta.url));
const SRC_PATH = path.dirname(ENTRY_PATH);

// Both module systems are in play: the application layer is CommonJS and the
// ingestion layer is native ESM, so a reachability gate that followed only
// `import` would miss the entire app graph and pass vacuously.
const SPECIFIER_PATTERNS = [
  /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/gu,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
];

// Section 17.15: after the cutover the production graph must not reach the
// retained legacy ingestion pipeline. These modules stay on disk for
// characterization and reference only.
const FORBIDDEN_MODULES = [
  "owl2vowl/js/dlSyntaxParser.js",
  "owl2vowl/js/functionalSyntaxParser.js",
  "owl2vowl/js/importLoader.js",
  "owl2vowl/js/iriResolver.js",
  "owl2vowl/js/jsonExporter.js",
  "owl2vowl/js/jsonLdParser.js",
  "owl2vowl/js/krss2SyntaxParser.js",
  "owl2vowl/js/manchesterSyntaxParser.js",
  "owl2vowl/js/ontologyConverter.js",
  "owl2vowl/js/owlXmlParser.js",
  "owl2vowl/js/parserContext.js",
  "owl2vowl/js/rdfParser.js",
  "owl2vowl/js/rdfXmlSerializer.js",
  "owl2vowl/js/turtleParser.js",
];

const resolveSpecifier = (fromFile, specifier) => {
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    resolved,
    `${resolved}.js`,
    path.join(resolved, "index.js"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
};

// Only whole-line comments are removed. Stripping every `//` would corrupt the
// many namespace IRIs that appear inside string literals, and a commented-out
// legacy import must not count as production-reachable.
const withoutCommentedLines = (source) =>
  source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trimStart();
      return (
        !trimmed.startsWith("//") &&
        !trimmed.startsWith("*") &&
        !trimmed.startsWith("/*")
      );
    })
    .join("\n");

const localDependencies = (filePath) => {
  const source = withoutCommentedLines(readFileSync(filePath, "utf8"));
  const dependencies = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith(".")) {
        continue;
      }
      const dependency = resolveSpecifier(filePath, specifier);
      if (!dependency) {
        throw new Error(`Cannot resolve ${specifier} from ${filePath}`);
      }
      dependencies.push(dependency);
    }
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
  return [...visited].map((filePath) =>
    path.relative(SRC_PATH, filePath).replaceAll("\\", "/"),
  );
};

describe("production import graph", () => {
  it("cannot reach the retained legacy ingestion pipeline", () => {
    const reachable = reachableModules(ENTRY_PATH);

    expect(
      reachable.filter((filePath) => FORBIDDEN_MODULES.includes(filePath)),
    ).toEqual([]);
  });

  it("reaches the structural ingestion path it replaced them with", () => {
    const reachable = reachableModules(ENTRY_PATH);

    expect(reachable).toEqual(
      expect.arrayContaining([
        "owl2vowl/js/index.js",
        "owl2vowl/js/vowlBuilder.js",
        "owl2vowl/js/importResolver.js",
      ]),
    );
  });
});
