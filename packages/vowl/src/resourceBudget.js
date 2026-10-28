import { fail, hostLimitResource, VowlError } from "./errors.js";

const signalAborted = Object.getOwnPropertyDescriptor(
  AbortSignal.prototype,
  "aborted",
).get;
const addListener = EventTarget.prototype.addEventListener;
const removeListener = EventTarget.prototype.removeEventListener;

// A8 units are not wire fields. A larger acceptance budget cannot select other bytes.
// The unbounded-limits amendment of 27 October 2026 keeps a default only where an
// outside authority asks for a bound, and Infinity lifts any limit. A8's former
// defaults and upper override bounds were: inputBytes 33554432 and 268435456;
// primaryRecords 100000 and 1000000; embeddedValues 1500000 (500000 before the
// embedded-work amendment) and 4000000; depth 128 and 512; stringBytes 1048576 and
// 16777216; totalStringBytes 16777216 and 134217728; rdfQuads 1000000 and 8000000;
// rdfDeepIterations 100000 and 1000000; deadlineMs 10000 and 300000. fromOwl bounded
// expanded XML by inputBytes.
export const operationLimitDefaults = Object.freeze({
  inputBytes: Infinity,
  primaryRecords: Infinity,
  embeddedValues: Infinity,
  depth: 128,
  stringBytes: Infinity,
  totalStringBytes: Infinity,
  rdfQuads: Infinity,
  rdfDeepIterations: 100000,
  deadlineMs: 10000,
  expandedXmlBytes: 33554432,
});
const defaults = operationLimitDefaults;
// setTimeout's largest delay, a signed 32-bit millisecond count; longer delays fire at once.
const longestTimerDelay = 2147483647;
// Each limit fails with this one code wherever it is counted; the rest use MODEL_RESOURCE_LIMIT.
const limitCodes = Object.freeze({
  inputBytes: "INPUT_RESOURCE_LIMIT",
  rdfQuads: "RDF_RESOURCE_LIMIT",
  rdfDeepIterations: "RDFC_RESOURCE_LIMIT",
  deadlineMs: "DEADLINE_EXCEEDED",
});

/** The stable code that crossing a limit raises, in every operation and stage. */
export const limitCode = (name) => limitCodes[name] ?? "MODEL_RESOURCE_LIMIT";

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
      const overrides = optionRecord(value, Object.keys(defaults), "/limits");
      limits = {};
      for (const name of Object.keys(defaults).sort()) {
        const limit = Object.hasOwn(overrides, name)
          ? overrides[name]
          : defaults[name];
        if (
          limit !== Infinity &&
          (!Number.isSafeInteger(limit) ||
            limit < (name === "rdfDeepIterations" ? 0 : 1))
        ) {
          fail("OPTION_INVALID", `/limits/${name}`);
        }
        limits[name] = limit;
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
    this.armDeadline();
  }

  /** Abort at the deadline; an unbounded one arms nothing and a long one re-arms. */
  armDeadline() {
    if (this.deadline === Infinity) {
      return;
    }
    const remaining = this.deadline - performance.now();
    this.timer =
      remaining > longestTimerDelay
        ? setTimeout(() => this.armDeadline(), longestTimerDelay)
        : setTimeout(() => this.controller.abort(), Math.max(0, remaining));
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
    this.remainingVisits = 1024;
  }

  /** Owned inner work: A8 permits at most 1024 visits between observations. */
  poll() {
    if (--this.remainingVisits === 0) {
      this.check();
    }
  }

  /** Charge before allocation; the limit's own code is raised in every stage. */
  charge(name, amount = 1, pointer) {
    this.poll();
    const actual = (this.counts[name] ?? 0) + amount;
    if (actual > this.limits[name]) {
      this.check();
      fail(limitCode(name), pointer, {
        limit: name,
        maximum: this.limits[name],
        actual,
      });
    }
    this.counts[name] = actual;
  }

  /** Check a non-aggregate bound such as nesting or a single string's UTF-8 length. */
  bound(name, actual, pointer) {
    this.poll();
    if (actual > this.limits[name]) {
      this.check();
      fail(limitCode(name), pointer, {
        limit: name,
        maximum: this.limits[name],
        actual,
      });
    }
  }

  /** Report runtime exhaustion; cancellation and an expired deadline take precedence. */
  reportHostLimit(error) {
    const resource = hostLimitResource(error);
    if (resource !== undefined) {
      this.check();
      fail("HOST_RESOURCE_LIMIT", undefined, { resource });
    }
  }

  /** Translate a standards library's failure, keeping runtime exhaustion distinct. */
  dependencyFailure(cause, message, stage) {
    this.reportHostLimit(cause);
    throw new VowlError("DEPENDENCY_FAILURE", message, {
      details: { stage },
      cause,
    });
  }

  dispose() {
    clearTimeout(this.timer);
    if (this.callerSignal !== undefined) {
      removeListener.call(this.callerSignal, "abort", this.abortListener);
    }
  }
}
