// SPDX-License-Identifier: AGPL-3.0-only
// Verify the approved pre-handoff cleanup; default execution never edits it.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { here, hash, json, pin } from "./support.mjs";
const oldScript = await readFile(
  resolve(here, "history/derive-field-accounting.initial.mjs.txt"),
);
const oldInventory = await readFile(
  resolve(here, "history/field-accounting.initial.json"),
);
const script = await readFile(resolve(here, "derive-field-accounting.mjs"));
const inventory = await readFile(resolve(here, "field-accounting.json"));
assert.equal(
  hash(oldScript),
  "bdd520a2aa3617ad111d0978aa5f4b7da6e8ce8db4e39493dd4550d0cfc4da78",
);
assert.equal(
  hash(oldInventory),
  "f25a0f6772d8b826782bf805edba5224a0019fafd6396c0f6789f05c38494551",
);
assert.equal(
  script.toString(),
  oldScript
    .toString()
    .replace(
      "import { bundle, here, hash, json, pin, sourcePins }",
      "import { bundle, hash, json, pin, sourcePins }",
    ),
);
assert.equal(
  inventory.toString(),
  oldInventory.toString().replace(hash(oldScript), hash(script)),
);
const describe = (path, value) => ({
  path: `supplemental/mapping-counterexamples/${path}`,
  sha256: hash(value),
  byteLength: value.length,
});
await pin(
  "source-pin-cleanup-v1.json",
  json({
    format: "canonical-vowl-pre-handoff-source-pin-correction/1",
    authority:
      "Parent integration agent explicitly approved this scoped routine repair on 2026-09-30 before review handoff, preserving prior identities and all historical corpora and golden bytes.",
    change:
      "Remove one unused named import (here) from the newly authored field-accounting runner; update only its source-artifact hash in the newly generated field accounting. Fixture sources, canonical RDF, canonical JSON, ID associations, producer semantics and all coverage evidence remain byte-identical.",
    previous: {
      script: describe(
        "history/derive-field-accounting.initial.mjs.txt",
        oldScript,
      ),
      inventory: describe(
        "history/field-accounting.initial.json",
        oldInventory,
      ),
    },
    current: {
      script: describe("derive-field-accounting.mjs", script),
      inventory: describe("field-accounting.json", inventory),
    },
    verifiedOnlyDeclaredTextChanges: true,
  }),
);
console.log(JSON.stringify({ cleanupVerified: true, goldenChanges: 0 }));
