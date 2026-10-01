import { canonicalize, encode, decode, profiles } from "vowl";

test("an undrawable property range does not require an unused projection default", async () => {
  const source = {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: [
        { id: "a", iri: "urn:A" },
        { id: "p", iri: "urn:p" },
      ],
      roles: [
        { id: "A", kind: "class", subject: "a" },
        { id: "P", kind: "object-property", subject: "p" },
      ],
      expressions: [
        { id: "some", kind: "object-some", property: "P", filler: "A" },
      ],
      constructs: [
        { id: "range", kind: "object-range", property: "P", target: "some" },
      ],
      occurrences: [{ id: "node", kind: "class-node", targets: ["A"] }],
    },
  };
  const document = await canonicalize(source, {
    profile: profiles.structuralContent,
  });
  expect(document.structural.subjects).toHaveLength(2);
  expect(document.structural.occurrences).toHaveLength(1);
  expect(encode(await decode(encode(document)))).toEqual(encode(document));
});
