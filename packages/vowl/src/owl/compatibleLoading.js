import { OWL2DLProfile } from "owlapi/profiles";
import { OWLDocumentFormats } from "owlapi/formats";
import { fail } from "../errors.js";
import { loadClosure, waitForResult } from "./loading.js";
import { buildModel } from "./modelBuilder.js";
import { snapshotSource } from "../snapshot.js";
import { retainCompatibleEvidence } from "./sourceEvidence.js";

/** Prepare typed retained content without treating a profile assessment as view admission. */
export async function prepareCompatibleView(bytes, context, options, budget) {
  const prepared = await loadCompatibleClosure(bytes, context, options, budget);
  const startedAt = performance.now();
  const projectionDiagnostics = [];
  const diagnostic = (code, details, subject, evidence) => {
    projectionDiagnostics.push(
      snapshotSource(
        {
          diagnostic: {
            code,
            severity: "warning",
            details,
            ...(subject === undefined ? {} : { subject }),
            ...(evidence === undefined ? {} : { evidence }),
          },
        },
        budget,
      ).diagnostic,
    );
  };
  const source = buildModel(prepared.loaded, budget, {
    diagnostic,
    recover: diagnostic,
  });
  budget.check();
  const result = { ...prepared, source, projectionDiagnostics };
  const retained = await retainCompatibleEvidence(result, budget);
  performance.measure("webvowl.owl-retention", {
    start: startedAt,
    end: performance.now(),
  });
  budget.check();
  return { ...result, retained };
}

/**
 * Internal compatible ingress preparation, not live/canonical admission.
 * The owning parser interprets OWL; assessments qualify that interpretation.
 * The caller retains this operation budget through later model/evidence admission.
 */
export async function loadCompatibleClosure(bytes, context, options, budget) {
  const sourceDocuments = [];
  const diagnostics = [];
  const loaded = await loadClosure(bytes, context, options, budget, {
    parsingMode: "compatible",
    strict: false,
    observeSource(sourceBytes, sourceContext, acquisition = null) {
      budget.check();
      sourceDocuments.push({
        documentIri: sourceContext.documentIRI.value,
        mediaType: sourceContext.contentType,
        acquisition,
        // Already copied and charged by the common acquisition boundary.
        bytes: sourceBytes,
      });
    },
    observeDiagnostic(diagnostic, sourceContext) {
      budget.check();
      diagnostics.push({
        documentIri: sourceContext.documentIRI.value,
        diagnostic,
      });
    },
  });
  const startedAt = performance.now();
  const report = await waitForResult(
    new OWL2DLProfile().checkOntology(loaded.ontology, {
      sourceAssessment: true,
      signal: budget.signal,
      maxDepth: budget.limits.depth,
      maxLiteralLength: budget.limits.stringBytes,
      maxNumericDigits: Math.min(65536, budget.limits.stringBytes),
      maxWork: Math.min(1000000, budget.limits.embeddedValues * 2),
      timeoutMs: Math.max(1, Math.ceil(budget.deadline - performance.now())),
    }),
    budget,
  );
  performance.measure("webvowl.owl-assessment", {
    start: startedAt,
    end: performance.now(),
  });
  const assessment = report.getSourceAssessment();
  if (
    !assessment ||
    !["valid", "invalid", "unverified"].includes(assessment.status)
  ) {
    fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-validation" });
  }
  for (const entry of [
    ...report.getViolations(),
    ...assessment.violations,
    ...assessment.unverifiedChecks,
  ]) {
    budget.check();
    if (entry.code === "RESOURCE_LIMIT_EXCEEDED") {
      fail("MODEL_RESOURCE_LIMIT", undefined, {
        stage: "owl-validation",
        resource: entry.resource,
      });
    }
  }
  const documents = loaded.documents.map(
    ({ ontology, context: documentContext }) => {
      budget.check();
      const format = loaded.manager.getOntologyFormat(ontology);
      return {
        ontology,
        documentIri: documentContext.documentIRI.value,
        formatKey: format?.key ?? null,
        mediaType: Object.values(OWLDocumentFormats).find(
          ({ key }) => key === format?.key,
        )?.mediaTypes[0],
        // Public historical evidence, not proof of exhaustive source preservation.
        parserMetadata: format?.getOntologyLoaderMetaData() ?? null,
      };
    },
  );
  budget.check();
  return {
    loaded,
    sourceDocuments,
    documents,
    diagnostics,
    report,
    assessment,
  };
}
