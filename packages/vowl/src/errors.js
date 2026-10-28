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

// Engines report exhausted runtime resources only through these messages: V8 and
// JavaScriptCore throw RangeError, SpiderMonkey its nonstandard InternalError.
const hostLimitMessages = [
  ["callStack", /^(maximum call stack size exceeded|too much recursion)/i],
  [
    "allocation",
    /^(invalid (string|array|typed array|array buffer) length|array buffer allocation failed|out of memory|allocation size overflow)/i,
  ],
];

/** Name the runtime resource an engine error reports exhausted, without invoking accessors. */
export function hostLimitResource(error) {
  const internalError = globalThis.InternalError;
  if (
    !(error instanceof RangeError) &&
    !(typeof internalError === "function" && error instanceof internalError)
  ) {
    return undefined;
  }
  const message = Object.getOwnPropertyDescriptor(error, "message")?.value;
  if (typeof message !== "string") {
    return undefined;
  }
  return hostLimitMessages.find(([, pattern]) => pattern.test(message))?.[0];
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
  const value = typeof key === "string" ? key : String(key);
  // Grammar fields and array indexes normally need no JSON Pointer escaping.
  const escaped =
    value.includes("~") || value.includes("/")
      ? value.replaceAll("~", "~0").replaceAll("/", "~1")
      : value;
  return `${pointer}/${escaped}`;
}
