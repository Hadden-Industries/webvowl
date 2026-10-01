// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
export const here = dirname(fileURLToPath(import.meta.url));
export const bundle = resolve(here, "../..");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function pin(path, value) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      path.split("/").every((part) => part && part !== "." && part !== ".."),
  );
  const bytes = Buffer.from(value),
    target = resolve(here, path);
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
    `${path}: never overwrite an expectation`,
  );
  return {
    path: `supplemental/mapping-counterexamples/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
export async function sourcePins(paths) {
  return Promise.all(
    paths.map(async (path) => ({
      path: `supplemental/mapping-counterexamples/${path}`,
      sha256: hash(await readFile(resolve(here, path))),
    })),
  );
}
