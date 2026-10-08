const obsolete = (field) =>
  new TypeError(
    `${field} is obsolete. Use nodesShown (auto, all, or an exact count). Degree and node count are different quantities; choose a new count instead of copying the old value.`,
  );

export function rejectObsoleteNodeSelection(record) {
  for (const field of ["doc", "minDegree", "nodes"]) {
    if (record && Object.hasOwn(record, field)) {
      throw obsolete(field);
    }
  }
}

export function createNodesShownIntent(value) {
  if (value && typeof value === "object") {
    if (
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Reflect.ownKeys(value).some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return (
          typeof key !== "string" ||
          !descriptor.enumerable ||
          !("value" in descriptor)
        );
      })
    ) {
      throw new TypeError("nodesShown must be a plain data object.");
    }
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !["auto", "all", "exact"].includes(value.mode)
  ) {
    throw new TypeError("nodesShown requires mode auto, all or exact.");
  }
  const fields = value.mode === "exact" ? ["mode", "requestedCount"] : ["mode"];
  if (
    Object.keys(value).length !== fields.length ||
    Object.keys(value).some((field) => !fields.includes(field))
  ) {
    throw new TypeError("nodesShown has invalid fields.");
  }
  if (
    value.mode === "exact" &&
    (!Number.isSafeInteger(value.requestedCount) || value.requestedCount < 0)
  ) {
    throw new RangeError(
      "nodesShown.requestedCount must be a non-negative safe integer.",
    );
  }
  return Object.freeze({ ...value });
}

export function readNodesShownOption(text) {
  if (text === "auto" || text === "all") {
    return createNodesShownIntent({ mode: text });
  }
  if (typeof text !== "string" || !/^[0-9]+$/.test(text)) {
    throw new TypeError(
      "nodesShown must be auto, all or a non-negative decimal integer.",
    );
  }
  return createNodesShownIntent({
    mode: "exact",
    requestedCount: Number(text),
  });
}
