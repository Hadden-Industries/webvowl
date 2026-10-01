import Ajv2020 from "ajv/dist/2020.js";
import { at, fail } from "../errors.js";
import { validateFields } from "../typedValues.js";
import { jsonKey } from "../canonicalJson.js";

const text = { type: "string" };
const number = { type: "number" };
const boolean = { type: "boolean" };
const integer = {
  type: "integer",
  minimum: 0,
  maximum: Number.MAX_SAFE_INTEGER,
};
const id = { anyOf: [{ type: "string", minLength: 1 }, integer] };
const list = (items) => ({ type: "array", items });
const map = (values) => ({ type: "object", additionalProperties: values });
const record = (properties, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const point = { ...list(number), minItems: 2, maxItems: 2 };
const localized = { anyOf: [text, map(text)] };
const savedNumber = { anyOf: [number, text] };
const annotationMap = map(list({ $ref: "#/$defs/annotation" }));
const metadata = {
  label: localized,
  comment: localized,
  description: localized,
  annotations: annotationMap,
};
const individual = record(
  {
    iri: text,
    baseIri: text,
    labels: localized,
    comment: localized,
    description: localized,
    annotations: annotationMap,
  },
  ["iri"],
);
const fields = {
  id,
  type: text,
  iri: text,
  baseIri: text,
  ...metadata,
  attributes: list(text),
  instances: integer,
  individuals: list(individual),
  equivalent: list(id),
  union: list(id),
  intersection: list(id),
  complement: list(id),
  disjointUnion: list(id),
  domain: id,
  range: id,
  inverse: id,
  subproperty: list(id),
  superproperty: list(id),
  cardinality: savedNumber,
  minCardinality: savedNumber,
  maxCardinality: savedNumber,
  pos: point,
  pinned: boolean,
};
const header = record({
  iri: text,
  imports: list(text),
  labels: localized,
  comments: localized,
  other: annotationMap,
  title: localized,
  description: localized,
  author: { anyOf: [text, list(text)] },
  version: text,
  baseIris: list(text),
  languages: list(text),
  prefixList: map(text),
});
const checkBoxes = list(
  record({ id: text, checked: boolean }, ["id", "checked"]),
);
const settings = record({
  global: record({
    language: text,
    zoom: savedNumber,
    translation: { ...list(savedNumber), minItems: 2, maxItems: 2 },
    paused: boolean,
  }),
  gravity: record({
    classDistance: savedNumber,
    datatypeDistance: savedNumber,
  }),
  filter: record({ degreeSliderValue: savedNumber, checkBox: checkBoxes }),
  modes: record({
    colorSwitchState: boolean,
    maxLabelWidth: savedNumber,
    checkBox: checkBoxes,
  }),
});

/** Closed experimental ingress schema; semantic loss/correspondence rules follow validation. */
export const legacySchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $defs: {
    annotation: record(
      {
        identifier: text,
        predicateNs: text,
        type: { enum: ["iri", "label"] },
        value: text,
        language: text,
        annotations: annotationMap,
      },
      ["identifier", "type", "value"],
    ),
  },
  ...record({
    _comment: text,
    header,
    metrics: record(
      Object.fromEntries(
        [
          "classCount",
          "datatypeCount",
          "datatypePropertyCount",
          "individualCount",
          "nodeCount",
          "objectPropertyCount",
          "propertyCount",
        ].map((key) => [key, integer]),
      ),
    ),
    namespace: list(record({ name: text, iri: text }, ["name", "iri"])),
    ...Object.fromEntries(
      ["class", "datatype", "property"].flatMap((name) => [
        [name, list(record(fields, ["id", "type"]))],
        [name + "Attribute", list(record(fields, ["id"]))],
      ]),
    ),
    settings,
  }),
};
const ajv = new Ajv2020({
  strict: true,
  allErrors: false,
  ownProperties: true,
});
const validators = new WeakMap();

