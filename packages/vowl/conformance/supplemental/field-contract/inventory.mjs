// SPDX-License-Identifier: AGPL-3.0-only
// Finite, explicit conformance denominator. No implementation-derived fields.
import { definitions, families } from "./contracts.mjs";

export function obligations() {
  const result = new Map();
  function add(id, descriptor, field, mutation, type, extra = {}) {
    const previous = result.get(id);
    if (previous) {
      previous.coveredPositions.push(`${descriptor.name}.${field}`);
      return;
    }
    result.set(id, {
      id,
      descriptor: descriptor.name,
      field,
      mutation,
      ...(type ? { type } : {}),
      citation: ["A1", descriptor.citation, "A7"],
      coveredPositions: [
        field ? `${descriptor.name}.${field}` : descriptor.name,
      ],
      ...extra,
    });
  }
  for (const descriptor of Object.values(definitions)) {
    add(`positive/${descriptor.name}`, descriptor, null, "positive-record");
    for (const field of descriptor.forbiddenFields)
      add(
        `forbidden/${descriptor.name}/${field}`,
        descriptor,
        field,
        "forbidden",
      );
    for (const [field, type] of Object.entries(descriptor.fields)) {
      const selector = families[descriptor.family]?.tag === field;
      const position = `${selector ? descriptor.family : descriptor.name}/${field}`;
      add(
        `present/${descriptor.name}/${field}`,
        descriptor,
        field,
        "positive-present",
        type,
      );
      if (type.optional)
        add(
          `absent/${descriptor.name}/${field}`,
          descriptor,
          field,
          "positive-absent",
          type,
        );
      else
        add(`required/${position}`, descriptor, field, "required", type, {
          sharedSelectorGuard: selector,
        });
      add(`type/${position}`, descriptor, field, "type", type, {
        sharedSelectorGuard: selector,
      });
      if (type.type === "enum") {
        add(
          `enum-invalid/${position}`,
          descriptor,
          field,
          "enum-invalid",
          type,
          { sharedSelectorGuard: selector },
        );
        for (const value of type.values)
          add(
            `enum-positive/${descriptor.name}/${field}/${value}`,
            descriptor,
            field,
            "positive-enum",
            type,
            { value },
          );
      }
      if (type.type === "collection") {
        add(
          `element-type/${descriptor.name}/${field}`,
          descriptor,
          field,
          "element-type",
          type,
        );
        if (type.min > 0)
          add(
            `minimum/${descriptor.name}/${field}`,
            descriptor,
            field,
            "minimum",
            type,
          );
        else
          add(
            `empty/${descriptor.name}/${field}`,
            descriptor,
            field,
            "positive-empty",
            type,
          );
        if (type.max !== null)
          add(
            `maximum/${descriptor.name}/${field}`,
            descriptor,
            field,
            "maximum",
            type,
          );
      }
      const item = type.type === "collection" ? type.item : type;
      if (item.type === "reference") {
        add(
          `dangling/${descriptor.name}/${field}`,
          descriptor,
          field,
          "dangling",
          type,
        );
        add(
          `category/${descriptor.name}/${field}`,
          descriptor,
          field,
          "category",
          type,
        );
        if (!["S", "R", "X", "K", "O"].includes(item.sort))
          add(
            `target-sort/${descriptor.name}/${field}`,
            descriptor,
            field,
            "target-sort",
            type,
          );
      }
    }
  }
  return [...result.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

export const denominatorPolicy = {
  scope:
    "A1-A5/B1/B3 closed records and nested variants, with B4 lexical types. A2 profile-specific source and canonical envelopes are separate records.",
  unit: "One named obligation per semantic record/variant/field or collection/reference position; discriminated-family selector required/type/unknown guards are shared across that family's branches and list all covered positions.",
  forbiddenUniverse:
    "For each closed variant: every field appearing only on a sibling variant, each explicitly prohibited field (including Assertion/Literal/Context id and Expression sort), and one arbitrary unexpectedField name representing the remaining infinite unknown-name class. This is a finite class denominator, not an enumeration of every possible JSON member spelling.",
  composition:
    "Record-valued positions receive their own required/type checks; nested record variants are exercised once per distinct descriptor rather than Cartesian products of every parent and nested variant. Recursive annotations use a finite nested witness, not every recursion depth.",
  negativeKinds:
    "Required/forbidden fields, JSON field/item types, unknown enum/discriminator, collection minimum/maximum, dangling/category/sort references. Semantic conditions, profile decoder closure and same-location A7 precedence are separately named obligations.",
  independence:
    "Descriptors were transcribed from the pinned normative tables; no production source, schemas, helpers, outputs or tests were read.",
};
