import {
  createAppliedVisualizationView,
  createInitialVisualizationRequest,
} from "./renderedGraphRuntimeContracts.js";

// These short names are the application's existing persisted URL vocabulary.
const FILTER_OPTIONS = Object.freeze({
  filter_datatypes: "datatypes",
  filter_objectProperties: "objectProperties",
  filter_sco: "subclasses",
  filter_disjoint: "disjointness",
  filter_setOperator: "setOperators",
});
const MODE_OPTIONS = Object.freeze({
  mode_dynamic: "dynamicLabelWidth",
  mode_pnp: "pickAndPin",
  mode_scaling: "nodeScaling",
  mode_compact: "compactNotation",
  mode_colorExt: "colorExternals",
});

function readBoolean(value, name) {
  if (value !== "true" && value !== "false") {
    throw new TypeError(`${name} must be true or false.`);
  }
  return value === "true";
}

function readNumber(value, name) {
  if (value.trim() === "" || !Number.isFinite(Number(value))) {
    throw new TypeError(`${name} must be a finite number.`);
  }
  return Number(value);
}

export function readVisualizationShareLink(address) {
  const hash = new URL(String(address)).hash.slice(1);
  const separator = hash.startsWith("opts=") ? hash.indexOf("#") : -1;
  const optionText = hash.startsWith("opts=")
    ? hash.slice(5, separator === -1 ? undefined : separator)
    : "";
  const ontologyIdentifier = hash.startsWith("opts=")
    ? separator === -1
      ? "foaf"
      : hash.slice(separator + 1) || "foaf"
    : hash || "foaf";
  const options = Object.fromEntries(
    new URLSearchParams(optionText.replaceAll(";", "&")),
  );
  const filters = {};
  const modes = {};
  const view = {};
  const forceDistances = {};
  const presentation = {};
  for (const [option, name] of Object.entries(FILTER_OPTIONS)) {
    if (Object.hasOwn(options, option)) {
      filters[name] = readBoolean(options[option], option) ? "hide" : "show";
    }
  }
  if (Object.hasOwn(options, "doc") && options.doc !== "-1") {
    filters.minDegree = readNumber(options.doc, "doc");
  }
  if (Object.keys(filters).length > 0) {
    view.filters = filters;
  }
  if (Object.hasOwn(options, "paused")) {
    view.layout = readBoolean(options.paused, "paused") ? "pause" : "resume";
  }
  if (Object.hasOwn(options, "language")) {
    view.language = options.language;
  }
  if (Object.hasOwn(options, "zoom")) {
    view.zoomScale = readNumber(options.zoom, "zoom");
  }
  if (
    Object.hasOwn(options, "translationX") ||
    Object.hasOwn(options, "translationY")
  ) {
    if (
      !Object.hasOwn(options, "translationX") ||
      !Object.hasOwn(options, "translationY")
    ) {
      throw new TypeError(
        "Both viewport translation coordinates are required.",
      );
    }
    view.translation = {
      xPx: readNumber(options.translationX, "translationX"),
      yPx: readNumber(options.translationY, "translationY"),
    };
  }
  for (const [option, name] of Object.entries(MODE_OPTIONS)) {
    if (Object.hasOwn(options, option)) {
      modes[name] = readBoolean(options[option], option);
    }
  }
  if (Object.hasOwn(options, "mode_multiColor")) {
    modes.colorExternalsMode = readBoolean(
      options.mode_multiColor,
      "mode_multiColor",
    )
      ? "gradient"
      : "same";
  }
  if (Object.hasOwn(options, "maxLabelWidth")) {
    modes.maxLabelWidthPx = readNumber(options.maxLabelWidth, "maxLabelWidth");
  }
  if (Object.hasOwn(options, "cd")) {
    forceDistances.classDistancePx = readNumber(options.cd, "cd");
  }
  if (Object.hasOwn(options, "dd")) {
    forceDistances.datatypeDistancePx = readNumber(options.dd, "dd");
  }
  if (Object.hasOwn(options, "sidebar")) {
    presentation.sidebar = readNumber(options.sidebar, "sidebar");
    if (![0, 1].includes(presentation.sidebar)) {
      throw new RangeError("sidebar must be 0 or 1.");
    }
  }
  for (const name of ["editorMode", "debugFeatures"]) {
    if (Object.hasOwn(options, name)) {
      presentation[name] = readBoolean(options[name], name);
    }
  }
  return Object.freeze({
    ontologyIdentifier,
    initialVisualization: createInitialVisualizationRequest({
      ...(Object.keys(view).length === 0 ? {} : { view }),
      ...(Object.keys(modes).length === 0 ? {} : { modes }),
      ...(Object.keys(forceDistances).length === 0 ? {} : { forceDistances }),
    }),
    presentation: Object.freeze(presentation),
  });
}

export function createVisualizationShareLink(
  applicationUrl,
  state,
  presentation = {},
) {
  const sourceKind = { "ontology-document-iri": "iri", "vowl-json-url": "url" }[
    state.source?.kind
  ];
  if (!sourceKind || typeof state.source.identity !== "string") {
    throw new TypeError(
      "A share link requires an ontology loaded from a URL. Export JSON to share a local document.",
    );
  }
  const sourceUrl = new URL(state.source.identity);
  if (!["http:", "https:"].includes(sourceUrl.protocol)) {
    throw new TypeError("The shared ontology URL must use HTTP or HTTPS.");
  }
  if (!["paused", "settled", "relaxing"].includes(state.layout?.status)) {
    throw new TypeError("A share link requires an available visualization.");
  }
  const applied = createAppliedVisualizationView(state.view);
  const { view } = createInitialVisualizationRequest({
    view: {
      language: applied.language,
      zoomScale: state.zoomScale,
      translation: state.translation,
    },
  });
  const options = {
    doc: applied.filters.minDegree,
    cd: applied.forceDistances.classDistancePx,
    dd: applied.forceDistances.datatypeDistancePx,
  };
  for (const [option, name] of Object.entries(FILTER_OPTIONS)) {
    options[option] = applied.filters[name] === "hide";
  }
  for (const [option, name] of Object.entries(MODE_OPTIONS)) {
    options[option] = applied.modes[name];
  }
  Object.assign(options, {
    mode_multiColor: applied.modes.colorExternalsMode === "gradient",
    maxLabelWidth: applied.modes.maxLabelWidthPx,
    paused: state.layout.status === "paused",
    language: view.language,
    zoom: view.zoomScale,
    translationX: view.translation.xPx,
    translationY: view.translation.yPx,
  });
  if (presentation.sidebar !== undefined) {
    if (![0, 1].includes(presentation.sidebar)) {
      throw new TypeError("sidebar must be 0 or 1.");
    }
    options.sidebar = presentation.sidebar;
  }
  for (const name of ["editorMode", "debugFeatures"]) {
    if (presentation[name] !== undefined) {
      if (typeof presentation[name] !== "boolean") {
        throw new TypeError(`${name} must be a boolean.`);
      }
      options[name] = presentation[name];
    }
  }
  const optionText = new URLSearchParams(options)
    .toString()
    .replaceAll("&", ";");
  const link = new URL(String(applicationUrl));
  link.hash = `opts=${optionText};#${sourceKind}=${encodeURIComponent(state.source.identity)}`;
  return link.href;
}
