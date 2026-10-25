/** A stable package boundary error; details contain only bounded diagnostic metadata. */
export class VowlError extends Error {
  constructor(code, message, { pointer, details, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "VowlError";
    this.code = code;
    if (pointer !== undefined) {
      this.pointer = pointer;
    }
    if (details !== undefined) {
      this.details = Object.freeze({ ...details });
    }
  }
}

/** Throw a profile error without embedding input values in diagnostics. */
export function fail(code, pointer, details) {
  throw new VowlError(code, code.replaceAll("_", " ").toLowerCase(), {
    pointer,
    details,
  });
}

/** Append a field/index to a JSON Pointer without changing its spelling. */
export function at(pointer, key) {
  const value = String(key);
  // Grammar fields and array indexes normally need no JSON Pointer escaping.
  const escaped =
    value.includes("~") || value.includes("/")
      ? value.replaceAll("~", "~0").replaceAll("/", "~1")
      : value;
  return `${pointer}/${escaped}`;
}
