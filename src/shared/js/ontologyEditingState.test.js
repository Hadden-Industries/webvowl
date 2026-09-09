import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createContext, SourceTextModule } from "node:vm";

let createOntologyEditingState;
const context = createContext({ URL });
beforeAll(async () => {
  const source = new SourceTextModule(
    readFileSync(new URL("./ontologyEditingState.js", import.meta.url), "utf8"),
    { context },
  );
  await source.link(
    () =>
      new SourceTextModule(
        readFileSync(
          new URL("./util/prefixRepresentationModule.js", import.meta.url),
          "utf8",
        ),
        { context },
      ),
  );
  await source.evaluate();
  ({ createOntologyEditingState } = source.namespace);
});

describe("explicit debug feature visibility", () => {
  test.each([true, false])(
    "applies %s idempotently to stored and displayed choices",
    (visible) => {
      const state = createOntologyEditingState();
      const classes = new Set();
      const element = {
        classList: {
          toggle: (name, present) =>
            present ? classes.add(name) : classes.delete(name),
        },
      };
      context.document = { querySelectorAll: () => [element] };
      try {
        state.setDebugFeaturesVisible(visible);
        state.setDebugFeaturesVisible(visible);
        expect(state.getHideDebugFeatures()).toBe(!visible);
        expect(classes.has("hidden")).toBe(!visible);
      } finally {
        context.document = undefined;
      }
    },
  );
});
