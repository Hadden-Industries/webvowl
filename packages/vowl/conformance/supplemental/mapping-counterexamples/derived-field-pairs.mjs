// SPDX-License-Identifier: AGPL-3.0-only
// B1 field variation with a preserved generation-key set and explicit state binding.
import assert from "node:assert/strict";
import { candidates } from "../field-contract/bindings.mjs";
import { definitions, visit } from "../field-contract/contracts.mjs";
import { at } from "../field-contract/support.mjs";
import { model, projectFixture } from "./model.mjs";
function extraModels() {
  const result = [];
  const add = (id, m) => result.push({ id, source: projectFixture(m.source) });
  {
    const m = model();
    for (const name of ["A", "B", "C"]) m.role(name, "class");
    m.role("Thing", "class");
    for (const [name, domain, range] of [
      ["p", "A", "B"],
      ["q", "B", "A"],
      ["u", "B", "C"],
      ["v", "C", "B"],
    ]) {
      m.role(name, "object-property");
      m.fact(`${name}-domain`, "object-domain", {
        property: name,
        target: domain,
      });
      m.fact(`${name}-range`, "object-range", {
        property: name,
        target: range,
      });
    }
    m.role("w", "object-property");
    m.fact("inverse-pq", "inverse-properties", { members: ["p", "q"] });
    m.fact("inverse-uv", "inverse-properties", { members: ["u", "v"] });
    add("independent-two-inverse-pairs-and-property", m);
  }
  {
    const m = model();
    m.role("A", "class");
    m.role("B", "class");
    m.expression("union", "class-union", { members: ["A"] });
    m.expression("intersection", "class-intersection", { members: ["B"] });
    m.fact("key-union", "key", {
      class: "union",
      objectProperties: [],
      dataProperties: [],
    });
    m.fact("key-intersection", "key", {
      class: "intersection",
      objectProperties: [],
      dataProperties: [],
    });
    m.fact("sub-ab", "subclass", { sub: "A", super: "B" });
    m.fact("sub-ba", "subclass", { sub: "B", super: "A" });
    m.fact("disjoint-self", "disjoint-classes", { members: ["A"] });
    m.fact("disjoint-pair", "disjoint-classes", { members: ["A", "B"] });
    add("independent-operators-subclasses-disjoint", m);
  }
  for (const family of ["object", "data"]) {
    const m = model();
    m.role("A", "class");
    m.role("B", "class");
    const property = m.alternatives(family === "object" ? "P" : "DP")[0],
      filler = family === "object" ? "Thing" : "Literal";
    for (const [suffix, sub, kind] of [
      ["one", "A", "min"],
      ["two", "B", "max"],
    ]) {
      m.expression(`restriction-${suffix}`, `${family}-${kind}-cardinality`, {
        property,
        cardinality: "1",
        filler,
      });
      m.fact(`sub-${suffix}`, "subclass", {
        sub,
        super: `restriction-${suffix}`,
      });
    }
    add(`independent-${family}-restriction-scopes`, m);
  }
  return result;
}
const positionable = (item) =>
  ["class-node", "datatype-node", "label"].includes(item.kind);
