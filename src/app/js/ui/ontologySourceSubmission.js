import {
  findOntologySuggestions,
  ontologySuggestions,
} from "./ontologySuggestions.js";

export const ONTOLOGY_URL_HINT = "Enter an ontology URL or choose a suggestion";
const ONTOLOGY_URL_ERROR = "Enter a valid HTTP or HTTPS URL";

export function normalizeOntologyUrl(value) {
  const enteredValue = typeof value === "string" ? value.trim() : "";
  if (!enteredValue) {
    return { valid: false, empty: true, message: ONTOLOGY_URL_HINT };
  }
  for (let index = 0; index < enteredValue.length; index++) {
    const characterCode = enteredValue.charCodeAt(index);
    if (characterCode <= 32 || characterCode === 127) {
      return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
    }
  }
  let candidate = enteredValue;
  const explicitScheme = candidate.match(/^([a-z][a-z\d+.-]*):/i);
  const hostWithPort = /^[^/?#]+:\d+(?:[/?#]|$)/.test(candidate);
  // A bare catalogue search must never turn into an invented HTTPS hostname.
  if (!explicitScheme && !hostWithPort && !/[./]/.test(candidate)) {
    return {
      valid: false,
      empty: false,
      message: "Choose a suggestion or enter a complete ontology URL",
    };
  }
  if (!explicitScheme || hostWithPort) {
    candidate = "https://" + candidate;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
  }
  if (parsedUrl.protocol === "http:") {
    parsedUrl.protocol = "https:";
  }
  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.hostname.includes("%") ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return { valid: false, empty: false, message: ONTOLOGY_URL_ERROR };
  }
  return {
    valid: true,
    empty: false,
    normalizedUrl: parsedUrl.href,
    isJson: parsedUrl.pathname.toLowerCase().endsWith(".json"),
    wasNormalized: parsedUrl.href !== enteredValue,
  };
}

export function resolveOntologySubmission(
  value,
  catalogue = ontologySuggestions,
) {
  const committed = findOntologySuggestions(value, catalogue).committed;
  if (committed) {
    return {
      valid: true,
      empty: false,
      normalizedUrl: committed.url,
      committed,
      hash: committed.presetKey ?? "iri=" + encodeURI(committed.url),
    };
  }
  const result = normalizeOntologyUrl(value);
  return result.valid
    ? {
        ...result,
        committed: null,
        hash:
          (result.isJson ? "url=" : "iri=") + encodeURI(result.normalizedUrl),
      }
    : result;
}

// Loading remains with the existing location loader. A changed hash has one
// hashchange owner; a deliberate same-hash retry enters that loader directly.
export function createOntologySourceSubmission({
  locationObject,
  loadOntologyFromLocation,
  catalogue = ontologySuggestions,
}) {
  return function submitOntologySource(value) {
    const result = resolveOntologySubmission(value, catalogue);
    if (!result.valid) {
      return result;
    }
    if (locationObject.hash.replace(/^#/, "") === result.hash) {
      return { ...result, completion: loadOntologyFromLocation() };
    }
    locationObject.hash = result.hash;
    return result;
  };
}
