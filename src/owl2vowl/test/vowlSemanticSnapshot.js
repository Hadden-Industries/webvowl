// Code-point comparison, not `localeCompare`: a canonical snapshot must be
// identical on every machine, and locale collation varies with the runtime's
// default locale and ICU build.
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const stableObject = (entries) =>
  Object.fromEntries(
    entries
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => compareText(left, right)),
  );

const normalizeLocalizedValues = (values = {}) => {
  const normalized = new Map();
  for (const [language, value] of Object.entries(values)) {
    const key =
      language === "IRI-based" || language === "undefined" ? "@none" : language;
    if (!normalized.has(key)) {
      normalized.set(key, new Set());
    }
    normalized.get(key).add(value);
  }
  return stableObject(
    [...normalized].map(([language, lexicalForms]) => [
      language,
      [...lexicalForms].sort(compareText),
    ]),
  );
};

const normalizeAnnotations = (annotations = {}) =>
  stableObject(
    Object.entries(annotations).map(([name, values]) => [
      name,
      values
        .map(({ identifier, language, type, value }) => ({
          identifier: identifier || "",
          language: language || "undefined",
          type,
          value,
        }))
        .sort((left, right) =>
          compareText(JSON.stringify(left), JSON.stringify(right)),
        ),
    ]),
  );

const normalizeIndividual = (individual) => ({
  annotations: normalizeAnnotations(individual.annotations),
  comment: normalizeLocalizedValues(individual.comment || individual.comments),
  iri: individual.iri,
  labels: normalizeLocalizedValues(individual.labels),
});

// The pinned OWL2VOWL 0.3.7 oracle writes a different attribute dialect from
// WebVOWL's own VOWL-JSON output. It spells the restriction markers
// `someValues`/`allValues` where WebVOWL writes `someValuesFrom`/
// `allValuesFrom`, and it never writes the `inferred` marker that WebVOWL puts
// on links it derived rather than found asserted. `object`, `datatype` and
// `anonymous` are written by both sides and are already carried by the compared
// node `type`. Suppressing these terms is only valid when comparing against the
// Java oracle; WebVOWL-to-WebVOWL comparisons must see them, because `inferred`
// has no other carrier and would otherwise be unprotected.
export const JAVA_OWL2VOWL_DIALECT = Object.freeze({
  id: "java-owl2vowl-0.3.7",
  suppressedAttributes: Object.freeze([
    "allValues",
    "allValuesFrom",
    "anonymous",
    "datatype",
    "inferred",
    "object",
    "someValues",
    "someValuesFrom",
  ]),
});

const normalizeAttributes = (attributes = [], suppressed) =>
  [...new Set(attributes)]
    .filter((attribute) => !suppressed.has(attribute))
    .sort(compareText);

const byStableJson = (left, right) =>
  compareText(JSON.stringify(left), JSON.stringify(right));

const selectorName = (name) =>
  `['${name.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}']`;

export const canonicalVowlSnapshot = (vowl, { dialect } = {}) => {
  const suppressed = new Set(dialect?.suppressedAttributes || []);
  const classNodes = new Map(
    (vowl.class || []).map((node) => [String(node.id), node]),
  );
  const classAttributes = new Map(
    (vowl.classAttribute || []).map((attribute) => [
      String(attribute.id),
      attribute,
    ]),
  );
  const classReference = (id) => {
    const key = String(id);
    const attribute = classAttributes.get(key);
    if (attribute?.iri) {
      return attribute.iri;
    }
    const node = classNodes.get(key);
    const members = [
      ...(attribute?.union || []),
      ...(attribute?.intersection || []),
      ...(attribute?.complement || []),
      ...(attribute?.disjointUnion || []),
    ]
      .map((memberId) => classAttributes.get(String(memberId))?.iri)
      .filter(Boolean)
      .sort(compareText);
    if (node && members.length > 0) {
      return `@anonymous:${node.type}:${JSON.stringify(members)}`;
    }
    throw new Error(
      `Cannot canonicalize anonymous VOWL class ${key} without structural members`,
    );
  };

  const classes = [...classAttributes].map(([id, attribute]) => {
    const node = classNodes.get(id);
    return {
      annotations: normalizeAnnotations(attribute.annotations),
      attributes: normalizeAttributes(attribute.attributes, suppressed),
      comment: normalizeLocalizedValues(attribute.comment),
      complement: (attribute.complement || [])
        .map(classReference)
        .sort(compareText),
      description: normalizeLocalizedValues(attribute.description),
      disjointUnion: (attribute.disjointUnion || [])
        .map(classReference)
        .sort(compareText),
      equivalent: (attribute.equivalent || [])
        .map(classReference)
        .sort(compareText),
      individuals: (attribute.individuals || [])
        .map(normalizeIndividual)
        .sort(byStableJson),
      intersection: (attribute.intersection || [])
        .map(classReference)
        .sort(compareText),
      iri: attribute.iri || classReference(id),
      label: normalizeLocalizedValues(attribute.label),
      type: node?.type || null,
      union: (attribute.union || []).map(classReference).sort(compareText),
    };
  });

  const propertyNodes = new Map(
    (vowl.property || []).map((node) => [String(node.id), node]),
  );
  const propertyAttributes = new Map(
    (vowl.propertyAttribute || []).map((attribute) => [
      String(attribute.id),
      attribute,
    ]),
  );
  const propertyReference = (id) => {
    const key = String(id);
    const node = propertyNodes.get(key);
    const attribute = propertyAttributes.get(key);
    if (!node || !attribute) {
      throw new Error(`Cannot resolve VOWL property ${key}`);
    }
    const endpoints = [
      classReference(attribute.domain),
      classReference(attribute.range),
    ];
    if (node.type === "owl:disjointWith") {
      endpoints.sort(compareText);
    }
    return JSON.stringify([node.type, attribute.iri || null, ...endpoints]);
  };
  const properties = [...propertyAttributes].map(([id, attribute]) => {
    const node = propertyNodes.get(id);
    const endpoints = [
      classReference(attribute.domain),
      classReference(attribute.range),
    ];
    if (node?.type === "owl:disjointWith") {
      endpoints.sort(compareText);
    }
    return {
      annotations: normalizeAnnotations(attribute.annotations),
      attributes: normalizeAttributes(attribute.attributes, suppressed),
      cardinality: attribute.cardinality,
      comment: normalizeLocalizedValues(attribute.comment),
      domain: endpoints[0],
      equivalent: (attribute.equivalent || [])
        .map(propertyReference)
        .sort(compareText),
      inverse: attribute.inverse
        ? propertyReference(attribute.inverse)
        : undefined,
      iri: attribute.iri || null,
      label: normalizeLocalizedValues(attribute.label),
      maxCardinality: attribute.maxCardinality,
      minCardinality: attribute.minCardinality,
      range: endpoints[1],
      subproperty: (attribute.subproperty || [])
        .map(propertyReference)
        .sort(compareText),
      superproperty: (attribute.superproperty || [])
        .map(propertyReference)
        .sort(compareText),
      type: node?.type || null,
    };
  });

  return {
    classes: classes.sort(byStableJson),
    ontology: {
      author: [...(vowl.header?.author || [])].sort(compareText),
      comments: normalizeLocalizedValues(vowl.header?.comments),
      description: normalizeLocalizedValues(vowl.header?.description),
      iri: vowl.header?.iri || "",
      labels: normalizeLocalizedValues(vowl.header?.labels),
      other: normalizeAnnotations(vowl.header?.other),
      title: normalizeLocalizedValues(vowl.header?.title),
      version: vowl.header?.version || "",
    },
    properties: properties.sort(byStableJson),
  };
};

