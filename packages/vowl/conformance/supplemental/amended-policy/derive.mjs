// SPDX-License-Identifier: AGPL-3.0-only
// Independent expected bytes under the explicitly approved A8 resource amendment.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import "./prepare-producer.mjs";
import { produce } from "./producer.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "../..");
const repo = resolve(bundle, "../../..");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const writeNew = process.argv.includes("--write-new");
async function pinned(path, bytes) {
  const target = resolve(here, path),
    buffer = Buffer.from(bytes);
  if (writeNew) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, buffer, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    buffer,
    `${path}: no expectation overwrites`,
  );
  return {
    path: `supplemental/amended-policy/${path}`,
    sha256: sha256(buffer),
    byteLength: buffer.length,
  };
}
const manifests = [],
  vectors = [],
  retained = [];
for (const path of [
  "manifest.json",
  "extended-manifest.json",
  "supplemental/grammar/manifest.json",
]) {
  const bytes = await readFile(resolve(bundle, path));
  manifests.push({ path, sha256: sha256(bytes) });
  const previous = JSON.parse(bytes);
  for (const vector of previous.vectors) {
    const source = JSON.parse(
      await readFile(resolve(bundle, vector.files["source.json"].path)),
    );
    const result = await produce(source, vector.profile);
    if (vector.files["permuted-source.json"]) {
      const permuted = JSON.parse(
        await readFile(
          resolve(bundle, vector.files["permuted-source.json"].path),
        ),
      );
      const alternate = await produce(permuted, vector.profile);
      assert.deepEqual(
        alternate.bytes,
        result.bytes,
        `${vector.id}: complete bytes under permutation`,
      );
      assert.equal(
        alternate.canonicalNQuads,
        result.canonicalNQuads,
        `${vector.id}: canonical graph under permutation`,
      );
    }
    if (!vector.expectedError) {
      assert.deepEqual(
        result.bytes,
        await readFile(resolve(bundle, vector.files["canonical.json"].path)),
        `${vector.id}: every previous successful byte unchanged`,
      );
      assert.equal(
        result.canonicalNQuads,
        await readFile(
          resolve(bundle, vector.files["canonical.nq"].path),
          "utf8",
        ),
        `${vector.id}: every previous successful RDFC graph unchanged`,
      );
      retained.push({
        id: vector.id,
        previousManifest: path,
        canonicalSha256: sha256(result.bytes),
        canonicalNQuadsSha256: sha256(result.canonicalNQuads),
        permutationVerified: Boolean(vector.files["permuted-source.json"]),
      });
      vectors.push({
        ...vector,
        status: "previous-success-reproduced-unchanged-under-amended-policy",
        previousManifest: path,
      });
    } else {
      assert.equal(vector.expectedError, "RDFC_RESOURCE_LIMIT");
      const files = {
        "source.json": vector.files["source.json"],
        "permuted-source.json": vector.files["permuted-source.json"],
      };
      for (const [name, bytes] of [
        ["mapped.nq", result.mappedNQuads],
        ["canonical.nq", result.canonicalNQuads],
        ["ids.json", json(result.correspondence)],
        ["canonical.json", result.bytes],
      ])
        files[name] = await pinned(`vectors/${vector.id}/${name}`, bytes);
      vectors.push({
        id: vector.id,
        profile: vector.profile,
        rules: [
          ...new Set([
            ...vector.rules,
            "A6.3",
            "A8-amended-2026-09-30",
            "B1",
            "B2.2",
            "B2.3",
          ]),
        ],
        status: "new-amended-policy-positive-pending-independent-review",
        historicalRejection: {
          manifest: path,
          expectedError: vector.expectedError,
          policy: "min(B,100000)",
        },
        counts: {
          primary: result.correspondence.length,
          blankNodes: result.blankNodeCount,
          quads: result.quadCount,
        },
        effectiveDefaultDeepBudget: Math.min(
          result.blankNodeCount ** 2,
          100000,
        ),
        metamorphic: vector.metamorphic,
        files,
      });
    }
  }
}
assert.equal(retained.length, 92);
assert.equal(vectors.length, 95);
const baseline = JSON.parse(
  await readFile(resolve(bundle, "manifest.json"), "utf8"),
);
const amendmentPath =
  "docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md";
const amendmentBytes = await readFile(resolve(repo, amendmentPath));
const artifacts = [];
for (const path of [
  "oracle/producer.mjs",
  "supplemental/amended-policy/producer.mjs",
  "supplemental/amended-policy/prepare-producer.mjs",
  "supplemental/amended-policy/derive.mjs",
])
  artifacts.push({
    path,
    sha256: sha256(await readFile(resolve(bundle, path))),
  });
await pinned(
  "retained-positive-proof.json",
  json({
    priorPositiveCount: retained.length,
    completeBytesAndCanonicalNQuadsUnchanged: true,
    vectors: retained,
  }),
);
await pinned(
  "manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "owner-approved-policy-independent-corpus-pending-review",
    specificationRevision: baseline.specificationRevision,
    amendment: {
      path: amendmentPath,
      sha256: sha256(amendmentBytes),
      approval:
        "Owner approved the exact quadratic capped work-policy amendment on 2026-09-30, as communicated by the parent integration task. Approval does not waive independent review.",
    },
    policy: {
      formula: "min(totalAllocatedBlankNodes ** 2, rdfDeepIterations)",
      defaultRdfDeepIterations: 100000,
      upperCallerOverride: 1000000,
      defaultDeadlineMs: 10000,
      zeroOverrideAllowed: true,
      fallbackAllowed: false,
    },
    dependencies: { "rdf-canonize": "5.0.0", canonicalize: "5.1.0" },
    sourceArtifacts: artifacts,
    priorManifests: manifests,
    preservation: {
      historicalFilesUnchanged: true,
      previousPositiveCount: retained.length,
      newPositiveCount: 3,
      priorResourceRejectionsRemainHistorical: true,
    },
    comparisonRules: {
      "mapped.nq":
        "RDF dataset isomorphism; private labels/order are not contractual.",
      "canonical.nq": "Exact canonical N-Quads bytes.",
      "canonical.json": "Exact complete JCS bytes.",
      "ids.json":
        "Informative derivation only; symmetric handle correspondences are not contractual.",
    },
    vectors,
  }),
);
console.log(
  JSON.stringify({
    retainedPositive: retained.length,
    newPositive: 3,
    activePositiveTotal: vectors.length,
    result: "complete amended-policy bytes pinned; independent review pending",
  }),
);
