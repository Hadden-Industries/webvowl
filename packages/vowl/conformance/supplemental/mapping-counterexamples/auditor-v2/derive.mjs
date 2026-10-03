// SPDX-License-Identifier: AGPL-3.0-only
// Additive repair evidence. These are private auditor controls, not source
// rejection fixtures and not expectations derived from a product implementation.
import assert from "node:assert/strict";
import { auditTemplates as oldAudit } from "../template-audit.mjs";
import { profiles } from "../../field-contract/support.mjs";
import { auditTemplates, mapping } from "./template-audit.mjs";
import { filePin, json, pin, prefix, readPinned } from "./support.mjs";
const predecessor = {
  auditor: {
    path: "supplemental/mapping-counterexamples/template-audit.mjs",
    sha256: "38cbb9d88f4262b7a5467cca19e50d14c1f82487f9734e0eb0c454fa47debe87",
  },
  evidence: {
    path: "supplemental/mapping-counterexamples/template-audit-evidence.json",
    sha256: "798029a6a5ee56759ca3a5cd621d90b441b15ed3fa7fda5f1c062f164ac407d3",
  },
  provenance: {
    path: "supplemental/mapping-counterexamples/provenance-index.json",
    sha256: "d3faacaded67d017d8f8d590fea87543e684578764d1a2af6889448e6db8f20c",
  },
};
await readPinned(predecessor.auditor);
await readPinned(predecessor.provenance);
const previous = JSON.parse(await readPinned(predecessor.evidence)),
  vectors = [],
  fixtures = [];
for (const vector of previous.vectors) {
  const source = JSON.parse(await readPinned(vector.source)),
    ids = JSON.parse(await readPinned(vector.ids)),
    nquads = (await readPinned(vector.canonicalNQuads)).toString("utf8");
  const profile = source.visualization
    ? profiles.artifact
    : profiles.structural;
  const corrected = auditTemplates(source, profile, ids, nquads);
  assert.deepEqual(
    corrected,
    oldAudit(source, profile, ids, nquads),
    `${vector.fixture}: positive template trace changed`,
  );
  assert.equal(corrected.quads, vector.quads);
  vectors.push({
    ...vector,
    profile,
    sourceCategoriesAndBlankAllocationChecked: true,
    positiveTemplateTraceUnchanged: true,
  });
  fixtures.push({ vector, source, profile, ids, nquads, corrected });
}
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const categories = {
  subjects: "Subject",
  roles: "Role",
  expressions: "Expression",
  constructs: "Construct",
  occurrences: "Occurrence",
};
const controls = [];
function add(id, fixture, ids, nquads, message, change, legacyAccepted = true) {
  let acceptedByV1 = false;
  try {
    oldAudit(fixture.source, fixture.profile, ids, nquads);
    acceptedByV1 = true;
  } catch (error) {
    assert.equal(error.code, "ERR_ASSERTION");
  }
  assert.equal(
    acceptedByV1,
    legacyAccepted,
    `${id}: control no longer reproduces the stated predecessor behavior`,
  );
  let rejection;
  assert.throws(
    () => auditTemplates(fixture.source, fixture.profile, ids, nquads),
    (error) => {
      rejection = { code: error.code, message: error.message };
      return error.code === "ERR_ASSERTION" && error.message.includes(message);
    },
    `${id}: must reject for the asserted checker invariant`,
  );
  controls.push({ id, fixture, ids, nquads, acceptedByV1, rejection, change });
}
function find(id) {
  const fixture = fixtures.find((item) => item.vector.fixture === id);
  assert(fixture, id);
  return fixture;
}
function namedAllocation(id, fixture, blankNode, name) {
  assert(blankNode.startsWith("_:"));
  const target = `<urn:review:${name}>`,
    nquads = fixture.nquads.replaceAll(`${blankNode} `, `${target} `);
  assert.notEqual(nquads, fixture.nquads);
  add(
    id,
    fixture,
    fixture.ids,
    nquads,
    "A6 allocation must be a blank node except the fixed root",
    {
      kind: "replace-rdf-term-everywhere",
      before: blankNode,
      after: target,
      unchanged: ["source", "ids"],
    },
  );
}
const empty = find("empty-structural");
assert(
  empty.nquads.includes(
    `<${mapping}root> <${mapping}field/structural> _:c14n8 .`,
  ),
);
namedAllocation("named-embedded-object", empty, "_:c14n8", "named-auxiliary");
const setNode = empty.nquads
  .split("\n")
  .find((line) => line.endsWith(`<${rdf}> <${mapping}Set> .`))
  .split(" ")[0];
namedAllocation("named-set-container", empty, setNode, "named-set");
const ordered = [...fixtures].sort(
  (a, b) =>
    a.nquads.length - b.nquads.length ||
    (a.vector.fixture < b.vector.fixture ? -1 : 1),
);
const sequenceFixture = ordered.find((item) =>
  item.nquads.includes(`<${rdf}> <${mapping}Slot> .`),
);
assert(sequenceFixture);
const slot = sequenceFixture.nquads
  .split("\n")
  .find((line) => line.endsWith(`<${rdf}> <${mapping}Slot> .`))
  .split(" ")[0];
