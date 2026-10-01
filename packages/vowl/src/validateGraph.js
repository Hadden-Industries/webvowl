import { at, fail } from "./errors.js";
import { envelope } from "./modelContract.js";
import { categories, namespaces } from "./profiles.js";
import { semanticKey } from "./semanticKeys.js";
import { occurrenceKey } from "./projection.js";
import { walkTyped } from "./typedValues.js";

const categoryNames = {
  subjects: "S",
  roles: "R",
  expressions: "X",
  constructs: "K",
  occurrences: "O",
};
const dataKinds = new Set([
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
]);
const endpointKind = /^(object|data|rdf)-(domain|range)$/;
const classRole = (record) => ["class", "rdf-class"].includes(record.kind);

/** The grammar, not a field-name heuristic, decides permissible reference targets. */
function matches(record, shape, category) {
  const type = shape.reference;
  let accepted = type === category;
  if (type === "C" || type === "CD") {
    accepted ||=
      (category === "R" && classRole(record)) ||
      (category === "X" &&
        !dataKinds.has(record.kind) &&
        record.kind !== "object-inverse");
  }
  if (type === "D" || type === "CD") {
    accepted ||=
      (category === "R" && record.kind === "datatype") ||
      (category === "X" && dataKinds.has(record.kind));
  }
  if (type === "P") {
    accepted =
      (category === "R" && record.kind === "object-property") ||
      (category === "X" && record.kind === "object-inverse");
  }
  if (["DP", "RP", "AP", "I"].includes(type)) {
    accepted =
      category === "R" &&
      record.kind ===
        {
          DP: "data-property",
          RP: "rdf-property",
          AP: "annotation-property",
          I: "individual",
        }[type];
  }
  return (
    accepted && (!shape.kinds?.length || shape.kinds.includes(record.kind))
  );
}

