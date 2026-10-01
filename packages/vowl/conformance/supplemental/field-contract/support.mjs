// SPDX-License-Identifier: AGPL-3.0-only
// Independent conformance file operations. No production imports or writes to old scopes.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const here = dirname(fileURLToPath(import.meta.url));
export const bundle = resolve(here, "../..");
export const repository = resolve(bundle, "../../..");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const profiles = {
  structural:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  artifact:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1",
};
export const priorManifests = [
  [
    "supplemental/amended-policy/manifest.json",
    "90f3754316f683a76ad9eecb8341d29a738b3f77b61c13362034de07cee92156",
  ],
  [
    "supplemental/conditional/manifest.json",
    "8ad1e7d52d040e27334e847f1366baff4cf9f16d36a5f960302d852e8fca87bb",
  ],
  [
    "supplemental/conditional/additional-manifest.json",
    "cc10d2372c9f28e4b8202ecfa74b4e49235fecd9d7c2ac89779dcfc8c7d0fe1e",
  ],
  [
    "supplemental/conditional/completion-manifest.json",
    "37c8d01cb3888e499cd647862ebdaf13ddfbd6baf57fd96032533575ed5d67da",
  ],
  [
    "supplemental/conditional/scope-manifest.json",
    "869ec2b79220eb31a4419f80aa4491f40fbfc7c6859252a2ff99567a17e9b478",
  ],
];
export async function readPinned(pin, root = bundle) {
  const bytes = await readFile(resolve(root, pin.path));
  assert.equal(hash(bytes), pin.sha256, pin.path);
  if (pin.byteLength !== undefined)
    assert.equal(bytes.length, pin.byteLength, pin.path);
  return bytes;
}
export async function baseline() {
  const vectors = [];
  let header;
  for (const [path, sha256] of priorManifests) {
    const manifest = JSON.parse(await readPinned({ path, sha256 }));
    header ??= manifest;
    for (const vector of manifest.vectors)
      vectors.push({
        ...vector,
        manifest: path,
        source: JSON.parse(await readPinned(vector.files["source.json"])),
      });
  }
  for (const pin of [...header.specificationRevision, header.amendment])
    await readPinned(pin, repository);
  await readPinned({
    path: "supplemental/amended-policy/producer.mjs",
    sha256: "da7936738c98cb853de7c6d6f2ae7528cbd4d47a0c1ccb1258dae7c5f7143321",
  });
  assert.equal(vectors.length, 177);
  return { vectors, header };
}
export async function pin(path, value) {
  assert(
    path &&
      !path.split("/").some((part) => !part || part === "." || part === "..") &&
      !/[\\:]/.test(path),
  );
  const bytes = Buffer.from(value);
  const target = resolve(here, path);
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
    `${path}: existing expectations are never overwritten`,
  );
  return {
    path: `supplemental/field-contract/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
export async function sourcePins(names) {
  return Promise.all(
    names.map(async (name) => ({
      path: `supplemental/field-contract/${name}`,
      sha256: hash(await readFile(resolve(here, name))),
    })),
  );
}
export function pointer(parts) {
  return (
    "/" +
    parts
      .map((part) => String(part).replaceAll("~", "~0").replaceAll("/", "~1"))
      .join("/")
  );
}
export function at(value, parts) {
  for (const part of parts) value = value[part];
  return value;
}
export function slug(value) {
  return value
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .toLowerCase();
}
