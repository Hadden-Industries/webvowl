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

// WebVOWL keeps A8's former package defaults and upper override bounds, as
// [default, upper bound], as its own browser policy. The unbounded-limits
// amendment of 27 October 2026 removed them from the package.
export const APPLICATION_LIMIT_POLICY = Object.freeze(
  Object.fromEntries(
    Object.entries({
      inputBytes: [33554432, 268435456],
      primaryRecords: [100000, 1000000],
      embeddedValues: [1500000, 4000000],
      depth: [128, 512],
      stringBytes: [1048576, 16777216],
      totalStringBytes: [16777216, 134217728],
      rdfQuads: [1000000, 8000000],
      rdfDeepIterations: [100000, 1000000],
      deadlineMs: [10000, 300000],
    }).map(([name, bounds]) => [name, Object.freeze(bounds)]),
  ),
);
export const APPLICATION_LIMITS = Object.freeze(
  Object.fromEntries(
    Object.entries(APPLICATION_LIMIT_POLICY).map(([name, [initial]]) => [
      name,
      initial,
    ]),
  ),
);

// Owner-approved desktop profile, measured on a 10,000-class hierarchy.
export const MODEL_OPERATION_LIMITS = Object.freeze({
  deadlineMs: 60000,
  totalStringBytes: 67108864,
  primaryRecords: 200000,
  embeddedValues: 4000000,
});
