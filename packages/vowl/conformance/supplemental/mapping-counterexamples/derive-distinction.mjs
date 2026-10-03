// SPDX-License-Identifier: AGPL-3.0-only
// The set/sequence pair requires its closed construct and B2 companions.
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { baseline, profiles } from "../field-contract/support.mjs";
import { permute } from "../field-contract/positives.mjs";
import { model, projectFixture } from "./model.mjs";
import { json, pin, sourcePins } from "./support.mjs";
const { header } = await baseline(),
  m = model();
m.alternatives("P");
const before = structuredClone(m.source),
  after = structuredClone(m.source);
before.structural.constructs.push({
  id: "focus",
  kind: "equivalent-object-properties",
  members: ["p", "q"],
});
after.structural.constructs.push({
  id: "focus",
  kind: "property-chain",
  members: ["p", "q"],
  super: "p",
});
projectFixture(before);
projectFixture(after);
const vectors = [],
  results = [];
for (const [side, source] of [
  ["before", before],
  ["after", after],
]) {
  const result = await produce(source, profiles.structural),
    alternate = permute(source),
    reproduced = await produce(alternate, profiles.structural);
  assert.deepEqual(result.bytes, reproduced.bytes);
  assert.equal(result.canonicalNQuads, reproduced.canonicalNQuads);
  results.push(result);
  const id = `set-versus-sequence-${side}`,
    files = {};
  for (const [name, contents] of [
    ["source.json", json(source)],
    ["permuted-source.json", json(alternate)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[name] = await pin(`distinction/${id}/${name}`, contents);
  vectors.push({
    id,
    profile: profiles.structural,
    pair: "set-versus-sequence",
    side,
    rules: ["D18.1", "A4", "A6.3", "B2"],
    status: "independent-pair-pending-review",
    counts: {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    },
    files,
  });
}
assert.notDeepEqual(results[0].bytes, results[1].bytes);
assert.notEqual(results[0].canonicalNQuads, results[1].canonicalNQuads);
await pin(
  "distinction-manifest.json",
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
      "derive-distinction.mjs",
    ]),
    pair: {
      id: "set-versus-sequence",
      evidenceClass:
        "cross-variant-required-shape-reference-projection-companions",
      sourceMembers: ["p", "q"],
      qualification:
        "The same two source references occupy a Set in an equivalent-properties record and a Sequence in a property-chain record. Kind, the chain's required super field, and the resulting grouped-property projection necessarily change. This pair establishes complete distinct valid results, while exact A6 container/slot traces establish the distinct mapping templates; it is not an isolated necessity proof.",
    },
    vectors,
  }),
);
console.log(
  JSON.stringify({ positiveModels: vectors.length, pairedDistinctions: 1 }),
);
