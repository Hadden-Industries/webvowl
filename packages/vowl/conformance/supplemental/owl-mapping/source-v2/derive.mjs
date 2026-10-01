// SPDX-License-Identifier: AGPL-3.0-only
// Source-only correction from normative OWL 3.7; no product output or golden rewrite.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { loadCorpus, manifestPins } from "../catalog.mjs";
import { hash, json, localPin, pin, readPinned } from "../support.mjs";

const previousScope = {
  path: "supplemental/owl-mapping/provenance-index.json",
  sha256: "3ebdcce7388a8648516dedcc03bd597ac777ef71f30cb276f9db7354a70f72d7",
};
const scope = JSON.parse(await readPinned(previousScope));
for (const reference of scope.artifacts) await readPinned(reference);
const previous = await loadCorpus();
const forbidden = "Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>)\n";
const changes = [],
  vectors = [];
for (const old of previous.vectors) {
  const vector = structuredClone(old);
  const inputs = [
    ["root", vector.root],
    ...vector.imports.map((input, i) => [`import-${i}`, input]),
  ];
  for (const [name, input] of inputs) {
    const before = input.bytes,
      bytes = await readPinned(before),
      text = bytes.toString("utf8");
    assert.deepEqual(
      Buffer.from(text, "utf8"),
      bytes,
      "Exact UTF-8 input round-trip",
    );
    const index = text.indexOf(forbidden);
    if (index === -1) continue;
    assert.equal(
      text.indexOf(forbidden, index + 1),
      -1,
      "Only one known redundant declaration per fixture",
    );
    assert(
      index === 0 || text[index - 1] === "\n",
      "Removal is a complete top-level declaration line",
    );
    assert(
      index < text.indexOf("Ontology("),
      "Declaration precedes the ontology body",
    );
    const afterText =
      text.slice(0, index) + text.slice(index + forbidden.length);
    assert(
      !/^Prefix\((?:rdf|rdfs|xsd|owl):/m.test(afterText),
      "No prohibited standard prefix declaration remains",
    );
    const offset = Buffer.byteLength(text.slice(0, index), "utf8");
    const removedBytes = Buffer.from(forbidden, "utf8");
    const afterBytes = Buffer.concat([
      bytes.subarray(0, offset),
      bytes.subarray(offset + removedBytes.length),
    ]);
    assert.deepEqual(afterBytes, Buffer.from(afterText, "utf8"));
    input.bytes = await pin(
      `source-v2/inputs/${vector.id}/${name}.input`,
      afterBytes,
    );
    changes.push({
      vector: vector.id,
      input: name,
      before,
      after: input.bytes,
      removal: {
        byteOffset: offset,
        byteLength: removedBytes.length,
        utf8Text: forbidden,
        sha256: hash(removedBytes),
      },
    });
  }
  const reconstructed = structuredClone(vector);
  reconstructed.root.bytes = old.root.bytes;
  reconstructed.imports.forEach((input, index) => {
    input.bytes = old.imports[index].bytes;
  });
  assert.deepEqual(reconstructed, old, "Only input byte references may change");
  assert.deepEqual(
    vector.expected,
    old.expected,
    "Expected models, RDF, IDs and canonical bytes remain pinned unchanged",
  );
  vectors.push(vector);
}
assert.equal(changes.length, 29);
const oldEmpty = previous.vectors.find(
  ({ id }) => id === "empty-anonymous-ontology",
);
const prefixControls = [
  {
    id: "reserved-xsd-prefix/default",
    vector: { ...oldEmpty, id: "reserved-xsd-prefix", expected: undefined },
    run: {
      id: "default",
      options: {},
      outcome: "error",
      errorCode: "MAPPING_SYNTAX_INVALID",
    },
  },
  {
    id: "reserved-xsd-prefix/strict",
    vector: { ...oldEmpty, id: "reserved-xsd-prefix", expected: undefined },
    run: {
      id: "strict",
      options: {
        mappingProfile:
          "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1",
      },
      outcome: "error",
      errorCode: "MAPPING_SYNTAX_INVALID",
    },
  },
];
const result = await pin(
  "source-v2/manifest.json",
  json({
    format: "independent-canonical-vowl-owl-source-revision-v2",
    previousScope,
    previousManifests: manifestPins,
    correction: {
      authority:
        "https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Functional-Style_Syntax",
      clauses: ["3.7", "2.4 Table 2"],
      reason:
        "OWL Functional Syntax forbids declarations of the standard prefix names rdf:, rdfs:, xsd: and owl:. Their mappings are predefined. The historical authoring helper wrongly declared xsd:, so the first public comparison's syntax errors were conforming parser rejections, not adapter defects.",
      scope:
        "Remove only the exact redundant xsd declaration line from each affected source byte input. Standard xsd: uses remain valid without an explicit declaration. No ontology content, expected retained model, diagnostic/error expectation, or canonical output changes. Intended malformed/ambiguous/unsupported cases remain negative cases.",
    },
    producerSources: await Promise.all(
      ["source-v2/derive.mjs", "source-v2/README.md"].map(localPin),
    ),
    changes,
    vectors,
    prefixControls,
  }),
);
console.log(
  JSON.stringify(
    {
      manifest: result,
      changedInputFiles: changes.length,
      activeVectors: vectors.length,
      profileRuns: vectors.reduce(
        (count, vector) => count + vector.runs.length,
        0,
      ),
      historicalPrefixControls: prefixControls.length,
      changedExpectedFiles: 0,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
