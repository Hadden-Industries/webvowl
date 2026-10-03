import { categories } from "./profiles.js";
import { fail } from "./errors.js";
import { validateFields, walkTyped } from "./typedValues.js";
import { jsonKey, orderSets } from "./canonicalJson.js";
import { definitions, schemaFor } from "./modelContract.js";

export const compatibleArtifactProfile =
  "https://haddenindustries.com/ontology/profiles/vowl/canonical/compatible-artifact/v1";
const policy =
  "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1";
const rules = new Set(
  [
    "original-assessment",
    "owning-header-selection",
    "import-acquisition",
    "owning-compatible-interpretation",
    "original-profile-assessment",
    "original-source-assessment",
    "retained-projection",
    "canonical-source",
  ].map((name) => `${policy}#${name}`),
);
const object = (fields, optional = []) => ({ fields, optional });
const set = (items, minimum = 0) => ({ items, minimum });
const token = (...values) => ({ token: values });
const ref = (category) => ({ reference: category });
const primary = (category, fields, optional = []) =>
  object(
    {
      id: {
        id: category,
        idPrefix: { T: "d", J: "i", Q: "q", B: "b", V: "v" }[category],
      },
      ...fields,
    },
    optional,
  );
const category = token("object", "data", "annotation");

const document = primary(
  "T",
  {
    ontologyIri: "IRI",
    versionIri: "IRI",
    root: "Boolean",
    headers: token("unavailable", "none", "one", "multiple"),
  },
  ["ontologyIri", "versionIri"],
);
const imported = primary(
  "J",
  {
    parentDocument: ref("T"),
    requestedIri: "IRI",
    targetDocument: ref("T"),
    state: token("acquired", "unavailable"),
  },
  ["targetDocument"],
);
const detail = {
  discriminator: "kind",
  branches: {
    scope: object({ kind: token("scope") }),
    assessment: object(
      {
        kind: token("assessment"),
        status: token("invalid", "unverified", "qualified"),
        iri: "IRI",
        datatype: "IRI",
        entityKind: "String",
        count: "Decimal",
      },
      ["iri", "datatype", "entityKind", "count"],
    ),
    property: object(
      {
        kind: token("property"),
        iri: "IRI",
        subProperty: "IRI",
        superProperty: "IRI",
        declaredCategories: set(category),
        existingCategories: set(category),
        resolvedCategory: category,
        requestedCategory: category,
        evidence: "String",
      },
      [
        "iri",
        "subProperty",
        "superProperty",
        "declaredCategories",
        "existingCategories",
        "resolvedCategory",
        "requestedCategory",
        "evidence",
      ],
    ),
    headers: object({
      kind: token("headers"),
      candidates: set("IRI", 1),
      selected: "IRI",
    }),
    exclusion: object(
      {
        kind: token("exclusion"),
        constructor: "String",
        unsupported: "String",
      },
      ["unsupported"],
    ),
    import: object({ kind: token("import"), requestedIri: "IRI" }),
    "source-statements": object({
      kind: token("source-statements"),
      statements: set(ref("V"), 1),
    }),
  },
};
const qualification = primary("Q", {
  dimension: token("interpretation", "closure", "profile", "lexical", "scope"),
  code: "String",
  records: set(ref("A")),
  documents: set(ref("T")),
  rule: "IRI",
  detail,
});
const sourceNode = primary("B", { document: ref("T") });
const sourceResourceBranches = {
  iri: object({ kind: token("iri"), iri: "IRI" }),
  blank: object({ kind: token("blank"), node: ref("B") }),
};
const sourceStatement = primary("V", {
  document: ref("T"),
  graph: {
    discriminator: "kind",
    branches: {
      ...sourceResourceBranches,
      default: object({ kind: token("default") }),
      unavailable: object({ kind: token("unavailable") }),
    },
  },
  subject: { discriminator: "kind", branches: sourceResourceBranches },
  predicate: "IRI",
  object: {
    discriminator: "kind",
    branches: {
      ...sourceResourceBranches,
      literal: object({
        kind: token("literal"),
        value: object(
          {
            lexical: "Text",
            datatype: "IRI",
            language: "String",
            direction: token("", "ltr", "rtl"),
          },
          ["direction"],
        ),
      }),
    },
  },
});
export const qualificationContract = object({
  documents: set(document, 1),
  imports: set(imported),
  entries: set(qualification),
  sourceNodes: set(sourceNode),
  sourceStatements: set(sourceStatement),
});
export const compatibleSourceContract = object({
  structural: "Structural",
  visualization: "Visualization",
  qualifications: qualificationContract,
});
export const compatibleDocumentContract = object({
  profile: { iriConstant: compatibleArtifactProfile },
  ...compatibleSourceContract.fields,
});

export function compatibleArtifactSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `${compatibleArtifactProfile}/schema`,
    ...schemaFor(compatibleDocumentContract),
    $defs: Object.fromEntries(
      Object.entries(definitions).map(([name, shape]) => [
        name,
        schemaFor(shape),
      ]),
    ),
  };
}

