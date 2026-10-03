// SPDX-License-Identifier: AGPL-3.0-only
// Independent bounded fixture builder, transcribed from A2-A5/B2.
// It is not a general validator, adapter, normalization engine or product helper.
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
export const IRIS = {
  Thing: "http://www.w3.org/2002/07/owl#Thing",
  Resource: "http://www.w3.org/2000/01/rdf-schema#Resource",
  Literal: "http://www.w3.org/2000/01/rdf-schema#Literal",
  string: "http://www.w3.org/2001/XMLSchema#string",
  langString: "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString",
};
const sorted = (values) => [...values].sort();
export function model() {
  const source = {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: [],
      roles: [],
      expressions: [],
      constructs: [],
      occurrences: [],
    },
  };
  const structural = source.structural;
  function role(id, kind, iri = IRIS[id] ?? `urn:mapping-pair:${id}`) {
    const found = structural.roles.find((item) => item.id === id);
    if (found) {
      assert.equal(found.kind, kind);
      return id;
    }
    let subject = structural.subjects.find((item) => item.iri === iri);
    if (!subject) {
      subject = { id: `s:${id}`, iri };
      structural.subjects.push(subject);
    }
    structural.roles.push({ id, kind, subject: subject.id });
    return id;
  }
  function fact(id, kind, fields) {
    structural.constructs.push({ id, kind, ...fields });
    return id;
  }
  function expression(id, kind, fields) {
    structural.expressions.push({ id, kind, ...fields });
    return id;
  }
  function classes() {
    role("A", "class");
    role("B", "class");
    role("C", "class");
    if (!structural.constructs.some((item) => item.id === "class-backbone"))
      fact("class-backbone", "equivalent-classes", {
        members: ["A", "B", "C"],
      });
    return ["A", "B"];
  }
  function alternatives(sort) {
    if (sort === "C" || sort === "C-or-D" || sort === "R-class-kind")
      return classes();
    if (sort === "D" || sort === "R-datatype")
      return [role("D", "datatype"), role("E", "datatype")];
    if (sort === "P" || sort === "R-object-property") {
      role("Thing", "class");
      return [role("p", "object-property"), role("q", "object-property")];
    }
    if (sort === "DP") {
      role("Thing", "class");
      role("Literal", "datatype");
      return [role("dp", "data-property"), role("dq", "data-property")];
    }
    if (sort === "RP") {
      role("Resource", "rdf-class");
      return [role("rp", "rdf-property"), role("rq", "rdf-property")];
    }
    if (sort === "AP")
      return [
        role("ap", "annotation-property"),
        role("aq", "annotation-property"),
      ];
    if (sort === "I") return [role("i", "individual"), role("j", "individual")];
    if (sort === "S") {
      const [first, second] = alternatives("I");
      return [first, second].map(
        (id) => structural.roles.find((item) => item.id === id).subject,
      );
    }
    if (sort === "R") return alternatives("I");
    throw new Error(
      `Fixture builder does not implement reference alternative ${sort}`,
    );
  }
  return { source, structural, role, fact, expression, classes, alternatives };
}

