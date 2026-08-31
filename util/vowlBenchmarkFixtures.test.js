import {
  generateVowlBenchmarkFixture,
  VOWL_BENCHMARK_GENERATOR_VERSION,
} from "./vowlBenchmarkFixtures.mjs";

describe("generateVowlBenchmarkFixture", () => {
  it("generates a reproducible Functional Syntax class corpus", () => {
    expect(generateVowlBenchmarkFixture("functional", { count: 3 })).toBe(
      [
        "Prefix(:=<urn:webvowl:benchmark:>)",
        "Ontology(<urn:webvowl:benchmark:functional>",
        "Declaration(Class(:C0))",
        "Declaration(Class(:C1))",
        "Declaration(Class(:C2))",
        ")",
      ].join("\n"),
    );
  });

  it("generates a reproducible RDF/XML class corpus", () => {
    expect(generateVowlBenchmarkFixture("rdfxml", { count: 2 })).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">',
        '<owl:Class rdf:about="urn:webvowl:benchmark:C0"/>',
        '<owl:Class rdf:about="urn:webvowl:benchmark:C1"/>',
        "</rdf:RDF>",
      ].join("\n"),
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2", 5_000_001])(
    "rejects invalid class count %p",
    (count) => {
      expect(() =>
        generateVowlBenchmarkFixture("functional", { count }),
      ).toThrow(RangeError);
    },
  );

  it("identifies the WebVOWL-owned generator protocol", () => {
    expect(VOWL_BENCHMARK_GENERATOR_VERSION).toBe(
      "webvowl-vowl-benchmark-corpus-v1",
    );
  });
});
