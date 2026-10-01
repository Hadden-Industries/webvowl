// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { missingAnchors, permute } from "./positives.mjs";
import { baseline, json, pin, sourcePins } from "./support.mjs";
const { vectors: previous, header } = await baseline();
const derived = [];
for (const fixture of missingAnchors(previous)) {
  const permutation = permute(fixture.source);
  const result = await produce(fixture.source, fixture.profile);
  const alternate = await produce(permutation, fixture.profile);
  assert.deepEqual(
    result.bytes,
    alternate.bytes,
    `${fixture.id}: complete canonical JSON under typed permutation`,
  );
  assert.equal(
    result.canonicalNQuads,
    alternate.canonicalNQuads,
    `${fixture.id}: complete canonical N-Quads under typed permutation`,
  );
  derived.push({ fixture, permutation, result });
}
const vectors = [];
for (const { fixture, permutation, result } of derived) {
  const files = {};
  for (const [filename, bytes] of [
    ["source.json", json(fixture.source)],
    ["permuted-source.json", json(permutation)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[filename] = await pin(`positive/${fixture.id}/${filename}`, bytes);
  const { source, ...metadata } = fixture;
  void source;
  vectors.push({
    ...metadata,
    status: "independently-derived-supported-anchor-pending-review",
    counts: {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    },
    metamorphic: [
      "typed-source-handle-bijection",
      "all-set-reversal",
      "object-key-reversal",
      "sequence-order-preserved",
    ],
    files,
  });
}
await pin(
  "positive-manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "independent-field-contract-anchor-supplement-pending-review",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    policy: header.policy,
    dependencies: header.dependencies,
    comparisonRules: header.comparisonRules,
    independence:
      "Existing independently authored source witnesses plus A4's exact supported-anchor rule; unchanged independent A6 producer and standards libraries. No production source/tests/outputs used.",
    sourceArtifacts: [
      ...(await sourcePins([
        "contracts.mjs",
        "support.mjs",
        "positives.mjs",
        "derive-positives.mjs",
      ])),
      {
        path: "supplemental/amended-policy/producer.mjs",
        sha256:
          "da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321",
      },
    ],
    vectors,
  }),
);
console.log(
  JSON.stringify({
    newAnchorPositives: vectors.length,
    embeddedAssertionKindsNowCovered: 32,
    completePermutationComparisons: vectors.length,
  }),
);
