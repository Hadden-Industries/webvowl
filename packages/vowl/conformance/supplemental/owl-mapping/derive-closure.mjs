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
  readPinned,
  specificationRevision,
} from "./support.mjs";
await authorities();
const seedPin = {
  path: "supplemental/owl-mapping/seed-manifest.json",
  sha256: "042e6ed08f4ffeb8d7d4d45b33b267d09d1b008355e523334a37a96dfc2fd579",
};
const seed = JSON.parse(await readPinned(seedPin));
for (const reference of seed.producerSources) await readPinned(reference);
const { produce } = await import("../amended-policy/producer.mjs");
const { closureCases } = await import("./closure-cases.mjs");
const known = new Map(seed.vectors.map((vector) => [vector.id, vector]));
const vectors = [];
async function input(path, input) {
  const { sourceText, ...metadata } = input;
  return { ...metadata, bytes: await pin(path, sourceText) };
}
for (const fixture of closureCases()) {
  const directory = `closure/${fixture.id}`;
  const root = await input(`${directory}/root.input`, fixture.root);
  const imports = [];
  for (const [index, imported] of fixture.imports.entries())
    imports.push(await input(`${directory}/import-${index}.input`, imported));
  const vector = {
    id: fixture.id,
    root,
    imports,
    resolverContexts: fixture.resolverContexts ?? [],
    rules: fixture.rules,
    rationale: fixture.rationale,
    profile: profiles.structural,
    runs: fixture.runs,
  };
  if (fixture.expectedSource) {
    const result = await produce(fixture.expectedSource, profiles.structural);
    vector.expected = {};
    for (const [name, contents] of [
      ["source.json", json(fixture.expectedSource)],
      ["mapped.nq", result.mappedNQuads],
      ["canonical.nq", result.canonicalNQuads],
      ["ids.json", json(result.correspondence)],
      ["canonical.json", result.bytes],
    ])
      vector.expected[name] = await pin(`${directory}/${name}`, contents);
    vector.counts = {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    };
    if (fixture.sameBytesAs) {
      const counterpart = known.get(fixture.sameBytesAs);
      assert(counterpart, fixture.sameBytesAs);
      assert.deepEqual(
        result.bytes,
        await readPinned(counterpart.expected["canonical.json"]),
      );
      assert.equal(
        result.canonicalNQuads,
        (await readPinned(counterpart.expected["canonical.nq"])).toString(
          "utf8",
        ),
      );
      vector.sameBytesAs = fixture.sameBytesAs;
    }
  } else assert(fixture.runs.every((run) => run.outcome === "error"));
  vectors.push(vector);
  known.set(vector.id, vector);
}
assert.equal(vectors.length, 17);
const manifest = {
  format: seed.format,
  scope:
    "Independent closure, syntax, omission and rejection witnesses; not an exhaustive parser qualification.",
  specificationRevision,
  standards: [
    {
      id: "OWL",
      url: "https://www.w3.org/TR/2012/REC-owl2-syntax-20121211/",
      clauses: ["3.4", "5.6.2", "8.4", "9.5", "10.1"],
    },
  ],
  predecessor: seedPin,
  supersedesUnpublishedDraft: {
    manifest: {
      path: "supplemental/owl-mapping/closure-manifest.json",
      sha256:
        "8ff42dc51d5cd07f5984354f887d105386ddc8e8aa30708a45e980a671aa649d",
    },
    reason:
      "Removed one unused XSD import before review. The source recipe's behavior and every authored input/model/golden byte are unchanged. Original draft producer bytes are archived with exact identities; the active no-write runner and its source pins are versioned here.",
    historicalSources: await Promise.all(
      [
        "history/closure-cases.initial.mjs.txt",
        "history/derive-closure.initial.mjs.txt",
      ].map(localPin),
    ),
  },
  independentDependencies: dependencies,
  producerSources: await Promise.all(
    ["closure-cases.mjs", "derive-closure.mjs"].map(localPin),
  ),
  diagnosticPolicy: seed.diagnosticPolicy,
  vectors,
};
const previous = JSON.parse(
  await readPinned(manifest.supersedesUnpublishedDraft.manifest),
);
assert.deepEqual(
  vectors,
  previous.vectors,
  "No expected input/model/output/diagnostic changes in source cleanup",
);
const manifestPin = await pin("closure-v2-manifest.json", json(manifest));
console.log(
  JSON.stringify(
    {
      vectors: vectors.length,
      positives: vectors.filter((v) => v.expected).length,
      profileRuns: vectors.reduce((n, v) => n + v.runs.length, 0),
      manifest: manifestPin,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