namedAllocation("named-sequence-slot", sequenceFixture, slot, "named-slot");
const names = Object.keys(categories);
for (const [index, category] of names.entries()) {
  const fixture =
    category === "subjects"
      ? find("named-class-structural")
      : ordered.find((item) => item.source.structural[category].length);
  assert(fixture);
  const handle = fixture.source.structural[category][0].id,
    ids = structuredClone(fixture.ids),
    row = ids.find((item) => item.sourceHandle === handle);
  assert.equal(row.category, category);
  const other = names[(index + 1) % names.length],
    original = `_:${row.rdfcIdentifier} <${rdf}> <${mapping}${categories[category]}> .`,
    changed = `_:${row.rdfcIdentifier} <${rdf}> <${mapping}${categories[other]}> .`;
  assert.equal(fixture.nquads.split(original).length, 2);
  row.category = other;
  add(
    `forged-${category}-category-and-type`,
    fixture,
    ids,
    fixture.nquads.replace(original, changed),
    "Primary category metadata disagrees with source collection",
    {
      kind: "colluding-correspondence-category-and-rdf-type",
      sourcePointer: `/structural/${category}/0`,
      sourceHandle: handle,
      actualSourceCategory: category,
      forgedMetadataCategory: other,
      originalTriple: original,
      changedTriple: changed,
    },
  );
}
const named = find("named-class-structural");
add(
  "extra-correspondence-handle",
  named,
  [
    ...named.ids,
    {
      sourceHandle: "unallocated-review-handle",
      rdfcIdentifier: "c14n999999",
      category: "subjects",
    },
  ],
  named.nquads,
  "Unknown primary correspondence handle",
  { kind: "extra-unused-correspondence-record" },
);
add(
  "missing-correspondence-handle",
  named,
  named.ids.slice(1),
  named.nquads,
  "Primary correspondence must cover the exact source handles",
  { kind: "omit-first-correspondence-record" },
  false,
);
add(
  "duplicate-correspondence-handle",
  named,
  [...named.ids, named.ids[0]],
  named.nquads,
  "Duplicate primary correspondence handle",
  { kind: "repeat-first-correspondence-record" },
  false,
);
const shared = structuredClone(named.ids);
shared[1].rdfcIdentifier = shared[0].rdfcIdentifier;
add(
  "shared-primary-canonical-node",
  named,
  shared,
  named.nquads,
  "Shared primary canonical node",
  { kind: "reuse-first-primary-node-for-second-handle" },
  false,
);
const sourceArtifacts = await Promise.all(
  ["support.mjs", "template-audit.mjs", "derive.mjs"].map((name) =>
    filePin(`${prefix}${name}`),
  ),
);
const entries = [];
for (const control of controls) {
  const files = {
    ids: await pin(`controls/${control.id}/ids.json`, json(control.ids)),
    nquads: await pin(`controls/${control.id}/canonical.nq`, control.nquads),
  };
  entries.push({
    id: control.id,
    sourceFixture: control.fixture.vector.fixture,
    source: control.fixture.vector.source,
    originalIds: control.fixture.vector.ids,
    originalNQuads: control.fixture.vector.canonicalNQuads,
    profile: control.fixture.profile,
    files,
    change: control.change,
    predecessorAccepted: control.acceptedByV1,
    correctedRejected: true,
    expectedCheckerError: control.rejection,
  });
}
await pin(
  "controls-manifest.json",
  json({
    format: "canonical-vowl-independent-template-auditor-controls/2",
    predecessor,
    sourceArtifacts,
    policy:
      "These invalid RDF/correspondence mutations target the independent proof checker only. ERR_ASSERTION and its exact invariant message are private checker evidence, not public Canonical VOWL rejection codes. No product operation or producer result is used to choose the invalidity.",
    vectors: entries,
  }),
);
await pin(
  "template-audit-evidence.json",
  json({
    format: "canonical-vowl-complete-template-audit/2",
    predecessor,
    sourceArtifacts,
    normativeBasis: [
      "A6.1: fixed named m:root",
      "A6.2: primary category follows the containing source collection",
      "A6.2: every other primary, embedded, collection and sequence-slot allocation is a fresh blank node",
    ],
    corrections: [
      "Expected primary RDF types derive from source collections. ids.json supplies handle-to-canonical-node lookup; metadata categories are independently checked against the source.",
      "Exact source-handle and unique canonical-node coverage is checked.",
      "The fixed document root is the only permitted named allocated node. All other owned nodes must be blank, including objects, sets, sequences and slots.",
    ],
    counts: {
      positiveModels: vectors.length,
      quads: vectors.reduce((sum, item) => sum + item.quads, 0),
      adversarialControls: entries.length,
      previouslyAcceptedControls: entries.filter(
        (item) => item.predecessorAccepted,
      ).length,
    },
    vectors,
    controls: await filePin(`${prefix}controls-manifest.json`),
    unchanged:
      "Every original source, canonical JSON, canonical N-Quads, ID correspondence, earlier auditor, evidence and provenance file is preserved. All positive audit results are equal to v1 after the stronger checks; this corrects proof strength, not golden graph contents.",
  }),
);
console.log(
  JSON.stringify({
    positives: vectors.length,
    adversarialControls: controls.length,
    previouslyAcceptedControls: controls.filter((item) => item.acceptedByV1)
      .length,
    goldenChanges: 0,
  }),
);
