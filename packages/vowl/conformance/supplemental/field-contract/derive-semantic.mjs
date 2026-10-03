// SPDX-License-Identifier: AGPL-3.0-only
// Additive decoder/profile/scalar/precedence inventory; not a complete validator.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { candidates } from "./bindings.mjs";
import { definitions, families } from "./contracts.mjs";
import {
  at,
  bundle,
  json,
  pin,
  pointer,
  profiles,
  slug,
  sourcePins,
} from "./support.mjs";

const { records, header } = await candidates([
  "supplemental/field-contract/additional-positive-manifest.json",
]);
const vectors = [];
const inventory = [];
async function add(
  id,
  witness,
  mutate,
  expectedError,
  citation,
  linkedFieldObligations = [],
  serialization,
) {
  const document = structuredClone(witness.document);
  mutate(at(document, witness.path), document);
  const bytes = serialization ? serialization(document) : json(document);
  const input = await pin(
    `semantic/${slug(id)}/${witness.operation === "decode" ? "document" : "source"}.json`,
    bytes,
  );
  const vector = {
    id: `semantic-${slug(id)}`,
    operation: witness.operation,
    ...(witness.operation === "canonicalize"
      ? { profile: witness.fixture.profile }
      : {}),
    expectedError,
    obligation: id,
    sourceFixture: witness.fixture.id,
    sourceManifest: witness.fixture.manifest,
    sourceWitness:
      witness.fixture.files[
        witness.operation === "decode" ? "canonical.json" : "source.json"
      ],
    sourcePointer: pointer(witness.path),
    input,
    rules: citation,
    status: "independent-semantic-boundary-expectation-pending-review",
  };
  vectors.push(vector);
  inventory.push({
    id,
    status: "negative-bound",
    vector: vector.id,
    input,
    citation,
    linkedFieldObligations,
  });
}
function witness(name, operation = "canonicalize", predicate = () => true) {
  const value = records
    .get(name)
    ?.find((item) => item.operation === operation && predicate(item));
  assert(value, `Missing ${operation} witness ${name}`);
  return value;
}

// Each distinct canonical closed record/variant gets a decoder boundary witness.
// Shared nested records are not multiplied across every possible parent/profile.
for (const descriptor of Object.values(definitions).filter(
  (item) => !item.name.startsWith("Source"),
)) {
  const current = witness(descriptor.name, "decode");
  const required = Object.entries(descriptor.fields).find(
    ([, type]) => !type.optional,
  )[0];
  const selector = families[descriptor.family]?.tag === required;
  const requiredCell = `required/${selector ? descriptor.family : descriptor.name}/${required}`;
  const field = descriptor.forbiddenFields.includes("id")
    ? "id"
    : "unexpectedField";
  await add(
    `decoder-required/${descriptor.name}/${required}`,
    current,
    (record) => {
      delete record[required];
    },
    "DOCUMENT_REQUIRED_FIELD",
    ["A1", descriptor.citation, "A7"],
    [requiredCell],
  );
  await add(
    `decoder-forbidden/${descriptor.name}/${field}`,
    current,
    (record) => {
      record[field] = null;
    },
    "DOCUMENT_UNKNOWN_FIELD",
    ["A1", descriptor.citation, "A7"],
    [`forbidden/${descriptor.name}/${field}`],
  );
  await add(
    `decoder-type/${descriptor.name}/${required}`,
    current,
    (record) => {
      record[required] = null;
    },
    "DOCUMENT_TYPE",
    ["A1", descriptor.citation, "A7"],
    [`type/${selector ? descriptor.family : descriptor.name}/${required}`],
  );
}
for (const [name, family] of Object.entries(families)) {
  const current = witness(Object.values(family.variants)[0], "decode");
  await add(
    `decoder-discriminator/${name}`,
    current,
    (record) => {
      record[family.tag] = "field-contract-invalid-token";
    },
    "DOCUMENT_TYPE",
    ["A1", current.descriptor.citation, "A7"],
    [`enum-invalid/${name}/${family.tag}`],
  );
}
// Literal cannot borrow the two additional AnnotationValue alternatives.
for (const kind of ["iri", "subject"])
  for (const operation of ["canonicalize", "decode"])
    await add(
      `literal-narrow-union/${operation}/${kind}`,
      witness("Literal:typed", operation),
      (record) => {
        record.kind = kind;
      },
      "DOCUMENT_TYPE",
      ["A2", "A7"],
      ["enum-invalid/Literal/kind"],
    );

