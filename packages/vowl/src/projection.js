import { fail } from "./errors.js";
import { namespaces } from "./profiles.js";
import { compareBytes, jsonBytes, jsonKey } from "./canonicalJson.js";
import { semanticKey } from "./semanticKeys.js";
import { snapshotSource } from "./snapshot.js";

const operators = new Set([
  "class-union",
  "class-intersection",
  "class-complement",
]);
const classKind = (record) => ["class", "rdf-class"].includes(record?.kind);
const propertyKinds = ["object-property", "data-property", "rdf-property"];
const isNode = (record) =>
  ["class-node", "datatype-node"].includes(record?.kind);
const isEdge = (record) => record?.kind?.endsWith("-edge");

/** Connected components represent only explicit co-membership, without semantic inference. */
function components(records, groups, budget) {
  const parents = new Map(records.map((record) => [record.id, record.id]));
  function root(id) {
    let current = id;
    while (parents.get(current) !== current) {
      budget.check();
      current = parents.get(current);
    }
    while (id !== current) {
      const next = parents.get(id);
      parents.set(id, current);
      id = next;
    }
    return current;
  }
  for (const group of groups) {
    const eligible = group.members.filter((id) => parents.has(id));
    if (eligible.length) {
      for (const id of eligible) {
        parents.set(root(id), root(eligible[0]));
      }
    }
  }
  const result = new Map();
  for (const { id } of records) {
    const key = root(id);
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key).push(id);
  }
  return [...result.values()];
}

