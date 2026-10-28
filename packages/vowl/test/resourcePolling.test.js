import { jest } from "@jest/globals";
import { ResourceBudget } from "../src/resourceBudget.js";
import { checkString, snapshotSource } from "../src/snapshot.js";
import { refineDataset } from "../src/refinedRdf.js";
import { validateGraph, validateMeaning } from "../src/validateGraph.js";
import {
  canonicalize,
  openCanonical,
  checkpointModel,
  readModelRankingIdentity,
  readModelDisplayOrderKeys,
  profiles,
} from "vowl";

afterEach(() => jest.restoreAllMocks());

test.each(["", 'a\u0000\t"~', "x".repeat(1024), "x".repeat(1025), "é😀"])(
  "string validation preserves exact UTF-8 bounds and optional aggregate charging (%j)",
  (value) => {
    const bytes = new TextEncoder().encode(value).length;
    const budget = new ResourceBudget(
      {
        limits: {
          stringBytes: Math.max(1, bytes),
          totalStringBytes: Math.max(1, bytes),
        },
      },
      performance.now(),
    );
    try {
      expect(checkString(value, "/value", budget, false)).toBe(bytes);
      expect(budget.counts.totalStringBytes).toBeUndefined();
      expect(checkString(value, "/value", budget)).toBe(bytes);
      expect(budget.counts.totalStringBytes).toBe(bytes);
      if (bytes > 1) {
        budget.limits.stringBytes = bytes - 1;
        expect(() => checkString(value, "/value", budget)).toThrow(
          expect.objectContaining({
            code: "MODEL_RESOURCE_LIMIT",
            pointer: "/value",
            details: {
              limit: "stringBytes",
              actual: bytes,
              maximum: bytes - 1,
            },
          }),
        );
      }
    } finally {
      budget.dispose();
    }
  },
);

test("descriptor snapshots own prototype-named fields without invoking accessors", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const source = JSON.parse(
      '{"__proto__":{"id":"safe"},"constructor":"value","toString":["a/b~c"]}',
    );
    const copy = snapshotSource(source, budget);
    expect(Object.getPrototypeOf(copy)).toBeNull();
    expect(copy).toEqual(source);
    source.__proto__.id = "changed";
    expect(copy.__proto__.id).toBe("safe");
    let accessed = false;
    Object.defineProperty(source, "a/b~c", {
      enumerable: true,
      get() {
        accessed = true;
        return "unsafe";
      },
    });
    expect(() => snapshotSource(source, budget)).toThrow(
      expect.objectContaining({
        code: "SOURCE_UNSAFE_VALUE",
        pointer: "/a~1b~0c",
      }),
    );
    expect(accessed).toBe(false);
  } finally {
    budget.dispose();
  }
});

function validationSource(size) {
  return {
    structural: {
      ontology: { imports: [], annotations: [] },
      subjects: Array.from({ length: size }, (_, i) => ({
        id: `s${i}`,
        iri: `urn:class:${i}`,
      })),
      roles: Array.from({ length: size }, (_, i) => ({
        id: `r${i}`,
        subject: `s${i}`,
        kind: "class",
      })),
      expressions: [],
      constructs: [],
      occurrences: [],
    },
  };
}

test.each([
  ["accessor", "SOURCE_UNSAFE_VALUE", "/child/a~1b~0c"],
  ["number", "NUMBER_INVALID", "/child/value"],
  ["unicode", "UNICODE_INVALID", "/child/value"],
  ["symbol", "SOURCE_UNSAFE_VALUE", "/child"],
  ["prototype", "SOURCE_UNSAFE_VALUE", "/child"],
])(
  "recopying a snapshot still rejects a newly introduced %s",
  (kind, code, pointer) => {
    const budget = new ResourceBudget({}, performance.now());
    try {
      const owned = snapshotSource({ child: { value: "safe" } }, budget);
      if (kind === "accessor") {
        Object.defineProperty(owned.child, "a/b~c", {
          enumerable: true,
          get() {
            throw new Error("Accessor must not execute");
          },
        });
      } else if (kind === "number") {
        owned.child.value = -0;
      } else if (kind === "unicode") {
        owned.child.value = "\ud800";
      } else if (kind === "symbol") {
        owned.child[Symbol("unsafe")] = true;
      } else {
        Object.setPrototypeOf(owned.child, { inherited: true });
      }
      expect(() => snapshotSource(owned, budget)).toThrow(
        expect.objectContaining({ code, pointer }),
      );
    } finally {
      budget.dispose();
    }
  },
);

