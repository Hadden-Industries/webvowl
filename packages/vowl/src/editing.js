import { fail } from "./errors.js";
import { envelope, dataRangeKinds } from "./modelContract.js";
import { namespaces, profiles, collectionTypeNames } from "./profiles.js";
import { validateFields, walkTyped, descriptorFor } from "./typedValues.js";
import { semanticKey } from "./semanticKeys.js";
import { validateGraph, validateMeaning } from "./validateGraph.js";
import { generateProjection, occurrenceKey } from "./projection.js";
import { snapshotSource } from "./snapshot.js";

const collections = Object.fromEntries(
  ["subjects", "roles", "expressions", "constructs"].map((name) => [
    name,
    collectionTypeNames[name],
  ]),
);
const operationFields = {
  insert: ["kind", "collection", "record"],
  replace: ["kind", "id", "record"],
  remove: ["kind", "id"],
  "set-endpoint": ["kind", "construct", "target"],
  "set-ontology": ["kind", "ontology"],
};
const endpoint = (kind) => /^(object|data|rdf)-(domain|range)$/.test(kind);

/** Apply explicit edit intent to an owned draft; references and dependencies stay fail-closed. */
export function applyChanges(source, changes, budget) {
  if (!Array.isArray(changes)) {
    fail("EDIT_INVALID", "/changes");
  }
  const model = source.structural;
  // Handles name the admitted revision and the whole atomic request. Removing a
  // record cannot make its handle available to a different record in this batch.
  const reservedHandles = new Set();
  for (const collection of [...Object.keys(collections), "occurrences"]) {
    for (const record of model[collection]) {
      budget.check();
      reservedHandles.add(record.id);
    }
  }
  const lookup = (id) => {
    for (const collection of Object.keys(collections)) {
      const position = model[collection].findIndex((record) => {
        budget.check();
        return record.id === id;
      });
      if (position >= 0) {
        return { collection, position, record: model[collection][position] };
      }
    }
    return undefined;
  };
  function retargetAnchors(previous, next) {
    if (previous.kind === "assertion-anchor") {
      return;
    }
    const priorKey = semanticKey(previous, "Construct", undefined, budget);
    for (const record of model.constructs) {
      budget.check();
      if (record.kind !== "assertion-anchor") {
        continue;
      }
      if (
        semanticKey(record.assertion, "Assertion", undefined, budget) ===
        priorKey
      ) {
        const assertion = { ...next };
        delete assertion.id;
        // Copy by value: equal annotations/assertions must never create RDF auxiliary sharing.
        record.assertion = snapshotSource({ assertion }, budget).assertion;
      } else if (
        endpoint(previous.kind) &&
        record.assertion.kind === previous.kind &&
        record.assertion.property === previous.property
      ) {
        const aggregate = lookup(previous.target)?.record;
        if (
          ["class-intersection", "data-intersection"].includes(
            aggregate?.kind,
          ) &&
          aggregate.members.some((id) => {
            budget.check();
            return id === record.assertion.target;
          })
        ) {
          fail("EDIT_AMBIGUOUS", "/changes");
        }
      }
    }
  }
  changes.forEach((change, i) => {
    budget.check();
    const path = `/changes/${i}`;
    const fields =
      change &&
      typeof change === "object" &&
      !Array.isArray(change) &&
      Object.hasOwn(operationFields, change.kind) &&
      operationFields[change.kind];
    if (
      !fields ||
      Object.keys(change).length !== fields.length ||
      !fields.every((field) => Object.hasOwn(change, field))
    ) {
      fail("EDIT_INVALID", path);
    }
    if (change.kind === "insert") {
      if (!Object.hasOwn(collections, change.collection)) {
        fail("EDIT_INVALID", path);
      }
      validateFields(
        change.record,
        collections[change.collection],
        budget,
        `${path}/record`,
      );
      if (!change.record.id.length || reservedHandles.has(change.record.id)) {
        fail("EDIT_INVALID", path);
      }
      reservedHandles.add(change.record.id);
      model[change.collection].push(change.record);
      return;
    }
    if (change.kind === "set-ontology") {
      validateFields(change.ontology, "Ontology", budget, `${path}/ontology`);
      model.ontology = change.ontology;
      return;
    }
    const target = lookup(
      change.kind === "set-endpoint" ? change.construct : change.id,
    );
    if (!target) {
      fail("EDIT_INVALID", path);
    }
    if (change.kind === "remove") {
      model[target.collection].splice(target.position, 1);
      return;
    }
    let replacement = change.record;
    if (change.kind === "set-endpoint") {
      if (
        target.collection !== "constructs" ||
        !endpoint(target.record.kind) ||
        typeof change.target !== "string"
      ) {
        fail("EDIT_INVALID", path);
      }
      replacement = { ...target.record, target: change.target };
    }
    validateFields(
      replacement,
      collections[target.collection],
      budget,
      `${path}/record`,
    );
    if (replacement.id !== target.record.id) {
      fail("EDIT_INVALID", path);
    }
    if (target.collection === "constructs") {
      retargetAnchors(target.record, replacement);
    }
    model[target.collection][target.position] = replacement;
  });
  model.occurrences = [];
}

