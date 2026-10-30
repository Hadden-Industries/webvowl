import { jest } from "@jest/globals";
import { isIri as nativeIsIri } from "@hyperjump/uri";
import { ResourceBudget } from "../src/resourceBudget.js";

const isIri = jest.fn(nativeIsIri);
jest.unstable_mockModule("@hyperjump/uri", () => ({ isIri }));
const { validateFields } = await import("../src/typedValues.js");
const iriList = { items: "IRI", minimum: 0 };

beforeEach(() => isIri.mockClear());

test("repeated IRI domains are checked once across validation passes in one operation", () => {
  const budget = new ResourceBudget({}, performance.now());
  const values = Array.from(
    { length: 2000 },
    (_, index) => `urn:class:${index % 2}`,
  );
  try {
    validateFields(values, iriList, budget);
    validateFields(values.slice(), iriList, budget);
    expect(isIri).toHaveBeenCalledTimes(2);
    expect(isIri.mock.calls.map(([value]) => value)).toEqual([
      "urn:class:0",
      "urn:class:1",
    ]);
  } finally {
    budget.dispose();
  }
});

test("another operation independently validates the same exact IRI strings", () => {
  for (let operation = 0; operation < 2; operation++) {
    const budget = new ResourceBudget({}, performance.now());
    try {
      validateFields(
        ["https://EXAMPLE.test:443/a#v", "https://example.test:443/a#v"],
        iriList,
        budget,
      );
    } finally {
      budget.dispose();
    }
  }
  expect(isIri).toHaveBeenCalledTimes(4);
});

test("common ASCII HTTP IRIs need no repeated full-grammar interpretation", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    validateFields(
      Array.from(
        { length: 2000 },
        (_, index) => `https://example.org/ontology#Class${index}`,
      ),
      iriList,
      budget,
    );
    expect(isIri).not.toHaveBeenCalled();
  } finally {
    budget.dispose();
  }
});

test("the conservative HTTP proof agrees with the owning IRI grammar on boundary mutations", () => {
  const budget = new ResourceBudget({}, performance.now());
  const seeds = [
    "http://example.org",
    "HTTPS://a-b.c/path;v:a@b?x=a/b?c#fragment?next",
    "https://haddenindustries.com/a.b_c-~!$&'()*+,;=:@/#Class",
    "https://127.0.0.1/a",
    "https://example.org/a#b#c",
    "https://example.org:443/a",
    "https://[::1]/a",
    "https://[v1.a]/a",
    "https://user:secret@example.org/a",
    "https://example.org/%GG",
    "https://example.org/%20",
    "urn:class:0",
    "https://例.example/é",
    "relative/path",
  ];
  const values = new Set(seeds);
  for (const seed of [
    "http://a.b/x?y#z",
    "https://a-b.c/a_~!$&'()*+,;=:@/#f",
  ]) {
    for (let position = 0; position <= seed.length; position++) {
      for (let code = 0; code < 128; code++) {
        values.add(
          seed.slice(0, position) +
            String.fromCharCode(code) +
            seed.slice(position),
        );
      }
    }
  }
  expect(values.size).toBeGreaterThan(4096);
  for (const seed of seeds) {
    for (const character of [
      " ",
      "\n",
      "\r",
      "\u2028",
      "\u0000",
      "%",
      "[",
      "]",
      "#",
      "?",
      "@",
      "/",
      "é",
      "\ud800",
    ]) {
      for (const index of [
        0,
        seed.indexOf(":") + 1,
        seed.length - 1,
        seed.length,
      ]) {
        values.add(seed.slice(0, index) + character + seed.slice(index));
      }
    }
  }
  try {
    for (const value of values) {
      let expected = false,
        accepted = false;
      try {
        expected = nativeIsIri(value);
      } catch {
        /* Unsupported IP versions are not admitted by a proof. */
      }
      try {
        validateFields(value, "IRI", budget);
        accepted = true;
      } catch {
        /* Compare lexical acceptance, retaining the original rejecting path. */
      }
      expect({ value, accepted }).toEqual({ value, accepted: expected });
    }
  } finally {
    budget.dispose();
  }
});

test("long common IRIs retain the full grammar without a new length restriction", () => {
  const budget = new ResourceBudget({}, performance.now());
  const value = `https://example.org/${"a".repeat(2048)}`;
  try {
    expect(validateFields(value, "IRI", budget)).toBe(value);
    expect(isIri).toHaveBeenCalledWith(value);
  } finally {
    budget.dispose();
  }
});

test("cache capacity never becomes a document acceptance limit", () => {
  const budget = new ResourceBudget({}, performance.now());
  const values = Array.from(
    { length: 6144 },
    (_, index) => `urn:class:${index}`,
  );
  try {
    expect(() => validateFields(values, iriList, budget)).not.toThrow();
    expect(() => validateFields(values.slice(), iriList, budget)).not.toThrow();
    values[values.length - 1] = "not an IRI";
    expect(() => validateFields(values, iriList, budget)).toThrow(
      expect.objectContaining({ code: "IRI_INVALID", pointer: "/6143" }),
    );
  } finally {
    budget.dispose();
  }
});

test("type and constant checks still apply after a successful lexical-domain check", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    validateFields("urn:class:0", "IRI", budget);
    expect(() => validateFields(0, "IRI", budget, "/number")).toThrow(
      expect.objectContaining({ code: "DOCUMENT_TYPE", pointer: "/number" }),
    );
    expect(() =>
      validateFields(
        "urn:class:0",
        { iriConstant: "urn:other" },
        budget,
        "/constant",
      ),
    ).toThrow(
      expect.objectContaining({ code: "DOCUMENT_TYPE", pointer: "/constant" }),
    );
    expect(isIri).toHaveBeenCalledTimes(1);
  } finally {
    budget.dispose();
  }
});

test("rejected IRIs retain each call's original error pointer", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    for (const pointer of ["/first", "/second"]) {
      expect(() =>
        validateFields("not an IRI", "IRI", budget, pointer),
      ).toThrow(expect.objectContaining({ code: "IRI_INVALID", pointer }));
    }
    expect(isIri).toHaveBeenCalledTimes(2);
  } finally {
    budget.dispose();
  }
});

test("memoized IRI domains confer no cancellation or deadline exemption", () => {
  const abort = new AbortController();
  const budget = new ResourceBudget(
    { signal: abort.signal },
    performance.now(),
  );
  const expired = new ResourceBudget({}, performance.now());
  try {
    validateFields("urn:class:0", "IRI", budget);
    validateFields("urn:class:0", "IRI", expired);
    abort.abort();
    expired.deadline = performance.now() - 1;
    expect(() => validateFields("urn:class:0", "IRI", budget)).toThrow(
      expect.objectContaining({ code: "ABORTED" }),
    );
    expect(() => validateFields("urn:class:0", "IRI", expired)).toThrow(
      expect.objectContaining({ code: "DEADLINE_EXCEEDED" }),
    );
    expect(isIri).toHaveBeenCalledTimes(2);
  } finally {
    budget.dispose();
    expired.dispose();
  }
});
