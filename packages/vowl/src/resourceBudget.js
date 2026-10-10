import { fail } from "./errors.js";

const signalAborted = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  "aborted",
).get;
const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;

// A8 units are not wire fields. A larger acceptance budget cannot select other bytes.
export const operationLimitPolicy = Object.freeze(
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
const policy = operationLimitPolicy;

/** Read option data without invoking user accessors. */
export function optionRecord(value, allowed, pointer = "") {
  if (value === undefined) {
    return {};
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    fail("OPTION_INVALID", pointer);
  }
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !allowed.includes(key) ||
      !descriptor.enumerable ||
      !("value" in descriptor)
    ) {
      fail("OPTION_INVALID", pointer);
    }
    result[key] = descriptor.value;
  }
  return result;
}

/** Check option values in field order, before allocating timers or listeners. */
export function validateOperationOptions(options, additionalChecks = {}) {
  let limits;
  const checks = {
    ...additionalChecks,
    limits(value) {
      const overrides = optionRecord(value, Object.keys(policy), "/limits");
      limits = {};
      for (const name of Object.keys(policy).sort()) {
        const [initial, maximum] = policy[name];
        const value = Object.hasOwn(overrides, name)
          ? overrides[name]
          : initial;
        if (
          !Number.isInteger(value) ||
          value < (name === "rdfDeepIterations" ? 0 : 1) ||
          value > maximum
        ) {
          fail("OPTION_INVALID", `/limits/${name}`);
        }
        limits[name] = value;
      }
    },
    signal(value) {
      if (value !== undefined) {
        try {
          // The native getter validates the receiver, including across realms.
          // A prototype imitation is not a signal; own accessors are not invoked.
          signalAborted.call(value);
        } catch {
          fail("OPTION_INVALID", "/signal");
        }
      }
    },
  };
  for (const name of Object.keys(checks).sort()) {
    checks[name](options[name]);
  }
  return limits;
}

/** One operation's monotonic deadline and counters, shared by every pipeline stage. */
export class ResourceBudget {
  constructor(options, startedAt, additionalChecks) {
    this.limits = validateOperationOptions(options, additionalChecks);
    this.callerSignal = options.signal;
    this.startedAt = startedAt;
    this.deadline = startedAt + this.limits.deadlineMs;
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    this.counts = Object.create(null);
    this.abortListener = () => this.controller.abort();
    this.check();
    if (this.callerSignal !== undefined) {
      addListener.call(this.callerSignal, "abort", this.abortListener, {
        once: true,
      });
    }
    this.timer = setTimeout(
      () => this.controller.abort(),
      Math.max(0, this.deadline - performance.now()),
    );
  }

  /** Observe cancellation before the next content check, including synchronous stages. */
  check() {
    if (
      this.callerSignal !== undefined &&
      signalAborted.call(this.callerSignal)
    ) {
      fail("ABORTED");
    }
    if (performance.now() >= this.deadline) {
      fail("DEADLINE_EXCEEDED");
    }
  }

  /** Charge before allocation; callers select the stage-specific stable resource code. */
  charge(name, amount = 1, pointer, code = "MODEL_RESOURCE_LIMIT") {
    this.check();
    const actual = (this.counts[name] ?? 0) + amount;
    if (actual > this.limits[name]) {
      fail(code, pointer, { limit: name, maximum: this.limits[name], actual });
    }
    this.counts[name] = actual;
  }

  /** Check a non-aggregate bound such as nesting or a single string's UTF-8 length. */
  bound(name, actual, pointer, code = "MODEL_RESOURCE_LIMIT") {
    this.check();
    if (actual > this.limits[name]) {
      fail(code, pointer, { limit: name, maximum: this.limits[name], actual });
    }
  }

  dispose() {
    clearTimeout(this.timer);
    if (this.callerSignal !== undefined) {
      removeListener.call(this.callerSignal, "abort", this.abortListener);
    }
  }
}
