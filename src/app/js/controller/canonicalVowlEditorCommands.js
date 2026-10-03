import { createCanonicalVowlRenderProjection } from "./canonicalVowlRenderProjection.js";

function rejected(code) {
  const error = new Error(code.replaceAll("_", " ").toLowerCase());
  error.code = code;
  return error;
}

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
function editorLabelLanguage(language) {
  return ["default", "undefined", "IRI-based"].includes(language)
    ? ""
    : language;
}
const FIXED_IRIS = new Set([
  "http://www.w3.org/2002/07/owl#Thing",
  "http://www.w3.org/2002/07/owl#Nothing",
  "http://www.w3.org/2000/01/rdf-schema#Literal",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
]);

function selectedRole(inspection, id) {
  const role = inspection.records.roles.find((record) => record.id === id);
  const subject = inspection.records.subjects.find(
    (record) => record.id === role?.subject,
  );
  if (!role || !subject) {
    throw rejected("EDITOR_TARGET_INVALID");
  }
  return { role, subject };
}

function localHandle(inspection, prefix) {
  const reserved = new Set(
    ["subjects", "roles", "expressions", "constructs"].flatMap((collection) =>
      inspection.records[collection].map(({ id }) => id),
    ),
  );
  for (const { id } of inspection.occurrences) {
    reserved.add(id);
  }
  let sequence = 1;
  while (reserved.has(`${prefix}-${sequence}`)) {
    sequence++;
  }
  return `${prefix}-${sequence}`;
}

/** Rename one unambiguous editor subject; the package validates the new IRI. */
export function prepareCanonicalIriEdit(inspection, { target, iri }) {
  const { subject } = selectedRole(inspection, target);
  if (typeof iri !== "string" || !iri) {
    throw rejected("EDITOR_IRI_INVALID");
  }
  if (iri === subject.iri) {
    return { baseRevision: inspection.revision, changes: [] };
  }
  if (FIXED_IRIS.has(subject.iri)) {
    throw rejected("EDITOR_BUILTIN_IRI_FIXED");
  }
  if (
    inspection.records.roles.filter((role) => role.subject === subject.id)
      .length !== 1
  ) {
    throw rejected("EDITOR_SHARED_SUBJECT_RENAME");
  }
  if (
    inspection.records.subjects.some(
      (record) => record.id !== subject.id && record.iri === iri,
    )
  ) {
    throw rejected("EDITOR_DUPLICATE_IRI");
  }
  return {
    baseRevision: inspection.revision,
    changes: [{ kind: "replace", id: subject.id, record: { ...subject, iri } }],
  };
}

/** Edit the selected subject/language assertion, preserving its exact anchors. */
export function prepareCanonicalLabelEdit(
  inspection,
  { target, language = "", text },
) {
  const { subject } = selectedRole(inspection, target);
  if (typeof language !== "string" || typeof text !== "string") {
    throw rejected("EDITOR_LABEL_INVALID");
  }
  const selectedLanguage = language.toLowerCase();
  const labels = inspection.records.constructs.filter(
    (record) =>
      record.kind === "annotation-assertion" &&
      record.subject === subject.id &&
      record.predicate === RDFS_LABEL &&
      (record.value.kind === "language" ? record.value.language : "") ===
        selectedLanguage,
  );
  if (labels.length > 1) {
    throw rejected("EDITOR_LABEL_AMBIGUOUS");
  }
  const previous = labels[0];
  if (
    previous &&
    !(
      previous.value.kind === "language" ||
      (previous.value.kind === "typed" &&
        previous.value.datatype === XSD_STRING)
    )
  ) {
    throw rejected("EDITOR_LABEL_VALUE_UNSUPPORTED");
  }
  const value = previous
    ? { ...previous.value, lexical: text }
    : selectedLanguage
      ? { kind: "language", language: selectedLanguage, lexical: text }
      : { kind: "typed", datatype: XSD_STRING, lexical: text };
  const record = previous
    ? { ...previous, value }
    : {
        id: localHandle(inspection, "editor-label"),
        kind: "annotation-assertion",
        subject: subject.id,
        predicate: RDFS_LABEL,
        value,
      };
  return {
    baseRevision: inspection.revision,
    changes: [
      previous
        ? { kind: "replace", id: previous.id, record }
        : { kind: "insert", collection: "constructs", record },
    ],
  };
}

/**
 * Translate one explicit human endpoint choice. The caller resolves its current
 * semantic targets and explains inverse detachment before submitting this batch.
 * The package owns normalization, anchor retargeting and semantic validation.
 */
