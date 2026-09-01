import { beforeAll, describe, expect, test } from "@jest/globals";
import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createContext, SourceTextModule } from "node:vm";

let createLinkedAbortSignal;

const LINKED_ABORT_SIGNAL_MODULE_URL = new URL(
  "./linkedAbortSignal.js",
  import.meta.url,
);
const LINKED_ABORT_SIGNAL_MODULE_SOURCE = readFileSync(
  fileURLToPath(LINKED_ABORT_SIGNAL_MODULE_URL),
  "utf8",
);

async function evaluateLinkedAbortSignalModule(context) {
  const sourceModule = new SourceTextModule(LINKED_ABORT_SIGNAL_MODULE_SOURCE, {
    ...(context === undefined ? {} : { context }),
    identifier: LINKED_ABORT_SIGNAL_MODULE_URL.href,
  });
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected Task 2 cancellation dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule.namespace;
}

beforeAll(async () => {
  ({ createLinkedAbortSignal } = await evaluateLinkedAbortSignalModule());
});

describe("linked abort signals", () => {
  test.each([
    [
      "AbortSignal is unavailable",
      () => createContext({ AbortController, EventTarget }),
    ],
    [
      "AbortSignal.reason is unavailable",
      () => {
        class AbortSignalWithoutReason extends EventTarget {
          get aborted() {
            return false;
          }
        }
        return createContext({
          AbortController,
          AbortSignal: AbortSignalWithoutReason,
          EventTarget,
        });
      },
    ],
  ])(
    "defers the %s capability failure until linked-signal creation",
    async (_scenario, createModuleContext) => {
      const linkedAbortSignalModule = await evaluateLinkedAbortSignalModule(
        createModuleContext(),
      );

      expect(() => linkedAbortSignalModule.createLinkedAbortSignal([])).toThrow(
        "Linked abort signals require AbortController, AbortSignal, and EventTarget platform capabilities.",
      );
    },
  );

  test.each([0, 1])("aborts when source signal %i aborts", (sourceIndex) => {
    const sourceControllers = [new AbortController(), new AbortController()];
    const linkedAbortSignal = createLinkedAbortSignal(
      sourceControllers.map(({ signal }) => signal),
    );
    const abortReason = new Error(`source-${sourceIndex}-aborted`);

    sourceControllers[sourceIndex].abort(abortReason);

    expect(linkedAbortSignal.signal.aborted).toBe(true);
    expect(linkedAbortSignal.signal.reason).toBe(abortReason);
  });

  test("preserves the first abort reason", () => {
    const firstSourceController = new AbortController();
    const secondSourceController = new AbortController();
    const linkedAbortSignal = createLinkedAbortSignal([
      firstSourceController.signal,
      secondSourceController.signal,
    ]);
    const firstReason = new Error("first abort");

    secondSourceController.abort(firstReason);
    firstSourceController.abort(new Error("later abort"));

    expect(linkedAbortSignal.signal.reason).toBe(firstReason);
  });

  test("is already aborted from the first aborted source in iteration order", () => {
    const firstSourceController = new AbortController();
    const secondSourceController = new AbortController();
    const firstReason = new Error("first source reason");
    const secondReason = new Error("second source reason");
    firstSourceController.abort(firstReason);
    secondSourceController.abort(secondReason);

    const linkedAbortSignal = createLinkedAbortSignal([
      firstSourceController.signal,
      secondSourceController.signal,
    ]);

    expect(linkedAbortSignal.signal.aborted).toBe(true);
    expect(linkedAbortSignal.signal.reason).toBe(firstReason);
  });

  test("removes every registered listener as soon as one source aborts", () => {
    const firstSourceController = new AbortController();
    const secondSourceController = new AbortController();
    const firstInitialListenerCount = getEventListeners(
      firstSourceController.signal,
      "abort",
    ).length;
    const secondInitialListenerCount = getEventListeners(
      secondSourceController.signal,
      "abort",
    ).length;
    createLinkedAbortSignal([
      firstSourceController.signal,
      secondSourceController.signal,
    ]);

    expect(
      getEventListeners(firstSourceController.signal, "abort"),
    ).toHaveLength(firstInitialListenerCount + 1);
    expect(
      getEventListeners(secondSourceController.signal, "abort"),
    ).toHaveLength(secondInitialListenerCount + 1);

    firstSourceController.abort("completed");

    expect(
      getEventListeners(firstSourceController.signal, "abort"),
    ).toHaveLength(firstInitialListenerCount);
    expect(
      getEventListeners(secondSourceController.signal, "abort"),
    ).toHaveLength(secondInitialListenerCount);
  });

  test("disposal removes listeners without aborting the linked signal", () => {
    const sourceController = new AbortController();
    const initialListenerCount = getEventListeners(
      sourceController.signal,
      "abort",
    ).length;
    const linkedAbortSignal = createLinkedAbortSignal([
      sourceController.signal,
    ]);

    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount + 1,
    );

    linkedAbortSignal.dispose();
    linkedAbortSignal.dispose();
    sourceController.abort("after disposal");

    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount,
    );
    expect(linkedAbortSignal.signal.aborted).toBe(false);
  });

  test("registers a duplicate source signal only once", () => {
    const sourceController = new AbortController();
    const initialListenerCount = getEventListeners(
      sourceController.signal,
      "abort",
    ).length;
    const linkedAbortSignal = createLinkedAbortSignal([
      sourceController.signal,
      sourceController.signal,
    ]);

    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount + 1,
    );

    linkedAbortSignal.dispose();
    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount,
    );
  });

  test("accepts a branded AbortSignal independently of constructor identity", () => {
    const sourceController = new AbortController();
    Object.defineProperty(AbortSignal, Symbol.hasInstance, {
      configurable: true,
      value: () => false,
    });

    try {
      const linkedAbortSignal = createLinkedAbortSignal([
        sourceController.signal,
      ]);

      sourceController.abort("cross-realm cancellation");

      expect(linkedAbortSignal.signal.aborted).toBe(true);
      expect(linkedAbortSignal.signal.reason).toBe("cross-realm cancellation");
    } finally {
      delete AbortSignal[Symbol.hasInstance];
    }
  });

  test("uses the EventTarget behavior of a branded signal instead of caller-overridden listener methods", () => {
    const sourceController = new AbortController();
    const callerControlledAddFailure = new Error(
      "caller-controlled addEventListener must not run",
    );
    const callerControlledRemoveFailure = new Error(
      "caller-controlled removeEventListener must not run",
    );
    Object.defineProperties(sourceController.signal, {
      addEventListener: {
        configurable: true,
        value() {
          throw callerControlledAddFailure;
        },
      },
      removeEventListener: {
        configurable: true,
        value() {
          throw callerControlledRemoveFailure;
        },
      },
    });

    const linkedAbortSignal = createLinkedAbortSignal([
      sourceController.signal,
    ]);

    sourceController.abort("trusted EventTarget cancellation");

    expect(linkedAbortSignal.signal.aborted).toBe(true);
    expect(linkedAbortSignal.signal.reason).toBe(
      "trusted EventTarget cancellation",
    );
    expect(() => linkedAbortSignal.dispose()).not.toThrow();
  });

  test("rejects values that are not AbortSignal instances", () => {
    expect(() => createLinkedAbortSignal([{}])).toThrow(
      "Every source signal must be an AbortSignal.",
    );
  });

  test("ignores a manually dispatched abort event while the source remains active", () => {
    const sourceController = new AbortController();
    const initialListenerCount = getEventListeners(
      sourceController.signal,
      "abort",
    ).length;
    const linkedAbortSignal = createLinkedAbortSignal([
      sourceController.signal,
    ]);

    sourceController.signal.dispatchEvent(new Event("abort"));

    expect(linkedAbortSignal.signal.aborted).toBe(false);
    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount + 1,
    );

    sourceController.abort("real abort after the synthetic event");

    expect(linkedAbortSignal.signal.aborted).toBe(true);
    expect(linkedAbortSignal.signal.reason).toBe(
      "real abort after the synthetic event",
    );
    expect(getEventListeners(sourceController.signal, "abort")).toHaveLength(
      initialListenerCount,
    );
  });
});
