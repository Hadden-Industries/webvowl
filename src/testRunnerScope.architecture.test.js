import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const JEST_BIN = path.join(ROOT, "node_modules", "jest", "bin", "jest.js");
const LIST_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const LIST_TIMEOUT_MS = 120_000;

// The default Jest scope must include every active semantic differential while
// continuing to exclude dependency tests. Phase 18 removed the one legacy-only
// exception, so no repository suite now needs a special discoverability path.
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

describe("default test run scope", () => {
  let defaultTests;

  beforeAll(() => {
    defaultTests = listTests();
  }, LIST_TIMEOUT_MS);

  it("keeps every active suite whose name contains differential", () => {
    const differentialSuites = defaultTests.filter((filePath) =>
      filePath.includes("differential"),
    );

    expect(differentialSuites.sort()).toEqual([
      "src/owl2vowl/test/vowlBuilder.differential.test.js",
      "src/owlapi-js/parser/dl/dlSyntax.differential.test.js",
      "src/owlapi-js/parser/functional/functionalSyntax.differential.test.js",
      "src/owlapi-js/parser/jsonld/jsonLd.differential.test.js",
      "src/owlapi-js/parser/krss1/krss1Syntax.differential.test.js",
      "src/owlapi-js/parser/krss2/krss2Syntax.differential.test.js",
      "src/owlapi-js/parser/manchester/manchesterSyntax.differential.test.js",
      "src/owlapi-js/parser/nquads/nQuads.differential.test.js",
      "src/owlapi-js/parser/ntriples/nTriples.differential.test.js",
      "src/owlapi-js/parser/owlxml/owlXml.differential.test.js",
      "src/owlapi-js/parser/rdfxml/rdfXml.differential.test.js",
      "src/owlapi-js/parser/trig/trig.differential.test.js",
      "src/owlapi-js/parser/turtle/turtle.differential.test.js",
      "src/owlapi-js/rdf/owlToRdfTranslator.differential.test.js",
      "src/owlapi-js/rdf/rdfToOwlTranslator.differential.test.js",
    ]);
  });

  it("never reaches into node_modules", () => {
    expect(
      defaultTests.filter((filePath) => filePath.includes("node_modules")),
    ).toEqual([]);
  });
});
