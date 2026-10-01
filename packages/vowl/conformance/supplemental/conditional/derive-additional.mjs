// SPDX-License-Identifier: AGPL-3.0-only
// Reuse only the independent conditional runner, with explicit new output names.
// This does not import/read production code or change the frozen 62-case runner.
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
    `import { additionalSources as conditionalSources } from ${JSON.stringify(new URL("./additional-sources.mjs", import.meta.url).href)};`,
  ],
  [
    "const here = dirname(fileURLToPath(import.meta.url));",
    `const here = ${JSON.stringify(here)};`,
  ],
  [
    "`vectors/${fixture.id}/${filename}`",
    "`additional/${fixture.id}/${filename}`",
  ],
  [
    '"supplemental/conditional/derive.mjs",',
    '"supplemental/conditional/derive.mjs",\n  "supplemental/conditional/additional-sources.mjs",\n  "supplemental/conditional/derive-additional.mjs",',
  ],
  ['  "manifest.json",', '  "additional-manifest.json",'],
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
