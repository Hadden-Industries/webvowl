// SPDX-License-Identifier: AGPL-3.0-only
// Synthetic checker controls, not an OWL adapter and not product execution evidence.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import canonicalize from "canonicalize";
import { assertAdapterRun } from "./assert-adapter.mjs";
import { loadCorpus } from "./catalog.mjs";
import { json, localPin, pin, readPinned } from "./support.mjs";

const corpus = await loadCorpus();
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
async function synthetic(vector, run, mutation) {
  return {
    encode: (document) => Buffer.from(canonicalize(document)),
    fromOwl: async (_bytes, options) => {
      for (const context of vector.resolverContexts ?? []) {
        await options.resolveImport(context.importIri, {
          importingDocumentIri:
            mutation === "resolver-context"
              ? "urn:wrong-document"
              : context.importingDocumentIri,
          signal: new AbortController().signal,
        });
      }
      if (run.outcome === "error")
        throw Object.assign(new Error("synthetic expected rejection"), {
          code:
            mutation === "wrong-error" ? "MAPPING_AMBIGUOUS" : run.errorCode,
        });
      const document = JSON.parse(
        await readPinned(vector.expected["canonical.json"]),
      );
      const diagnostics = run.diagnostics.map((condition) => ({
        code: condition.code,
        severity: "warning",
        ...(condition.subject ? { subject: condition.subject } : {}),
        details: `Fixture-controlled diagnostic ${condition.sourceConstructor ?? condition.restrictionIdentifier ?? condition.code}`,
      }));
      diagnostics.sort((a, b) =>
        Buffer.compare(
          Buffer.from(canonicalize(a)),
          Buffer.from(canonicalize(b)),
        ),
      );
      const result = {
        document,
        mappingProfile: run.mappingProfile,
        diagnostics,
      };
      if (mutation === "bytes")
        document.structural.ontology.imports.push("urn:unexpected-import");
      if (mutation === "profile") result.mappingProfile = "urn:wrong-profile";
      if (mutation === "missing-diagnostic") diagnostics.pop();
      if (mutation === "constructor-substring") {
        const target = diagnostics.find((entry) =>
          entry.details.endsWith(" ObjectPropertyAssertion"),
        );
        target.details =
          "Fixture-controlled positive-position NegativeObjectPropertyAssertion";
        diagnostics.sort((a, b) =>
          Buffer.compare(
            Buffer.from(canonicalize(a)),
            Buffer.from(canonicalize(b)),
          ),
        );
      }
      if (mutation === "duplicate-diagnostic")
        diagnostics.push(structuredClone(diagnostics[0]));
      if (mutation === "diagnostic-order") diagnostics.reverse();
      if (mutation === "unknown-code")
        diagnostics[0].code = "MAPPING_INVENTED_RECOVERY";
      if (mutation === "iri-in-details")
        for (const entry of diagnostics) {
          entry.details += ` <${entry.subject}>`;
          delete entry.subject;
        }
      return mutation === "mutable-result" ? result : freeze(result);
    },
  };
}
for (const { vector, run } of corpus.runs)
  await assertAdapterRun(await synthetic(vector, run), vector, run);
const positive = corpus.runs.find(
  ({ id }) => id === "declared-subclass/strict",
);
const excluded = corpus.runs.find(
  ({ id }) => id === "six-explicit-abox-exclusions/strict",
);
const imported = corpus.runs.find(
  ({ id }) => id === "closure-root-metadata-and-anonymous-apart/strict",
);
const syntax = corpus.runs.find(
  ({ id }) => id === "malformed-functional-syntax/strict",
);
const controls = [
  ...["bytes", "profile", "mutable-result"].map((mutation) => ({
    ...positive,
    mutation,
  })),
  ...[
    "missing-diagnostic",
    "constructor-substring",
    "duplicate-diagnostic",
    "diagnostic-order",
    "unknown-code",
  ].map((mutation) => ({ ...excluded, mutation })),
  { ...imported, mutation: "resolver-context" },
  { ...syntax, mutation: "wrong-error" },
];
for (const { vector, run, mutation } of controls)
  await assert.rejects(
    assertAdapterRun(await synthetic(vector, run, mutation), vector, run),
  );
const optionalSubject = corpus.runs.find(
  ({ id }) => id === "unresolved-authored-import/default",
);
await assertAdapterRun(
  await synthetic(
    optionalSubject.vector,
    optionalSubject.run,
    "iri-in-details",
  ),
  optionalSubject.vector,
  optionalSubject.run,
);
const receipt = await pin(
  "assertion-controls.json",
  json({
    scope:
      "Synthetic assertion-checker controls only; these counts do not claim real parser or adapter executions.",
    syntheticPositiveChecks: corpus.runs.length + 1,
    rejectedMutations: controls.map(({ id, mutation }) => ({ id, mutation })),
    producerSources: await Promise.all(
      ["assert-adapter.mjs", "catalog.mjs", "check-assertions.mjs"].map(
        localPin,
      ),
    ),
  }),
);
console.log(
  JSON.stringify(
    {
      checkerReceipt: receipt,
      syntheticChecks: corpus.runs.length + 1,
      rejectedMutations: controls.length,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
