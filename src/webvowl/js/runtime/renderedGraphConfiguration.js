export const RENDERED_GRAPH_CONFIGURATION_DEFAULTS = Object.freeze({
  charge: -500,
  classDistance: 200,
  compactNotation: false,
  datatypeDistance: 120,
  dynamicLabelWidth: true,
  gravity: 0.025,
  heightPx: 600,
  linkStrength: 1,
  loopDistance: 150,
  maxLabelWidth: 120,
  maxMagnification: 4,
  minMagnification: 0.01,
  rectangularRepresentation: false,
  scaleNodesByIndividuals: true,
  widthPx: 800,
});

const FINITE_NUMBER_SETTING_NAMES = Object.freeze(["charge", "gravity"]);
const NON_NEGATIVE_NUMBER_SETTING_NAMES = Object.freeze([
  "classDistance",
  "datatypeDistance",
  "heightPx",
  "linkStrength",
  "loopDistance",
  "maxLabelWidth",
  "widthPx",
]);
const POSITIVE_NUMBER_SETTING_NAMES = Object.freeze([
  "maxMagnification",
  "minMagnification",
]);
const BOOLEAN_SETTING_NAMES = Object.freeze([
  "compactNotation",
  "dynamicLabelWidth",
  "rectangularRepresentation",
  "scaleNodesByIndividuals",
]);

function assertPlainRecord(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw new TypeError("Rendered graph settings must be a plain object.");
  }
}

function assertRendererOwnedSettingNames(settingOverrides) {
  const foreignSettingName = Object.keys(settingOverrides).find(
    (settingName) =>
      !Object.hasOwn(RENDERED_GRAPH_CONFIGURATION_DEFAULTS, settingName),
  );
  if (foreignSettingName !== undefined) {
    throw new TypeError(
      `${foreignSettingName} is not a renderer-owned rendered-graph setting.`,
    );
  }
}

function assertFiniteNumber(value, settingName) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${settingName} must be a finite number.`);
  }
}

function assertNumberAtLeast(value, settingName, minimum) {
  assertFiniteNumber(value, settingName);
  if (value < minimum) {
    throw new RangeError(`${settingName} must be at least ${minimum}.`);
  }
}

function assertBoolean(value, settingName) {
  if (typeof value !== "boolean") {
    throw new TypeError(`${settingName} must be a Boolean predicate.`);
  }
}

export function createRenderedGraphConfiguration(settingOverrides = {}) {
  assertPlainRecord(settingOverrides);
  assertRendererOwnedSettingNames(settingOverrides);

  const renderedGraphConfiguration = {
    ...RENDERED_GRAPH_CONFIGURATION_DEFAULTS,
    ...settingOverrides,
  };

  for (const settingName of FINITE_NUMBER_SETTING_NAMES) {
    assertFiniteNumber(renderedGraphConfiguration[settingName], settingName);
  }
  for (const settingName of NON_NEGATIVE_NUMBER_SETTING_NAMES) {
    assertNumberAtLeast(
      renderedGraphConfiguration[settingName],
      settingName,
      0,
    );
  }
  for (const settingName of POSITIVE_NUMBER_SETTING_NAMES) {
    assertNumberAtLeast(
      renderedGraphConfiguration[settingName],
      settingName,
      Number.MIN_VALUE,
    );
  }
  for (const settingName of BOOLEAN_SETTING_NAMES) {
    assertBoolean(renderedGraphConfiguration[settingName], settingName);
  }
  if (
    renderedGraphConfiguration.minMagnification >=
    renderedGraphConfiguration.maxMagnification
  ) {
    throw new RangeError(
      "minMagnification must be smaller than maxMagnification.",
    );
  }

  return Object.freeze(renderedGraphConfiguration);
}
