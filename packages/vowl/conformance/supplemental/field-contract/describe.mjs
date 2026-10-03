// SPDX-License-Identifier: AGPL-3.0-only
import { definitions } from "./contracts.mjs";
import { obligations, denominatorPolicy } from "./inventory.mjs";
import { baseline, json, pin, sourcePins } from "./support.mjs";
const { header } = await baseline();
const cells = obligations();
const counts = {
  recordVariants: Object.keys(definitions).length,
  fieldPositions: Object.values(definitions).reduce(
    (total, item) => total + Object.keys(item.fields).length,
    0,
  ),
  obligations: cells.length,
  byMutation: {},
};
for (const cell of cells)
  counts.byMutation[cell.mutation] =
    (counts.byMutation[cell.mutation] ?? 0) + 1;
await pin(
  "contract-inventory.json",
  json({
    format: "canonical-vowl-field-contract-inventory/1",
    status:
      "independently-derived-descriptor-denominator-before-fixture-binding",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    denominatorPolicy,
    counts,
    sourceArtifacts: await sourcePins([
      "contracts.mjs",
      "inventory.mjs",
      "describe.mjs",
      "support.mjs",
    ]),
    definitions: Object.values(definitions),
    obligations: cells,
  }),
);
console.log(JSON.stringify(counts));
