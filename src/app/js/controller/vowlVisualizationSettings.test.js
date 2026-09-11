import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let decodeVowlVisualizationSettings;
let encodeVowlVisualizationSettings;
beforeAll(async () => {
  ({ decodeVowlVisualizationSettings, encodeVowlVisualizationSettings } =
    await loadEsmModuleForTest(
      new URL("./vowlVisualizationSettings.js", import.meta.url),
      import.meta.url,
    ));
});

describe("saved VOWL visualization settings", () => {
  test("encodes applied choices in the persisted format without consulting UI state", () => {
    const state = {
      view: {
        language: "de",
        filters: {
          datatypes: "hide",
          objectProperties: "show",
          subclasses: "show",
          disjointness: "hide",
          setOperators: "show",
          minDegree: 125,
        },
        focus: [],
        modes: {
          nodeScaling: false,
          compactNotation: true,
          colorExternals: true,
          pickAndPin: false,
          dynamicLabelWidth: false,
          colorExternalsMode: "gradient",
          maxLabelWidthPx: 160,
        },
        forceDistances: { classDistancePx: 300, datatypeDistancePx: 180 },
      },
      layout: { status: "paused" },
      zoomScale: 0.38125,
      translation: { xPx: 0, yPx: -20.125 },
    };
    const settings = encodeVowlVisualizationSettings(state);
    expect(settings).toEqual({
      global: {
        paused: true,
        language: "de",
        zoom: 0.38125,
        translation: [0, -20.125],
      },
      gravity: { classDistance: 300, datatypeDistance: 180 },
      filter: {
        degreeSliderValue: 125,
        checkBox: [
          { id: "datatypeFilterCheckbox", checked: true },
          { id: "disjointFilterCheckbox", checked: true },
          { id: "objectPropertyFilterCheckbox", checked: false },
          { id: "setoperatorFilterCheckbox", checked: false },
          { id: "subclassFilterCheckbox", checked: false },
        ],
      },
      modes: {
        colorSwitchState: true,
        maxLabelWidth: 160,
        checkBox: [
          { id: "colorexternalsModuleCheckbox", checked: true },
          { id: "compactnotationModuleCheckbox", checked: true },
          { id: "labelWidthModuleCheckbox", checked: false },
          { id: "nodescalingModuleCheckbox", checked: false },
          { id: "pickandpinModuleCheckbox", checked: false },
        ],
      },
    });
    const reloaded = decodeVowlVisualizationSettings(settings);
    expect(reloaded.view).toEqual({
      language: "de",
      filters: state.view.filters,
      layout: "pause",
      zoomScale: 0.38125,
      translation: { xPx: 0, yPx: -20.125 },
    });
    expect(reloaded.modes).toEqual(state.view.modes);
    expect(reloaded.forceDistances).toEqual(state.view.forceDistances);
    state.view.filters.minDegree = 0;
    expect(settings.filter.degreeSliderValue).toBe(125);
    expect(Object.isFrozen(settings.global.translation)).toBe(true);
    expect(Object.isFrozen(settings.filter.checkBox[0])).toBe(true);
  });

  test.each([
    { global: { paused: "false" } },
    { global: { zoom: "NaN" } },
    { global: { translation: [0] } },
    { filter: { degreeSliderValue: -1 } },
    {
      filter: { checkBox: [{ id: "datatypeFilterCheckbox", checked: "true" }] },
    },
    { modes: { maxLabelWidth: 15 } },
    { gravity: { classDistance: 601 } },
  ])(
    "rejects malformed saved choices through shared validation: %j",
    (settings) => {
      expect(() => decodeVowlVisualizationSettings(settings)).toThrow();
    },
  );
  test("decodes explicit false and zero choices without consulting menus", () => {
    expect(
      decodeVowlVisualizationSettings({
        global: {
          paused: false,
          zoom: "0.38",
          translation: [0, -20],
          language: "de",
        },
        gravity: { classDistance: 300, datatypeDistance: 180 },
        filter: {
          degreeSliderValue: "0",
          checkBox: [
            { id: "datatypeFilterCheckbox", checked: false },
            { id: "disjointFilterCheckbox", checked: true },
          ],
        },
        modes: {
          colorSwitchState: false,
          maxLabelWidth: 160,
          checkBox: [
            { id: "nodescalingModuleCheckbox", checked: false },
            { id: "compactnotationModuleCheckbox", checked: true },
            { id: "labelWidthModuleCheckbox", checked: false },
          ],
        },
      }),
    ).toEqual({
      view: {
        layout: "resume",
        zoomScale: 0.38,
        translation: { xPx: 0, yPx: -20 },
        language: "de",
        filters: { minDegree: 0, datatypes: "show", disjointness: "hide" },
      },
      modes: {
        colorExternalsMode: "same",
        maxLabelWidthPx: 160,
        nodeScaling: false,
        compactNotation: true,
        dynamicLabelWidth: false,
      },
      forceDistances: { classDistancePx: 300, datatypeDistancePx: 180 },
    });
  });

  test("decodes saved pause and gradient directly, retaining omission", () => {
    expect(
      decodeVowlVisualizationSettings({
        global: { paused: true },
        modes: { colorSwitchState: true },
      }),
    ).toEqual({
      view: { layout: "pause" },
      modes: { colorExternalsMode: "gradient" },
    });
    expect(decodeVowlVisualizationSettings(undefined)).toEqual({});
  });
});
