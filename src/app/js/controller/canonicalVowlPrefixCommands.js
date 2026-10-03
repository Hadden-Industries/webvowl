import { isIri } from "@hyperjump/uri";
import { PROTECTED_ONTOLOGY_EDITOR_PREFIXES } from "./ontologyEditorPrefixes.js";

function requireEditableName(name) {
  if (
    typeof name !== "string" ||
    !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name) ||
    PROTECTED_ONTOLOGY_EDITOR_PREFIXES.includes(name)
  ) {
    throw new TypeError(
      "Choose an unprotected prefix name beginning with a letter.",
    );
  }
}

/** Prefixes change display bindings only; semantic IRIs are already absolute. */
export function prepareCanonicalPrefixChange(prefixes, request) {
  if (
    !request ||
    Object.keys(request).some(
      (name) => !["name", "previousName", "iri"].includes(name),
    )
  ) {
    throw new TypeError("Invalid prefix change.");
  }
  const { name, previousName, iri } = request;
  requireEditableName(name);
  if (typeof iri !== "string" || !isIri(iri)) {
    throw new TypeError("The prefix requires an absolute IRI.");
  }
  if (previousName !== undefined) {
    requireEditableName(previousName);
    if (!prefixes.some(({ prefix }) => prefix === previousName)) {
      throw new RangeError("The prefix to rename is no longer present.");
    }
  }
  if (name !== previousName && prefixes.some(({ prefix }) => prefix === name)) {
    throw new RangeError("That prefix is already defined.");
  }
  return [
    ...prefixes
      .filter(({ prefix }) => prefix !== previousName)
      .map((binding) => ({ ...binding })),
    { prefix: name, iri },
  ];
}

export function prepareCanonicalPrefixRemoval(prefixes, name) {
  requireEditableName(name);
  if (!prefixes.some(({ prefix }) => prefix === name)) {
    throw new RangeError("The prefix is no longer present.");
  }
  return prefixes
    .filter(({ prefix }) => prefix !== name)
    .map((binding) => ({ ...binding }));
}

export function resolveCanonicalEditorIri(input, { prefixes, ontologyIri }) {
  if (typeof input !== "string" || !input.trim()) {
    throw new TypeError("Enter an absolute IRI, prefixed name or local name.");
  }
  const text = input.trim();
  const separator = text.indexOf(":");
  const binding =
    separator < 0
      ? undefined
      : prefixes.find(({ prefix }) => prefix === text.slice(0, separator));
  if ((binding || separator === 0) && separator === text.length - 1) {
    throw new TypeError("A prefixed name requires a local name.");
  }
  const iri = binding
    ? binding.iri + text.slice(separator + 1)
    : isIri(text)
      ? text
      : ontologyIri && separator <= 0
        ? ontologyIri + (separator === 0 ? text.slice(1) : text)
        : undefined;
  if (typeof iri !== "string" || !isIri(iri)) {
    throw new TypeError(
      "This name requires an explicit absolute IRI or a declared prefix/base.",
    );
  }
  return iri;
}
