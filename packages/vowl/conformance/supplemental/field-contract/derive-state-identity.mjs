// SPDX-License-Identifier: AGPL-3.0-only
// D18.2 / AC-005: a retained state change can relabel structural category IDs.
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "./positives.mjs";
import { baseline, hash, json, pin, profiles, sourcePins } from "./support.mjs";

const { header } = await baseline();
const source = {
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [
      { id: "subject-alpha", iri: "urn:state-identity:Alpha" },
      { id: "subject-beta", iri: "urn:state-identity:Beta" },
    ],
    roles: [
      { id: "role-alpha", kind: "class", subject: "subject-alpha" },
      { id: "role-beta", kind: "class", subject: "subject-beta" },
    ],
    expressions: [],
    constructs: [],
    occurrences: [
      { id: "node-alpha", kind: "class-node", targets: ["role-alpha"] },
      { id: "node-beta", kind: "class-node", targets: ["role-beta"] },
    ],
  },
  visualization: {
    placements: [
      { occurrence: "node-alpha", position: { x: 0, y: 0 }, pinned: false },
      { occurrence: "node-beta", position: { x: 10, y: 0 }, pinned: false },
    ],
    camera: { center: { x: 0, y: 0 }, zoom: 1 },
    hidden: [],
    labelSelection: { mode: "iri" },
    prefixes: [],
    display: {
      compactNotation: false,
      nodeScaling: "uniform",
      externalColoring: false,
    },
  },
};
function associations(result) {
  return result.correspondence
    .map((item) => {
      let semanticKey;
      if (item.category === "subjects")
        semanticKey = source.structural.subjects.find(
          (record) => record.id === item.sourceHandle,
        ).iri;
      else if (item.category === "roles") {
        const role = source.structural.roles.find(
          (record) => record.id === item.sourceHandle,
        );
        semanticKey = `${role.kind}:${source.structural.subjects.find((record) => record.id === role.subject).iri}`;
      } else {
        const occurrence = source.structural.occurrences.find(
          (record) => record.id === item.sourceHandle,
        );
        const role = source.structural.roles.find(
          (record) => record.id === occurrence.targets[0],
        );
        semanticKey = `class-node:${source.structural.subjects.find((record) => record.id === role.subject).iri}`;
      }
      return {
        category: item.category,
        semanticKey,
        sourceHandle: item.sourceHandle,
        canonicalId: item.canonicalId,
        rdfcIdentifier: item.rdfcIdentifier,
      };
    })
    .sort((a, b) =>
      a.semanticKey < b.semanticKey
        ? -1
        : a.semanticKey > b.semanticKey
          ? 1
          : 0,
    );
}
const before = await produce(source, profiles.artifact);
const beforeAssociations = associations(before);
const probes = [];
let selected;
for (let x = 1; x <= 64; x++) {
  const alternate = structuredClone(source);
  alternate.visualization.placements[0].position.x = x;
  const result = await produce(alternate, profiles.artifact);
  const afterAssociations = associations(result);
  const changed = beforeAssociations
    .filter(
      (item, index) =>
        item.canonicalId !== afterAssociations[index].canonicalId,
    )
    .map((item, index_) => {
      void index_;
      return {
        ...item,
        afterCanonicalId: afterAssociations.find(
          (after) => after.semanticKey === item.semanticKey,
        ).canonicalId,
      };
    });
  probes.push({
    x,
    canonicalSha256: hash(result.bytes),
    changedPrimaryIds: changed.length,
  });
  if (changed.length) {
    selected = {
      source: alternate,
      result,
      associations: afterAssociations,
      changed,
      x,
    };
    break;
  }
}
assert(
  selected,
  "The bounded independent search did not establish category-ID relabelling; do not claim AC-005 coverage.",
);
assert.deepEqual(selected.source.structural, source.structural);
assert.notEqual(before.canonicalNQuads, selected.result.canonicalNQuads);
assert.notDeepEqual(before.bytes, selected.result.bytes);
const vectors = [];
for (const fixture of [
  { id: "state-identity-before", source, result: before },
  {
    id: "state-identity-after",
    source: selected.source,
    result: selected.result,
  },
]) {
  const permutation = permute(fixture.source);
  const permuted = await produce(permutation, profiles.artifact);
  assert.deepEqual(fixture.result.bytes, permuted.bytes);
  assert.equal(fixture.result.canonicalNQuads, permuted.canonicalNQuads);
  const files = {};
  for (const [name, bytes] of [
    ["source.json", json(fixture.source)],
    ["permuted-source.json", json(permutation)],
    ["mapped.nq", fixture.result.mappedNQuads],
    ["canonical.nq", fixture.result.canonicalNQuads],
    ["ids.json", json(fixture.result.correspondence)],
    ["canonical.json", fixture.result.bytes],
  ])
    files[name] = await pin(`state-identity/${fixture.id}/${name}`, bytes);
  vectors.push({
    id: fixture.id,
    profile: profiles.artifact,
    rules: ["A6", "B2.3", "B3", "D18.1", "D18.2", "AC-005"],
    status: "independently-derived-state-only-category-relabel-pending-review",
    counts: {
      primary: fixture.result.correspondence.length,
      blankNodes: fixture.result.blankNodeCount,
      quads: fixture.result.quadCount,
    },
    metamorphic: [
      "typed-source-handle-bijection",
      "all-set-reversal",
      "object-key-reversal",
    ],
    files,
  });
}
const associationsPin = await pin(
  "state-identity/associations.json",
  json({
    structuralSourceSha256: hash(json(source.structural)),
    exactChangedSourcePointer: "/visualization/placements/0/position/x",
    beforeValue: 0,
    afterValue: selected.x,
    before: beforeAssociations,
    after: selected.associations,
    changed: selected.changed,
    boundedSearch: {
      method:
        "Try x=1..64 in ascending order, stop at first canonical category-ID difference; all other source data is equal.",
      probes,
    },
    limitation:
      "Named semantic keys make this association comparison unambiguous. It does not claim every state change alters every primary ID, nor durable source-handle IDs under symmetry.",
  }),
);
await pin(
  "state-identity-manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "independent-state-only-identity-pair-pending-review",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    policy: header.policy,
    dependencies: header.dependencies,
    comparisonRules: header.comparisonRules,
    sourceArtifacts: await sourcePins([
      "support.mjs",
      "contracts.mjs",
      "positives.mjs",
      "derive-state-identity.mjs",
    ]),
    producer: {
      path: "supplemental/amended-policy/producer.mjs",
      sha256:
        "da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321",
    },
    associations: associationsPin,
    independence:
      "The A6 producer and bounded source-state search are independent of product outputs. Sources have identical structure and one changed x coordinate; named subject/role/occurrence associations expose complete category ranks.",
    vectors,
  }),
);
console.log(
  JSON.stringify({
    positivePair: vectors.length,
    selectedX: selected.x,
    changedPrimaryIds: selected.changed.map(
      (item) =>
        `${item.semanticKey}: ${item.canonicalId} -> ${item.afterCanonicalId}`,
    ),
  }),
);
