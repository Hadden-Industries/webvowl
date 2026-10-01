// SPDX-License-Identifier: AGPL-3.0-only
// Independent fixture IO. Default execution never writes or replaces a golden.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

export const here = dirname(fileURLToPath(import.meta.url));
export const bundle = resolve(here, "../..");
export const repository = resolve(bundle, "../../..");
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const profiles = {
  structural:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  strict:
    "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1",
  compatibility:
    "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/compatibility/v1",
};
export const specificationRevision = [
  [
    "docs/specs/2026-09-24-canonical-vowl-design.md",
    "174535bb8cb43f317631f0799721adebfbbc4ceff4d577595be8fb91dd940fac",
  ],
  [
    "docs/specs/2026-09-24-canonical-vowl-core-contract.md",
    "711ba30c291cfb0960334328203188600f60a331996e83379267a4a77b87988d",
  ],
  [
    "docs/specs/2026-09-24-canonical-vowl-projection-contract.md",
    "4c1cf6a7e187f98d40d390e6ff0b5354aca46a8ff195fba5b6badace7eb6078b",
  ],
  [
    "docs/specs/2026-09-24-canonical-vowl-design-decisions.md",
    "f314ec3448f2cf87f73ce6ce8871f3695d4b3b26dee687383b36e36a4fc0a43e",
  ],
  [
    "docs/specs/2026-09-30-canonical-vowl-resource-policy-amendment.md",
    "9f1b7d96229a06f57e29a52f92325a4256e6f826d7532e239848ef99dc0f47c1",
  ],
  [
    "docs/specs/2026-09-30-canonical-vowl-protocol-clarifications.md",
    "057bd8a3a15d5a574b753683917b871bd27bf239d9fd9ffad484550361cd84b4",
  ],
].map(([path, sha256]) => ({ base: "repository", path, sha256 }));
export const dependencies = [
  [
    "supplemental/amended-policy/producer.mjs",
    "da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321",
  ],
  [
    "supplemental/mapping-counterexamples/model.mjs",
    "3a4ebd134c1d209f84cf9c54072988a7e712f12286e95d35edec4d20f600bfc5",
  ],
].map(([path, sha256]) => ({ base: "conformance", path, sha256 }));

export async function readPinned(reference) {
  const root = reference.base === "repository" ? repository : bundle;
  const bytes = await readFile(resolve(root, reference.path));
  assert.equal(hash(bytes), reference.sha256, reference.path);
  if (reference.byteLength !== undefined)
    assert.equal(bytes.length, reference.byteLength);
  return bytes;
}
export async function authorities() {
  for (const reference of [...specificationRevision, ...dependencies])
    await readPinned(reference);
}
export async function pin(path, contents) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      !path.split("/").some((part) => !part || part === "." || part === ".."),
  );
  const target = resolve(here, path),
    bytes = Buffer.from(contents);
  if (process.argv.includes("--write-new")) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    await readFile(target),
    bytes,
    `${path}: immutable expected artifact differs`,
  );
  return {
    path: `supplemental/owl-mapping/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
export async function localPin(path) {
  const bytes = await readFile(resolve(here, path));
  return {
    path: `supplemental/owl-mapping/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