export function prepareCanonicalEndpointEdit(
  inspection,
  { property, endpoint, target },
) {
  if (!["domain", "range"].includes(endpoint)) {
    throw rejected("EDITOR_ENDPOINT_INVALID");
  }
  const structural = inspection.records;
  const role = structural.roles.find(({ id }) => id === property);
  const family = new Map([
    ["object-property", "object"],
    ["data-property", "data"],
    ["rdf-property", "rdf"],
  ]).get(role?.kind);
  if (
    !family ||
    ![...structural.roles, ...structural.expressions].some(
      ({ id }) => id === target,
    )
  ) {
    throw rejected("EDITOR_ENDPOINT_INVALID");
  }
  const kind = `${family}-${endpoint}`;
  const assertions = structural.constructs.filter(
    (record) => record.kind === kind && record.property === property,
  );
  if (assertions.length > 1) {
    throw rejected("EDITOR_ENDPOINT_AMBIGUOUS");
  }
  const inverses = structural.constructs.filter(
    (record) =>
      record.kind === "inverse-properties" && record.members.includes(property),
  );
  const annotatedInverse = structural.constructs.some(
    (record) =>
      record.kind === "assertion-anchor" &&
      record.assertion.kind === "inverse-properties" &&
      record.assertion.members.includes(property),
  );
  if (annotatedInverse) {
    throw rejected("EDITOR_ANNOTATED_INVERSE_REQUIRES_EXACT_DELETION");
  }
  const changes = inverses.map(({ id }) => ({ kind: "remove", id }));
  if (assertions.length) {
    changes.push({ kind: "set-endpoint", construct: assertions[0].id, target });
  } else {
    // Assert only the endpoint the person chose, never the other drawing default.
    changes.push({
      kind: "insert",
      collection: "constructs",
      record: {
        id: localHandle(inspection, "editor-endpoint"),
        kind,
        property,
        target,
      },
    });
  }
  return {
    baseRevision: inspection.revision,
    changes,
    detachedInverses: structuredClone(inverses),
    requiresInverseDetachmentExplanation: inverses.length > 0,
  };
}

/** Prepare the exact dependency closure from package-owned typed references. */
export function prepareCanonicalDeletion(inspection, { target }) {
  const records = new Map(
    ["subjects", "roles", "expressions", "constructs"].flatMap((collection) =>
      inspection.records[collection].map((record) => [
        record.id,
        { collection, record },
      ]),
    ),
  );
  const selected = records.get(target);
  if (!selected || !Array.isArray(inspection.dependencies)) {
    throw rejected("EDITOR_DELETION_TARGET_INVALID");
  }
  const removed = new Set([target]);
  if (selected.collection === "roles") {
    const subject = records.get(selected.record.subject).record;
    if (FIXED_IRIS.has(subject.iri)) {
      throw rejected("EDITOR_BUILTIN_DELETION_FORBIDDEN");
    }
    if (
      inspection.records.roles.filter((role) => role.subject === subject.id)
        .length === 1
    ) {
      removed.add(subject.id);
    }
  }
  const dependents = new Map();
  for (const dependency of inspection.dependencies) {
    for (const requirement of dependency.requires) {
      const ids = dependents.get(requirement) ?? [];
      ids.push(dependency.record);
      dependents.set(requirement, ids);
    }
  }
  const queue = [...removed];
  for (let index = 0; index < queue.length; index++) {
    for (const dependent of dependents.get(queue[index]) ?? []) {
      if (!removed.has(dependent)) {
        removed.add(dependent);
        queue.push(dependent);
      }
    }
  }
  if (inspection.ontologyDependencies.some((id) => removed.has(id))) {
    throw rejected("EDITOR_DELETION_REQUIRES_METADATA_EDIT");
  }
  const stillRequired = new Set([
    ...inspection.ontologyDependencies,
    ...inspection.dependencies
      .filter((dependency) => !removed.has(dependency.record))
      .flatMap((dependency) => dependency.requires),
  ]);
  for (const subject of inspection.records.subjects) {
    if (!stillRequired.has(subject.id)) {
      removed.add(subject.id);
    }
  }
  const removedRecords = [...removed].map((id) => records.get(id));
  return {
    baseRevision: inspection.revision,
    changes: [...removed].map((id) => ({ kind: "remove", id })),
    removedRecords: structuredClone(removedRecords),
    annotationLosses: structuredClone(
      removedRecords.filter(({ record }) =>
        ["annotation-assertion", "assertion-anchor"].includes(record.kind),
      ),
    ),
    requiresDeletionConfirmation: true,
  };
}

