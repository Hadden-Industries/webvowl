import { semanticKey } from "../src/semanticKeys.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import { snapshotSource, freezeOwnedSource } from "../src/snapshot.js";

test("local keys ignore record handles and retain exact typed scalar spelling", () => {
  const record = {
    subject: 'S"\\\n\u{1F600}',
    id: "irrelevant",
    kind: "class",
  };
  expect(semanticKey(record, "Role")).toBe(
    '{"kind":"class","subject":"S\\"\\\\\\n😀"}',
  );
  expect(semanticKey({ ...record, id: "another" }, "Role")).toBe(
    semanticKey(record, "Role"),
  );
});

test("set keys sort complete serialized members and remove repetitions only when requested", () => {
  const value = {
    id: "K",
    kind: "equivalent-classes",
    members: ["z", "a", "a"],
  };
  expect(semanticKey(value, "Construct")).toBe(
    '{"kind":"equivalent-classes","members":["a","a","z"]}',
  );
  expect(semanticKey(value, "Construct", undefined, undefined, true)).toBe(
    '{"kind":"equivalent-classes","members":["a","z"]}',
  );
  expect(value.members).toEqual(["z", "a", "a"]);
});

test("property-chain order and repetitions survive normalization", () => {
  const value = {
    id: "K",
    kind: "property-chain",
    super: "s",
    members: ["z", "a", "z"],
  };
  expect(semanticKey(value, "Construct", undefined, undefined, true)).toBe(
    '{"kind":"property-chain","members":["z","a","z"],"super":"s"}',
  );
});

test("typed references remain domain-separated compound values with canonical member encoding", () => {
  const value = { id: "K", kind: "subclass", sub: "a", super: "z" };
  expect(
    semanticKey(value, "Construct", (id) => ({ z: id, a: ["semantic", id] })),
  ).toBe(
    '{"kind":"subclass","sub":{"a":["semantic","a"],"z":"a"},"super":{"a":["semantic","z"],"z":"z"}}',
  );
});

test("nested annotations keep full property IRIs, literal lexemes and annotation sets", () => {
  const value = {
    annotations: [],
    value: { kind: "typed", lexical: "01", datatype: "urn:integer" },
    predicate: "urn:label",
  };
  expect(semanticKey(value, "Annotation")).toBe(
    '{"annotations":[],"predicate":"urn:label","value":{"datatype":"urn:integer","kind":"typed","lexical":"01"}}',
  );
});

test("local equality work still observes the operation cancellation budget", () => {
  const controller = new AbortController();
  const budget = new ResourceBudget(
    { signal: controller.signal },
    performance.now(),
  );
  try {
    controller.abort();
    expect(() =>
      semanticKey(
        { id: "R", kind: "class", subject: "S" },
        "Role",
        undefined,
        budget,
      ),
    ).toThrow(expect.objectContaining({ code: "ABORTED" }));
  } finally {
    budget.dispose();
  }
});

test("operation-local serialization reuse keeps exact strings and reserializes compound reference values", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const literal = (lexical) => ({
      kind: "typed",
      datatype: "urn:string",
      lexical,
    });
    for (const value of [
      'quotes "\\\n',
      "é",
      "e\u0301",
      "\u{1F600}",
      "a".repeat(1025),
    ]) {
      const expected = semanticKey(literal(value), "Literal");
      expect(semanticKey(literal(value), "Literal", undefined, budget)).toBe(
        expected,
      );
      expect(semanticKey(literal(value), "Literal", undefined, budget)).toBe(
        expected,
      );
    }
    const reference = { a: "first" };
    const record = { id: "R", kind: "class", subject: "S" };
    const first = semanticKey(record, "Role", () => reference, budget);
    reference.a = "second";
    expect(semanticKey(record, "Role", () => reference, budget)).not.toBe(
      first,
    );
    expect(() =>
      semanticKey(literal("\uD800"), "Literal", undefined, budget),
    ).toThrow("Lone surrogate");
  } finally {
    budget.dispose();
  }
});

test("immutable key reuse is shape- and set-policy-specific and never trusts mutable values or resolvers", () => {
  const controller = new AbortController();
  const budget = new ResourceBudget(
    { signal: controller.signal },
    performance.now(),
  );
  try {
    const mutable = {
      id: "K",
      kind: "equivalent-classes",
      members: ["z", "a", "a"],
    };
    const owned = freezeOwnedSource(
      snapshotSource({ record: mutable }, budget),
    ).record;
    for (const descriptor of ["Construct", "Assertion"]) {
      for (const normalized of [false, true, false]) {
        expect(
          semanticKey(owned, descriptor, undefined, budget, normalized),
        ).toBe(
          semanticKey(mutable, descriptor, undefined, undefined, normalized),
        );
      }
    }
    const before = semanticKey(mutable, "Construct", undefined, budget);
    mutable.members.push("new");
    expect(semanticKey(mutable, "Construct", undefined, budget)).not.toBe(
      before,
    );
    let target = "first";
    const resolve = () => target;
    const first = semanticKey(owned, "Construct", resolve, budget);
    target = "second";
    expect(semanticKey(owned, "Construct", resolve, budget)).not.toBe(first);
    controller.abort();
    expect(() => semanticKey(owned, "Construct", undefined, budget)).toThrow(
      expect.objectContaining({ code: "ABORTED" }),
    );
  } finally {
    budget.dispose();
  }
});

test("immutable key bookkeeping never reads or invokes inherited policy slots", () => {
  const budget = new ResourceBudget({}, performance.now());
  const prior = new Map(
    ["exact", "normalized"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(Object.prototype, name),
    ]),
  );
  const results = [];
  let inherited = 0;
  try {
    const owned = freezeOwnedSource(
      snapshotSource(
        {
          record: { id: "K", kind: "equivalent-classes", members: ["a", "a"] },
        },
        budget,
      ),
    ).record;
    for (const name of prior.keys()) {
      Object.defineProperty(Object.prototype, name, {
        configurable: true,
        get() {
          inherited++;
          throw new Error("Inherited cache read");
        },
        set() {
          inherited++;
          throw new Error("Inherited cache write");
        },
      });
    }
    for (const normalized of [false, true, false, true]) {
      results.push(
        semanticKey(owned, "Construct", undefined, budget, normalized),
      );
    }
  } finally {
    for (const [name, descriptor] of prior) {
      if (descriptor) {
        Object.defineProperty(Object.prototype, name, descriptor);
      } else {
        delete Object.prototype[name];
      }
    }
    budget.dispose();
  }
  expect(inherited).toBe(0);
  expect(results[0]).toBe(results[2]);
  expect(results[1]).toBe(results[3]);
  expect(results[0]).not.toBe(results[1]);
});
