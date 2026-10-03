import { fail } from "./errors.js";
import { walkTyped } from "./typedValues.js";
import { resolveDescriptor } from "./modelContract.js";
import {
  retainSourceStatements,
  sourceStatementUncertainty,
} from "./retainedSourceStatements.js";

export const compatibleViewPolicy =
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1";
export const sourceMappingRule = `${compatibleViewPolicy}#typed-owl-model`;
// Owning RC1 literal-assessment rules; profile membership remains a separate axis.
export const lexicalAssessmentRules = new Set([
  "LITERAL_LEXICAL_SPACE",
  "LITERAL_UNICODE",
  "LITERAL_LANGUAGE",
  "LITERAL_LANGUAGE_DATATYPE",
  "PLAIN_LITERAL_LEXICAL_SPACE",
  "DATATYPE_HAS_NO_LEXICAL_SPACE",
  "XML_LITERAL_NOT_CANONICAL",
  "XML_VALIDATOR_UNAVAILABLE",
  "XML_LITERAL_NOT_WELL_FORMED",
  "DATATYPE_NOT_IN_SUPPORTED_MAP",
  "LITERAL_XML_CHARACTER",
  "DATATYPE_RULE_UNIMPLEMENTED",
]);

/** Inspection reports original acquisition/assessment, never invented statement provenance. */
export function inspectSource(state, archive, budget) {
  const evidence = archive.evidence;
  const documents = evidence.documents.map((document) => ({
    id: document.id,
    documentIri: document.documentIri,
    baseIri: document.documentIri,
    mediaType: document.mediaType,
    digest: document.digest,
    headers: [],
    bytesAvailable: true,
  }));
  const ids = documents.map(({ id }) => id);
  const byIri = new Map(
    documents.map(({ id, documentIri }) => [documentIri, id]),
  );
  const qualifications = [];
  const diagnostics = [];
  const recordsByIri = new Map();
  for (const subject of state.structural.subjects) {
    budget.check();
    if (subject.iri) {
      recordsByIri.set(subject.iri, [subject.id]);
    }
  }
  const subjects = new Map(
    state.structural.subjects.map((subject) => [subject.id, subject]),
  );
  for (const role of state.structural.roles) {
    budget.check();
    recordsByIri.get(subjects.get(role.subject)?.iri)?.push(role.id);
  }
  function report(
    code,
    dimension,
    message,
    documentIds,
    records = [],
    rule = "ingress-assessment",
    severity = "warning",
  ) {
    budget.charge("embeddedValues", 2);
    const id = `qualification:${qualifications.length}`;
    qualifications.push({
      id,
      dimension,
      code,
      records,
      assertions: [],
      documents: documentIds,
      rule: `${compatibleViewPolicy}#${rule}`,
    });
    const diagnosticId = `diagnostic:${diagnostics.length}`;
    diagnostics.push({
      id: diagnosticId,
      code,
      severity,
      message,
      qualifications: [id],
      records,
      assertions: [],
      documents: documentIds,
    });
    return diagnosticId;
  }
  report(
    "SOURCE_ASSOCIATIONS_UNAVAILABLE",
    "scope",
    "The source bytes and parser reports are retained; exhaustive statement-to-record provenance is unavailable.",
    ids,
  );
  const parserDiagnostics = evidence.diagnostics.map(
    ({ documentIri, diagnostic }) => {
      budget.check();
      const records = [
        ...new Set(
          [
            diagnostic.iri,
            diagnostic.subProperty,
            diagnostic.superProperty,
          ].flatMap((iri) => recordsByIri.get(iri) ?? []),
        ),
      ];
      return report(
        diagnostic.code,
        diagnostic.code === "MISSING_IMPORT" ? "closure" : "interpretation",
        typeof diagnostic.message === "string"
          ? diagnostic.message
          : diagnostic.code,
        [byIri.get(documentIri)],
        records,
        "owning-compatible-interpretation",
        diagnostic.severity === "error"
          ? "error"
          : diagnostic.severity === "information"
            ? "information"
            : "warning",
      );
    },
  );
  for (const issue of evidence.profileViolations) {
    budget.check();
    report(
      issue.code,
      "profile",
      `Original OWL profile assessment: ${issue.code}.`,
      ids,
      recordsByIri.get(issue.iri) ?? [],
    );
  }
  for (const [status, issues] of [
    ["invalid", evidence.assessment.violations],
    ["unverified", evidence.assessment.unverifiedChecks],
    ["qualified", evidence.assessment.qualifications],
  ]) {
    for (const issue of issues) {
      budget.check();
      const dimension = lexicalAssessmentRules.has(issue.code)
        ? "lexical"
        : issue.code === "IMPORT_CLOSURE_INCOMPLETE"
          ? "closure"
          : ["SOURCE_EVIDENCE_STALE", "SOURCE_EVIDENCE_UNVERIFIED"].includes(
                issue.code,
              )
            ? "scope"
            : "profile";
      report(
        issue.code,
        dimension,
        `Original source assessment (${status}): ${issue.code}.`,
        ids,
        recordsByIri.get(issue.iri) ?? [],
        `ingress-source-assessment-${status}`,
      );
    }
  }
  for (const issue of evidence.projectionDiagnostics) {
    report(
      issue.code,
      "scope",
      typeof issue.details === "string" ? issue.details : issue.code,
      ids,
      [],
      "retained-projection",
    );
  }
  for (const document of evidence.documents) {
    const count = document.parserMetadata?.unparsedTriples.length ?? 0;
    if (count) {
      report(
        "SOURCE_TRIPLES_UNREPRESENTED",
        "scope",
        `${count} source triples were not represented by the owning OWL reconstruction.`,
        [document.id],
      );
    }
  }
  const imports = evidence.imports.map((edge, index) => ({
    id: `import:${index}`,
    parentDocument: edge.parentDocument,
    header: null,
    requestedIri: edge.requestedIri,
    targetDocument: edge.targetDocument,
    state: edge.targetDocument === null ? "unavailable" : "acquired",
    diagnostics: evidence.diagnostics.flatMap(
      ({ documentIri, diagnostic }, index) =>
        byIri.get(documentIri) === edge.parentDocument &&
        diagnostic.code === "MISSING_IMPORT" &&
        diagnostic.importIRI?.value === edge.requestedIri
          ? [parserDiagnostics[index]]
          : [],
    ),
  }));
  return {
    ...retainSourceStatements(evidence, budget),
    documents,
    imports,
    assertions: [],
    qualifications,
    diagnostics,
    coverage: evidence.coverage,
  };
}