export function artifact(structural) {
  return {
    structural: structuredClone(structural),
    visualization: {
      placements: structural.occurrences
        .filter(positionable)
        .map((item, index) => ({
          occurrence: item.id,
          position: { x: index * 17 + 3, y: index * 13 + 5 },
          pinned: false,
        })),
      camera: { center: { x: 0, y: 0 }, zoom: 2 },
      hidden: [],
      labelSelection: { mode: "iri" },
      prefixes: [],
      display: {
        compactNotation: false,
        nodeScaling: "uniform",
        externalColoring: false,
      },
    },
  };
}
function closure(occurrences, initiallyHidden) {
  const hidden = new Set(initiallyHidden);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of occurrences) {
      const references =
        item.kind === "label"
          ? [item.edge]
          : item.kind.endsWith("-edge")
            ? (item.ends ?? [item.from, item.to])
            : [];
      if (!hidden.has(item.id) && references.some((id) => hidden.has(id))) {
        hidden.add(item.id);
        changed = true;
      }
    }
  }
  return [...hidden];
}
export function swapOccurrencePayloads(source, first, second) {
  const after = structuredClone(source),
    rename = (id) => (id === first ? second : id === second ? first : id);
  for (const item of after.structural.occurrences) {
    item.id = rename(item.id);
    for (const field of ["from", "to", "edge"])
      if (item[field]) item[field] = rename(item[field]);
    if (item.ends) item.ends = item.ends.map(rename);
  }
  const order = new Map(
    source.structural.occurrences.map((item, index) => [item.id, index]),
  );
  after.structural.occurrences.sort(
    (a, b) => order.get(a.id) - order.get(b.id),
  );
  return after;
}
export async function derivedCandidates() {
  const { vectors } = await candidates([
    "supplemental/field-contract/additional-positive-manifest.json",
    "supplemental/field-contract/state-identity-manifest.json",
    "supplemental/mapping-counterexamples/core-manifest.json",
    "supplemental/mapping-counterexamples/value-state-manifest.json",
  ]);
  const fixtures = [
    ...vectors.map((item) => ({
      id: item.id,
      source: { structural: item.source.structural },
      sourceWitness: item.files["source.json"],
    })),
    ...extraModels(),
  ];
  fixtures.sort(
    (a, b) => JSON.stringify(a.source).length - JSON.stringify(b.source).length,
  );
  const desired = Object.values(definitions)
    .filter(
      (item) =>
        item.name.startsWith("Occurrence:") ||
        item.name.startsWith("Context:") ||
        item.name === "PropertyContext",
    )
    .flatMap((descriptor) =>
      Object.keys(descriptor.fields)
        .filter((field) => field !== "id")
        .map((field) => ({
          descriptor: descriptor.name,
          field,
          obligation: `mapping/${descriptor.name}/${field}`,
        })),
    );
  const options = new Map(
    desired.map((item) => [item.obligation, { ...item, candidates: [] }]),
  );
  for (const fixture of fixtures) {
    const before = artifact(fixture.source.structural);
    visit(before, "SourceArtifact", (descriptor, record, path) => {
      if (path[0] !== "structural" || path[1] !== "occurrences") return;
      const owner = before.structural.occurrences[path[2]];
      for (const field of Object.keys(descriptor.fields).filter(
        (item) => item !== "id",
      )) {
        const entry = options.get(`mapping/${descriptor.name}/${field}`);
        if (!entry || entry.candidates.length >= 12) continue;
        for (const other of before.structural.occurrences.filter(
          (item) =>
            item.id !== owner.id && positionable(item) === positionable(owner),
        )) {
          const after = swapOccurrencePayloads(before, owner.id, other.id);
          let newRecord;
          try {
            newRecord = at(after, path);
          } catch {
            continue;
          }
          if (
            !newRecord ||
            JSON.stringify(record[field]) === JSON.stringify(newRecord[field])
          )
            continue;
          if (!Object.hasOwn(newRecord, field)) continue;
          const left = structuredClone(before);
          if (!positionable(owner)) {
            left.visualization.hidden = closure(left.structural.occurrences, [
              owner.id,
            ]);
            after.visualization.hidden = closure(after.structural.occurrences, [
              owner.id,
            ]);
          }
          entry.candidates.push({
            fixture: fixture.id,
            sourceWitness: fixture.sourceWitness,
            before: left,
            after,
            path,
            first: owner.id,
            second: other.id,
            selectorAfter: newRecord.kind ?? newRecord.mode ?? null,
          });
          if (entry.candidates.length >= 12) break;
        }
      }
    });
  }
  for (const entry of options.values()) {
    if (!entry.candidates.length)
      assert(
        entry.descriptor === "PropertyContext" && entry.field === "kind",
        `No independently valid paired occurrence candidate: ${entry.obligation}`,
      );
  }
  return [...options.values()];
}
