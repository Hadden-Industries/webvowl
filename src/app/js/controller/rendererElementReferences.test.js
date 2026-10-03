import { indexOntologyElementReferencesByVowlElementId } from "./rendererElementReferences.js";

test("maps each drawn occurrence while keeping anonymous references load scoped", () => {
  const references = indexOntologyElementReferencesByVowlElementId(
    {
      class: [{ id: "a" }, { id: "duplicate" }, { id: "anon" }],
      classAttribute: [
        { id: "a", iri: "urn:A" },
        { id: "duplicate", iri: "urn:A" },
      ],
      property: [{ id: "p" }],
      propertyAttribute: [{ id: "p", iri: "urn:p" }],
      datatype: [{ id: "d" }],
      datatypeAttribute: [{ id: "d", iri: "urn:d" }],
    },
    7,
  );
  expect(references.size).toBe(5);
  expect(references.get("a")).toEqual({ kind: "class", iri: "urn:A" });
  expect(references.get("duplicate")).toEqual(references.get("a"));
  expect(references.get("anon")).toEqual({
    kind: "class",
    loadGeneration: 7,
    localId: "anon",
  });
  expect(references.get("p")).toEqual({ kind: "property", iri: "urn:p" });
  expect(references.get("d")).toEqual({ kind: "datatype", iri: "urn:d" });
});
