// SPDX-License-Identifier: AGPL-3.0-only
// Frozen early grammar negatives; expected codes follow A1/A7, not product output.
import assert from "node:assert/strict";
import { visit } from "./contracts.mjs";
import { baseline, at, json, pin, pointer, sourcePins } from "./support.mjs";
const { vectors: positives, header } = await baseline();
const witnesses = new Map();
for (const fixture of positives) {
  visit(
    fixture.source,
    fixture.source.visualization ? "SourceArtifact" : "SourceStructural",
    (descriptor, value, path) => {
      const cost = JSON.stringify(fixture.source).length;
      if (
        !witnesses.has(descriptor.name) ||
        cost < witnesses.get(descriptor.name).cost
      )
        witnesses.set(descriptor.name, { fixture, value, path, cost });
    },
  );
}
const recipes = [
  ["required/Ontology/imports", "Ontology", "imports", "required"],
  ["required/Annotation/annotations", "Annotation", "annotations", "required"],
  [
    "required/Expression:object-min-cardinality/filler",
    "Expression:object-min-cardinality",
    "filler",
    "required",
  ],
  [
    "required/Construct:key/objectProperties",
    "Construct:key",
    "objectProperties",
    "required",
  ],
  [
    "required/Occurrence:inverse-edge/forward",
    "Occurrence:inverse-edge",
    "forward",
    "required",
  ],
  ["required/Placement/pinned", "Placement", "pinned", "required"],
  ["required/Camera/zoom", "Camera", "zoom", "required"],
  [
    "required/LabelSelection:language/range",
    "LabelSelection:language",
    "range",
    "required",
  ],
  [
    "forbidden/Literal:typed/language",
    "Literal:typed",
    "language",
    "forbidden",
  ],
  [
    "forbidden/AnnotationValue:language/datatype",
    "AnnotationValue:language",
    "datatype",
    "forbidden",
  ],
  [
    "forbidden/Context:class/properties",
    "Context:class",
    "properties",
    "forbidden",
  ],
  [
    "forbidden/Context:property/targets",
    "Context:property",
    "targets",
    "forbidden",
  ],
  [
    "forbidden/Assertion:declaration/id",
    "Assertion:declaration",
    "id",
    "forbidden",
  ],
  [
    "forbidden/SourceStructural/profile",
    "SourceStructural",
    "profile",
    "forbidden",
  ],
  ["enum-invalid/Role/kind", "Role", "kind", "enum-invalid"],
  [
    "enum-invalid/Expression/kind",
    "Expression:class-union",
    "kind",
    "enum-invalid",
  ],
  ["enum-invalid/Literal/kind", "Literal:typed", "kind", "literal-iri"],
  [
    "minimum/Expression:class-union/members",
    "Expression:class-union",
    "members",
    "minimum",
  ],
  [
    "minimum/Construct:property-chain/members",
    "Construct:property-chain",
    "members",
    "short-chain",
  ],
  ["type/Role/subject", "Role", "subject", "type"],
  ["element-type/Ontology/imports", "Ontology", "imports", "element-type"],
  [
    "precedence/Ontology/required-before-forbidden",
    "Ontology",
    "imports",
    "required-before-forbidden",
  ],
  [
    "precedence/Ontology/forbidden-before-type",
    "Ontology",
    "imports",
    "forbidden-before-type",
  ],
];
const vectors = [];
for (const [cell, descriptor, field, mutation] of recipes) {
  const witness = witnesses.get(descriptor);
  assert(witness, `Missing reviewed positive source for ${descriptor}`);
  const source = structuredClone(witness.fixture.source);
  const value = at(source, witness.path);
  let expectedError = "DOCUMENT_TYPE";
  if (mutation === "required" || mutation === "required-before-forbidden") {
    delete value[field];
    expectedError = "DOCUMENT_REQUIRED_FIELD";
  } else if (mutation === "forbidden") {
    value[field] = null;
    expectedError = "DOCUMENT_UNKNOWN_FIELD";
  } else if (mutation === "enum-invalid")
    value[field] = "field-contract-invalid-token";
  else if (mutation === "literal-iri") value[field] = "iri";
  else if (mutation === "minimum") value[field] = [];
  else if (mutation === "short-chain") value[field] = value[field].slice(0, 1);
  else if (mutation === "element-type") value[field] = [null];
  else value[field] = null;
  if (mutation === "required-before-forbidden") value.unexpectedField = null;
  if (mutation === "forbidden-before-type") {
    value.unexpectedField = null;
    expectedError = "DOCUMENT_UNKNOWN_FIELD";
  }
  const id = cell.replaceAll(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const input = await pin(`early/${id}/source.json`, json(source));
  vectors.push({
    id,
    operation: "canonicalize",
    profile: witness.fixture.profile,
    expectedError,
    obligation: cell,
    descriptor,
    field,
    mutation,
    sourceFixture: witness.fixture.id,
    sourceManifest: witness.fixture.manifest,
    sourceWitness: witness.fixture.files["source.json"],
    sourcePointer: pointer(witness.path),
    input,
    rules: ["A1", "A2", "A3", "A4", "B1", "B3", "A7"],
    status: "independently-selected-early-grammar-expectation-pending-review",
  });
}
await pin(
  "early-negative-manifest.json",
  json({
    format: "canonical-vowl-negative-manifest/1",
    status: "independent-field-contract-early-batch",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    independence:
      "Mutations use only frozen independent source witnesses and normative grammar/error order. No production execution selected these expectations.",
    sourceArtifacts: await sourcePins([
      "contracts.mjs",
      "support.mjs",
      "derive-early.mjs",
    ]),
    vectors,
  }),
);
console.log(
  JSON.stringify({
    earlyNegatives: vectors.length,
    result: "isolated early inputs and normative errors reproduced",
  }),
);
