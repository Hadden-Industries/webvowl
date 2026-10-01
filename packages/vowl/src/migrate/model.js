import { at, fail } from "../errors.js";
import { namespaces, profiles } from "../profiles.js";
import { snapshotSource } from "../snapshot.js";
import { normalizeDraft } from "../editing.js";
import { legacyScalar } from "./grammar.js";
import { annotationReader } from "./annotations.js";

const nodeKinds = new Map([
  ["owl:class", "class"],
  ["owl:equivalentclass", "class"],
  ["owl:thing", "class"],
  ["owl:nothing", "class"],
  ["rdfs:class", "rdf-class"],
  ["rdfs:resource", "rdf-class"],
  ["rdfs:datatype", "datatype"],
  ["rdfs:literal", "datatype"],
]);
const fixedIris = new Map([
  ["owl:thing", namespaces.owl + "Thing"],
  ["owl:nothing", namespaces.owl + "Nothing"],
  ["rdfs:resource", namespaces.rdfs + "Resource"],
  ["rdfs:literal", namespaces.rdfs + "Literal"],
  ["rdfs:subclassof", namespaces.rdfs + "subClassOf"],
  ["owl:disjointwith", namespaces.owl + "disjointWith"],
]);

/** Detect lost n-ary grouping without fabricating connected-component assertions. */
function rejectTriangles(pairs, budget, subjects) {
  const neighbors = new Map();
  for (const pair of pairs) {
    budget.check();
    const a = subjects.get(pair.a),
      b = subjects.get(pair.b);
    if (a === b) {
      continue;
    }
    if (!neighbors.has(a)) {
      neighbors.set(a, new Set());
    }
    if (!neighbors.has(b)) {
      neighbors.set(b, new Set());
    }
    neighbors.get(a).add(b);
    neighbors.get(b).add(a);
  }
  for (const pair of pairs) {
    budget.check();
    const a = subjects.get(pair.a),
      b = subjects.get(pair.b);
    if (a === b) {
      continue;
    }
    const left = neighbors.get(a),
      right = neighbors.get(b);
    const [small, large] =
      left.size < right.size ? [left, right] : [right, left];
    for (const member of small) {
      budget.check();
      if (large.has(member)) {
        fail("MIGRATION_AMBIGUOUS", pair.pointer);
      }
    }
  }
}

