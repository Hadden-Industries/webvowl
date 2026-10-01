// SPDX-License-Identifier: AGPL-3.0-only
// Reuses only the frozen independent runner with explicit new corpus filenames.
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
    `import { completionSources as conditionalSources } from ${JSON.stringify(new URL("./completion-sources.mjs", import.meta.url).href)};`,
  ],
  [
    "const here = dirname(fileURLToPath(import.meta.url));",
    `const here = ${JSON.stringify(here)};`,
  ],
  [
    "`vectors/${fixture.id}/${filename}`",
    "`completion/${fixture.id}/${filename}`",
  ],
  [
    '"supplemental/conditional/derive.mjs",',
    '"supplemental/conditional/derive.mjs",\n  "supplemental/conditional/completion-sources.mjs",\n  "supplemental/conditional/derive-completion.mjs",',
  ],
  ['  "manifest.json",', '  "completion-manifest.json",'],
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
