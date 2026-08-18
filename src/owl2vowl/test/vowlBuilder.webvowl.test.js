import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import owl2vowl from "../js/index.js";

const require = createRequire(import.meta.url);
const createWebVowlParser = require("../../webvowl/js/parser.js");

const graphStub = () => ({
  options: () => ({
    classDistance: () => 200,
    datatypeDistance: () => 120,
    filterMenu: () => ({ updateSettings: () => undefined }),
    gravityMenu: () => ({ reset: () => undefined }),
    modeMenu: () => ({ updateSettings: () => undefined }),
  }),
  setViewportTransform: () => true,
  updateStyle: () => undefined,
});

describe("VOWLBuilder WebVOWL consumer contract", () => {
  test("the existing graph parser consumes the direct structural result", async () => {
    const fileName = "phase5-structural.rdf";
    const text = readFileSync(
      new URL(
        `../../../util/owlapi-reference/fixtures/rdf/${fileName}`,
        import.meta.url,
      ),
      "utf8",
    );
    const result = await owl2vowl(text, { fileName });
    const parser = createWebVowlParser(graphStub());

    expect(() => parser.parse(result)).not.toThrow();
    expect(parser.nodes().map((owlClass) => owlClass.iri())).toEqual(
      expect.arrayContaining([
        "https://example.com/phase5#Child",
        "https://example.com/phase5#Parent",
        "https://example.com/phase5#Person",
      ]),
    );
    expect(parser.properties().map((property) => property.type())).toEqual(
      expect.arrayContaining([
        "owl:DatatypeProperty",
        "owl:ObjectProperty",
        "owl:disjointWith",
        "owl:someValuesFrom",
      ]),
    );
  });
});
