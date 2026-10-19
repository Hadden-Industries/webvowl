// SPDX-License-Identifier: AGPL-3.0-only
// Consumer tests retain WebVOWL's independent corpus and installed-source identities.
import test from "node:test";
import assert from "node:assert/strict";
import { readRepositoryLogicalJson } from "./runRepositoryJsonQuality.mjs";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkJsonDocument,
  checkJsonLines,
  jsonContract,
  verifyJsonQualityInstallation,
  formatJsonDocument,
  validateJsonQualityResult,
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

test("the native source selector, lock, generated bootstrap and installed payload agree", async () => {
  const result = await verifyJsonQualityInstallation({
    toolingRoot: fileURLToPath(new URL("../tooling/json/", import.meta.url)),
    bootstrapPath: fileURLToPath(
      new URL("./installRepositoryQualityTools.mjs", import.meta.url),
    ),
  });
  assert.ok(result.files > 0);
});

test("supplied-document verification uses the current export and canonical check modifier", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const packageBytes = readFileSync(
    new URL("../package.json", import.meta.url),
  );
  const request = {
    schemaVersion: 1,
    requestId: "consumer-interface",
    path: "package.json",
    contentBase64: Buffer.from('{"value":1.00e+2}').toString("base64"),
  };
  const response = await formatJsonDocument(request, {
    root,
    check: true,
    capacityLimits: false,
  });
  assert.equal(response.result.schemaVersion, 4);
  assert.equal(response.result.operation, "format");
  assert.equal(response.result.check, true);
  assert.equal(response.result.status, "failed");
  assert.equal(response.contentBase64, request.contentBase64);
  validateJsonQualityResult(response.result);
  assert.deepEqual(response.result.writes.changed, []);
  assert.deepEqual(
    readFileSync(new URL("../package.json", import.meta.url)),
    packageBytes,
  );
});

test("repository JSON scripts use the canonical format and protected-scope modifiers", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  assert.equal(
    scripts["format:json:check"],
    "node util/runRepositoryJsonQuality.mjs format --check",
  );
  assert.equal(
    scripts["check:json:producers"],
    "node util/runRepositoryJsonQuality.mjs check --scope protected",
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
