import { canonicalize, decode, encode, profiles } from "vowl";
import { readFile } from "node:fs/promises";

const emptySource = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});

// D9 supplies the empty envelope; RFC 8785 supplies the exact object-key order.
const emptyBytes = new TextEncoder().encode(
  '{"profile":"https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1","structural":{"constructs":[],"expressions":[],"occurrences":[],"ontology":{"annotations":[],"imports":[]},"roles":[],"subjects":[]}}',
);

test("admits the empty structural model as exact immutable canonical bytes", async () => {
  const source = emptySource();
  const document = await canonicalize(source, {
    profile: profiles.structuralContent,
  });
  expect(encode(document)).toEqual(emptyBytes);
  expect(Object.isFrozen(document.structural.ontology.imports)).toBe(true);
  expect(await decode(emptyBytes)).toEqual(document);
  expect(source).toEqual(emptySource());
  const callerBytes = encode(document);
  callerBytes[0] = 0;
  expect(encode(document)).toEqual(emptyBytes);
});

test("does not admit a copied document to the encoder", async () => {
  const document = await canonicalize(emptySource(), {
    profile: profiles.structuralContent,
  });
  expect(() => encode(JSON.parse(JSON.stringify(document)))).toThrow(
    expect.objectContaining({ code: "DOCUMENT_NOT_ADMITTED" }),
  );
});

test.each([
  "empty-structural",
  "empty-artifact",
  "named-class-structural",
  "named-class-artifact",
])(
  "agrees with the independently derived %s seed and verifies its exact bytes",
  async (name) => {
    const base = new URL(`../conformance/vectors/${name}/`, import.meta.url);
    const source = JSON.parse(
      await readFile(new URL("source.json", base), "utf8"),
    );
    const expected = new Uint8Array(
      await readFile(new URL("canonical.json", base)),
    );
    const expectedDocument = JSON.parse(new TextDecoder().decode(expected));
    const document = await canonicalize(source, {
      profile: expectedDocument.profile,
    });
    expect(encode(document)).toEqual(expected);
    expect(await decode(expected)).toEqual(expectedDocument);
  },
);
