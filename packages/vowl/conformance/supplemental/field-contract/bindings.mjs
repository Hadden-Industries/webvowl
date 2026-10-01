// SPDX-License-Identifier: AGPL-3.0-only
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { visit } from "./contracts.mjs";
import { baseline, bundle, readPinned } from "./support.mjs";

export async function candidates(additional = []) {
  const { vectors, header } = await baseline();
  for (const path of [
    "supplemental/field-contract/positive-manifest.json",
    ...additional,
  ]) {
    const manifest = JSON.parse(await readFile(resolve(bundle, path)));
    for (const vector of manifest.vectors)
      vectors.push({
        ...vector,
        manifest: path,
        source: JSON.parse(await readPinned(vector.files["source.json"])),
      });
  }
  const records = new Map();
  for (const fixture of vectors) {
    for (const operation of ["canonicalize", "decode"]) {
      const document =
        operation === "canonicalize"
          ? fixture.source
          : JSON.parse(await readPinned(fixture.files["canonical.json"]));
      const kind = document.visualization ? "Artifact" : "Structural";
      const root = `${operation === "canonicalize" ? "Source" : "Document"}${kind}`;
      const cost = JSON.stringify(document).length;
      visit(document, root, (descriptor, value, path) => {
        const witness = {
          fixture,
          operation,
          document,
          descriptor,
          value,
          path,
          cost,
        };
        if (!records.has(descriptor.name)) records.set(descriptor.name, []);
        records.get(descriptor.name).push(witness);
      });
    }
  }
  for (const list of records.values())
    list.sort(
      (a, b) =>
        Number(a.operation === "decode") - Number(b.operation === "decode") ||
        a.cost - b.cost ||
        (a.fixture.id < b.fixture.id
          ? -1
          : a.fixture.id > b.fixture.id
            ? 1
            : 0),
    );
  return { records, vectors, header };
}
export function positiveMatch(cell, witness) {
  const value = witness.value[cell.field];
  if (cell.mutation === "positive-record") return true;
  if (cell.mutation === "positive-present")
    return Object.hasOwn(witness.value, cell.field);
  if (cell.mutation === "positive-absent")
    return !Object.hasOwn(witness.value, cell.field);
  if (cell.mutation === "positive-empty")
    return Array.isArray(value) && value.length === 0;
  if (cell.mutation === "positive-enum") return value === cell.value;
  return false;
}
export function referenceRecords(document) {
  return [
    "subjects",
    "roles",
    "expressions",
    "constructs",
    "occurrences",
  ].flatMap((category) =>
    document.structural[category].map((value) => ({ category, value })),
  );
}
const classKinds = [
  "class-intersection",
  "class-union",
  "class-complement",
  "class-enumeration",
  "object-some",
  "object-all",
  "object-value",
  "object-self",
  "object-min-cardinality",
  "object-max-cardinality",
  "object-exact-cardinality",
  "data-some",
  "data-all",
  "data-value",
  "data-min-cardinality",
  "data-max-cardinality",
  "data-exact-cardinality",
];
const dataKinds = [
  "data-intersection",
  "data-union",
  "data-complement",
  "data-enumeration",
  "datatype-restriction",
];
export function referenceAccepts(sort, { category, value }) {
  if (sort === "S" || sort === "S-anonymous")
    return (
      category === "subjects" && (sort === "S" || !Object.hasOwn(value, "iri"))
    );
  if (sort === "R") return category === "roles";
  if (sort === "X") return category === "expressions";
  if (sort === "K") return category === "constructs";
  if (sort === "O") return category === "occurrences";
  if (sort === "C")
    return (
      (category === "roles" && ["class", "rdf-class"].includes(value.kind)) ||
      (category === "expressions" && classKinds.includes(value.kind))
    );
  if (sort === "D")
    return (
      (category === "roles" && value.kind === "datatype") ||
      (category === "expressions" && dataKinds.includes(value.kind))
    );
  if (sort === "C-or-D")
    return (
      referenceAccepts("C", { category, value }) ||
      referenceAccepts("D", { category, value })
    );
  if (sort === "P")
    return (
      (category === "roles" && value.kind === "object-property") ||
      (category === "expressions" && value.kind === "object-inverse")
    );
  if (["DP", "RP", "AP", "I"].includes(sort))
    return (
      category === "roles" &&
      value.kind ===
        {
          DP: "data-property",
          RP: "rdf-property",
          AP: "annotation-property",
          I: "individual",
        }[sort]
    );
  if (sort === "R-property")
    return (
      category === "roles" &&
      ["object-property", "data-property", "rdf-property"].includes(value.kind)
    );
  if (sort === "R-class-kind")
    return category === "roles" && ["class", "rdf-class"].includes(value.kind);
  if (sort.startsWith("R-"))
    return category === "roles" && value.kind === sort.slice(2);
  if (sort.startsWith("K-"))
    return category === "constructs" && value.kind === sort.slice(2);
  if (sort === "X-operator")
    return (
      category === "expressions" &&
      ["class-union", "class-intersection", "class-complement"].includes(
        value.kind,
      )
    );
  throw new Error(`Unspecified independent reference sort ${sort}`);
}
function categoriesFor(sort) {
  if (sort.startsWith("S")) return ["subjects"];
  if (["C", "D", "C-or-D", "P"].includes(sort)) return ["roles", "expressions"];
  if (["DP", "RP", "AP", "I"].includes(sort) || sort.startsWith("R"))
    return ["roles"];
  if (sort.startsWith("K")) return ["constructs"];
  if (sort.startsWith("X")) return ["expressions"];
  if (sort.startsWith("O")) return ["occurrences"];
  throw new Error(`Unspecified category ${sort}`);
}
export function alternateReference(witness, type, mode) {
  const item = type.type === "collection" ? type.item : type;
  const categories = categoriesFor(item.sort);
  return referenceRecords(witness.document).find((record) =>
    mode === "category"
      ? !categories.includes(record.category)
      : categories.includes(record.category) &&
        !referenceAccepts(item.sort, record),
  );
}
export function negativeWitness(cell, records) {
  return (records.get(cell.descriptor) ?? []).find((witness) => {
    if (cell.mutation === "category" || cell.mutation === "target-sort")
      return alternateReference(witness, cell.type, cell.mutation);
    if (cell.mutation === "maximum")
      return (
        referenceRecords(witness.document).filter((item) =>
          referenceAccepts(cell.type.item.sort, item),
        ).length > cell.type.max
      );
    return true;
  });
}
