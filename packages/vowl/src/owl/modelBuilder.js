import { fail } from "../errors.js";
import { namespaces } from "../profiles.js";
import { snapshotSource } from "../snapshot.js";
import { normalizeDraft } from "../editing.js";

const { owl, rdf, rdfs } = namespaces;
const entities = new Map([
  ["OWLClass", "class"],
  ["OWLDatatype", "datatype"],
  ["OWLObjectProperty", "object-property"],
  ["OWLDataProperty", "data-property"],
  ["OWLAnnotationProperty", "annotation-property"],
  ["OWLNamedIndividual", "individual"],
  ["OWLAnonymousIndividual", "individual"],
]);
const roleTypes = new Map([
  [owl + "Class", "class"],
  [rdfs + "Class", "rdf-class"],
  [rdfs + "Datatype", "datatype"],
  [owl + "ObjectProperty", "object-property"],
  [owl + "DatatypeProperty", "data-property"],
  [owl + "AnnotationProperty", "annotation-property"],
  [rdf + "Property", "rdf-property"],
  [owl + "NamedIndividual", "individual"],
]);
// Each array-valued field is a set except OWLSubPropertyChainOfAxiom.chain.
// Normalization owns deduplication; this table preserves original nesting/order.
const expressions = new Map([
  [
    "OWLObjectIntersectionOf",
    ["class-intersection", { members: ["operands"] }],
  ],
  ["OWLObjectUnionOf", ["class-union", { members: ["operands"] }]],
  ["OWLObjectComplementOf", ["class-complement", { operand: "operand" }]],
  ["OWLObjectOneOf", ["class-enumeration", { members: ["individuals"] }]],
  [
    "OWLObjectSomeValuesFrom",
    ["object-some", { property: "property", filler: "filler" }],
  ],
  [
    "OWLObjectAllValuesFrom",
    ["object-all", { property: "property", filler: "filler" }],
  ],
  [
    "OWLObjectHasValue",
    ["object-value", { property: "property", value: "individual" }],
  ],
  ["OWLObjectHasSelf", ["object-self", { property: "property" }]],
  ["OWLObjectInverseOf", ["object-inverse", { property: "inverse" }]],
  ["OWLDataIntersectionOf", ["data-intersection", { members: ["operands"] }]],
  ["OWLDataUnionOf", ["data-union", { members: ["operands"] }]],
  ["OWLDataComplementOf", ["data-complement", { operand: "operand" }]],
]);
const cardinalities = new Map([
  ["OWLObjectMinCardinality", "object-min-cardinality"],
  ["OWLObjectMaxCardinality", "object-max-cardinality"],
  ["OWLObjectExactCardinality", "object-exact-cardinality"],
  ["OWLDataMinCardinality", "data-min-cardinality"],
  ["OWLDataMaxCardinality", "data-max-cardinality"],
  ["OWLDataExactCardinality", "data-exact-cardinality"],
]);
const axioms = new Map([
  [
    "OWLSubClassOfAxiom",
    ["subclass", { sub: "subClass", super: "superClass" }],
  ],
  [
    "OWLEquivalentClassesAxiom",
    ["equivalent-classes", { members: ["classExpressions"] }],
  ],
  [
    "OWLDisjointClassesAxiom",
    ["disjoint-classes", { members: ["classExpressions"] }],
  ],
  [
    "OWLDisjointUnionAxiom",
    ["disjoint-union", { defined: "owlClass", members: ["classExpressions"] }],
  ],
  [
    "OWLSubObjectPropertyOfAxiom",
    ["sub-object-property", { sub: "subProperty", super: "superProperty" }],
  ],
  [
    "OWLSubPropertyChainOfAxiom",
    ["property-chain", { members: ["chain"], super: "superProperty" }],
  ],
  [
    "OWLEquivalentObjectPropertiesAxiom",
    ["equivalent-object-properties", { members: ["properties"] }],
  ],
  [
    "OWLDisjointObjectPropertiesAxiom",
    ["disjoint-object-properties", { members: ["properties"] }],
  ],
  [
    "OWLInverseObjectPropertiesAxiom",
    ["inverse-properties", { members: ["properties"] }],
  ],
  [
    "OWLObjectPropertyDomainAxiom",
    ["object-domain", { property: "property", target: "domain" }],
  ],
  [
    "OWLObjectPropertyRangeAxiom",
    ["object-range", { property: "property", target: "range" }],
  ],
  [
    "OWLSubDataPropertyOfAxiom",
    ["sub-data-property", { sub: "subProperty", super: "superProperty" }],
  ],
  [
    "OWLEquivalentDataPropertiesAxiom",
    ["equivalent-data-properties", { members: ["properties"] }],
  ],
  [
    "OWLDisjointDataPropertiesAxiom",
    ["disjoint-data-properties", { members: ["properties"] }],
  ],
  [
    "OWLDataPropertyDomainAxiom",
    ["data-domain", { property: "property", target: "domain" }],
  ],
  [
    "OWLDataPropertyRangeAxiom",
    ["data-range", { property: "property", target: "range" }],
  ],
  [
    "OWLDatatypeDefinitionAxiom",
    ["datatype-definition", { datatype: "datatype", target: "dataRange" }],
  ],
  [
    "OWLHasKeyAxiom",
    [
      "key",
      {
        class: "classExpression",
        objectProperties: ["objectProperties"],
        dataProperties: ["dataProperties"],
      },
    ],
  ],
  [
    "OWLClassAssertionAxiom",
    [
      "class-membership",
      { class: "classExpression", individual: "individual" },
    ],
  ],
  [
    "OWLSubAnnotationPropertyOfAxiom",
    ["sub-annotation-property", { sub: "subProperty", super: "superProperty" }],
  ],
]);
const characteristics = new Map([
  ["OWLFunctionalObjectPropertyAxiom", "functional"],
  ["OWLInverseFunctionalObjectPropertyAxiom", "inverse-functional"],
  ["OWLReflexiveObjectPropertyAxiom", "reflexive"],
  ["OWLIrreflexiveObjectPropertyAxiom", "irreflexive"],
  ["OWLSymmetricObjectPropertyAxiom", "symmetric"],
  ["OWLAsymmetricObjectPropertyAxiom", "asymmetric"],
  ["OWLTransitiveObjectPropertyAxiom", "transitive"],
]);
const excluded = new Map([
  ["OWLObjectPropertyAssertionAxiom", "ObjectPropertyAssertion"],
  [
    "OWLNegativeObjectPropertyAssertionAxiom",
    "NegativeObjectPropertyAssertion",
  ],
  ["OWLDataPropertyAssertionAxiom", "DataPropertyAssertion"],
  ["OWLNegativeDataPropertyAssertionAxiom", "NegativeDataPropertyAssertion"],
  ["OWLSameIndividualAxiom", "SameIndividual"],
  ["OWLDifferentIndividualsAxiom", "DifferentIndividuals"],
]);

