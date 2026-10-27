import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as vowlLanguageTags from "bcp-47";
import { canonicalize, decode, encode, profiles } from "vowl";

// Resolve through each actual consumer so an upstream exact pin or deduplication
// cannot silently substitute one parser for the other in this compatibility check.
const requireVowl = createRequire(import.meta.url);
const requireOwlapi = createRequire(requireVowl.resolve("owlapi"));
const owlapiLanguageTags = await import(
  pathToFileURL(requireOwlapi.resolve("bcp-47")).href
);

const source = () =>
  JSON.parse(
    readFileSync(
      new URL(
        "../conformance/vectors/annotated-class/source.json",
        import.meta.url,
      ),
    ),
  );
const options = { profile: profiles.structuralContent };
const text = (document) => new TextDecoder().decode(encode(document));

test.each([
  "EN-gb",
  "x-private",
  "en-x-example",
  "en-u-ca-gregory",
  "de-CH-1901",
  "sl-rozaj-biske-1994",
  "i-klingon",
  "en-GB-oed",
  "zh-min-nan",
])(
  "OwlAPI and VOWL language parsers preserve valid tag %s",
  async (language) => {
    const parsed = [owlapiLanguageTags, vowlLanguageTags].map((parser) => {
      const warnings = [];
      const value = parser.parse(language, {
        normalize: false,
        warning: (reason) => warnings.push(reason),
      });
      expect(warnings).toEqual([]);
      expect(parser.stringify(value)).toBe(language);
      return value;
    });
    expect(parsed[0]).toEqual(parsed[1]);
    const model = source();
    model.structural.constructs[0].value.language = language;
    model.structural.constructs[1].assertion.value.language = language;
    const document = await canonicalize(model, options);
    expect(text(document)).toContain(`"language":"${language.toLowerCase()}"`);
    expect(encode(await decode(encode(document)))).toEqual(encode(document));
  },
);

test.each(["x", "en-x", "EN-x", "de-1901-x", "en-u-ca-gregory-x"])(
  "empty private-use suffix %s remains invalid across the parser patch update",
  async (language) => {
    for (const parser of [owlapiLanguageTags, vowlLanguageTags]) {
      const parsed = parser.parse(language, { normalize: false });
      // Both consumers require lossless parsing. Version 2.1.1 silently drops
      // the suffix; 2.1.2 reports the missing subtag. Neither may accept it.
      expect(parser.stringify(parsed).toLowerCase()).not.toBe(
        language.toLowerCase(),
      );
    }
    const model = source();
    model.structural.constructs[0].value.language = language;
    await expect(canonicalize(model, options)).rejects.toMatchObject({
      code: "LANGUAGE_TAG_INVALID",
    });
  },
);

test.each(["en-a-foo-a-bar", "de-1901-1901", "en_Us", "en-K"])(
  "rejects malformed RFC5646 tag %s",
  async (language) => {
    const model = source();
    model.structural.constructs[0].value.language = language;
    await expect(canonicalize(model, options)).rejects.toMatchObject({
      code: "LANGUAGE_TAG_INVALID",
    });
  },
);

test("ASCII tag normalization is idempotent and does not change lexical text", async () => {
  const model = source();
  model.structural.constructs[0].value.language = "EN-gb";
  model.structural.constructs[1].assertion.value.language = "eN-GB";
  const expected = await canonicalize(source(), options);
  expect(encode(await canonicalize(model, options))).toEqual(encode(expected));
  model.structural.constructs[0].value.lexical = "Colo\u0075r\u0301";
  model.structural.constructs[1].assertion.value.lexical = "Colo\u0075r\u0301";
  expect(text(await canonicalize(model, options))).not.toEqual(text(expected));
});

test("IRI spelling and complete-member UTF-8 ordering preserve the declared identity", async () => {
  const model = source();
  // U+F900 is an allowed BMP ucschar; private-use U+E000 is forbidden in an IRI path.
  model.structural.ontology.imports = [
    "urn:\ud800\udc00",
    "urn:\uf900",
    "urn:%41",
    "urn:A",
  ];
  const doc = await canonicalize(model, options);
  expect(doc.structural.ontology.imports).toEqual([
    "urn:%41",
    "urn:A",
    "urn:\uf900",
    "urn:\ud800\udc00",
  ]);
});

test("boxed literal controls and supplementary Unicode round-trip through actual RDF/JCS", async () => {
  const model = source();
  model.structural.constructs[1].annotations[0].value.lexical =
    "a\u0000\b\f\n\r\t😀𝄞";
  const doc = await canonicalize(model, options);
  expect(encode(await decode(encode(doc)))).toEqual(encode(doc));
  const escaped = text(doc).replaceAll("😀", "\\ud83d\\ude00");
  await expect(decode(new TextEncoder().encode(escaped))).rejects.toMatchObject(
    { code: "NON_CANONICAL_BYTES" },
  );
});

test("source-set duplicate checks follow case normalization, but chains keep repetition", async () => {
  const model = source();
  const annotation = {
    predicate: "https://example.org/o#note",
    value: { kind: "language", lexical: "x", language: "en" },
    annotations: [],
  };
  model.structural.ontology.annotations.push(annotation, {
    ...annotation,
    value: { ...annotation.value, language: "EN" },
  });
  await expect(canonicalize(model, options)).rejects.toMatchObject({
    code: "SOURCE_DUPLICATE_SET_MEMBER",
  });
});

test("safe snapshots copy shared values and reject non-data shapes without invoking serialization", async () => {
  const model = source();
  const baseline = await canonicalize(model, options);
  model.structural.constructs[1].assertion.value =
    model.structural.constructs[0].value;
  expect(encode(await canonicalize(model, options))).toEqual(encode(baseline));
  let invoked = false;
  model.structural.subjects[0].toJSON = () => {
    invoked = true;
    return {};
  };
  await expect(canonicalize(model, options)).rejects.toMatchObject({
    code: "SOURCE_UNSAFE_VALUE",
  });
  expect(invoked).toBe(false);
  const sparse = source();
  delete sparse.structural.roles[0];
  await expect(canonicalize(sparse, options)).rejects.toMatchObject({
    code: "SOURCE_UNSAFE_VALUE",
  });
  const symbol = source();
  symbol[Symbol("private")] = true;
  await expect(canonicalize(symbol, options)).rejects.toMatchObject({
    code: "SOURCE_UNSAFE_VALUE",
  });
});

test("partial lexical chunks preserve astral characters and stop oversized decoded strings", async () => {
  const model = source();
  model.structural.constructs[1].annotations[0].value.lexical =
    "x".repeat(1023) + "😀".repeat(300) + "𝄞";
  const doc = await canonicalize(model, options);
  expect(encode(await decode(encode(doc)))).toEqual(encode(doc));
  await expect(
    decode(encode(doc), { limits: { stringBytes: 1100 } }),
  ).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { limit: "stringBytes" },
  });
});
