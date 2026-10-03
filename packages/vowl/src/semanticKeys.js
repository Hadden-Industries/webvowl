import { descriptorFor } from "./typedValues.js";
import { jsonKey } from "./canonicalJson.js";

/** A local equality key, never a graph label or wire value. Only typed references resolve. */
export function semanticKey(
  value,
  descriptor,
  reference = (id) => id,
  budget,
  normalizeSets = false,
) {
  function key(item, shape) {
    budget?.check();
    const resolved = descriptorFor(item, shape, "");
    if (resolved?.reference) {
      return reference(item);
    }
    if (resolved?.fields) {
      return Object.fromEntries(
        Object.keys(item)
          .filter((name) => !resolved.fields[name]?.id)
          .sort()
          .map((name) => [name, key(item[name], resolved.fields[name])]),
      );
    }
    if (resolved?.items) {
      const members = item.map((member) => key(member, resolved.items));
      if (!resolved.sequence) {
        // Lexical order suffices for local equality. Wire sets use unsigned UTF-8 later.
        const keyed = members.map((member) => ({
          member,
          key: jsonKey(member),
        }));
        keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        return keyed
          .filter(
            (entry, index) =>
              !normalizeSets ||
              index === 0 ||
              entry.key !== keyed[index - 1].key,
          )
          .map((entry) => entry.member);
      }
      return members;
    }
    return item;
  }
  return jsonKey(key(value, descriptor));
}