/** Convert only facts whose exact meaning survives the closed legacy dialect. */
export function buildLegacyModel(input, joined, profile, budget, policy) {
  const structural = {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  };
  const source = { structural };
  let next = 0;
  function append(collection, payload) {
    const record = snapshotSource(
      { record: { id: `legacy${next++}`, ...payload } },
      budget,
      (pointer) => pointer === "/record",
    ).record;
    structural[collection].push(record);
    return record.id;
  }
  const subjects = new Map(),
    roles = new Map(),
    roleSubjects = new Map();
  function subject(iri, anonymous = false) {
    budget.check();
    const key = JSON.stringify([anonymous, iri]);
    if (!subjects.has(key)) {
      subjects.set(key, append("subjects", anonymous ? {} : { iri }));
    }
    return subjects.get(key);
  }
  function role(iri, kind) {
    const target = subject(iri);
    const key = JSON.stringify([target, kind]);
    if (!roles.has(key)) {
      roles.set(key, append("roles", { kind, subject: target }));
      roleSubjects.set(roles.get(key), target);
    }
    return roles.get(key);
  }
  const reader = annotationReader({ budget, policy, subject, append });
  const header = input.header ?? {};
  if (!header.iri) {
    policy.allow("ontology-iri", "/header/iri");
  }
  if (profile === profiles.artifact && input.settings?.global?.translation) {
    policy.allow("viewport", "/settings/global/translation");
  }
  const pending = [];
  for (const key of ["_comment", "metrics"]) {
    if (Object.hasOwn(input, key)) {
      policy.drop(`/${key}`);
    }
  }
  for (const key of ["baseIris", "languages"]) {
    if (Object.hasOwn(header, key)) {
      policy.drop(`/header/${key}`);
    }
  }
  for (const [index, binding] of (input.namespace ?? []).entries()) {
    legacyScalar(binding.iri, "IRI", `/namespace/${index}/iri`, budget);
  }
  for (const [key, iri] of Object.entries(header.prefixList ?? {})) {
    legacyScalar(iri, "IRI", at("/header/prefixList", key), budget);
  }
  if (profile === profiles.structuralContent) {
    for (const key of ["namespace", "settings"]) {
      if (Object.hasOwn(input, key)) {
        policy.drop(`/${key}`);
      }
    }
    if (header.prefixList) {
      policy.drop("/header/prefixList");
    }
  }
  structural.ontology.imports = (header.imports ?? []).map((iri, index) =>
    legacyScalar(iri, "IRI", `/header/imports/${index}`, budget),
  );
  const ontologyAnnotations = reader.prepare(header, "/header", {
    iri: header.iri,
    ontology: true,
    labelKey: "labels",
    commentKey: "comments",
  });
  const classRows = [
    ...joined.byKind.get("class"),
    ...joined.byKind.get("datatype"),
  ];
  for (const row of joined.all.values()) {
    budget.check();
    const { fields: f, locations: p } = row;
    row.type = f.type.toLowerCase();
    row.roleKind = nodeKinds.get(row.type);
    if (row.kind === "property") {
      if (!["rdfs:subclassof", "owl:disjointwith"].includes(row.type)) {
        fail("MIGRATION_AMBIGUOUS", p.get("type"));
      }
    } else if (
      !row.roleKind ||
      (row.kind === "datatype" && row.roleKind !== "datatype")
    ) {
      fail("MIGRATION_AMBIGUOUS", p.get("type"));
    }
    if (f.iri !== undefined || row.type !== "owl:disjointwith") {
      row.iri = legacyScalar(
        f.iri,
        "IRI",
        p.get("iri") ?? at(row.pointer, "iri"),
        budget,
      );
    }
    if (
      row.iri !== undefined &&
      fixedIris.has(row.type) &&
      row.iri !== fixedIris.get(row.type)
    ) {
      fail("MIGRATION_AMBIGUOUS", p.get("iri"));
    }
    const allowed = new Set([
      "id",
      "type",
      "iri",
      "baseIri",
      "label",
      "comment",
      "description",
      "annotations",
      "attributes",
      "pos",
      "pinned",
      ...(row.kind === "property"
        ? ["domain", "range"]
        : ["individuals", "instances", "equivalent"]),
    ]);
    for (const key of Object.keys(f).sort()) {
      budget.check();
      if (!allowed.has(key)) {
        fail("MIGRATION_AMBIGUOUS", p.get(key));
      }
    }
    for (const key of ["id", "baseIri"]) {
      if (Object.hasOwn(f, key)) {
        policy.drop(p.get(key));
        if (key === "id") {
          policy.drop(at(row.pointer, "id"));
        }
      }
    }
    if (profile === profiles.structuralContent) {
      for (const key of ["pos", "pinned"]) {
        if (Object.hasOwn(f, key)) {
          policy.drop(p.get(key));
        }
      }
    }
    const markers = new Set([
      "external",
      ...(row.roleKind === "rdf-class" ? ["rdf"] : []),
      ...(row.roleKind === "datatype" ? ["datatype"] : []),
      ...(f.equivalent?.length ? ["equivalent"] : []),
      ...(row.type === "rdfs:subclassof" ? ["transitive"] : []),
      ...(row.type === "owl:disjointwith" ? ["anonymous", "object"] : []),
    ]);
    for (const [index, marker] of (f.attributes ?? []).entries()) {
      if (!markers.has(marker)) {
        fail("MIGRATION_AMBIGUOUS", at(p.get("attributes"), index));
      }
    }
    if (f.attributes) {
      policy.drop(p.get("attributes"));
    }
    if (Object.hasOwn(f, "instances")) {
      if (f.instances !== 0) {
        fail("MIGRATION_AMBIGUOUS", p.get("instances"));
      }
      policy.drop(p.get("instances"));
    }
    if (row.roleKind) {
      row.role = role(row.iri, row.roleKind);
      row.subject = subject(row.iri);
      if (row.type === "owl:equivalentclass" && !f.equivalent?.length) {
        fail("MIGRATION_AMBIGUOUS", p.get("type"));
      }
      pending.push(reader.prepare(f, p, { iri: row.iri, target: row.subject }));
      for (const [index, individual] of (f.individuals ?? []).entries()) {
        const pointer = at(p.get("individuals"), index);
        if (!["class", "rdf-class"].includes(row.roleKind)) {
          fail("MIGRATION_AMBIGUOUS", pointer);
        }
        const iri = legacyScalar(
          individual.iri,
          "IRI",
          at(pointer, "iri"),
          budget,
        );
        append("constructs", {
          kind: "class-membership",
          class: row.role,
          individual: role(iri, "individual"),
        });
        if (individual.baseIri !== undefined) {
          policy.drop(at(pointer, "baseIri"));
        }
        pending.push(
          reader.prepare(individual, pointer, {
            iri,
            target: subject(iri),
            labelKey: "labels",
          }),
        );
      }
      if (f.individuals?.length === 0) {
        policy.drop(p.get("individuals"));
      }
    }
  }
  const equivalences = [],
    disjoints = [];
  function classTarget(id, pointer, kind) {
    const target = joined.all.get(id);
    if (
      !target ||
      !["class", "rdf-class"].includes(target.roleKind) ||
      (kind && kind !== target.roleKind)
    ) {
      fail("MIGRATION_AMBIGUOUS", pointer);
    }
    return target.role;
  }
  for (const row of classRows) {
    for (const [index, id] of (row.fields.equivalent ?? []).entries()) {
      const pointer = at(row.locations.get("equivalent"), index);
      const pair = {
        a: classTarget(row.fields.id, pointer),
        b: classTarget(id, pointer, row.roleKind),
        pointer,
      };
      equivalences.push(pair);
    }
    if (row.fields.equivalent?.length === 0) {
      policy.drop(row.locations.get("equivalent"));
    }
  }
  for (const row of joined.byKind.get("property")) {
    const { fields: f, locations: p } = row;
    const a = classTarget(
      f.domain,
      p.get("domain") ?? at(row.pointer, "domain"),
    );
    const b = classTarget(f.range, p.get("range") ?? at(row.pointer, "range"));
    const kind =
      row.type === "rdfs:subclassof" ? "subclass" : "disjoint-classes";
    const payload =
      kind === "subclass"
        ? { kind, sub: a, super: b }
        : { kind, members: [a, b] };
    row.construct = append("constructs", payload);
    if (kind === "disjoint-classes") {
      disjoints.push({ a, b, pointer: row.pointer });
    }
    // These are relation labels, not named properties or annotation assertions on a property IRI.
    for (const key of ["label", "comment", "description", "annotations"]) {
      if (Object.hasOwn(f, key)) {
        const value = f[key];
        const empty =
          typeof value === "object" && Object.keys(value).length === 0;
        const fixed =
          kind === "subclass" &&
          key === "label" &&
          (value === "Subclass of" ||
            (typeof value === "object" &&
              Object.keys(value).length === 1 &&
              value.undefined === "Subclass of"));
        if (!empty && !fixed) {
          fail("MIGRATION_AMBIGUOUS", p.get(key));
        }
        policy.drop(p.get(key));
      }
    }
  }
  rejectTriangles(equivalences, budget, roleSubjects);
  rejectTriangles(disjoints, budget, roleSubjects);
  for (const pair of equivalences) {
    append("constructs", {
      kind: "equivalent-classes",
      members: [pair.a, pair.b],
    });
  }
  policy.validate();
  if (!header.iri) {
    structural.ontology.iri = policy.resolve("ontology-iri", "/header/iri").iri;
  } else if (header.iri !== "No IRI set") {
    structural.ontology.iri = legacyScalar(
      header.iri,
      "IRI",
      "/header/iri",
      budget,
    );
  } else {
    policy.drop("/header/iri");
  }
  structural.ontology.annotations = ontologyAnnotations();
  for (const build of pending) {
    budget.check();
    build();
  }
  const resolve = normalizeDraft(source, budget);
  for (const row of joined.all.values()) {
    if (row.role) {
      row.role = resolve(row.role);
    }
    if (row.construct) {
      row.construct = resolve(row.construct);
    }
  }
  return source;
}
