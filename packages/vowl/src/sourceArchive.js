import { fail } from "./errors.js";
import { optionRecord } from "./resourceBudget.js";
import { snapshotBytes, snapshotSource, deepFreeze } from "./snapshot.js";
import { validateFields } from "./typedValues.js";

const ontologyIdentity = {
  fields: { iri: "IRI", versionIri: "IRI" },
  optional: ["iri", "versionIri"],
};

const evidenceFields = [
  "documents",
  "imports",
  "diagnostics",
  "assessment",
  "profileViolations",
  "projectionDiagnostics",
  "coverage",
];
function exact(value, names) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    names.some((name) => !Object.hasOwn(value, name))
  ) {
    fail("CHECKPOINT_INVALID");
  }
}
async function hash(bytes, budget) {
  budget.check();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  budget.check();
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate archive references and declared bytes; these historical reports are not admission authority. */
function validateEvidence(evidence, budget) {
  exact(evidence, evidenceFields);
  for (const name of [
    "documents",
    "imports",
    "diagnostics",
    "profileViolations",
    "projectionDiagnostics",
  ]) {
    if (!Array.isArray(evidence[name])) {
      fail("CHECKPOINT_INVALID");
    }
  }
  const ids = new Set();
  const iris = new Set();
  for (const document of evidence.documents) {
    budget.check();
    exact(document, [
      "id",
      "documentIri",
      "mediaType",
      "digest",
      "formatKey",
      "ontologyIdentity",
      "parserMetadata",
    ]);
    if (
      ["id", "documentIri", "mediaType"].some(
        (key) => typeof document[key] !== "string" || !document[key],
      ) ||
      typeof document.digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(document.digest) ||
      (document.formatKey !== null && typeof document.formatKey !== "string") ||
      ids.has(document.id) ||
      iris.has(document.documentIri)
    ) {
      fail("CHECKPOINT_INVALID");
    }
    ids.add(document.id);
    iris.add(document.documentIri);
    validateFields(
      snapshotSource(document.ontologyIdentity, budget),
      ontologyIdentity,
      budget,
    );
    const metadata = document.parserMetadata;
    if (metadata !== null) {
      exact(metadata, [
        "tripleCount",
        "headerState",
        "unparsedTriples",
        "guessedDeclarations",
      ]);
      if (
        !Number.isSafeInteger(metadata.tripleCount) ||
        metadata.tripleCount < 0 ||
        ![
          "PARSED_ZERO_HEADERS",
          "PARSED_ONE_HEADER",
          "PARSED_MULTIPLE_HEADERS",
        ].includes(metadata.headerState) ||
        !Array.isArray(metadata.unparsedTriples) ||
        !Array.isArray(metadata.guessedDeclarations)
      ) {
        fail("CHECKPOINT_INVALID");
      }
      for (const triple of metadata.unparsedTriples) {
        budget.check();
        exact(triple, ["subject", "predicate", "object"]);
        term(triple.subject, ["NamedNode", "BlankNode"]);
        term(triple.predicate, ["NamedNode"]);
        term(triple.object, ["NamedNode", "BlankNode", "Literal"]);
      }
      for (const declaration of metadata.guessedDeclarations) {
        budget.check();
        exact(declaration, ["iri", "entityType"]);
        exact(declaration.iri, ["kind", "value"]);
        if (
          declaration.iri.kind !== "IRI" ||
          typeof declaration.iri.value !== "string" ||
          typeof declaration.entityType !== "string"
        ) {
          fail("CHECKPOINT_INVALID");
        }
      }
    }
  }
  if (!ids.size) {
    fail("CHECKPOINT_INVALID");
  }
  for (const edge of evidence.imports) {
    budget.check();
    exact(edge, ["parentDocument", "requestedIri", "targetDocument"]);
    if (
      !ids.has(edge.parentDocument) ||
      typeof edge.requestedIri !== "string" ||
      !edge.requestedIri ||
      (edge.targetDocument !== null && !ids.has(edge.targetDocument))
    ) {
      fail("CHECKPOINT_INVALID");
    }
  }
  for (const entry of evidence.diagnostics) {
    exact(entry, ["documentIri", "diagnostic"]);
    if (!iris.has(entry.documentIri)) {
      fail("CHECKPOINT_INVALID");
    }
    diagnostic(entry.diagnostic);
  }
  exact(evidence.assessment, [
    "status",
    "violations",
    "unverifiedChecks",
    "qualifications",
  ]);
  if (
    !["valid", "invalid", "unverified"].includes(evidence.assessment.status)
  ) {
    fail("CHECKPOINT_INVALID");
  }
  for (const entries of [
    evidence.profileViolations,
    evidence.projectionDiagnostics,
    evidence.assessment.violations,
    evidence.assessment.unverifiedChecks,
    evidence.assessment.qualifications,
  ]) {
    if (!Array.isArray(entries)) {
      fail("CHECKPOINT_INVALID");
    }
    for (const entry of entries) {
      budget.check();
      diagnostic(entry);
    }
  }
  exact(evidence.coverage, [
    "basis",
    "represented",
    "qualified",
    "excluded",
    "unrepresented",
  ]);
  if (
    evidence.coverage.basis !== "unavailable" ||
    ["represented", "qualified", "excluded", "unrepresented"].some(
      (key) => evidence.coverage[key] !== null,
    )
  ) {
    fail("CHECKPOINT_INVALID");
  }
}

function diagnostic(value) {
  // Owning diagnostics remain historical data, not a current support claim.
  // Residual quads receive a closed term check before retention or edit guards.
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.code !== "string" ||
    !value.code
  ) {
    fail("CHECKPOINT_INVALID");
  }
  if (value.code === "RDF_UNCONSUMED_TRIPLE") {
    exact(value.quad, ["subject", "predicate", "object", "graph"]);
    term(value.quad.subject, ["NamedNode", "BlankNode"]);
    term(value.quad.predicate, ["NamedNode"]);
    term(value.quad.object, ["NamedNode", "BlankNode", "Literal"]);
    term(value.quad.graph, ["NamedNode", "BlankNode", "DefaultGraph"]);
    if (
      value.quad.graph.termType === "DefaultGraph" &&
      value.quad.graph.value !== ""
    ) {
      fail("CHECKPOINT_INVALID");
    }
  }
}
function term(value, kinds) {
  if (
    !value ||
    !kinds.includes(value.termType) ||
    typeof value.value !== "string"
  ) {
    fail("CHECKPOINT_INVALID");
  }
  if (value.termType === "Literal") {
    exact(value, [
      "termType",
      "value",
      "language",
      "datatype",
      ...(Object.hasOwn(value, "direction") ? ["direction"] : []),
    ]);
    term(value.datatype, ["NamedNode"]);
    if (
      typeof value.language !== "string" ||
      (Object.hasOwn(value, "direction") &&
        !["ltr", "rtl", ""].includes(value.direction))
    ) {
      fail("CHECKPOINT_INVALID");
    }
  } else {
    exact(value, ["termType", "value"]);
  }
}

