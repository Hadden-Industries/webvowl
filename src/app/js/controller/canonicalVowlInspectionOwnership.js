import { deepFreezePlainData } from "./controllerDataContracts.js";

// Only values copied and recursively frozen here qualify for reuse. Weak
// membership cannot extend a retired revision's lifetime or trust a caller's
// merely shallow-frozen object.
const ownedInspections = new WeakSet();

/**
 * Own one immutable inspection copy at acceptance; subsequent projections may
 * borrow it. This establishes isolation, not worker admission or revision
 * validity, which remain the session/worker boundary's responsibility.
 */
export function ownCanonicalInspection(inspection) {
  if (ownedInspections.has(inspection)) {
    return inspection;
  }
  const owned = deepFreezePlainData(structuredClone(inspection));
  ownedInspections.add(owned);
  return owned;
}
