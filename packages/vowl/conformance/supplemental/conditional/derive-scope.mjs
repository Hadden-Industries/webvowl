// SPDX-License-Identifier: AGPL-3.0-only
// Adapt only the separate independent runner to one additional scope fixture.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
let runner = await readFile(resolve(here, "derive.mjs"), "utf8");
const edits = [
  [
    'from "../amended-policy/producer.mjs"',
    `from ${JSON.stringify(new URL("../amended-policy/producer.mjs", import.meta.url).href)}`,
  ],
  [
    'import { conditionalSources } from "./sources.mjs";',
    `import { scopeSources as conditionalSources } from ${JSON.stringify(new URL("./scope-source.mjs", import.meta.url).href)};`,
  ],
  [
    "const here = dirname(fileURLToPath(import.meta.url));",
    `const here = ${JSON.stringify(here)};`,
  ],
  ["`vectors/${fixture.id}/${filename}`", "`scope/${fixture.id}/${filename}`"],
  [
    '"supplemental/conditional/derive.mjs",',
    '"supplemental/conditional/derive.mjs",\n  "supplemental/conditional/scope-source.mjs",\n  "supplemental/conditional/derive-scope.mjs",',
  ],
  ['  "manifest.json",', '  "scope-manifest.json",'],
];
for (const [before, after] of edits) {
  assert.equal(
    runner.split(before).length - 1,
    1,
    `Exactly one runner adaptation: ${before}`,
  );
  runner = runner.replace(before, after);
}
await import(
  "data:text/javascript;base64," + Buffer.from(runner).toString("base64")
);
