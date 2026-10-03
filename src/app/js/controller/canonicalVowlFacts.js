const SECTIONS = Object.freeze({
  "records.ontology": "Ontology",
  "records.subjects": "Subjects",
  "records.roles": "Entity roles",
  "records.expressions": "Expressions and restrictions",
  "records.constructs": "Assertions and annotations",
  qualifications: "Qualifications",
  diagnostics: "Diagnostics",
  coverage: "Source coverage",
  documents: "Source documents",
  imports: "Imports",
  assertions: "Source assertions",
  sourceNodes: "Source nodes",
  sourceStatements: "Source statements",
  supports: "Source support",
  occurrences: "Drawing occurrences",
  dependencies: "Record dependencies",
  ontologyDependencies: "Ontology dependencies",
});

function entries(inspection, section) {
  const value = section
    .split(".")
    .reduce((object, key) => object?.[key], inspection);
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** Paged, owned facts from the admitted model, including facts without glyphs. */
export function readCanonicalFacts(inspection, request = {}) {
  const { section = "records.ontology", offset = 0, limit = 25 } = request;
  if (
    Object.keys(request).some(
      (key) => !["section", "offset", "limit"].includes(key),
    ) ||
    !Object.hasOwn(SECTIONS, section) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new TypeError(
      "Choose a facts section and a page of 1 to 100 records.",
    );
  }
  const values = entries(inspection, section);
  return structuredClone({
    sections: Object.entries(SECTIONS).map(([key, label]) => ({
      key,
      label,
      count: entries(inspection, key).length,
    })),
    section,
    offset,
    total: values.length,
    entries: values.slice(offset, offset + limit),
  });
}