/** Named creation intent can normalize to an existing role; selection follows meaning. */
export function prepareCanonicalInsertion(
  inspection,
  {
    roleKind,
    iri,
    text,
    language = "",
    domain,
    range,
    datatypeIri,
    deprecated = false,
  },
) {
  if (
    !["class", "datatype", "object-property", "data-property"].includes(
      roleKind,
    ) ||
    typeof iri !== "string" ||
    !iri
  ) {
    throw rejected("EDITOR_INSERTION_INVALID");
  }
  const subject = localHandle(inspection, "editor-created-subject");
  const role = localHandle(inspection, "editor-created-role");
  const changes = [
    { kind: "insert", collection: "subjects", record: { id: subject, iri } },
    {
      kind: "insert",
      collection: "roles",
      record: { id: role, subject, kind: roleKind },
    },
  ];
  if (datatypeIri !== undefined) {
    if (roleKind !== "data-property" || range !== undefined) {
      throw rejected("EDITOR_INSERTION_INVALID");
    }
    const datatypeSubject = localHandle(
      inspection,
      "editor-created-datatype-subject",
    );
    range = localHandle(inspection, "editor-created-datatype-role");
    changes.push(
      {
        kind: "insert",
        collection: "subjects",
        record: { id: datatypeSubject, iri: datatypeIri },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: range, subject: datatypeSubject, kind: "datatype" },
      },
    );
  }
  if (deprecated) {
    if (roleKind !== "class") {
      throw rejected("EDITOR_INSERTION_INVALID");
    }
    changes.push({
      kind: "insert",
      collection: "constructs",
      record: {
        id: localHandle(inspection, "editor-created-deprecation"),
        kind: "annotation-assertion",
        subject,
        predicate: "http://www.w3.org/2002/07/owl#deprecated",
        value: {
          kind: "typed",
          datatype: "http://www.w3.org/2001/XMLSchema#boolean",
          lexical: "true",
        },
      },
    });
  }
  if (text !== undefined) {
    if (typeof text !== "string" || typeof language !== "string") {
      throw rejected("EDITOR_LABEL_INVALID");
    }
    changes.push({
      kind: "insert",
      collection: "constructs",
      record: {
        id: localHandle(inspection, "editor-created-label"),
        kind: "annotation-assertion",
        subject,
        predicate: RDFS_LABEL,
        value: language
          ? {
              kind: "language",
              language: language.toLowerCase(),
              lexical: text,
            }
          : { kind: "typed", datatype: XSD_STRING, lexical: text },
      },
    });
  }
  for (const [endpoint, target] of [
    ["domain", domain],
    ["range", range],
  ]) {
    if (target === undefined) {
      continue;
    }
    if (!["object-property", "data-property"].includes(roleKind)) {
      throw rejected("EDITOR_INSERTION_INVALID");
    }
    changes.push({
      kind: "insert",
      collection: "constructs",
      record: {
        id: localHandle(inspection, `editor-created-${endpoint}`),
        kind: `${roleKind === "object-property" ? "object" : "data"}-${endpoint}`,
        property: role,
        target,
      },
    });
  }
  return {
    baseRevision: inspection.revision,
    changes,
    selectionIntent: { roleKind, iri },
  };
}

function resolveCreatedMeaning(
  inspection,
  { roleKind, iri, constructKind, previousReferences, restrictionKind },
  correspondence = [],
) {
  if (constructKind) {
    const mapping = new Map(
      correspondence.map(({ previous, current }) => [previous, current]),
    );
    const ids = previousReferences.map((id) => mapping.get(id));
    const restrictions = new Set(
      inspection.records.expressions
        .filter(
          (record) =>
            record.kind === restrictionKind &&
            record.filler === ids[1] &&
            record.property === ids[2],
        )
        .map(({ id }) => id),
    );
    const matches = ids.every((id) => typeof id === "string")
      ? inspection.records.constructs.filter(
          (record) =>
            record.kind === constructKind &&
            (constructKind === "subclass"
              ? record.sub === ids[0] &&
                (restrictionKind
                  ? restrictions.has(record.super)
                  : record.super === ids[1])
              : record.members.length === new Set(ids).size &&
                ids.every((id) => record.members.includes(id))),
        )
      : [];
    if (matches.length !== 1) {
      throw rejected("EDITOR_CONVERSION_SELECTION_AMBIGUOUS");
    }
    return matches[0].id;
  }
  const subjects = new Set(
    inspection.records.subjects
      .filter((subject) => subject.iri === iri)
      .map(({ id }) => id),
  );
  const matches = inspection.records.roles.filter(
    (role) => role.kind === roleKind && subjects.has(role.subject),
  );
  if (matches.length !== 1) {
    throw rejected("EDITOR_INSERTION_SELECTION_AMBIGUOUS");
  }
  return matches[0].id;
}

/** Replace one asserted row, copying a shared restriction rather than editing it. */
export function prepareCanonicalRelationEdit(
  inspection,
  { target, relation, from, to, property },
) {
  return prepareRelation(
    inspection,
    { target, relation, from, to, property },
    false,
  );
}

/** Canvas relations enter through the same typed relation builder as replacements. */
export function prepareCanonicalRelationInsertion(
  inspection,
  { relation, from, to, property },
) {
  return prepareRelation(
    inspection,
    {
      target: localHandle(inspection, "editor-created-relation"),
      relation,
      from,
      to,
      property,
    },
    true,
  );
}

