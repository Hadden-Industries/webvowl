import { fail } from "./errors.js";
import { jsonKey } from "./canonicalJson.js";
import { snapshotSource } from "./snapshot.js";
import { retainSourceStatements } from "./retainedSourceStatements.js";
import {
  compatibleViewPolicy,
  lexicalAssessmentRules,
} from "./sourceInspection.js";

/** Select a closed portable view of original evidence, excluding bytes and prose. */
export function portableQualifications(state, archive, budget) {
  const evidence = archive.evidence;
  const root = evidence.documents.find(
    ({ digest }) => digest === state.origin.inputDigest,
  );
  if (!root) {
    fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
  }
  const documents = evidence.documents.map((document) => ({
    id: document.id,
    root: document === root,
    ...(document.ontologyIdentity.iri
      ? { ontologyIri: document.ontologyIdentity.iri }
      : {}),
    ...(document.ontologyIdentity.versionIri
      ? { versionIri: document.ontologyIdentity.versionIri }
      : {}),
    headers:
      document.parserMetadata === null
        ? "unavailable"
        : {
            PARSED_ZERO_HEADERS: "none",
            PARSED_ONE_HEADER: "one",
            PARSED_MULTIPLE_HEADERS: "multiple",
          }[document.parserMetadata.headerState],
  }));
  const documentIds = documents.map(({ id }) => id);
  const byDocument = new Map(
    evidence.documents.map(({ id, documentIri }) => [documentIri, id]),
  );
  const byIri = new Map(
    state.structural.subjects
      .filter(({ iri }) => iri)
      .map(({ id, iri }) => [iri, [id]]),
  );
  const subjects = new Map(
    state.structural.subjects.map((subject) => [subject.id, subject]),
  );
  for (const role of state.structural.roles) {
    byIri.get(subjects.get(role.subject)?.iri)?.push(role.id);
  }
  const entries = [];
  const seen = new Set();
  function add(
    code,
    dimension,
    detail,
    docs = documentIds,
    iris = [],
    rule = "original-assessment",
  ) {
    budget.charge("embeddedValues");
    const entry = {
      code,
      dimension,
      detail,
      documents: [...new Set(docs)].sort(),
      records: [...new Set(iris.flatMap((iri) => byIri.get(iri) ?? []))].sort(),
      rule: `${compatibleViewPolicy}#${rule}`,
    };
    const key = jsonKey(entry);
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({
        id: `portable:qualification:${entries.length}`,
        ...entry,
      });
    }
  }
  add("SOURCE_ASSOCIATIONS_UNAVAILABLE", "scope", { kind: "scope" });
  add("SOURCE_HEADER_ASSOCIATIONS_UNAVAILABLE", "scope", { kind: "scope" });
  const retainedSource = retainSourceStatements(evidence, budget);
  for (const { documentIri, diagnostic } of evidence.diagnostics) {
    const docs = [byDocument.get(documentIri)];
    if (diagnostic.code === "RDF_MULTIPLE_ONTOLOGY_HEADERS") {
      add(
        diagnostic.code,
        "interpretation",
        {
          kind: "headers",
          candidates: [...new Set(diagnostic.candidateOntologyIRIs)].sort(),
          selected: diagnostic.selectedOntologyIRI,
        },
        docs,
        [],
        "owning-header-selection",
      );
    } else if (diagnostic.code === "MISSING_IMPORT") {
      add(
        diagnostic.code,
        "closure",
        { kind: "import", requestedIri: diagnostic.importIRI.value },
        docs,
        [],
        "import-acquisition",
      );
    } else if (diagnostic.code === "RDF_UNCONSUMED_TRIPLE") {
      const statements = retainedSource.sourceStatements
        .filter((statement) => statement.document === docs[0])
        .map(({ id }) => id);
      if (!statements.length) {
        fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
      }
      add(
        diagnostic.code,
        "scope",
        { kind: "source-statements", statements },
        docs,
        [],
        "owning-compatible-interpretation",
      );
    } else {
      const detail = { kind: "property" };
      for (const key of [
        "iri",
        "subProperty",
        "superProperty",
        "declaredCategories",
        "existingCategories",
        "resolvedCategory",
        "requestedCategory",
        "evidence",
      ]) {
        if (Object.hasOwn(diagnostic, key)) {
          detail[key] = Array.isArray(diagnostic[key])
            ? [...new Set(diagnostic[key])].sort()
            : diagnostic[key];
        }
      }
      if (Object.keys(detail).length === 1) {
        fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
      }
      add(
        diagnostic.code,
        "interpretation",
        detail,
        docs,
        [diagnostic.iri, diagnostic.subProperty, diagnostic.superProperty],
        "owning-compatible-interpretation",
      );
    }
  }
  for (const [status, issues, rule] of [
    ["invalid", evidence.profileViolations, "original-profile-assessment"],
    ["invalid", evidence.assessment.violations, "original-source-assessment"],
    [
      "unverified",
      evidence.assessment.unverifiedChecks,
      "original-source-assessment",
    ],
    [
      "qualified",
      evidence.assessment.qualifications,
      "original-source-assessment",
    ],
  ]) {
    for (const issue of issues) {
      const detail = { kind: "assessment", status };
      for (const key of ["iri", "datatype"]) {
        if (Object.hasOwn(issue, key)) {
          detail[key] = issue[key];
        }
      }
      if (Object.hasOwn(issue, "kind")) {
        detail.entityKind = issue.kind;
      }
      if (Object.hasOwn(issue, "count")) {
        detail.count = String(issue.count);
      }
      // Scope numbers are local owning handles, not durable document identities.
      // Attribution remains the assessed closure where finer evidence is unavailable.
      const dimension = lexicalAssessmentRules.has(issue.code)
        ? "lexical"
        : issue.code === "IMPORT_CLOSURE_INCOMPLETE"
          ? "closure"
          : issue.code.startsWith("SOURCE_EVIDENCE_")
            ? "scope"
            : "profile";
      add(
        issue.code,
        dimension,
        detail,
        documentIds,
        [issue.iri, issue.datatype],
        rule,
      );
    }
  }
  for (const issue of evidence.projectionDiagnostics) {
    if (!issue.evidence?.constructor) {
      fail("CAPTURE_QUALIFICATION_UNREPRESENTABLE");
    }
    add(
      issue.code,
      "scope",
      { kind: "exclusion", ...issue.evidence },
      documentIds,
      [],
      "retained-projection",
    );
  }
  const imports = evidence.imports.map((edge, index) => ({
    id: `portable:import:${index}`,
    parentDocument: edge.parentDocument,
    requestedIri: edge.requestedIri,
    ...(edge.targetDocument === null
      ? {}
      : { targetDocument: edge.targetDocument }),
    state: edge.targetDocument === null ? "unavailable" : "acquired",
  }));
  return snapshotSource(
    { documents, imports, entries, ...retainedSource },
    budget,
  );
}

