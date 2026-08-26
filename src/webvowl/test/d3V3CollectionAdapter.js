function createMap(values = [], key = (value) => value) {
  const members = new Map();
  values.forEach((value, index) => {
    members.set(String(key(value, index)), value);
  });

  return {
    empty: () => members.size === 0,
    entries: () =>
      Array.from(members, ([entryKey, value]) => ({ key: entryKey, value })),
    forEach: (callback) =>
      members.forEach((value, entryKey) => callback(entryKey, value)),
    get: (entryKey) => members.get(String(entryKey)),
    has: (entryKey) => members.has(String(entryKey)),
    keys: () => Array.from(members.keys()),
    remove: (entryKey) => members.delete(String(entryKey)),
    set: (entryKey, value) => {
      members.set(String(entryKey), value);
      return value;
    },
    size: () => members.size,
    values: () => Array.from(members.values()),
  };
}

function createSet(values = []) {
  const members = new Set(values.map(String));
  return {
    add: (value) => {
      const stringValue = String(value);
      members.add(stringValue);
      return stringValue;
    },
    empty: () => members.size === 0,
    forEach: (callback) => members.forEach(callback),
    has: (value) => members.has(String(value)),
    remove: (value) => members.delete(String(value)),
    size: () => members.size,
    values: () => Array.from(members.values()),
  };
}

/**
 * Installs only the D3 v3 collection surface retained by reconstructed main.
 * Tests opt in explicitly so the adapter cannot conceal unrelated D3 globals.
 */
function installD3V3CollectionAdapter() {
  const previousD3 = globalThis.d3;
  globalThis.d3 = { ...previousD3, map: createMap, set: createSet };

  return () => {
    if (previousD3 === undefined) {
      delete globalThis.d3;
    } else {
      globalThis.d3 = previousD3;
    }
  };
}

module.exports = { installD3V3CollectionAdapter };
