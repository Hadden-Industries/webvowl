// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { bundle, hash, json, pin, prefix } from "./support.mjs";
const repository = resolve(bundle, "../../..");
const seeds = [
  ...[
    "README.md",
    "support.mjs",
    "template-audit.mjs",
    "derive.mjs",
    "derive-provenance.mjs",
    "verify.mjs",
    "template-audit-evidence.json",
    "controls-manifest.json",
  ].map((name) => `${prefix}${name}`),
  "supplemental/accepted-protocol-v2/README.md",
  "supplemental/accepted-protocol-v2/derive.mjs",
  "supplemental/accepted-protocol-v2/camera-corrections-manifest.json",
];
const artifacts = new Map(),
  imported = new Set();
async function collect(path, expected, length) {
  const base = path.startsWith("docs/") ? "repository" : "conformance",
    root = base === "repository" ? repository : bundle,
    target = resolve(root, path),
    suffix = relative(root, target);
  assert(suffix && !suffix.startsWith("..") && !isAbsolute(suffix));
  const bytes = await readFile(target),
    sha256 = hash(bytes),
    key = `${base}/${path}`;
  if (expected) assert.equal(sha256, expected, key);
  if (length !== undefined) assert.equal(bytes.length, length, key);
  artifacts.set(key, { base, path, sha256, byteLength: bytes.length });
  if (path.endsWith(".mjs") && !imported.has(key)) {
    imported.add(key);
    for (const match of bytes
      .toString()
      .matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const childPath = relative(
        bundle,
        resolve(dirname(target), match[1]),
      ).replaceAll("\\", "/");
      assert(
        !childPath.startsWith(".."),
        "Independent auditor cannot import outside conformance",
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
await collect(
  "docs/specs/2026-09-24-canonical-vowl-core-contract.md",
  "711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d",
);
for (const path of seeds) {
  const bytes = await collect(path);
  if (path.endsWith(".json")) await links(JSON.parse(bytes));
}
const entries = [...artifacts.values()].sort((left, right) =>
  `${left.base}/${left.path}` < `${right.base}/${right.path}` ? -1 : 1,
);
await pin(
  "provenance-index.json",
  json({
    format: "canonical-vowl-additive-auditor-repair-provenance/2",
    policy:
      "Explicit new seeds, relative conformance-only imports and recorded file identities; no filesystem discovery and no mutation of historical indices. All historical files are immutable inputs. This index's hash is handed off separately.",
    seeds,
    artifacts: entries,
  }),
);
console.log(
  JSON.stringify({
    explicitArtifactPins: entries.length,
    filesystemDiscovery: false,
  }),
);