/** One private B2 generator serves admission and approved atomic edit/ingress normalization. */
export function generateProjection(
  source,
  context,
  budget,
  { normalizing = false, createBuiltin } = {},
) {
  const model = source.structural;
  const { get, roleMap, endpoints } = context;
  const iri = (role) => get(role.subject)?.iri;
  const generic = (record) =>
    classKind(record) &&
    [namespaces.owl + "Thing", namespaces.rdfs + "Resource"].includes(
      iri(record),
    );
  const drawableClass = (id) =>
    classKind(get(id)) || operators.has(get(id)?.kind);
  const drawable = (id) => drawableClass(id) || get(id)?.kind === "datatype";
  function builtin(target, kind, role) {
    const selected =
      roleMap.get(JSON.stringify([target, kind])) ??
      (kind === "rdf-class"
        ? roleMap.get(JSON.stringify([target, "class"]))
        : undefined) ??
      createBuiltin?.(target, kind);
    if (!selected) {
      fail("NORMALIZATION_INVALID", context.locations.get(role.id));
    }
    return selected.id;
  }
  function directEndpoint(role, end) {
    const family = role.kind.split("-")[0];
    return endpoints.get(JSON.stringify([role.id, `${family}-${end}`]))?.target;
  }
  function drawableEndpoints(role) {
    const from = directEndpoint(role, "domain");
    const to = directEndpoint(role, "range");
    return (
      (from === undefined || drawableClass(from)) &&
      (to === undefined || drawable(to))
    );
  }
  function endpoint(role, end) {
    const direct = directEndpoint(role, end);
    if (direct !== undefined) {
      return direct;
    }
    const family = role.kind.split("-")[0];
    if (family === "rdf") {
      return builtin(namespaces.rdfs + "Resource", "rdf-class", role);
    }
    if (family === "data" && end === "range") {
      return builtin(namespaces.rdfs + "Literal", "datatype", role);
    }
    return builtin(namespaces.owl + "Thing", "class", role);
  }
  // Defaults may suppress generic roles and rewrite explicit references during edits.
  // Complete that normalization before capturing any class group or endpoint identity.
  // Strict admission also reports missing defaults before projection failures (A7).
  for (const role of model.roles.filter((record) =>
    propertyKinds.includes(record.kind),
  )) {
    budget.check();
    if (drawableEndpoints(role)) {
      endpoint(role, "domain");
      endpoint(role, "range");
    }
  }
  const groups = new Map();
  const ordinary = model.roles.filter(
    (role) => classKind(role) && iri(role) !== undefined && !generic(role),
  );
  for (const group of components(
    ordinary,
    model.constructs.filter((record) => record.kind === "equivalent-classes"),
    budget,
  )) {
    for (const id of group) {
      groups.set(id, group);
    }
  }
  for (const role of model.roles.filter(
    (record) => classKind(record) && !groups.has(record.id),
  )) {
    groups.set(role.id, [role.id]);
  }
  for (const expression of model.expressions.filter((record) =>
    operators.has(record.kind),
  )) {
    groups.set(expression.id, [expression.id]);
  }

  const expected = [];
  const generated = new Map();
  const keys = new Map();
  function add(payload) {
    budget.check();
    const key = occurrenceKey(payload, (id) => generated.get(id), keys, budget);
    if (keys.has(key)) {
      return keys.get(key);
    }
    // An exact bijection cannot have more generated records than supplied records.
    // This also stops pairwise projection expansion before allocating excess results.
    if (!normalizing && expected.length >= model.occurrences.length) {
      fail("PROJECTION_INVALID", "/structural/occurrences");
    }
    let ordinal = expected.length;
    let id = `generated${ordinal}`;
    while (get(id) || generated.has(id)) {
      id = `generated${++ordinal}`;
    }
    // Group arrays and endpoint contexts can occur in several generated payloads.
    // Own each edit result by value before canonical ID rewriting visits its fields.
    // The snapshot charges this primary record and its embedded values before copying.
    const record = normalizing
      ? snapshotSource({ id, ...payload }, budget, (pointer) => pointer === "")
      : { id, ...payload };
    expected.push(record);
    generated.set(id, record);
    keys.set(key, id);
    return id;
  }
  function node(id, opposite, propertyContext, restriction = false) {
    const record = get(id);
    if (record.kind === "datatype") {
      return add({
        kind: "datatype-node",
        target: id,
        context: propertyContext,
      });
    }
    const payload = { kind: "class-node", targets: groups.get(id) ?? [id] };
    if (generic(record)) {
      payload.context =
        restriction || get(opposite).kind === "datatype"
          ? propertyContext
          : { kind: "class", targets: groups.get(opposite) ?? [opposite] };
    }
    return add(payload);
  }
  const propertyPartitions = [];
  const partitionByRole = new Map();
  for (const kind of propertyKinds) {
    const roles = model.roles.filter((role) => role.kind === kind);
    const family = kind.split("-")[0];
    for (const group of components(
      roles,
      model.constructs.filter(
        (record) => record.kind === `equivalent-${family}-properties`,
      ),
      budget,
    )) {
      const partitions = new Map();
      for (const id of group) {
        const role = get(id);
        if (!drawableEndpoints(role)) {
          // B2.2 defaults belong only to an actual projection. An undrawable explicit
          // endpoint keeps this property in details without inventing a builtin role.
          partitionByRole.set(id, { drawable: false });
          continue;
        }
        const from = endpoint(role, "domain");
        const to = endpoint(role, "range");
        const key = jsonKey([from, to]);
        if (!partitions.has(key)) {
          partitions.set(key, {
            properties: [],
            from,
            to,
            drawable: drawableClass(from) && drawable(to),
          });
        }
        const partition = partitions.get(key);
        partition.properties.push(id);
        partitionByRole.set(id, partition);
      }
      propertyPartitions.push(...partitions.values());
    }
  }
  // Required signature defaults precede any projection-completeness failure (A7).
  for (const role of model.roles.filter(
    (record) => classKind(record) && !generic(record),
  )) {
    node(role.id);
  }
  for (const expression of model.expressions.filter((record) =>
    operators.has(record.kind),
  )) {
    node(expression.id);
  }
  function relationEnds(partition) {
    const propertyContext = {
      kind: "property",
      properties: partition.properties,
    };
    return {
      from: node(partition.from, partition.to, propertyContext),
      to: node(partition.to, partition.from, propertyContext),
    };
  }
  function orientation(partition) {
    const tuples = partition.properties.map((id) => [
      iri(get(id)),
      get(id).kind,
    ]);
    tuples.sort((a, b) => compareBytes(jsonBytes(a), jsonBytes(b)));
    return jsonBytes(tuples);
  }
  const represented = new Set();
  for (const construct of model.constructs.filter(
    (record) => record.kind === "inverse-properties",
  )) {
    if (!construct.members.every((id) => get(id).kind === "object-property")) {
      continue;
    }
    const first = partitionByRole.get(construct.members[0]);
    const second = partitionByRole.get(
      construct.members[1] ?? construct.members[0],
    );
    if (
      !first.drawable ||
      !second.drawable ||
      first.from !== second.to ||
      first.to !== second.from
    ) {
      continue;
    }
    const [forward, reverse] =
      compareBytes(orientation(first), orientation(second)) <= 0
        ? [first, second]
        : [second, first];
    add({
      kind: "inverse-edge",
      construct: construct.id,
      forward: forward.properties,
      reverse: reverse.properties,
      ...relationEnds(forward),
    });
    represented.add(first);
    represented.add(second);
  }
  for (const partition of propertyPartitions) {
    if (partition.drawable && !represented.has(partition)) {
      add({
        kind: "property-edge",
        properties: partition.properties,
        ...relationEnds(partition),
      });
    }
  }
  for (const construct of model.constructs) {
    budget.check();
    if (construct.kind === "subclass") {
      if (drawableClass(construct.sub) && drawableClass(construct.super)) {
        add({
          kind: "subclass-edge",
          construct: construct.id,
          from: node(construct.sub, construct.super),
          to: node(construct.super, construct.sub),
        });
      }
      const sub = get(construct.sub);
      const restriction = get(construct.super);
      if (
        classKind(sub) &&
        iri(sub) !== undefined &&
        /^(object|data)-(min|max|exact)-cardinality$/.test(restriction.kind)
      ) {
        const property = get(restriction.property);
        const filler = get(restriction.filler);
        const object = restriction.kind.startsWith("object-");
        if (
          property.kind === (object ? "object-property" : "data-property") &&
          iri(property) !== undefined &&
          (object
            ? classKind(filler) && iri(filler) === namespaces.owl + "Thing"
            : filler.kind === "datatype" &&
              iri(filler) === namespaces.rdfs + "Literal")
        ) {
          const scoped = {
            kind: "property",
            properties: [property.id],
            scope: construct.id,
          };
          add({
            kind: "restriction-edge",
            construct: construct.id,
            from: node(construct.sub, filler.id, scoped),
            to: node(filler.id, construct.sub, scoped, true),
          });
        }
      }
    }
    if (construct.kind === "disjoint-classes") {
      const members = construct.members.filter(drawableClass);
      const pairs =
        members.length === 1 && construct.members.length === 1
          ? [[members[0], members[0]]]
          : [];
      // Emit while enumerating, rather than materializing a quadratic pair array.
      const emit = (a, b) =>
        add({
          kind: "disjoint-edge",
          construct: construct.id,
          ends: [...new Set([node(a, b), node(b, a)])],
        });
      pairs.forEach(([a, b]) => emit(a, b));
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          emit(members[a], members[b]);
        }
      }
    }
  }
  for (const expression of model.expressions.filter((record) =>
    operators.has(record.kind),
  )) {
    const operands =
      expression.kind === "class-complement"
        ? [expression.operand]
        : expression.members;
    for (const operand of operands.filter(drawableClass)) {
      add({
        kind: "operator-edge",
        expression: expression.id,
        from: node(expression.id, operand),
        to: node(operand, expression.id),
      });
    }
  }
  for (const edge of [...expected]) {
    if (
      ["property-edge", "subclass-edge", "restriction-edge"].includes(edge.kind)
    ) {
      add({ kind: "label", edge: edge.id, direction: "single" });
    }
    if (edge.kind === "inverse-edge") {
      for (const direction of ["forward", "reverse"]) {
        add({ kind: "label", edge: edge.id, direction });
      }
    }
  }
  return { expected, keys };
}

