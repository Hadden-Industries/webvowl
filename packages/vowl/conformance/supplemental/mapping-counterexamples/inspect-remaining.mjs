// SPDX-License-Identifier: AGPL-3.0-only
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bundle } from "./support.mjs";
const previous = JSON.parse(
  await readFile(
    resolve(
      bundle,
      "supplemental/field-contract/mapping-injectivity-inventory.json",
    ),
  ),
);
const current = JSON.parse(
  await readFile(
    resolve(
      bundle,
      "supplemental/mapping-counterexamples/core-pair-inventory.json",
    ),
  ),
);
const covered = new Set([
  ...previous.obligations
    .filter((item) => item.status === "paired-difference-witnessed")
    .map((item) => item.id),
  ...current.pairs.map((item) => item.obligation),
]);
const remaining = previous.obligations.filter((item) => !covered.has(item.id));
console.log(
  JSON.stringify(
    {
      covered: covered.size,
      remaining: remaining.length,
      cells: remaining.map((item) => item.id),
    },
    null,
    2,
  ),
);
