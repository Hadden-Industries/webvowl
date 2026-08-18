import {
  canonicalVowlSnapshot,
  governedDifferenceCount,
  JAVA_OWL2VOWL_DIALECT,
} from "./vowlSemanticSnapshot.js";

const restrictionEdgeVowl = () => ({
  class: [
    { id: "0", type: "owl:Class" },
    { id: "1", type: "owl:Class" },
  ],
  classAttribute: [
    { id: "0", iri: "https://example.com/phase7#A" },
    { id: "1", iri: "https://example.com/phase7#B" },
  ],
  header: { iri: "https://example.com/phase7" },
  property: [{ id: "2", type: "owl:someValuesFrom" }],
  propertyAttribute: [
    {
      attributes: ["object", "someValuesFrom", "inferred"],
      domain: "0",
      id: "2",
      iri: "https://example.com/phase7#p",
      range: "1",
    },
  ],
});

const SCOPE = Object.freeze({
  artifactType: "VOWL semantic snapshot",
  capability: "webvowl.vowl-builder",
  fixture: "util/owlapi-reference/fixtures/rdf/phase5-structural.rdf",
  parser: "RDF/XML",
});

const scopedRule = (id, value) => ({
  ...SCOPE,
  cardinality: { form: "exact", value },
  differenceType: "EXTRA",
  id,
  selector: `$['properties']['0']['attributes']['${value}']`,
  side: "JS",
});

describe("canonicalVowlSnapshot", () => {
  it("preserves the inferred marker on a restriction-derived edge", () => {
    const snapshot = canonicalVowlSnapshot(restrictionEdgeVowl());

    expect(snapshot.properties[0].attributes).toContain("inferred");
  });

  it("suppresses the Java oracle dialect terms only when that dialect is named", () => {
    const snapshot = canonicalVowlSnapshot(restrictionEdgeVowl(), {
      dialect: JAVA_OWL2VOWL_DIALECT,
    });

    expect(snapshot.properties[0].attributes).toEqual([]);
    expect(snapshot.properties[0].type).toBe("owl:someValuesFrom");
  });

  it("pins the exact set of attribute terms the Java oracle dialect suppresses", () => {
    expect(JAVA_OWL2VOWL_DIALECT.suppressedAttributes).toEqual([
      "allValues",
      "allValuesFrom",
      "anonymous",
      "datatype",
      "inferred",
      "object",
      "someValues",
      "someValuesFrom",
    ]);
  });
});

describe("governedDifferenceCount", () => {
  it("sums the exact cardinalities of the rules in scope", () => {
    const manifest = {
      rules: [
        scopedRule("RULE-ONE", 1),
        scopedRule("RULE-TWO", 2),
        { ...scopedRule("RULE-OTHER-FIXTURE", 4), fixture: "other.rdf" },
      ],
    };

    expect(governedDifferenceCount(manifest, SCOPE)).toBe(3);
  });

  it("rejects a rule in scope that does not use exact cardinality", () => {
    const rule = scopedRule("RULE-RANGE", 1);
    const manifest = {
      rules: [
        { ...rule, cardinality: { form: "range", maximum: 3, minimum: 1 } },
      ],
    };

    expect(() => governedDifferenceCount(manifest, SCOPE)).toThrow(
      "RULE-RANGE",
    );
  });
});
