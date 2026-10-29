import { fail } from "./errors.js";

// Native parser capabilities belong to this package, independently of service policy.
export const owlMappingStrategies = Object.freeze({
  heuristic: "compatible",
  unambiguous: "preserve",
});

export function isOwlMappingParserMode(value) {
  return Object.values(owlMappingStrategies).includes(value);
}

export function selectOwlMappingStrategy(value = "heuristic") {
  if (
    typeof value !== "string" ||
    !Object.hasOwn(owlMappingStrategies, value)
  ) {
    fail("OPTION_INVALID", "/owlMappingStrategy");
  }
  return value;
}
