// SPDX-License-Identifier: AGPL-3.0-only
// Isolated closed-contract mutations, derived without a product validator.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  alternateReference,
  candidates,
  negativeWitness,
  positiveMatch,
  referenceAccepts,
  referenceRecords,
} from "./bindings.mjs";
import { obligations } from "./inventory.mjs";
import {
  at,
  bundle,
  json,
  pin,
  pointer,
  readPinned,
  slug,
  sourcePins,
} from "./support.mjs";

const { records, header } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
]);
const earlyPath = "supplemental/field-contract/early-negative-manifest.json";
const early = JSON.parse(await readFile(resolve(bundle, earlyPath)));
const earlyCells = new Map(
  early.vectors.map((vector) => [vector.obligation, vector]),
);
const vectors = [];
const bindings = [];
const ids = new Set();
for (const cell of obligations()) {
  if (cell.mutation.startsWith("positive-")) {
    const witness = records
      .get(cell.descriptor)
      ?.find((item) => positiveMatch(cell, item));
    assert(witness, `No valid positive witness for ${cell.id}`);
    bindings.push({
      obligation: cell.id,
      status: "positive-witness-bound",
      fixture: witness.fixture.id,
      manifest: witness.fixture.manifest,
      operation: witness.operation,
      witness:
        witness.fixture.files[
          witness.operation === "decode" ? "canonical.json" : "source.json"
        ],
      pointer: pointer(witness.path),
      ...(cell.field ? { field: cell.field } : {}),
    });
    continue;
  }
  if (earlyCells.has(cell.id)) {
    const vector = earlyCells.get(cell.id);
    await readPinned(vector.input);
    vectors.push({ ...vector, reusedFromManifest: earlyPath });
    bindings.push({
      obligation: cell.id,
      status: "isolated-negative-bound",
      vector: vector.id,
      input: vector.input,
    });
    assert(!ids.has(vector.id));
    ids.add(vector.id);
    continue;
  }
  const witness = negativeWitness(cell, records);
  assert(witness, `No isolatable negative witness for ${cell.id}`);
  const document = structuredClone(witness.document);
  const record = at(document, witness.path);
  let expectedError = "DOCUMENT_TYPE";
  let referenceMutation;
  if (cell.mutation === "required") {
    delete record[cell.field];
    expectedError = "DOCUMENT_REQUIRED_FIELD";
  } else if (cell.mutation === "forbidden") {
    record[cell.field] = null;
    expectedError = "DOCUMENT_UNKNOWN_FIELD";
  } else if (cell.mutation === "type") record[cell.field] = null;
  else if (cell.mutation === "enum-invalid")
    record[cell.field] = "field-contract-invalid-token";
  else if (cell.mutation === "element-type") {
    record[cell.field] = record[cell.field].length
      ? [...record[cell.field]]
      : [null];
    record[cell.field][0] = null;
  } else if (cell.mutation === "minimum")
    record[cell.field] = record[cell.field].slice(0, cell.type.min - 1);
  else if (cell.mutation === "maximum") {
    record[cell.field] = referenceRecords(document)
      .filter((item) => referenceAccepts(cell.type.item.sort, item))
      .slice(0, cell.type.max + 1)
      .map((item) => item.value.id);
    assert.equal(new Set(record[cell.field]).size, cell.type.max + 1);
  } else if (["dangling", "category", "target-sort"].includes(cell.mutation)) {
    let target;
    if (cell.mutation === "dangling") {
      target = "field-contract-absent-reference";
      assert(
        !referenceRecords(document).some((item) => item.value.id === target),
      );
      expectedError = "REFERENCE_DANGLING";
    } else {
      const alternate = alternateReference(witness, cell.type, cell.mutation);
      assert(alternate);
      target = alternate.value.id;
      referenceMutation = {
        target,
        category: alternate.category,
        kind: alternate.value.kind ?? null,
      };
      const sort =
        cell.type.type === "collection" ? cell.type.item.sort : cell.type.sort;
      // A2 makes named anonymous-individual values a normalization failure;
      // unlike typed reference categories, anonymous identity is not an ID category.
      expectedError =
        cell.mutation === "target-sort" && sort === "S-anonymous"
          ? "NORMALIZATION_INVALID"
          : "REFERENCE_KIND";
    }
    if (cell.type.type === "collection") {
      const members = record[cell.field];
      record[cell.field] = members.length
        ? [target, ...members.slice(1)]
        : [target];
      assert.equal(new Set(record[cell.field]).size, record[cell.field].length);
    } else record[cell.field] = target;
  } else assert.fail(`Unspecified mutation ${cell.mutation}`);
  const id = `field-${slug(cell.id)}`;
  assert(!ids.has(id), id);
  ids.add(id);
  const input = await pin(
    `negative/${id}/${witness.operation === "decode" ? "document" : "source"}.json`,
    json(document),
  );
  const vector = {
    id,
    operation: witness.operation,
    ...(witness.operation === "canonicalize"
      ? { profile: witness.fixture.profile }
      : {}),
    expectedError,
    obligation: cell.id,
    descriptor: cell.descriptor,
    field: cell.field,
    mutation: cell.mutation,
    sourceFixture: witness.fixture.id,
    sourceManifest: witness.fixture.manifest,
    sourceWitness:
      witness.fixture.files[
        witness.operation === "decode" ? "canonical.json" : "source.json"
      ],
    sourcePointer: pointer(witness.path),
    ...(referenceMutation ? { referenceMutation } : {}),
    input,
    rules: cell.citation,
    status: "independent-isolated-field-expectation-pending-review",
  };
  vectors.push(vector);
  bindings.push({
    obligation: cell.id,
    status: "isolated-negative-bound",
    vector: id,
    input,
  });
}
assert.equal(vectors.length, 2671);
assert.equal(bindings.length, 3369);
const manifest = await pin(
  "negative-manifest.json",
  json({
    format: "canonical-vowl-negative-manifest/1",
    status: "independent-complete-finite-field-mutation-denominator",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    independence:
      "Every input is a frozen independent valid source/document plus one closed-contract field mutation. Expected codes follow A1-A5/B1/B3 and A7. This script is a fixture constructor, not a validator; it never imports or executes product code.",
    provenance: await sourcePins([
      "support.mjs",
      "contracts.mjs",
      "inventory.mjs",
      "bindings.mjs",
      "derive-negatives.mjs",
    ]),
    sourceManifests: await sourcePins([
      "positive-manifest.json",
      "additional-positive-manifest.json",
      "early-negative-manifest.json",
      "contract-inventory.json",
    ]),
    vectors,
  }),
);
await pin(
  "coverage-inventory.json",
  json({
    format: "canonical-vowl-field-contract-binding/1",
    status: "all-declared-field-obligations-bound-pending-independent-review",
    inventory: (await sourcePins(["contract-inventory.json"]))[0],
    negativeManifest: manifest,
    denominator: { obligations: 3369, positive: 698, negative: 2671 },
    limitation:
      "This is the explicit finite field/class denominator in contract-inventory.json. It does not establish every A5 semantic invariant, every public-operation/profile combination, every A7 precedence pair, or D18 mapping injectivity. Those remain separately inventoried.",
    bindings,
  }),
);
console.log(
  JSON.stringify({
    positiveBindings: 698,
    negativeCases: vectors.length,
    reusedEarlyCases: vectors.filter((item) => item.reusedFromManifest).length,
    result: "isolated inputs and field bindings reproduced",
  }),
);
