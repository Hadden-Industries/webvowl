// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveJsonQualityPolicy,
  resolveJsonSourceContract,
} from "@hadden-industries/json-quality";
import { verifyBundledJsonCoverage } from "./verifyGeneratedRepositoryJson.mjs";

const policy = resolveJsonQualityPolicy(
  JSON.parse(readFileSync(new URL("../.json-quality.json", import.meta.url))),
);

function contractFor(path) {
  return resolveJsonSourceContract(path, policy, { tracked: true });
}

test("tracked JSON keeps its owner's presentation and rewrite policy", () => {
  const vectors = "packages/vowl/conformance/vectors/named-class-structural/";
  for (const [path, presentation] of [
    [
      "src/ontology-loading/contracts/ontology-archive-capture.v1.schema.json",
      "prettier-json",
    ],
    [vectors + "source.json", "prettier-json"],
    [vectors + "ids.json", "prettier-json"],
    [vectors + "canonical.json", "producer-json-compact-body"],
  ]) {
    const contract = contractFor(path);
    assert.equal(contract.excludeUntrackedSources, false, path);
    assert.equal(contract.formatContract, presentation, path);
    assert.equal(contract.allowSourceRewrites, false, path);
    assert.equal(contract.normalization, "NFC", path);
    assert.equal(contract.expected, undefined, path);
    assert.equal(contract.nfcExemptStringValues, undefined, path);
  }
  assert.equal(contractFor(".mcp.json").excludeUntrackedSources, false);
});

test("NFC exemptions apply only to the approved value and JSONL record", () => {
  const corpus = "packages/vowl/conformance/supplemental/";
  const document = contractFor(
    corpus + "negative/vectors/language-non-ascii-subtag/source.json",
  );
  assert.equal(document.normalization, "NFC");
  assert.deepEqual(
    document.nfcExemptStringValues.map(({ pointer, record }) => ({
      pointer,
      record,
    })),
    [{ pointer: "/structural/constructs/0/value/language", record: undefined }],
  );

  const records = contractFor(corpus + "compatible-artifact-v2/vectors.jsonl");
  assert.equal(records.normalization, "NFC");
  assert.deepEqual(
    records.nfcExemptStringValues.map(({ pointer }) => pointer),
    [
      "/source/qualifications/sourceStatements/0/object/value/lexical",
      "/permuted/qualifications/sourceStatements/0/object/value/lexical",
      "/expectedUtf8",
      "/baseNQuads",
      "/canonicalNQuads",
    ],
  );
  for (const pin of records.nfcExemptStringValues) {
    assert.deepEqual(pin.record, {
      pointer: "/id",
      value: "literal-unicode-spelling-b",
    });
  }
});

test("bundled coverage requires each path once and a successful repository result", async () => {
  const paths = ["corpus/a.json", "corpus/b.json"];
  const sources = paths.map((path) => ({ type: "source", path }));
  const terminal = { type: "execution-terminal", contractSatisfied: true };

  assert.equal(
    await verifyBundledJsonCoverage([...sources, terminal], paths),
    2,
  );
  await assert.rejects(
    verifyBundledJsonCoverage([sources[0], terminal], paths),
    /Missing bundled JSON member.*corpus\/b\.json/u,
  );
  await assert.rejects(
    verifyBundledJsonCoverage([...sources, sources[0], terminal], paths),
    /Duplicate bundled JSON member.*corpus\/a\.json/u,
  );
  await assert.rejects(
    verifyBundledJsonCoverage(sources, paths),
    /repository check did not complete/u,
  );
  await assert.rejects(
    verifyBundledJsonCoverage(
      [...sources, { ...terminal, contractSatisfied: false }],
      paths,
    ),
    /repository contract failed/u,
  );
});