/** Normalize only the A2/A5/B2 producer obligations, with no OWL entailment or layout. */
export function normalizeDraft(source, budget, reservedHandles = []) {
  const model = source.structural;
  // A removed duplicate remains an alias. Its name cannot be issued to a new
  // aggregate or signature record later in this same normalization operation.
  const usedIds = new Set(reservedHandles);
  for (const collection of [...Object.keys(collections), "occurrences"]) {
    for (const record of model[collection]) {
      budget.check();
      usedIds.add(record.id);
    }
  }
  const aliases = new Map();
  const resolve = (id) => {
    const visited = [];
    while (aliases.has(id)) {
      budget.check();
      visited.push(id);
      id = aliases.get(id);
    }
    for (const prior of visited) {
      budget.check();
      aliases.set(prior, id);
    }
    return id;
  };
  const rewrite = () =>
    walkTyped(
      source,
      envelope(profiles.structuralContent),
      (value, descriptor, _pointer, parent, key) => {
        budget.check();
        if (descriptor?.reference) {
          parent[key] = resolve(value);
        }
      },
    );
  function deduplicate(collection, getKey) {
    const seen = new Map();
    model[collection] = model[collection].filter((record) => {
      budget.check();
      const key = getKey(record);
      if (seen.has(key)) {
        aliases.set(record.id, seen.get(key));
        return false;
      }
      seen.set(key, record.id);
      return true;
    });
    rewrite();
  }
  function deduplicateSets(value, descriptor) {
    budget.check();
    const shape = descriptorFor(value, descriptor, "");
    if (shape?.fields) {
      for (const key of Object.keys(value)) {
        deduplicateSets(value[key], shape.fields[key]);
      }
    } else if (shape?.items) {
      value.forEach((member) => deduplicateSets(member, shape.items));
      if (!shape.sequence) {
        const seen = new Set();
        let write = 0;
        for (const member of value) {
          budget.check();
          const key =
            member && typeof member === "object" && Object.hasOwn(member, "id")
              ? member.id
              : semanticKey(member, shape.items, undefined, budget);
          if (!seen.has(key)) {
            seen.add(key);
            value[write++] = member;
          }
        }
        value.length = write;
      }
    }
  }
  validateFields(source, envelope(profiles.structuralContent), budget);
  // Check handles, typed references and cycles before any normalization can erase evidence.
  validateGraph(source, profiles.structuralContent, budget, false, true);
  deduplicateSets(source, envelope(profiles.structuralContent));
  deduplicate("subjects", (record) =>
    record.iri === undefined ? [record.id] : record.iri,
  );
  deduplicate("roles", (record) =>
    JSON.stringify([record.subject, record.kind]),
  );
  // Each named subject has at most one role per kind after deduplication.
  // Index once so generic-role promotion does not scan every role for every role.
  const rolesBySubject = new Map();
  for (const role of model.roles) {
    budget.check();
    if (!rolesBySubject.has(role.subject)) {
      rolesBySubject.set(role.subject, new Map());
    }
    rolesBySubject.get(role.subject).set(role.kind, role);
  }
  for (const role of model.roles) {
    budget.check();
    const siblings = rolesBySubject.get(role.subject);
    if (role.kind === "rdf-class") {
      const specific = siblings.get("class");
      if (specific) {
        aliases.set(role.id, specific.id);
        siblings.delete(role.kind);
      }
    }
    if (role.kind === "rdf-property") {
      const specific = [
        "object-property",
        "data-property",
        "annotation-property",
      ]
        .map((kind) => siblings.get(kind))
        .filter(Boolean);
      if (specific.length > 1) {
        fail("EDIT_AMBIGUOUS", "/structural/roles");
      }
      if (specific.length === 1) {
        aliases.set(role.id, specific[0].id);
        siblings.delete(role.kind);
      }
    }
  }
  const removeAliasedRoles = () => {
    model.roles = model.roles.filter((role) => {
      budget.check();
      return !aliases.has(role.id);
    });
  };
  removeAliasedRoles();
  rewrite();
  function expressions() {
    const graph = validateGraph(
      source,
      profiles.structuralContent,
      budget,
      false,
      true,
    );
    deduplicate("expressions", (record) => graph.expressionKeys.get(record.id));
  }
  expressions();
  let nextId = 0;
  function freshId() {
    let id;
    do {
      budget.check();
      id = `normalized${nextId++}`;
    } while (usedIds.has(id) || aliases.has(id));
    usedIds.add(id);
    return id;
  }
  function append(collection, payload) {
    const record = { id: freshId(), ...payload };
    // Generated primary/embedded/string occurrences share the caller's aggregate budget.
    const snapshot = snapshotSource(
      { structural: { [collection]: [record] } },
      budget,
    );
    model[collection].push(snapshot.structural[collection][0]);
    return model[collection].at(-1);
  }
  const aggregates = new Map();
  for (const construct of model.constructs) {
    budget.check();
    if (!endpoint(construct.kind)) {
      continue;
    }
    const key = JSON.stringify([construct.kind, construct.property]);
    if (!aggregates.has(key)) {
      aggregates.set(key, []);
    }
    aggregates.get(key).push(construct);
  }
  let endpointGraph;
  for (const group of aggregates.values()) {
    budget.check();
    const targets = [
      ...new Set(
        group.map((record) => {
          budget.check();
          return record.target;
        }),
      ),
    ];
    if (targets.length > 1) {
      endpointGraph ??= validateGraph(
        source,
        profiles.structuralContent,
        budget,
        false,
        true,
      );
      const data = targets.map((id) => {
        budget.check();
        const record = endpointGraph.get(id);
        return (
          record.kind === "datatype" || dataRangeKinds.includes(record.kind)
        );
      });
      if (new Set(data).size !== 1) {
        fail("EDIT_AMBIGUOUS", "/structural/constructs");
      }
      group[0].target = append("expressions", {
        kind: data[0] ? "data-intersection" : "class-intersection",
        members: targets,
      }).id;
    }
    for (const record of group.slice(1)) {
      budget.check();
      aliases.set(record.id, group[0].id);
    }
  }
  model.constructs = model.constructs.filter((record) => {
    budget.check();
    return !aliases.has(record.id);
  });
  rewrite();
  expressions();
  deduplicateSets(source, envelope(profiles.structuralContent));
  deduplicate("constructs", (record) =>
    semanticKey(record, "Construct", undefined, budget),
  );
  const subjectsByIri = new Map();
  const subjectsById = new Map();
  for (const subject of model.subjects) {
    budget.check();
    subjectsById.set(subject.id, subject);
    if (subject.iri !== undefined) {
      subjectsByIri.set(subject.iri, subject);
    }
  }
  let pendingRoleAliases = false;
  function flushRoleAliases() {
    if (pendingRoleAliases) {
      removeAliasedRoles();
      rewrite();
      pendingRoleAliases = false;
    }
  }
  function ensureRole(iri, kind, deferRewrite = false) {
    budget.check();
    let subject = subjectsByIri.get(iri);
    if (!subject) {
      subject = append("subjects", { iri });
      subjectsByIri.set(iri, subject);
      subjectsById.set(subject.id, subject);
    }
    if (!rolesBySubject.has(subject.id)) {
      rolesBySubject.set(subject.id, new Map());
    }
    const siblings = rolesBySubject.get(subject.id);
    let role = siblings.get(kind);
    if (!role) {
      role = append("roles", { kind, subject: subject.id });
      siblings.set(kind, role);
      const genericKind =
        kind === "class"
          ? "rdf-class"
          : [
                "object-property",
                "data-property",
                "annotation-property",
              ].includes(kind)
            ? "rdf-property"
            : undefined;
      const genericRole = genericKind && siblings.get(genericKind);
      if (genericRole) {
        aliases.set(genericRole.id, role.id);
        siblings.delete(genericKind);
        pendingRoleAliases = true;
      }
    }
    if (!deferRewrite) {
      flushRoleAliases();
    }
    return role;
  }
  walkTyped(model, "Structural", (value, shape) => {
    budget.check();
    if (!shape?.fields) {
      return;
    }
    if (shape.fields.predicate) {
      ensureRole(value.predicate, "annotation-property", true);
    }
    if (["typed", "language"].includes(value.kind) && shape.fields.lexical) {
      ensureRole(
        value.kind === "language"
          ? namespaces.rdf + "langString"
          : value.datatype,
        "datatype",
        true,
      );
    }
  });
  // Signature discovery may promote many roles; rewrite the complete model once.
  flushRoleAliases();
  const graph = validateGraph(
    source,
    profiles.structuralContent,
    budget,
    false,
    true,
  );
  const reached = new Set();
  function reach(id) {
    budget.check();
    if (reached.has(id)) {
      return;
    }
    reached.add(id);
    for (const child of graph.expressionChildren.get(id)) {
      reach(child);
    }
  }
  for (const construct of model.constructs) {
    walkTyped(construct, "Construct", (value, shape) => {
      budget.check();
      if (shape?.reference && graph.index.get(value).category === "X") {
        reach(value);
      }
    });
  }
  model.expressions = model.expressions.filter((record) => {
    budget.check();
    return reached.has(record.id);
  });
  const context = validateMeaning(
    source,
    validateGraph(source, profiles.structuralContent, budget, false),
    budget,
  );
  const createBuiltin = (iri, kind) => {
    const role = ensureRole(iri, kind);
    const subject = subjectsById.get(role.subject);
    context.index.set(subject.id, { record: subject, category: "S" });
    context.index.set(role.id, { record: role, category: "R" });
    context.roleMap.set(JSON.stringify([iri, kind]), role);
    return role;
  };
  model.occurrences = generateProjection(source, context, budget, {
    normalizing: true,
    createBuiltin,
  }).expected;
  return resolve;
}

