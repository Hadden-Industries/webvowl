import { readFileSync } from "node:fs";

import owl2vowl from "../js/index.js";
import {
  canonicalVowlSnapshot,
  governedDifferenceCount,
  JAVA_OWL2VOWL_DIALECT,
  verifyGovernedDifferences,
} from "./vowlSemanticSnapshot.js";

const STRUCTURAL_FIXTURES = [
  "phase5-structural.ofn",
  "phase5-structural.omn",
  "phase5-structural.owx",
  "phase5-structural.rdf",
];
const JAVA_FIXTURE_URL = new URL(
  "./fixtures/java-reference-outputs/phase5-structural.rdf.java.json",
  import.meta.url,
);
const EXPECTED_DIFFERENCES_URL = new URL(
  "../../../docs/owlapi-js/compatibility/expected-differences.json",
  import.meta.url,
);
const PHASE5_FIXTURE_PATH =
  "util/owlapi-reference/fixtures/rdf/phase5-structural.rdf";

const configuration = {
  missingImportHandling: "diagnostic",
  remoteImports: false,
};

const loadStructuralFixture = async (fileName) => {
  const text = readFileSync(
    new URL(
      `../../../util/owlapi-reference/fixtures/rdf/${fileName}`,
      import.meta.url,
    ),
    "utf8",
  );
  return owl2vowl(text, { configuration, fileName });
};

describe("VOWLBuilder exact semantic differential", () => {
  test("all implemented concrete syntaxes produce one VOWL semantic graph", async () => {
    const results = [];
    for (const fileName of STRUCTURAL_FIXTURES) {
      results.push(await loadStructuralFixture(fileName));
    }
    const expected = canonicalVowlSnapshot(results.at(-1));

    for (const result of results) {
      expect(canonicalVowlSnapshot(result)).toEqual(expected);
    }
  });

  test("matches the pinned Java OWL2VOWL semantic snapshot exactly", async () => {
    const result = await loadStructuralFixture("phase5-structural.rdf");
    const javaResult = JSON.parse(readFileSync(JAVA_FIXTURE_URL, "utf8"));
    const manifest = JSON.parse(readFileSync(EXPECTED_DIFFERENCES_URL, "utf8"));

    const scope = {
      artifactType: "VOWL semantic snapshot",
      capability: "webvowl.vowl-builder",
      fixture: PHASE5_FIXTURE_PATH,
      parser: "RDF/XML",
    };
    const differences = verifyGovernedDifferences({
      candidate: canonicalVowlSnapshot(result, {
        dialect: JAVA_OWL2VOWL_DIALECT,
      }),
      manifest,
      reference: canonicalVowlSnapshot(javaResult, {
        dialect: JAVA_OWL2VOWL_DIALECT,
      }),
      scope,
    });

    expect(differences).toHaveLength(governedDifferenceCount(manifest, scope));
  });
});
