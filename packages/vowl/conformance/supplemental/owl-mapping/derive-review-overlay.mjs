// SPDX-License-Identifier: AGPL-3.0-only
// Additive normative review correction; historical source/model/bytes stay frozen.
import assert from "node:assert/strict";
import process from "node:process";
import {
  authorities,
  hash,
  json,
  localPin,
  pin,
  readPinned,
} from "./support.mjs";
await authorities();
const predecessor = {
  path: "supplemental/owl-mapping/seed-manifest.json",
  sha256: "042e6ed08f4ffeb8d7d4d45b33b267d09d1b008355e523334a37a96dfc2fd579",
};
const seed = JSON.parse(await readPinned(predecessor));
const original = seed.vectors.find(
  ({ id }) => id === "unverified-custom-datatype",
);
assert(original);
const active = structuredClone(original);
for (const run of active.runs) {
  if (run.outcome === "success")
    run.diagnostics.push({
      code: "MAPPING_GLOBAL_RESTRICTION",
      restrictionIdentifier: "DATATYPE_DEFINITION_COUNT",
    });
}
active.rules.push("OWL-11.2", "D21.3");
active.rationale =
  "The custom literal remains unverifiable under A9.2. Independently, OWL 11.2's datatype-definition requirement is violated by the absence of a defining axiom. D21.3 requires every compatibility recovery to be diagnosed, so successful compatibility runs contain both diagnostic conditions. A9.2's explicit strict unverified-literal error remains unchanged. No retained model or byte changes.";
assert.deepEqual(active.root, original.root);
assert.deepEqual(active.expected, original.expected);
const receipt = await pin(
  "review-overlay-v1.json",
  json({
    format: "independent-canonical-vowl-owl-mapping-review-overlay-v1",
    predecessor,
    specificationRevision: seed.specificationRevision,
    reviewBasis: [
      {
        source:
          "https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/#Global_Restrictions_on_Axioms_in_OWL_2_DL",
        clause: "11.2 Restrictions on Datatypes",
        implication:
          "A declared non-builtin datatype with no definition violates the separate global definition-count condition.",
      },
      {
        source: "D21.3",
        implication: "Each compatibility recovery must be diagnosed.",
      },
      {
        source: "A9.2",
        implication:
          "The explicit strict unverified-literal mapping code remains controlling for this overlap.",
      },
    ],
    producer: await localPin("derive-review-overlay.mjs"),
    replaces: [
      {
        id: original.id,
        recordSha256: hash(json(original)),
        historicalRecord: original,
      },
    ],
    vectors: [active],
  }),
);
console.log(
  JSON.stringify(
    {
      overlay: receipt,
      correctedVectors: 1,
      changedCanonicalBytes: 0,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