/** Check one container at a time; invalid suffixes never allocate error lists. */
function validateNode(value, schema, pointer, budget) {
  budget.check();
  if (schema.$ref) {
    schema = legacySchema.$defs.annotation;
  }
  if (schema.anyOf) {
    // Every ingress union has disjoint JSON types. Integer constraints still
    // belong to the selected numeric leaf's Ajv validator.
    const type = Array.isArray(value)
      ? "array"
      : value === null
        ? "null"
        : typeof value;
    schema = schema.anyOf.find(
      (branch) =>
        branch.type === type ||
        (branch.type === "integer" && type === "number"),
    );
    if (!schema) {
      fail("MIGRATION_AMBIGUOUS", pointer);
    }
  }
  let keys;
  if (
    schema.type === "object" &&
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    for (const required of [...(schema.required ?? [])].sort()) {
      if (!Object.hasOwn(value, required)) {
        fail("MIGRATION_AMBIGUOUS", at(pointer, required));
      }
    }
    keys = Object.keys(value);
    if (schema.additionalProperties === false) {
      let unknown;
      for (const key of keys) {
        budget.check();
        if (!Object.hasOwn(schema.properties, key)) {
          const location = at(pointer, key);
          if (unknown === undefined || location < unknown) {
            unknown = location;
          }
        }
      }
      if (unknown !== undefined) {
        fail("MIGRATION_AMBIGUOUS", unknown);
      }
    }
  }
  let validate = validators.get(schema);
  if (!validate) {
    const shallow = { ...schema };
    if (schema.type === "object") {
      shallow.properties = Object.fromEntries(
        Object.keys(schema.properties ?? {}).map((key) => [key, true]),
      );
      shallow.additionalProperties = schema.additionalProperties !== false;
    } else if (schema.type === "array") {
      shallow.items = true;
    }
    validate = ajv.compile(shallow);
    validators.set(schema, validate);
  }
  if (!validate(value)) {
    fail("MIGRATION_AMBIGUOUS", pointer);
  }
  if (keys) {
    for (const key of keys.sort()) {
      validateNode(
        value[key],
        schema.properties?.[key] ?? schema.additionalProperties,
        at(pointer, key),
        budget,
      );
    }
  } else if (schema.type === "array") {
    for (let index = 0; index < value.length; index++) {
      validateNode(value[index], schema.items, at(pointer, index), budget);
    }
  }
}

/** The lexical parser has already bounded and copied every value in this JSON tree. */
export function validateLegacy(value, budget) {
  validateNode(value, legacySchema, "", budget);
  const settings = value.settings;
  for (const group of ["global", "gravity", "filter", "modes"]) {
    for (const key of [
      "zoom",
      "classDistance",
      "datatypeDistance",
      "degreeSliderValue",
      "maxLabelWidth",
    ]) {
      if (settings?.[group]?.[key] === undefined) {
        continue;
      }
      const pointer = `/settings/${group}/${key}`;
      const raw = settings[group][key];
      if (typeof raw === "string" && !raw.trim()) {
        fail("MIGRATION_AMBIGUOUS", pointer);
      }
      const number = typeof raw === "string" ? Number(raw) : raw;
      legacyScalar(
        number,
        key === "zoom" ? "PositiveNumber" : "Number",
        pointer,
        budget,
      );
      if (
        key === "degreeSliderValue" &&
        (!Number.isSafeInteger(number) || number < 0)
      ) {
        fail("MIGRATION_AMBIGUOUS", pointer);
      }
    }
  }
  for (const [index, raw] of (settings?.global?.translation ?? []).entries()) {
    const pointer = `/settings/global/translation/${index}`;
    if (typeof raw === "string" && !raw.trim()) {
      fail("MIGRATION_AMBIGUOUS", pointer);
    }
    legacyScalar(
      typeof raw === "string" ? Number(raw) : raw,
      "Number",
      pointer,
      budget,
    );
  }
  for (const group of ["filter", "modes"]) {
    const allowed =
      group === "filter"
        ? [
            "datatypeFilterCheckbox",
            "objectPropertyFilterCheckbox",
            "subclassFilterCheckbox",
            "disjointFilterCheckbox",
            "setoperatorFilterCheckbox",
          ]
        : [
            "nodescalingModuleCheckbox",
            "compactnotationModuleCheckbox",
            "colorexternalsModuleCheckbox",
            "pickandpinModuleCheckbox",
            "labelWidthModuleCheckbox",
          ];
    const seen = new Set();
    for (const [index, item] of (settings?.[group]?.checkBox ?? []).entries()) {
      budget.check();
      if (!allowed.includes(item.id) || seen.has(item.id)) {
        fail("MIGRATION_AMBIGUOUS", `/settings/${group}/checkBox/${index}`);
      }
      seen.add(item.id);
    }
  }
  budget.check();
}

