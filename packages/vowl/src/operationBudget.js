// Private one-shot handoff for an adapter's fresh, unexposed normalized source.
// A binding-specific entry cannot transfer admission authority between root instances.
const pending = new WeakMap();

export function canonicalizeWithBudget(canonicalize, source, options, budget) {
  pending.set(source, { canonicalize, budget });
  try {
    // canonicalize consumes synchronously before its first suspension.
    return canonicalize(source, options);
  } finally {
    pending.delete(source);
  }
}

export function takeOperationBudget(source, canonicalize) {
  const entry = pending.get(source);
  if (entry?.canonicalize !== canonicalize) {
    return undefined;
  }
  pending.delete(source);
  return entry.budget;
}
