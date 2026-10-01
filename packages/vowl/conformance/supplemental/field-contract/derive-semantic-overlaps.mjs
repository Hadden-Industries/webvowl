// SPDX-License-Identifier: AGPL-3.0-only
// Follow-up stage-boundary witnesses, leaving the first semantic batch frozen.
import assert from "node:assert/strict";
import { candidates } from "./bindings.mjs";
import { json, pin, sourcePins } from "./support.mjs";
const { records, header } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
  "supplemental/field-contract/state-identity-manifest.json",
]);
const structural = records
  .get("DocumentStructural")
  .find((item) => item.operation === "decode");
const artifact = records
  .get("Camera")
  .find(
    (item) =>
      item.operation === "canonicalize" &&
      item.document.structural.roles.length &&
      item.document.structural.occurrences.length,
  );
assert(structural && artifact);
const recipes = [
  [
    "envelope-structural-type-before-unknown-profile",
    structural,
    "DOCUMENT_TYPE",
    (document) => {
      document.structural = null;
      document.profile = "urn:field-contract:unknown";
    },
    "A7 stage4: common canonical-envelope required/type checks precede known-profile checks.",
  ],
  [
    "reference-before-nonpositive-camera",
    artifact,
    "REFERENCE_DANGLING",
    (document) => {
      document.structural.roles[0].subject = "field-contract-absent-subject";
      document.visualization.camera.zoom = 0;
    },
    "A7 stage5 reference existence precedes stage7 B3 positive camera zoom.",
  ],
  [
    "primary-id-before-nonpositive-camera",
    artifact,
    "ID_DUPLICATE",
    (document) => {
      document.structural.occurrences[0].id = document.structural.roles[0].id;
      document.visualization.camera.zoom = 0;
    },
    "A7 stage5 primary ID uniqueness precedes stage7 B3 positive camera zoom.",
  ],
  [
    "projection-before-nonpositive-camera",
    artifact,
    "PROJECTION_INVALID",
    (document) => {
      document.structural.occurrences = [];
      document.visualization.placements = [];
      document.visualization.hidden = [];
      document.visualization.camera.zoom = 0;
    },
    "No dangling state references remain; A7 stage6 missing exact projection precedes stage7 camera invariants.",
  ],
  [
    "scalar-before-nonpositive-camera",
    artifact,
    "IRI_INVALID",
    (document) => {
      document.structural.ontology.iri = "relative-reference";
      document.visualization.camera.zoom = 0;
    },
    "A7 stage4 scalar domain precedes stage7 camera invariants.",
  ],
];
const vectors = [];
for (const [id, witness, expectedError, mutate, reason] of recipes) {
  const document = structuredClone(witness.document);
  mutate(document);
  const input = await pin(
    `semantic-overlap/${id}/${witness.operation === "decode" ? "document" : "source"}.json`,
    json(document),
  );
  vectors.push({
    id: `semantic-overlap-${id}`,
    operation: witness.operation,
    ...(witness.operation === "canonicalize"
      ? { profile: witness.fixture.profile }
      : {}),
    expectedError,
    reason,
    sourceFixture: witness.fixture.id,
    sourceManifest: witness.fixture.manifest,
    sourceWitness:
      witness.fixture.files[
        witness.operation === "decode" ? "canonical.json" : "source.json"
      ],
    input,
    rules: ["A7", "B3"],
    status: "independent-stage-overlap-expectation-pending-review",
  });
}
await pin(
  "semantic-overlap-manifest.json",
  json({
    format: "canonical-vowl-negative-manifest/1",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    sourceArtifacts: await sourcePins([
      "contracts.mjs",
      "support.mjs",
      "bindings.mjs",
      "derive-semantic-overlaps.mjs",
    ]),
    inventory: {
      obligations: vectors.length,
      category:
        "A7 ordered stage overlaps independent of the pending lexical Unicode/envelope question",
      limitations:
        "The multi-fault cases deliberately establish precedence, not isolated one-field validity; missing projection clears its dependent placement references to isolate stage6 from stage7.",
    },
    vectors,
  }),
);
console.log(JSON.stringify({ semanticStageOverlaps: vectors.length }));