/** Preserve only explicit record identities and exact B1 generation-key correspondence. */
export function editingCorrespondence(original, draft, resolve, budget) {
  const oldRecords = new Map(
    Object.values(original.structural)
      .filter(Array.isArray)
      .flat()
      .map((record) => [record.id, record]),
  );
  const nextRecords = new Map(
    Object.values(draft.structural)
      .filter(Array.isArray)
      .flat()
      .map((record) => [record.id, record]),
  );
  const oldCache = new Map();
  const nextCache = new Map();
  const oldOccurrences = new Set(
    original.structural.occurrences.map((record) => record.id),
  );
  const nextKeys = new Map(
    draft.structural.occurrences.map((record) => [
      occurrenceKey(record, (id) => nextRecords.get(id), nextCache, budget),
      record.id,
    ]),
  );
  return [...oldRecords.values()].map((record) => {
    budget.check();
    const occurrence = oldOccurrences.has(record.id);
    const current = occurrence
      ? nextKeys.get(
          occurrenceKey(
            record,
            (id) => oldRecords.get(id),
            oldCache,
            budget,
            resolve,
          ),
        )
      : nextRecords.has(resolve(record.id))
        ? resolve(record.id)
        : undefined;
    return { previous: record.id, current: current ?? null };
  });
}
