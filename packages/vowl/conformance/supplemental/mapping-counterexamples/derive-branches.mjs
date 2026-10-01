// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "../field-contract/positives.mjs";
import { at, baseline, pointer } from "../field-contract/support.mjs";
import { branchPairs } from "./branch-pairs.mjs";
import { json, pin, sourcePins } from "./support.mjs";
const { header } = await baseline();
const computed = [];
function differences(left, right, path = []) {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    Array.isArray(left) === Array.isArray(right)
  )
    return [...new Set([...Object.keys(left), ...Object.keys(right)])]
      .sort()
      .flatMap((key) => differences(left[key], right[key], [...path, key]));
  return [
    {
      pointer: pointer(path),
      ...(left !== undefined ? { before: left } : {}),
      ...(right !== undefined ? { after: right } : {}),
    },
  ];
}
for (const pair of branchPairs()) {
  const results = [];
  for (const [side, source] of [
    ["before", pair.before],
    ["after", pair.after],
  ]) {
    const result = await produce(source, pair.profile),
      permutation = permute(source),
      alternate = await produce(permutation, pair.profile);
    assert.deepEqual(result.bytes, alternate.bytes);
    assert.equal(result.canonicalNQuads, alternate.canonicalNQuads);
    results.push({ side, source, result, permutation });
  }
  assert.notDeepEqual(
    results[0].result.bytes,
    results[1].result.bytes,
    pair.id,
  );
  assert.notEqual(
    results[0].result.canonicalNQuads,
    results[1].result.canonicalNQuads,
    pair.id,
  );
  const compensated = structuredClone(pair.before);
  at(compensated, pair.path)[pair.field] = at(pair.after, pair.path)[
    pair.field
  ];
  const companions = differences(compensated, pair.after);
  computed.push({ pair, results, companions });
}
const vectors = [],
  pairs = [];
for (const { pair, results, companions } of computed) {
  const entry = {
    id: pair.id,
    obligation: pair.obligation,
    additionalObligations: pair.additionalObligations,
    descriptor: pair.descriptor,
    field: pair.field,
    focusPointer: pointer([...pair.path, pair.field]),
    reason: pair.reason,
    evidenceClass: companions.length
      ? "cross-variant-required-shape-reference-projection-companions"
      : "exact-one-field-source-change",
    companionChanges: companions,
    sides: {},
  };
  for (const { side, source, result, permutation } of results) {
    const id = `${pair.id}-${side}`,
      files = {};
    for (const [name, contents] of [
      ["source.json", json(source)],
      ["permuted-source.json", json(permutation)],
      ["mapped.nq", result.mappedNQuads],
      ["canonical.nq", result.canonicalNQuads],
      ["ids.json", json(result.correspondence)],
      ["canonical.json", result.bytes],
    ])
      files[name] = await pin(`branches/${id}/${name}`, contents);
    vectors.push({
      id,
      profile: pair.profile,
      pair: pair.id,
      side,
      rules: ["A1", "A2", "A3", "A4", "B3", "A6", "D18.1"],
      status: "independent-branch-counterexample-pending-review",
      counts: {
        primary: result.correspondence.length,
        blankNodes: result.blankNodeCount,
        quads: result.quadCount,
      },
      files,
    });
    entry.sides[side] = files;
  }
  pairs.push(entry);
}
const inventory = await pin(
  "branch-pair-inventory.json",
  json({
    format: "canonical-vowl-cross-branch-pair-inventory/1",
    qualification:
      "Every case has valid complete before/after branch shapes selected independently from the contracts, changed full datasets/bytes, and invariant typed permutations. Fixed discriminants and mandatory payload/reference/projection companions are explicit. Coupled cases do not independently prove necessity of a single field; complete dataset comparison and per-field template traces remain required.",
    counts: {
      pairs: pairs.length,
      exactOneField: pairs.filter(
        (item) => item.evidenceClass === "exact-one-field-source-change",
      ).length,
    },
    pairs,
  }),
);
await pin(
  "branch-manifest.json",
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
      "core-pairs.mjs",
      "value-state-pairs.mjs",
      "branch-pairs.mjs",
      "derive-branches.mjs",
    ]),
    pairInventory: inventory,
    vectors,
  }),
);
console.log(
  JSON.stringify({
    positiveModels: vectors.length,
    branchPairs: pairs.length,
    exactOneField: pairs.filter(
      (item) => item.evidenceClass === "exact-one-field-source-change",
    ).length,
  }),
);
