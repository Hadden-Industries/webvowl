import Ajv2020 from "ajv/dist/2020.js";
import { isIri } from "@hyperjump/uri";
import {
  parse as parseLanguageTag,
  stringify as stringifyLanguageTag,
} from "bcp-47";
import { at, fail } from "./errors.js";
import { resolveDescriptor, schemaFor } from "./modelContract.js";

const ajv = new Ajv2020({
  strict: true,
  allErrors: true,
  ownProperties: true,
  validateFormats: false,
});
const validators = new WeakMap();
const scalarValidators = new Map();
const keywordOrder = {
  required: 0,
  additionalProperties: 1,
  type: 2,
  enum: 3,
  const: 3,
  minItems: 3,
  maxItems: 3,
  minLength: 3,
};
const asciiLower = (value) =>
  value.replace(/[A-Z]/g, (char) => char.toLowerCase());

/** Choose a declared discriminant, reporting a missing/type/unknown token deterministically. */
export function descriptorFor(value, descriptor, pointer) {
  let resolved = resolveDescriptor(descriptor);
  while (resolved?.discriminator) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail("DOCUMENT_TYPE", pointer);
    }
    const name = resolved.discriminator;
    if (!Object.hasOwn(value, name)) {
      fail("DOCUMENT_REQUIRED_FIELD", at(pointer, name));
    }
    if (typeof value[name] !== "string") {
      fail("DOCUMENT_TYPE", at(pointer, name));
    }
    if (!Object.hasOwn(resolved.branches, value[name])) {
      fail("DOCUMENT_TYPE", at(pointer, name));
    }
    resolved = resolveDescriptor(resolved.branches[value[name]]);
  }
  return resolved;
}

/** Validate scalar domains without URL rewriting, language registry replacement or value coercion. */
function scalar(value, descriptor, pointer) {
  if (descriptor === "IRI" || descriptor?.iriConstant) {
    if (!isIri(value)) {
      fail("IRI_INVALID", pointer);
    }
  } else if (descriptor === "Decimal" && !/^(0|[1-9][0-9]*)$/.test(value)) {
    fail("DECIMAL_INVALID", pointer);
  } else if (["Number", "PositiveNumber"].includes(descriptor)) {
    if (
      !Number.isFinite(value) ||
      Object.is(value, -0) ||
      (descriptor === "PositiveNumber" && value <= 0)
    ) {
      fail("NUMBER_INVALID", pointer);
    }
  } else if (descriptor === "LanguageTag") {
    // The parser supplies the fixed RFC 5646 grammar. It intentionally does not enforce
    // duplicate variants/singletons, which A2 also requires for well-formedness.
    // Round-trip its parsed grammar to detect silently consumed empty private-use suffixes.
    if (!/^[A-Za-z0-9-]+$/.test(value)) {
      fail("LANGUAGE_TAG_INVALID", pointer);
    }
    let warning = false;
    const parsed = parseLanguageTag(value, {
      normalize: false,
      warning: () => {
        warning = true;
      },
    });
    const variants = parsed.variants.map(asciiLower);
    const singletons = parsed.extensions.map((extension) =>
      asciiLower(extension.singleton),
    );
    if (
      warning ||
      asciiLower(stringifyLanguageTag(parsed)) !== asciiLower(value) ||
      !(
        parsed.language ||
        parsed.regular ||
        parsed.irregular ||
        parsed.privateuse.length
      ) ||
      new Set(variants).size !== variants.length ||
      new Set(singletons).size !== singletons.length
    ) {
      fail("LANGUAGE_TAG_INVALID", pointer);
    }
    return asciiLower(value);
  } else if (descriptor === "LanguageRange") {
    if (!/^(\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/.test(value)) {
      fail("LANGUAGE_RANGE_INVALID", pointer);
    }
    return asciiLower(value);
  }
  return value;
}

/** Use the consumer schema for closed shape/type checks; choose A7 errors independently of Ajv order. */
function shallowValidate(value, descriptor, pointer) {
  let validate = validators.get(descriptor);
  if (!validate) {
    validate = ajv.compile(
      schemaFor(descriptor, { source: true, shallow: true }),
    );
    validators.set(descriptor, validate);
  }
  if (validate(value)) {
    return;
  }
  const errors = [...validate.errors].sort((left, right) => {
    const rank =
      (keywordOrder[left.keyword] ?? 4) - (keywordOrder[right.keyword] ?? 4);
    if (rank) {
      return rank;
    }
    const a =
      left.instancePath +
      (left.params.missingProperty ?? left.params.additionalProperty ?? "");
    const b =
      right.instancePath +
      (right.params.missingProperty ?? right.params.additionalProperty ?? "");
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const error = errors[0];
  const location =
    error.keyword === "required"
      ? at(pointer, error.params.missingProperty)
      : error.keyword === "additionalProperties"
        ? at(pointer, error.params.additionalProperty)
        : pointer + error.instancePath;
  fail(
    error.keyword === "required"
      ? "DOCUMENT_REQUIRED_FIELD"
      : error.keyword === "additionalProperties"
        ? "DOCUMENT_UNKNOWN_FIELD"
        : "DOCUMENT_TYPE",
    location,
  );
}

/** Walk an already safe tree in A7's field/index order, preserving exact typed positions. */
export function walkTyped(value, descriptor, visit, pointer = "", parent, key) {
  const resolved = descriptorFor(value, descriptor, pointer);
  visit(value, resolved, pointer, parent, key);
  if (resolved?.fields) {
    for (const name of Object.keys(value).sort()) {
      walkTyped(
        value[name],
        resolved.fields[name],
        visit,
        at(pointer, name),
        value,
        name,
      );
    }
  } else if (resolved?.items) {
    value.forEach((member, index) =>
      walkTyped(
        member,
        resolved.items,
        visit,
        at(pointer, index),
        value,
        index,
      ),
    );
  }
}

/** Check closed shapes and scalar domains before any reference or graph invariant. */
export function validateFields(value, descriptor, budget, pointer = "") {
  budget.check();
  const resolved = descriptorFor(value, descriptor, pointer);
  if (resolved?.fields || resolved?.items) {
    shallowValidate(value, resolved, pointer);
    if (resolved.fields) {
      for (const name of Object.keys(value).sort()) {
        value[name] = validateFields(
          value[name],
          resolved.fields[name],
          budget,
          at(pointer, name),
        );
      }
    } else {
      value.forEach((member, index) => {
        value[index] = validateFields(
          member,
          resolved.items,
          budget,
          at(pointer, index),
        );
      });
    }
    return value;
  }
  // A primitive leaf uses Ajv's real scalar/enum contract too. No coercion/defaulting.
  // Compiling one validator per scalar visit would turn large documents into a compile workload.
  // Scalar domains get their named A7 errors, separately from JSON type/enum errors.
  const expected =
    typeof resolved === "string" && resolved !== "Prefix"
      ? {
          type:
            resolved === "Boolean"
              ? "boolean"
              : ["Number", "PositiveNumber"].includes(resolved)
                ? "number"
                : "string",
        }
      : schemaFor(resolved, { source: true });
  const leafKey = JSON.stringify(expected);
  let validate = scalarValidators.get(leafKey);
  if (!validate) {
    validate = ajv.compile(expected);
    scalarValidators.set(leafKey, validate);
  }
  if (!validate(value)) {
    fail("DOCUMENT_TYPE", pointer);
  }
  return scalar(value, resolved, pointer);
}
