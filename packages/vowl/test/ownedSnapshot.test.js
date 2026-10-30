import {
  snapshotSource,
  validateOwnedSource,
  deepFreeze,
  freezeOwnedSource,
} from "../src/snapshot.js";
import { ResourceBudget } from "../src/resourceBudget.js";

function run(check, input, limits = {}) {
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity, ...limits } },
    performance.now(),
  );
  try {
    check(input, budget);
    return { counts: { ...budget.counts } };
  } catch ({ code, pointer, details }) {
    return { code, pointer, details, counts: { ...budget.counts } };
  } finally {
    budget.dispose();
  }
}

const source = () => ({
  structural: { subjects: [{ id: "live:S:0", iri: "urn:\u00e9" }] },
  supports: [{ record: "live:S:0", assertions: [], origin: "generated" }],
});

test("owned validation retains exact snapshot accounting and every resource failure boundary", () => {
  expect(run(validateOwnedSource, source())).toEqual(
    run(snapshotSource, source()),
  );
  for (const limit of [
    "primaryRecords",
    "embeddedValues",
    "totalStringBytes",
    "stringBytes",
    "depth",
  ]) {
    for (const maximum of [1, 2, 3, 4, 8, 16, 32, 64, 128, 256]) {
      expect(run(validateOwnedSource, source(), { [limit]: maximum })).toEqual(
        run(snapshotSource, source(), { [limit]: maximum }),
      );
    }
  }
});

test("owned revalidation counts new supports but does not count snapshotted records twice", () => {
  const check = (finalize) => {
    const budget = new ResourceBudget(
      { limits: { deadlineMs: Infinity } },
      performance.now(),
    );
    try {
      const owned = snapshotSource({ structural: source().structural }, budget);
      owned.structural.subjects[0].id = "live:S:100";
      finalize({ ...source(), structural: owned.structural }, budget);
      return { ...budget.counts };
    } finally {
      budget.dispose();
    }
  };
  expect(check(validateOwnedSource)).toEqual(check(snapshotSource));
});

test("owned validation still rejects unsafe descriptors, Unicode, shapes and cycles without invoking accessors", () => {
  let reads = 0;
  const accessor = Object.defineProperty({}, "value", {
    enumerable: true,
    get() {
      reads++;
      return "unsafe";
    },
  });
  const cycle = {};
  cycle.value = cycle;
  const symbol = { [Symbol("unsafe")]: true };
  const sparse = [];
  sparse.length = 2;
  for (const value of [
    accessor,
    cycle,
    symbol,
    sparse,
    { value: "\ud800" },
    { value: "\ufdd0" },
    { value: -0 },
    { value: Infinity },
    { value: undefined },
    { value: new Date(0) },
    Object.defineProperty({}, "value", { value: true }),
  ]) {
    const result = run(validateOwnedSource, { value });
    expect(result.code).toBeDefined();
    expect(result).toEqual(run(snapshotSource, { value }));
  }
  expect(reads).toBe(0);
});

test("snapshot records retain null prototypes and never invoke inherited setters", () => {
  const key = "snapshotPollutionProbe";
  expect(Object.hasOwn(Object.prototype, key)).toBe(false);
  let writes = 0;
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity } },
    performance.now(),
  );
  Object.defineProperty(Object.prototype, key, {
    configurable: true,
    set() {
      writes++;
    },
  });
  try {
    const input = JSON.parse(
      '{"snapshotPollutionProbe":1,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}',
    );
    const copy = snapshotSource(input, budget);
    expect(Object.getPrototypeOf(copy)).toBeNull();
    expect(Object.getPrototypeOf(copy.__proto__)).toBeNull();
    expect(Object.getPrototypeOf(copy.constructor.prototype)).toBeNull();
    expect(Object.hasOwn(copy, key)).toBe(true);
    expect(Object.hasOwn(copy, "__proto__")).toBe(true);
    expect(copy[key]).toBe(1);
    expect(writes).toBe(0);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  } finally {
    delete Object.prototype[key];
    budget.dispose();
  }
});

test("freezing owned trees preserves every snapshot charge and resource failure", () => {
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity } },
    performance.now(),
  );
  let frozen;
  try {
    frozen = freezeOwnedSource(snapshotSource(source(), budget));
  } finally {
    budget.dispose();
  }
  for (const limit of [
    "primaryRecords",
    "embeddedValues",
    "totalStringBytes",
    "stringBytes",
    "depth",
  ]) {
    for (const maximum of [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
      expect(run(snapshotSource, frozen, { [limit]: maximum })).toEqual(
        run(snapshotSource, source(), { [limit]: maximum }),
      );
    }
  }
});

test("freezing a caller proxy cannot enable direct reads during snapshotting", () => {
  let reads = 0;
  let rejectReads = false;
  const input = new Proxy(
    { value: "safe" },
    {
      get(target, key) {
        reads++;
        if (rejectReads) {
          throw new Error("Caller get trap must not run");
        }
        return Reflect.get(target, key);
      },
    },
  );
  deepFreeze(input);
  reads = 0;
  rejectReads = true;
  const budget = new ResourceBudget(
    { limits: { deadlineMs: Infinity } },
    performance.now(),
  );
  try {
    expect(snapshotSource(input, budget).value).toBe("safe");
    expect(reads).toBe(0);
  } finally {
    budget.dispose();
  }
});

test("a caller's shallow freeze cannot prove a deeply frozen tree", () => {
  const child = { nested: { value: "before" } };
  const input = Object.freeze({ child });
  child.nested.value = "after";
  deepFreeze(input);
  expect(Object.isFrozen(child)).toBe(true);
  expect(Object.isFrozen(child.nested)).toBe(true);
  expect(() => {
    child.nested.value = "tampered";
  }).toThrow(TypeError);
  expect(run(snapshotSource, input)).toEqual(
    run(snapshotSource, { child: { nested: { value: "after" } } }),
  );
});

test("freezing an accessor-bearing object still freezes each newly returned child", () => {
  let child = { value: "first" };
  let reads = 0;
  const input = {
    get child() {
      reads++;
      return child;
    },
  };
  deepFreeze(input);
  const first = child;
  child = { value: "second" };
  deepFreeze(input);
  expect(reads).toBe(2);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(child)).toBe(true);
  expect(run(snapshotSource, input)).toMatchObject({
    code: "SOURCE_UNSAFE_VALUE",
    pointer: "/child",
  });
  expect(reads).toBe(2);
});
