import { readFileSync } from "node:fs";

import { loadWithImports } from "./legacyPipeline.js";
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

  test("matches the retained legacy converter on its exact shared subset", async () => {
    const rdfXml = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase7-parity"/>
      <owl:Class rdf:about="https://example.com/phase7-parity#Person"/>
      <owl:ObjectProperty rdf:about="https://example.com/phase7-parity#knows">
        <rdfs:domain rdf:resource="https://example.com/phase7-parity#Person"/>
        <rdfs:range rdf:resource="https://example.com/phase7-parity#Person"/>
      </owl:ObjectProperty>
    </rdf:RDF>`;

    const legacyResult = await loadWithImports(rdfXml);
    const structuralResult = await owl2vowl(rdfXml, {
      fileName: "phase7-parity.rdf",
    });

    expect(canonicalVowlSnapshot(structuralResult)).toEqual(
      canonicalVowlSnapshot(legacyResult),
    );
  });

  test("marks a restriction-derived edge inferred exactly as the legacy converter does", async () => {
    const rdfXml = `<rdf:RDF
      xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
      xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
      xmlns:owl="http://www.w3.org/2002/07/owl#">
      <owl:Ontology rdf:about="https://example.com/phase7-restriction"/>
      <owl:Class rdf:about="https://example.com/phase7-restriction#Person"/>
      <owl:ObjectProperty rdf:about="https://example.com/phase7-restriction#knows"/>
      <owl:Class rdf:about="https://example.com/phase7-restriction#Parent">
        <rdfs:subClassOf>
          <owl:Restriction>
            <owl:onProperty rdf:resource="https://example.com/phase7-restriction#knows"/>
            <owl:someValuesFrom rdf:resource="https://example.com/phase7-restriction#Person"/>
          </owl:Restriction>
        </rdfs:subClassOf>
      </owl:Class>
    </rdf:RDF>`;

    const legacyResult = await loadWithImports(rdfXml);
    const structuralResult = await owl2vowl(rdfXml, {
      fileName: "phase7-restriction.rdf",
    });
    const inferredEdges = (vowl) =>
      canonicalVowlSnapshot(vowl)
        .properties.filter(({ type }) => type === "owl:someValuesFrom")
        .map(({ attributes }) => attributes);

    expect(inferredEdges(structuralResult)).not.toEqual([]);
    expect(inferredEdges(structuralResult)).toEqual(
      inferredEdges(legacyResult),
    );
  });
});
