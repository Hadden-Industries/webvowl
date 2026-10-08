const stages = new Set([
  "worker",
  "acquisition",
  "owl-loading",
  "owl-validation",
  "owl-evidence",
  "owl-live-admission",
  "owl-mapping",
  "node-ranking",
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

/** Only owned names and non-negative safe counters cross the worker seam. */
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
      // VOWL calls its counter `limit`; OwlAPI and the application use `resource`.
      const resource =
        Object.getOwnPropertyDescriptor(record, "resource")?.value ??
        Object.getOwnPropertyDescriptor(record, "limit")?.value;
      if (resources.has(resource)) {
        details.resource = resource;
        for (const name of ["maximum", "actual"]) {
          const entry = Object.getOwnPropertyDescriptor(record, name)?.value;
          if (Number.isSafeInteger(entry) && entry >= 0) {
            details[name] = entry;
          }
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
      "RDF_RESOURCE_LIMIT",
      "RDFC_RESOURCE_LIMIT",
    ].includes(error?.code)
  ) {
    const { resource, stage, maximum, actual } = canonicalFailureDetails(error);
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
    const budgets = {
      totalStringBytes: "temporary string-space",
      stringBytes: "single-string size",
      primaryRecords: "model-record",
      embeddedValues: "processing-work",
      rdfQuads: "RDF statement",
      rdfDeepIterations: "canonicalization-work",
      depth: "nesting-depth",
    };
    if (budgets[resource]) {
      const amount = (value) =>
        ["totalStringBytes", "stringBytes"].includes(resource)
          ? `${Number((value / 1048576).toFixed(1))} MiB`
          : String(value);
      const byteCounter = ["totalStringBytes", "stringBytes"].includes(
        resource,
      );
      const roundedEqual =
        actual !== undefined &&
        maximum !== undefined &&
        actual !== maximum &&
        amount(actual) === amount(maximum);
      const quantity = (value) =>
        byteCounter && roundedEqual ? `${value} bytes` : amount(value);
      const quantities =
        maximum === undefined
          ? ""
          : actual === undefined
            ? ` (limit ${quantity(maximum)})`
            : ` (at least ${quantity(actual)} requested; ${quantity(maximum)} allowed)`;
      return `${stage === "node-ranking" ? "Node selection" : "Processing the ontology"} exceeded its ${budgets[resource]} budget${quantities}. Try a smaller ontology, import closure or edit.`;
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
    RDF_RESOURCE_LIMIT:
      "The ontology and its imports exceed a node-selection or RDF processing resource limit. Try a smaller ontology or import closure.",
    RDFC_RESOURCE_LIMIT:
      "The ontology and its imports exceed the RDF canonicalization-work limit. Try a smaller ontology or import closure.",
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