export const atomicDifferences = (
  referenceValue,
  candidateValue,
  selector = "$",
) => {
  if (Object.is(referenceValue, candidateValue)) {
    return [];
  }
  if (
    referenceValue === null ||
    candidateValue === null ||
    typeof referenceValue !== "object" ||
    typeof candidateValue !== "object"
  ) {
    return [
      {
        differenceType:
          typeof referenceValue === typeof candidateValue
            ? "VALUE_CHANGED"
            : "TYPE_CHANGED",
        jsValue: candidateValue,
        javaValue: referenceValue,
        selector,
        side: "Java",
      },
    ];
  }

  const differences = [];
  const referenceKeys = Object.keys(referenceValue);
  const candidateKeys = Object.keys(candidateValue);
  for (const key of [...new Set([...referenceKeys, ...candidateKeys])].sort()) {
    const childSelector = `${selector}${selectorName(key)}`;
    if (!Object.hasOwn(referenceValue, key)) {
      differences.push({
        differenceType: "EXTRA",
        jsValue: candidateValue[key],
        selector: childSelector,
        side: "JS",
      });
    } else if (!Object.hasOwn(candidateValue, key)) {
      differences.push({
        differenceType: "MISSING",
        javaValue: referenceValue[key],
        selector: childSelector,
        side: "JS",
      });
    } else {
      differences.push(
        ...atomicDifferences(
          referenceValue[key],
          candidateValue[key],
          childSelector,
        ),
      );
    }
  }
  return differences;
};

const exactRuleMatches = (rule, difference, scope) =>
  rule.artifactType === scope.artifactType &&
  rule.fixture === scope.fixture &&
  rule.parser === scope.parser &&
  rule.capability === scope.capability &&
  rule.differenceType === difference.differenceType &&
  rule.side === difference.side &&
  rule.selector === difference.selector &&
  Object.is(rule.javaValue, difference.javaValue) &&
  Object.is(rule.jsValue, difference.jsValue);

const rulesInScope = (manifest, scope) =>
  manifest.rules.filter(
    (rule) =>
      rule.artifactType === scope.artifactType &&
      rule.fixture === scope.fixture &&
      rule.parser === scope.parser &&
      rule.capability === scope.capability,
  );

const exactCardinality = (rule) => {
  if (rule.cardinality?.form !== "exact") {
    throw new Error(`VOWL rule ${rule.id} must use exact cardinality`);
  }
  return rule.cardinality.value;
};

export const governedDifferenceCount = (manifest, scope) =>
  rulesInScope(manifest, scope).reduce(
    (total, rule) => total + exactCardinality(rule),
    0,
  );

export const verifyGovernedDifferences = ({
  candidate,
  manifest,
  reference,
  scope,
}) => {
  const differences = atomicDifferences(reference, candidate);
  const rules = rulesInScope(manifest, scope);
  const matchCounts = new Map(rules.map((rule) => [rule.id, 0]));
  const unmatched = [];

  for (const difference of differences) {
    const matches = rules.filter((rule) =>
      exactRuleMatches(rule, difference, scope),
    );
    if (matches.length !== 1) {
      unmatched.push({ difference, matchingRuleCount: matches.length });
      continue;
    }
    matchCounts.set(matches[0].id, matchCounts.get(matches[0].id) + 1);
  }
  if (unmatched.length > 0) {
    throw new Error(
      `Ungoverned VOWL differences:\n${JSON.stringify(unmatched, null, 2)}`,
    );
  }
  for (const rule of rules) {
    const expected = exactCardinality(rule);
    if (matchCounts.get(rule.id) !== expected) {
      throw new Error(
        `VOWL rule ${rule.id} matched ${matchCounts.get(rule.id)} differences, expected ${expected}`,
      );
    }
  }
  return differences;
};
