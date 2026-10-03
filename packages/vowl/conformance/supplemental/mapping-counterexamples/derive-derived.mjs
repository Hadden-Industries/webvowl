// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "../field-contract/positives.mjs";
import { at, baseline, pointer, profiles } from "../field-contract/support.mjs";
import { json, pin, sourcePins } from "./support.mjs";
import { derivedCandidates } from "./derived-field-pairs.mjs";
const { header } = await baseline();
const vectors = [],
  pairs = [],
  fixed = [];
for (const entry of await derivedCandidates()) {
  if (!entry.candidates.length) {
    fixed.push({
      obligation: entry.obligation,
      status: "fixed-by-closed-grammar-not-an-isolated-pair",
      reason:
        "B1 PropertyContext is exactly kind:property. A different value is invalid in this narrowed record, so no valid isolated token change exists; its required RDF token still needs template evidence.",
    });
    continue;
  }
  let selected;
  for (const candidate of entry.candidates) {
    const before = await produce(candidate.before, profiles.artifact),
      after = await produce(candidate.after, profiles.artifact);
    if (before.canonicalNQuads !== after.canonicalNQuads) {
      selected = { candidate, before, after };
      break;
    }
  }
  assert(
    selected,
    `${entry.obligation}: only automorphic state changes found; do not claim a distinction`,
  );
  const { candidate, before, after } = selected;
  assert.notDeepEqual(before.bytes, after.bytes);
  const id = entry.obligation.replaceAll(/[^A-Za-z0-9]+/g, "-").toLowerCase();
  const evidence = {
    id,
    obligation: entry.obligation,
    descriptor: entry.descriptor,
    field: entry.field,
    sourceFixture: candidate.fixture,
    ...(candidate.sourceWitness
      ? { sourceWitness: candidate.sourceWitness }
      : {}),
    focusPointer: pointer([...candidate.path, entry.field]),
    beforeValue: at(candidate.before, candidate.path)[entry.field] ?? null,
    afterValue: at(candidate.after, candidate.path)[entry.field],
    evidenceClass:
      "complete-projection-handle-reassociation-with-distinct-artifact-state",
    sourceChange:
      "Two occurrence payloads exchange source handles; every structural O reference follows that bijection, preserving the complete B1 generation-key set. Placement handles remain fixed to expose different position associations. For edges, hidden closure follows the fixed selected handle. This is an explicitly coupled witness, never a valid isolated projection-field edit.",
    handles: [candidate.first, candidate.second],
    sides: {},
  };
  for (const [side, source, result] of [
    ["before", candidate.before, before],
    ["after", candidate.after, after],
  ]) {
    const permutation = permute(source),
      check = await produce(permutation, profiles.artifact);
    assert.deepEqual(result.bytes, check.bytes);
    assert.equal(result.canonicalNQuads, check.canonicalNQuads);
    const vectorId = `${id}-${side}`,
      files = {};
    for (const [name, contents] of [
      ["source.json", json(source)],
      ["permuted-source.json", json(permutation)],
      ["mapped.nq", result.mappedNQuads],
      ["canonical.nq", result.canonicalNQuads],
      ["ids.json", json(result.correspondence)],
      ["canonical.json", result.bytes],
    ])
      files[name] = await pin(`derived/${vectorId}/${name}`, contents);
    vectors.push({
      id: vectorId,
      profile: profiles.artifact,
      pair: id,
      side,
      rules: ["B1", "B2", "B3", "A6", "D18.1"],
      status: "independent-coupled-projection-mapping-witness-pending-review",
      counts: {
        primary: result.correspondence.length,
        blankNodes: result.blankNodeCount,
        quads: result.quadCount,
      },
      files,
    });
    evidence.sides[side] = files;
  }
  pairs.push(evidence);
}
const inventory = await pin(
  "derived-pair-inventory.json",
  json({
    format: "canonical-vowl-derived-field-pair-inventory/1",
    policy:
      "Derived B1 fields cannot independently violate a fixed projection. These valid artifact pairs preserve the structural generation-key set and deliberately change its association to explicit layout/visibility. Full canonical datasets and bytes differ, with handle/set/key permutations invariant. These coupled pairs do not prove isolated necessity of each field; all companion transformations remain explicit.",
    counts: { coupledPairs: pairs.length, fixedFields: fixed.length },
    fixed,
    pairs,
  }),
);
await pin(
  "derived-manifest.json",
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
      "derived-field-pairs.mjs",
      "derive-derived.mjs",
    ]),
    pairInventory: inventory,
    vectors,
  }),
);
console.log(
  JSON.stringify({
    positiveModels: vectors.length,
    coupledDerivedPairs: pairs.length,
    fixedFields: fixed.length,
  }),
);
