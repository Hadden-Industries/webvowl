import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The published provider revision owns these data. Never edit the acquired copies.
export const PROVIDER_REVISION = "646e018dbe440735284990e08ca629e1d8bd2c43";
export const PROVIDER_BUNDLE =
  "871239081809f846d8c0b3ef12f0f0e82cdc3681958e7024c5c57fed87babd75";
const prefix = "validated-ontology-cache/contracts/";
const destination = fileURLToPath(
  new URL("../src/ontology-loading/contracts/", import.meta.url),
);
const repository = process.argv[2];
if (!repository) {
  throw new Error(
    "Supply a provider Git repository containing the immutable published revision.",
  );
}
const read = (name) =>
  execFileSync(
    "git",
    ["-C", repository, "show", `${PROVIDER_REVISION}:${prefix}${name}`],
    { maxBuffer: 8 * 1024 * 1024 },
  );
const manifestBytes = read("contract-manifest.v1.json");
const manifest = JSON.parse(manifestBytes);
if (manifest.bundleSha256 !== PROVIDER_BUNDLE) {
  throw new Error("The provider bundle identity changed.");
}
mkdirSync(destination, { recursive: true });
writeFileSync(
  path.join(destination, "contract-manifest.v1.json"),
  manifestBytes,
);
for (const entry of manifest.files.filter(
  ({ path: name }) =>
    name.endsWith(".schema.json") ||
    [
      "fixtures/identity-vectors.v1.json",
      "fixtures/protocol-cases.v1.json",
      "error-codes.v1.json",
    ].includes(name),
)) {
  const bytes = read(entry.path);
  if (
    bytes.length !== entry.byteLength ||
    createHash("sha256").update(bytes).digest("hex") !== entry.sha256
  ) {
    throw new Error(`Provider manifest mismatch: ${entry.path}`);
  }
  const target = path.join(destination, entry.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}
