import * as fs from "node:fs";
import * as path from "node:path";

import owl2vowl, { loadWithImports } from "../js/index.js";
import { ONTOLOGY_CATALOG } from "../js/constants.js";
import { getLocalOntologyPath, LOCAL_ONTOLOGY_DIST_DIR } from "./helpers.js";
import { installLocalOntologyFetch } from "./vowlDifferential.js";

// The pinned OWL2VOWL oracle converted every one of these documents
// successfully; its outputs are committed under
// `fixtures/java-reference-outputs/`. Upstream WebVOWL performs no parsing of
// its own and delegates to that same service, so the oracle's acceptance set is
// the contract the production entry has to meet. Matching its output is the
// separate job of the differential suites; this gate only asserts that the
// document loads at all.
//
// Remote imports are disabled so a failure is attributable to document
// conversion rather than to import resolution.

const TEST_TIMEOUT_MS = 60_000;

const excludedBaseFiles = new Set(["musicontology.rdfs"]);

const baseTargetFiles = Object.values(ONTOLOGY_CATALOG)
  .map(getLocalOntologyPath)
  .filter((file) => !excludedBaseFiles.has(path.basename(file)));

const extraTargetFiles = [
  path.join(LOCAL_ONTOLOGY_DIST_DIR, "iso", "31073", "ed-1", "20260626"),
  path.join(
    LOCAL_ONTOLOGY_DIST_DIR,
    "iso-iec",
    "11179",
    "-3",
    "ed-4",
    "20260714",
  ),
  path.join(LOCAL_ONTOLOGY_DIST_DIR, "universal", "reference-data", "20260714"),
  path.join(LOCAL_ONTOLOGY_DIST_DIR, "universal", "core", "20260714"),
  path.join(LOCAL_ONTOLOGY_DIST_DIR, "universal", "extended", "20260714"),
];

const targetFiles = [...new Set([...baseTargetFiles, ...extraTargetFiles])]
  .filter((file) => fs.existsSync(file))
  .sort();

// Phase 8 advertises Functional Syntax, Manchester Syntax, OWL/XML and RDF/XML
// only. Turtle arrives in Phase 9, so a `.ttl` document must fail explicitly
// here rather than load; asserting that keeps the unsupported-format contract
// honest and stops this gate from silently demanding Phase 9 work.
const isTurtle = (file) => path.extname(file).toLowerCase() === ".ttl";

const advertisedFiles = targetFiles.filter((file) => !isTurtle(file));
const deferredSyntaxFiles = targetFiles.filter(isTurtle);

// Both public entries are gated. `owl2vowl` converts a single document;
// `loadWithImports` additionally resolves the import closure and is what
// `src/app/js/loadingModule.js` calls for every document a user opens. Gating
// only the first left the application's own path untested, which is how two
// documents came to fail through the UI while this suite stayed green.
//
// These two documents are RDF/XML, but their import closures reach
// `http://www.w3.org/ns/time/gregorian`, which the corpus serves as Turtle.
// Turtle arrives in Phase 9, so the closure-resolving entry must refuse them
// while the single-document entry still succeeds.
const hasTurtleImportClosure = (file) =>
  file.includes("universal") &&
  (file.endsWith("core\\20260714") ||
    file.endsWith("core/20260714") ||
    file.endsWith("extended\\20260714") ||
    file.endsWith("extended/20260714"));

describe("production entry real-corpus acceptance", () => {
  let restoreFetch;

  beforeAll(() => {
    restoreFetch = installLocalOntologyFetch();
  });

  afterAll(() => {
    restoreFetch();
  });

  test("the corpus is present", () => {
    expect(advertisedFiles.length).toBeGreaterThan(0);
  });

  for (const file of advertisedFiles) {
    const name = path.basename(file);

    test(
      `loads ${name} through the production entry`,
      async () => {
        const text = fs.readFileSync(file, "utf8");
        const result = await owl2vowl(text, { fileName: name });

        expect(Array.isArray(result.class)).toBe(true);
        expect(Array.isArray(result.classAttribute)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    if (hasTurtleImportClosure(file)) {
      test(
        `rejects ${name} through the import-resolving entry because its closure is Turtle`,
        async () => {
          const text = fs.readFileSync(file, "utf8");

          await expect(
            loadWithImports(text, { fileName: name }),
          ).rejects.toMatchObject({ code: "UNPARSABLE_ONTOLOGY" });
        },
        TEST_TIMEOUT_MS,
      );
      continue;
    }

    test(
      `loads ${name} through the import-resolving entry`,
      async () => {
        const text = fs.readFileSync(file, "utf8");
        const result = await loadWithImports(text, { fileName: name });

        expect(Array.isArray(result.class)).toBe(true);
        expect(Array.isArray(result.classAttribute)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  }

  for (const file of deferredSyntaxFiles) {
    const name = path.basename(file);

    test(
      `rejects ${name} because Turtle arrives in Phase 9`,
      async () => {
        const text = fs.readFileSync(file, "utf8");

        await expect(owl2vowl(text, { fileName: name })).rejects.toMatchObject({
          code: "UNPARSABLE_ONTOLOGY",
        });
      },
      TEST_TIMEOUT_MS,
    );
  }
});
