import { checkString } from "../src/snapshot.js";
import { ResourceBudget } from "../src/resourceBudget.js";

function withBudget(operation, limits = {}, signal) {
  const budget = new ResourceBudget({ limits, signal }, performance.now());
  try {
    return operation(budget);
  } finally {
    budget.dispose();
  }
}

test.each([0, 1022, 1023, 1024, 2047])(
  "UTF-8 accounting matches the independent encoder across the chunk boundary at %i",
  (offset) => {
    for (const scalar of [
      "a",
      "é",
      "\uD7FF",
      "\uE000",
      "\uFDCF",
      "\uFDF0",
      "\u{1F600}",
      "\u{10FFFD}",
    ]) {
      const value = "x".repeat(offset) + scalar + "a".repeat(4097);
      const bytes = new TextEncoder().encode(value).length;
      withBudget((budget) => {
        expect(checkString(value, "/first", budget)).toBe(bytes);
        expect(checkString(value, "/second", budget)).toBe(bytes);
        expect(budget.counts.totalStringBytes).toBe(bytes * 2);
      });
    }
  },
);

test.each([1023, 1024, 2047])(
  "prohibited scalars remain rejected at boundary %i",
  (offset) => {
    for (const scalar of [
      "\uD800",
      "\uDC00",
      "\uFDD0",
      "\uFDEF",
      "\uFFFE",
      "\uFFFF",
      "\u{1FFFE}",
      "\u{10FFFF}",
    ]) {
      withBudget((budget) => {
        expect(() =>
          checkString(
            "x".repeat(offset) + scalar + "a".repeat(4097),
            "/text",
            budget,
          ),
        ).toThrow(
          expect.objectContaining({
            code: "UNICODE_INVALID",
            pointer: "/text",
          }),
        );
      });
    }
  },
);

test("ASCII chunks retain exact resource failure observations and charge every occurrence", () => {
  withBudget(
    (budget) => {
      expect(() => checkString("x".repeat(4096), "/text", budget)).toThrow(
        expect.objectContaining({
          code: "MODEL_RESOURCE_LIMIT",
          pointer: "/text",
          details: expect.objectContaining({ actual: 1025 }),
        }),
      );
    },
    { stringBytes: 1024 },
  );
  withBudget(
    (budget) => {
      checkString("x".repeat(4096), "/first", budget);
      expect(() => checkString("x".repeat(4096), "/second", budget)).toThrow(
        expect.objectContaining({
          code: "MODEL_RESOURCE_LIMIT",
          pointer: "/second",
        }),
      );
    },
    { totalStringBytes: 8191 },
  );
  withBudget(
    (budget) => {
      expect(() =>
        checkString("x".repeat(1024) + "\uFFFF", "/text", budget),
      ).toThrow(
        expect.objectContaining({ code: "UNICODE_INVALID", pointer: "/text" }),
      );
    },
    { stringBytes: 10 },
  );
});

test("long ASCII validation remains interruptible within its existing chunk interval", () => {
  const abort = new AbortController();
  withBudget(
    (budget) => {
      abort.abort();
      expect(() => checkString("x".repeat(4096), "/text", budget)).toThrow(
        expect.objectContaining({ code: "ABORTED" }),
      );
    },
    {},
    abort.signal,
  );
});