/** Supplied occurrences must be in exact bijection with the privately generated keys. */
export function validateProjection(source, context, budget) {
  const { expected, keys } = generateProjection(source, context, budget);
  const actual = new Set();
  const cache = new Map();
  for (const occurrence of source.structural.occurrences) {
    const key = occurrenceKey(occurrence, context.get, cache, budget);
    if (actual.has(key) || !keys.has(key)) {
      fail("PROJECTION_INVALID", context.locations.get(occurrence.id));
    }
    actual.add(key);
  }
  if (actual.size !== expected.length) {
    fail("PROJECTION_INVALID", "/structural/occurrences");
  }
}

/** Replace only occurrence references by their recursively checked endpoint/edge keys. */
export function occurrenceKey(
  record,
  get,
  cache,
  budget,
  semanticReference = (id) => id,
  { deferInvalidTopology = false } = {},
) {
  budget.check();
  const pointer = "/structural/occurrences";
  const existing = record.id && cache.get(record.id);
  if (existing) {
    return existing;
  }
  if (isEdge(record)) {
    const ends =
      record.kind === "disjoint-edge" ? record.ends : [record.from, record.to];
    if (!ends.every((id) => isNode(get(id)))) {
      if (deferInvalidTopology) {
        return undefined;
      }
      fail("PROJECTION_INVALID", pointer);
    }
  }
  if (record.kind === "label" && !isEdge(get(record.edge))) {
    if (deferInvalidTopology) {
      return undefined;
    }
    fail("PROJECTION_INVALID", pointer);
  }
  let invalidChild = false;
  const key = semanticKey(
    record,
    "Occurrence",
    (id) => {
      const target = get(id);
      if (isNode(target) || isEdge(target)) {
        const child = occurrenceKey(
          target,
          get,
          cache,
          budget,
          semanticReference,
          {
            deferInvalidTopology,
          },
        );
        invalidChild ||= child === undefined;
        return ["occurrence", child ?? null];
      }
      return ["semantic", semanticReference(id)];
    },
    budget,
    true,
  );
  if (invalidChild) {
    return undefined;
  }
  if (record.id) {
    cache.set(record.id, key);
  }
  return key;
}