export function inspectPortableQualifications(qualifications) {
  return {
    sourceNodes: qualifications.sourceNodes,
    sourceStatements: qualifications.sourceStatements,
    documents: qualifications.documents.map((document) => ({
      ...document,
      documentIri: null,
      baseIri: null,
      mediaType: null,
      digest: null,
      bytesAvailable: false,
    })),
    imports: qualifications.imports.map((edge) => ({
      ...edge,
      header: null,
      targetDocument: edge.targetDocument ?? null,
      diagnostics: [],
    })),
    qualifications: qualifications.entries.map((entry) => ({
      ...entry,
      assertions: [],
    })),
    diagnostics: qualifications.entries.map((entry, index) => ({
      id: `diagnostic:${index}`,
      code: entry.code,
      severity: "warning",
      message: `Saved original qualification: ${entry.code}.`,
      qualifications: [entry.id],
      records: entry.records,
      documents: entry.documents,
      assertions: [],
    })),
  };
}

export function canonicalSourceQualifications(state) {
  return {
    sourceNodes: [],
    sourceStatements: [],
    documents: [
      {
        id: "portable:document:root",
        root: true,
        headers: "unavailable",
        ...(state.structural.ontology.iri
          ? { ontologyIri: state.structural.ontology.iri }
          : {}),
        ...(state.structural.ontology.versionIri
          ? { versionIri: state.structural.ontology.versionIri }
          : {}),
      },
    ],
    imports: [],
    entries: [
      {
        id: "portable:qualification:scope",
        dimension: "scope",
        code: "ORIGINAL_SOURCE_UNAVAILABLE",
        records: [],
        documents: ["portable:document:root"],
        rule: `${compatibleViewPolicy}#canonical-source`,
        detail: { kind: "scope" },
      },
    ],
  };
}
