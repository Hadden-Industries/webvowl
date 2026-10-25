// SPDX-License-Identifier: AGPL-3.0-only
/** WebVOWL owns corpus storage and generated-output obligations; the installed
 * public engine owns JSON analysis, CLI handling and guarded source repair.
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  openJsonRepositorySession,
  runJsonQualityCli,
} from "../tooling/json/public-api.mjs";
import { capturedCorpusJson } from "../packages/vowl/scripts/captured-corpus-json.mjs";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const requiredGeneratedOutputs = [
  "deploy/data/*.json",
  "deploy/.vite/webvowl-generated-js.json",
];

const logicalProviders = () => [
  {
    definition: {
      id: "canonical-vowl-corpus",
      minimumDocuments: 5851,
      containerPaths: [
        "packages/vowl/conformance/storage-inventory.json",
        "packages/vowl/conformance/bundles/*.json",
      ],
    },
    inventory: capturedCorpusJson,
  },
];

/** Fixed repository operation with additive corpus and fresh-output obligations. */
export function openRepositoryJsonSession({
  requireGenerated = false,
  ...options
} = {}) {
  return openJsonRepositorySession({
    ...options,
    root: repositoryRoot,
    logicalProviders: logicalProviders(),
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
    logicalProviders: logicalProviders(),
    requiredOutputs: requireGenerated ? requiredGeneratedOutputs : [],
  }));
}
