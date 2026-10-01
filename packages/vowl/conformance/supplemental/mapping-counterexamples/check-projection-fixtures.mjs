// SPDX-License-Identifier: AGPL-3.0-only
// Compare the new bounded recipe helper only with prior independent fixtures.
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { candidates } from "../field-contract/bindings.mjs";
import { readPinned } from "../field-contract/support.mjs";
import { projectFixture } from "./model.mjs";
const { vectors } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
  "supplemental/field-contract/state-identity-manifest.json",
]);
function stable(value) {
  if (Array.isArray(value))
    return value
      .map(stable)
      .sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  return value;
}
function keys(occurrences) {
  const byId = new Map(occurrences.map((item) => [item.id, item]));
  const result = new Map();
  function key(id) {
    if (!result.has(id)) {
      const { id: ignored, ...record } = byId.get(id);
      void ignored;
      for (const field of ["from", "to", "edge"])
        if (record[field]) record[field] = key(record[field]);
      if (record.ends) record.ends = record.ends.map(key);
      result.set(id, JSON.stringify(stable(record)));
    }
    return result.get(id);
  }
  for (const item of occurrences) key(item.id);
  return result;
}
const failures = [];
for (const vector of vectors) {
  try {
    const source = structuredClone(vector.source);
    const previous = keys(source.structural.occurrences);
    projectFixture(source);
    const current = keys(source.structural.occurrences);
    assert.deepEqual(
      [...previous.values()].sort(),
      [...current.values()].sort(),
    );
    if (source.visualization) {
      const byKey = new Map([...current].map(([id, key]) => [key, id]));
      for (const item of source.visualization.placements)
        item.occurrence = byKey.get(previous.get(item.occurrence));
      source.visualization.hidden = source.visualization.hidden.map((id) =>
        byKey.get(previous.get(id)),
      );
    }
    assert.deepEqual(
      (await produce(source, vector.profile)).bytes,
      await readPinned(vector.files["canonical.json"]),
    );
  } catch (error) {
    failures.push({ fixture: vector.id, reason: error.message.slice(0, 1200) });
  }
}
console.log(
  JSON.stringify(
    {
      previousIndependentFixtures: vectors.length,
      matched: vectors.length - failures.length,
      failures,
    },
    null,
    2,
  ),
);
assert.equal(
  failures.length,
  0,
  "Do not derive new pairs until every prior independent topology is understood",
);
