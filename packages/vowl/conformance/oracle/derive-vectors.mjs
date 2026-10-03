// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { produce, profiles } from "./producer.mjs";
import { seedSources } from "./seed-sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = resolve(here, "..");
const repository = resolve(bundle, "../../..");
const writeNew = process.argv.includes("--write-new");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const specNames = [
  "design",
  "core-contract",
  "projection-contract",
  "design-decisions",
];
const specifications = [];
for (const name of specNames) {
  const path = `docs/specs/2026-09-24-canonical-vowl-${name}.md`;
  specifications.push({
    path,
    sha256: sha256(await readFile(resolve(repository, path))),
  });
}
const generated = [];
for (const vector of seedSources) {
  const result = await produce(vector.source, vector.profile);
  const counts = {
    primary: result.correspondence.length,
    blankNodes: result.blankNodeCount,
    quads: result.quadCount,
  };
  assert.deepEqual(
    counts,
    vector.expectedCounts,
    `${vector.id}: hand-counted A6 node/triple totals`,
  );
  const outputs = new Map([
    ["source.json", json(vector.source)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ]);
  const files = {};
  for (const [name, value] of outputs) {
    const relative = `vectors/${vector.id}/${name}`;
    const target = resolve(bundle, relative);
    const bytes = Buffer.from(value);
    if (writeNew) {
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
      `${relative}: expected file must not be silently replaced`,
    );
    files[name] = {
      path: relative,
      sha256: sha256(bytes),
      byteLength: bytes.length,
    };
  }
  generated.push({
    id: vector.id,
    profile: vector.profile,
    rules: vector.rules,
    status: "independently-derived-pending-review",
    coverageLimits: [
      "D18.2 empty/singleton categories only; no numeric-rank or multi-member set-order discrimination",
      "Text/Decimal templates are covered by the extended corpus, not these seeds",
    ],
    counts,
    files,
  });
}
const manifest = {
  format: "canonical-vowl-conformance-manifest/1",
  status: "experimental-seed-corpus-pending-independent-review",
  specificationRevision: specifications,
  profiles,
  algorithms: { graph: "RDFC-1.0", internalDigest: "sha256", json: "RFC 8785" },
  oracle: {
    name: "specification-derived-conformance-producer",
    version: "0.2.0",
    source: "oracle/producer.mjs",
    sourceSha256: sha256(await readFile(resolve(here, "producer.mjs"))),
    sourceArtifacts: await Promise.all(
      [
        "producer.mjs",
        "seed-sources.mjs",
        "derive-vectors.mjs",
        "check-producer.mjs",
      ].map(async (name) => ({
        path: "oracle/" + name,
        sha256: sha256(await readFile(resolve(here, name))),
      })),
    ),
    dependencies: { "rdf-canonize": "5.0.0", canonicalize: "5.1.0" },
    derivationHistory: [
      {
        canonicalize: "2.1.0",
        sourceSha256:
          "81bab1df05a49d5731a9dc3e3f5dbf69142d978d0742ae068f878f00be711456",
        manifestSha256:
          "2cfb61347e9505840b515145f456dfde3e6fd464c74f4b24158a04a31452454f",
        result:
          "Initial derivation; producer subsequently received repository Prettier formatting only, and every vector file byte reproduced unchanged with canonicalize 5.1.0",
      },
      {
        canonicalize: "5.1.0",
        sourceSha256:
          "0e3f988211f5e80b817d8867e6f026ebfeda38f98c88791b7913556f6f8851d3",
        manifestSha256:
          "fd76f91f855e2ee0107c9d43dab77213fa3332a40e19eb325d42e6cc7125cb2f",
        result:
          "Claude read-only seed review confirmed expected bytes/counts; F1-F8 led to narrower coverage claims, complete source-file pins, and oracle guards. All frozen vector files reproduce unchanged. Revised producer review is pending.",
      },
    ],
    independence:
      "No production mapping, normalization, projection, ID code, or tests read or imported. Hand-derived normalized sources and occurrences; separate A6 mapper/category issuer. Shared standards libraries only.",
    limitations: [
      "Not a complete validator or OWL/legacy adapter",
      "Guards do not establish complete RFC3987/RFC5646 validation, role-target typing, semantic normal form, projection, or artifact-state invariants; reviewed normalized inputs remain required",
      "Seed byte/count review completed; revised oracle and extended fixture review pending",
      "Production comparison and cross-runtime matrix pending",
    ],
  },
  vectors: generated,
};
const manifestPath = resolve(bundle, "manifest.json");
if (writeNew) {
  try {
    await writeFile(manifestPath, json(manifest), { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
}
if (process.argv.includes("--update-provenance")) {
  const previous = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.deepEqual(
    previous.vectors.map(({ id, counts, files }) => ({ id, counts, files })),
    manifest.vectors.map(({ id, counts, files }) => ({ id, counts, files })),
    "Provenance update must preserve every frozen file and count",
  );
  await writeFile(manifestPath, json(manifest));
}
assert.deepEqual(
  JSON.parse(await readFile(manifestPath, "utf8")),
  manifest,
  "Manifest differs: explicit review is required before changing pinned expectations",
);
console.log(
  JSON.stringify({
    vectors: generated.length,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    result: "all independently produced files match pinned expectations",
  }),
);
