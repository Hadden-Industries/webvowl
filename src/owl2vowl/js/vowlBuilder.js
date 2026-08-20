import {
  dispatchAxiom,
  OWLDataFactory,
  OWLObjectKind,
} from "../../owlapi-js/model/index.js";

// Used only to express a conjunction the ontology already asserts, when a
// property carries more than one domain or range axiom. Nothing about VOWL
// travels back into the model this way.
const owlFactory = new OWLDataFactory();

const OWL_NAMESPACE = "http://www.w3.org/2002/07/owl#";
const RDF_NAMESPACE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";
const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";
const OWL_THING_IRI = `${OWL_NAMESPACE}Thing`;
const RDFS_LITERAL_IRI = `${RDFS_NAMESPACE}Literal`;
const RDFS_LABEL_IRI = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT_IRI = "http://www.w3.org/2000/01/rdf-schema#comment";
const OWL_DEPRECATED_IRI = `${OWL_NAMESPACE}deprecated`;
const SKOS_PREF_LABEL_IRI = "http://www.w3.org/2004/02/skos/core#prefLabel";
const RDFS_SUBCLASS_OF_IRI = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
const RESERVED_BASE_IRIS = new Set([
  "http://www.w3.org/1999/02/22-rdf-syntax-ns",
  "http://www.w3.org/2000/01/rdf-schema",
  "http://www.w3.org/2001/XMLSchema",
  "http://www.w3.org/2002/07/owl",
]);

// Code-point comparison, deliberately not `localeCompare`. Canonical ordering
// decides what reaches the output - sorted base IRIs and languages, and the
// order declarations and axioms are processed, which in turn decides which value
// wins where only one can be kept. Locale collation depends on the runtime's
// default locale and ICU build, so it would make that output a function of the
// machine rather than of the ontology. It also weights `#` and `-` as
// punctuation, which reverses the PROV namespaces against code-point order.
//
// Locale collation remains correct for lists presented to a human; this is
// canonical data ordering, which is a different job.
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const ignoredAxiom = () => undefined;

// The VOWL-JSON fields that carry a cardinality figure on a property edge. An
// edge holding one of these was drawn for a cardinality restriction rather than
// for a relationship of its own.
const CARDINALITY_FIELDS = ["cardinality", "maxCardinality", "minCardinality"];