/** Index IDs, validate references/cycles and normalized record identity in A7 order. */
export function validateGraph(
  source,
  profile,
  budget,
  decoding,
  normalizing = false,
) {
  const model = source.structural;
  const index = new Map();
  const locations = new Map();
  const references = [];
  const shape = envelope(profile);
  for (const collection of Object.keys(categories).sort()) {
    model[collection].forEach((record, i) => {
      budget.check();
      const pointer = `/structural/${collection}/${i}`;
      if (
        !record.id.length ||
        (decoding &&
          !new RegExp(`^${categories[collection]}(0|[1-9][0-9]*)$`).test(
            record.id,
          ))
      ) {
        fail("ID_INVALID", at(pointer, "id"));
      }
      if (index.has(record.id)) {
        fail("ID_DUPLICATE", at(pointer, "id"));
      }
      index.set(record.id, { record, category: categoryNames[collection] });
      locations.set(record.id, pointer);
    });
  }
  walkTyped(source, shape, (value, descriptor, pointer) => {
    budget.check();
    if (descriptor?.reference) {
      references.push({ value, descriptor, pointer });
    }
  });
  for (const { value, pointer } of references) {
    if (!index.has(value)) {
      fail("REFERENCE_DANGLING", pointer);
    }
  }
  for (const { value, descriptor, pointer } of references) {
    const { record, category } = index.get(value);
    if (!matches(record, descriptor, category)) {
      fail("REFERENCE_KIND", pointer);
    }
  }

  const expressionChildren = new Map();
  const expressionKeys = new Map();
  const expressionHeights = new Map();
  const visiting = new Set();
  const payloads = new Map();
  function visitExpression(id, depth) {
    budget.bound("depth", depth, locations.get(id));
    if (visiting.has(id)) {
      fail("EXPRESSION_CYCLE", locations.get(id));
    }
    if (expressionKeys.has(id)) {
      budget.bound(
        "depth",
        depth + expressionHeights.get(id) - 1,
        locations.get(id),
      );
      return expressionKeys.get(id);
    }
    visiting.add(id);
    const record = index.get(id).record;
    const children = [];
    walkTyped(record, "Expression", (value, descriptor) => {
      if (descriptor?.reference && index.get(value).category === "X") {
        children.push(value);
        visitExpression(value, depth + 1);
      }
    });
    expressionChildren.set(id, children);
    const height = children.reduce(
      (maximum, child) => Math.max(maximum, expressionHeights.get(child) + 1),
      1,
    );
    budget.bound("depth", depth + height - 1, locations.get(id));
    expressionHeights.set(id, height);
    const key = semanticKey(
      record,
      "Expression",
      (target) =>
        index.get(target).category === "X"
          ? ["expression", expressionKeys.get(target)]
          : ["nominal", target],
      budget,
      normalizing,
    );
    if (!payloads.has(key)) {
      payloads.set(key, payloads.size);
    }
    expressionKeys.set(id, payloads.get(key));
    visiting.delete(id);
    return expressionKeys.get(id);
  }
  for (const record of model.expressions) {
    visitExpression(record.id, 1);
  }

  if (normalizing) {
    return {
      index,
      locations,
      expressionChildren,
      expressionKeys,
      get: (id) => index.get(id)?.record,
    };
  }

  // Identity comparisons happen after every reference/cycle check. Source arrays keep
  // their supplied order for diagnostics, regardless of their eventual wire order.
  const seenSubjects = new Set();
  const seenRoles = new Set();
  const seenExpressions = new Set();
  const seenConstructs = new Set();
  const seenOccurrences = new Set();
  const occurrenceKeys = new Map();
  for (const collection of Object.keys(categories).sort()) {
    for (const record of model[collection]) {
      budget.check();
      let key;
      let seen;
      if (collection === "subjects" && record.iri !== undefined) {
        key = record.iri;
        seen = seenSubjects;
      }
      if (collection === "roles") {
        key = JSON.stringify([record.subject, record.kind]);
        seen = seenRoles;
      }
      if (collection === "expressions") {
        key = expressionKeys.get(record.id);
        seen = seenExpressions;
      }
      if (collection === "constructs") {
        key = semanticKey(record, "Construct", undefined, budget);
        seen = seenConstructs;
      }
      if (collection === "occurrences") {
        key = occurrenceKey(
          record,
          (id) => index.get(id)?.record,
          occurrenceKeys,
          budget,
          undefined,
          { deferInvalidTopology: true },
        );
        // A5 occurrence identity is a generation key, independent of projection
        // completeness. Invalid endpoint topology has no key and belongs to A7 stage 6.
        if (key !== undefined) {
          seen = seenOccurrences;
        }
      }
      if (seen?.has(key)) {
        fail("RECORD_DUPLICATE", locations.get(record.id));
      }
      seen?.add(key);
    }
  }
  walkTyped(source, shape, (value, descriptor, pointer) => {
    budget.check();
    if (descriptor?.items && !descriptor.sequence) {
      const seen = new Set();
      value.forEach((member, i) => {
        // Primary identity is checked above; two distinct anonymous subjects stay distinct.
        const key =
          member && typeof member === "object" && Object.hasOwn(member, "id")
            ? member.id
            : semanticKey(member, descriptor.items, undefined, budget);
        if (seen.has(key)) {
          fail("SOURCE_DUPLICATE_SET_MEMBER", at(pointer, i));
        }
        seen.add(key);
      });
    }
  });
  return {
    index,
    locations,
    expressionChildren,
    get: (id) => index.get(id)?.record,
  };
}

