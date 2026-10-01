// SPDX-License-Identifier: AGPL-3.0-only
// Accepted authority overlay. Original expected records and inputs are immutable.
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
const authorities = [
  {
    path: "docs/specs/2026-09-30-canonical-vowl-camera-error-precedence.md",
    sha256: "4c3f9e4be3ef17232ef37b1b465f85923938727e74465cb22e4076248a85c9e9",
  },
  {
    path: "docs/specs/2026-09-30-canonical-vowl-protocol-clarifications.md",
    sha256: "057bd8a3a15d5a574b753683917b871bd27bf239d9fd9ffad484550361cd84b4",
  },
];
for (const authority of authorities) await readPinned(authority, repository);
const historicalManifests = [
  {
    path: "supplemental/field-contract/semantic-negative-manifest.json",
    sha256: "9cf55e94c027024b8ba1ba2fc1b2a74201400a2685a826a04932f0b9bcf89e82",
  },
  {
    path: "supplemental/field-contract/semantic-overlap-manifest.json",
    sha256: "aa6d6c0a27eafb07c7c6e9b6b65bb99a0ddae556de41338d052f12b61b1f0ac8",
  },
];
const replacements = new Set([
  "semantic-camera-positive-zoom-0",
  "semantic-camera-positive-zoom-1",
  "semantic-overlap-reference-before-nonpositive-camera",
  "semantic-overlap-primary-id-before-nonpositive-camera",
  "semantic-overlap-projection-before-nonpositive-camera",
]);
const vectors = [];
for (const manifestPin of historicalManifests) {
  const manifest = JSON.parse(await readPinned(manifestPin));
  for (const original of manifest.vectors.filter((item) =>
    replacements.has(item.id),
  )) {
    const bytes = await readPinned(original.input),
      source = JSON.parse(bytes);
    assert(
      Number.isFinite(source.visualization.camera.zoom) &&
        source.visualization.camera.zoom <= 0,
    );
    assert(!Object.is(source.visualization.camera.zoom, -0));
    vectors.push({
      ...original,
      expectedError: "NUMBER_INVALID",
      status:
        "independently-derived-from-accepted-stage-4-camera-clarification",
      correction: {
        authority: authorities[0],
        historicalManifest: manifestPin,
        historicalExpectedError: original.expectedError,
        historicalRecordSha256: hash(json(original)),
        inputUnchanged: true,
        reason:
          "Finite nonpositive Camera.zoom is now explicitly a stage-4 numeric scalar failure, before graph reference/ID and projection validation. This expectation follows the accepted clarification without executing production.",
      },
    });
  }
}
assert.equal(vectors.length, 5);
assert.equal(new Set(vectors.map((item) => item.id)).size, 5);
const producer = {
  path: "supplemental/accepted-protocol-v1/derive.mjs",
  sha256: hash(await readFile(fileURLToPath(import.meta.url))),
};
async function pin(name, value) {
  const expected = Buffer.from(json(value)),
    target = resolve(here, name);
  if (process.argv.includes("--write-new")) {
    try {
      await writeFile(target, expected, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    expected,
    `${name}: immutable supplement`,
  );
  return {
    path: `supplemental/accepted-protocol-v1/${name}`,
    sha256: hash(expected),
    byteLength: expected.length,
  };
}
const corrections = await pin("camera-corrections-manifest.json", {
  format: "canonical-vowl-negative-manifest/1",
  status: "accepted-authority-supplement-original-expectations-preserved",
  authorities,
  historicalManifests,
  sourceArtifacts: [producer],
  consumption:
    "Apply these five records as an explicit overlay by exact vector id plus historical manifest/input identities. Do not run their superseded errors as current expectations; do not edit the historical manifest. Every other historical expected error is unchanged.",
  vectors,
});
await pin("resolution.json", {
  format: "canonical-vowl-accepted-protocol-resolution/1",
  authorities,
  sourceArtifacts: [producer],
  corrections,
  priorResolution: {
    path: "supplemental/review-resolution-v1/review-resolution.json",
    sha256: "b969622b933fef82d4521ec407309e1c255b3790258cd4074dd96ef9fefd80aa",
  },
  decisions: [
    {
      id: "camera-positive-domain",
      status: "accepted-owner-clarification",
      consequence:
        "Five expected errors receive the explicit NUMBER_INVALID overlay; all original source files/records remain frozen.",
    },
    {
      id: "lexical-unicode-envelope-order",
      status: "accepted-owner-clarification",
      consequence:
        "Unicode/JSON numeric admission occurs before canonical-envelope checks for byte decoding. Historical overlapping and isolated Unicode inputs keep their existing errors.",
    },
    {
      id: "inverse-edge-endpoints",
      status: "accepted-owner-clarification",
      consequence:
        "from/to follows the forward partition's effective domain/range. Existing independent bytes require no change.",
    },
    {
      id: "operator-edge-endpoints",
      status: "accepted-owner-clarification",
      consequence:
        "from is the operator node and to its drawable operand. Existing independent bytes require no change.",
    },
  ],
  limitation:
    "Authority resolution and immutable correction derivation do not establish production execution, full conformance, or profile freeze. This supplement did not read or execute product implementation/tests.",
});
console.log(
  JSON.stringify({
    correctedExpectations: vectors.length,
    authoritiesPinned: authorities.length,
    historicalInputsUnchanged: true,
  }),
);