/** Placement coverage and hidden incidence are checked after complete topology admission. */
export function validateArtifact(source, context, budget) {
  if (!source.visualization) {
    return;
  }
  const state = source.visualization;
  const occurrences = source.structural.occurrences;
  // Stage 7 follows A7's field order: hidden, placements, prefixes.
  const hidden = new Set(state.hidden);
  for (const record of occurrences) {
    budget.check();
    if (isEdge(record)) {
      const ends =
        record.kind === "disjoint-edge"
          ? record.ends
          : [record.from, record.to];
      if (ends.some((id) => hidden.has(id)) && !hidden.has(record.id)) {
        fail("ARTIFACT_INCOMPLETE", "/visualization/hidden");
      }
    }
    if (
      record.kind === "label" &&
      hidden.has(record.edge) &&
      !hidden.has(record.id)
    ) {
      fail("ARTIFACT_INCOMPLETE", "/visualization/hidden");
    }
  }
  const positionable = new Set();
  for (const record of occurrences) {
    budget.check();
    if (isNode(record) || record.kind === "label") {
      positionable.add(record.id);
    }
  }
  const placed = new Set();
  state.placements.forEach((placement, i) => {
    budget.check();
    if (
      !positionable.has(placement.occurrence) ||
      placed.has(placement.occurrence)
    ) {
      fail("ARTIFACT_INCOMPLETE", `/visualization/placements/${i}`);
    }
    placed.add(placement.occurrence);
  });
  if (placed.size !== positionable.size) {
    fail("ARTIFACT_INCOMPLETE", "/visualization/placements");
  }
  const prefixes = new Set();
  state.prefixes.forEach((binding, i) => {
    budget.check();
    if (prefixes.has(binding.prefix)) {
      fail("ARTIFACT_INCOMPLETE", `/visualization/prefixes/${i}/prefix`);
    }
    prefixes.add(binding.prefix);
  });
}
