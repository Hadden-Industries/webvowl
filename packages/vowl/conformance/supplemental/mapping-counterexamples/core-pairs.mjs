// SPDX-License-Identifier: AGPL-3.0-only
// Positive retained-field differences with explicit source support and topology.
import assert from "node:assert/strict";
import {
  definitions,
  expressionVariants,
  baseConstructVariants,
} from "../field-contract/contracts.mjs";
import { model, projectFixture, IRIS } from "./model.mjs";

function literal(m, alternate = false) {
  m.role("string", "datatype");
  return {
    kind: "typed",
    lexical: alternate ? "after" : "before",
    datatype: IRIS.string,
  };
}
function annotation(m, alternate = false) {
  m.role("annotation", "annotation-property", "urn:mapping-pair:annotation");
  return {
    predicate: "urn:mapping-pair:annotation",
    value: literal(m, alternate),
    annotations: [],
  };
}
function value(m, type, alternate = false) {
  if (type.type === "reference")
    return m.alternatives(type.sort)[Number(alternate)];
  if (type.type === "iri")
    return `urn:mapping-pair:${alternate ? "after" : "before"}`;
  if (type.type === "text") return alternate ? "after" : "before";
  if (type.type === "decimal")
    return alternate ? "123456789012345678901234567890" : "0";
  if (type.type === "enum") {
    assert(type.values.length > 1);
    return type.values[Number(alternate)];
  }
  if (type.type === "record") {
    if (["Literal", "AnnotationValue"].includes(type.record))
      return literal(m, alternate);
    if (type.record === "Facet")
      return { facet: "urn:mapping-pair:facet", value: literal(m, alternate) };
    throw new Error(`Unsupported fixture record ${type.record}`);
  }
  if (type.type === "collection") {
    const first = value(m, type.item, false),
      second = value(m, type.item, true);
    if (type.sequence) return alternate ? [first, second] : [first, first];
    if (type.min === 0) return alternate ? [first] : [];
    return [alternate ? second : first];
  }
  throw new Error(`Unsupported positive field type ${type.type}`);
}
function payload(m, descriptor) {
  const result = {};
  for (const [field, type] of Object.entries(descriptor.fields)) {
    if (field === "id") continue;
    if (type.type === "enum") result[field] = type.values[0];
    else result[field] = value(m, type);
  }
  // Both lexical alternatives are declared before either member of the pair.
  if (result.predicate) {
    m.role(
      "predicate-before",
      "annotation-property",
      "urn:mapping-pair:before",
    );
    m.role("predicate-after", "annotation-property", "urn:mapping-pair:after");
  }
  return result;
}
function supportedRoot(m, id, kind) {
  if (kind === "object-inverse")
    m.fact("expression-owner", "key", {
      class: m.classes()[0],
      objectProperties: [id],
      dataProperties: [],
    });
  else if (
    (kind.startsWith("data-") &&
      [
        "data-intersection",
        "data-union",
        "data-complement",
        "data-enumeration",
      ].includes(kind)) ||
    kind === "datatype-restriction"
  )
    m.fact("expression-owner", "data-range", {
      property: m.alternatives("DP")[0],
      target: id,
    });
  else
    m.fact("expression-owner", "key", {
      class: id,
      objectProperties: [],
      dataProperties: [],
    });
}
function isEndpoint(kind) {
  return /^(object|data|rdf)-(domain|range)$/.test(kind);
}
function aggregateIfRequired(m, first, second) {
  if (
    isEndpoint(first.kind) &&
    first.property === second.property &&
    first.target !== second.target
  ) {
    const type = definitions[`Construct:${first.kind}`].fields.target;
    const data = type.sort === "D";
    const expression = m.expression(
      "anchor-aggregate",
      data ? "data-intersection" : "class-intersection",
      { members: [first.target, second.target] },
    );
    m.fact("anchor-supported-base", first.kind, {
      property: first.property,
      target: expression,
    });
  } else {
    const { kind, ...left } = first;
    const { kind: rightKind, ...right } = second;
    m.fact("anchor-supported-before", kind, left);
    m.fact("anchor-supported-after", rightKind, right);
  }
}
function pair(descriptor, field) {
  const m = model();
  const kind = descriptor.fields.kind.values[0];
  const first = payload(m, descriptor),
    second = structuredClone(first);
  const type = descriptor.fields[field];
  second[field] = value(m, type, true);
  if (isEndpoint(kind) && field === "property") {
    const family = kind.split("-")[0],
      side = kind.split("-")[1];
    const target =
      family === "rdf"
        ? "Resource"
        : family === "data" && side === "range"
          ? "Literal"
          : "Thing";
    m.role(
      target,
      target === "Literal"
        ? "datatype"
        : target === "Resource"
          ? "rdf-class"
          : "class",
    );
    first.target = target;
    second.target = target;
  }
  if (kind === "inverse-properties") {
    const [p, q] = m.alternatives("P");
    m.fact("property-backbone", "equivalent-object-properties", {
      members: [p, q],
    });
  }
  let before, after;
  if (descriptor.family === "Expression") {
    m.expression(
      "focus",
      kind,
      Object.fromEntries(
        Object.entries(first).filter(([name]) => name !== "kind"),
      ),
    );
    supportedRoot(m, "focus", kind);
    before = structuredClone(m.source);
    after = structuredClone(m.source);
    after.structural.expressions.find((item) => item.id === "focus")[field] =
      second[field];
  } else if (descriptor.family === "Construct") {
    m.fact(
      "focus",
      kind,
      Object.fromEntries(
        Object.entries(first).filter(([name]) => name !== "kind"),
      ),
    );
    before = structuredClone(m.source);
    after = structuredClone(m.source);
    after.structural.constructs.find((item) => item.id === "focus")[field] =
      second[field];
  } else {
    assert.equal(descriptor.family, "Assertion");
    if (kind !== "declaration") aggregateIfRequired(m, first, second);
    m.fact("anchor-focus", "assertion-anchor", {
      assertion: first,
      annotations: [annotation(m)],
    });
    before = structuredClone(m.source);
    after = structuredClone(m.source);
    after.structural.constructs.find(
      (item) => item.id === "anchor-focus",
    ).assertion[field] = second[field];
  }
  projectFixture(before);
  projectFixture(after);
  return {
    id: `field-${descriptor.name}-${field}`
      .replaceAll(/[^A-Za-z0-9]+/g, "-")
      .toLowerCase(),
    obligation: `mapping/${descriptor.name}/${field}`,
    descriptor: descriptor.name,
    field,
    rules: ["A1", descriptor.citation, "A5", "A6", "B2", "D18.1"],
    sourceContract:
      descriptor.family === "Assertion"
        ? "Both supported base alternatives coexist before and after; same-property endpoint targets are represented by one immediate aggregate. Only the selected embedded assertion field varies before recomputing complete topology."
        : "Both scalar/reference alternatives are declared before and after. The selected retained field varies, followed by independent B2 topology generation; every companion change is inventoried separately.",
    before,
    after,
  };
}
export function corePairs() {
  const result = [];
  const names = [
    ...Object.keys(expressionVariants).map((kind) => `Expression:${kind}`),
    ...Object.keys(baseConstructVariants).map((kind) => `Construct:${kind}`),
    ...[...Object.keys(baseConstructVariants), "declaration"].map(
      (kind) => `Assertion:${kind}`,
    ),
  ];
  for (const name of names) {
    const descriptor = definitions[name];
    for (const [field, type] of Object.entries(descriptor.fields)) {
      if (
        ["id", "kind"].includes(field) ||
        (type.type === "enum" && type.values.length === 1)
      )
        continue;
      result.push(pair(descriptor, field));
    }
  }
  return result;
}
