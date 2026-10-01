// SPDX-License-Identifier: AGPL-3.0-only
// A6 inverse/template audit v2: categories follow source collections and all
// non-root allocations are blank nodes. The frozen v1 remains unchanged.
// This reads trusted corpus N-Quads. It is neither a general RDF parser nor a
// public Canonical VOWL validator and imports no production mapper.
import assert from "node:assert/strict";
import { select } from "../../field-contract/contracts.mjs";
import { pointer } from "../../field-contract/support.mjs";
export const mapping =
  "https://haddenindustries.com/ontology/vowl/canonical-mapping/v1#";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const named = (value) => `<${value}>`;
const typePredicate = named(`${rdf}type`);
const asciiLower = (value) =>
  value.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) + 32),
  );
function unescape(value) {
  return value.replace(
    /\\(U[0-9A-Fa-f]{8}|u[0-9A-Fa-f]{4}|[tbnrf"\\])/g,
    (_, code) => {
      if (code[0] === "u" || code[0] === "U")
        return String.fromCodePoint(parseInt(code.slice(1), 16));
      return {
        t: "\t",
        b: "\b",
        n: "\n",
        r: "\r",
        f: "\f",
        '"': '"',
        "\\": "\\",
      }[code];
    },
  );
}
function literal(term) {
  const match = /^"((?:[^"\\]|\\.)*)"(?:\^\^<([^>]+)>)?$/.exec(term);
  return (
    match && {
      lexical: unescape(match[1]),
      datatype: match[2] ?? `${xsd}string`,
    }
  );
}
export function auditTemplates(source, profile, ids, nquads) {
  const rows = nquads
    .trim()
    .split("\n")
    .map((line) => {
      const match = /^(<[^>]+>|_:[^\s]+) (<[^>]+>) (.+) \.$/.exec(line);
      assert(match, `Not one default-graph corpus triple: ${line}`);
      return { subject: match[1], predicate: match[2], object: match[3], line };
    });
  assert.equal(new Set(rows.map((row) => row.line)).size, rows.length);
  const graph = new Map();
  for (const row of rows) {
    if (!graph.has(row.subject)) graph.set(row.subject, new Map());
    const predicates = graph.get(row.subject);
    if (!predicates.has(row.predicate)) predicates.set(row.predicate, []);
    predicates.get(row.predicate).push(row);
  }
  const links = (node, predicate) => graph.get(node)?.get(predicate) ?? [];
  const objects = (node, predicate) =>
    links(node, predicate).map((row) => row.object);
  const typeIs = (node, value) =>
    JSON.stringify(objects(node, typePredicate)) ===
    JSON.stringify([named(`${mapping}${value}`)]);
  const categoryTypes = {
    subjects: "Subject",
    roles: "Role",
    expressions: "Expression",
    constructs: "Construct",
    occurrences: "Occurrence",
  };
  // A6.2 assigns primary types by containing source collection. The producer's
  // correspondence supplies only lookup labels; it is not a type oracle.
  const sourceCategories = new Map();
  for (const category of Object.keys(categoryTypes))
    for (const record of source.structural[category]) {
      assert(
        !sourceCategories.has(record.id),
        `Duplicate source primary handle ${record.id}`,
      );
      sourceCategories.set(record.id, category);
    }
  const primary = new Map(),
    labels = new Set();
  for (const entry of ids) {
    assert(
      sourceCategories.has(entry.sourceHandle),
      `Unknown primary correspondence handle ${entry.sourceHandle}`,
    );
    assert(
      !primary.has(entry.sourceHandle),
      `Duplicate primary correspondence handle ${entry.sourceHandle}`,
    );
    assert.match(
      entry.rdfcIdentifier,
      /^c14n(?:0|[1-9][0-9]*)$/,
      "Primary correspondence must identify a canonical blank node",
    );
    assert(
      !labels.has(entry.rdfcIdentifier),
      `Shared primary canonical node ${entry.rdfcIdentifier}`,
    );
    labels.add(entry.rdfcIdentifier);
    primary.set(entry.sourceHandle, `_:${entry.rdfcIdentifier}`);
    assert.equal(
      entry.category,
      sourceCategories.get(entry.sourceHandle),
      `Primary category metadata disagrees with source collection for ${entry.sourceHandle}`,
    );
  }
  assert.equal(
    primary.size,
    sourceCategories.size,
    "Primary correspondence must cover the exact source handles",
  );
  const primaryTypes = new Map(
    [...sourceCategories].map(([handle, category]) => [
      primary.get(handle),
      categoryTypes[category],
    ]),
  );
  const consumed = new Set(),
    owned = new Map(),
    records = [];
  function scalarMatches(type, value, term) {
    if (type.type === "reference") return term === primary.get(value);
    if (type.type === "iri")
      return term.startsWith("<") && unescape(term.slice(1, -1)) === value;
    const expectedType =
      type.type === "enum"
        ? `${mapping}token`
        : type.type === "boolean"
          ? `${xsd}boolean`
          : ["number", "positive-number"].includes(type.type)
            ? `${mapping}binary64`
            : `${xsd}string`;
    const expectedLexical = ["language-tag", "language-range"].includes(
      type.type,
    )
      ? asciiLower(value)
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
    const value_ = literal(term);
    return (
      value_?.datatype === expectedType && value_.lexical === expectedLexical
    );
  }
  function match(type, value, term) {
    if (type.type === "record") {
      const descriptor = select(type.record, value);
      if (
        !descriptor ||
        !typeIs(
          term,
          Object.hasOwn(value, "id")
            ? primaryTypes.get(primary.get(value.id))
            : "Object",
        )
      )
        return false;
      if (Object.hasOwn(value, "id") && term !== primary.get(value.id))
        return false;
      const fields = Object.keys(value).filter((name) => name !== "id");
      if ((graph.get(term)?.size ?? 0) !== fields.length + 1) return false;
      return fields.every((field) => {
        const values = objects(term, named(`${mapping}field/${field}`));
        return (
          descriptor.fields[field] &&
          values.length === 1 &&
          match(descriptor.fields[field], value[field], values[0])
        );
      });
    }
    if (type.type === "collection") {
      if (!typeIs(term, type.sequence ? "Sequence" : "Set")) return false;
      const members = objects(
        term,
        named(`${mapping}${type.sequence ? "slot" : "member"}`),
      );
      if (members.length !== value.length) return false;
      const available = new Set(members);
      return value.every((item, index) => {
        const target = [...available].find((candidate) =>
          type.sequence
            ? typeIs(candidate, "Slot") &&
              objects(candidate, named(`${mapping}index`)).length === 1 &&
              literal(objects(candidate, named(`${mapping}index`))[0])
                ?.datatype === `${xsd}nonNegativeInteger` &&
              literal(objects(candidate, named(`${mapping}index`))[0])
                ?.lexical === String(index) &&
              objects(candidate, named(`${mapping}value`)).length === 1 &&
              match(
                type.item,
                item,
                objects(candidate, named(`${mapping}value`))[0],
              )
            : match(type.item, item, candidate),
        );
        if (!target) return false;
        available.delete(target);
        return true;
      });
    }
    return scalarMatches(type, value, term);
  }
  function consume(node, predicate) {
    const selected = links(node, predicate);
    selected.forEach((row) => consumed.add(row.line));
    return selected;
  }
  function own(node, path) {
    assert(
      path.length === 0
        ? node === named(`${mapping}root`)
        : /^_:[^\s]+$/.test(node),
      `A6 allocation must be a blank node except the fixed root at ${pointer(path)}`,
    );
    assert(
      !owned.has(node),
      `Shared auxiliary/primary ownership at ${pointer(path)} and ${owned.get(node)}`,
    );
    owned.set(node, pointer(path));
    consume(node, typePredicate);
  }
  function walk(type, value, node, path) {
    assert(
      match(type, value, node),
      `A6 template mismatch at ${pointer(path)}`,
    );
    if (type.type === "record") {
      own(node, path);
      const descriptor = select(type.record, value),
        fields = {};
      for (const [field, fieldType] of Object.entries(descriptor.fields)) {
        const predicate = named(`${mapping}field/${field}`);
        if (field === "id" || !Object.hasOwn(value, field)) {
          assert.equal(links(node, predicate).length, 0);
          if (field !== "id")
            fields[field] = { present: false, predicate, triples: [] };
          continue;
        }
        const [edge] = consume(node, predicate);
        fields[field] = {
          present: true,
          predicate,
          object: edge.object,
          triples: [edge.line],
          objectTypeTriples: links(edge.object, typePredicate).map(
            (row) => row.line,
          ),
        };
        walk(fieldType, value[field], edge.object, [...path, field]);
      }
      records.push({
        descriptor: descriptor.name,
        pointer: pointer(path),
        node,
        typeTriples: links(node, typePredicate).map((row) => row.line),
        fields,
      });
    } else if (type.type === "collection") {
      own(node, path);
      const members = consume(
          node,
          named(`${mapping}${type.sequence ? "slot" : "member"}`),
        ),
        available = new Set(members.map((row) => row.object));
      value.forEach((item, index) => {
        const selected = [...available].find((candidate) =>
          type.sequence
            ? literal(objects(candidate, named(`${mapping}index`))[0])
                ?.lexical === String(index)
            : match(type.item, item, candidate),
        );
        assert(selected);
        available.delete(selected);
        if (type.sequence) {
          own(selected, [...path, index, "@slot"]);
          consume(selected, named(`${mapping}index`));
          const [edge] = consume(selected, named(`${mapping}value`));
          walk(type.item, item, edge.object, [...path, index]);
        } else walk(type.item, item, selected, [...path, index]);
      });
    }
  }
  // Source envelope does not carry profile; A6 adds this one framing field.
  const root = named(`${mapping}root`),
    framing = consume(root, named(`${mapping}field/profile`));
  assert.equal(framing.length, 1);
  assert.equal(framing[0].object, named(profile));
  const document = { ...source, profile };
  walk(
    {
      type: "record",
      record: source.visualization ? "DocumentArtifact" : "DocumentStructural",
    },
    document,
    root,
    [],
  );
  for (const record of records) {
    if (record.descriptor.startsWith("Document")) {
      record.descriptor = record.descriptor.replace("Document", "Source");
      delete record.fields.profile;
    }
  }
  assert.equal(
    consumed.size,
    rows.length,
    "Unexplained or unreachable RDF facts",
  );
  assert.equal(owned.size, graph.size, "Unowned RDF allocation");
  return {
    records,
    profileFact: framing[0].line,
    quads: rows.length,
    allocatedNodes: owned.size,
    primaryNodes: primary.size,
  };
}
