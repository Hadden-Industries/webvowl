// SPDX-License-Identifier: AGPL-3.0-only
// Conservative D18.1 pair audit. A field witness is not an injectivity proof.
import assert from "node:assert/strict";
import { produce } from "../amended-policy/producer.mjs";
import { candidates } from "./bindings.mjs";
import { definitions, families, select, visit } from "./contracts.mjs";
import { permute } from "./positives.mjs";
import {
  hash,
  json,
  pin,
  pointer,
  readPinned,
  sourcePins,
} from "./support.mjs";

const { vectors, header } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
  "supplemental/field-contract/state-identity-manifest.json",
]);
const sourceDescriptors = Object.values(definitions).filter(
  (item) => !item.name.startsWith("Document"),
);
const retained = sourceDescriptors.flatMap((descriptor) =>
  Object.entries(descriptor.fields)
    .filter(([field]) => field !== "id")
    .map(([field, type]) => ({
      descriptor,
      field,
      type,
      id: `mapping/${descriptor.name}/${field}`,
    })),
);
const cells = new Map(retained.map((cell) => [cell.id, cell]));
const pairs = new Map();
const buckets = new Map();
const normalize = (value, type, path, maskedPath) => {
  if (
    path.length === maskedPath.length &&
    path.every((item, index) => item === maskedPath[index])
  )
    return { fieldContractMaskedValue: true };
  if (type.type === "record") {
    const descriptor = select(type.record, value);
    assert(descriptor);
    const names = new Set(Object.keys(value));
    if (
      maskedPath.length === path.length + 1 &&
      path.every((item, index) => item === maskedPath[index])
    )
      names.add(maskedPath.at(-1));
    return Object.fromEntries(
      [...names]
        .sort()
        .map((name) => [
          name,
          normalize(
            value[name],
            descriptor.fields[name],
            [...path, name],
            maskedPath,
          ),
        ]),
    );
  }
  if (type.type === "collection") {
    const members = value.map((item, index) =>
      normalize(item, type.item, [...path, index], maskedPath),
    );
    return type.sequence
      ? members
      : members.sort((a, b) => {
          const left = JSON.stringify(a),
            right = JSON.stringify(b);
          return left < right ? -1 : left > right ? 1 : 0;
        });
  }
  return value;
};
function evidence(item) {
  return {
    fixture: item.fixture.id,
    manifest: item.fixture.manifest,
    descriptor: item.descriptor.name,
    field: item.field,
    pointer: pointer([...item.path, item.field]),
    source: item.fixture.files["source.json"],
    canonicalNQuads: item.fixture.files["canonical.nq"],
    canonicalBytes: item.fixture.files["canonical.json"],
  };
}
vectors.sort(
  (a, b) =>
    JSON.stringify(a.source).length - JSON.stringify(b.source).length ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
);
for (const fixture of vectors) {
  const root = fixture.source.visualization
    ? "SourceArtifact"
    : "SourceStructural";
  visit(fixture.source, root, (descriptor, value, path) => {
    for (const field of Object.keys(descriptor.fields).filter(
      (name) => name !== "id",
    )) {
      const selector = families[descriptor.family]?.tag === field;
      const scope = `${selector ? descriptor.family : descriptor.name}/${field}`;
      const masked = normalize(
        fixture.source,
        { type: "record", record: root },
        [],
        [...path, field],
      );
      const signature = `${fixture.profile}|${scope}|${hash(JSON.stringify(masked))}`;
      const current = { fixture, descriptor, value, path, field };
      for (const previous of buckets.get(signature) ?? []) {
        if (
          fixture.files["canonical.json"].sha256 ===
            previous.fixture.files["canonical.json"].sha256 ||
          fixture.files["canonical.nq"].sha256 ===
            previous.fixture.files["canonical.nq"].sha256
        )
          continue;
        const pair = {
          before: evidence(previous),
          after: evidence(current),
          evidenceClass:
            "single-field-substitution-with-identical-rest-under-set-order",
          scopedField: scope,
        };
        for (const item of [previous, current]) {
          const id = `mapping/${item.descriptor.name}/${field}`;
          assert(cells.has(id));
          if (!pairs.has(id)) pairs.set(id, pair);
        }
        break;
      }
      if (!buckets.has(signature)) buckets.set(signature, []);
      buckets.get(signature).push(current);
    }
  });
}
// The selected witnesses are rederived independently in both source orders;
// pinned hashes alone are not the metamorphic execution evidence.
const selected = new Set(
  [...pairs.values()].flatMap((pair) => [
    pair.before.fixture,
    pair.after.fixture,
  ]),
);
const reproductions = [];
for (const fixture of vectors.filter((item) => selected.has(item.id))) {
  const result = await produce(fixture.source, fixture.profile);
  const permutation = await produce(permute(fixture.source), fixture.profile);
  assert.deepEqual(
    result.bytes,
    await readPinned(fixture.files["canonical.json"]),
  );
  assert.equal(
    result.canonicalNQuads,
    (await readPinned(fixture.files["canonical.nq"])).toString("utf8"),
  );
  assert.deepEqual(result.bytes, permutation.bytes);
  assert.equal(result.canonicalNQuads, permutation.canonicalNQuads);
  reproductions.push({
    fixture: fixture.id,
    canonicalSha256: hash(result.bytes),
    canonicalNQuadsSha256: hash(result.canonicalNQuads),
    handlesAndSetsPermuted: true,
    sequencesPreserved: true,
  });
}
const entries = retained.map((cell) => ({
  id: cell.id,
  descriptor: cell.descriptor.name,
  field: cell.field,
  citation: ["D18.1", "A6", cell.descriptor.citation],
  ...(pairs.has(cell.id)
    ? { status: "paired-difference-witnessed", pair: pairs.get(cell.id) }
    : {
        status: "unclosed",
        remaining:
          "No exact single-field positive pair was established by this conservative audit. Independently authored signature/topology-aware pairs may be needed; token, presence, and rejection coverage do not close this obligation.",
      }),
}));
await pin(
  "mapping-injectivity-inventory.json",
  json({
    format: "canonical-vowl-mapping-pair-inventory/1",
    status: "explicit-partial-evidence-not-a-freeze-claim",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    sourceArtifacts: await sourcePins([
      "contracts.mjs",
      "support.mjs",
      "bindings.mjs",
      "positives.mjs",
      "derive-mapping-inventory.mjs",
    ]),
    denominator: {
      descriptorFieldPositions: 414,
      sourcePrimaryHandlePositionsExcludedFromRdf: sourceDescriptors.reduce(
        (count, item) => count + Number(Object.hasOwn(item.fields, "id")),
        0,
      ),
      serializedEnvelopeMirrorPositionsSeparatelyClassified: 5,
      retainedSourceFieldPositions: retained.length,
      pairedDifferenceWitnessed: pairs.size,
      unclosed: retained.length - pairs.size,
      independentlyReproducedPairFixtures: selected.size,
    },
    policy:
      "A successful pair has identical profile and source outside one declared field after sorting only specification sets; source handles are kept fixed. Its full canonical RDF dataset and full canonical bytes differ. All selected witnesses reproduce under the independent producer and typed handle/set/key permutations. This deliberately undercounts pairs needing handle alignment or coordinated signature/topology edits. Composite field substitution is evidence for that owning field only, never automatic evidence for nested fields. Primary id values are excluded by A1/A6; canonical envelope fields mirror source/profile framing and are not counted twice.",
    profileFramingGap:
      "A dedicated paired root-profile framing counterexample remains separate: changing selected profile also requires complete artifact state, so it is not an isolated retained source field mutation. Successful structural/artifact fixtures alone are not claimed as a one-field proof.",
    qualification:
      "D18.1 remains open wherever entries say unclosed. A10 finite grammar coverage and 29 embedded assertion additions do not establish exhaustive mapping injectivity.",
    obligations: entries,
    reproduction: reproductions,
  }),
);
console.log(
  JSON.stringify({
    retainedSourceFieldPositions: retained.length,
    witnessedPairs: pairs.size,
    unclosedPairs: retained.length - pairs.size,
    independentlyReproducedPairFixtures: selected.size,
  }),
);