function prepareRelation(
  inspection,
  { target, relation, from, to, property },
  insert,
) {
  const previous = inspection.records.constructs.find(
    ({ id }) => id === target,
  );
  if (
    !insert &&
    (!previous || !["subclass", "disjoint-classes"].includes(previous.kind))
  ) {
    throw rejected("EDITOR_RELATION_TARGET_INVALID");
  }
  if (previous?.kind === "disjoint-classes" && previous.members.length !== 2) {
    throw rejected("EDITOR_RELATION_AMBIGUOUS");
  }
  const restriction = inspection.records.expressions.find(
    ({ id, kind }) =>
      id === previous?.super && ["object-some", "object-all"].includes(kind),
  );
  const source = from ?? previous?.sub;
  const destination = to ?? restriction?.filler ?? previous?.super;
  // A disjoint pair has no intrinsic direction: the selected row must supply it.
  if (source === undefined || destination === undefined) {
    throw rejected("EDITOR_RELATION_ENDPOINT_REQUIRED");
  }
  const classes = new Set([
    ...inspection.records.roles
      .filter(({ kind }) => kind === "class")
      .map(({ id }) => id),
    ...inspection.records.expressions
      .filter(
        ({ kind }) =>
          kind !== "object-inverse" &&
          !kind.startsWith("data-") &&
          kind !== "datatype-restriction",
      )
      .map(({ id }) => id),
  ]);
  if (!classes.has(source) || !classes.has(destination)) {
    throw rejected("EDITOR_RELATION_ENDPOINT_INVALID");
  }
  if (["subclass", "disjoint"].includes(relation) && source === destination) {
    throw rejected("EDITOR_RELATION_LOOP_UNSUPPORTED");
  }
  const changes = [];
  let record;
  if (relation === "subclass") {
    record = { id: target, kind: "subclass", sub: source, super: destination };
  } else if (relation === "disjoint") {
    record = {
      id: target,
      kind: "disjoint-classes",
      members: [source, destination],
    };
  } else if (["some", "all"].includes(relation)) {
    const selectedProperty = property ?? restriction?.property;
    if (
      !inspection.records.roles.some(
        ({ id, kind }) => id === selectedProperty && kind === "object-property",
      ) &&
      !inspection.records.expressions.some(
        ({ id, kind }) => id === selectedProperty && kind === "object-inverse",
      )
    ) {
      throw rejected("EDITOR_RELATION_PROPERTY_REQUIRED");
    }
    const expression = localHandle(inspection, "editor-restriction");
    changes.push({
      kind: "insert",
      collection: "expressions",
      record: {
        id: expression,
        kind: `object-${relation}`,
        property: selectedProperty,
        filler: destination,
      },
    });
    record = { id: target, kind: "subclass", sub: source, super: expression };
  } else {
    throw rejected("EDITOR_RELATION_INVALID");
  }
  // Package replacement retargets the selected assertion's annotations. It also
  // prunes a now-unreachable old expression; other assertions retain their copy.
  changes.push(
    insert
      ? { kind: "insert", collection: "constructs", record }
      : { kind: "replace", id: target, record },
  );
  return {
    baseRevision: inspection.revision,
    changes,
    ...(insert
      ? {
          selectionIntent: {
            constructKind: record.kind,
            previousReferences: [
              source,
              destination,
              ...(["some", "all"].includes(relation) ? [property] : []),
            ],
            ...(["some", "all"].includes(relation)
              ? { restrictionKind: `object-${relation}` }
              : {}),
          },
        }
      : {}),
  };
}

/** A contextual datatype choice changes its selected range, not the datatype globally. */
export function prepareCanonicalDatatypeEdit(
  inspection,
  { target, datatypeIri, occurrence },
) {
  const { role, subject } = selectedRole(inspection, target);
  if (
    role.kind !== "datatype" ||
    typeof datatypeIri !== "string" ||
    !datatypeIri
  ) {
    throw rejected("EDITOR_DATATYPE_INVALID");
  }
  if (occurrence === undefined) {
    return prepareCanonicalIriEdit(inspection, { target, iri: datatypeIri });
  }
  const selected = inspection.occurrences.find(({ id }) => id === occurrence);
  if (selected?.kind !== "datatype-node" || selected.target !== target) {
    throw rejected("EDITOR_DATATYPE_CONTEXT_INVALID");
  }
  if (subject.iri === datatypeIri) {
    return { baseRevision: inspection.revision, changes: [] };
  }
  const newSubject = localHandle(inspection, "editor-datatype-subject");
  const newRole = localHandle(inspection, "editor-datatype-role");
  const changes = [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: newSubject, iri: datatypeIri },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: newRole, kind: "datatype", subject: newSubject },
    },
  ];
  if (selected.context.scope !== undefined) {
    const assertion = inspection.records.constructs.find(
      ({ id }) => id === selected.context.scope,
    );
    const expression = inspection.records.expressions.find(
      ({ id }) => id === assertion?.super,
    );
    if (
      assertion?.kind !== "subclass" ||
      !/^data-(min|max|exact)-cardinality$/.test(expression?.kind ?? "") ||
      expression.filler !== target
    ) {
      throw rejected("EDITOR_DATATYPE_CONTEXT_INVALID");
    }
    const replacement = localHandle(inspection, "editor-datatype-restriction");
    changes.push(
      {
        kind: "insert",
        collection: "expressions",
        record: { ...expression, id: replacement, filler: newRole },
      },
      {
        kind: "replace",
        id: assertion.id,
        record: { ...assertion, super: replacement },
      },
    );
  } else {
    if (selected.context.properties.length !== 1) {
      throw rejected("EDITOR_DATATYPE_CONTEXT_AMBIGUOUS");
    }
    const property = inspection.records.roles.find(
      ({ id }) => id === selected.context.properties[0],
    );
    const kind = { "data-property": "data-range", "rdf-property": "rdf-range" }[
      property?.kind
    ];
    const ranges = inspection.records.constructs.filter(
      (fact) => fact.kind === kind && fact.property === property?.id,
    );
    if (
      !kind ||
      ranges.length > 1 ||
      (ranges[0] && ranges[0].target !== target)
    ) {
      throw rejected("EDITOR_DATATYPE_CONTEXT_INVALID");
    }
    changes.push(
      ranges[0]
        ? { kind: "set-endpoint", construct: ranges[0].id, target: newRole }
        : {
            kind: "insert",
            collection: "constructs",
            record: {
              id: localHandle(inspection, "editor-datatype-range"),
              kind,
              property: property.id,
              target: newRole,
            },
          },
    );
  }
  return {
    baseRevision: inspection.revision,
    changes,
    selectionIntent: { roleKind: "datatype", iri: datatypeIri },
  };
}

