// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import process from "node:process";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "../field-contract/positives.mjs";
import {
  baseline,
  profiles,
  readPinned,
  at,
  pointer,
} from "../field-contract/support.mjs";
import { corePairs } from "./core-pairs.mjs";
import { hash, json, pin, sourcePins } from "./support.mjs";
const { header } = await baseline();
await readPinned({
  path: "supplemental/field-contract/provenance-index.json",
  sha256: "973105bb24fa8668634a14c9d12c30a2a2fcbd72f4c003c4a52e9ab54bb7ba97",
});
const computed = [];
function focusPath(source, pair) {
  const category = pair.descriptor.startsWith("Expression:")
    ? "expressions"
    : "constructs";
  const handle = pair.descriptor.startsWith("Assertion:")
    ? "anchor-focus"
    : "focus";
  const path = [
    "structural",
    category,
    source.structural[category].findIndex((item) => item.id === handle),
  ];
  assert(path[2] >= 0);
  if (pair.descriptor.startsWith("Assertion:")) path.push("assertion");
  return path;
}
function differences(left, right, path = []) {
  if (JSON.stringify(left) === JSON.stringify(right)) return [];
  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    Array.isArray(left) === Array.isArray(right)
  ) {
    const keys = [
      ...new Set([...Object.keys(left), ...Object.keys(right)]),
    ].sort();
    return keys.flatMap((key) =>
      differences(left[key], right[key], [...path, key]),
    );
  }
  return [
    {
      pointer: pointer(path),
      ...(left !== undefined ? { before: left } : {}),
      ...(right !== undefined ? { after: right } : {}),
    },
  ];
}
function fieldFacts(result, pair) {
  const handle = pair.descriptor.startsWith("Assertion:")
    ? "anchor-focus"
    : "focus";
  let subject = `_:${result.correspondence.find((item) => item.sourceHandle === handle).rdfcIdentifier}`;
  const predicate = (field) =>
    `<https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#field/${field}>`;
  const lines = result.canonicalNQuads.trimEnd().split("\n");
  if (pair.descriptor.startsWith("Assertion:")) {
    const anchor = lines.filter((line) =>
      line.startsWith(`${subject} ${predicate("assertion")} `),
    );
    assert.equal(anchor.length, 1);
    subject = anchor[0].slice(
      `${subject} ${predicate("assertion")} `.length,
      -2,
    );
    assert(subject.startsWith("_:"));
  }
  const triples = lines.filter((line) =>
    line.startsWith(`${subject} ${predicate(pair.field)} `),
  );
  assert.equal(triples.length, 1, `${pair.id}: exact owning-field triple`);
  return { canonicalOwner: subject, predicate: predicate(pair.field), triples };
}
for (const pair of corePairs()) {
  const left = await produce(pair.before, profiles.structural),
    right = await produce(pair.after, profiles.structural);
  assert.notDeepEqual(
    left.bytes,
    right.bytes,
    `${pair.id}: retained field must change bytes`,
  );
  assert.notEqual(
    left.canonicalNQuads,
    right.canonicalNQuads,
    `${pair.id}: retained field must change dataset`,
  );
  const derived = [];
  for (const [side, source, result] of [
    ["before", pair.before, left],
    ["after", pair.after, right],
  ]) {
    const permutation = permute(source),
      permuted = await produce(permutation, profiles.structural);
    assert.deepEqual(
      permuted.bytes,
      result.bytes,
      `${pair.id}/${side}: typed permutations`,
    );
    assert.equal(permuted.canonicalNQuads, result.canonicalNQuads);
    derived.push({
      side,
      source,
      result,
      permutation,
      fieldFacts: fieldFacts(result, pair),
    });
  }
  const path = focusPath(pair.before, pair),
    compensated = structuredClone(pair.before);
  at(compensated, path)[pair.field] = structuredClone(
    at(pair.after, focusPath(pair.after, pair))[pair.field],
  );
  const companions = differences(compensated, pair.after);
  computed.push({ pair, derived, path, companions });
}
const exact = computed.filter((item) => item.companions.length === 0).length;
if (process.argv.includes("--check-recipes")) {
  console.log(
    JSON.stringify({
      independentlyDerivedPairs: computed.length,
      exactOneField: exact,
      requiresProjectionCompanions: computed.length - exact,
      completePermutationComparisons: computed.length * 2,
    }),
  );
} else {
  const vectors = [],
    pairs = [];
  for (const { pair, derived, path, companions } of computed) {
    const pairEvidence = {
      id: pair.id,
      obligation: pair.obligation,
      descriptor: pair.descriptor,
      field: pair.field,
      rules: pair.rules,
      sourceContract: pair.sourceContract,
      focusPointer: pointer([...path, pair.field]),
      evidenceClass: companions.length
        ? "field-change-with-required-projection-companions"
        : "exact-one-field-source-change",
      companionChanges: companions,
      sides: {},
    };
    for (const {
      side,
      source,
      result,
      permutation,
      fieldFacts: facts,
    } of derived) {
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
        files[name] = await pin(`core/${id}/${name}`, bytes);
      vectors.push({
        id,
        profile: profiles.structural,
        pair: pair.id,
        side,
        rules: pair.rules,
        status:
          "independently-derived-mapping-pair-pending-admission-and-review",
        counts: {
          primary: result.correspondence.length,
          blankNodes: result.blankNodeCount,
          quads: result.quadCount,
        },
        metamorphic: [
          "typed-handle-bijection",
          "set-reversal",
          "object-key-reversal",
          "sequence-order-preserved",
        ],
        files,
      });
      pairEvidence.sides[side] = {
        fixture: id,
        canonicalNQuads: files["canonical.nq"],
        canonicalBytes: files["canonical.json"],
        owningFieldFacts: facts,
      };
    }
    pairs.push(pairEvidence);
  }
  const pairInventory = await pin(
    "core-pair-inventory.json",
    json({
      format: "canonical-vowl-positive-mapping-pair-inventory/1",
      status: "independent-positive-counterexamples-pending-review",
      specificationRevision: header.specificationRevision,
      denominator: {
        primaryPairObligations: pairs.length,
        exactOneField: exact,
        requiredProjectionCompanions: pairs.length - exact,
      },
      qualification:
        "Every pair changes complete canonical RDF and JSON bytes and preserves each result under typed handle/set/key permutations. Projection-companion pairs are not isolated field-effect proofs; their complete changed source paths and exact owning-field RDF facts are recorded. No fixed discriminator or omitted descriptor is silently marked covered.",
      pairs,
    }),
  );
  await pin(
    "core-manifest.json",
    json({
      format: "canonical-vowl-conformance-manifest/1",
      status: "independent-mapping-counterexamples-core-pairs-pending-review",
      specificationRevision: header.specificationRevision,
      amendment: header.amendment,
      policy: header.policy,
      dependencies: header.dependencies,
      comparisonRules: header.comparisonRules,
      frozenFieldScope: {
        path: "supplemental/field-contract/provenance-index.json",
        sha256:
          "973105bb24fa8668634a14c9d12c30a2a2fcbd72f4c003c4a52e9ab54bb7ba97",
      },
      sourceArtifacts: await sourcePins([
        "support.mjs",
        "model.mjs",
        "core-pairs.mjs",
        "derive-core.mjs",
        "check-projection-fixtures.mjs",
      ]),
      pairInventory,
      vectors,
    }),
  );
  console.log(
    JSON.stringify({
      newPositiveVectors: vectors.length,
      independentPairs: pairs.length,
      exactOneField: exact,
      requiredProjectionCompanions: pairs.length - exact,
      corpusDigest: hash(json(vectors)),
    }),
  );
}
