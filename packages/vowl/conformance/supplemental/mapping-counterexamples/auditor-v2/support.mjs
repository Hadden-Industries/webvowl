// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { fixtureBundle, readCorpusArtifact } from "../../../storage.mjs";
export const here = dirname(fileURLToPath(import.meta.url));
export const bundle = resolve(here, "../../..");
export const prefix = "supplemental/mapping-counterexamples/auditor-v2/";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export async function readPinned(entry) {
  const bytes = readCorpusArtifact(entry.path);
  assert.equal(hash(bytes), entry.sha256, entry.path);
  if (entry.byteLength !== undefined)
    assert.equal(bytes.length, entry.byteLength, entry.path);
  return bytes;
}
export async function pin(path, contents) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  const target = resolve(here, path),
    bytes = Buffer.from(contents);
  const member = `${prefix}${path}`;
  if (process.argv.includes("--write-new") && fixtureBundle(member) === null) {
    await mkdir(dirname(target), { recursive: true });
    try {
      await writeFile(target, bytes, { flag: "wx" });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  assert.deepEqual(
    readCorpusArtifact(member),
    bytes,
    `${path}: frozen expectations may not be replaced`,
  );
  return {
    path: `${prefix}${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
export async function filePin(path) {
  const bytes = readCorpusArtifact(path);
  return { path, sha256: hash(bytes), byteLength: bytes.length };
}
