import { descriptorFor } from "./typedValues.js";
import { jsonKey } from "./canonicalJson.js";
import { isFrozenOwnedSource } from "./snapshot.js";

// Exact immutable strings have context-free JCS spellings. Reuse only the
// serializer's successful result, within one operation and finite capacity.
// Compound reference values always retain the owning canonical serializer.
const stringsByOperation = new WeakMap();
const maximumStrings = 4096;
const maximumStringLength = 1024;
const immutableKeysByOperation = new WeakMap();
const maximumKeyCharacters = 2 * 1024 * 1024;
const identityReference = (id) => id;

function serialized(value, budget) {
  if (
    !budget ||
    typeof value !== "string" ||
    value.length > maximumStringLength
  ) {
    return jsonKey(value);
  }
  let strings = stringsByOperation.get(budget);
  const known = strings?.get(value);
  if (known !== undefined) {
    return known;
  }
  const result = jsonKey(value);
  if (!strings) {
    strings = new Map();
    stringsByOperation.set(budget, strings);
  }
  if (strings.size < maximumStrings) {
    strings.set(value, result);
  }
  return result;
}

/** A local equality key, never a graph label or wire value. Only typed references resolve. */
export function semanticKey(
  value,
  descriptor,
  reference = identityReference,
  budget,
  normalizeSets = false,
) {
  budget?.check();
  const reusable =
    budget &&
    reference === identityReference &&
    typeof descriptor === "string" &&
    isFrozenOwnedSource(value);
  let cache;
  let known;
  const slot = normalizeSets ? "normalized" : "exact";
  if (reusable) {
    cache = immutableKeysByOperation.get(budget);
    known = cache?.values.get(value)?.get(descriptor);
    if (known?.[slot] !== undefined) {
      budget.check();
      return known[slot];
    }
  }
  // Compose each typed subtree's local equality bytes once. Rebuilding an
  // object tree and canonicalizing it again repeated every nested set member.
  // JCS still owns all scalar escaping and caller-supplied reference values.
  function key(item, shape) {
    budget?.poll();
    const resolved = descriptorFor(item, shape, "");
    if (resolved?.reference) {
      return serialized(reference(item), budget);
    }
    if (resolved?.fields) {
      return `{${Object.keys(item)
        .filter((name) => !resolved.fields[name]?.id)
        .sort()
        .map(
          (name) =>
            `${serialized(name, budget)}:${key(item[name], resolved.fields[name])}`,
        )
        .join(",")}}`;
    }
    if (resolved?.items) {
      const members = item.map((member) => key(member, resolved.items));
      if (!resolved.sequence) {
        // Lexical order suffices for local equality. Wire sets use unsigned UTF-8 later.
        members.sort();
      }
      const retained =
        resolved.sequence || !normalizeSets
          ? members
          : members.filter(
              (entry, index) => index === 0 || entry !== members[index - 1],
            );
      return `[${retained.join(",")}]`;
    }
    return serialized(item, budget);
  }
  const result = key(value, descriptor);
  budget?.check();
  if (reusable) {
    if (!cache) {
      cache = { values: new WeakMap(), entries: 0, characters: 0 };
      immutableKeysByOperation.set(budget, cache);
    }
    if (
      cache.entries < maximumStrings &&
      cache.characters + result.length <= maximumKeyCharacters
    ) {
      let shapes = cache.values.get(value);
      if (!shapes) {
        shapes = new Map();
        cache.values.set(value, shapes);
      }
      known ??= Object.create(null);
      known[slot] = result;
      shapes.set(descriptor, known);
      cache.entries++;
      cache.characters += result.length;
    }
  }
  return result;
}