export function prepareCanonicalMetadataEdit(inspection, changes) {
  const ontology = structuredClone(inspection.records.ontology);
  const predicates = {
    title: "http://purl.org/dc/elements/1.1/title",
    description: "http://purl.org/dc/elements/1.1/description",
    author: "http://purl.org/dc/elements/1.1/creator",
    version: "http://www.w3.org/2002/07/owl#versionInfo",
  };
  for (const [field, change] of Object.entries(changes)) {
    if (field === "iri") {
      if (typeof change !== "string" || !change) {
        throw rejected("EDITOR_IRI_INVALID");
      }
      ontology.iri = change;
      continue;
    }
    if (!Object.hasOwn(predicates, field)) {
      throw rejected("EDITOR_METADATA_INVALID");
    }
    const localized = ["title", "description"].includes(field);
    const text = localized ? change?.text : change;
    const selectedLanguage = localized
      ? editorLabelLanguage(change?.language)?.toLowerCase()
      : "";
    if (typeof text !== "string" || typeof selectedLanguage !== "string") {
      throw rejected("EDITOR_METADATA_INVALID");
    }
    const matches = ontology.annotations.filter(
      (annotation) =>
        annotation.predicate === predicates[field] &&
        (annotation.value.language ?? "") === selectedLanguage,
    );
    if (matches.length > 1) {
      throw rejected("EDITOR_METADATA_AMBIGUOUS");
    }
    const previous = matches[0];
    if (
      previous &&
      !(
        previous.value.kind === "language" ||
        (previous.value.kind === "typed" &&
          previous.value.datatype === XSD_STRING)
      )
    ) {
      throw rejected("EDITOR_METADATA_VALUE_UNSUPPORTED");
    }
    const value = previous
      ? { ...previous.value, lexical: text }
      : selectedLanguage
        ? { kind: "language", language: selectedLanguage, lexical: text }
        : { kind: "typed", datatype: XSD_STRING, lexical: text };
    if (previous) {
      previous.value = value;
    } else {
      ontology.annotations.push({
        predicate: predicates[field],
        value,
        annotations: [],
      });
    }
  }
  return {
    baseRevision: inspection.revision,
    changes: [{ kind: "set-ontology", ontology }],
  };
}

export function prepareCanonicalCharacteristicEdit(
  inspection,
  { target, characteristic, enabled },
) {
  const { role, subject } = selectedRole(inspection, target);
  const available =
    role.kind === "object-property"
      ? ["functional", "inverse functional", "transitive", "deprecated"]
      : ["data-property", "rdf-property"].includes(role.kind)
        ? ["functional", "deprecated"]
        : ["deprecated"];
  if (typeof enabled !== "boolean" || !available.includes(characteristic)) {
    throw rejected("EDITOR_CHARACTERISTIC_INVALID");
  }
  const normalized = characteristic.replaceAll(" ", "-");
  const deprecated = characteristic === "deprecated";
  const predicate = "http://www.w3.org/2002/07/owl#deprecated";
  const matches = inspection.records.constructs.filter((record) =>
    deprecated
      ? record.kind === "annotation-assertion" &&
        record.subject === subject.id &&
        record.predicate === predicate
      : record.kind.endsWith("-characteristic") &&
        record.property === target &&
        record.characteristic === normalized,
  );
  if (matches.length > 1) {
    throw rejected("EDITOR_CHARACTERISTIC_AMBIGUOUS");
  }
  const previous = matches[0];
  if (deprecated && previous) {
    if (
      previous.value.kind !== "typed" ||
      previous.value.datatype !== "http://www.w3.org/2001/XMLSchema#boolean" ||
      !["true", "false", "1", "0"].includes(previous.value.lexical)
    ) {
      throw rejected("EDITOR_CHARACTERISTIC_AMBIGUOUS");
    }
    const active = ["true", "1"].includes(previous.value.lexical);
    if (active === enabled) {
      return { baseRevision: inspection.revision, changes: [] };
    }
    if (enabled) {
      return {
        baseRevision: inspection.revision,
        changes: [
          {
            kind: "replace",
            id: previous.id,
            record: {
              ...previous,
              value: { ...previous.value, lexical: "true" },
            },
          },
        ],
      };
    }
  }
  if (previous && !enabled) {
    if (
      inspection.dependencies.some(
        (dependency) =>
          dependency.requires.includes(previous.id) &&
          inspection.records.constructs.some(
            (record) =>
              record.id === dependency.record &&
              record.kind === "assertion-anchor",
          ),
      )
    ) {
      throw rejected("EDITOR_ANNOTATED_CHARACTERISTIC_REQUIRES_EXACT_DELETION");
    }
    return {
      baseRevision: inspection.revision,
      changes: [{ kind: "remove", id: previous.id }],
    };
  }
  if (previous || !enabled) {
    return { baseRevision: inspection.revision, changes: [] };
  }
  const record = deprecated
    ? {
        id: localHandle(inspection, "editor-deprecated"),
        kind: "annotation-assertion",
        subject: subject.id,
        predicate,
        value: {
          kind: "typed",
          datatype: "http://www.w3.org/2001/XMLSchema#boolean",
          lexical: "true",
        },
      }
    : {
        id: localHandle(inspection, `editor-${normalized}`),
        kind: `${{ "object-property": "object", "data-property": "data", "rdf-property": "rdf" }[role.kind]}-characteristic`,
        property: target,
        characteristic: normalized,
      };
  return {
    baseRevision: inspection.revision,
    changes: [{ kind: "insert", collection: "constructs", record }],
  };
}

