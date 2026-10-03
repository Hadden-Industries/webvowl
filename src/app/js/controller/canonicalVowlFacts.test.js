import { readCanonicalFacts } from "./canonicalVowlFacts.js";

test("pages every retained fact without truncating literal content or sharing ownership", () => {
  const records = Array.from({ length: 63 }, (_, index) => ({
    id: `fact-${index}`,
    kind: "annotation-assertion",
    value: { lexical: `<script>${"x".repeat(5000)}</script>`, language: "en" },
  }));
  const inspection = {
    records: { ontology: { iri: "urn:ontology" }, constructs: records },
    qualifications: [{ code: "retained-rdf", statements: ["s1"] }],
    sourceStatements: [{ id: "s1", predicate: "urn:predicate" }],
    coverage: { represented: 1, qualified: 1, excluded: 0 },
  };
  const all = [0, 25, 50].flatMap(
    (offset) =>
      readCanonicalFacts(inspection, { section: "records.constructs", offset })
        .entries,
  );
  expect(all).toEqual(records);
  all[0].value.lexical = "changed";
  expect(records[0].value.lexical).toContain("<script>");
  const result = readCanonicalFacts(inspection, { section: "qualifications" });
  expect(result.entries).toEqual(inspection.qualifications);
  expect(
    result.sections.find(({ key }) => key === "sourceStatements").count,
  ).toBe(1);
  expect(
    readCanonicalFacts(inspection, { section: "coverage" }).entries,
  ).toEqual([inspection.coverage]);
  expect(
    readCanonicalFacts(inspection, { section: "records.roles" }).entries,
  ).toEqual([]);
});

test.each([
  { section: "__proto__" },
  { section: "records" },
  { limit: 101 },
  { limit: 0 },
  { offset: -1 },
  { offset: 1.5 },
  { extra: true },
])("rejects invalid facts requests %j", (request) => {
  expect(() => readCanonicalFacts({}, request)).toThrow(TypeError);
});
