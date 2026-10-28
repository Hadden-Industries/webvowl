// Both sides of the worker protocol select the same model lifecycle allowance.
export const MODEL_OPERATION_NAMES = Object.freeze([
  "open-owl-model",
  "open-canonical-model",
  "open-legacy-model",
  "recover-model",
  "edit-model",
  "capture-model",
  "read-model-source",
  "export-model-rdf",
]);

// Finite application defaults; valid explicit consumer limits, including
// Infinity, override them. The former upper override bounds are not policy.
export const APPLICATION_LIMITS = Object.freeze({
  inputBytes: 33554432,
  primaryRecords: 100000,
  embeddedValues: 1500000,
  depth: 128,
  stringBytes: 1048576,
  totalStringBytes: 16777216,
  rdfQuads: 1000000,
  rdfDeepIterations: 100000,
  deadlineMs: 10000,
});

// Owner-approved desktop profile, measured on a 10,000-class hierarchy.
export const MODEL_OPERATION_LIMITS = Object.freeze({
  deadlineMs: 60000,
  totalStringBytes: 67108864,
  primaryRecords: 200000,
  embeddedValues: 4000000,
});