for (const [name, profile] of [
  ["DocumentStructural", profiles.structural],
  ["DocumentArtifact", profiles.artifact],
]) {
  const current = witness(name, "decode");
  assert.equal(current.document.profile, profile);
  inventory.push({
    id: `profile-known/${name}`,
    status: "positive-bound",
    citation: ["A2", "A7", "D19"],
    fixture: current.fixture.id,
    witness: current.fixture.files["canonical.json"],
  });
  for (const [suffix, value] of [
    ["foreign", "urn:field-contract:unknown-profile"],
    ["case-sensitive", profile.replace("https", "HTTPS")],
    ["no-trailing-slash-alias", profile + "/"],
    ["not-an-iri", "not an IRI"],
  ])
    await add(
      `profile-unknown/${name}/${suffix}`,
      current,
      (record) => {
        record.profile = value;
      },
      "PROFILE_UNKNOWN",
      ["A2", "A7", "D19"],
    );
}
await add(
  "profile-coupling/structural-rejects-state",
  witness("DocumentArtifact", "decode"),
  (record) => {
    record.profile = profiles.structural;
  },
  "DOCUMENT_UNKNOWN_FIELD",
  ["A2", "A7"],
  ["forbidden/DocumentStructural/visualization"],
);
await add(
  "profile-coupling/artifact-requires-state",
  witness("DocumentStructural", "decode"),
  (record) => {
    record.profile = profiles.artifact;
  },
  "DOCUMENT_REQUIRED_FIELD",
  ["A2", "A7"],
  ["required/DocumentArtifact/visualization"],
);
await add(
  "precedence/envelope-required-before-known-profile",
  witness("DocumentStructural", "decode"),
  (record) => {
    delete record.structural;
    record.profile = "urn:unknown";
  },
  "DOCUMENT_REQUIRED_FIELD",
  ["A7"],
);
await add(
  "precedence/envelope-type-before-known-profile",
  witness("DocumentStructural", "decode"),
  (record) => {
    record.profile = null;
    record.unexpectedField = null;
  },
  "DOCUMENT_TYPE",
  ["A7"],
);
await add(
  "precedence/envelope-known-profile-before-closed-fields",
  witness("DocumentStructural", "decode"),
  (record) => {
    record.profile = "urn:unknown";
    record.unexpectedField = null;
  },
  "PROFILE_UNKNOWN",
  ["A7"],
);

// Exact same-record ordering is explicit, while cross-object order is not inferred here.
for (const operation of ["canonicalize", "decode"]) {
  const current = witness("Ontology", operation);
  await add(
    `precedence/${operation}/required-before-forbidden-type-domain`,
    current,
    (record) => {
      delete record.imports;
      record.unexpectedField = null;
      record.annotations = null;
      record.iri = "relative";
    },
    "DOCUMENT_REQUIRED_FIELD",
    ["A7"],
  );
  await add(
    `precedence/${operation}/forbidden-before-type-domain`,
    current,
    (record) => {
      record.unexpectedField = null;
      record.annotations = null;
      record.iri = "relative";
    },
    "DOCUMENT_UNKNOWN_FIELD",
    ["A7"],
  );
  await add(
    `precedence/${operation}/type-before-scalar-domain`,
    current,
    (record) => {
      record.annotations = null;
      record.iri = "relative";
    },
    "DOCUMENT_TYPE",
    ["A7"],
  );
  await add(
    `precedence/${operation}/scalar-domain-before-reference`,
    witness("AnnotationValue:subject", operation),
    (record, document) => {
      record.subject = "field-contract-absent-reference";
      document.structural.ontology.iri = "relative";
    },
    "IRI_INVALID",
    ["A7"],
  );
}
const early = JSON.parse(
  await readFile(
    resolve(bundle, "supplemental/field-contract/early-negative-manifest.json"),
  ),
);
for (const vector of early.vectors.filter((item) =>
  item.obligation.startsWith("precedence/"),
))
  inventory.push({
    id: vector.obligation,
    status: "historical-early-negative-bound",
    citation: ["A7"],
    manifest: "supplemental/field-contract/early-negative-manifest.json",
    vector: vector.id,
    input: vector.input,
  });

