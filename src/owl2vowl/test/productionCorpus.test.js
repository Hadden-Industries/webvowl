import * as fs from "node:fs";
import * as path from "node:path";

import owl2vowl from "../js/index.js";
import { ONTOLOGY_CATALOG } from "../js/constants.js";
import { getLocalOntologyPath, LOCAL_ONTOLOGY_DIST_DIR } from "./helpers.js";

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

describe("production entry real-corpus acceptance", () => {
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
