import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import canonicalize from "canonicalize";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This immutable provider source revision owns these data. Never edit the acquired copies.
export const PROVIDER_REVISION = "53cf178599e3bf1fd6f992e576231433488e0b28";
export const PROVIDER_BUNDLE =
  "0ae9ca9bdd2c3f115bbb50d28f8bf77522fc7282f61531b1d2dea53e4a2f1671";
const prefix = "validated-ontology-cache/contracts/";
const destination = fileURLToPath(
  new URL("../src/ontology-loading/contracts/", import.meta.url),
);
export function acquiredContractMembers(manifest) {
  return manifest.files.filter(
    ({ path: name }) =>
      name.endsWith(".schema.json") ||
      [
        "fixtures/identity-vectors.v1.json",
        "fixtures/protocol-cases.v1.json",
        "error-codes.v1.json",
      ].includes(name),
  );
}

/** Validate the complete delivery before changing any acquired file. */
export function readOntologyCacheContract(read) {
  const manifestBytes = read("contract-manifest.v1.json");
  const manifest = JSON.parse(manifestBytes);
  const { contractId, version, files } = manifest;
  if (
    manifest.bundleSha256 !== PROVIDER_BUNDLE ||
    createHash("sha256")
      .update(
        "hadden-ontology-cache/contract-bundle/v1\n" +
          canonicalize({ contractId, version, files }),
      )
      .digest("hex") !== PROVIDER_BUNDLE
  ) {
    throw new Error("The provider bundle identity changed.");
  }
  const delivery = new Map([["contract-manifest.v1.json", manifestBytes]]);
  for (const entry of acquiredContractMembers(manifest)) {
    if (
      path.posix.normalize(entry.path) !== entry.path ||
      path.win32.isAbsolute(entry.path) ||
      entry.path.startsWith("../") ||
      entry.path.includes("\\") ||
      delivery.has(entry.path)
    )
      throw new Error("Unsafe or duplicate provider member path");
    const bytes = read(entry.path);
    if (
      bytes.length !== entry.byteLength ||
      createHash("sha256").update(bytes).digest("hex") !== entry.sha256
    ) {
      throw new Error(`Provider manifest mismatch: ${entry.path}`);
    }
    delivery.set(entry.path, bytes);
  }
  return delivery;
}

export function acquireOntologyCacheContract(repository) {
  if (!repository)
    throw new Error(
      "Supply a provider Git repository containing the immutable source revision.",
    );
  const delivery = readOntologyCacheContract((name) =>
    execFileSync(
      "git",
      ["-C", repository, "show", `${PROVIDER_REVISION}:${prefix}${name}`],
      { maxBuffer: 8 * 1024 * 1024 },
    ),
  );
  for (const entry of existsSync(destination)
    ? readdirSync(destination, { recursive: true, withFileTypes: true })
    : []) {
    if (entry.isSymbolicLink())
      throw new Error("Acquired contract members cannot be symbolic links");
    if (
      entry.isFile() &&
      !delivery.has(
        path
          .relative(destination, path.join(entry.parentPath, entry.name))
          .replaceAll("\\", "/"),
      )
    )
      throw new Error(
        "Unexpected acquired member; reconcile the exact source set before acquisition",
      );
  }
  mkdirSync(destination, { recursive: true });
  for (const [name, bytes] of delivery) {
    const target = path.join(destination, name);
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
