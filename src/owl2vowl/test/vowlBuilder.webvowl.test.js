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
      new URL(`./fixtures/ontology-syntax/${fileName}`, import.meta.url),
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

  test("preserves an inverse pair when one property also has a quantified restriction", async () => {
    const result = await owl2vowl(
      `Prefix(:=<urn:test#>)
       Ontology(<urn:test>
         InverseObjectProperties(:producesWine :hasMaker)
         SubClassOf(:Wine ObjectAllValuesFrom(:hasMaker :Winery))
       )`,
      { fileName: "inverse-restriction.ofn" },
    );
    const parser = createWebVowlParser(graphStub());

    parser.parse(result);

    const hasMakerProperties = parser
      .properties()
      .filter((property) => property.iri() === "urn:test#hasMaker");
    const hasMaker = hasMakerProperties.find(
      (property) => property.type() === "owl:ObjectProperty",
    );
    const producesWine = parser
      .properties()
      .find((property) => property.iri() === "urn:test#producesWine");

    expect({
      hasMakerInverseIri: hasMaker?.inverse()?.iri(),
      hasMakerTypes: hasMakerProperties
        .map((property) => property.type())
        .sort(),
      producesWineInverseIri: producesWine?.inverse()?.iri(),
    }).toEqual({
      hasMakerInverseIri: "urn:test#producesWine",
      hasMakerTypes: ["owl:ObjectProperty", "owl:allValuesFrom"],
      producesWineInverseIri: "urn:test#hasMaker",
    });
  });
});