/** Reuse canonical lexical domains, translating failure back to the legacy field. */
export function legacyScalar(value, domain, pointer, budget) {
  try {
    return validateFields(value, domain, budget, pointer);
  } catch (error) {
    if (
      [
        "IRI_INVALID",
        "LANGUAGE_TAG_INVALID",
        "LANGUAGE_RANGE_INVALID",
        "NUMBER_INVALID",
        "DOCUMENT_TYPE",
      ].includes(error.code)
    ) {
      fail("MIGRATION_AMBIGUOUS", pointer);
    }
    throw error;
  }
}

/** Build each join once; no coercion, duplicate selection, or repeated linear lookup. */
export function joinRecords(input, budget) {
  const all = new Map();
  const byKind = new Map();
  const coerced = new Set();
  for (const kind of ["class", "datatype", "property"]) {
    const bases = input[kind] ?? [];
    const attributes = input[kind + "Attribute"] ?? [];
    budget.charge(
      "primaryRecords",
      bases.length + attributes.length,
      `/${kind}`,
    );
    const partners = new Map();
    attributes.forEach((value, index) => {
      budget.check();
      const pointer = `/${kind}Attribute/${index}`;
      if (partners.has(value.id)) {
        fail("MIGRATION_AMBIGUOUS", at(pointer, "id"));
      }
      partners.set(value.id, { value, pointer });
    });
    const rows = [];
    bases.forEach((base, index) => {
      budget.check();
      const pointer = `/${kind}/${index}`;
      const partner = partners.get(base.id);
      if (all.has(base.id) || coerced.has(String(base.id)) || !partner) {
        fail("MIGRATION_AMBIGUOUS", at(pointer, "id"));
      }
      const fields = Object.create(null);
      const locations = new Map();
      for (const [record, location] of [
        [base, pointer],
        [partner.value, partner.pointer],
      ]) {
        for (const key of Object.keys(record).sort()) {
          budget.check();
          if (
            Object.hasOwn(fields, key) &&
            jsonKey(fields[key]) !== jsonKey(record[key])
          ) {
            fail("MIGRATION_AMBIGUOUS", at(location, key));
          }
          fields[key] = record[key];
          locations.set(key, at(location, key));
        }
      }
      const row = {
        fields,
        locations,
        kind,
        pointer,
        partner: partner.pointer,
      };
      rows.push(row);
      all.set(base.id, row);
      coerced.add(String(base.id));
      partners.delete(base.id);
    });
    if (partners.size) {
      fail("MIGRATION_AMBIGUOUS", partners.values().next().value.pointer);
    }
    byKind.set(kind, rows);
  }
  for (const row of all.values()) {
    for (const key of [
      "equivalent",
      "union",
      "intersection",
      "complement",
      "disjointUnion",
      "domain",
      "range",
      "inverse",
      "subproperty",
      "superproperty",
    ]) {
      if (!Object.hasOwn(row.fields, key)) {
        continue;
      }
      const values = Array.isArray(row.fields[key])
        ? row.fields[key]
        : [row.fields[key]];
      for (const [index, value] of values.entries()) {
        budget.check();
        if (!all.has(value)) {
          fail(
            "MIGRATION_AMBIGUOUS",
            Array.isArray(row.fields[key])
              ? at(row.locations.get(key), index)
              : row.locations.get(key),
          );
        }
      }
    }
  }
  return { all, byKind };
}
