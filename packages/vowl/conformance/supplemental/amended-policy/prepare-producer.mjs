// SPDX-License-Identifier: AGPL-3.0-only
// Owner-approved A8 budget amendment only; frozen pre-amendment oracle is retained.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const original = await readFile(
  resolve(here, "../../oracle/producer.mjs"),
  "utf8",
);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(
  sha256(original),
  "5097d9726c839afc7b4240dcb5527bd5089f5f847d788e9b32b6d3dd67699fd1",
);
const before = "maxDeepIterations: Math.min(records.size + auxiliary, 100000)";
const after =
  "maxDeepIterations: Math.min((records.size + auxiliary) ** 2, 100000)";
assert.equal(original.split(before).length - 1, 1);
const amended = original.replace(before, after),
  target = resolve(here, "producer.mjs");
if (process.argv.includes("--write-new")) {
  try {
    await writeFile(target, amended, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
assert.equal(
  await readFile(target, "utf8"),
  amended,
  "Exactly one budget-expression change; no profile mapping changes or overwrite",
);
console.log(
  JSON.stringify({
    frozenProducerSha256: sha256(original),
    amendedProducerSha256: sha256(amended),
    singleDelta: { before, after },
  }),
);
