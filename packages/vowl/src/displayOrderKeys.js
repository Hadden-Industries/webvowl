import { fail } from "./errors.js";
import { checkString } from "./snapshot.js";
import { refineDataset } from "./refinedRdf.js";
import { canonicalizeRdfDataset } from "./internalRdf.js";

export const DISPLAY_ORDER_KEY_PURPOSE = "display-order-v1";
const base = "urn:webvowl:display-order:v1:";
const named = (value) => ({ termType: "NamedNode", value });
const datatype = named(base + "anchor");
const graph = { termType: "DefaultGraph", value: "" };
const literal = (value) => ({
  termType: "Literal",
  value,
  language: "",
  datatype,
});
const isNode = ({ kind }) => kind === "class-node" || kind === "datatype-node";

/**
 * PERF-DEC-015's finite display mapping, from an admitted immutable structure.
 * Only node/edge incidence and typed anchors enter it. Local handles name input
 * blank vertices; they never become ground values. Labels are derived from
 * edges and have no ordering vertex. This is never canonical artifact identity.
 */
export function mapDisplayOrder(structural, budget) {
  budget.check();
  const records = new Map();
  for (const collection of ["subjects", "roles", "expressions", "constructs"]) {
    for (const record of structural[collection]) {
      budget.charge("primaryRecords");
      records.set(record.id, record);
    }
  }
  const dataset = [];
  let blankCount = 0;
  function blank() {
    budget.charge("embeddedValues");
    return { termType: "BlankNode", value: `d${blankCount++}` };
  }
  function required(index, id) {
    const value = index.get(id);
    if (!value) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "display-mapping" });
    }
    return value;
  }
  function emit(subject, field, object) {
    budget.charge("rdfQuads");
    dataset.push({ subject, predicate: named(base + field), object, graph });
  }
  const anchors = new Map();
  function anchor(id) {
    budget.poll();
    if (anchors.has(id)) {
      return anchors.get(id);
    }
    const record = required(records, id);
    const subject = record.subject && required(records, record.subject);
    if (subject?.iri !== undefined) {
      const bytes = checkString(subject.iri, undefined, budget, false);
      // Admit JSON escaping and later RDF spelling before allocating either;
      // this conservative allowance also covers the fixed role-kind spelling.
      budget.charge("totalStringBytes", 1024 + bytes * 8);
      // Ordered tuple: role kind and complete IRI keep punned anchors distinct.
      const result = literal(JSON.stringify([record.kind, subject.iri]));
      anchors.set(id, result);
      return result;
    }
    const result = blank();
    anchors.set(id, result);
    emit(result, "kind", named(base + (record.kind ?? "anonymous-subject")));
    if (record.subject) {
      emit(result, "subject", anchor(record.subject));
    }
    return result;
  }
  const vertices = new Map();
  const scopes = new Map();
  for (const occurrence of structural.occurrences) {
    budget.poll();
    if (occurrence.kind === "label") {
      continue;
    }
    const vertex = blank();
    vertices.set(occurrence.id, vertex);
    if (occurrence.kind === "restriction-edge") {
      scopes.set(occurrence.construct, vertex);
    }
  }
  const nodes = [];
  function anchorsFor(vertex, field, ids) {
    for (const id of ids) {
      budget.poll();
      emit(vertex, field, anchor(id));
    }
  }
  for (const occurrence of structural.occurrences) {
    budget.poll();
    if (occurrence.kind === "label") {
      continue;
    }
    const vertex = required(vertices, occurrence.id);
    emit(vertex, "kind", named(base + occurrence.kind));
    if (isNode(occurrence)) {
      nodes.push([occurrence.id, vertex]);
      anchorsFor(vertex, "target", occurrence.targets ?? [occurrence.target]);
      const context = occurrence.context;
      if (context) {
        emit(vertex, "context-kind", named(base + context.kind));
        anchorsFor(
          vertex,
          context.kind === "class" ? "context-target" : "context-property",
          context.targets ?? context.properties,
        );
        if (context.scope) {
          emit(vertex, "scope", required(scopes, context.scope));
        }
      }
      continue;
    }
    if (occurrence.kind === "disjoint-edge") {
      for (const id of occurrence.ends) {
        emit(vertex, "end", required(vertices, id));
      }
      continue;
    }
    emit(vertex, "from", required(vertices, occurrence.from));
    emit(vertex, "to", required(vertices, occurrence.to));
    switch (occurrence.kind) {
      case "property-edge":
        anchorsFor(vertex, "property", occurrence.properties);
        break;
      case "inverse-edge":
        anchorsFor(vertex, "forward", occurrence.forward);
        anchorsFor(vertex, "reverse", occurrence.reverse);
        break;
      case "operator-edge":
        emit(
          vertex,
          "operator",
          named(base + required(records, occurrence.expression).kind),
        );
        break;
      case "restriction-edge": {
        const restriction = required(
          records,
          required(records, occurrence.construct).super,
        );
        emit(vertex, "restriction", named(base + restriction.kind));
        emit(vertex, "property", anchor(restriction.property));
        const bytes = checkString(
          restriction.cardinality,
          undefined,
          budget,
          false,
        );
        budget.charge("totalStringBytes", bytes * 8 + 32);
        emit(vertex, "cardinality", literal(restriction.cardinality));
        break;
      }
      case "subclass-edge":
        break;
      default:
        fail("DEPENDENCY_FAILURE", undefined, { stage: "display-mapping" });
    }
  }
  budget.check();
  return { dataset, nodes, blankCount };
}

/** Derive unique node-order keys; retain no cache beyond this operation. */
export async function prepareDisplayOrderKeys(structural, budget) {
  const { dataset, nodes, blankCount } = mapDisplayOrder(structural, budget);
  const refined = await refineDataset(dataset, budget);
  const labels = await canonicalizeRdfDataset(
    refined.dataset,
    blankCount,
    budget,
  );
  const issued = new Set();
  const correspondence = nodes.map(([previous, vertex]) => {
    budget.poll();
    const label = labels.get(vertex.value);
    if (
      typeof label !== "string" ||
      !/^c14n(0|[1-9][0-9]*)$/.test(label) ||
      issued.has(label)
    ) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "display-id-map" });
    }
    issued.add(label);
    return { previous, current: `${DISPLAY_ORDER_KEY_PURPOSE}:${label}` };
  });
  budget.check();
  return correspondence;
}
