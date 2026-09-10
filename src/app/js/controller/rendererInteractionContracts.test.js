import { beforeAll, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let createOntologyEditorOptionsRequest;
let createVisualizationViewportSize;
beforeAll(async () => {
  ({ createOntologyEditorOptionsRequest, createVisualizationViewportSize } =
    await loadEsmModuleForTest(
      new URL("./rendererInteractionContracts.js", import.meta.url),
      import.meta.url,
    ));
});

test("retains the existing class palette and accuracy helper choices as plain values", () => {
  const request = createOntologyEditorOptionsRequest({
    isEditorMode: true,
    defaultClass: "owl:Thing",
    useAccuracyHelper: false,
  });
  expect(request).toEqual({
    isEditorMode: true,
    defaultClass: "owl:Thing",
    useAccuracyHelper: false,
  });
  expect(Object.isFrozen(request)).toBe(true);
  expect(() =>
    createOntologyEditorOptionsRequest({ defaultClass: "owl:objectProperty" }),
  ).toThrow();
  expect(() => createOntologyEditorOptionsRequest({ sidebar: {} })).toThrow();
});

test("accepts measured viewport occlusion without retaining presentation objects", () => {
  expect(
    createVisualizationViewportSize({
      widthPx: 800,
      heightPx: 600,
      occludedLeftWidthPx: 200,
    }),
  ).toEqual({
    widthPx: 800,
    heightPx: 600,
    occludedLeftWidthPx: 200,
    isTouchDevice: false,
  });
  expect(() =>
    createVisualizationViewportSize({
      widthPx: 100,
      heightPx: 600,
      occludedLeftWidthPx: 200,
    }),
  ).toThrow();
  expect(() =>
    createVisualizationViewportSize({
      widthPx: 800,
      heightPx: 600,
      sidebar: {},
    }),
  ).toThrow();
});