/** Validate anchors, direct endpoint normalization and the finite signature closure. */
export function validateMeaning(source, context, budget) {
  const { index, locations, get, expressionChildren } = context;
  const model = source.structural;
  const bases = new Set(
    model.constructs
      .filter((record) => record.kind !== "assertion-anchor")
      .map((record) => semanticKey(record, "Construct", undefined, budget)),
  );
  const endpoints = new Map();
  for (const construct of model.constructs) {
    if (endpointKind.test(construct.kind)) {
      const key = JSON.stringify([construct.property, construct.kind]);
      if (!endpoints.has(key)) {
        endpoints.set(key, construct);
      }
    }
  }
  for (const construct of model.constructs) {
    budget.check();
    if (construct.kind !== "assertion-anchor") {
      continue;
    }
    const assertion = construct.assertion;
    let supported =
      assertion.kind === "declaration" ||
      bases.has(semanticKey(assertion, "Assertion", undefined, budget));
    if (!supported && endpointKind.test(assertion.kind)) {
      const aggregate = endpoints.get(
        JSON.stringify([assertion.property, assertion.kind]),
      );
      const target = aggregate && get(aggregate.target);
      supported =
        aggregate?.target === assertion.target ||
        (["class-intersection", "data-intersection"].includes(target?.kind) &&
          target.members.includes(assertion.target));
    }
    if (!supported) {
      fail(
        "ASSERTION_UNSUPPORTED",
        at(locations.get(construct.id), "assertion"),
      );
    }
  }
  const endpointSeen = new Set();
  for (const construct of model.constructs) {
    if (endpointKind.test(construct.kind)) {
      const key = JSON.stringify([construct.property, construct.kind]);
      if (endpointSeen.has(key)) {
        fail("NORMALIZATION_INVALID", locations.get(construct.id));
      }
      endpointSeen.add(key);
    }
  }
  if (
    model.ontology.versionIri !== undefined &&
    model.ontology.iri === undefined
  ) {
    fail("NORMALIZATION_INVALID", "/structural/ontology/versionIri");
  }
  const roleMap = new Map();
  const rolesBySubject = new Map();
  const usedSubjects = new Set();
  for (const role of model.roles) {
    const subject = get(role.subject);
    usedSubjects.add(role.subject);
    const kinds = rolesBySubject.get(role.subject) ?? new Set();
    kinds.add(role.kind);
    rolesBySubject.set(role.subject, kinds);
    if (subject.iri !== undefined) {
      roleMap.set(JSON.stringify([subject.iri, role.kind]), role);
    }
    if (
      subject.iri === undefined &&
      !["class", "rdf-class", "individual"].includes(role.kind)
    ) {
      fail("NORMALIZATION_INVALID", locations.get(role.id));
    }
  }
  for (const role of model.roles) {
    const kinds = rolesBySubject.get(role.subject);
    if (
      (role.kind === "rdf-class" && kinds.has("class")) ||
      (role.kind === "rdf-property" &&
        ["object-property", "data-property", "annotation-property"].some(
          (kind) => kinds.has(kind),
        ))
    ) {
      fail("NORMALIZATION_INVALID", locations.get(role.id));
    }
  }
  walkTyped(source.structural, "Structural", (value, descriptor, pointer) => {
    budget.check();
    if (!descriptor?.fields) {
      return;
    }
    if (descriptor.fields.predicate) {
      if (
        !roleMap.has(JSON.stringify([value.predicate, "annotation-property"]))
      ) {
        fail("NORMALIZATION_INVALID", at(pointer, "predicate"));
      }
      if (value.kind === "annotation-assertion") {
        usedSubjects.add(value.subject);
      }
    }
    if (value.kind === "subject" && descriptor.fields.subject) {
      if (get(value.subject).iri !== undefined) {
        fail("NORMALIZATION_INVALID", at(pointer, "subject"));
      }
      usedSubjects.add(value.subject);
    }
    if (
      ["typed", "language"].includes(value.kind) &&
      descriptor.fields.lexical
    ) {
      const datatype =
        value.kind === "language"
          ? namespaces.rdf + "langString"
          : value.datatype;
      if (
        (value.kind === "typed" &&
          datatype === namespaces.rdf + "langString") ||
        !roleMap.has(JSON.stringify([datatype, "datatype"]))
      ) {
        fail("NORMALIZATION_INVALID", pointer);
      }
    }
  });
  for (const subject of model.subjects) {
    if (!usedSubjects.has(subject.id)) {
      fail("NORMALIZATION_INVALID", locations.get(subject.id));
    }
  }
  const reachable = new Set();
  function reach(id) {
    budget.check();
    if (reachable.has(id)) {
      return;
    }
    reachable.add(id);
    for (const child of expressionChildren.get(id)) {
      reach(child);
    }
  }
  for (const construct of model.constructs) {
    walkTyped(construct, "Construct", (value, descriptor) => {
      if (descriptor?.reference && index.get(value).category === "X") {
        reach(value);
      }
    });
  }
  for (const expression of model.expressions) {
    if (!reachable.has(expression.id)) {
      fail("NORMALIZATION_INVALID", locations.get(expression.id));
    }
  }
  return { ...context, roleMap, endpoints };
}
