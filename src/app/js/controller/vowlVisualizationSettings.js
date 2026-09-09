import {
  createAppliedVisualizationView,
  createForceLayoutDistancesRequest,
  createVisualizationModesRequest,
  createVisualizationViewRequest,
} from "./renderedGraphRuntimeContracts.js";

// These identifiers belong to the persisted VOWL settings format. Decode them
// once into application choices; no UI element or renderer object owns the file.
const FILTER_NAMES_BY_SAVED_ID = Object.freeze({
  datatypeFilterCheckbox: "datatypes",
  objectPropertyFilterCheckbox: "objectProperties",
  subclassFilterCheckbox: "subclasses",
  disjointFilterCheckbox: "disjointness",
  setoperatorFilterCheckbox: "setOperators",
});
const MODE_NAMES_BY_SAVED_ID = Object.freeze({
  nodescalingModuleCheckbox: "nodeScaling",
  compactnotationModuleCheckbox: "compactNotation",
  colorexternalsModuleCheckbox: "colorExternals",
  pickandpinModuleCheckbox: "pickAndPin",
  labelWidthModuleCheckbox: "dynamicLabelWidth",
});

function savedRecord(value, name) {
  if (value === undefined) {
    return {};
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  return value;
}

function savedNumber(value, name) {
  // Historical HTML slider values were written as strings. Numbers are the
  // semantic value, and the shared request constructors own their valid ranges.
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || value.trim() === "")
  ) {
    throw new TypeError(`${name} must be a number or numeric string.`);
  }
  return Number(value);
}

function savedBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean.`);
  }
  return value;
}

function decodeSavedCheckboxes(checkboxes, names, projectValue) {
  if (checkboxes === undefined) {
    return {};
  }
  if (!Array.isArray(checkboxes)) {
    throw new TypeError("Saved checkBox settings must be an array.");
  }
  const choices = {};
  for (const entry of checkboxes) {
    const checkbox = savedRecord(entry, "Saved checkbox");
    if (Object.hasOwn(names, checkbox.id)) {
      choices[names[checkbox.id]] = projectValue(
        savedBoolean(checkbox.checked, checkbox.id),
      );
    }
  }
  return choices;
}

export function decodeVowlVisualizationSettings(settings) {
  const saved = savedRecord(settings, "VOWL settings");
  const globalSettings = savedRecord(saved.global, "global");
  const gravitySettings = savedRecord(saved.gravity, "gravity");
  const filterSettings = savedRecord(saved.filter, "filter");
  const modeSettings = savedRecord(saved.modes, "modes");
  const view = {};
  if (globalSettings.paused !== undefined) {
    view.layout = savedBoolean(globalSettings.paused, "paused")
      ? "pause"
      : "resume";
  }
  if (globalSettings.zoom !== undefined) {
    view.zoomScale = savedNumber(globalSettings.zoom, "zoom");
  }
  if (globalSettings.translation !== undefined) {
    if (
      !Array.isArray(globalSettings.translation) ||
      globalSettings.translation.length !== 2
    ) {
      throw new TypeError(
        "Saved translation must contain exactly two coordinates.",
      );
    }
    view.translation = {
      xPx: savedNumber(globalSettings.translation[0], "translation x"),
      yPx: savedNumber(globalSettings.translation[1], "translation y"),
    };
  }
  if (globalSettings.language !== undefined) {
    view.language = globalSettings.language;
  }
  const filters = decodeSavedCheckboxes(
    filterSettings.checkBox,
    FILTER_NAMES_BY_SAVED_ID,
    (checked) => (checked ? "hide" : "show"),
  );
  if (filterSettings.degreeSliderValue !== undefined) {
    filters.minDegree = savedNumber(
      filterSettings.degreeSliderValue,
      "degreeSliderValue",
    );
  }
  if (Object.keys(filters).length > 0) {
    view.filters = filters;
  }

  const modes = decodeSavedCheckboxes(
    modeSettings.checkBox,
    MODE_NAMES_BY_SAVED_ID,
    (checked) => checked,
  );
  if (modeSettings.colorSwitchState !== undefined) {
    modes.colorExternalsMode = savedBoolean(
      modeSettings.colorSwitchState,
      "colorSwitchState",
    )
      ? "gradient"
      : "same";
  }
  if (modeSettings.maxLabelWidth !== undefined) {
    modes.maxLabelWidthPx = savedNumber(
      modeSettings.maxLabelWidth,
      "maxLabelWidth",
    );
  }
  const forceDistances = {};
  for (const kind of ["class", "datatype"]) {
    const field = `${kind}Distance`;
    if (gravitySettings[field] !== undefined) {
      forceDistances[`${field}Px`] = savedNumber(gravitySettings[field], field);
    }
  }
  return Object.freeze({
    ...(Object.keys(view).length === 0
      ? {}
      : { view: createVisualizationViewRequest(view) }),
    ...(Object.keys(modes).length === 0
      ? {}
      : { modes: createVisualizationModesRequest(modes) }),
    ...(Object.keys(forceDistances).length === 0
      ? {}
      : { forceDistances: createForceLayoutDistancesRequest(forceDistances) }),
  });
}

export function encodeVowlVisualizationSettings({
  view,
  layout,
  zoomScale,
  translation,
}) {
  const applied = createAppliedVisualizationView(view);
  const viewport = createVisualizationViewRequest({ zoomScale, translation });
  if (!["paused", "relaxing", "settled"].includes(layout?.status)) {
    throw new TypeError("Saved settings require an available visualization.");
  }
  function encodeCheckboxes(names, values, projectValue) {
    return Object.freeze(
      Object.keys(names)
        .sort()
        .map((id) =>
          Object.freeze({
            id,
            checked: projectValue(values[names[id]]),
          }),
        ),
    );
  }
  return Object.freeze({
    global: Object.freeze({
      paused: layout.status === "paused",
      language: applied.language,
      zoom: viewport.zoomScale,
      translation: Object.freeze([
        viewport.translation.xPx,
        viewport.translation.yPx,
      ]),
    }),
    gravity: Object.freeze({
      classDistance: applied.forceDistances.classDistancePx,
      datatypeDistance: applied.forceDistances.datatypeDistancePx,
    }),
    filter: Object.freeze({
      degreeSliderValue: applied.filters.minDegree,
      checkBox: encodeCheckboxes(
        FILTER_NAMES_BY_SAVED_ID,
        applied.filters,
        (value) => value === "hide",
      ),
    }),
    modes: Object.freeze({
      colorSwitchState: applied.modes.colorExternalsMode === "gradient",
      maxLabelWidth: applied.modes.maxLabelWidthPx,
      checkBox: encodeCheckboxes(
        MODE_NAMES_BY_SAVED_ID,
        applied.modes,
        (value) => value,
      ),
    }),
  });
}
