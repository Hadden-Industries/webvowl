import { createVowlDocumentInsertionRecords } from "./ontologyEditorDrawingRecords.js";

const record = {
  collection: "class",
  id: "a",
  type: "owl:Class",
  label: "Class",
  iri: "https://example.test/A",
  baseIri: "https://example.test/",
  pos: [3, 4],
};

test("creation records are detached immutable drawing requests", () => {
  const source = structuredClone(record);
  const accepted = createVowlDocumentInsertionRecords([source]);
  source.pos[0] = 10;
  expect(accepted[0].pos).toEqual([3, 4]);
  expect(Object.isFrozen(accepted)).toBe(true);
  expect(Object.isFrozen(accepted[0])).toBe(true);
  expect(Object.isFrozen(accepted[0].pos)).toBe(true);
});

test.each(
  [
    [],
    [record, record, record],
    [{ ...record, surprise: true }],
    [{ ...record, pos: [Infinity, 0] }],
    [{ ...record, iri: "relative" }],
    [{ ...record, domain: "b" }],
    [{ ...record, collection: "property", type: "owl:objectProperty" }],
  ].map((records) => ({ records })),
)("rejects invalid canvas requests $records", ({ records }) => {
  expect(() => createVowlDocumentInsertionRecords(records)).toThrow();
});

test("accepts the atomic datatype and property drawing pair", () => {
  expect(
    createVowlDocumentInsertionRecords([
      { ...record, collection: "datatype", type: "rdfs:Datatype" },
      {
        ...record,
        id: "p",
        collection: "property",
        type: "owl:datatypeProperty",
        domain: "c",
        range: "a",
      },
    ]),
  ).toHaveLength(2);
});
