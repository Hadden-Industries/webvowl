// SPDX-License-Identifier: AGPL-3.0-only
// New, explicit field-contract scope. Never regenerate a historical index.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  baseline,
  bundle,
  hash,
  json,
  pin,
  priorManifests,
  readPinned,
  repository,
} from "./support.mjs";
const { header } = await baseline();
const root = "supplemental/field-contract/";
const scripts = [
  "README.md",
  "support.mjs",
  "contracts.mjs",
  "inventory.mjs",
  "describe.mjs",
  "positives.mjs",
  "bindings.mjs",
  "inspect-bindings.mjs",
  "derive-early.mjs",
  "derive-positives.mjs",
  "derive-additional-positives.mjs",
  "derive-negatives.mjs",
  "derive-semantic.mjs",
  "derive-state-identity.mjs",
  "derive-semantic-overlaps.mjs",
  "derive-mapping-inventory.mjs",
  "derive-provenance.mjs",
  "verify.mjs",
];
const catalogs = [
  "contract-inventory.json",
  "coverage-inventory.json",
  "early-negative-manifest.json",
  "positive-manifest.json",
  "additional-positive-manifest.json",
  "negative-manifest.json",
  "semantic-inventory.json",
  "semantic-negative-manifest.json",
  "state-identity-manifest.json",
  "semantic-overlap-manifest.json",
  "mapping-injectivity-inventory.json",
];
const entries = new Map();
function* pins(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.path === "string" && typeof value.sha256 === "string")
    yield value;
  for (const item of Object.values(value)) yield* pins(item);
}
function base(path) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  return path.startsWith("docs/specs/") || path.startsWith("node_modules/")
    ? repository
    : bundle;
}
async function record(current) {
  const bytes = await readPinned(current, base(current.path));
  const entry = {
    path: current.path,
    sha256: current.sha256,
    byteLength: bytes.length,
  };
  if (entries.has(current.path))
    assert.deepEqual(entries.get(current.path), entry);
  entries.set(current.path, entry);
}
for (const name of [...scripts, ...catalogs]) {
  const path = root + name;
  const bytes = await readFile(resolve(bundle, path));
  await record({ path, sha256: hash(bytes) });
  if (catalogs.includes(name))
    for (const current of pins(JSON.parse(bytes))) await record(current);
}
await record({
  path: "storage.mjs",
  sha256: hash(await readFile(resolve(bundle, "storage.mjs"))),
});
for (const current of [...header.specificationRevision, header.amendment])
  await record(current);
for (const [path, sha256] of priorManifests) await record({ path, sha256 });
const frozenScopes = [
  {
    path: "supplemental/provenance-index.json",
    sha256: "8079159ae4fb579a000b109349120320e00781c5c03fa1bfa6eab75c6e394fa7",
  },
  {
    path: "supplemental/conditional/provenance.json",
    sha256: "627672609828c58b6a5b2bdc3674cf243bde4fea062fb1b9ffe84f04a57e89f8",
  },
  {
    path: "supplemental/review-resolution-v1/review-resolution.json",
    sha256: "b969622b933fef82d4521ec407309e1c255b3790258cd4074dd96ef9fefd80aa",
  },
  {
    path: "supplemental/review-resolution-v1/verify-frozen-scopes.mjs",
    sha256: "266147fc7f99e16227b295bf22899eb4d9db5c9a7253467b4f8360218a8346aa",
  },
];
for (const current of frozenScopes) await record(current);
const artifacts = [...entries.values()].sort((a, b) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
);
await pin(
  "provenance-index.json",
  json({
    format: "canonical-vowl-field-contract-provenance/1",
    status: "independent-additive-field-scope-pending-final-review",
    policy:
      "Explicit source/catalog list and their recorded pins only. No filesystem traversal; no writes outside this new scope; prior indexes and expected bytes remain frozen. This index itself is identified by the integration handoff hash, avoiding a self-referential digest.",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    frozenScopes,
    counts: {
      artifacts: artifacts.length,
      newScopeFiles: artifacts.filter((item) => item.path.startsWith(root))
        .length,
      priorWitnessesOrAuthorities: artifacts.filter(
        (item) => !item.path.startsWith(root),
      ).length,
    },
    artifacts,
  }),
);
console.log(
  JSON.stringify({
    artifacts: artifacts.length,
    newScopeFiles: artifacts.filter((item) => item.path.startsWith(root))
      .length,
    result: "explicit scope provenance reproduced",
  }),
);