// VOWL 2's splitting rules, Table 3. The generic elements carry no domain
// information of their own yet attract a great many links, so drawing each once
// turns it into a hub that dominates the layout and suggests an importance it
// does not have. `rdfs:Datatype` and `rdfs:Literal` are therefore drawn once for
// every property linked to them, and `owl:Thing` once for every class - however
// many links that class contributes - with each link connected to exactly one
// representation.
const DATATYPE_NODE_TYPES = new Set(["rdfs:Datatype", "rdfs:Literal"]);
const SPLIT_BY_PROPERTY = "property";
const SPLIT_BY_CLASS = "class";
const SPLIT_RULES = new Map([
  ["owl:Thing", SPLIT_BY_CLASS],
  ["rdfs:Datatype", SPLIT_BY_PROPERTY],
  ["rdfs:Literal", SPLIT_BY_PROPERTY],
]);

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
      // The union of one class is that class, so a collection left with a
      // single drawable member is drawn as the member itself.
      collapsesToSingleMember: true,
      field: "union",
      operands: (expression) => expression.operands,
      type: "owl:unionOf",
    },
  ],
  [
    OWLObjectKind.OBJECT_INTERSECTION_OF,
    {
      attribute: "intersection",
      collapsesToSingleMember: true,
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

// Whether a class expression has a VOWL node of its own. A named class does, and
// so do the anonymous set constructors above; a restriction or an enumeration
// does not, which is why `classExpressionRecord` collapses those to `owl:Thing`
// when one turns up where a node is required.
//
// That collapse is a sound default for an unspecified domain or range, but it
// must not be used to give an edge somewhere to point: an edge to `owl:Thing`
// says every value is anything at all, which is vacuous and is not what the
// ontology stated.
const hasVowlNode = (expression) =>
  expression.kind === OWLObjectKind.CLASS ||
  ANONYMOUS_CLASS_EXPRESSIONS.has(expression.kind);

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

// The namespace half of `localName`, so that the two concatenate back into the
// property IRI. Empty when the IRI has no local part to split off, in which case
// `localName` returns the whole IRI and there is nothing to prefix.
const namespaceIri = (iri) => {
  const separator = Math.max(
    iri.lastIndexOf("#"),
    iri.lastIndexOf("/"),
    iri.lastIndexOf(":"),
  );
  return iri.slice(separator + 1) ? iri.slice(0, separator + 1) : "";
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
  // The local name, not the full IRI: VOWL-JSON groups annotations under the
  // property's local name, and the pinned OWL2VOWL oracle repeats that same
  // name here, so `identifier` always equals the key it sits under.
  const identifier = localName(annotation.property.iri.value);
  // A local name cannot distinguish two annotation properties from different
  // namespaces, and VOWL-JSON groups both under it. `predicateNs` carries the
  // rest of the IRI so nothing is lost, and `src/app/js/sidebar.js` uses it to
  // hyperlink the predicate. The oracle has no such field, but the corpus
  // differential compares only {value, type, language, identifier}, so adding
  // one costs nothing in parity terms.
  const predicateNs = namespaceIri(annotation.property.iri.value);
  if (annotation.value.kind === OWLObjectKind.LITERAL) {
    return {
      identifier,
      language: languageKey(annotation.value),
      predicateNs,
      type: "label",
      value: annotation.value.lexicalForm,
    };
  }
  if (annotation.value.kind === OWLObjectKind.IRI) {
    return {
      identifier,
      predicateNs,
      type: "iri",
      value: annotation.value.value,
    };
  }
  return {
    identifier,
    predicateNs,
    type: "iri",
    value: `_:${annotation.value.nodeID}`,
  };
};

// The annotations an `owl:Axiom` reification carries, shaped exactly like an
// entity's own `annotations` map so that the structure nests to any depth and a
// reader needs one rule rather than two.
//
// Ordered on what the annotations are - property IRI, then value - rather than
// on the order they were read, so the same ontology serialised differently
// produces the same output. Returns nothing where there are none, so an
// annotation the axiom does not describe carries no empty container.
const nestedAnnotations = (annotations) => {
  if (!annotations?.length) {
    return undefined;
  }
  const order = (annotation) =>
    `${annotation.property.iri.value} ${
      annotation.value.lexicalForm ?? annotation.value.value ?? ""
    }`;
  const nested = {};
  for (const annotation of [...annotations].sort((left, right) =>
    compareText(order(left), order(right)),
  )) {
    const key = localName(annotation.property.iri.value);
    nested[key] ||= [];
    nested[key].push(annotationItem(annotation));
  }
  return nested;
};

// A document may state two values for one language - two `rdfs:label`s tagged
// `@en`, say. VOWL-JSON holds a single value per language, so one has to be
// dropped, and the rule for which must not be a by-product of the order axioms
// happen to be visited. Keeping the code-point-smaller value makes the outcome
// a total function of the values themselves, so it holds however the ontology
// was serialised and whatever the traversal order turns out to be.
// `preferred` is the value the document itself ranks first for each language,
// taken from `skos:prefLabel`. Code-point order is a sound tie-break but an
// arbitrary one, and where the author has said which label they prefer,
// discarding that to apply it is losing information that is right there in the
// document: on `iso-iec_11179_-3_ed-4_20260714` it picks "DEC" over "Data
// Element Concept". The ranking decides where it exists and code-point order
// decides everywhere else, so the outcome is still a total function of the
// values and never of the order they arrived in.
const setLocalizedValue = (target, literal, preferred) => {
  const language = languageKey(literal);
  const value = literal.lexicalForm;
  const current = target[language];
  const preferredValue = preferred?.[language];
  if (current === undefined || value === preferredValue) {
    target[language] = value;
    return;
  }
  if (current === preferredValue) {
    return;
  }
  if (value < current) {
    target[language] = value;
  }
};

// What the pinned OWL2VOWL oracle serialises when a document declares no
// ontology header, and therefore what WebVOWL v1.1.7 showed in its sidebar.
// VOWL-JSON has no specification, so the oracle's rendering is the contract.
const MISSING_ONTOLOGY_IRI = "No IRI set";

// `owl:Thing` and `rdfs:Literal` are introduced by VOWL rather than read from
// the ontology, so how they are labelled is a presentation convention. The
// oracle is entirely consistent about it - across the 46 reference outputs
// `owl:Thing` appears 340 times and `rdfs:Literal` 510 times, each with exactly
// one label shape - and the two shapes differ from one another, which is why
// they are pinned here rather than derived from a rule.
const BUILT_IN_NODE_LABELS = Object.freeze({
  "http://www.w3.org/2000/01/rdf-schema#Literal": {
    "IRI-based": "Literal",
    undefined: "Literal",
  },
  "http://www.w3.org/2002/07/owl#Thing": { undefined: "Thing" },
});

// The OWL 2 datatype map (OWL 2 Structural Specification, section 4). The
// specification states that `Declaration( Datatype( I ) )` for each IRI I in the
// map is automatically included in every ontology, so a member of the map is
// part of every ontology by definition and cannot be external to one. That is
// the authority for exempting these, rather than the oracle's observed silence.
//
// A datatype outside this map is user-defined and belongs to some ontology, so
// it stays subject to the ordinary test.
const OWL2_DATATYPE_MAP = new Set([
  `${RDF_NAMESPACE}PlainLiteral`,
  `${RDF_NAMESPACE}XMLLiteral`,
  RDFS_LITERAL_IRI,
  `${OWL_NAMESPACE}rational`,
  `${OWL_NAMESPACE}real`,
  ...[
    "anyURI",
    "base64Binary",
    "boolean",
    "byte",
    "dateTime",
    "dateTimeStamp",
    "decimal",
    "double",
    "float",
    "hexBinary",
    "int",
    "integer",
    "language",
    "long",
    "Name",
    "NCName",
    "negativeInteger",
    "NMTOKEN",
    "nonNegativeInteger",
    "nonPositiveInteger",
    "normalizedString",
    "positiveInteger",
    "short",
    "string",
    "token",
    "unsignedByte",
    "unsignedInt",
    "unsignedLong",
    "unsignedShort",
  ].map((name) => `${XSD_NAMESPACE}${name}`),
]);

// An entity belongs to the ontology being displayed when its base IRI *is* the
// ontology's, not when it merely sits somewhere beneath it. A prefix test counts
// every deeper path as local, so `…unito.it/drammar/2012/4/drammar.owl#Emotion`
// would count as belonging to `http://www.cadmos.cirma.unito.it` despite being a
// different document.
const isExternalEntityIri = (iri, ontologyIri) => {
  if (iri === OWL_THING_IRI || OWL2_DATATYPE_MAP.has(iri)) {
    return false;
  }
  return baseIri(iri) !== (ontologyIri ?? "").replace(/[#/]$/u, "");
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
      label: BUILT_IN_NODE_LABELS[iri] ?? { "IRI-based": localName(iri) },
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
  ensureAnonymousClass(expression, mapping, operands) {
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
    record.attribute[mapping.field] = (
      operands ?? mapping.operands(expression)
    ).map((operand) => this.classExpressionRecord(operand).node.id);
    return record;
  }

  classExpressionRecord(expression) {
    if (expression.kind === OWLObjectKind.CLASS) {
      return this.ensureClass(expression);
    }

    const mapping = ANONYMOUS_CLASS_EXPRESSIONS.get(expression.kind);
    if (mapping) {
      // A member with no VOWL node contributes nothing to draw, and collapsing
      // it to `owl:Thing` would change what the expression means: a union
      // containing the top concept is the top concept. `time.rdf` states
      // `TimePosition subClassOf (=1 numericPosition or =1 nominalPosition)`,
      // which became a union of two `owl:Thing` nodes and so a vacuous subclass
      // edge to the top concept - the very edge VOWL 2 advises against drawing.
      const drawable = mapping.operands(expression).filter(hasVowlNode);
      if (drawable.length === 0) {
        return this.ensureClass(OWL_THING_IRI);
      }
      if (drawable.length === 1 && mapping.collapsesToSingleMember) {
        return this.classExpressionRecord(drawable[0]);
      }
      return this.ensureAnonymousClass(expression, mapping, drawable);
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

  // OWL 2 reads several domain axioms for one property as a conjunction: every
  // one of them holds, so the property's domain is their intersection. Keeping
  // only the axiom processed last would discard the rest while still drawing a
  // class node for each, which is how `imarinetlo:name` - ten `rdfs:domain`
  // axioms - left four class nodes behind that no edge touched.
  //
  // The expressions are collected here and joined in
  // `applyIntersectedEndpoints`, once every axiom has been seen. Joining them
  // as they arrive would leave a two-member intersection, then a three-member
  // one, and so on, each an orphan node of its own.
  rememberEndpoint(record, side, expression) {
    record.endpointExpressions ??= { domain: [], range: [] };
    record.endpointExpressions[side].push(expression);
  }

  setObjectPropertyDomain(property, domain) {
    const record = this.propertyRecord(property);
    const classId = this.classExpressionRecord(domain).node.id;
    const side =
      property.kind === OWLObjectKind.OBJECT_INVERSE_OF ? "range" : "domain";
    record.attribute[side] = classId;
    this.rememberEndpoint(record, side, domain);
    record.explicitDomain = true;
  }

  setObjectPropertyRange(property, range) {
    const record = this.propertyRecord(property);
    const classId = this.classExpressionRecord(range).node.id;
    const side =
      property.kind === OWLObjectKind.OBJECT_INVERSE_OF ? "domain" : "range";
    record.attribute[side] = classId;
    this.rememberEndpoint(record, side, range);
    record.explicitRange = true;
  }

  setDataPropertyDomain(property, domain) {
    const record = this.propertyRecord(property);
    record.attribute.domain = this.classExpressionRecord(domain).node.id;
    this.rememberEndpoint(record, "domain", domain);
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

  // Joins the endpoints collected by `rememberEndpoint`. A property that states
  // one domain keeps that class as its domain, so the ordinary case is
  // untouched; one that states several gets an `owl:intersectionOf` node whose
  // members are all of them. Restating the same class changes nothing, because
  // the expressions are deduplicated by structural key first.
  //
  // Data property ranges are deliberately excluded: they are datatypes, VOWL
  // has no datatype intersection node, and `dataRangeRecord` already collapses
  // a constructed data range to `rdfs:Literal`.
  applyIntersectedEndpoints() {
    for (const record of this.#propertyRecords.values()) {
      const stated = record.endpointExpressions;
      if (!stated) {
        continue;
      }
      for (const side of ["domain", "range"]) {
        const distinct = new Map(
          stated[side].map((expression) => [
            expression.structuralKey(),
            expression,
          ]),
        );
        if (distinct.size < 2) {
          continue;
        }
        record.attribute[side] = this.classExpressionRecord(
          owlFactory.getOWLObjectIntersectionOf(
            sortStructurally(distinct.values()),
          ),
        ).node.id;
      }
    }
  }

  // VOWL 2 draws an inverse pair as one line between two classes with
  // arrowheads at both ends, labelled with the property and its inverse
  // counterpart. A single line between two classes means the pair shares its
  // endpoints, so a property stating no domain or range of its own takes them
  // from its inverse, crossed over.
  //
  // Run after every axiom has been applied, so it cannot matter whether the
  // inverse axiom or the domain and range were read first. Only endpoints the
  // author actually stated are read, and only gaps are filled, so no value
  // written here is ever read by another step of the same pass.
  applyInverseEndpoints() {
    const byId = new Map(
      [...this.#propertyRecords.values()].map((record) => [
        record.node.id,
        record,
      ]),
    );

    for (const property of this.#propertyRecords.values()) {
      const inverse = byId.get(property.attribute.inverse);
      if (!inverse) {
        continue;
      }
      if (!property.explicitDomain && inverse.explicitRange) {
        property.attribute.domain = inverse.attribute.range;
      }
      if (!property.explicitRange && inverse.explicitDomain) {
        property.attribute.range = inverse.attribute.domain;
      }
    }
  }

  addPropertyAttribute(property, attribute) {
    const record = this.propertyRecord(property);
    if (!record.attribute.attributes.includes(attribute)) {
      record.attribute.attributes.push(attribute);
    }
  }

  // A characteristic that only exists for object properties must not be drawn on
  // a property that ADR 0005 resolved to data. Such a property reaches here only
  // in compatible mode, where the axiom-level reuse recovery re-admits the
  // object-property reading so the axiom can be constructed; that recovery is
  // deliberate, but it must not undo the category decision. The pinned oracle
  // renders `foaf:mbox_sha1sum` as a plain datatype property for this reason.
  addObjectPropertyCharacteristic(property, attribute) {
    const record = this.propertyRecord(property);
    if (record.attribute.attributes.includes("datatype")) {
      return;
    }
    this.addPropertyAttribute(property, attribute);
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

    // `instances` and `individuals` count different things. `individuals` holds
    // the ordinary members of a class; `instances` counts only those members
    // whose IRI is *also* a class, which is the class-and-individual punning
    // OWL 2 permits. The pinned oracle keeps them strictly apart - it renders
    // `MonthOfYear` with `instances: 1` beside eleven `individuals` - so
    // `instances` is never the length of `individuals`.
    if (this.#classRecords.has(individualRecord.iri)) {
      classRecord.attribute.instances += 1;
      this.#usedIndividualIris.add(individualRecord.iri);
      return;
    }

    classRecord.attribute.individuals ||= [];
    if (
      !classRecord.attribute.individuals.some(
        ({ iri }) => iri === individualRecord.iri,
      )
    ) {
      classRecord.attribute.individuals.push(individualRecord);
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

  // One arrow can carry only one number, but an ontology may restrict the same
  // property on several classes. The weaker bound is kept - the smallest
  // minimum, the largest maximum - so the figure shown is implied by every
  // restriction stated rather than overstating any one of them. Choosing by
  // value rather than by arrival also keeps the result independent of the order
  // the axioms were read in.
  //
  // An exact cardinality is both bounds at once, so a disagreement between two
  // exact figures has no weaker reading; the smaller is kept for determinism.
  labelPropertyCardinality(attribute, field, value) {
    const existing = attribute[field];
    if (existing === undefined) {
      attribute[field] = String(value);
      return;
    }
    const previous = Number(existing);
    attribute[field] =
      field === "maxCardinality"
        ? String(Math.max(previous, value))
        : String(Math.min(previous, value));
  }

  // Multiplies the generic nodes per VOWL 2's splitting rules and rewires each
  // link to its own representation, returning the copies that were made. The
  // renderer implements none of this, so it falls to whatever produces the
  // VOWL-JSON; the pinned oracle does it, emitting 371 generic node instances
  // for `schemaorg.owl` where one node each would give two.
  //
  // Links are grouped by what they are - the property's IRI, or the class at
  // the far end - never by the order the edges happened to be built, so the same
  // ontology always splits into the same shape. The lowest-sorting group keeps
  // the original node so that a single group is left untouched.
  splitGenericNodes(properties) {
    const recordsById = new Map(
      [...this.#classRecords.values()].map((record) => [
        String(record.node.id),
        record,
      ]),
    );
    const linksByNode = new Map();
    for (const record of properties) {
      for (const end of ["domain", "range"]) {
        const id = String(record.attribute[end]);
        if (!recordsById.has(id)) {
          continue;
        }
        if (!linksByNode.has(id)) {
          linksByNode.set(id, []);
        }
        linksByNode.get(id).push({ end, record });
      }
    }

    const copies = [];
    for (const [id, links] of linksByNode) {
      const rule = SPLIT_RULES.get(recordsById.get(id).node.type);
      if (!rule) {
        continue;
      }
      const groups = new Map();
      const add = (key, link) => {
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(link);
      };

      if (rule === SPLIT_BY_PROPERTY) {
        for (const link of links) {
          add(String(link.record.attribute.iri ?? ""), link);
        }
      } else {
        // Split by class means exactly that: a representation per *class*
        // linked to. A link whose far end is a datatype or `rdfs:Literal`
        // creates none of its own - the rule counts classes - so it joins the
        // lowest-sorting class group instead, keeping every link on exactly one
        // representation. Where nothing links to a class at all, that leaves a
        // single group and no split.
        const farEnd = (link) =>
          String(
            link.record.attribute[link.end === "domain" ? "range" : "domain"],
          );
        const isClassEnd = (id) => {
          const record = recordsById.get(id);
          return Boolean(record) && !DATATYPE_NODE_TYPES.has(record.node.type);
        };
        const classKeys = [
          ...new Set(links.map(farEnd).filter(isClassEnd)),
        ].sort(compareText);
        const fallback = classKeys[0] ?? "";
        for (const link of links) {
          const id = farEnd(link);
          add(isClassEnd(id) ? id : fallback, link);
        }
      }

      for (const key of [...groups.keys()].sort(compareText).slice(1)) {
        const copyId = this.nextId();
        const source = recordsById.get(id);
        copies.push({
          attribute: { ...source.attribute, id: copyId },
          node: { id: copyId, type: source.node.type },
        });
        for (const link of groups.get(key)) {
          link.record.attribute[link.end] = copyId;
        }
      }
    }
    return copies;
  }

  addSubclass(subClass, superClass) {
    // A restriction or enumeration in subclass position has no VOWL node to
    // draw the edge from. `classExpressionRecord` uses `owl:Thing` only as a
    // domain/range fallback; using that fallback here would fabricate the GCI
    // `owl:Thing subClassOf superClass`.
    if (!hasVowlNode(subClass)) {
      return;
    }
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
    // Every class is a subclass of `owl:Thing` by definition, so an edge saying
    // so carries no information and would tie every node in the graph to one
    // point. VOWL draws none: across the 46 pinned reference outputs there are
    // 2358 subclass edges and not one points at `owl:Thing`, and the retained
    // legacy exporter skips them explicitly for the same reason.
    //
    // Tested on the resolved node rather than on the expression, because a set
    // expression whose members all lack a node resolves to `owl:Thing` too. In
    // `time.rdf` that is a union of two cardinality restrictions, which says
    // nothing about the subclass at all.
    const superRecord = this.classExpressionRecord(superClass);
    if (superRecord.node.type === "owl:Thing") {
      return;
    }
    this.addRelation({
      attributes: ["transitive"],
      domain: this.classExpressionRecord(subClass).node.id,
      iri: RDFS_SUBCLASS_OF_IRI,
      range: superRecord.node.id,
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
      // A named class, and only a named class. A restriction or an enumeration
      // has no node for the edge to point at, and collapsing it to `owl:Thing`
      // would say all values are anything at all. A union or intersection does
      // have a node, but the oracle still draws no edge to one: across all 46
      // reference outputs its 298 restriction edges have no anonymous endpoint.
      // VOWL 2 governs nothing about restriction edges, so ADR 0006 leaves their
      // shape to the oracle.
      if (restriction.filler.kind !== OWLObjectKind.CLASS) {
        return;
      }
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
      // The same vacuity rule as the quantified restrictions above: an edge to
      // `owl:Thing` would say the restriction ranges over everything, which is
      // not what a filler with no node of its own states. Only a data range
      // legitimately collapses, to `rdfs:Literal`, which is a real node.
      if (!cardinality.data && !hasVowlNode(restriction.filler)) {
        return;
      }
      // VOWL 2 draws a cardinality as a number near the end of the property's
      // arrow, in the manner of UML multiplicity, and gives a property exactly
      // one arrow from its domain to its range. An `owl:Thing` filler names no
      // target - OWL 2 makes the class expression optional and identical to
      // `owl:Thing` when omitted - so there is nothing for an edge to point at,
      // and the specification's rule on `owl:Thing` permits its node only where
      // a property has no domain or range axiom, or where the author named it.
      // Drawing one anyway is what put every restricted subclass of `food.rdf`
      // on an edge to `owl:Thing`.
      //
      // The data side is the same rule with the same reasoning: VOWL 2
      // substitutes `rdfs:Literal` as the range of a datatype property that has
      // none defined, so an `rdfs:Literal` filler names no target either, and a
      // constructed data range has no node of its own to point at.
      const namesNoTarget = cardinality.data
        ? restriction.filler.kind !== OWLObjectKind.DATATYPE ||
          restriction.filler.iri.value === RDFS_LITERAL_IRI
        : restriction.filler.kind === OWLObjectKind.CLASS &&
          restriction.filler.iri.value === OWL_THING_IRI;
      if (namesNoTarget) {
        this.labelPropertyCardinality(
          this.propertyRecord(restriction.property).attribute,
          cardinality.attribute,
          restriction.cardinality,
        );
        return;
      }
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
        this.addObjectPropertyCharacteristic(property, "functional"),
      [OWLObjectKind.INVERSE_FUNCTIONAL_OBJECT_PROPERTY_AXIOM]: ({
        property,
      }) =>
        this.addObjectPropertyCharacteristic(property, "inverse functional"),
      [OWLObjectKind.REFLEXIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addObjectPropertyCharacteristic(property, "reflexive"),
      [OWLObjectKind.IRREFLEXIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addObjectPropertyCharacteristic(property, "irreflexive"),
      [OWLObjectKind.SYMMETRIC_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addObjectPropertyCharacteristic(property, "symmetric"),
      [OWLObjectKind.ASYMMETRIC_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addObjectPropertyCharacteristic(property, "asymmetric"),
      [OWLObjectKind.TRANSITIVE_OBJECT_PROPERTY_AXIOM]: ({ property }) =>
        this.addObjectPropertyCharacteristic(property, "transitive"),
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

  // Records an annotation assertion as an item under the entity's `annotations`
  // map, carrying whatever the axiom itself annotated it with.
  //
  // `onlyWhenAnnotated` is for the assertions that already have a home of their
  // own - a label, a comment, a description. Those land in their dedicated
  // fields and are not repeated here, except when the axiom carries annotations,
  // which would otherwise have no item to attach to and would be dropped. A
  // plain label therefore keeps exactly the shape it always had.
  addAnnotationItem(
    record,
    axiom,
    axiomAnnotations,
    onlyWhenAnnotated = false,
  ) {
    if (onlyWhenAnnotated && !axiomAnnotations) {
      return;
    }
    const attribute = record.attribute || record;
    const key = localName(axiom.property.iri.value);
    attribute.annotations ||= {};
    attribute.annotations[key] ||= [];
    const item = annotationItem({
      property: axiom.property,
      value: axiom.value,
    });
    if (axiomAnnotations) {
      item.annotations = axiomAnnotations;
    }
    attribute.annotations[key].push(item);
  }

  applyEntityAnnotations() {
    const assertions = this.ontologies.flatMap((ontology) => [
      ...ontology.getAxiomsByType(OWLObjectKind.ANNOTATION_ASSERTION_AXIOM),
    ]);
    // Collected before anything is applied, because an `rdfs:label` may be read
    // before the `skos:prefLabel` that ranks it and the answer must not depend
    // on which came first.
    const preferredLabels = new Map();
    for (const axiom of assertions) {
      if (
        axiom.property.iri.value !== SKOS_PREF_LABEL_IRI ||
        axiom.subject.kind !== OWLObjectKind.IRI ||
        axiom.value.kind !== OWLObjectKind.LITERAL
      ) {
        continue;
      }
      if (!preferredLabels.has(axiom.subject.value)) {
        preferredLabels.set(axiom.subject.value, {});
      }
      // SKOS allows one preferred label per language; a document stating two
      // is malformed, so the code-point rule settles it and the result stays
      // independent of order.
      setLocalizedValue(preferredLabels.get(axiom.subject.value), axiom.value);
    }

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

      // An `owl:Axiom` reification annotates the assertion, not the entity, and
      // OWL 2 keeps those apart: `dcterms:source` on a definition records where
      // the wording came from, not that the class has a source. Promoting it to
      // the entity asserts something the ontology does not say, and leaves it
      // indistinguishable from a source the entity genuinely has - which also
      // discards the very disambiguation `owl:annotatedTarget` exists to
      // provide, and double-counts a value the entity already states.
      //
      // The pinned oracle promotes them. ADR 0004 assigns the VOWL-JSON
      // serialization to the implementation, but that authority covers the
      // shape of the output, not what the ontology means, so the misattribution
      // is not ours to reproduce. The annotation carries its own `annotations`
      // map instead, exactly as an entity does: self-similar, recursive, and
      // unable to collide with the item's own fields.
      const axiomAnnotations = nestedAnnotations(axiom.annotations);

      const propertyIri = axiom.property.iri.value;
      if (axiom.value.kind === OWLObjectKind.LITERAL) {
        this.languages.add(languageKey(axiom.value));
      }
      if (propertyIri === RDFS_LABEL_IRI) {
        if (axiom.value.kind === OWLObjectKind.LITERAL) {
          const attribute = record.attribute || record;
          const field = record.attribute ? "label" : "labels";
          // Merge rather than replace. Assigning a fresh object here discarded
          // both the `IRI-based` label seeded when the entity was created and
          // any language already recorded, so a class labelled in English and
          // German kept only whichever axiom happened to be visited last.
          attribute[field] ||= {};
          setLocalizedValue(
            attribute[field],
            axiom.value,
            preferredLabels.get(axiom.subject.value),
          );
        }
        this.addAnnotationItem(record, axiom, axiomAnnotations, true);
        continue;
      }
      if (propertyIri === RDFS_COMMENT_IRI) {
        if (axiom.value.kind === OWLObjectKind.LITERAL) {
          const attribute = record.attribute || record;
          attribute.comment ||= {};
          setLocalizedValue(attribute.comment, axiom.value);
        }
        this.addAnnotationItem(record, axiom, axiomAnnotations, true);
        continue;
      }
      // VOWL 2 draws a deprecated class or property with the indication
      // "deprecated". OWL 2 states deprecation with the built-in annotation
      // property `owl:deprecated` carrying boolean true, and the RDF translator
      // normalises the OWL 1 `owl:DeprecatedClass` and `owl:DeprecatedProperty`
      // types into that same assertion, so recognising it here covers both
      // spellings. `owl:deprecated false` says the opposite and draws nothing.
      if (propertyIri === OWL_DEPRECATED_IRI) {
        if (
          axiom.value.kind === OWLObjectKind.LITERAL &&
          axiom.value.lexicalForm === "true"
        ) {
          const attribute = record.attribute || record;
          attribute.attributes ||= [];
          if (!attribute.attributes.includes("deprecated")) {
            attribute.attributes.push("deprecated");
          }
        }
        continue;
      }

      const key = localName(propertyIri);
      const attribute = record.attribute || record;
      if (key === "description" && axiom.value.kind === OWLObjectKind.LITERAL) {
        attribute.description ||= {};
        setLocalizedValue(attribute.description, axiom.value);
        this.addAnnotationItem(record, axiom, axiomAnnotations, true);
        continue;
      }
      this.addAnnotationItem(record, axiom, axiomAnnotations);
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
    // VOWL 2 draws a cardinality as a number near the end of the property's
    // arrow, so a cardinality restriction contributes a label rather than an
    // edge of its own. Where the restricted class and the filler are already
    // the property's domain and range, the edge it would add is the edge that
    // is already there, so the figures move onto it and the duplicate goes.
    //
    // Confined to cardinality on purpose. A quantified restriction has no
    // representation in VOWL 2 at all, so the edge drawn for it is an extension
    // whose shape no specification governs, and the pinned oracle draws it
    // separately even when the endpoints coincide. Following the specification
    // where it speaks and the oracle where it is silent puts the two cases on
    // opposite sides of this line.
    //
    // `inferred` is not carried across, because the surviving edge is declared
    // whatever else also supports it. The merged markers are sorted so the
    // result does not depend on the order the relations were built in.
    //
    // Keyed on the property and the class it runs from, not on where it ends.
    // VOWL 2 gives a property one arrow and puts the figure near its end, and
    // Table 6 covers only the unqualified forms - the class a qualified
    // cardinality names has no representation in the notation at all. So a
    // cardinality restricting a class labels that class's arrow whatever filler
    // it names, and only a restriction on some *other* class is a different
    // arrow needing one of its own.
    const arrowKey = ({ attribute }) =>
      `${attribute.iri ?? ""}|${attribute.domain}`;
    const baseByEdge = new Map(
      visibleBaseProperties.map((property) => [arrowKey(property), property]),
    );
    const merged = new Set();
    const unmergedRelations = this.#relations.filter((relation) => {
      const carriedCardinalities = CARDINALITY_FIELDS.filter(
        (field) => relation.attribute[field] !== undefined,
      );
      if (carriedCardinalities.length === 0) {
        return true;
      }
      const base = baseByEdge.get(arrowKey(relation));
      if (!base) {
        return true;
      }
      for (const field of carriedCardinalities) {
        this.labelPropertyCardinality(
          base.attribute,
          field,
          Number(relation.attribute[field]),
        );
      }
      for (const attribute of relation.attribute.attributes) {
        if (
          attribute !== "inferred" &&
          !base.attribute.attributes.includes(attribute)
        ) {
          base.attribute.attributes.push(attribute);
        }
      }
      merged.add(base);
      return false;
    });
    for (const base of merged) {
      base.attribute.attributes.sort(compareText);
    }
    const properties = [...visibleBaseProperties, ...unmergedRelations];
    const splitCopies = this.splitGenericNodes(properties);
    const connectedClassIds = new Set(
      properties.flatMap(({ attribute }) => [
        String(attribute.domain),
        String(attribute.range),
      ]),
    );
    // VOWL 2's splitting rules make the generic elements exist only in relation
    // to what links to them: a datatype or `rdfs:Literal` is drawn once for
    // every property it is linked to, and `owl:Thing` once for every class, so
    // an element nothing links to is drawn zero times. Being declared puts a
    // datatype in the ontology's signature, not in the visualisation -
    // `marinetlo.owl` declares `xsd:date` and never uses it.
    //
    // Named classes are not subject to this. An isolated class is still a class
    // and is still drawn; the rule names the generic elements only.
    const GENERIC_NODE_TYPES = new Set([
      "owl:Thing",
      "rdfs:Datatype",
      "rdfs:Literal",
    ]);
    const classes = [...this.#classRecords.values(), ...splitCopies].filter(
      ({ node }) =>
        !GENERIC_NODE_TYPES.has(node.type) || connectedClassIds.has(node.id),
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
      // The placeholder is applied here rather than on `this.header`, because
      // `isExternalEntityIri` reads the header IRI as a prefix to compare
      // against and treats an empty value as "cannot judge". A truthy
      // placeholder in that comparison would mark every entity in a headerless
      // document external.
      header: { ...this.header, iri: this.header.iri || MISSING_ONTOLOGY_IRI },
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
    // Data properties first, deliberately. `ensureProperty` keeps the record it
    // created first, so this ordering is what enforces ADR 0005's fixed
    // precedence - data > object > annotation - for an IRI that appears in more
    // than one property signature. That only happens in compatible mode, where
    // the axiom-level reuse recovery re-admits a punned IRI into the
    // object-property signature after the translator resolved it to data.
    for (const property of sortByIri(
      signatureValues("getDataPropertiesInSignature"),
    )) {
      state.ensureProperty(property, "owl:datatypeProperty");
    }
    for (const property of sortByIri(
      signatureValues("getObjectPropertiesInSignature"),
    )) {
      state.ensureProperty(property, "owl:objectProperty");
    }
    state.applyOntologyAnnotations();
    state.applyAxioms();
    state.applyIntersectedEndpoints();
    state.applyInverseEndpoints();
    state.applyEntityAnnotations();
    return state.result();
  }
}
