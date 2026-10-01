// SPDX-License-Identifier: AGPL-3.0-only
// Active camera metadata is derived from the accepted authority. V1 and the
// original disputed expectations remain frozen historical evidence.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  hash,
  json,
  readPinned,
  repository,
} from "../field-contract/support.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const predecessor = {
  path: "supplemental/accepted-protocol-v1/camera-corrections-manifest.json",
  sha256: "a34e9f853a7669b147d9ace3f473f259673bdd986dee0c07d8d824e8de75ff6e",
};
const authority = {
  path: "docs/specs/2026-09-30-canonical-vowl-camera-error-precedence.md",
  sha256: "4c3f9e4be3ef17232ef37b1b465f85923938727e74465cb22e4076248a85c9e9",
};
await readPinned(authority, repository);
const previous = JSON.parse(await readPinned(predecessor));
const vectors = [];
const reasons = {
  "semantic-camera-positive-zoom-0":
    "Camera.zoom is finite zero. The accepted B3/A7 clarification makes strict positivity a stage-4 numeric scalar domain; the active expected error is NUMBER_INVALID.",
  "semantic-camera-positive-zoom-1":
    "Camera.zoom is finite negative one. The accepted B3/A7 clarification makes strict positivity a stage-4 numeric scalar domain; the active expected error is NUMBER_INVALID.",
  "semantic-overlap-reference-before-nonpositive-camera":
    "Finite nonpositive Camera.zoom fails with NUMBER_INVALID at stage 4 before the stage-5 dangling-reference check. The stable vector id retains its historical wording; its old precedence explanation is historical only.",
  "semantic-overlap-primary-id-before-nonpositive-camera":
    "Finite nonpositive Camera.zoom fails with NUMBER_INVALID at stage 4 before the stage-5 primary-ID uniqueness check. The stable vector id retains its historical wording; its old precedence explanation is historical only.",
  "semantic-overlap-projection-before-nonpositive-camera":
    "Finite nonpositive Camera.zoom fails with NUMBER_INVALID at stage 4 before stage-6 exact occurrence projection. The stable vector id retains its historical wording; its old precedence explanation is historical only.",
};
const contextFields = [
  "id",
  "operation",
  "profile",
  "obligation",
  "sourceFixture",
  "sourceManifest",
  "sourceWitness",
  "sourcePointer",
  "input",
];
for (const original of previous.vectors) {
  assert(Object.hasOwn(reasons, original.id));
  const source = JSON.parse(await readPinned(original.input));
  assert(
    Number.isFinite(source.visualization.camera.zoom) &&
      source.visualization.camera.zoom <= 0 &&
      !Object.is(source.visualization.camera.zoom, -0),
  );
  assert.equal(original.expectedError, "NUMBER_INVALID");
  vectors.push({
    ...Object.fromEntries(
      contextFields
        .filter((field) => Object.hasOwn(original, field))
        .map((field) => [field, original[field]]),
    ),
    expectedError: "NUMBER_INVALID",
    rules: [
      "B3-Camera.zoom-positive-domain",
      "A7-stage-4",
      "accepted-camera-error-precedence",
    ],
    reason: reasons[original.id],
    activeValidationStage: 4,
    status: "accepted-stage-4-expectation-with-consistent-active-metadata",
    authority,
    replaces: {
      manifest: predecessor,
      vectorId: original.id,
      recordSha256: hash(json(original)),
      inputUnchanged: true,
      expectedErrorUnchangedFromV1: true,
    },
    historical: {
      authority:
        "Historical record for provenance only; its rules/reason do not control this active overlay.",
      predecessorRecord: original,
    },
  });
}
assert.equal(vectors.length, 5);
assert.equal(new Set(vectors.map((item) => item.id)).size, 5);
const result = {
  format: "canonical-vowl-negative-manifest/1",
  metadataRevision: 2,
  status: "active-camera-overlay-metadata-correction-originals-preserved",
  authority,
  predecessor,
  historicalManifests: previous.historicalManifests,
  sourceArtifacts: [
    {
      path: "supplemental/accepted-protocol-v2/derive.mjs",
      sha256: hash(await readFile(fileURLToPath(import.meta.url))),
    },
  ],
  consumption:
    "Use these five vectors as the current camera overlay, matched by exact id, predecessor record hash and unchanged input identity. Top-level expectedError, rules, reason and activeValidationStage are the authoritative active fields. All content nested under historical is preserved provenance only and must never be merged into active expectation metadata. This replaces v1 metadata only: its five NUMBER_INVALID errors and all source bytes remain unchanged. All other active expectations are unchanged.",
  vectors,
};
const target = resolve(here, "camera-corrections-manifest.json"),
  bytes = Buffer.from(json(result));
if (process.argv.includes("--write-new")) {
  try {
    await writeFile(target, bytes, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
assert.deepEqual(
  await readFile(target),
  bytes,
  "Versioned active metadata is immutable",
);
console.log(
  JSON.stringify({
    activeCameraRecords: vectors.length,
    changedExpectedErrors: 0,
    changedInputs: 0,
    activeStage: 4,
    historicalMetadataPreserved: true,
  }),
);