test("recopying an observed Proxy preserves symbol rejection before descriptor traps", () => {
  const budget = new ResourceBudget({}, performance.now());
  let descriptors = 0,
    unsafe = false;
  const proxy = new Proxy(
    { value: "safe" },
    {
      ownKeys(target) {
        return unsafe ? ["value", Symbol("unsafe")] : Reflect.ownKeys(target);
      },
      getOwnPropertyDescriptor(target, key) {
        descriptors++;
        return Object.getOwnPropertyDescriptor(target, key);
      },
    },
  );
  try {
    snapshotSource({ proxy }, budget);
    descriptors = 0;
    unsafe = true;
    expect(() => snapshotSource({ proxy }, budget)).toThrow(
      expect.objectContaining({
        code: "SOURCE_UNSAFE_VALUE",
        pointer: "/proxy",
      }),
    );
    expect(descriptors).toBe(0);
  } finally {
    budget.dispose();
  }
});

test.each(["graph", "normalizing", "meaning"])(
  "%s validation observes mid-traversal expiry within 1024 visits and at completion",
  (stage) => {
    let clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    const budget = new ResourceBudget({ limits: { deadlineMs: 10 } }, 0);
    const poll = budget.poll;
    try {
      for (const size of [1, 2048]) {
        clock = 0;
        const source = validationSource(size);
        const context = validateGraph(
          source,
          profiles.structuralContent,
          budget,
          false,
        );
        let visits = 0;
        const expireAt = size === 1 ? 1 : 37;
        const spy = jest.spyOn(budget, "poll").mockImplementation(function () {
          if (++visits === expireAt) {
            clock = 10;
          }
          return poll.call(this);
        });
        expect(() =>
          stage === "meaning"
            ? validateMeaning(source, context, budget)
            : validateGraph(
                source,
                profiles.structuralContent,
                budget,
                false,
                stage === "normalizing",
              ),
        ).toThrow(expect.objectContaining({ code: "DEADLINE_EXCEEDED" }));
        expect(visits).toBeGreaterThanOrEqual(expireAt);
        expect(visits).toBeLessThanOrEqual(expireAt + 1024);
        spy.mockRestore();
      }
    } finally {
      budget.dispose();
    }
  },
);

test("validating a large graph retains its index while avoiding a clock read per field", () => {
  const now = jest.spyOn(performance, "now").mockReturnValue(0);
  const budget = new ResourceBudget({}, 0);
  try {
    const source = validationSource(2048);
    now.mockClear();
    const graph = validateGraph(
      source,
      profiles.structuralContent,
      budget,
      false,
    );
    const context = validateMeaning(source, graph, budget);
    expect(context.index.size).toBe(4096);
    expect(context.get("r2047")).toEqual(source.structural.roles[2047]);
    expect(now.mock.calls.length).toBeLessThan(256);
  } finally {
    budget.dispose();
  }
});

test("refinement polls long mixed-width strings even when scalar offsets skip multiples of 1024", async () => {
  const value = "x" + "\u{1f600}".repeat(8192);
  let clock = 0;
  let visited = 0;
  jest.spyOn(performance, "now").mockImplementation(() => clock);
  const point = String.prototype.codePointAt;
  jest
    .spyOn(String.prototype, "codePointAt")
    .mockImplementation(function (index) {
      if (String(this) === value && ++visited === 400) {
        clock = 10;
      }
      return point.call(this, index);
    });
  const budget = new ResourceBudget({ limits: { deadlineMs: 10 } }, 0);
  try {
    await expect(
      refineDataset(
        [
          {
            subject: { termType: "BlankNode", value: "a" },
            predicate: { termType: "NamedNode", value: "urn:p" },
            object: { termType: "NamedNode", value },
            graph: { termType: "DefaultGraph", value: "" },
          },
        ],
        budget,
      ),
    ).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
    expect(visited).toBeLessThanOrEqual(400 + 1024);
  } finally {
    budget.dispose();
  }
});

