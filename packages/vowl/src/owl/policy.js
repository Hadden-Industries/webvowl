import { OWL2DLProfile } from "owlapi/profiles";
import { fail } from "../errors.js";
import { compareBytes, jsonBytes, jsonKey } from "../canonicalJson.js";
import { snapshotSource } from "../snapshot.js";
import { namespaces } from "../profiles.js";
import { waitForResult } from "./loading.js";
import { unsupportedQuantifier } from "./modelBuilder.js";

const prefix =
  "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/";
const strictProfile = prefix + "strict/v1";
const compatibilityProfile = prefix + "compatibility/v1";
// This list is OWL 2 section 11, not every rule checked by an OWL 2 DL checker.
const globalRestrictions = new Set([
  "TOP_DATA_PROPERTY_POSITION",
  "DATATYPE_DEFINITION_COUNT",
  "CYCLIC_DATATYPE_DEFINITION",
  "NONSIMPLE_OBJECT_PROPERTY",
  "IRREGULAR_PROPERTY_HIERARCHY",
  "ANONYMOUS_INDIVIDUAL_POSITION",
  "MULTIPLE_ANONYMOUS_EDGE_ASSERTIONS",
  "ANONYMOUS_GRAPH_NOT_FOREST",
  "ANONYMOUS_TREE_WITHOUT_ROOT",
]);
const collisions = new Set([
  "PROPERTY_CATEGORY_COLLISION",
  "CLASS_DATATYPE_COLLISION",
  "SOURCE_CLASS_DATATYPE_COLLISION",
]);
const illTyped = new Set([
  "LITERAL_LEXICAL_SPACE",
  "PLAIN_LITERAL_LEXICAL_SPACE",
  "DATATYPE_HAS_NO_LEXICAL_SPACE",
  "DEFINED_DATATYPE_LITERAL",
  "XML_LITERAL_NOT_CANONICAL",
  "XML_LITERAL_NOT_WELL_FORMED",
  "LITERAL_XML_CHARACTER",
]);
const invalidSource = new Set([
  "RESERVED_ONTOLOGY_IRI",
  "RESERVED_ENTITY_IRI",
  "RESERVED_SOURCE_ROLE_IRI",
  "DEFINED_DATATYPE_RESTRICTION",
  "FACET_VALUE_OUTSIDE_BASE_SPACE",
  "FACET_REQUIRES_NONNEGATIVE_INTEGER",
  "FACET_REQUIRES_XSD_PATTERN",
  "FACET_REQUIRES_BASIC_LANGUAGE_RANGE",
  "FACET_NOT_IN_DATATYPE_MAP",
  "LITERAL_UNICODE",
  "LITERAL_LANGUAGE",
  "LITERAL_LANGUAGE_DATATYPE",
  "SOURCE_ROLE_INVALID",
  "SOURCE_STATEMENT_INVALID",
  "SOURCE_STATEMENT_CATEGORY",
  "IRI_INVALID",
  "SET_CONSTRUCTOR_ARITY",
  "UNDECLARED_ENTITY",
  "STRUCTURAL_OBJECT_INVALID",
]);
const evidenceGaps = new Set([
  "XML_VALIDATOR_UNAVAILABLE",
  "DATATYPE_RULE_UNIMPLEMENTED",
  "SOURCE_EVIDENCE_STALE",
  "SOURCE_EVIDENCE_UNVERIFIED",
  "ONTOLOGY_CHANGED_DURING_CHECK",
]);

export function validateMappingProfile(selected) {
  const profile = selected === undefined ? compatibilityProfile : selected;
  if (![strictProfile, compatibilityProfile].includes(profile)) {
    fail("OPTION_INVALID", "/mappingProfile");
  }
  return profile;
}

export function mappingPolicy(selected, budget) {
  const profile = validateMappingProfile(selected);
  const strict = profile === strictProfile;
  const diagnostics = new Map();
  const diagnostic = (code, details, subject) => {
    const value = snapshotSource(
      {
        diagnostic: {
          code,
          severity: "warning",
          ...(subject === undefined ? {} : { subject }),
          details,
        },
      },
      budget,
    ).diagnostic;
    diagnostics.set(jsonKey(value), value);
  };
  return {
    profile,
    strict,
    diagnostic,
    recover(code, details, subject) {
      if (strict) {
        fail(code);
      }
      diagnostic(code, details, subject);
    },
    finish() {
      const values = [];
      for (const record of diagnostics.values()) {
        budget.check();
        values.push({ record, bytes: jsonBytes(record) });
      }
      values.sort((a, b) => {
        budget.check();
        return compareBytes(a.bytes, b.bytes);
      });
      return values.map(({ record }) => record);
    },
  };
}

