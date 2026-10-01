// SPDX-License-Identifier: AGPL-3.0-only
// Additive independent migration fixture IO; no writes without --write-new.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  authorities as coreAuthorities,
  dependencies,
  readPinned,
  specificationRevision,
} from "../owl-mapping/support.mjs";

export { dependencies, readPinned, specificationRevision };
export const here = dirname(fileURLToPath(import.meta.url));
export const repository = resolve(here, "../../../../..");
export const commit = "354ed3af8c1e82019f6280b2594acaceac96cca0";
export const dialect = `webvowl-legacy-${commit}`;
export const profiles = {
  structural:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/structural-content/v1",
  artifact:
    "https://haddenindustries.com/ontology/profiles/vowl/canonical/artifact/v1",
};
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
export const migrationAuthorities = [
  {
    base: "repository",
    path: "docs/plans/2026-09-24-canonical-vowl-implementation-plan.md",
    sha256: "15caf9bb9d87051a66a599e7c0d63649a8f775fb8ea4e72c02f7b6c1d6bfd740",
  },
  {
    base: "repository",
    path: "docs/reviews/canonical-vowl-legacy-dialect-inventory.md",
    sha256: "9945b689cbc8c5078d169d8797dfdfa1958f5fc3825d6675a6cf8b91c1be5b33",
  },
  {
    base: "repository",
    path: "docs/reviews/canonical-vowl-legacy-ingress-contract.md",
    sha256: "4c86970e1360b6e5702da323876dae286f85590c5e582fba31a747080b899306",
  },
];
export async function authorities() {
  await coreAuthorities();
  for (const reference of migrationAuthorities) await readPinned(reference);
}
export async function localPin(path) {
  const bytes = await readFile(resolve(here, path));
  return {
    path: `supplemental/migration/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
export async function pin(path, contents) {
  assert(
    path &&
      !/[\\:]/.test(path) &&
      !path.split("/").some((part) => !part || part === "." || part === ".."),
  );
  const target = resolve(here, path);
  const bytes = Buffer.from(contents);
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
    `${path}: frozen bytes differ`,
  );
  return {
    path: `supplemental/migration/${path}`,
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}
