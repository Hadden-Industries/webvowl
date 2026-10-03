// SPDX-License-Identifier: AGPL-3.0-only
import { corePairs } from "./core-pairs.mjs";
const pairs = corePairs();
console.log(
  JSON.stringify({
    pairs: pairs.length,
    different: pairs.filter(
      (item) => JSON.stringify(item.before) !== JSON.stringify(item.after),
    ).length,
  }),
);