/** Preserve the existing bounded class-type vocabulary. */
export function prepareCanonicalClassTypeEdit(inspection, { target, type }) {
  const { role, subject } = selectedRole(inspection, target);
  if (
    role.kind !== "class" ||
    !["owl:Class", "owl:Thing", "owl:DeprecatedClass"].includes(type)
  ) {
    throw rejected("EDITOR_CLASS_TYPE_INVALID");
  }
  if (type !== "owl:Class") {
    const expressions = new Map(
      inspection.records.expressions.map((entry) => [entry.id, entry]),
    );
    if (
      inspection.records.constructs.some((fact) => {
        const expression = expressions.get(fact.super);
        return (
          fact.kind === "subclass" &&
          ["object-some", "object-all"].includes(expression?.kind) &&
          (fact.sub === target || expression.filler === target)
        );
      })
    ) {
      throw rejected("EDITOR_ATTACHED_RESTRICTION_PREVENTS_TYPE_CHANGE");
    }
  }
  const thing = "http://www.w3.org/2002/07/owl#Thing";
  if (
    FIXED_IRIS.has(subject.iri) &&
    !(subject.iri === thing && type === "owl:Thing")
  ) {
    throw rejected("EDITOR_BUILTIN_TYPE_FIXED");
  }
  const changes =
    type === "owl:Thing"
      ? prepareCanonicalIriEdit(inspection, { target, iri: thing }).changes
      : [];
  changes.push(
    ...prepareCanonicalCharacteristicEdit(inspection, {
      target,
      characteristic: "deprecated",
      enabled: type === "owl:DeprecatedClass",
    }).changes,
  );
  return { baseRevision: inspection.revision, changes };
}

/** Convert only an isolated, unannotated named property with asserted endpoints. */
export function prepareCanonicalPropertyTypeEdit(inspection, { target, type }) {
  const construct = inspection.records.constructs.find(
    ({ id }) => id === target,
  );
  const relation = {
    "rdfs:subClassOf": "subclass",
    "owl:disjointWith": "disjoint",
    "owl:someValuesFrom": "some",
    "owl:allValuesFrom": "all",
  }[type];
  if (construct) {
    if (!relation) {
      throw rejected("EDITOR_CONVERSION_REQUIRES_EXPLICIT_PROPERTY");
    }
    if (construct.kind === "disjoint-classes" && relation === "disjoint") {
      return { baseRevision: inspection.revision, changes: [] };
    }
    return prepareCanonicalRelationEdit(inspection, { target, relation });
  }
  const { role, subject } = selectedRole(inspection, target);
  if (
    (role.kind === "data-property" && type === "owl:datatypeProperty") ||
    (role.kind === "object-property" && type === "owl:objectProperty")
  ) {
    return { baseRevision: inspection.revision, changes: [] };
  }
  if (
    role.kind !== "object-property" ||
    !["subclass", "disjoint"].includes(relation)
  ) {
    throw rejected("EDITOR_PROPERTY_TYPE_INVALID");
  }
  const domains = inspection.records.constructs.filter(
    (fact) => fact.kind === "object-domain" && fact.property === target,
  );
  const ranges = inspection.records.constructs.filter(
    (fact) => fact.kind === "object-range" && fact.property === target,
  );
  if (domains.length !== 1 || ranges.length !== 1) {
    throw rejected("EDITOR_CONVERSION_REQUIRES_ASSERTED_ENDPOINTS");
  }
  const removed = new Set([role.id, subject.id, domains[0].id, ranges[0].id]);
  if (
    inspection.ontologyDependencies.some((id) => removed.has(id)) ||
    inspection.dependencies.some(
      (entry) =>
        !removed.has(entry.record) &&
        entry.requires.some((id) => removed.has(id)),
    )
  ) {
    throw rejected("EDITOR_SHARED_OR_ANNOTATED_CONVERSION");
  }
  const constructKind =
    relation === "subclass" ? "subclass" : "disjoint-classes";
  const id = localHandle(inspection, "editor-converted-relation");
  const from = domains[0].target;
  const to = ranges[0].target;
  if (from === to) {
    throw rejected("EDITOR_RELATION_LOOP_UNSUPPORTED");
  }
  const record =
    relation === "subclass"
      ? { id, kind: constructKind, sub: from, super: to }
      : { id, kind: constructKind, members: [from, to] };
  return {
    baseRevision: inspection.revision,
    changes: [...removed]
      .map((id) => ({ kind: "remove", id }))
      .concat({ kind: "insert", collection: "constructs", record }),
    selectionIntent: { constructKind, previousReferences: [from, to] },
  };
}