/** Restrict edits only where their target depends on unresolved source interpretation. */
export function guardSourceEdit(state, archive, changes, budget) {
  const retained = retainSourceStatements(archive.evidence, budget);
  const { iris: uncertainIris, anonymous: anonymousUncertainty } =
    sourceStatementUncertainty(retained.sourceStatements, budget);
  for (const { diagnostic } of archive.evidence.diagnostics) {
    budget.check();
    if (diagnostic.evidence === "precedence" && diagnostic.iri) {
      uncertainIris.add(diagnostic.iri);
    }
  }
  guardUncertainSourceEdits(
    state,
    changes,
    uncertainIris,
    anonymousUncertainty,
    budget,
  );
}

export function guardUncertainSourceEdits(
  state,
  changes,
  uncertainIris,
  anonymousUncertainty,
  budget,
) {
  const affected = new Set(
    state.structural.subjects
      .filter(
        (subject) =>
          uncertainIris.has(subject.iri) ||
          (!subject.iri && anonymousUncertainty),
      )
      .map(({ id }) => id),
  );
  if (!affected.size && !uncertainIris.size) {
    return;
  }
  const dependents = new Map();
  const shapes = resolveDescriptor("Structural").fields;
  for (const collection of ["subjects", "roles", "expressions", "constructs"]) {
    for (const record of state.structural[collection]) {
      walkTyped(record, shapes[collection].items, (value, shape) => {
        budget.check();
        if (shape?.reference) {
          budget.charge("embeddedValues");
          if (!dependents.has(value)) {
            dependents.set(value, []);
          }
          dependents.get(value).push(record.id);
        }
      });
    }
  }
  const pending = [...affected];
  while (pending.length) {
    budget.check();
    for (const id of dependents.get(pending.pop()) ?? []) {
      if (!affected.has(id)) {
        affected.add(id);
        pending.push(id);
      }
    }
  }
  for (const change of changes) {
    budget.check();
    if (
      affected.has(change.id ?? change.construct) ||
      affected.has(change.target)
    ) {
      fail("EDIT_SOURCE_DEPENDENCY_UNRESOLVED", "/changes");
    }
    if (change.record) {
      const collection =
        change.collection ??
        ["subjects", "roles", "expressions", "constructs"].find((name) =>
          state.structural[name].some(({ id }) => id === change.id),
        ) ??
        changes.find(
          (request) =>
            request.kind === "insert" && request.record.id === change.id,
        )?.collection;
      if (collection === "subjects" && uncertainIris.has(change.record.iri)) {
        fail("EDIT_SOURCE_DEPENDENCY_UNRESOLVED", "/changes");
      }
      walkTyped(change.record, shapes[collection].items, (value, shape) => {
        budget.check();
        if (shape?.reference && affected.has(value)) {
          fail("EDIT_SOURCE_DEPENDENCY_UNRESOLVED", "/changes");
        }
      });
    }
  }
}
