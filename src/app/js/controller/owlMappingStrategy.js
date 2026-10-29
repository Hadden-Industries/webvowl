import { owlMappingDefinitions } from "../../../ontology-loading/owlMappingDefinitions.js";

export { owlMappingDefinitions };

/** Common strategy metadata is static; the server's instance policy cannot set a user's choice. */
export function selectOwlMappingStrategy(
  value = owlMappingDefinitions.defaultStrategy,
) {
  if (!owlMappingDefinitions.choices.some(({ id }) => id === value)) {
    throw new TypeError("Choose a supported OWL mapping strategy.");
  }
  return value;
}
