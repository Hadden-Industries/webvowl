// SPDX-License-Identifier: AGPL-3.0-only
// Small witness completions discovered by the independent field inventory.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { produce } from "../amended-policy/producer.mjs";
import { permute } from "./positives.mjs";
import {
  baseline,
  bundle,
  json,
  pin,
  readPinned,
  sourcePins,
} from "./support.mjs";
const { vectors: previous, header } = await baseline();
const anchorManifest = JSON.parse(
  await readFile(
    resolve(bundle, "supplemental/field-contract/positive-manifest.json"),
  ),
);
const characterAnchor = anchorManifest.vectors.find(
  (item) => item.newAssertionKind === "object-characteristic",
);
const characterSource = JSON.parse(
  await readPinned(characterAnchor.files["source.json"]),
);
const currentCharacteristic = characterSource.structural.constructs.find(
  (item) => item.kind === "object-characteristic",
).characteristic;
const recipes = [];
for (const characteristic of [
  "functional",
  "inverse-functional",
  "symmetric",
  "asymmetric",
  "transitive",
  "reflexive",
  "irreflexive",
].filter((value) => value !== currentCharacteristic)) {
  const source = structuredClone(characterSource);
  const base = source.structural.constructs.filter(
    (item) => item.kind === "object-characteristic",
  );
  const anchors = source.structural.constructs.filter(
    (item) =>
      item.kind === "assertion-anchor" &&
      item.assertion.kind === "object-characteristic",
  );
  assert.equal(base.length, 1);
  assert.equal(anchors.length, 1);
  base[0].characteristic = characteristic;
  anchors[0].assertion.characteristic = characteristic;
  recipes.push({
    id: `anchor-characteristic-${characteristic}`,
    source,
    profile: characterAnchor.profile,
    sourceWitness: characterAnchor.files["source.json"],
    derivation:
      "Change the supported base fact and its exact embedded assertion together; characteristics create no new occurrence.",
  });
}
function smallest(predicate) {
  return previous
    .filter((item) => !item.source.visualization && predicate(item.source))
    .sort(
      (a, b) =>
        JSON.stringify(a.source).length - JSON.stringify(b.source).length ||
        (a.id < b.id ? -1 : 1),
    )[0];
}
function additions(source) {
  const ids = new Set(
    ["subjects", "roles", "expressions", "constructs", "occurrences"].flatMap(
      (key) => source.structural[key].map((item) => item.id),
    ),
  );
  let count = 0;
  const fresh = () => {
    let id;
    do {
      id = `field-additional-${++count}`;
    } while (ids.has(id));
    ids.add(id);
    return id;
  };
  function role(iri, kind) {
    let subject = source.structural.subjects.find((item) => item.iri === iri);
    if (!subject) {
      subject = { id: fresh(), iri };
      source.structural.subjects.push(subject);
    }
    if (
      !source.structural.roles.some(
        (item) => item.subject === subject.id && item.kind === kind,
      )
    )
      source.structural.roles.push({ id: fresh(), kind, subject: subject.id });
  }
  return { fresh, role };
}
for (const kind of ["data-union", "datatype-restriction"]) {
  const witness = smallest((source) =>
    source.structural.expressions.some((item) => item.kind === kind),
  );
  const source = structuredClone(witness.source);
  additions(source).role(
    "urn:field-contract:unused-annotation-property",
    "annotation-property",
  );
  recipes.push({
    id: `reference-sort-${kind}`,
    source,
    profile: witness.profile,
    sourceWitness: witness.files["source.json"],
    derivation:
      "Add a named annotation-property declaration, permitted to be otherwise unused by A2. B2 assigns it no occurrence. It supplies an existing role of a wrong sort without dangling references in the negative mutation.",
  });
}
const inverseWitness = smallest(
  (source) =>
    source.structural.constructs.some(
      (item) => item.kind === "inverse-properties",
    ) &&
    source.structural.roles.filter((item) => item.kind === "object-property")
      .length >= 3,
);
assert(inverseWitness);
const inverseSource = structuredClone(inverseWitness.source);
const { role, fresh } = additions(inverseSource);
const predicate = "urn:field-contract:annotation",
  datatype = "http://www.w3.org/2001/XMLSchema#string";
role(predicate, "annotation-property");
role(datatype, "datatype");
const assertion = structuredClone(
  inverseSource.structural.constructs.find(
    (item) => item.kind === "inverse-properties",
  ),
);
delete assertion.id;
inverseSource.structural.constructs.push({
  id: fresh(),
  kind: "assertion-anchor",
  assertion,
  annotations: [
    {
      predicate,
      value: {
        kind: "typed",
        lexical: "inverse pair with three available property roles",
        datatype,
      },
      annotations: [],
    },
  ],
});
recipes.push({
  id: "anchor-inverse-three-role-witness",
  source: inverseSource,
  profile: inverseWitness.profile,
  sourceWitness: inverseWitness.files["source.json"],
  derivation:
    "Exact supported inverse-properties assertion in a graph already containing three distinct object-property roles. The positive assertion still has at most two members.",
});
assert.equal(recipes.length, 9);
const vectors = [];
for (const fixture of recipes) {
  const permutation = permute(fixture.source);
  const result = await produce(fixture.source, fixture.profile),
    alternate = await produce(permutation, fixture.profile);
  assert.deepEqual(result.bytes, alternate.bytes);
  assert.equal(result.canonicalNQuads, alternate.canonicalNQuads);
  const files = {};
  for (const [filename, bytes] of [
    ["source.json", json(fixture.source)],
    ["permuted-source.json", json(permutation)],
    ["mapped.nq", result.mappedNQuads],
    ["canonical.nq", result.canonicalNQuads],
    ["ids.json", json(result.correspondence)],
    ["canonical.json", result.bytes],
  ])
    files[filename] = await pin(
      `additional-positive/${fixture.id}/${filename}`,
      bytes,
    );
  const { source, ...metadata } = fixture;
  void source;
  vectors.push({
    ...metadata,
    rules: ["A2", "A3", "A4", "A5", "A10", "B2"],
    counts: {
      primary: result.correspondence.length,
      blankNodes: result.blankNodeCount,
      quads: result.quadCount,
    },
    files,
  });
}
await pin(
  "additional-positive-manifest.json",
  json({
    format: "canonical-vowl-conformance-manifest/1",
    status: "independent-field-witness-completion-pending-review",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    sourceArtifacts: await sourcePins([
      "contracts.mjs",
      "support.mjs",
      "positives.mjs",
      "derive-additional-positives.mjs",
    ]),
    vectors,
  }),
);
console.log(
  JSON.stringify({
    additionalPositiveWitnesses: vectors.length,
    completePermutationComparisons: vectors.length,
  }),
);
