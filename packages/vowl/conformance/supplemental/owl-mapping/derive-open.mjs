// SPDX-License-Identifier: AGPL-3.0-only
// Deliberately not active stable-code goldens: rejection is settled, dispatch is not.
import process from "node:process";
import { NS, OWL, RDF, RDFS } from "./seed-cases.mjs";
import { json, localPin, pin } from "./support.mjs";
const prefix = `@prefix : <${NS}> .\n@prefix owl: <${OWL}> .\n@prefix rdf: <${RDF}> .\n@prefix rdfs: <${RDFS}> .\n`;
const examples = [
  {
    id: "malformed-rdf-list",
    text:
      prefix +
      ":A a owl:Class ; owl:unionOf _:list .\n:B a owl:Class .\n_:list rdf:first :B .\n",
    reason:
      "Missing rdf:rest makes the OWL list malformed even though Turtle tokenization succeeds.",
  },
  {
    id: "cyclic-rdf-expression",
    text:
      prefix +
      ":A a owl:Class ; rdfs:subClassOf _:cycle .\n_:cycle a owl:Class ; owl:complementOf _:cycle .\n",
    reason:
      "The class-expression expansion is cyclic and cannot become an A3 acyclic retained expression graph.",
  },
];
const vectors = [];
for (const example of examples)
  vectors.push({
    id: example.id,
    root: {
      bytes: await pin(`open/${example.id}.ttl`, example.text),
      mediaType: "text/turtle",
      documentIri: `https://documents.example/${example.id}`,
    },
    rules: ["A9.1", "A9.2", "A3"],
    mustRejectInBothProfiles: true,
    stableCodeStatus: "unclosed",
    reason: example.reason,
    missingDecision:
      "A9 mandates rejection, but the source text alone does not decide whether this owning parse fails before a structural object exists (MAPPING_SYNTAX_INVALID) or reports an unconstructible/ambiguous retained source. The independently reviewed adapter error-dispatch contract must settle its stable code before this becomes an active acceptance vector.",
  });
const receipt = await pin(
  "open-cases.json",
  json({
    status:
      "Explicit open cases, excluded from active success/error-code coverage counts",
    producer: await localPin("derive-open.mjs"),
    vectors,
    additionalGaps: [
      "Only three selected syntaxes have positive cross-syntax witnesses; no exhaustive owning parser qualification is claimed.",
      "Active omission/exclusion fixtures explicitly declare named roles to avoid selecting the unresolved use-only signature-retention policy.",
      "Known nonrecoverable semantic failures such as reserved vocabulary and invalid facets need the reviewed stable dispatch before code-specific vectors are frozen.",
      "Resolver cancellation, shared aggregate byte limits, hostile buffers/accessors and deadline boundaries are adapter security/resource work, not covered by these bounded semantic seeds.",
    ],
  }),
);
console.log(
  JSON.stringify(
    {
      openCases: vectors.length,
      manifest: receipt,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