function components(ids, groups) {
  const parent = new Map(ids.map((id) => [id, id]));
  function root(id) {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    return current;
  }
  for (const members of groups) {
    const included = members.filter((id) => parent.has(id));
    for (const id of included.slice(1)) parent.set(root(id), root(included[0]));
  }
  const result = new Map();
  for (const id of ids) {
    const key = root(id);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(id);
  }
  return [...result.values()].map(sorted);
}
export function projectFixture(source) {
  const s = source.structural;
  const roles = new Map(s.roles.map((item) => [item.id, item]));
  const subjects = new Map(s.subjects.map((item) => [item.id, item]));
  const expressions = new Map(s.expressions.map((item) => [item.id, item]));
  const iri = (id) => subjects.get(roles.get(id)?.subject)?.iri;
  const isClass = (id) => ["class", "rdf-class"].includes(roles.get(id)?.kind);
  const isGeneric = (id) =>
    isClass(id) && [IRIS.Thing, IRIS.Resource].includes(iri(id));
  const isOperator = (id) =>
    ["class-union", "class-intersection", "class-complement"].includes(
      expressions.get(id)?.kind,
    );
  const drawable = (id) =>
    isClass(id) || isOperator(id) || roles.get(id)?.kind === "datatype";
  const occurrences = [];
  const nodes = new Map();
  const classNodes = new Map();
  function node(payload) {
    const key = JSON.stringify(payload);
    if (!nodes.has(key)) {
      const value = { id: `node-${nodes.size}`, ...payload };
      nodes.set(key, value);
      occurrences.push(value);
    }
    return nodes.get(key);
  }
  const ordinary = s.roles
    .filter((item) => isClass(item.id) && !isGeneric(item.id))
    .map((item) => item.id);
  const namedOrdinary = ordinary.filter((id) => iri(id));
  const groups = components(
    namedOrdinary,
    s.constructs
      .filter((item) => item.kind === "equivalent-classes")
      .map((item) => item.members),
  );
  for (const group of [
    ...groups,
    ...ordinary.filter((id) => !iri(id)).map((id) => [id]),
  ]) {
    const value = node({ kind: "class-node", targets: group });
    for (const id of group) classNodes.set(id, value);
  }
  for (const expression of s.expressions.filter((item) => isOperator(item.id)))
    classNodes.set(
      expression.id,
      node({ kind: "class-node", targets: [expression.id] }),
    );
  function endpoint(id, opposite, context, forcePropertyContext = false) {
    assert(drawable(id), `Unrepresented endpoint ${id}`);
    if (classNodes.has(id)) return classNodes.get(id);
    if (roles.get(id)?.kind === "datatype")
      return node({ kind: "datatype-node", target: id, context });
    assert(isGeneric(id));
    const scoped =
      forcePropertyContext || roles.get(opposite)?.kind === "datatype";
    const oppositeTargets = classNodes.get(opposite)?.targets ?? [opposite];
    return node({
      kind: "class-node",
      targets: [id],
      context: scoped ? context : { kind: "class", targets: oppositeTargets },
    });
  }
  function edge(payload, labels = ["single"]) {
    const value = {
      id: `edge-${occurrences.filter((item) => item.kind.endsWith("-edge")).length}`,
      ...payload,
    };
    occurrences.push(value);
    for (const direction of labels)
      occurrences.push({
        id: `${value.id}-label-${direction}`,
        kind: "label",
        edge: value.id,
        direction,
      });
    return value;
  }
  const propertyPartitions = [],
    byProperty = new Map();
  for (const family of ["object", "data", "rdf"]) {
    const ids = s.roles
      .filter((item) => item.kind === `${family}-property`)
      .map((item) => item.id);
    const familyGroups = components(
      ids,
      s.constructs
        .filter((item) => item.kind === `equivalent-${family}-properties`)
        .map((item) => item.members),
    );
    function direct(id, side) {
      const facts = s.constructs.filter(
        (item) => item.kind === `${family}-${side}` && item.property === id,
      );
      assert(facts.length <= 1, "Fixture endpoints must already be aggregated");
      if (facts.length) return facts[0].target;
      const targetIri =
        family === "rdf"
          ? IRIS.Resource
          : family === "data" && side === "range"
            ? IRIS.Literal
            : IRIS.Thing;
      const builtin = s.roles.find(
        (item) =>
          iri(item.id) === targetIri &&
          (side === "range" && family === "data"
            ? item.kind === "datatype"
            : isClass(item.id)),
      );
      // A missing default is allowed only when the explicit opposite is undrawable;
      // this bounded builder normally declares both builtins as explicit roles.
      return builtin?.id;
    }
    for (const group of familyGroups) {
      const partitions = new Map();
      for (const id of group) {
        const domain = direct(id, "domain"),
          range = direct(id, "range");
        const key = JSON.stringify([domain, range]);
        if (!partitions.has(key))
          partitions.set(key, { properties: [], domain, range });
        partitions.get(key).properties.push(id);
      }
      for (const partition of partitions.values()) {
        partition.properties.sort();
        partition.drawable =
          drawable(partition.domain) && drawable(partition.range);
        if (partition.drawable) {
          const context = {
            kind: "property",
            properties: partition.properties,
          };
          partition.from = endpoint(
            partition.domain,
            partition.range,
            context,
          ).id;
          partition.to = endpoint(
            partition.range,
            partition.domain,
            context,
          ).id;
        }
        propertyPartitions.push(partition);
        for (const id of partition.properties) byProperty.set(id, partition);
      }
    }
  }
  const represented = new Set();
  const partitionKey = (partition) =>
    Buffer.from(
      JSON.stringify(
        partition.properties
          .map((id) => [iri(id), roles.get(id).kind])
          .sort((a, b) =>
            Buffer.compare(
              Buffer.from(JSON.stringify(a)),
              Buffer.from(JSON.stringify(b)),
            ),
          ),
      ),
    );
  for (const construct of s.constructs.filter(
    (item) => item.kind === "inverse-properties",
  )) {
    if (
      !construct.members.every(
        (id) => roles.get(id)?.kind === "object-property",
      )
    )
      continue;
    const a = byProperty.get(construct.members[0]),
      b = byProperty.get(construct.members[1] ?? construct.members[0]);
    if (
      !a?.drawable ||
      !b?.drawable ||
      a.domain !== b.range ||
      a.range !== b.domain
    )
      continue;
    const [forward, reverse] =
      Buffer.compare(partitionKey(a), partitionKey(b)) <= 0 ? [a, b] : [b, a];
    edge(
      {
        kind: "inverse-edge",
        construct: construct.id,
        forward: forward.properties,
        reverse: reverse.properties,
        from: forward.from,
        to: forward.to,
      },
      ["forward", "reverse"],
    );
    represented.add(a);
    represented.add(b);
  }
  for (const partition of propertyPartitions)
    if (partition.drawable && !represented.has(partition))
      edge({
        kind: "property-edge",
        properties: partition.properties,
        from: partition.from,
        to: partition.to,
      });
  for (const construct of s.constructs.filter(
    (item) => item.kind === "subclass",
  )) {
    if (drawable(construct.sub) && drawable(construct.super)) {
      const from = endpoint(construct.sub, construct.super),
        to = endpoint(construct.super, construct.sub);
      edge({
        kind: "subclass-edge",
        construct: construct.id,
        from: from.id,
        to: to.id,
      });
    } else {
      const restriction = expressions.get(construct.super);
      if (
        !isClass(construct.sub) ||
        !iri(construct.sub) ||
        !/^(object|data)-(min|max|exact)-cardinality$/.test(
          restriction?.kind ?? "",
        )
      )
        continue;
      const family = restriction.kind.startsWith("object") ? "object" : "data";
      if (
        roles.get(restriction.property)?.kind !== `${family}-property` ||
        iri(restriction.filler) !==
          IRIS[family === "object" ? "Thing" : "Literal"]
      )
        continue;
      const context = {
        kind: "property",
        properties: [restriction.property],
        scope: construct.id,
      };
      const from = endpoint(construct.sub, restriction.filler, context),
        to = endpoint(restriction.filler, construct.sub, context, true);
      edge({
        kind: "restriction-edge",
        construct: construct.id,
        from: from.id,
        to: to.id,
      });
    }
  }
  for (const construct of s.constructs.filter(
    (item) => item.kind === "disjoint-classes",
  )) {
    const members = construct.members.filter(
      (id) => isClass(id) || isOperator(id),
    );
    const pairs =
      construct.members.length === 1 && members.length === 1
        ? [[members[0], members[0]]]
        : members.flatMap((first, i) =>
            members.slice(i + 1).map((second) => [first, second]),
          );
    const seen = new Set();
    for (const [first, second] of pairs) {
      const ends = sorted(
        new Set([endpoint(first, second).id, endpoint(second, first).id]),
      );
      const key = JSON.stringify(ends);
      if (!seen.has(key)) {
        edge({ kind: "disjoint-edge", construct: construct.id, ends }, []);
        seen.add(key);
      }
    }
  }
  for (const expression of s.expressions.filter((item) =>
    isOperator(item.id),
  )) {
    const targets =
      expression.kind === "class-complement"
        ? [expression.operand]
        : expression.members;
    const from = classNodes.get(expression.id),
      seen = new Set();
    for (const target of targets.filter(
      (id) => isClass(id) || isOperator(id),
    )) {
      const to = endpoint(target, expression.id);
      if (!seen.has(to.id)) {
        edge(
          {
            kind: "operator-edge",
            expression: expression.id,
            from: from.id,
            to: to.id,
          },
          [],
        );
        seen.add(to.id);
      }
    }
  }
  s.occurrences = occurrences;
  return source;
}