function ownedArchive(evidence, sources) {
  deepFreeze(evidence);
  return Object.freeze({
    evidence,
    readBytes(id, budget) {
      const bytes = sources.get(id);
      if (!bytes) {
        fail("SOURCE_DOCUMENT_UNKNOWN");
      }
      budget?.check();
      budget?.bound("inputBytes", bytes.byteLength);
      return new Uint8Array(bytes);
    },
    checkpoint(budget) {
      const entries = [];
      for (const [document, bytes] of sources) {
        budget.check();
        entries.push(
          Object.freeze({ document, bytes: snapshotBytes(bytes, budget) }),
        );
      }
      // Typed arrays are defensive copies, not frozen buffers or ownership tokens.
      return Object.freeze({
        version: 1,
        evidence: deepFreeze(snapshotSource(evidence, budget)),
        sources: Object.freeze(entries),
      });
    },
  });
}

/** Adapter-only ownership handoff after the original acquisition and digest checks. */
export function ownSourceArchive(evidence, sources, budget) {
  validateEvidence(evidence, budget);
  return ownedArchive(evidence, sources);
}

/** Admit a source archive without parsing, network acquisition or canonicalization. */
export async function readmitSourceArchive(input, budget) {
  const raw = optionRecord(input, ["version", "evidence", "sources"]);
  exact(raw, ["version", "evidence", "sources"]);
  if (raw.version !== 1) {
    fail("CHECKPOINT_VERSION_UNSUPPORTED");
  }
  const evidence = snapshotSource(raw.evidence, budget);
  validateEvidence(evidence, budget);
  if (
    !Array.isArray(raw.sources) ||
    raw.sources.length !== evidence.documents.length
  ) {
    fail("CHECKPOINT_INVALID");
  }
  const sources = new Map();
  const descriptors = Object.getOwnPropertyDescriptors(raw.sources);
  if (Reflect.ownKeys(descriptors).length !== raw.sources.length + 1) {
    fail("CHECKPOINT_INVALID");
  }
  for (let index = 0; index < raw.sources.length; index++) {
    budget.check();
    const descriptor = descriptors[index];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      fail("CHECKPOINT_INVALID");
    }
    const entry = optionRecord(descriptor.value, ["document", "bytes"]);
    exact(entry, ["document", "bytes"]);
    if (typeof entry.document !== "string" || sources.has(entry.document)) {
      fail("CHECKPOINT_INVALID");
    }
    sources.set(entry.document, snapshotBytes(entry.bytes, budget));
  }
  for (const document of evidence.documents) {
    const bytes = sources.get(document.id);
    if (!bytes || (await hash(bytes, budget)) !== document.digest) {
      fail("CHECKPOINT_INVALID");
    }
  }
  return ownedArchive(evidence, sources);
}
