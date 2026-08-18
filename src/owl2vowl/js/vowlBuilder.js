import { dispatchAxiom, OWLObjectKind } from "../../owlapi-js/model/index.js";

const OWL_THING_IRI = "http://www.w3.org/2002/07/owl#Thing";
const RDFS_LITERAL_IRI = "http://www.w3.org/2000/01/rdf-schema#Literal";
const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_SUBCLASS_OF_IRI = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const RESERVED_BASE_IRIS = new Set([
  "http://www.w3.org/1999/02/22-rdf-syntax-ns",
  "http://www.w3.org/2000/01/rdf-schema",
  "http://www.w3.org/2001/XMLSchema",
  "http://www.w3.org/2002/07/owl",
]);

const compareText = (left, right) => left.localeCompare(right);
const ignoredAxiom = () => undefined;

const SKIPPED_RESTRICTIONS = new Set([
  OWLObjectKind.DATA_HAS_VALUE,
  OWLObjectKind.DATA_ONE_OF,
  OWLObjectKind.OBJECT_HAS_SELF,
  OWLObjectKind.OBJECT_HAS_VALUE,
  OWLObjectKind.OBJECT_ONE_OF,
]);

const ANONYMOUS_CLASS_EXPRESSIONS = new Map([
  [
    OWLObjectKind.OBJECT_UNION_OF,
    {
      attribute: "union",
      field: "union",
      operands: (expression) => expression.operands,
      type: "owl:unionOf",
    },
  ],
  [
    OWLObjectKind.OBJECT_INTERSECTION_OF,
    {
      attribute: "intersection",
      field: "intersection",
      operands: (expression) => expression.operands,
      type: "owl:intersectionOf",
    },
  ],
  [
    OWLObjectKind.OBJECT_COMPLEMENT_OF,
    {
      attribute: "complement",
      field: "complement",
      operands: (expression) => [expression.operand],
      type: "owl:complementOf",
    },
  ],
]);

const sortByIri = (values) =>
  [...values].sort((left, right) =>
    compareText(left.iri.value, right.iri.value),
  );

const sortStructurally = (values) =>
  [...values].sort((left, right) =>
    compareText(left.structuralKey(), right.structuralKey()),
  );

const localName = (iri) => {
  const hashIndex = iri.lastIndexOf("#");
  const slashIndex = iri.lastIndexOf("/");
  const colonIndex = iri.lastIndexOf(":");
  const separator = Math.max(hashIndex, slashIndex, colonIndex);
  return decodeURIComponent(iri.slice(separator + 1)) || iri;
};

