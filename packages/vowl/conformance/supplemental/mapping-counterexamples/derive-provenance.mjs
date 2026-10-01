// SPDX-License-Identifier: AGPL-3.0-only
// Explicit seeds and recorded links bound this scope; no recursive discovery.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { bundle, here, hash, json, pin } from "./support.mjs";
const repository = resolve(bundle, "../../..");
const local = [
  "README.md",
  "support.mjs",
  "model.mjs",
  "core-pairs.mjs",
  "value-state-pairs.mjs",
  "derived-field-pairs.mjs",
  "branch-pairs.mjs",
  "derive-core.mjs",
  "derive-values-state.mjs",
  "derive-derived.mjs",
  "derive-branches.mjs",
  "derive-distinction.mjs",
  "derive-binding-correction.mjs",
  "derive-field-accounting.mjs",
  "template-audit.mjs",
  "audited-corpus.mjs",
  "audit-corpus-templates.mjs",
  "check-projection-fixtures.mjs",
  "inspect-core-pairs.mjs",
  "inspect-remaining.mjs",
  "analyze-pair-coverage.mjs",
  "verify.mjs",
  "source-pin-cleanup.mjs",
  "derive-provenance.mjs",
  "core-manifest.json",
  "value-state-manifest.json",
  "derived-manifest.json",
  "branch-manifest.json",
  "distinction-manifest.json",
  "binding-correction-manifest.json",
  "core-pair-inventory.json",
  "value-state-pair-inventory.json",
  "derived-pair-inventory.json",
  "branch-pair-inventory.json",
  "field-accounting.json",
  "template-audit-evidence.json",
  "source-pin-cleanup-v1.json",
];
const related = [
  "supplemental/accepted-protocol-v1/README.md",
  "supplemental/accepted-protocol-v1/derive.mjs",
  "supplemental/accepted-protocol-v1/derive-prefix.mjs",
  "supplemental/accepted-protocol-v1/camera-corrections-manifest.json",
  "supplemental/accepted-protocol-v1/resolution.json",
  "supplemental/accepted-protocol-v1/prefix-negative-manifest.json",
  "supplemental/accepted-protocol-v1/prefix-coverage-correction.json",
  "supplemental/editing-v1/derive.mjs",
  "supplemental/editing-v1/manifest.json",
];
const artifacts = new Map(),
  imported = new Set();
async function collect(
  path,
  expectedHash,
  expectedLength,
  base = path.startsWith("docs/") ? "repository" : "conformance",
) {
  const root = base === "repository" ? repository : bundle;
  const target = resolve(root, path),
    suffix = relative(root, target);
  assert(
    suffix && !suffix.startsWith("..") && !isAbsolute(suffix),
    `Outside scope ${path}`,
  );
  assert(
    !suffix.startsWith("packages/vowl/src") && !suffix.includes("__tests__"),
    "Oracle independence boundary",
  );
  const bytes = await readFile(target),
    sha256 = hash(bytes);
  if (expectedHash) assert.equal(sha256, expectedHash, `${base}/${path}`);
  if (expectedLength !== undefined)
    assert.equal(bytes.length, expectedLength, path);
  const key = `${base}/${path}`;
  if (artifacts.has(key)) assert.equal(artifacts.get(key).sha256, sha256, key);
  artifacts.set(key, { base, path, sha256, byteLength: bytes.length });
  if (path.endsWith(".mjs") && !imported.has(key)) {
    imported.add(key);
    for (const match of bytes
      .toString()
      .matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const child = resolve(dirname(target), match[1]),
        childPath = relative(bundle, child).replaceAll("\\", "/");
      assert(
        !childPath.startsWith(".."),
        "Independent script imports outside conformance scope",
      );
      await collect(childPath);
    }
  }
  return bytes;
}
async function links(value) {
  if (!value || typeof value !== "object") return;
  if (
    typeof value.path === "string" &&
    /^[0-9a-f]{64}$/.test(value.sha256 ?? "")
  )
    await collect(value.path, value.sha256, value.byteLength);
  for (const child of Object.values(value))
    if (child && typeof child === "object") await links(child);
}
const seeds = [
  ...local.map((path) => `supplemental/mapping-counterexamples/${path}`),
  ...related,
];
for (const path of seeds) {
  const bytes = await collect(path);
  if (path.endsWith(".json")) await links(JSON.parse(bytes));
}
// The historical predecessor is evidence at its preserved history path, not an
// instruction to replace current source with its obsolete source-artifact pin.
assert.equal(here, resolve(bundle, "supplemental/mapping-counterexamples"));
const records = [...artifacts.values()].sort((left, right) =>
  `${left.base}/${left.path}` < `${right.base}/${right.path}` ? -1 : 1,
);
await pin(
  "provenance-index.json",
  json({
    format: "canonical-vowl-additive-mapping-provenance/1",
    policy:
      "This bounded index covers explicit current supplement scripts/catalogs, their relative independent conformance imports, and exact recorded artifact/authority links. It does not enumerate the filesystem, rewrite historical indices, admit production helpers, or claim review from hashes. Its own hash is reported at handoff rather than self-embedded.",
    seeds,
    counts: {
      explicitArtifacts: records.length,
      repositoryAuthorities: records.filter(
        (item) => item.base === "repository",
      ).length,
      conformanceArtifacts: records.filter(
        (item) => item.base === "conformance",
      ).length,
    },
    artifacts: records,
  }),
);
console.log(
  JSON.stringify({
    explicitArtifacts: records.length,
    filesystemDiscovery: false,
  }),
);
