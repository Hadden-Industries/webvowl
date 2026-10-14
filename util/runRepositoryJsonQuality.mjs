// SPDX-License-Identifier: AGPL-3.0-only
/** WebVOWL owns corpus storage and generated-output obligations; the installed
 * public engine owns JSON analysis, CLI handling and guarded source repair.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  runJsonQuality,
  runJsonQualityCli,
} from "../tooling/json/public-api.mjs";
import { createCorpusReader } from "../packages/vowl/conformance/storage.mjs";
import { verifyCorpusStorage } from "../packages/vowl/scripts/verify-corpus-storage.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const corpusRoot = new URL("../packages/vowl/conformance/", import.meta.url);
const corpusPrefix = "packages/vowl/conformance/";
const requiredGeneratedOutputs = [
  "deploy/data/*.json",
  "deploy/.vite/webvowl-generated-js.json",
];

/** Invoke the native storage authority before exposing its independently pinned
 * JSON members. No candidate diagnostics or bytes create acceptance identities.
 */
export function readRepositoryLogicalJson() {
  verifyCorpusStorage();
  const inventory = JSON.parse(
    readFileSync(new URL("storage-inventory.json", corpusRoot)),
  );
  const read = createCorpusReader(corpusRoot);
  const bundles = new Map();
  const logicalInventory = [],
    logicalDocuments = [];
  // The native corpus format declares its JSON artifacts with .json member names;
  // its other members are N-Quads. Physical JSONL has ordinary repository discovery.
  for (const entry of inventory.artifacts.filter((member) =>
    member.path.endsWith(".json"),
  )) {
    if (!bundles.has(entry.bundle))
      bundles.set(
        entry.bundle,
        JSON.parse(readFileSync(new URL(entry.bundle, corpusRoot))),
      );
    const bundle = bundles.get(entry.bundle);
    const index = bundle.artifacts.findIndex(
      (member) => member.path === entry.path,
    );
    if (index < 0)
      throw new Error(`Missing verified corpus member: ${entry.path}`);
    const path = corpusPrefix + entry.path;
    logicalInventory.push({
      path,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
      containerPath: corpusPrefix + entry.bundle,
      pointer: `/artifacts/${index}/text`,
      encoding: bundle.artifacts[index].encoding,
    });
    logicalDocuments.push({ path, bytes: read(entry.path) });
  }
  return { logicalInventory, logicalDocuments };
}

/** Fixed repository operation with additive corpus and fresh-output obligations. */
export async function runRepositoryJsonQuality(
  operation,
  { requireGenerated = false, ...options } = {},
) {
  return runJsonQuality(operation, {
    ...options,
    root: repositoryRoot,
    ...readRepositoryLogicalJson(),
    requiredOutputs: requireGenerated ? requiredGeneratedOutputs : [],
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  let requireGenerated = false;
  let sourceArguments = false;
  const args = process.argv.slice(2).filter((argument) => {
    if (argument === "--") sourceArguments = true;
    if (!sourceArguments && argument === "--require-generated") {
      requireGenerated = true;
      return false;
    }
    return true;
  });
  process.exitCode = await runJsonQualityCli(args, () => ({
    root: repositoryRoot,
    ...readRepositoryLogicalJson(),
    requiredOutputs: requireGenerated ? requiredGeneratedOutputs : [],
  }));
}