// Scalar domain obligations are separate from JSON type obligations.
for (const descriptor of Object.values(definitions).filter(
  (item) => !item.name.startsWith("Document"),
)) {
  for (const [field, type] of Object.entries(descriptor.fields)) {
    const item = type.type === "collection" ? type.item : type;
    if (
      !["iri", "decimal", "language-tag", "language-range", "text"].includes(
        item.type,
      )
    )
      continue;
    const current = witness(descriptor.name);
    const scalar = {
      iri: ["relative-reference", "IRI_INVALID"],
      decimal: ["01", "DECIMAL_INVALID"],
      "language-tag": ["en-x", "LANGUAGE_TAG_INVALID"],
      "language-range": ["en-*", "LANGUAGE_RANGE_INVALID"],
      text: ["\uFDD0", "UNICODE_INVALID"],
    }[item.type];
    await add(
      `scalar-domain/${descriptor.name}/${field}`,
      current,
      (record) => {
        if (type.type === "collection")
          record[field] = record[field].length
            ? [scalar[0], ...record[field].slice(1)]
            : [scalar[0]];
        else record[field] = scalar[0];
      },
      scalar[1],
      ["A1", descriptor.citation, "A7"],
      [`type/${descriptor.name}/${field}`],
    );
  }
}
for (const zoom of [0, -1])
  await add(
    `camera-positive-zoom/${zoom}`,
    witness("Camera"),
    (record) => {
      record.zoom = zoom;
    },
    "ARTIFACT_INCOMPLETE",
    ["B3", "A7-stage-7"],
  );
await add(
  "ontology-version-needs-iri",
  witness("Ontology"),
  (record) => {
    delete record.iri;
    record.versionIri = "urn:field-contract:version";
  },
  "NORMALIZATION_INVALID",
  ["A2", "A7"],
);
for (const descriptor of ["Literal:typed", "AnnotationValue:typed"])
  await add(
    `literal-excludes-lang-string/${descriptor}`,
    witness(descriptor),
    (record) => {
      record.datatype = "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";
    },
    "NORMALIZATION_INVALID",
    ["A2", "A7"],
  );

const negativeManifest = await pin(
  "semantic-negative-manifest.json",
  json({
    format: "canonical-vowl-negative-manifest/1",
    status:
      "independent-profile-decoder-scalar-and-precedence-supplement-pending-review",
    specificationRevision: header.specificationRevision,
    amendment: header.amendment,
    sourceArtifacts: await sourcePins([
      "support.mjs",
      "contracts.mjs",
      "bindings.mjs",
      "derive-semantic.mjs",
    ]),
    independence:
      "Only independently derived source/canonical witnesses and pinned normative clauses select inputs and expected errors. No product code or execution is used.",
    vectors,
  }),
);
await pin(
  "semantic-inventory.json",
  json({
    format: "canonical-vowl-semantic-closure-inventory/1",
    sourceArtifacts: await sourcePins([
      "contract-inventory.json",
      "coverage-inventory.json",
      "early-negative-manifest.json",
    ]),
    negativeManifest,
    denominator: {
      newNegatives: vectors.length,
      reusedEarlyPrecedence: 2,
      knownProfilePositives: 2,
      totalObligations: inventory.length,
    },
    policy:
      "One decoder required/forbidden/type probe for each canonical closed record/variant, one unknown selector per family, exact known-profile/envelope coupling, each declared lexical-domain field position, and listed precedence/semantic conditions. This denominator is additive to the finite field inventory, not a claim of exhaustive A5 semantics or all error combinations.",
    pendingOwnerQuestions: [
      "The historical A7-versus-D19 lexical Unicode/envelope precedence question remains outside these well-formed-envelope cases.",
      "Inverse-edge and operator-edge endpoint direction questions remain in review-resolution-v1/review-resolution.json; no new direction rule is selected here.",
    ],
    obligations: inventory,
  }),
);
assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);
console.log(
  JSON.stringify({
    semanticNegatives: vectors.length,
    explicitObligations: inventory.length,
  }),
);
