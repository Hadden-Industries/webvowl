// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import { authorities, hash, json, readPinned } from "./support.mjs";

export const manifestPins = [
  {
    path: "supplemental/owl-mapping/seed-manifest.json",
    sha256: "042e6ed08f4ffeb8d7d4d45b33b267d09d1b008355e523334a37a96dfc2fd579",
  },
  {
    path: "supplemental/owl-mapping/closure-v2-manifest.json",
    sha256: "934d88e9feafc220bfac37f6019d1b285501510f66491bbf519ce694e8aceac9",
  },
  {
    path: "supplemental/owl-mapping/review-overlay-v1.json",
    sha256: "5d4b433145d9444656d801287b5329066197ac9c3c3ceca923627e9c17ce1a39",
  },
];
export async function loadCorpus() {
  await authorities();
  const [seed, closure, overlay] = await Promise.all(
    manifestPins.map(async (reference) =>
      JSON.parse(await readPinned(reference)),
    ),
  );
  for (const reference of [
    ...seed.producerSources,
    ...closure.producerSources,
    overlay.producer,
  ])
    await readPinned(reference);
  const historical = JSON.parse(
    await readPinned(closure.supersedesUnpublishedDraft.manifest),
  );
  assert.deepEqual(
    historical.vectors,
    closure.vectors,
    "Unpublished source cleanup changed no expectations",
  );
  for (const [
    index,
    archived,
  ] of closure.supersedesUnpublishedDraft.historicalSources.entries()) {
    await readPinned(archived);
    assert.equal(
      archived.sha256,
      historical.producerSources[index].sha256,
      "Archived original producer identity",
    );
  }
  const byId = new Map(
    [...seed.vectors, ...closure.vectors].map((vector) => [vector.id, vector]),
  );
  assert.equal(byId.size, 28);
  for (const replacement of overlay.vectors) {
    const original = byId.get(replacement.id);
    const record = overlay.replaces.find(({ id }) => id === replacement.id);
    assert.equal(hash(json(original)), record.recordSha256);
    assert.deepEqual(record.historicalRecord, original);
    assert.deepEqual(replacement.expected, original.expected);
    assert.deepEqual(replacement.root, original.root);
    byId.set(replacement.id, replacement);
  }
  const vectors = [...byId.values()];
  for (const vector of vectors) {
    for (const reference of [
      vector.root.bytes,
      ...vector.imports.map((entry) => entry.bytes),
      ...Object.values(vector.expected ?? {}),
    ])
      await readPinned(reference);
  }
  return {
    manifests: [seed, closure, overlay],
    vectors,
    runs: vectors.flatMap((vector) =>
      vector.runs.map((run) => ({ id: `${vector.id}/${run.id}`, vector, run })),
    ),
  };
}
