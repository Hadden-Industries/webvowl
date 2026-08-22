import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const JEST_BIN = path.join(ROOT, "node_modules", "jest", "bin", "jest.js");
const LEGACY_SUITE = "src/owl2vowl/test/differential.test.js";
const LIST_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const LIST_TIMEOUT_MS = 120_000;

// Section 18.8 defines the corpus differential as Java reference output compared
// against WebVOWL output "through new architecture". After the Phase 8 cutover
// the retained suite at LEGACY_SUITE runs the replaced pipeline, so it is kept
// for characterization but must not gate deployment.
//
// The exclusion is easy to get wrong in three specific ways, and each assertion
// below guards one of them:
//
//   - six sibling suites also carry "differential" in their name, so a loose
//     pattern silently disables real gates;
//   - `testPathIgnorePatterns` replaces jest's default rather than extending it,
//     so dropping `/node_modules/` re-exposes dependency tests;
//   - an ignored path stays ignored even when named explicitly on the command
//     line, so "archived" can quietly become "unrunnable".
const listTests = (extraArgs = []) => {
  const stdout = execFileSync(
    process.execPath,
    [
      "--experimental-vm-modules",
      "--disable-warning=ExperimentalWarning",
      JEST_BIN,
      "--listTests",
      "--json",
      ...extraArgs,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: LIST_MAX_BUFFER_BYTES,
    },
  );
  return JSON.parse(stdout).map((filePath) =>
    path.relative(ROOT, filePath).replaceAll("\\", "/"),
  );
};

const packageManifest = () =>
  JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));

describe("default test run scope", () => {
  let defaultTests;

  beforeAll(() => {
    defaultTests = listTests();
  }, LIST_TIMEOUT_MS);

  it("omits the retained legacy differential suite", () => {
    expect(defaultTests).not.toContain(LEGACY_SUITE);
  });

  it("keeps every other suite whose name contains differential", () => {
    const differentialSuites = defaultTests.filter((filePath) =>
      filePath.includes("differential"),
    );

    expect(differentialSuites.sort()).toEqual([
      "src/owl2vowl/test/vowlBuilder.differential.test.js",
      "src/owlapi-js/parser/dl/dlSyntax.differential.test.js",
      "src/owlapi-js/parser/functional/functionalSyntax.differential.test.js",
      "src/owlapi-js/parser/krss2/krss2Syntax.differential.test.js",
      "src/owlapi-js/parser/manchester/manchesterSyntax.differential.test.js",
      "src/owlapi-js/parser/nquads/nQuads.differential.test.js",
      "src/owlapi-js/parser/ntriples/nTriples.differential.test.js",
      "src/owlapi-js/parser/owlxml/owlXml.differential.test.js",
      "src/owlapi-js/parser/rdfxml/rdfXml.differential.test.js",
      "src/owlapi-js/parser/trig/trig.differential.test.js",
      "src/owlapi-js/parser/turtle/turtle.differential.test.js",
      "src/owlapi-js/rdf/rdfToOwlTranslator.differential.test.js",
    ]);
  });

  it("never reaches into node_modules", () => {
    expect(
      defaultTests.filter((filePath) => filePath.includes("node_modules")),
    ).toEqual([]);
  });
});

describe("retained legacy differential suite", () => {
  it(
    "is still discoverable when the ignore list is overridden",
    () => {
      const legacyTests = listTests([
        "--testPathIgnorePatterns=/node_modules/",
        "--testPathPatterns=owl2vowl/test/differential\\.test\\.js$",
      ]);

      expect(legacyTests).toEqual([LEGACY_SUITE]);
    },
    LIST_TIMEOUT_MS,
  );

  it("has a dedicated script so it can be run on demand", () => {
    const { scripts } = packageManifest();

    expect(scripts["test:legacy"]).toEqual(expect.stringContaining("jest"));
  });
});
