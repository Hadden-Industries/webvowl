import { fail } from "../errors.js";
import { namespaces } from "../profiles.js";
import { checkString } from "../snapshot.js";

const { rdf, rdfs, owl, xsd } = namespaces;
const roleTypes = {
  class: owl + "Class",
  "rdf-class": rdfs + "Class",
  datatype: rdfs + "Datatype",
  "object-property": owl + "ObjectProperty",
  "data-property": owl + "DatatypeProperty",
  "annotation-property": owl + "AnnotationProperty",
  "rdf-property": rdf + "Property",
  individual: owl + "NamedIndividual",
};
const characteristicTypes = {
  functional: "FunctionalProperty",
  "inverse-functional": "InverseFunctionalProperty",
  symmetric: "SymmetricProperty",
  asymmetric: "AsymmetricProperty",
  transitive: "TransitiveProperty",
  reflexive: "ReflexiveProperty",
  irreflexive: "IrreflexiveProperty",
};
const iri = (value) =>
  `<${[...value]
    .map((character) =>
      character.codePointAt(0) <= 32 || '<>"{}|^`\\'.includes(character)
        ? `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`
        : character,
    )
    .join("")}>`;
const literal = (value) =>
  `${JSON.stringify(value.lexical)}${
    value.kind === "language"
      ? `@${value.language}`
      : `^^${iri(value.datatype)}`
  }`;

/** OWL 2 RDF mapping, plus explicitly retained RDF facts; never canonical protocol RDF. */
export function serializeModelRdf(inspection, budget) {
  const structural = inspection.records;
  const records = new Map(
    ["subjects", "roles", "expressions", "constructs"].flatMap((collection) =>
      structural[collection].map((record) => [record.id, record]),
    ),
  );
  const terms = new Map();
  budget.charge(
    "primaryRecords",
    records.size +
      (inspection.sourceNodes?.length ?? 0) +
      (inspection.sourceStatements?.length ?? 0),
  );
  const lines = new Set();
  let sequence = 0;
  let outputBytes = 0;
  let termDepth = 0;
  const blank = () => `_:v${sequence++}`;
  function unsupported(record, reason = "construct") {
    fail("RDF_EXPORT_UNREPRESENTABLE", undefined, {
      record: record.id,
      kind: record.kind,
      reason,
    });
  }
  function triple(subject, predicate, object) {
    budget.check();
    const line = `${subject} ${iri(predicate)} ${object} .\n`;
    if (!lines.has(line)) {
      budget.charge("rdfQuads");
      outputBytes += checkString(line, "", budget);
      budget.bound("inputBytes", outputBytes);
      lines.add(line);
    }
    return [subject, predicate, object];
  }
  function list(values) {
    let tail = iri(rdf + "nil");
    for (let index = values.length - 1; index >= 0; index--) {
      const node = blank();
      triple(node, rdf + "first", values[index]);
      triple(node, rdf + "rest", tail);
      tail = node;
    }
    return tail;
  }
  function valueTerm(value) {
    if (value.kind === "iri") {
      return iri(value.iri);
    }
    if (value.kind === "subject") {
      return term(value.subject);
    }
    return literal(value);
  }
  function term(id) {
    if (terms.has(id)) {
      return terms.get(id);
    }
    budget.bound("depth", ++termDepth);
    try {
      return buildTerm(id);
    } finally {
      termDepth--;
    }
  }
  function buildTerm(id) {
    budget.check();
    if (terms.has(id)) {
      return terms.get(id);
    }
    const record = records.get(id);
    if (!record) {
      fail("RDF_EXPORT_UNREPRESENTABLE");
    }
    if (record.subject) {
      const value = term(record.subject);
      terms.set(id, value);
      return value;
    }
    const node = record.iri ? iri(record.iri) : blank();
    terms.set(id, node);
    if (!record.kind) {
      return node;
    }
    const kind = record.kind;
    if (kind === "object-inverse") {
      triple(node, owl + "inverseOf", term(record.property));
    } else if (kind === "datatype-restriction") {
      triple(node, rdf + "type", iri(rdfs + "Datatype"));
      triple(node, owl + "onDatatype", term(record.datatype));
      triple(
        node,
        owl + "withRestrictions",
        list(
          record.facets.map((facet) => {
            const restriction = blank();
            triple(restriction, facet.facet, literal(facet.value));
            return restriction;
          }),
        ),
      );
    } else if (
      /^(class|data)-(intersection|union|complement|enumeration)$/u.test(kind)
    ) {
      triple(
        node,
        rdf + "type",
        iri(kind.startsWith("data-") ? rdfs + "Datatype" : owl + "Class"),
      );
      const operator = kind.split("-")[1];
      const predicate = {
        intersection: "intersectionOf",
        union: "unionOf",
        complement: kind.startsWith("data-")
          ? "datatypeComplementOf"
          : "complementOf",
        enumeration: "oneOf",
      }[operator];
      triple(
        node,
        owl + predicate,
        operator === "complement"
          ? term(record.operand)
          : list(
              record.members.map((member) =>
                typeof member === "string" ? term(member) : literal(member),
              ),
            ),
      );
    } else if (
      /^(object|data)-(some|all|value|self|min-cardinality|max-cardinality|exact-cardinality)$/u.test(
        kind,
      )
    ) {
      triple(node, rdf + "type", iri(owl + "Restriction"));
      triple(node, owl + "onProperty", term(record.property));
      const operator = kind.split("-")[1];
      if (["min", "max", "exact"].includes(operator)) {
        const predicate = {
          min: "minQualifiedCardinality",
          max: "maxQualifiedCardinality",
          exact: "qualifiedCardinality",
        }[operator];
        triple(
          node,
          owl + predicate,
          literal({
            kind: "typed",
            lexical: record.cardinality,
            datatype: xsd + "nonNegativeInteger",
          }),
        );
        triple(
          node,
          owl + (kind.startsWith("object-") ? "onClass" : "onDataRange"),
          term(record.filler),
        );
      } else {
        const predicate = {
          some: "someValuesFrom",
          all: "allValuesFrom",
          value: "hasValue",
          self: "hasSelf",
        }[operator];
        const target =
          operator === "self"
            ? literal({
                kind: "typed",
                lexical: "true",
                datatype: xsd + "boolean",
              })
            : operator === "value"
              ? typeof record.value === "string"
                ? term(record.value)
                : literal(record.value)
              : term(record.filler);
        triple(node, owl + predicate, target);
      }
    } else {
      unsupported(record);
    }
    return node;
  }
  function reify(main, type) {
    const node = blank();
    triple(node, rdf + "type", iri(owl + type));
    triple(node, owl + "annotatedSource", main[0]);
    triple(node, owl + "annotatedProperty", iri(main[1]));
    triple(node, owl + "annotatedTarget", main[2]);
    return node;
  }
  function annotate(node, annotations) {
    for (const annotation of annotations) {
      const main = triple(
        node,
        annotation.predicate,
        valueTerm(annotation.value),
      );
      if (annotation.annotations.length) {
        annotate(reify(main, "Annotation"), annotation.annotations);
      }
    }
  }
  function assertion(record, annotations = []) {
    budget.check();
    const kind = record.kind;
    const main = [];
    const add = (subject, predicate, object) =>
      main.push(triple(subject, predicate, object));
    let annotationNode;
    if (kind === "declaration") {
      const role = records.get(record.role);
      const subject = records.get(role.subject);
      if (role.kind !== "individual" || subject.iri) {
        add(term(role.id), rdf + "type", iri(roleTypes[role.kind]));
      } else if (annotations.length) {
        unsupported(record);
      }
    } else if (kind === "subclass") {
      add(term(record.sub), rdfs + "subClassOf", term(record.super));
    } else if (/^sub-(object|data|rdf|annotation)-property$/u.test(kind)) {
      add(term(record.sub), rdfs + "subPropertyOf", term(record.super));
    } else if (/^(object|data|rdf|annotation)-(domain|range)$/u.test(kind)) {
      add(
        term(record.property),
        rdfs + kind.split("-")[1],
        kind.startsWith("annotation-")
          ? iri(record.target)
          : term(record.target),
      );
    } else if (kind === "annotation-assertion") {
      add(term(record.subject), record.predicate, valueTerm(record.value));
    } else if (kind === "class-membership") {
      add(term(record.individual), rdf + "type", term(record.class));
    } else if (kind === "datatype-definition") {
      add(term(record.datatype), owl + "equivalentClass", term(record.target));
    } else if (kind.endsWith("-characteristic")) {
      add(
        term(record.property),
        rdf + "type",
        iri(owl + characteristicTypes[record.characteristic]),
      );
    } else if (kind === "property-chain") {
      add(
        term(record.super),
        owl + "propertyChainAxiom",
        list(record.members.map(term)),
      );
    } else if (kind === "disjoint-union") {
      add(
        term(record.defined),
        owl + "disjointUnionOf",
        list(record.members.map(term)),
      );
    } else if (kind === "key") {
      add(
        term(record.class),
        owl + "hasKey",
        list([...record.objectProperties, ...record.dataProperties].map(term)),
      );
    } else if (kind === "inverse-properties") {
      add(
        term(record.members[0]),
        owl + "inverseOf",
        term(record.members.at(-1)),
      );
    } else if (kind.startsWith("equivalent-")) {
      const predicate =
        owl +
        (kind === "equivalent-classes"
          ? "equivalentClass"
          : "equivalentProperty");
      if (record.members.length === 1) {
        add(term(record.members[0]), predicate, term(record.members[0]));
      }
      for (let index = 1; index < record.members.length; index++) {
        add(
          term(record.members[index - 1]),
          predicate,
          term(record.members[index]),
        );
      }
    } else if (kind.startsWith("disjoint-")) {
      if (record.members.length === 2) {
        add(
          term(record.members[0]),
          owl +
            (kind === "disjoint-classes"
              ? "disjointWith"
              : "propertyDisjointWith"),
          term(record.members[1]),
        );
      } else {
        annotationNode = blank();
        triple(
          annotationNode,
          rdf + "type",
          iri(
            owl +
              (kind === "disjoint-classes"
                ? "AllDisjointClasses"
                : "AllDisjointProperties"),
          ),
        );
        triple(annotationNode, owl + "members", list(record.members.map(term)));
      }
    } else {
      unsupported(record);
    }
    if (annotations.length) {
      if (annotationNode) {
        annotate(annotationNode, annotations);
      } else {
        for (const statement of main) {
          annotate(reify(statement, "Axiom"), annotations);
        }
      }
    }
  }
  const ontology = structural.ontology;
  const root = ontology.iri ? iri(ontology.iri) : blank();
  triple(root, rdf + "type", iri(owl + "Ontology"));
  if (ontology.versionIri) {
    triple(root, owl + "versionIRI", iri(ontology.versionIri));
  }
  for (const imported of ontology.imports) {
    triple(root, owl + "imports", iri(imported));
  }
  annotate(root, ontology.annotations);
  for (const role of structural.roles) {
    assertion({ kind: "declaration", role: role.id });
  }
  for (const expression of structural.expressions) {
    term(expression.id);
  }
  for (const record of structural.constructs) {
    if (record.kind === "assertion-anchor") {
      assertion({ ...record.assertion, id: record.id }, record.annotations);
    } else {
      assertion(record);
    }
  }
  for (const role of structural.roles) {
    if (
      role.kind === "individual" &&
      !records.get(role.subject).iri &&
      !terms.has(role.subject)
    ) {
      unsupported(role, "isolated-anonymous-individual");
    }
  }
  const sourceBlanks = new Map();
  function sourceTerm(value) {
    if (value.kind === "iri") {
      return iri(value.iri);
    }
    if (value.kind === "blank") {
      if (!sourceBlanks.has(value.node)) {
        sourceBlanks.set(value.node, blank());
      }
      return sourceBlanks.get(value.node);
    }
    const retained = value.value;
    return literal({
      ...retained,
      kind: retained.language ? "language" : "typed",
    });
  }
  const residual = inspection.sourceStatements ?? [];
  // The current source contract does not establish identity between parser
  // residual blank nodes and structural anonymous entities. Do not guess it.
  const anonymousResidual = residual.find((statement) =>
    [statement.subject, statement.object].some(({ kind }) => kind === "blank"),
  );
  if (
    anonymousResidual &&
    structural.subjects.some((subject) => !subject.iri)
  ) {
    unsupported(anonymousResidual, "anonymous-source-identity");
  }
  for (const statement of residual) {
    if (!["default", "unavailable"].includes(statement.graph.kind)) {
      unsupported(statement, "graph-scope");
    }
    if (
      statement.object.kind === "literal" &&
      statement.object.value.direction
    ) {
      unsupported(statement, "literal-direction");
    }
    triple(
      sourceTerm(statement.subject),
      statement.predicate,
      sourceTerm(statement.object),
    );
  }
  budget.check();
  return {
    bytes: new TextEncoder().encode([...lines].join("")),
    scope: Object.freeze({
      revision: inspection.revision,
      kind: "flattened-retained-closure",
      mediaType: "text/turtle",
      qualified: (inspection.qualifications?.length ?? 0) > 0,
    }),
  };
}
