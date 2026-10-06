const stages = new Set([
  "worker",
  "acquisition",
  "owl-loading",
  "owl-validation",
  "owl-evidence",
  "owl-live-admission",
  "owl-mapping",
]);
const resources = new Set([
  "deadlineMs",
  "timeoutMs",
  "inputBytes",
  "primaryRecords",
  "embeddedValues",
  "depth",
  "stringBytes",
  "totalStringBytes",
  "rdfQuads",
  "rdfDeepIterations",
  "maxInputBytes",
  "maxRemoteDocumentBytes",
  "maxExpandedXmlBytes",
  "maxAxioms",
  "maxBlankNodes",
  "maxTokenCount",
  "maxTokenLength",
  "maxQuads",
  "maxRdfListLength",
  "maxAnnotationDepth",
  "maxExpressionDepth",
  "maxXmlNestingDepth",
  "maxImportCount",
  "maxImportDepth",
  "maxDepth",
  "maxLiteralLength",
  "maxNumericDigits",
  "maxWork",
]);

/** Only owned stage/resource names cross the worker seam; never exception prose. */
export function canonicalFailureDetails(value) {
  const details = {};
  if (value && typeof value === "object") {
    // OwlAPI uses own error fields; the worker envelope uses a details record.
    // Neither boundary needs to invoke caller-owned getters.
    const nested = Object.getOwnPropertyDescriptor(value, "details")?.value;
    for (const record of [value, nested]) {
      if (!record || typeof record !== "object") {
        continue;
      }
      for (const [name, allowed] of [
        ["stage", stages],
        ["resource", resources],
      ]) {
        const entry = Object.getOwnPropertyDescriptor(record, name)?.value;
        if (allowed.has(entry)) {
          details[name] = entry;
        }
      }
    }
  }
  return details;
}

/** Application-owned explanations for stable failure reasons. */
export function canonicalLoadingMessage(error) {
  if (
    [
      "RESOURCE_LIMIT_EXCEEDED",
      "INPUT_RESOURCE_LIMIT",
      "MODEL_RESOURCE_LIMIT",
    ].includes(error?.code)
  ) {
    const { resource } = canonicalFailureDetails(error);
    if (resource === "timeoutMs") {
      return "The remote ontology request took too long. Try again.";
    }
    if (resource === "deadlineMs") {
      return "Opening the ontology took too long. Try again or open a smaller document.";
    }
    if (
      ["inputBytes", "maxInputBytes", "maxRemoteDocumentBytes"].includes(
        resource,
      )
    ) {
      return "The document or import closure exceeds the input size limit.";
    }
  }
  const messages = {
    DEADLINE_EXCEEDED:
      "Opening the ontology took too long. Try again or open a smaller document.",
    RESOURCE_LIMIT_EXCEEDED: "The ontology exceeds a loading resource limit.",
    INPUT_RESOURCE_LIMIT:
      "The document exceeds an input size or nesting limit.",
    MODEL_RESOURCE_LIMIT:
      "The ontology exceeds a parsing or assessment resource limit.",
    MAPPING_SYNTAX_INVALID:
      "The document could not be parsed as OWL. Check its syntax.",
    MAPPING_IMPORT_UNRESOLVED: "An ontology import could not be loaded.",
    MAPPING_AMBIGUOUS:
      "The ontology has an ambiguous interpretation that could not be resolved.",
    MAPPING_UNSUPPORTED_CONSTRUCT:
      "The ontology uses a construct that this loader does not support.",
    DEPENDENCY_FAILURE:
      "The ontology loader could not provide the required model or source evidence.",
    CANONICAL_WORKER_FAILED:
      "The ontology loading worker failed. Try opening the document again.",
    CHECKPOINT_INVALID:
      "The saved ontology model or its source evidence is invalid.",
  };
  return (
    messages[error?.code] ??
    error?.message ??
    "The ontology could not be loaded."
  );
}