test.each(["checkpoint", "ranking", "display-order"])(
  "%s cannot publish when freezing its final result crosses the deadline",
  async (operation) => {
    const document = await canonicalize(
      {
        structural: {
          ontology: { imports: [], annotations: [] },
          subjects: [],
          roles: [],
          expressions: [],
          constructs: [],
          occurrences: [],
        },
      },
      { profile: profiles.structuralContent },
    );
    const { model } = await openCanonical(document);
    let clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    const freeze = Object.freeze;
    let crossed = false;
    jest.spyOn(Object, "freeze").mockImplementation((value) => {
      const result = freeze(value);
      if (
        value?.revision === 0 &&
        (operation === "checkpoint"
          ? value.version === 1
          : Array.isArray(value.correspondence))
      ) {
        clock = 10;
        crossed = true;
      }
      return result;
    });
    const run = {
      checkpoint: checkpointModel,
      ranking: readModelRankingIdentity,
      "display-order": readModelDisplayOrderKeys,
    }[operation];
    await expect(
      run(model, { limits: { deadlineMs: 10 } }),
    ).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
    expect(crossed).toBe(true);
  },
);

test("exact quota accounting does not read the clock for every small allocation", () => {
  const now = jest.spyOn(performance, "now").mockReturnValue(0);
  const budget = new ResourceBudget({}, 0);
  try {
    now.mockClear();
    for (let i = 0; i < 8192; i++) {
      budget.charge("embeddedValues");
      budget.bound("depth", 3);
    }
    expect(budget.counts.embeddedValues).toBe(8192);
    expect(now.mock.calls.length).toBeGreaterThanOrEqual(16);
    expect(now.mock.calls.length).toBeLessThanOrEqual(32);
  } finally {
    budget.dispose();
  }
});

test.each(["abort", "deadline"])(
  "bounded work observes %s within 1024 further visits",
  (kind) => {
    let clock = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    const controller = new AbortController();
    const budget = new ResourceBudget(
      { signal: controller.signal, limits: { deadlineMs: 10 } },
      0,
    );
    try {
      for (let i = 0; i < 37; i++) {
        budget.poll();
      }
      if (kind === "abort") {
        controller.abort();
      } else {
        clock = 10;
      }
      let visited = 0;
      expect(() => {
        while (visited < 1024) {
          visited++;
          budget.poll();
        }
      }).toThrow(
        expect.objectContaining({
          code: kind === "abort" ? "ABORTED" : "DEADLINE_EXCEEDED",
        }),
      );
      expect(visited).toBeLessThanOrEqual(1024);
    } finally {
      budget.dispose();
    }
  },
);

test.each(["check", "charge", "bound"])(
  "%s preserves cancellation before a quota failure even inside a polling chunk",
  (operation) => {
    const controller = new AbortController();
    const budget = new ResourceBudget(
      { signal: controller.signal, limits: { embeddedValues: 1, depth: 1 } },
      performance.now(),
    );
    try {
      budget.poll();
      controller.abort();
      expect(() => {
        if (operation === "charge") {
          budget.charge("embeddedValues", 2);
        } else if (operation === "bound") {
          budget.bound("depth", 2);
        } else {
          budget.check();
        }
      }).toThrow(expect.objectContaining({ code: "ABORTED" }));
      expect(budget.counts.embeddedValues).toBeUndefined();
    } finally {
      budget.dispose();
    }
  },
);

test("a small synchronous snapshot cannot return after its deadline", () => {
  let clock = 0;
  jest.spyOn(performance, "now").mockImplementation(() => clock);
  const budget = new ResourceBudget({ limits: { deadlineMs: 10 } }, 0);
  const poll = budget.poll;
  jest.spyOn(budget, "poll").mockImplementation(function () {
    const result = poll.call(this);
    clock = 10;
    return result;
  });
  try {
    expect(() => snapshotSource({ value: "small" }, budget)).toThrow(
      expect.objectContaining({ code: "DEADLINE_EXCEEDED" }),
    );
  } finally {
    budget.dispose();
  }
});

test.each(["x", "\u{1f600}"])(
  "long %s strings retain deadline polling independent of value counts",
  (character) => {
    let clock = 0;
    let visited = 0;
    jest.spyOn(performance, "now").mockImplementation(() => clock);
    const point = String.prototype.codePointAt;
    jest
      .spyOn(String.prototype, "codePointAt")
      .mockImplementation(function (index) {
        if (++visited === 400) {
          clock = 10;
        }
        return point.call(this, index);
      });
    const budget = new ResourceBudget({ limits: { deadlineMs: 10 } }, 0);
    try {
      expect(() => checkString(character.repeat(8192), "", budget)).toThrow(
        expect.objectContaining({ code: "DEADLINE_EXCEEDED" }),
      );
      expect(visited).toBeLessThanOrEqual(400 + 1024);
    } finally {
      budget.dispose();
    }
  },
);