/** One sidebar submission is one package transaction, including label/IRI pairs. */
export function prepareCanonicalRecordEdit(inspection, { target, changes }) {
  if (
    !changes ||
    Array.isArray(changes) ||
    Object.keys(changes).length === 0 ||
    Object.keys(changes).some(
      (field) => !["iri", "label", "characteristics", "type"].includes(field),
    )
  ) {
    throw rejected("EDITOR_RECORD_EDIT_INVALID");
  }
  const batch = [];
  if (changes.type !== undefined) {
    // A type control submits one choice. Do not combine independent replacement
    // descriptions for the same subject/annotation in an ambiguous batch.
    if (Object.keys(changes).length !== 1) {
      throw rejected("EDITOR_RECORD_EDIT_INVALID");
    }
    const classRole = inspection.records.roles.some(
      (role) => role.id === target && role.kind === "class",
    );
    return (
      classRole
        ? prepareCanonicalClassTypeEdit
        : prepareCanonicalPropertyTypeEdit
    )(inspection, {
      target,
      type: changes.type,
    });
  }
  if (changes.iri !== undefined) {
    batch.push(
      ...prepareCanonicalIriEdit(inspection, { target, iri: changes.iri })
        .changes,
    );
  }
  if (changes.label !== undefined) {
    batch.push(
      ...prepareCanonicalLabelEdit(inspection, {
        target,
        text: changes.label?.text,
        language: editorLabelLanguage(changes.label?.language),
      }).changes,
    );
  }
  if (changes.characteristics !== undefined) {
    if (
      !changes.characteristics ||
      Array.isArray(changes.characteristics) ||
      typeof changes.characteristics !== "object"
    ) {
      throw rejected("EDITOR_CHARACTERISTIC_INVALID");
    }
    for (const [characteristic, enabled] of Object.entries(
      changes.characteristics,
    )) {
      batch.push(
        ...prepareCanonicalCharacteristicEdit(inspection, {
          target,
          characteristic,
          enabled,
        }).changes,
      );
    }
  }
  return { baseRevision: inspection.revision, changes: batch };
}

