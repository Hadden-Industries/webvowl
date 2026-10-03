// SPDX-License-Identifier: AGPL-3.0-only
// One explicit frozen scope, not a recursive scan of later supplements.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import { loadCorpus, manifestPins } from "./catalog.mjs";
import {
  hash,
  json,
  localPin,
  pin,
  readPinned,
  repository,
} from "./support.mjs";

const corpus = await loadCorpus();
const artifacts = new Map();
function collect(value) {
  if (!value || typeof value !== "object") return;
  if (typeof value.path === "string" && typeof value.sha256 === "string") {
    const key = `${value.base ?? "conformance"}:${value.path}`;
    const prior = artifacts.get(key);
    if (prior)
      assert.equal(prior.sha256, value.sha256, `Conflicting scope pin ${key}`);
    else artifacts.set(key, value);
    return;
  }
  for (const child of Object.values(value)) collect(child);
}
collect(manifestPins);
collect(corpus.manifests);
for (const path of [
  "support.mjs",
  "seed-cases.mjs",
  "derive-seed.mjs",
  "closure-cases.mjs",
  "derive-closure.mjs",
  "derive-review-overlay.mjs",
  "assert-adapter.mjs",
  "catalog.mjs",
  "check-assertions.mjs",
  "derive-open.mjs",
  "derive-provenance.mjs",
  "README.md",
  "assertion-controls.json",
  "open-cases.json",
])
  collect(await localPin(path));
for (const path of ["assertion-controls.json", "open-cases.json"])
  collect(
    JSON.parse(
      await readFile(
        resolve(
          repository,
          "packages/vowl/conformance/supplemental/owl-mapping",
          path,
        ),
      ),
    ),
  );
const require = createRequire(import.meta.url);
const libraries = [];
for (const [name, version] of [
  ["canonicalize", "5.1.0"],
  ["rdf-canonize", "5.0.0"],
]) {
  const entry = require.resolve(name);
  let metadataPath = resolve(dirname(entry), "package.json"),
    metadata;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      metadata = JSON.parse(await readFile(metadataPath));
      if (metadata.name === name) break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    metadataPath = resolve(dirname(metadataPath), "../package.json");
  }
  assert(metadata, `${name}: installed metadata not located`);
  assert.equal(metadata.name, name);
  assert.equal(metadata.version, version);
  const pins = [];
  for (const absolute of [metadataPath, entry]) {
    const path = relative(repository, absolute).replaceAll("\\", "/");
    assert(!path.startsWith("../"));
    const bytes = await readFile(absolute);
    const reference = {
      base: "repository",
      path,
      sha256: hash(bytes),
      byteLength: bytes.length,
    };
    collect(reference);
    pins.push(reference);
  }
  libraries.push({
    name,
    version,
    pins,
    scope:
      "Installed package metadata and direct entry point; not an assertion that every transitive library source file is inventoried here.",
  });
}
for (const reference of artifacts.values()) await readPinned(reference);
const runs = corpus.runs;
const receipt = await pin(
  "provenance-index.json",
  json({
    format: "independent-canonical-vowl-owl-mapping-explicit-scope-v1",
    scope:
      "Additive SLICE-003 seeds. No historical core corpus/index changes; no product output used to derive expected mappings.",
    activeManifests: manifestPins,
    libraries,
    counts: {
      authoredInputs: corpus.vectors.length,
      fullExpectedModels: corpus.vectors.filter((vector) => vector.expected)
        .length,
      profileRuns: runs.length,
      successRuns: runs.filter(({ run }) => run.outcome === "success").length,
      errorRuns: runs.filter(({ run }) => run.outcome === "error").length,
      openStableCodeCases: 2,
      syntheticCheckerChecks: 67,
      rejectedCheckerMutants: 10,
    },
    artifacts: [...artifacts.values()].sort((a, b) =>
      `${a.base ?? "conformance"}:${a.path}` <
      `${b.base ?? "conformance"}:${b.path}`
        ? -1
        : 1,
    ),
  }),
);
console.log(
  JSON.stringify(
    {
      scope: receipt,
      artifacts: artifacts.size,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