function assessGenericRoles(loaded, budget, policy) {
  const { owl, rdf, rdfs } = namespaces;
  const named = new Map();
  for (const { context } of loaded.documents) {
    for (const role of context.sourceStructure.roles) {
      budget.check();
      if (role.iri === undefined) {
        continue;
      }
      if (!named.has(role.iri)) {
        named.set(role.iri, new Set());
      }
      named.get(role.iri).add(role.type);
    }
  }
  for (const { context } of loaded.documents) {
    for (const role of context.sourceStructure.roles) {
      budget.check();
      const types = named.get(role.iri) ?? new Set();
      const genericClass =
        role.type === rdfs + "Class" && !types.has(owl + "Class");
      const genericProperty =
        role.type === rdf + "Property" &&
        !["ObjectProperty", "DatatypeProperty", "AnnotationProperty"].some(
          (kind) => types.has(owl + kind),
        );
      if (genericClass || genericProperty) {
        policy.recover(
          "MAPPING_RDFS_ROLE",
          `Retained RDFS-only ${genericClass ? "class" : "property"} category.`,
          role.iri,
        );
      }
    }
  }
}

/** Validate the full closure, including excluded axioms and unattached source expressions. */
export async function checkClosure(loaded, budget, policy) {
  budget.check();
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
  budget.check();
  const assessment = report.getSourceAssessment();
  if (
    !assessment ||
    !["valid", "invalid", "unverified"].includes(assessment.status)
  ) {
    fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-validation" });
  }
  for (const qualified of assessment.qualifications) {
    budget.check();
    if (
      !["UNDECLARED_ENTITY", "SET_CONSTRUCTOR_ARITY"].includes(qualified.code)
    ) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "owl-validation" });
    }
  }
  // Check all nonrecoverable conditions before emitting any semantic recovery.
  const arityWitnesses = new Map();
  for (const item of [
    ...assessment.violations,
    ...assessment.unverifiedChecks,
  ]) {
    budget.check();
    if (item.code === "RESOURCE_LIMIT_EXCEEDED") {
      fail("MODEL_RESOURCE_LIMIT", undefined, {
        stage: "owl-validation",
        resource: item.resource,
      });
    }
    if (evidenceGaps.has(item.code)) {
      fail("DEPENDENCY_FAILURE", undefined, {
        stage: "owl-validation",
        restriction: item.code,
      });
    }
    if (invalidSource.has(item.code)) {
      fail("MAPPING_SOURCE_INVALID", undefined, { restriction: item.code });
    }
    if (item.code === "SOURCE_RANGE_CATEGORY_COLLISION") {
      fail("MAPPING_AMBIGUOUS", undefined, { restriction: item.code });
    }
    if (item.code === "IMPORT_CLOSURE_INCOMPLETE") {
      const ledger = loaded.documents
        .flatMap(({ context }) => context.diagnostics)
        .filter((entry) => entry.code === "MISSING_IMPORT");
      if (!ledger.length) {
        fail("DEPENDENCY_FAILURE", undefined, {
          stage: "owl-validation",
          restriction: item.code,
        });
      }
      if (policy.strict) {
        fail("MAPPING_IMPORT_UNRESOLVED");
      }
    } else if (item.code === "DATA_RANGE_ARITY") {
      if (!arityWitnesses.has(item.kind)) {
        arityWitnesses.set(
          item.kind,
          loaded.documents.some(
            ({ ontology, context }) =>
              unsupportedQuantifier(
                [
                  ...ontology.getAxioms(),
                  ...context.sourceStructure.expressions,
                ],
                budget,
                item.kind,
              ) === item.kind,
          ),
        );
      }
      const witnessed = arityWitnesses.get(item.kind);
      if (
        !witnessed ||
        !["OWLDataSomeValuesFrom", "OWLDataAllValuesFrom"].includes(item.kind)
      ) {
        fail("MAPPING_SOURCE_INVALID", undefined, { restriction: item.code });
      }
    } else if (!(
      globalRestrictions.has(item.code) ||
      collisions.has(item.code) ||
      illTyped.has(item.code) ||
      item.code === "DATATYPE_NOT_IN_SUPPORTED_MAP"
    )) {
      fail("DEPENDENCY_FAILURE", undefined, {
        stage: "owl-validation",
        restriction: item.code,
      });
    }
  }
  // A9 explicitly chooses this strict error even when the custom datatype also
  // has a separate section-11 definition-count violation.
  for (const item of assessment.unverifiedChecks) {
    budget.check();
    if (item.code === "DATATYPE_NOT_IN_SUPPORTED_MAP") {
      policy.recover(
        "MAPPING_DATATYPE_UNVERIFIED",
        `OWL datatype validation is unverified: ${item.code}.`,
        item.datatype,
      );
    }
  }
  for (const item of assessment.violations) {
    budget.check();
    if (item.code === "DATA_RANGE_ARITY") {
      policy.recover(
        "MAPPING_UNSUPPORTED_CONSTRUCT",
        `Unsupported multi-property quantification: ${item.kind.slice(3)}.`,
      );
    } else if (collisions.has(item.code)) {
      policy.recover(
        "MAPPING_MULTIPLE_ROLES",
        `Independently identified roles violate ${item.code}.`,
        item.iri,
      );
    } else if (illTyped.has(item.code)) {
      policy.recover(
        "MAPPING_ILL_TYPED_LITERAL",
        `Exact lexical form retained after ${item.code}.`,
        item.datatype,
      );
    } else if (globalRestrictions.has(item.code)) {
      policy.recover(
        "MAPPING_GLOBAL_RESTRICTION",
        `OWL 2 DL global restriction: ${item.code}.`,
        item.iri,
      );
    }
  }
  assessGenericRoles(loaded, budget, policy);
}
