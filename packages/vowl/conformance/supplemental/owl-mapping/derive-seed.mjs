// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import process from "node:process";
import {
  authorities,
  dependencies,
  json,
  localPin,
  pin,
  profiles,
  specificationRevision,
} from "./support.mjs";
await authorities();
const { produce } = await import("../amended-policy/producer.mjs");
const { seedCases } = await import("./seed-cases.mjs");
const vectors = [];
for (const fixture of seedCases()) {
  const { sourceText, ...rootOptions } = fixture.root;
  const root = {
    ...rootOptions,
    bytes: await pin(
      `seed/${fixture.id}/input.${rootOptions.mediaType === "text/turtle" ? "ttl" : "ofn"}`,
      sourceText,
    ),
  };
  const expected = await produce(fixture.expectedSource, profiles.structural);
  const files = {};
  for (const [name, bytes] of [
    ["source.json", json(fixture.expectedSource)],
    ["mapped.nq", expected.mappedNQuads],
    ["canonical.nq", expected.canonicalNQuads],
    ["ids.json", json(expected.correspondence)],
    ["canonical.json", expected.bytes],
  ])
    files[name] = await pin(`seed/${fixture.id}/${name}`, bytes);
  vectors.push({
    id: fixture.id,
    root,
    imports: [],
    rules: fixture.rules,
    rationale: fixture.rationale,
    profile: profiles.structural,
    expected: files,
    counts: {
      primary: expected.correspondence.length,
      blankNodes: expected.blankNodeCount,
      quads: expected.quadCount,
    },
    runs: fixture.runs,
  });
}
assert.equal(vectors.length, 11);
const manifest = {
  format: "independent-canonical-vowl-owl-mapping-corpus-v1",
  scope:
    "Seed witnesses only; hand-authored OWL-to-retained-model decisions, not an independent OWL parser or a complete adapter validator.",
  specificationRevision,
  standards: [
    {
      id: "OWL",
      url: "https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/",
      clauses: ["3.7", "5.8", "9.6", "10.1", "11.2"],
    },
  ],
  independentDependencies: dependencies,
  producerSources: await Promise.all(
    ["support.mjs", "seed-cases.mjs", "derive-seed.mjs"].map(localPin),
  ),
  diagnosticPolicy: {
    shape: "A9.2 closed immutable warning records",
    matching:
      "All actual diagnostic codes must be in the expected code set; every expected condition must match at least one actual diagnostic. Exact implementation prose and unprescribed warning cardinality are not frozen.",
    sourceConstructor:
      "Match the exact ASCII constructor identifier as a standalone token in details; not a substring of a different constructor.",
    restrictionIdentifier:
      "Match the owning public stable restriction identifier as a standalone token in details.",
    ordering:
      "RFC8785 UTF-8 bytes of each complete actual record, strictly increasing (deduplication).",
  },
  vectors,
};
const receipt = await pin("seed-manifest.json", json(manifest));
console.log(
  JSON.stringify(
    {
      vectors: vectors.length,
      profileRuns: vectors.reduce((n, vector) => n + vector.runs.length, 0),
      manifest: receipt,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
