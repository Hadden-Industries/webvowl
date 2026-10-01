// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { visit } from "../field-contract/contracts.mjs";
import { baseline, profiles, pointer } from "../field-contract/support.mjs";
import { permute } from "../field-contract/positives.mjs";
import { derivedCandidates } from "./derived-field-pairs.mjs";
import { json, pin, sourcePins } from "./support.mjs";
const obligation = "mapping/Context:property/scope",
  descriptor = "Context:property",
  field = "scope";
const entry = (await derivedCandidates()).find(
  (item) => item.obligation === obligation,
);
let selected;
for (const candidate of entry.candidates) {
  let witnessed = false;
  for (const source of [candidate.before, candidate.after])
    visit(source, "SourceArtifact", (type, value, path) => {
      if (
        type.name === descriptor &&
        pointer(path) === pointer(candidate.path) &&
        Object.hasOwn(value, field)
      )
        witnessed = true;
    });
  if (!witnessed) continue;
  const before = await produce(candidate.before, profiles.artifact),
    after = await produce(candidate.after, profiles.artifact);
  if (before.canonicalNQuads === after.canonicalNQuads) continue;
  selected = { candidate, before, after };
  break;
}
assert(
  selected,
  "No candidate exercises scope on the actual class-node Context:property descriptor",
);
const { candidate } = selected,
  vectors = [];
for (const side of ["before", "after"]) {
  const source = candidate[side],
    result = selected[side],
    alternate = permute(source),
    reproduced = await produce(alternate, profiles.artifact);
  assert.deepEqual(result.bytes, reproduced.bytes);
  assert.equal(result.canonicalNQuads, reproduced.canonicalNQuads);
  const id = `context-property-scope-binding-${side}`,
    files = {};
  for (const [name, contents] of [
    ["source.json", json(source)],
    ["permuted-source.json", json(alternate)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[name] = await pin(`binding-correction/${id}/${name}`, contents);
  vectors.push({
    id,
    profile: profiles.artifact,
    pair: "context-property-scope-binding",
    side,
    rules: ["D18.1", "B1", "B2.4", "A6"],
    status: "independent-pair-pending-review",
    counts: {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    },
    files,
  });
}
const { header } = await baseline();
await pin(
  "binding-correction-manifest.json",
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
      "derive-binding-correction.mjs",
    ]),
    pair: {
      id: "context-property-scope-binding",
      obligation,
      descriptor,
      field,
      focusPointer: pointer([...candidate.path, field]),
      sourceWitness: candidate.sourceWitness,
      evidenceClass:
        "complete-projection-handle-reassociation-with-distinct-artifact-state",
      correction:
        "The original derived pair changes a class-node Context:property with absent scope into a datatype-node PropertyContext with present scope. It remains a valid complete artifact pair, but does not exercise a present Context:property.scope at that position. This additive pair requires the stated descriptor to carry the scoped field, preserving all historical outputs and metadata.",
    },
    vectors,
  }),
);
console.log(
  JSON.stringify({
    positiveModels: vectors.length,
    correctedBinding: obligation,
  }),
);
