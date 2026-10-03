// SPDX-License-Identifier: AGPL-3.0-only
// Read-only accounting over explicit frozen pair inventories.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundle, here } from "./support.mjs";
const previous = JSON.parse(
  await readFile(
    resolve(
      bundle,
      "supplemental/field-contract/mapping-injectivity-inventory.json",
    ),
  ),
);
const obligations = new Map(previous.obligations.map((item) => [item.id, []]));
for (const item of previous.obligations)
  if (item.pair)
    obligations.get(item.id).push({
      inventory: "historical",
      evidenceClass: "exact-one-field-source-change",
    });
for (const name of ["core", "value-state", "derived", "branch"]) {
  const inventory = JSON.parse(
    await readFile(resolve(here, `${name}-pair-inventory.json`)),
  );
  for (const pair of inventory.pairs)
    for (const id of [pair.obligation, ...(pair.additionalObligations ?? [])]) {
      if (!obligations.has(id)) throw new Error(`Unknown obligation ${id}`);
      obligations.get(id).push({
        inventory: name,
        pair: pair.id,
        evidenceClass: pair.evidenceClass,
      });
    }
}
console.log(
  JSON.stringify(
    {
      fieldPositions: obligations.size,
      withPair: [...obligations.values()].filter((items) => items.length)
        .length,
      exactOneField: [...obligations.values()].filter((items) =>
        items.some(
          (item) => item.evidenceClass === "exact-one-field-source-change",
        ),
      ).length,
      remaining: [...obligations]
        .filter(([, items]) => !items.length)
        .map(([id]) => id),
    },
    null,
    2,
  ),
);
