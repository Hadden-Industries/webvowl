import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This immutable provider source revision owns these data. Never edit the acquired copies.
export const PROVIDER_REVISION = "d66f04e56fd2250282e60a74da6ab97f543e48fa";
export const PROVIDER_BUNDLE =
  "794a1f0679e1b1697f4f6c15e20e305d295c6e62bcb6536e9a7447ebb3517135";
const prefix = "validated-ontology-cache/contracts/";
const destination = fileURLToPath(
  new URL("../src/ontology-loading/contracts/", import.meta.url),
);
export function acquireOntologyCacheContract(repository) {
  if (!repository) {
    throw new Error(
      "Supply a provider Git repository containing the immutable source revision.",
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
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  acquireOntologyCacheContract(process.argv[2]);
}
