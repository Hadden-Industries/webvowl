// Native postMessage already produced an independently owned receiver value.
// Only the worker client may move that unexposed value here. This proof is
// transport ownership, never package admission or checkpoint validity.
const ownedResults = new WeakMap();

export function createOwnedWorkerResult(owned, metadata) {
  const result = { ...metadata };
  const getters = new Map();
  for (const name of Object.keys(owned)) {
    let materialized = false;
    let publicValue;
    const replace = (value) => {
      ownedResults.delete(result);
      Object.defineProperty(result, name, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    };
    const get = () => {
      if (!materialized) {
        publicValue = structuredClone(owned[name]);
        materialized = true;
        ownedResults.delete(result);
      }
      if (Object.getOwnPropertyDescriptor(result, name)?.configurable) {
        replace(publicValue);
      }
      return publicValue;
    };
    getters.set(name, get);
    Object.defineProperty(result, name, {
      get,
      set: replace,
      enumerable: true,
      configurable: true,
    });
  }
  ownedResults.set(result, { owned, getters });
  return result;
}

/** Borrow only before a public field has been read, replaced or removed. */
export function readOwnedWorkerResult(result) {
  const entry = ownedResults.get(result);
  if (
    entry &&
    [...entry.getters].every(
      ([name, get]) =>
        Object.getOwnPropertyDescriptor(result, name)?.get === get,
    )
  ) {
    return entry.owned;
  }
}
