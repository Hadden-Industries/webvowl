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

// Owner-approved desktop profile, measured on a 10,000-class hierarchy.
export const MODEL_OPERATION_LIMITS = Object.freeze({
  deadlineMs: 60000,
  totalStringBytes: 67108864,
  primaryRecords: 200000,
  embeddedValues: 4000000,
});
