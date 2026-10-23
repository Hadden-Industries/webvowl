import { describe, expect, test } from "@jest/globals";
import { canonicalExampleSource } from "../canonicalExamples.js";
import {
  createOntologySuggestions,
  findOntologySuggestions,
  ontologySuggestions,
} from "./ontologySuggestions.js";

describe("curated ontology suggestions", () => {
  test("preserves the four owner-selected published addresses and order", () => {
    expect(
      ontologySuggestions
        .slice(0, 4)
        .map(({ id, url, badge }) => [id, url, badge]),
    ).toEqual([
      [
        "H1",
        "https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/latest",
        "latest",
      ],
      [
        "H2",
        "https://haddenindustries.com/ontology/universal/reference-data/latest",
        "latest",
      ],
      [
        "H3",
        "https://haddenindustries.com/ontology/universal/core/latest-unstable",
        "latest-unstable",
      ],
      [
        "H4",
        "https://haddenindustries.com/ontology/universal/extended/latest-unstable",
        "latest-unstable",
      ],
    ]);
    expect(Object.isFrozen(ontologySuggestions)).toBe(true);
    expect(ontologySuggestions.every(Object.isFrozen)).toBe(true);
  });
  test("uses each packaged resolver without offering the internal benchmark", () => {
    expect(
      ontologySuggestions
        .slice(4)
        .map(({ presetKey, url }) => [presetKey, url]),
    ).toEqual(
      ["foaf", "goodrelations", "muto", "ontovibe", "personasonto", "sioc"].map(
        (key) => [key, canonicalExampleSource(key).url],
      ),
    );
    const dev = createOntologySuggestions((key) => ({
      url: `http://localhost:5173/base/${key}.json`,
    }));
    expect(dev[4].url).toBe("http://localhost:5173/base/foaf.json");
    expect(dev[4].provenance).toContain("not an original OWL document");
  });
  test.each([
    ["", ["H1", "H2", "H3", "H4", "O1", "O2", "O3", "O4", "O5", "O6"], null],
    // MUTO also matches its recorded publisher path /core/v1.rdf.
    ["  ＣＯＲＥ  ", ["H3", "O3", "O6"], "H3"],
    ["xmlns.com foaf", ["O1"], "O1"],
    ["https://xmlns.com/foaf", ["O1"], null],
    ["hadden latest-unstable", ["H3", "H4"], "H3"],
    ["OTHERS transformed FOAF", ["O1"], "O1"],
    ["reference  data", ["H2"], "H2"],
    ["absent words", [], null],
    [
      "https://haddenindustries.com/ontology/universal/core/latest",
      ["H3"],
      null,
    ],
  ])("matches %s by the accepted rule", (text, ids, activeId) => {
    const result = findOntologySuggestions(text);
    expect(result.matches.map(({ id }) => id)).toEqual(ids);
    expect(result.activeId).toBe(activeId);
  });
  test("derives exact commitment from current text, never a saved selection flag", () => {
    const url = ontologySuggestions[4].url;
    expect(findOntologySuggestions(` ${url} `).committed?.presetKey).toBe(
      "foaf",
    );
    expect(findOntologySuggestions(url + "?edited").committed).toBeNull();
    expect(findOntologySuggestions("FOAF").committed).toBeNull();
  });
  test("documents lowercasing rather than full case folding", () => {
    const catalogue = [{ ...ontologySuggestions[0], title: "Straße" }];
    expect(findOntologySuggestions("STRAẞE", catalogue).matches).toHaveLength(
      1,
    );
    expect(findOntologySuggestions("STRASSE", catalogue).matches).toHaveLength(
      0,
    );
  });
});
