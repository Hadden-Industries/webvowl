// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "../field-contract/positives.mjs";
import { at, baseline, pointer } from "../field-contract/support.mjs";
import { json, pin, sourcePins } from "./support.mjs";
import { valueStatePairs } from "./value-state-pairs.mjs";
const { header } = await baseline();
const vectors = [],
  pairs = [];
for (const pair of valueStatePairs()) {
  const results = [];
  for (const [side, source] of [
    ["before", pair.before],
    ["after", pair.after],
  ]) {
    const result = await produce(source, pair.profile),
      permutation = permute(source),
      alternative = await produce(permutation, pair.profile);
    assert.deepEqual(
      result.bytes,
      alternative.bytes,
      `${pair.id}/${side}: bytes under permutation`,
    );
    assert.equal(result.canonicalNQuads, alternative.canonicalNQuads);
    results.push(result);
    const id = `${pair.id}-${side}`,
      files = {};
    for (const [name, bytes] of [
      ["source.json", json(source)],
      ["permuted-source.json", json(permutation)],
      ["mapped.nq", result.mappedNQuads],
      ["canonical.nq", result.canonicalNQuads],
      ["ids.json", json(result.correspondence)],
      ["canonical.json", result.bytes],
    ])
      files[name] = await pin(`value-state/${id}/${name}`, bytes);
    vectors.push({
      id,
      profile: pair.profile,
      pair: pair.id,
      side,
      rules: ["A2", "A3", "A4", "A6", "B3", "B4", "D18.1"],
      status: "independent-positive-mapping-pair-pending-review",
      counts: {
        primary: result.correspondence.length,
        blankNodes: result.blankNodeCount,
        quads: result.quadCount,
      },
      metamorphic: [
        "typed-handle-bijection",
        "set-reversal",
        "object-key-reversal",
      ],
      files,
    });
  }
  assert.notDeepEqual(results[0].bytes, results[1].bytes, pair.id);
  assert.notEqual(
    results[0].canonicalNQuads,
    results[1].canonicalNQuads,
    pair.id,
  );
  const compensated = structuredClone(pair.before);
  at(compensated, pair.path)[pair.field] = structuredClone(
    at(pair.after, pair.path)[pair.field],
  );
  const exact = JSON.stringify(compensated) === JSON.stringify(pair.after);
  assert(
    exact || pair.companionReason,
    `Unexplained companion mutation in ${pair.id}`,
  );
  pairs.push({
    id: pair.id,
    obligation: pair.obligation,
    additionalObligations: pair.additionalObligations ?? [],
    descriptor: pair.descriptor,
    field: pair.field,
    focusPointer: pointer([...pair.path, pair.field]),
    evidenceClass: exact
      ? "exact-one-field-source-change"
      : "required-artifact-bijection-companion",
    ...(pair.companionReason ? { companionReason: pair.companionReason } : {}),
    before: vectors.at(-2).files,
    after: vectors.at(-1).files,
  });
}
const inventory = await pin(
  "value-state-pair-inventory.json",
  json({
    format: "canonical-vowl-positive-mapping-pair-inventory/1",
    counts: {
      pairs: pairs.length,
      exactOneField: pairs.filter(
        (item) => item.evidenceClass === "exact-one-field-source-change",
      ).length,
    },
    policy:
      "Additional owning-field obligations name only ancestors of the exact changed field, never unrelated nested fields. Placement-reference swaps explicitly preserve B3's required bijection; they do not claim a valid isolated placement-reference change.",
    pairs,
  }),
);
await pin(
  "value-state-manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    policy: header.policy,
    dependencies: header.dependencies,
    comparisonRules: header.comparisonRules,
    sourceArtifacts: await sourcePins([
      "support.mjs",
      "model.mjs",
      "value-state-pairs.mjs",
      "derive-values-state.mjs",
    ]),
    pairInventory: inventory,
    vectors,
  }),
);
console.log(
  JSON.stringify({
    newPositiveVectors: vectors.length,
    pairs: pairs.length,
    exactOneField: pairs.filter(
      (item) => item.evidenceClass === "exact-one-field-source-change",
    ).length,
  }),
);