/** Detect the entire owning assertion before creating any retained substructure. */
export function unsupportedQuantifier(root, budget, wanted) {
  const pending = [root];
  const seen = new Set();
  while (pending.length) {
    budget.check();
    const value = pending.pop();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    if (
      ["OWLDataSomeValuesFrom", "OWLDataAllValuesFrom"].includes(value.kind) &&
      value.properties.length > 1 &&
      (wanted === undefined || wanted === value.kind)
    ) {
      return value.kind;
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") {
        pending.push(child);
      }
    }
  }
  return undefined;
}

/** Build only through public, source-validated OWL objects. No parsing or OWL inference. */
export function buildModel(loaded, budget, policy) {
  const structural = {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  };
  const source = { structural };
  const named = new Map();
  const anonymous = new Map();
  const roles = new Map();
  const kindsBySubject = new Map();
  const expressionIds = new Map();
  let next = 0;
  const append = (collection, payload) => {
    const record = snapshotSource(
      { record: { id: `owl${next++}`, ...payload } },
      budget,
      (pointer) => pointer === "/record",
    ).record;
    structural[collection].push(record);
    return record.id;
  };
  const identity = (value, scope) => {
    if (typeof value === "string") {
      return value;
    }
    if (value.kind === "IRI") {
      return value.value;
    }
    if (value.iri) {
      return value.iri.value;
    }
    if (value.kind !== "OWLAnonymousIndividual") {
      fail("MAPPING_AMBIGUOUS");
    }
    // The scope map keeps equal public blank labels in different ontologies apart.
    let local = anonymous.get(scope);
    if (!local) {
      anonymous.set(scope, (local = new Map()));
    }
    const key = value.structuralKey();
    if (!local.has(key)) {
      local.set(key, Object.freeze({}));
    }
    return local.get(key);
  };
  const subject = (value, scope) => {
    const key = identity(value, scope);
    if (!named.has(key)) {
      named.set(
        key,
        append("subjects", typeof key === "string" ? { iri: key } : {}),
      );
    }
    return named.get(key);
  };
  const role = (value, kind, scope) => {
    const id = subject(value, scope);
    const key = `${id}:${kind}`;
    if (!roles.has(key)) {
      roles.set(key, append("roles", { kind, subject: id }));
    }
    return roles.get(key);
  };
  for (const { ontology, context } of loaded.documents) {
    for (const item of context.sourceStructure.roles) {
      budget.check();
      const kind = roleTypes.get(item.type);
      if (!kind) {
        fail("MAPPING_AMBIGUOUS");
      }
      const key = identity(item.iri ?? item.subject, ontology);
      if (!kindsBySubject.has(key)) {
        kindsBySubject.set(key, new Set());
      }
      kindsBySubject.get(key).add(kind);
    }
  }
  const declarationKinds = (value, kind, scope) => {
    const known = kindsBySubject.get(identity(value, scope)) ?? new Set();
    if (kind === "rdf-class") {
      return [known.has("class") ? "class" : kind];
    }
    const specific = [
      "object-property",
      "data-property",
      "annotation-property",
    ].filter((candidate) => known.has(candidate));
    return specific.length ? specific : [kind];
  };
  const genericKind = (value, kind, scope) => {
    const specific = declarationKinds(value, kind, scope);
    if (specific.length !== 1) {
      fail("MAPPING_AMBIGUOUS");
    }
    return specific[0];
  };
  function literal(value) {
    budget.check();
    if (value.kind !== "OWLLiteral") {
      fail("MAPPING_AMBIGUOUS");
    }
    return value.language
      ? {
          kind: "language",
          lexical: value.lexicalForm,
          language: value.language,
        }
      : {
          kind: "typed",
          lexical: value.lexicalForm,
          datatype: value.datatype.iri.value,
        };
  }
  function annotationValue(value, scope) {
    if (value.kind === "IRI") {
      return { kind: "iri", iri: value.value };
    }
    if (value.kind === "OWLAnonymousIndividual") {
      return { kind: "subject", subject: subject(value, scope) };
    }
    return literal(value);
  }
  function annotation(value, scope, depth = 1) {
    budget.bound("depth", depth);
    return {
      predicate: value.property.iri.value,
      value: annotationValue(value.value, scope),
      annotations: value.annotations.map((nested) =>
        annotation(nested, scope, depth + 1),
      ),
    };
  }
  function mappedFields(value, spec, scope, depth) {
    const [kind, fields] = spec;
    const result = { kind };
    for (const [key, field] of Object.entries(fields)) {
      budget.check();
      result[key] = Array.isArray(field)
        ? value[field[0]].map((member) => term(member, scope, depth + 1))
        : term(value[field], scope, depth + 1);
    }
    return result;
  }
  function term(value, scope, depth = 1) {
    budget.bound("depth", depth);
    if (entities.has(value.kind)) {
      return role(value, entities.get(value.kind), scope);
    }
    let local = expressionIds.get(scope);
    if (!local) {
      expressionIds.set(scope, (local = new Map()));
    }
    if (local.has(value)) {
      return local.get(value);
    }
    let payload;
    if (expressions.has(value.kind)) {
      payload = mappedFields(value, expressions.get(value.kind), scope, depth);
    } else if (cardinalities.has(value.kind)) {
      const kind = cardinalities.get(value.kind);
      payload = {
        kind,
        cardinality: String(value.cardinality),
        property: term(value.property, scope, depth + 1),
        filler: value.filler
          ? term(value.filler, scope, depth + 1)
          : kind.startsWith("object-")
            ? role(owl + "Thing", "class", scope)
            : role(rdfs + "Literal", "datatype", scope),
      };
    } else if (
      ["OWLDataSomeValuesFrom", "OWLDataAllValuesFrom"].includes(value.kind)
    ) {
      if (value.properties.length !== 1) {
        fail("MAPPING_UNSUPPORTED_CONSTRUCT");
      }
      payload = {
        kind: value.kind === "OWLDataSomeValuesFrom" ? "data-some" : "data-all",
        property: term(value.properties[0], scope, depth + 1),
        filler: term(value.filler, scope, depth + 1),
      };
    } else if (value.kind === "OWLDataHasValue") {
      payload = {
        kind: "data-value",
        property: term(value.property, scope, depth + 1),
        value: literal(value.value),
      };
    } else if (value.kind === "OWLDataOneOf") {
      payload = {
        kind: "data-enumeration",
        members: value.values.map(literal),
      };
    } else if (value.kind === "OWLDatatypeRestriction") {
      payload = {
        kind: "datatype-restriction",
        datatype: term(value.datatype, scope, depth + 1),
        facets: value.facetRestrictions.map((facet) => ({
          facet: facet.facet.value,
          value: literal(facet.value),
        })),
      };
    } else {
      fail("MAPPING_AMBIGUOUS");
    }
    const id = append("expressions", payload);
    local.set(value, id);
    return id;
  }
  function assertion(payload, annotations, scope) {
    if (payload.kind !== "declaration") {
      append("constructs", payload);
    }
    if (annotations.length) {
      append("constructs", {
        kind: "assertion-anchor",
        assertion: payload,
        annotations: annotations.map((value) => annotation(value, scope)),
      });
    }
  }
  function axiom(value, scope) {
    budget.check();
    if (excluded.has(value.kind)) {
      for (const member of value.individuals ?? [value.subject, value.value]) {
        if (
          ["OWLNamedIndividual", "OWLAnonymousIndividual"].includes(
            member?.kind,
          )
        ) {
          term(member, scope);
        }
      }
      policy.diagnostic(
        "MAPPING_EXCLUDED_AXIOM",
        `Excluded source constructor: ${excluded.get(value.kind)}; its annotations are excluded.`,
      );
      return;
    }
    const unsupported = unsupportedQuantifier(value, budget);
    if (unsupported) {
      policy.recover(
        "MAPPING_UNSUPPORTED_CONSTRUCT",
        `Omitted whole ${value.kind} containing ${unsupported.slice(3)}.`,
      );
      return;
    }
    let payload;
    if (axioms.has(value.kind)) {
      payload = mappedFields(value, axioms.get(value.kind), scope, 1);
    } else if (value.kind === "OWLDeclarationAxiom") {
      payload = { kind: "declaration", role: term(value.entity, scope) };
    } else if (characteristics.has(value.kind)) {
      payload = {
        kind: "object-characteristic",
        property: term(value.property, scope),
        characteristic: characteristics.get(value.kind),
      };
    } else if (value.kind === "OWLFunctionalDataPropertyAxiom") {
      payload = {
        kind: "data-characteristic",
        property: term(value.property, scope),
        characteristic: "functional",
      };
    } else if (value.kind === "OWLAnnotationAssertionAxiom") {
      payload = {
        kind: "annotation-assertion",
        subject: subject(value.subject, scope),
        predicate: value.property.iri.value,
        value: annotationValue(value.value, scope),
      };
    } else if (
      [
        "OWLAnnotationPropertyDomainAxiom",
        "OWLAnnotationPropertyRangeAxiom",
      ].includes(value.kind)
    ) {
      const domain = value.kind === "OWLAnnotationPropertyDomainAxiom";
      payload = {
        kind: domain ? "annotation-domain" : "annotation-range",
        property: term(value.property, scope),
        target: value[domain ? "domain" : "range"].value,
      };
    } else {
      fail("MAPPING_UNSUPPORTED_CONSTRUCT");
    }
    assertion(payload, value.annotations, scope);
  }
  function classTerm(value, scope) {
    if (["IRI", "OWLAnonymousIndividual"].includes(value.kind)) {
      return role(value, genericKind(value, "rdf-class", scope), scope);
    }
    return term(value, scope);
  }
  function statement(value, scope) {
    budget.check();
    const unsupported = unsupportedQuantifier(value, budget);
    if (unsupported) {
      policy.recover(
        "MAPPING_UNSUPPORTED_CONSTRUCT",
        `Omitted whole source statement containing ${unsupported.slice(3)}.`,
      );
      return;
    }
    const { subject: left, predicate, object: right, annotations } = value;
    let payload;
    if (
      predicate.value === rdf + "type" &&
      [rdf + "Property", rdfs + "Class"].includes(right.value)
    ) {
      if (annotations.length === 0) {
        for (const kind of declarationKinds(
          left,
          roleTypes.get(right.value),
          scope,
        )) {
          role(left, kind, scope);
        }
        return;
      }
      const kind = genericKind(left, roleTypes.get(right.value), scope);
      payload = { kind: "declaration", role: role(left, kind, scope) };
    } else if (predicate.value === rdf + "type") {
      payload = {
        kind: "class-membership",
        class: classTerm(right, scope),
        individual: term(left, scope),
      };
    } else if (predicate.value === rdfs + "subClassOf") {
      payload = {
        kind: "subclass",
        sub: classTerm(left, scope),
        super: classTerm(right, scope),
      };
    } else if (predicate.value === rdfs + "subPropertyOf") {
      payload = {
        kind: "sub-rdf-property",
        sub: role(left, "rdf-property", scope),
        super: role(right, "rdf-property", scope),
      };
    } else if ([rdfs + "domain", rdfs + "range"].includes(predicate.value)) {
      if (
        predicate.value === rdfs + "range" &&
        (right.kind === "IRI" || right.iri)
      ) {
        const known = kindsBySubject.get(identity(right, scope)) ?? new Set();
        if (
          known.has("datatype") &&
          (known.has("class") || known.has("rdf-class"))
        ) {
          fail("MAPPING_AMBIGUOUS");
        }
      }
      payload = {
        kind: predicate.value === rdfs + "domain" ? "rdf-domain" : "rdf-range",
        property: role(left, "rdf-property", scope),
        target: classTerm(right, scope),
      };
    } else {
      fail("MAPPING_AMBIGUOUS");
    }
    assertion(payload, annotations, scope);
  }
  // Only root metadata is portable; acquisition/imported ontology metadata is not content.
  const rootId = loaded.ontology.getOntologyID();
  if (rootId.ontologyIRI) {
    structural.ontology.iri = rootId.ontologyIRI.value;
  }
  if (rootId.versionIRI) {
    structural.ontology.versionIri = rootId.versionIRI.value;
  }
  structural.ontology.imports = [
    ...loaded.ontology.getImportsDeclarations(),
  ].map((value) => value.iri.value);
  structural.ontology.annotations = [...loaded.ontology.getAnnotations()].map(
    (value) => annotation(value, loaded.ontology),
  );
  for (const { ontology, context } of loaded.documents) {
    for (const item of context.sourceStructure.roles) {
      budget.check();
      if (item.origin !== "declaration") {
        continue;
      }
      const kind = roleTypes.get(item.type);
      const value = item.iri ?? item.subject;
      if (["rdf-class", "rdf-property"].includes(kind)) {
        // Explicit declarations remain roots even when their more specific
        // categories were identified by uses excluded from the retained model.
        for (const specific of declarationKinds(value, kind, ontology)) {
          role(value, specific, ontology);
        }
      } else {
        role(value, kind, ontology);
      }
    }
    for (const value of ontology.getAxioms()) {
      axiom(value, ontology);
    }
    for (const value of context.sourceStructure.statements) {
      statement(value, ontology);
    }
  }
  normalizeDraft(source, budget);
  return source;
}