const baseIri = (iri) => {
  const withoutTrailingSeparator = iri.replace(/[#/]$/u, "");
  const hashIndex = withoutTrailingSeparator.lastIndexOf("#");
  const slashIndex = withoutTrailingSeparator.lastIndexOf("/");
  const separator = Math.max(hashIndex, slashIndex);
  return separator > 0
    ? withoutTrailingSeparator.slice(0, separator)
    : withoutTrailingSeparator;
};

const classType = (iri, kind) => {
  if (iri === OWL_THING_IRI) {
    return "owl:Thing";
  }
  if (iri === RDFS_LITERAL_IRI) {
    return "rdfs:Literal";
  }
  return kind === OWLObjectKind.DATATYPE ? "rdfs:Datatype" : "owl:Class";
};

const languageKey = (literal) => literal.language || "undefined";

const annotationItem = (annotation) => {
  const identifier = annotation.property.iri.value;
  if (annotation.value.kind === OWLObjectKind.LITERAL) {
    return {
      identifier,
      language: languageKey(annotation.value),
      type: "label",
      value: annotation.value.lexicalForm,
    };
  }
  if (annotation.value.kind === OWLObjectKind.IRI) {
    return { identifier, type: "iri", value: annotation.value.value };
  }
  return {
    identifier,
    type: "iri",
    value: `_:${annotation.value.nodeID}`,
  };
};

const setLocalizedValue = (target, literal) => {
  const language = languageKey(literal);
  if (!Object.hasOwn(target, language)) {
    target[language] = literal.lexicalForm;
  }
};

const isExternalEntityIri = (iri, ontologyIri) => {
  if (!ontologyIri || iri === OWL_THING_IRI || iri === RDFS_LITERAL_IRI) {
    return false;
  }
  const normalized = ontologyIri.replace(/[#/]$/u, "");
  return !(
    iri === normalized ||
    iri.startsWith(`${normalized}#`) ||
    iri.startsWith(`${normalized}/`)
  );
};

class BuildState {
  #classRecords = new Map();
  #declaredEntityIris = new Set();
  #individualRecords = new Map();
  #nextId = 0;
  #propertyRecords = new Map();
  #relationKeys = new Set();
  #relationRecords = new Map();
  #relations = [];
  #usedIndividualIris = new Set();

  constructor(ontology, ontologies) {
    this.ontology = ontology;
    this.ontologies = ontologies;
    const ontologyId = ontology.getOntologyID();
    this.header = {
      author: [],
      baseIris: [],
      comments: {},
      description: {},
      imports: [],
      iri: ontologyId.ontologyIRI?.value || "",
      labels: {},
      languages: [],
      other: {},
      prefixList: {},
      title: {},
      version: "",
    };
    this.languages = new Set();
    this.header.imports = [...ontology.getImportsDeclarations()]
      .map(({ iri }) => iri.value)
      .sort(compareText);
  }

  nextId() {
    const id = String(this.#nextId);
    this.#nextId += 1;
    return id;
  }

  ensureClass(entityOrIri, kind = OWLObjectKind.CLASS) {
    const iri =
      typeof entityOrIri === "string" ? entityOrIri : entityOrIri.iri.value;
    if (this.#classRecords.has(iri)) {
      return this.#classRecords.get(iri);
    }

    const id = this.nextId();
    const type = classType(iri, kind);
    const attribute = {
      baseIri: baseIri(iri),
      id,
      instances: 0,
      iri,
      label: { "IRI-based": localName(iri) },
    };
    if (type === "rdfs:Datatype") {
      attribute.attributes = ["datatype"];
    }
    if (isExternalEntityIri(iri, this.header.iri)) {
      attribute.attributes ||= [];
      attribute.attributes.push("external");
    }
    const record = { attribute, node: { id, type } };
    this.#classRecords.set(iri, record);
    return record;
  }

  ensureProperty(property, type) {
    const iri = property.iri.value;
    if (this.#propertyRecords.has(iri)) {
      return this.#propertyRecords.get(iri);
    }

    const objectProperty = type === "owl:objectProperty";
    const domain = this.ensureClass(OWL_THING_IRI).node.id;
    const range = this.ensureClass(
      objectProperty ? OWL_THING_IRI : RDFS_LITERAL_IRI,
      objectProperty ? OWLObjectKind.CLASS : OWLObjectKind.DATATYPE,
    ).node.id;
    const id = this.nextId();
    const record = {
      attribute: {
        attributes: [objectProperty ? "object" : "datatype"],
        baseIri: baseIri(iri),
        domain,
        id,
        iri,
        label: { "IRI-based": localName(iri) },
        range,
      },
      explicitDomain: false,
      explicitRange: false,
      node: { id, type },
      restrictions: [],
    };
    if (isExternalEntityIri(iri, this.header.iri)) {
      record.attribute.attributes.push("external");
    }
    this.#propertyRecords.set(iri, record);
    return record;
  }

  ensureIndividual(individual) {
    if (individual.kind !== OWLObjectKind.NAMED_INDIVIDUAL) {
      return undefined;
    }
    const iri = individual.iri.value;
    if (!this.#individualRecords.has(iri)) {
      this.#individualRecords.set(iri, {
        baseIri: baseIri(iri),
        iri,
        labels: { "IRI-based": localName(iri) },
      });
    }
    return this.#individualRecords.get(iri);
  }

  propertyRecord(property) {
    if (property.kind === OWLObjectKind.OBJECT_INVERSE_OF) {
      return this.ensureProperty(property.inverse, "owl:objectProperty");
    }
    return this.ensureProperty(
      property,
      property.kind === OWLObjectKind.DATA_PROPERTY
        ? "owl:datatypeProperty"
        : "owl:objectProperty",
    );
  }

  // An anonymous class expression becomes its own VOWL node, exactly as the
  // pinned OWL2VOWL oracle renders it: no IRI, an `anonymous` attribute
  // alongside the set-operator name, and member ids rather than member IRIs.
  // Records are keyed by structural key so one expression yields one node
  // however many positions reference it.
  ensureAnonymousClass(expression, mapping) {
    const key = expression.structuralKey();
    const existing = this.#classRecords.get(key);
    if (existing) {
      return existing;
    }

    const id = this.nextId();
    const record = {
      attribute: {
        attributes: [mapping.attribute, "anonymous"],
        id,
        instances: 0,
      },
      node: { id, type: mapping.type },
    };
    this.#classRecords.set(key, record);
    record.attribute[mapping.field] = mapping
      .operands(expression)
      .map((operand) => this.classExpressionRecord(operand).node.id);
    return record;
  }

  classExpressionRecord(expression) {
    if (expression.kind === OWLObjectKind.CLASS) {
      return this.ensureClass(expression);
    }

    const mapping = ANONYMOUS_CLASS_EXPRESSIONS.get(expression.kind);
    if (mapping) {
      return this.ensureAnonymousClass(expression, mapping);
    }

    // Restrictions and enumerations have no VOWL node representation: the
    // pinned oracle emits `owl:someValuesFrom` and `owl:allValuesFrom` only as
    // edge types, and never emits `owl:hasValue` or an enumeration node in any
    // of its 44 reference outputs. In a node position they are therefore not
    // visualisable, and collapse to `owl:Thing`, which is already the default
    // this builder uses for an unspecified domain or range. The restriction
    // itself is still drawn as an edge wherever `addRestriction` applies.
    return this.ensureClass(OWL_THING_IRI);
  }

  dataRangeRecord(range) {
    // A constructed data range such as an enumeration has no VOWL node of its
    // own; the oracle emits only `rdfs:Datatype` nodes. It therefore collapses
    // to `rdfs:Literal`, the builder's default range for a data property.
    if (range.kind !== OWLObjectKind.DATATYPE) {
      return this.ensureClass(RDFS_LITERAL_IRI, OWLObjectKind.DATATYPE);
    }
    return this.ensureClass(range, OWLObjectKind.DATATYPE);
  }

  setObjectPropertyDomain(property, domain) {
    const record = this.propertyRecord(property);
    const classId = this.classExpressionRecord(domain).node.id;
    if (property.kind === OWLObjectKind.OBJECT_INVERSE_OF) {
      record.attribute.range = classId;
    } else {
      record.attribute.domain = classId;
    }
    record.explicitDomain = true;
  }

  setObjectPropertyRange(property, range) {
    const record = this.propertyRecord(property);
    const classId = this.classExpressionRecord(range).node.id;
    if (property.kind === OWLObjectKind.OBJECT_INVERSE_OF) {
      record.attribute.domain = classId;
    } else {
      record.attribute.range = classId;
    }
    record.explicitRange = true;
  }

  setDataPropertyDomain(property, domain) {
    const record = this.propertyRecord(property);
    record.attribute.domain = this.classExpressionRecord(domain).node.id;
    record.explicitDomain = true;
  }

  setDataPropertyRange(property, range) {
    const record = this.propertyRecord(property);
    record.attribute.range = this.dataRangeRecord(range).node.id;
    record.explicitRange = true;
  }

  addSubproperty(subProperty, superProperty) {
    const subRecord = this.propertyRecord(subProperty);
    const superRecord = this.propertyRecord(superProperty);
    subRecord.attribute.superproperty ||= [];
    superRecord.attribute.subproperty ||= [];
    if (!subRecord.attribute.superproperty.includes(superRecord.node.id)) {
      subRecord.attribute.superproperty.push(superRecord.node.id);
    }
    if (!superRecord.attribute.subproperty.includes(subRecord.node.id)) {
      superRecord.attribute.subproperty.push(subRecord.node.id);
    }
  }

  addInverse(first, second) {
    const firstRecord = this.propertyRecord(first);
    const secondRecord = this.propertyRecord(second);
    firstRecord.attribute.inverse = secondRecord.node.id;
    secondRecord.attribute.inverse = firstRecord.node.id;
  }

  addPropertyAttribute(property, attribute) {
    const record = this.propertyRecord(property);
    if (!record.attribute.attributes.includes(attribute)) {
      record.attribute.attributes.push(attribute);
    }
  }

  addEquivalentProperties(properties) {
    const records = properties.map((property) => this.propertyRecord(property));
    for (const record of records) {
      record.attribute.equivalent ||= [];
      for (const candidate of records) {
        if (
          candidate !== record &&
          !record.attribute.equivalent.includes(candidate.node.id)
        ) {
          record.attribute.equivalent.push(candidate.node.id);
        }
      }
      if (record.attribute.equivalent.length > 0) {
        this.addPropertyAttributeByRecord(record, "equivalent");
      }
    }
  }

  addPropertyAttributeByRecord(record, attribute) {
    if (!record.attribute.attributes.includes(attribute)) {
      record.attribute.attributes.push(attribute);
    }
  }

  addHasKey({ dataProperties, objectProperties }) {
    for (const property of [...objectProperties, ...dataProperties]) {
      this.addPropertyAttribute(property, "key");
    }
  }

  addClassAssertion(classExpression, individual) {
    const individualRecord = this.ensureIndividual(individual);
    if (!individualRecord) {
      return;
    }
    const classRecord = this.classExpressionRecord(classExpression);
    classRecord.attribute.individuals ||= [];
    if (
      !classRecord.attribute.individuals.some(
        ({ iri }) => iri === individualRecord.iri,
      )
    ) {
      classRecord.attribute.individuals.push(individualRecord);
      classRecord.attribute.instances =
        classRecord.attribute.individuals.length;
      this.#usedIndividualIris.add(individualRecord.iri);
    }
  }

  addRelation({ attributes = [], domain, iri, range, type }) {
    if (domain === range) {
      return;
    }
    const key = JSON.stringify([type, iri || null, domain, range]);
    if (this.#relationKeys.has(key)) {
      return this.#relationRecords.get(key);
    }
    this.#relationKeys.add(key);
    const id = this.nextId();
    const attribute = { attributes: [...attributes], domain, id, range };
    if (iri) {
      attribute.iri = iri;
      attribute.baseIri = baseIri(iri);
    }
    const record = { attribute, node: { id, type } };
    this.#relations.push(record);
    this.#relationRecords.set(key, record);
    return record;
  }

  addSubclass(subClass, superClass) {
    // A set expression in superclass position, such as `A subClassOf (B or C)`,
    // is not a restriction: it has its own anonymous VOWL node, so it takes an
    // ordinary subclass edge to that node. Only genuine restrictions are drawn
    // as restriction edges.
    if (
      superClass.kind !== OWLObjectKind.CLASS &&
      !ANONYMOUS_CLASS_EXPRESSIONS.has(superClass.kind)
    ) {
      this.addRestriction(subClass, superClass);
      return;
    }
    this.addRelation({
      attributes: ["transitive"],
      domain: this.classExpressionRecord(subClass).node.id,
      iri: RDFS_SUBCLASS_OF_IRI,
      range: this.classExpressionRecord(superClass).node.id,
      type: "rdfs:SubClassOf",
    });
  }

  addRestriction(domain, restriction) {
    const domainId = this.classExpressionRecord(domain).node.id;
    const objectRestrictionTypes = new Map([
      [
        OWLObjectKind.OBJECT_SOME_VALUES_FROM,
        ["owl:someValuesFrom", "someValuesFrom"],
      ],
      [
        OWLObjectKind.OBJECT_ALL_VALUES_FROM,
        ["owl:allValuesFrom", "allValuesFrom"],
      ],
    ]);
    if (objectRestrictionTypes.has(restriction.kind)) {
      const [type, attribute] = objectRestrictionTypes.get(restriction.kind);
      const property = this.propertyRecord(restriction.property);
      const rangeId = this.classExpressionRecord(restriction.filler).node.id;
      const relation = this.addRelation({
        attributes: ["object", attribute, "inferred"],
        domain: domainId,
        iri: property.attribute.iri,
        range: rangeId,
        type,
      });
      if (relation && !property.restrictions.includes(relation)) {
        property.restrictions.push(relation);
      }
      return;
    }

    const dataRestrictionTypes = new Map([
      [
        OWLObjectKind.DATA_SOME_VALUES_FROM,
        ["owl:someValuesFrom", "someValuesFrom"],
      ],
      [
        OWLObjectKind.DATA_ALL_VALUES_FROM,
        ["owl:allValuesFrom", "allValuesFrom"],
      ],
    ]);
    if (dataRestrictionTypes.has(restriction.kind)) {
      const [type, attribute] = dataRestrictionTypes.get(restriction.kind);
      const rangeId = this.dataRangeRecord(restriction.filler).node.id;
      for (const propertyExpression of restriction.properties) {
        const property = this.propertyRecord(propertyExpression);
        const relation = this.addRelation({
          attributes: ["datatype", attribute, "inferred"],
          domain: domainId,
          iri: property.attribute.iri,
          range: rangeId,
          type,
        });
        if (relation && !property.restrictions.includes(relation)) {
          property.restrictions.push(relation);
        }
      }
      return;
    }

    const cardinalityKinds = new Map([
      [
        OWLObjectKind.OBJECT_MIN_CARDINALITY,
        { attribute: "minCardinality", data: false },
      ],
      [
        OWLObjectKind.OBJECT_MAX_CARDINALITY,
        { attribute: "maxCardinality", data: false },
      ],
      [
        OWLObjectKind.OBJECT_EXACT_CARDINALITY,
        { attribute: "cardinality", data: false },
      ],
      [
        OWLObjectKind.DATA_MIN_CARDINALITY,
        { attribute: "minCardinality", data: true },
      ],
      [
        OWLObjectKind.DATA_MAX_CARDINALITY,
        { attribute: "maxCardinality", data: true },
      ],
      [
        OWLObjectKind.DATA_EXACT_CARDINALITY,
        { attribute: "cardinality", data: true },
      ],
    ]);
    if (cardinalityKinds.has(restriction.kind)) {
      const cardinality = cardinalityKinds.get(restriction.kind);
      const property = this.propertyRecord(restriction.property);
      const rangeId = cardinality.data
        ? this.dataRangeRecord(restriction.filler).node.id
        : this.classExpressionRecord(restriction.filler).node.id;
      const record = this.addRelation({
        attributes: [cardinality.data ? "datatype" : "object", "inferred"],
        domain: domainId,
        iri: property.attribute.iri,
        range: rangeId,
        type: cardinality.data ? "owl:datatypeProperty" : "owl:objectProperty",
      });
      if (!record) {
        return;
      }
      record.attribute[cardinality.attribute] = String(restriction.cardinality);
      if (!property.restrictions.includes(record)) {
        property.restrictions.push(record);
      }
      return;
    }

    // VOWL draws quantified and cardinality restrictions as edges. Value
    // restrictions and enumerations have no edge form: the oracle emits no
    // `owl:hasValue` or enumeration type anywhere in its 44 reference outputs,
    // so the restriction contributes no visual element and is skipped rather
    // than rejected. The axiom that carried it is still processed.
    if (SKIPPED_RESTRICTIONS.has(restriction.kind)) {
      return;
    }

    throw new TypeError(
      `VOWL restriction mapping is not implemented for ${restriction.kind}`,
    );
  }

  addClassAttribute(record, attribute) {
    record.attribute.attributes ||= [];
    if (!record.attribute.attributes.includes(attribute)) {
      record.attribute.attributes.push(attribute);
    }
  }

  addDeclaration(entity) {
    if (entity?.iri?.value) {
      this.#declaredEntityIris.add(entity.iri.value);
    }
  }

  applyNamedClassExpression(owlClass, expression) {
    const record = this.classExpressionRecord(owlClass);
    const setExpressions = new Map([
      [
        OWLObjectKind.OBJECT_UNION_OF,
        { attribute: "union", field: "union", type: "owl:unionOf" },
      ],
      [
        OWLObjectKind.OBJECT_INTERSECTION_OF,
        {
          attribute: "intersection",
          field: "intersection",
          type: "owl:intersectionOf",
        },
      ],
    ]);
    if (setExpressions.has(expression.kind)) {
      const mapping = setExpressions.get(expression.kind);
      record.node.type = mapping.type;
      this.addClassAttribute(record, mapping.attribute);
      record.attribute[mapping.field] = expression.operands.map(
        (operand) => this.classExpressionRecord(operand).node.id,
      );
      return;
    }
    if (expression.kind === OWLObjectKind.OBJECT_COMPLEMENT_OF) {
      record.node.type = "owl:complementOf";
      this.addClassAttribute(record, "complement");
      record.attribute.complement = [
        this.classExpressionRecord(expression.operand).node.id,
      ];
      return;
    }
    this.addRestriction(owlClass, expression);
  }

  addEquivalentClasses(classExpressions) {
    const namedClasses = classExpressions.filter(
      ({ kind }) => kind === OWLObjectKind.CLASS,
    );
    const anonymousExpressions = classExpressions.filter(
      ({ kind }) => kind !== OWLObjectKind.CLASS,
    );
    const namedRecords = namedClasses.map((owlClass) =>
      this.classExpressionRecord(owlClass),
    );
    for (const record of namedRecords) {
      const equivalent = namedRecords
        .filter((candidate) => candidate !== record)
        .map(({ node }) => node.id);
      if (equivalent.length > 0) {
        record.attribute.equivalent ||= [];
        for (const id of equivalent) {
          if (!record.attribute.equivalent.includes(id)) {
            record.attribute.equivalent.push(id);
          }
        }
        this.addClassAttribute(record, "equivalent");
        if (
          record.node.type === "owl:Class" ||
          record.node.type === "owl:equivalentClass"
        ) {
          record.node.type = "owl:equivalentClass";
        }
      }
    }
    for (const owlClass of namedClasses) {
      for (const expression of anonymousExpressions) {
        this.applyNamedClassExpression(owlClass, expression);
      }
    }
  }

  addDisjointUnion(owlClass, classExpressions) {
    const record = this.classExpressionRecord(owlClass);
    record.node.type = "owl:disjointUnionOf";
    this.addClassAttribute(record, "disjointUnion");
    record.attribute.disjointUnion = classExpressions.map(
      (expression) => this.classExpressionRecord(expression).node.id,
    );
  }

  addDisjointClasses(classExpressions) {
    const records = classExpressions.map((expression) =>
      this.classExpressionRecord(expression),
    );
    for (let left = 0; left < records.length; left += 1) {
      for (let right = left + 1; right < records.length; right += 1) {
        this.addRelation({
          attributes: ["anonymous", "object"],
          domain: records[left].node.id,
          range: records[right].node.id,
          type: "owl:disjointWith",
        });
      }
    }
  }

  applyAxioms() {
    const handlers = {
      [OWLObjectKind.DECLARATION_AXIOM]: ({ entity }) =>
        this.addDeclaration(entity),
      [OWLObjectKind.SUBCLASS_OF_AXIOM]: ({ subClass, superClass }) =>
        this.addSubclass(subClass, superClass),
      [OWLObjectKind.EQUIVALENT_CLASSES_AXIOM]: ({ classExpressions }) =>
        this.addEquivalentClasses(classExpressions),
      [OWLObjectKind.DISJOINT_CLASSES_AXIOM]: ({ classExpressions }) =>
        this.addDisjointClasses(classExpressions),
      [OWLObjectKind.DISJOINT_UNION_AXIOM]: ({ owlClass, classExpressions }) =>
        this.addDisjointUnion(owlClass, classExpressions),
      [OWLObjectKind.SUB_OBJECT_PROPERTY_AXIOM]: ({
        subProperty,
        superProperty,
      }) => this.addSubproperty(subProperty, superProperty),
      // VOWL has no property-chain edge contract.
      [OWLObjectKind.SUB_PROPERTY_CHAIN_AXIOM]: ignoredAxiom,
      [OWLObjectKind.EQUIVALENT_OBJECT_PROPERTIES_AXIOM]: ({ properties }) =>
        this.addEquivalentProperties(properties),
      // VOWL does not visualize disjoint-property axioms.
      [OWLObjectKind.DISJOINT_OBJECT_PROPERTIES_AXIOM]: ignoredAxiom,
      [OWLObjectKind.OBJECT_PROPERTY_DOMAIN_AXIOM]: ({ property, domain }) =>
        this.setObjectPropertyDomain(property, domain),
      [OWLObjectKind.OBJECT_PROPERTY_RANGE_AXIOM]: ({ property, range }) =>
        this.setObjectPropertyRange(property, range),
      [OWLObjectKind.INVERSE_OBJECT_PROPERTIES_AXIOM]: ({ properties }) =>
        this.addInverse(properties[0], properties[1]),
      [OWLObjectKind.FUNCTIONAL_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "functional"),
      [OWLObjectKind.INVERSE_FUNCTIONAL_OBJECT_PROPERTY_AXIOM]: ({
        property,
      }) => this.addPropertyAttribute(property, "inverse functional"),
      [OWLObjectKind.REFLEXIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "reflexive"),
      [OWLObjectKind.IRREFLEXIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "irreflexive"),
      [OWLObjectKind.SYMMETRIC_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "symmetric"),
      [OWLObjectKind.ASYMMETRIC_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "asymmetric"),
      [OWLObjectKind.TRANSITIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "transitive"),
      [OWLObjectKind.SUB_DATA_PROPERTY_AXIOM]: ({
        subProperty,
        superProperty,
      }) => this.addSubproperty(subProperty, superProperty),
      [OWLObjectKind.EQUIVALENT_DATA_PROPERTIES_AXIOM]: ({ properties }) =>
        this.addEquivalentProperties(properties),
      // VOWL does not visualize disjoint-property axioms.
      [OWLObjectKind.DISJOINT_DATA_PROPERTIES_AXIOM]: ignoredAxiom,
      [OWLObjectKind.DATA_PROPERTY_DOMAIN_AXIOM]: ({ property, domain }) =>
        this.setDataPropertyDomain(property, domain),
      [OWLObjectKind.DATA_PROPERTY_RANGE_AXIOM]: ({ property, range }) =>
        this.setDataPropertyRange(property, range),
      [OWLObjectKind.FUNCTIONAL_DATA_PROPERTY_AXIOM]: ({ property }) =>
        this.addPropertyAttribute(property, "functional"),
      // Datatype definitions have no VOWL node relationship of their own.
      [OWLObjectKind.DATATYPE_DEFINITION_AXIOM]: ignoredAxiom,
      [OWLObjectKind.HAS_KEY_AXIOM]: (axiom) => this.addHasKey(axiom),
      // Equality and inequality between individuals are not visualized.
      [OWLObjectKind.SAME_INDIVIDUAL_AXIOM]: ignoredAxiom,
      [OWLObjectKind.DIFFERENT_INDIVIDUALS_AXIOM]: ignoredAxiom,
      [OWLObjectKind.CLASS_ASSERTION_AXIOM]: ({
        classExpression,
        individual,
      }) => this.addClassAssertion(classExpression, individual),
      // Property assertions are retained structurally but are not VOWL edges.
      [OWLObjectKind.OBJECT_PROPERTY_ASSERTION_AXIOM]: ignoredAxiom,
      [OWLObjectKind.NEGATIVE_OBJECT_PROPERTY_ASSERTION_AXIOM]: ignoredAxiom,
      [OWLObjectKind.DATA_PROPERTY_ASSERTION_AXIOM]: ignoredAxiom,
      [OWLObjectKind.NEGATIVE_DATA_PROPERTY_ASSERTION_AXIOM]: ignoredAxiom,
      // Annotation assertions are applied after visual records exist.
      [OWLObjectKind.ANNOTATION_ASSERTION_AXIOM]: ignoredAxiom,
      // VOWL does not visualize annotation-property schema relations.
      [OWLObjectKind.SUB_ANNOTATION_PROPERTY_AXIOM]: ignoredAxiom,
      [OWLObjectKind.ANNOTATION_PROPERTY_DOMAIN_AXIOM]: ignoredAxiom,
      [OWLObjectKind.ANNOTATION_PROPERTY_RANGE_AXIOM]: ignoredAxiom,
    };

    for (const ontology of this.ontologies) {
      for (const axiom of sortStructurally(ontology.getAxioms())) {
        dispatchAxiom(axiom, handlers);
      }
    }
  }

  applyOntologyAnnotations() {
    for (const annotation of sortStructurally(this.ontology.getAnnotations())) {
      const propertyIri = annotation.property.iri.value;
      const key = localName(propertyIri);
      const item = annotationItem(annotation);
      if (annotation.value.kind === OWLObjectKind.LITERAL) {
        this.languages.add(languageKey(annotation.value));
      }

      if (propertyIri === RDFS_LABEL_IRI) {
        if (annotation.value.kind === OWLObjectKind.LITERAL) {
          setLocalizedValue(this.header.labels, annotation.value);
        }
        continue;
      }
      if (propertyIri === RDFS_COMMENT_IRI) {
        if (annotation.value.kind === OWLObjectKind.LITERAL) {
          setLocalizedValue(this.header.comments, annotation.value);
        }
        continue;
      }

      this.header.other[key] ||= [];
      this.header.other[key].push(item);
      if (key === "title" && annotation.value.kind === OWLObjectKind.LITERAL) {
        setLocalizedValue(this.header.title, annotation.value);
      } else if (
        (key === "creator" || key === "author") &&
        annotation.value.kind === OWLObjectKind.LITERAL &&
        !this.header.author.includes(annotation.value.lexicalForm)
      ) {
        this.header.author.push(annotation.value.lexicalForm);
      } else if (
        key === "versionInfo" &&
        annotation.value.kind === OWLObjectKind.LITERAL
      ) {
        this.header.version = annotation.value.lexicalForm;
      } else if (
        key === "description" &&
        annotation.value.kind === OWLObjectKind.LITERAL
      ) {
        setLocalizedValue(this.header.description, annotation.value);
      }
    }
  }

  applyEntityAnnotations() {
    const assertions = this.ontologies.flatMap((ontology) => [
      ...ontology.getAxiomsByType(OWLObjectKind.ANNOTATION_ASSERTION_AXIOM),
    ]);
    for (const axiom of sortStructurally(assertions)) {
      if (axiom.subject.kind !== OWLObjectKind.IRI) {
        continue;
      }
      const record =
        this.#classRecords.get(axiom.subject.value) ||
        this.#propertyRecords.get(axiom.subject.value) ||
        this.#individualRecords.get(axiom.subject.value);
      if (!record) {
        continue;
      }

      const propertyIri = axiom.property.iri.value;
      if (axiom.value.kind === OWLObjectKind.LITERAL) {
        this.languages.add(languageKey(axiom.value));
      }
      if (propertyIri === RDFS_LABEL_IRI) {
        if (axiom.value.kind === OWLObjectKind.LITERAL) {
          const attribute = record.attribute || record;
          const field = record.attribute ? "label" : "labels";
          attribute[field] = {};
          setLocalizedValue(attribute[field], axiom.value);
        }
        continue;
      }
      if (propertyIri === RDFS_COMMENT_IRI) {
        if (axiom.value.kind === OWLObjectKind.LITERAL) {
          const attribute = record.attribute || record;
          attribute.comment ||= {};
          setLocalizedValue(attribute.comment, axiom.value);
        }
        continue;
      }

      const key = localName(propertyIri);
      const attribute = record.attribute || record;
      if (key === "description" && axiom.value.kind === OWLObjectKind.LITERAL) {
        attribute.description ||= {};
        setLocalizedValue(attribute.description, axiom.value);
        continue;
      }
      attribute.annotations ||= {};
      attribute.annotations[key] ||= [];
      attribute.annotations[key].push(
        annotationItem({ property: axiom.property, value: axiom.value }),
      );
    }
  }

  result() {
    for (const property of this.#propertyRecords.values()) {
      for (const restriction of property.restrictions) {
        for (const attribute of property.attribute.attributes) {
          this.addPropertyAttributeByRecord(restriction, attribute);
        }
        for (const field of [
          "annotations",
          "comment",
          "description",
          "label",
        ]) {
          if (property.attribute[field] !== undefined) {
            restriction.attribute[field] = property.attribute[field];
          }
        }
      }
    }
    const visibleBaseProperties = [...this.#propertyRecords.values()].filter(
      (property) =>
        property.restrictions.length === 0 ||
        property.explicitDomain ||
        property.explicitRange,
    );
    const properties = [...visibleBaseProperties, ...this.#relations];
    const connectedClassIds = new Set(
      properties.flatMap(({ attribute }) => [
        String(attribute.domain),
        String(attribute.range),
      ]),
    );
    const classes = [...this.#classRecords.values()].filter(
      ({ attribute, node }) =>
        node.type !== "rdfs:Datatype" ||
        connectedClassIds.has(node.id) ||
        this.#declaredEntityIris.has(attribute.iri),
    );
    const classNodes = classes.map(({ node }) => node);
    const propertyNodes = properties.map(({ node }) => node);
    const usedBaseIris = new Set(
      [...classes, ...properties]
        .map(({ attribute }) => attribute.baseIri)
        .filter((iri) => iri && !RESERVED_BASE_IRIS.has(iri)),
    );
    this.header.baseIris = [...usedBaseIris].sort(compareText);
    this.header.languages = [...this.languages].sort((left, right) => {
      if (left === "undefined") {
        return right === "undefined" ? 0 : 1;
      }
      if (right === "undefined") {
        return -1;
      }
      return compareText(left, right);
    });

    return {
      _comment: "Created with owlapi-js VOWLBuilder",
      header: this.header,
      metrics: {
        classCount: classNodes.filter(({ type }) => type === "owl:Class")
          .length,
        datatypeCount: classNodes.filter(({ type }) => type === "rdfs:Datatype")
          .length,
        datatypePropertyCount: propertyNodes.filter(
          ({ type }) => type === "owl:datatypeProperty",
        ).length,
        individualCount: this.#usedIndividualIris.size,
        nodeCount: classNodes.length,
        objectPropertyCount: propertyNodes.filter(
          ({ type }) => type === "owl:objectProperty",
        ).length,
        propertyCount: propertyNodes.length,
      },
      namespace: [],
      class: classNodes,
      classAttribute: classes.map(({ attribute }) => attribute),
      property: propertyNodes,
      propertyAttribute: properties.map(({ attribute }) => attribute),
    };
  }
}

export class VOWLBuilder {
  build(ontology, { importsClosure = [ontology] } = {}) {
    if (
      !ontology ||
      typeof ontology.getOntologyID !== "function" ||
      typeof ontology.getAxioms !== "function"
    ) {
      throw new TypeError("ontology must implement the OWLOntology contract");
    }

    if (
      !importsClosure ||
      typeof importsClosure[Symbol.iterator] !== "function"
    ) {
      throw new TypeError("importsClosure must be iterable");
    }
    const ontologies = [...importsClosure];
    if (!ontologies.includes(ontology)) {
      ontologies.unshift(ontology);
    }
    for (const closureOntology of ontologies) {
      if (
        !closureOntology ||
        typeof closureOntology.getAxioms !== "function" ||
        typeof closureOntology.getOntologyID !== "function"
      ) {
        throw new TypeError(
          "importsClosure must contain OWLOntology structural objects",
        );
      }
    }

    const state = new BuildState(ontology, ontologies);
    const signatureValues = (methodName) =>
      ontologies.flatMap((closureOntology) => [
        ...closureOntology[methodName](),
      ]);
    for (const owlClass of sortByIri(
      signatureValues("getClassesInSignature"),
    )) {
      state.ensureClass(owlClass);
    }
    for (const datatype of sortByIri(
      signatureValues("getDatatypesInSignature"),
    )) {
      state.ensureClass(datatype, OWLObjectKind.DATATYPE);
    }
    for (const property of sortByIri(
      signatureValues("getObjectPropertiesInSignature"),
    )) {
      state.ensureProperty(property, "owl:objectProperty");
    }
    for (const property of sortByIri(
      signatureValues("getDataPropertiesInSignature"),
    )) {
      state.ensureProperty(property, "owl:datatypeProperty");
    }
    state.applyOntologyAnnotations();
    state.applyAxioms();
    state.applyEntityAnnotations();
    return state.result();
  }
}