/** Separate inventory: existing v1 descriptors and identifier categories stay frozen. */
export function compatibleMappingContract(document) {
  const types = {
    subjects: "Subject",
    roles: "Role",
    expressions: "Expression",
    constructs: "Construct",
    occurrences: "Occurrence",
  };
  return {
    descriptor: compatibleDocumentContract,
    collections: [
      ...Object.entries(categories).map(([key, prefix]) => ({
        records: document.structural[key],
        prefix,
        type: types[key],
      })),
      {
        records: document.qualifications.documents,
        prefix: "d",
        type: "CompatibleDocument",
      },
      {
        records: document.qualifications.imports,
        prefix: "i",
        type: "CompatibleImport",
      },
      {
        records: document.qualifications.entries,
        prefix: "q",
        type: "Qualification",
      },
      {
        records: document.qualifications.sourceNodes,
        prefix: "b",
        type: "SourceBlankNode",
      },
      {
        records: document.qualifications.sourceStatements,
        prefix: "v",
        type: "SourceStatement",
      },
    ],
  };
}

/** Validate portable evidence references without granting original-source authority. */
export function validateQualifications(source, budget, decoding = false) {
  validateFields(source.qualifications, qualificationContract, budget);
  orderSets(source.qualifications, qualificationContract, budget);
  const index = new Map();
  for (const [key] of Object.entries(categories)) {
    for (const record of source.structural[key]) {
      index.set(record.id, "A");
    }
  }
  for (const [name, type, prefix] of [
    ["documents", "T", "d"],
    ["imports", "J", "i"],
    ["entries", "Q", "q"],
    ["sourceNodes", "B", "b"],
    ["sourceStatements", "V", "v"],
  ]) {
    for (const record of source.qualifications[name]) {
      budget.charge("primaryRecords");
      if (
        !record.id ||
        index.has(record.id) ||
        (decoding && !new RegExp(`^${prefix}(0|[1-9][0-9]*)$`).test(record.id))
      ) {
        fail("IDENTIFIER_INVALID", "/qualifications");
      }
      index.set(record.id, type);
    }
  }
  if (source.qualifications.documents.filter(({ root }) => root).length !== 1) {
    fail("DOCUMENT_TYPE", "/qualifications/documents");
  }
  for (const name of ["imports", "entries", "sourceStatements"]) {
    const identities = new Set();
    for (const record of source.qualifications[name]) {
      budget.check();
      const payload = { ...record };
      delete payload.id;
      const key = jsonKey(payload);
      if (identities.has(key)) {
        fail("NORMALIZATION_INVALID", `/qualifications/${name}`);
      }
      identities.add(key);
    }
  }
  const sourceNodes = new Map(
    source.qualifications.sourceNodes.map((node) => [node.id, node]),
  );
  const usedNodes = new Set();
  for (const statement of source.qualifications.sourceStatements) {
    for (const term of [statement.subject, statement.object, statement.graph]) {
      budget.check();
      if (term.kind === "blank") {
        if (sourceNodes.get(term.node)?.document !== statement.document) {
          fail("REFERENCE_INVALID", "/qualifications/sourceStatements");
        }
        usedNodes.add(term.node);
      }
    }
  }
  if (usedNodes.size !== sourceNodes.size) {
    fail("NORMALIZATION_INVALID", "/qualifications/sourceNodes");
  }
  for (const edge of source.qualifications.imports) {
    if ((edge.state === "acquired") !== Object.hasOwn(edge, "targetDocument")) {
      fail("DOCUMENT_TYPE", "/qualifications/imports");
    }
  }
  for (const entry of source.qualifications.entries) {
    const allowedDimensions = {
      scope: ["scope"],
      assessment: ["profile", "lexical", "scope", "closure"],
      property: ["interpretation"],
      headers: ["interpretation"],
      exclusion: ["scope"],
      import: ["closure"],
      "source-statements": ["scope"],
    }[entry.detail.kind];
    if (
      !entry.code ||
      !rules.has(entry.rule) ||
      !allowedDimensions.includes(entry.dimension) ||
      (entry.detail.kind === "scope" &&
        ![
          "SOURCE_ASSOCIATIONS_UNAVAILABLE",
          "SOURCE_HEADER_ASSOCIATIONS_UNAVAILABLE",
          "ORIGINAL_SOURCE_UNAVAILABLE",
        ].includes(entry.code)) ||
      (entry.detail.kind === "property" &&
        !entry.detail.iri &&
        !(entry.detail.subProperty && entry.detail.superProperty)) ||
      (entry.detail.kind === "headers" &&
        !entry.detail.candidates.includes(entry.detail.selected))
    ) {
      fail("DOCUMENT_TYPE", "/qualifications/entries");
    }
  }
  walkTyped(source.qualifications, qualificationContract, (value, shape) => {
    budget.check();
    if (shape?.reference && index.get(value) !== shape.reference) {
      fail("REFERENCE_INVALID", "/qualifications");
    }
    if (shape?.items && !shape.sequence) {
      const keys = new Set();
      for (const item of value) {
        const key = jsonKey(item);
        if (keys.has(key)) {
          fail("NORMALIZATION_INVALID", "/qualifications");
        }
        keys.add(key);
      }
    }
  });
}