/** Execute a human command against its selected session revision and targets. */
export async function applyCanonicalEditorCommand(
  session,
  command,
  {
    renderedGraphRuntime,
    confirmInverseDetachment,
    confirmDeletion,
    reconcile,
    prepareVisibility,
    signal,
  } = {},
) {
  signal?.throwIfAborted();
  const intent = structuredClone(command);
  const base = session.snapshot();
  if (intent.documentRevision !== base.documentRevision) {
    throw rejected("EDITOR_COMMAND_EXPIRED");
  }
  const target = ["insert", "insert-relation", "metadata"].includes(intent.kind)
    ? undefined
    : session.resolveTarget(intent.target);
  let proposal;
  switch (intent.kind) {
    case "datatype":
      proposal = prepareCanonicalDatatypeEdit(base.inspection, {
        target,
        datatypeIri: intent.datatypeIri,
        occurrence:
          intent.occurrence === undefined
            ? undefined
            : session.scene().resolve(intent.occurrence),
      });
      break;
    case "record":
      proposal = prepareCanonicalRecordEdit(base.inspection, {
        target,
        changes: intent.changes,
      });
      break;
    case "relation":
      proposal = prepareCanonicalRelationEdit(base.inspection, {
        target,
        relation: intent.relation,
        from:
          intent.from === undefined
            ? undefined
            : session.resolveTarget(intent.from),
        to:
          intent.to === undefined
            ? undefined
            : session.resolveTarget(intent.to),
        property:
          intent.property === undefined
            ? undefined
            : session.resolveTarget(intent.property),
      });
      break;
    case "metadata":
      proposal = prepareCanonicalMetadataEdit(base.inspection, intent.changes);
      break;
    case "characteristic":
      proposal = prepareCanonicalCharacteristicEdit(base.inspection, {
        target,
        characteristic: intent.characteristic,
        enabled: intent.enabled,
      });
      break;
    case "insert-relation":
      proposal = prepareCanonicalRelationInsertion(base.inspection, {
        relation: intent.relation,
        from: session.resolveTarget(intent.from),
        to: session.resolveTarget(intent.to),
        property:
          intent.property === undefined
            ? undefined
            : session.resolveTarget(intent.property),
      });
      break;
    case "insert":
      proposal = prepareCanonicalInsertion(base.inspection, {
        roleKind: intent.roleKind,
        iri: intent.iri,
        text: intent.text,
        language: intent.language,
        datatypeIri: intent.datatypeIri,
        deprecated: intent.deprecated,
        domain:
          intent.domain === undefined
            ? undefined
            : session.resolveTarget(intent.domain),
        range:
          intent.range === undefined
            ? undefined
            : session.resolveTarget(intent.range),
      });
      break;
    case "endpoint":
      proposal = prepareCanonicalEndpointEdit(base.inspection, {
        property: target,
        endpoint: intent.endpoint,
        target: session.resolveTarget(intent.endpointTarget),
      });
      break;
    case "iri":
      proposal = prepareCanonicalIriEdit(base.inspection, {
        target,
        iri: intent.iri,
      });
      break;
    case "label":
      proposal = prepareCanonicalLabelEdit(base.inspection, {
        target,
        language: intent.language,
        text: intent.text,
      });
      break;
    case "delete":
      proposal = prepareCanonicalDeletion(base.inspection, { target });
      break;
    default:
      throw rejected("EDITOR_COMMAND_UNSUPPORTED");
  }
  if (proposal.requiresDeletionConfirmation) {
    if (typeof confirmDeletion !== "function") {
      throw rejected("EDITOR_DELETION_REQUIRES_CONFIRMATION");
    }
  }
  if (proposal.requiresInverseDetachmentExplanation) {
    if (typeof confirmInverseDetachment !== "function") {
      throw rejected("EDITOR_INVERSE_DETACHMENT_REQUIRES_CONFIRMATION");
    }
    const accepted = await confirmInverseDetachment(
      {
        loadGeneration: base.loadGeneration,
        documentRevision: base.documentRevision,
        relationships: structuredClone(proposal.detachedInverses),
        inspection: structuredClone(base.inspection),
      },
      { signal },
    );
    if (accepted !== true) {
      throw rejected("EDITOR_COMMAND_CANCELLED");
    }
  }
  signal?.throwIfAborted();
  const current = session.snapshot();
  if (
    current.loadGeneration !== base.loadGeneration ||
    current.documentRevision !== base.documentRevision
  ) {
    throw rejected("EDITOR_COMMAND_EXPIRED");
  }
  if (proposal.changes.length === 0) {
    return current;
  }
  if (renderedGraphRuntime) {
    session.synchronizeDrawing(
      renderedGraphRuntime.readCanonicalDrawingState(),
    );
  }
  let selectedId;
  const result = await session.edit(proposal.changes, {
    renderedGraphRuntime,
    reconcile,
    prepareVisibility,
    signal,
    ...(proposal.requiresDeletionConfirmation
      ? {
          authorize: async (candidate, context) => {
            const retired = new Set(
              candidate.correspondence
                .filter((pair) => pair.current === null)
                .map((pair) => pair.previous),
            );
            const removedRecords = [
              "subjects",
              "roles",
              "expressions",
              "constructs",
            ].flatMap((collection) =>
              base.inspection.records[collection]
                .filter(({ id }) => retired.has(id))
                .map((record) => ({ collection, record })),
            );
            const accepted = await confirmDeletion(
              {
                loadGeneration: base.loadGeneration,
                documentRevision: base.documentRevision,
                removedRecords: structuredClone(removedRecords),
                annotationLosses: structuredClone(
                  removedRecords.filter(({ record }) =>
                    ["annotation-assertion", "assertion-anchor"].includes(
                      record.kind,
                    ),
                  ),
                ),
                inspection: structuredClone(base.inspection),
              },
              context,
            );
            if (accepted !== true) {
              throw rejected("EDITOR_COMMAND_CANCELLED");
            }
            return true;
          },
        }
      : {}),
    prepareProjection(inspection, visualization, { correspondence } = {}) {
      if (proposal.selectionIntent) {
        selectedId = resolveCreatedMeaning(
          inspection,
          proposal.selectionIntent,
          correspondence,
        );
      }
      return createCanonicalVowlRenderProjection(inspection, visualization);
    },
    ...(proposal.selectionIntent && intent.position
      ? {
          suppliedPositions(inspection, { correspondence } = {}) {
            const selected = resolveCreatedMeaning(
              inspection,
              proposal.selectionIntent,
              correspondence,
            );
            const matches = inspection.occurrences.filter((occurrence) => {
              if (occurrence.kind === "class-node") {
                return occurrence.targets.includes(selected);
              }
              if (occurrence.kind === "datatype-node") {
                return occurrence.target === selected;
              }
              if (occurrence.kind === "label") {
                const edge = inspection.occurrences.find(
                  ({ id }) => id === occurrence.edge,
                );
                return (
                  edge.construct === selected ||
                  (edge.properties?.includes(selected) ?? false)
                );
              }
              return false;
            });
            if (matches.length > 1) {
              throw rejected("EDITOR_INSERTION_POSITION_AMBIGUOUS");
            }
            return new Map(matches.map(({ id }) => [id, intent.position]));
          },
        }
      : {}),
  });
  return selectedId === undefined
    ? result
    : { ...result, selectedTarget: session.target(selectedId) };
}
