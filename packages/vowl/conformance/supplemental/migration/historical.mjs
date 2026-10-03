// SPDX-License-Identifier: AGPL-3.0-only
// Historical code is used ONLY to author migration input, never expected output.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { commit, hash, repository } from "./support.mjs";

export const historicalPaths = [
  "src/owl2vowl/js/vowlBuilder.js",
  "src/app/js/controller/visualizationArtifactService.js",
  "src/app/js/controller/webVowlController.js",
  "src/app/js/controller/vowlDocumentArrangement.js",
  "src/app/js/controller/vowlDocument.js",
  "src/app/js/controller/vowlVisualizationSettings.js",
  "src/webvowl/js/parser.js",
  "src/webvowl/js/runtime/renderedGraphInternals.js",
  "src/shared/js/modules/nodeDegreeFilter.js",
  "src/shared/js/modules/subclassFilter.js",
  "src/shared/js/util/languageTools.js",
  "src/webvowl/js/elements/BaseElement.js",
  "package.json",
];

export function git(...args) {
  const result = spawnSync("git", args, {
    cwd: repository,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
}
export const blob = (path) => git("show", `${commit}:${path}`);
export function describeBlob(path) {
  const bytes = blob(path);
  return {
    commit,
    path,
    gitBlob: git("rev-parse", `${commit}:${path}`).toString().trim(),
    sha256: hash(bytes),
    byteLength: bytes.length,
  };
}

export async function historicalTools() {
  const builderPath = historicalPaths[0];
  const builderText = blob(builderPath).toString("utf8");
  const importText = 'from "owlapi/model";';
  assert.equal(builderText.split(importText).length, 2);
  // Resolve only the dependency specifier. Every builder statement is unchanged.
  const modelUrl = import.meta.resolve("owlapi/model");
  const executable = builderText.replace(
    importText,
    `from ${JSON.stringify(modelUrl)};`,
  );
  const { VOWLBuilder } = await import(
    `data:text/javascript;base64,${Buffer.from(executable).toString("base64")}`
  );
  const modelApi = await import("owlapi/model");
  const exporterPath = historicalPaths[1];
  const exporterText = blob(exporterPath).toString("utf8");
  const plainStart = exporterText.indexOf("function isPlainRecord(");
  const plainEnd = exporterText.indexOf("function assertExactFieldNames(");
  const serializeStart = exporterText.indexOf("function serializeVowlJson(");
  assert(plainStart > 0 && plainEnd > plainStart && serializeStart > plainEnd);
  const serializerText =
    exporterText.slice(plainStart, plainEnd) +
    exporterText.slice(serializeStart) +
    "\nexport { serializeVowlJson };\n";
  const { serializeVowlJson } = await import(
    `data:text/javascript;base64,${Buffer.from(serializerText).toString("base64")}`
  );
  const packageBytes = await readFile(new URL("../package.json", modelUrl));
  const packageInfo = JSON.parse(packageBytes);
  const modelBytes = await readFile(fileURLToPath(modelUrl));
  return {
    VOWLBuilder,
    ...modelApi,
    serializeVowlJson,
    evidence: {
      builder: describeBlob(builderPath),
      exporter: describeBlob(exporterPath),
      execution:
        "Exact pinned builder statements and exact pinned serializer/assertPlainRecord/isPlainRecord function text; the sole builder import specifier is resolved to the installed public owlapi/model API. No current application source is imported. This is builder plus serializer input generation, not a full historical controller/browser execution or old-dependency rebuild.",
      publicModelDependency: {
        packageName: packageInfo.name,
        version: packageInfo.version,
        packageJsonSha256: hash(packageBytes),
        modelEntrySha256: hash(modelBytes),
        limitation:
          "Installed public model constructors author ordinary ontology objects. This is not a claim to execute the historical caabb1197ffdab91c1e10d596d177b5142aea5c1 dependency or to pin its transitive graph.",
      },
      serializerRanges: [
        { startOffset: plainStart, endOffsetExclusive: plainEnd },
        {
          startOffset: serializeStart,
          endOffsetExclusive: exporterText.length,
        },
      ],
    },
  };
}
