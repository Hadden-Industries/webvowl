// SPDX-License-Identifier: AGPL-3.0-only
// B4 prefix lexical witnesses omitted by the historical scalar-domain selector.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { candidates } from "../field-contract/bindings.mjs";
import { at, hash, json, pointer } from "../field-contract/support.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const { records, header } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
]);
const witness = records
  .get("PrefixBinding")
  .find((item) => item.operation === "canonicalize");
assert(witness);
async function pin(path, value) {
  const bytes = Buffer.from(json(value)),
    target = resolve(here, path);
  if (process.argv.includes("--write-new")) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(await readFile(target), bytes);
  return {
    path: `supplemental/accepted-protocol-v1/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
const vectors = [];
for (const [id, prefix] of [
  ["prefix-forbidden-colon", ":"],
  ["prefix-initial-digit", "1bad"],
]) {
  const source = structuredClone(witness.document);
  at(source, witness.path).prefix = prefix;
  vectors.push({
    id,
    operation: "canonicalize",
    profile: witness.fixture.profile,
    expectedError: "DOCUMENT_TYPE",
    obligation: `scalar-domain/PrefixBinding/prefix/${id}`,
    input: await pin(`prefix/${id}/source.json`, source),
    sourceFixture: witness.fixture.id,
    sourceManifest: witness.fixture.manifest,
    sourceWitness: witness.fixture.files["source.json"],
    sourcePointer: pointer(witness.path),
    rules: [
      "B4-prefix-name-pattern",
      "A7-stage-4-field-scalar-domains",
      "A7-DOCUMENT_TYPE-closed-grammar",
    ],
    rationale:
      "B4 permits the empty name or [A-Za-z][A-Za-z0-9_-]*. This nonempty string violates that lexical grammar. A7 places field-specific scalar domains at stage4; DOCUMENT_TYPE is the existing closed-grammar code. This is the recorded independent protocol interpretation, not a new code or a production-derived expectation.",
  });
}
const manifest = await pin("prefix-negative-manifest.json", {
  format: "canonical-vowl-negative-manifest/1",
  specificationRevision: header.specificationRevision,
  sourceArtifacts: [
    {
      path: "supplemental/accepted-protocol-v1/derive-prefix.mjs",
      sha256: hash(await readFile(fileURLToPath(import.meta.url))),
    },
  ],
  vectors,
});
await pin("prefix-coverage-correction.json", {
  format: "canonical-vowl-field-coverage-correction/1",
  originalInventory: {
    path: "supplemental/field-contract/semantic-inventory.json",
    sha256: "5aa81c832eb6229c2266e84926f0dbedaa1c3a8c8aaad11259e31b99c9b192ea",
  },
  finding:
    "The original scalar selector enumerated iri/decimal/language-tag/language-range/text and omitted the distinct prefix descriptor; therefore its lexical completeness wording did not cover PrefixBinding.prefix.",
  correction:
    "Two new immutable lexical witnesses bind invalid punctuation and an invalid initial digit to B4's prefix-name pattern. The historical inventory and script remain frozen; this is an additive denominator of two negative classes, not a change to the original437 count.",
  manifest,
  closedFieldBinding: "type/PrefixBinding/prefix",
  status: "independent-additive-prefix-lexical-coverage",
});
console.log(
  JSON.stringify({
    prefixLexicalNegatives: vectors.length,
    originalInventoryUnchanged: true,
  }),
);
