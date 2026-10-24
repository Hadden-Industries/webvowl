// SPDX-License-Identifier: AGPL-3.0-only
// Storage integrity is independent of embedded JSON or RDF semantic admission.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  fixtureBundle,
  storageFormat,
} from "../packages/vowl/conformance/storage.mjs";
import { verifyCorpusStorage } from "../packages/vowl/scripts/verify-corpus-storage.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "vowl-storage-gate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(value, null, 2) + "\n");
  };
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const members = [
    [
      "supplemental/field-contract/negative/storage-control/source.json",
      '{"x":1,"x":2}',
    ],
    [
      "supplemental/field-contract/negative/storage-control/mapped.nq",
      "invalid RDF\n",
    ],
  ];
  const scope = {
    format: "canonical-vowl-corpus-storage-inventory/2",
    artifactCount: 2,
    bundleCount: 0,
    bundles: [],
    artifacts: [],
  };
  for (const [path, text] of members) {
    const bundlePath = fixtureBundle(path);
    const entry = {
      path,
      sha256: sha(text),
      byteLength: Buffer.byteLength(text),
      encoding: "utf8",
      text,
    };
    const bundle = { format: storageFormat, artifacts: [entry] };
    const bytes = Buffer.from(JSON.stringify(bundle, null, 2) + "\n");
    put(bundlePath, bundle);
    scope.bundles.push({
      path: bundlePath,
      sha256: sha(bytes),
      byteLength: bytes.length,
      members: 1,
    });
    scope.artifacts.push({
      path,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
      bundle: bundlePath,
      ...(path.endsWith(".json")
        ? { json: { pointer: "/artifacts/0/text", encoding: "utf8" } }
        : {}),
    });
  }
  scope.bundleCount = scope.bundles.length;
  // Neither inventory ordering nor valid JSON/RDF payloads are storage conditions.
  scope.artifacts.reverse();
  scope.bundles.reverse();
  const save = () => put("storage-inventory.json", scope);
  save();
  return { root: pathToFileURL(root + sep), scope, save, put };
}

test("the storage gate accepts exact bytes and JSON locators without JSON or RDF admission", (t) => {
  const data = fixture(t);
  assert.deepEqual(verifyCorpusStorage({ root: data.root }), {
    artifacts: 2,
    bundles: 2,
    looseCopies: 0,
  });
});

test("a wrong JSON pointer fails even when all container and payload hashes match", (t) => {
  const data = fixture(t);
  data.scope.artifacts.find((entry) => entry.json).json.pointer =
    "/artifacts/1/text";
  data.save();
  assert.throws(() => verifyCorpusStorage({ root: data.root }), /JSON locator/);
});

test("a wrong JSON encoding fails independently of unchanged payload identities", (t) => {
  const data = fixture(t);
  data.scope.artifacts.find((entry) => entry.json).json.encoding = "base64";
  data.save();
  assert.throws(() => verifyCorpusStorage({ root: data.root }), /JSON locator/);
});

test("changed N-Quads bytes fail the storage gate", (t) => {
  const data = fixture(t);
  const member = data.scope.artifacts.find((entry) =>
    entry.path.endsWith(".nq"),
  );
  data.put(member.bundle, { format: storageFormat, artifacts: [] });
  assert.throws(() => verifyCorpusStorage({ root: data.root }));
});
