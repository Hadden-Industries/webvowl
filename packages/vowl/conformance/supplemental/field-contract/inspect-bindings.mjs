// SPDX-License-Identifier: AGPL-3.0-only
import process from "node:process";
import { obligations } from "./inventory.mjs";
import { candidates, positiveMatch, negativeWitness } from "./bindings.mjs";
const { records } = await candidates(process.argv.slice(2));
const missingPositive = [],
  missingNegative = [];
for (const cell of obligations()) {
  if (cell.mutation.startsWith("positive-")) {
    if (
      !(records.get(cell.descriptor) ?? []).some((witness) =>
        positiveMatch(cell, witness),
      )
    )
      missingPositive.push(cell.id);
  } else if (!negativeWitness(cell, records)) missingNegative.push(cell.id);
}
console.log(JSON.stringify({ missingPositive, missingNegative }));
