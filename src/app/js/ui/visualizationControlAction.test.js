import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let runVisualizationControlAction;
beforeAll(
  async () =>
    ({ runVisualizationControlAction } = await loadEsmModuleForTest(
      new URL("./visualizationControlAction.js", import.meta.url),
      import.meta.url,
    )),
);

describe("visualization control action feedback", () => {
  test("shows a safe visible failure for a rejected action", async () => {
    const status = { hidden: true, textContent: "" };
    await runVisualizationControlAction(
      () => Promise.reject(new Error("internal secret")),
      { getElementById: () => status },
    );
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBe(
      "The visualization could not be updated. Please try again.",
    );
  });
  test("treats a superseded action as cancellation and retains newer feedback", async () => {
    const status = { hidden: false, textContent: "newer action" };
    let reject;
    const action = runVisualizationControlAction(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
      { getElementById: () => status },
    );
    status.hidden = false;
    status.textContent = "newer action";
    reject(new DOMException("superseded", "AbortError"));
    await action;
    expect(status).toEqual({ hidden: false, textContent: "newer action" });
  });
  test("clears previous feedback when a new action starts", async () => {
    const status = { hidden: false, textContent: "old error" };
    await runVisualizationControlAction(() => Promise.resolve(), {
      getElementById: () => status,
    });
    expect(status.hidden).toBe(true);
  });
});
