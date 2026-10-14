// SPDX-License-Identifier: AGPL-3.0-only
// Consumer tests retain WebVOWL's independent corpus and archive identities.
import test from "node:test";
import assert from "node:assert/strict";
import { readRepositoryLogicalJson } from "./runRepositoryJsonQuality.mjs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  checkJsonDocument,
  checkJsonLines,
  jsonContract,
} from "../tooling/json/public-api.mjs";

test("the repository adapter exposes every independently inventoried JSON member", () => {
  const { logicalInventory, logicalDocuments } = readRepositoryLogicalJson();
  assert.equal(logicalInventory.length, 5851);
  assert.equal(logicalDocuments.length, 5851);
  assert.equal(new Set(logicalInventory.map((entry) => entry.path)).size, 5851);
  const path =
    "packages/vowl/conformance/supplemental/field-contract/semantic/scalar-domain-annotationvalue-language-lexical/source.json";
  const expected = logicalInventory.find((entry) => entry.path === path);
  assert.equal(
    expected.sha256,
    "da6d2b553eceef5d585ad217e55767151c9a3951ebc132a797a4e13ccc33e361",
  );
  assert.equal(expected.byteLength, 1259);
  assert.ok(
    logicalDocuments
      .find((entry) => entry.path === path)
      .bytes.includes(Buffer.from("\uFDD0")),
  );
});

test("the installed archive, consumer lock and retained provenance identify one qualified source", () => {
  const base = new URL("../tooling/json/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("package.json", base)));
  const reference = manifest.devDependencies["@hadden-industries/json-quality"];
  const archive = new URL(reference.slice(5), base);
  const pin = JSON.parse(
    readFileSync(new URL(reference.slice(5) + ".provenance.json", base)),
  );
  const lock = JSON.parse(readFileSync(new URL("package-lock.json", base)));
  assert.equal(pin.sourceClean, true);
  assert.equal(
    createHash("sha256").update(readFileSync(archive)).digest("hex"),
    pin.sha256,
  );
  assert.equal(
    lock.packages["node_modules/@hadden-industries/json-quality"].integrity,
    pin.integrity,
  );
  assert.equal(
    lock.packages[""].devDependencies["@hadden-industries/json-quality"],
    reference,
  );
});

test("all physical vectors remain checked and only canonical presentation has an alternate producer contract", () => {
  const policy = JSON.parse(
    readFileSync(new URL("../.json-quality.json", import.meta.url)),
  );
  for (const name of ["source.json", "ids.json", "canonical.json"]) {
    const contract = jsonContract(
      `packages/vowl/conformance/vectors/named-class-structural/${name}`,
      policy,
      { tracked: true },
    );
    assert.equal(contract.exclude, false);
    assert.equal(contract.normalization, "NFC");
    assert.equal(contract.allowFormatWrites, false);
    assert.equal(contract.expected, undefined);
    assert.equal(contract.preserveNfcValues, undefined);
    assert.equal(
      contract.formatContract,
      name === "canonical.json"
        ? "producer-json-compact-body"
        : "prettier-json",
    );
  }
  assert.equal(jsonContract(".mcp.json", policy).exclude, false);
});

test("the installed engine applies the approved narrow NFC identities to original fixture bytes", async () => {
  const policy = JSON.parse(
    readFileSync(new URL("../.json-quality.json", import.meta.url)),
  );
  for (const path of [
    "packages/vowl/conformance/supplemental/negative/vectors/language-non-ascii-subtag/source.json",
    "packages/vowl/conformance/supplemental/compatible-artifact-v2/vectors.jsonl",
  ]) {
    const bytes = readFileSync(new URL("../" + path, import.meta.url));
    const contract = jsonContract(path, policy, { tracked: true });
    assert.equal(contract.normalization, "NFC");
    assert.equal(
      contract.preserveNfcValues.length,
      path.endsWith(".jsonl") ? 5 : 1,
    );
    const analyzed = await (
      path.endsWith(".jsonl") ? checkJsonLines : checkJsonDocument
    )(bytes, contract);
    assert.deepEqual(analyzed.findings, []);
    const changed = Buffer.from(
      bytes
        .toString("utf8")
        .replace(
          path.endsWith(".jsonl") ? "literal-unicode-spelling-b" : "en-K",
          "changed-approved-identity",
        ),
    );
    assert(!changed.equals(bytes));
    const rejected = await (
      path.endsWith(".jsonl") ? checkJsonLines : checkJsonDocument
    )(changed, contract);
    assert(
      rejected.findings.some((f) =>
        ["preservationMismatch", "nfc-record-identity-mismatch"].includes(
          f.messageId,
        ),
      ),
    );
  }
});

test("the real adapter forwards machine reporting and resource limits through the installed CLI", () => {
  const result = spawnSync(
    process.execPath,
    [
      "util/runRepositoryJsonQuality.mjs",
      "inventory",
      "--json",
      "--max-files",
      "1",
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.operation, "inventory");
  assert.equal(output.complete, false);
  assert.equal(output.counts, null);
  assert.equal(result.stderr, "");
});
