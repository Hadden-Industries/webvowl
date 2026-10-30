import { semanticKey } from "../src/semanticKeys.js";
import { ResourceBudget } from "../src/resourceBudget.js";

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
