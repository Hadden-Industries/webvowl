import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "@jest/globals";
import {
  legacyNamedEntities,
  assertLegacyCoverage,
  writeLegacySources,
  assertComparisonMediaType,
} from "./compareOwl2VowlPerformance.mjs";

const legacy = {
  classAttribute: [
    { iri: "urn:Class" },
    { iri: "urn:Class" },
    { id: "anonymous" },
  ],
  propertyAttribute: [{ iri: "urn:property" }],
};
const expected = { class: ["urn:Class"], property: ["urn:property"] };
const current = { documents: 7, unresolved: 0, entities: expected };

test("XML fixture bytes cannot be qualified under a Turtle media type", () => {
  for (const text of [
    '<?xml version="1.0"?><rdf:RDF/>',
    '\ufeff \n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/>',
  ]) {
    const bytes = new TextEncoder().encode(text);
    assert.throws(
      () => assertComparisonMediaType(bytes, "text/turtle"),
      /Frozen RDF\/XML input has an incompatible media type/u,
    );
    assert.doesNotThrow(() =>
      assertComparisonMediaType(bytes, "application/rdf+xml"),
    );
  }
  assert.doesNotThrow(() =>
    assertComparisonMediaType(
      new TextEncoder().encode(
        "# Frozen Turtle\n@prefix owl: <http://www.w3.org/2002/07/owl#>.",
      ),
      "text/turtle",
    ),
  );
});

test("original converter IRIs, rather than unstable legacy IDs, own the named-role sink", () => {
  assert.deepEqual(legacyNamedEntities(legacy), expected);
  assert.throws(
    () => legacyNamedEntities({}),
    /Missing original converter output/u,
  );
  assert.doesNotThrow(() => assertLegacyCoverage(expected, current));
});

test("Java consumes the captured browser bytes despite a later dist rewrite", async () => {
  const scratch = await mkdtemp(join(tmpdir(), "owl2vowl-source-test-"));
  try {
    const file = join(scratch, "mutable-dist");
    await writeFile(file, "verified source bytes");
    const input = {
      documentIri: "urn:original-document",
      mediaType: "text/turtle",
      file,
      base64: (await readFile(file)).toString("base64"),
    };
    await writeFile(file, "different bytes after verification");
    const manifest = await writeLegacySources([input], scratch);
    const fields = (await readFile(manifest, "utf8")).trimEnd().split("\t");
    assert.equal(fields[0], input.documentIri);
    assert.equal(fields[1], input.mediaType);
    assert.notEqual(fields[2], file);
    assert.deepEqual(
      await readFile(fields[2]),
      Buffer.from(input.base64, "base64"),
    );
    assert.notDeepEqual(await readFile(fields[2]), await readFile(file));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("same-count wrong-IRI results cannot qualify fast conversion", () => {
  for (const kind of ["class", "property"]) {
    const wrong = structuredClone(current);
    wrong.entities[kind] = ["urn:wrong"];
    assert.throws(() => assertLegacyCoverage(expected, wrong), /Missing/u);
  }
});

test("incomplete or unresolved imports reject timing even with matching named entities", () => {
  assert.throws(
    () => assertLegacyCoverage(expected, { ...current, documents: 6 }),
    /Incomplete/u,
  );
  assert.throws(
    () => assertLegacyCoverage(expected, { ...current, unresolved: 1 }),
    /Unresolved/u,
  );
});
