// Immutable policy shared by presentation, controller contracts and renderer.
// Mutable instances copy these values rather than sharing their own state.
export const DEFAULT_VISUALIZATION_FILTERS = Object.freeze({
  datatypes: "show",
  objectProperties: "show",
  subclasses: "show",
  disjointness: "hide",
  setOperators: "show",
});

export const DEFAULT_VISUALIZATION_MODES = Object.freeze({
  colorExternals: true,
  compactNotation: false,
  nodeScaling: true,
  dynamicLabelWidth: true,
  pickAndPin: false,
  maxLabelWidthPx: 120,
  colorExternalsMode: "same",
});

export const DEFAULT_FORCE_LAYOUT_DISTANCES = Object.freeze({
  classDistancePx: 200,
  datatypeDistancePx: 120,
});

export const VISUALIZATION_ZOOM_LIMITS = Object.freeze({
  minimumZoomScale: 0.01,
  maximumZoomScale: 4,
});

export const DEFAULT_RENDERER_INTERACTION_SETTINGS = Object.freeze({
  drawPropertyDraggerOnHover: true,
  showDraggerObject: false,
  useAccuracyHelper: true,
  showRenderingStatistic: true,
  showInputModality: false,
});

export const RENDERED_GRAPH_CONFIGURATION_DEFAULTS = Object.freeze({
  charge: -500,
  classDistance: DEFAULT_FORCE_LAYOUT_DISTANCES.classDistancePx,
  compactNotation: DEFAULT_VISUALIZATION_MODES.compactNotation,
  datatypeDistance: DEFAULT_FORCE_LAYOUT_DISTANCES.datatypeDistancePx,
  dynamicLabelWidth: DEFAULT_VISUALIZATION_MODES.dynamicLabelWidth,
  gravity: 0.025,
  heightPx: 600,
  linkStrength: 1,
  loopDistance: 150,
  maxLabelWidth: DEFAULT_VISUALIZATION_MODES.maxLabelWidthPx,
  maxMagnification: VISUALIZATION_ZOOM_LIMITS.maximumZoomScale,
  minMagnification: VISUALIZATION_ZOOM_LIMITS.minimumZoomScale,
  rectangularRepresentation: false,
  scaleNodesByIndividuals: DEFAULT_VISUALIZATION_MODES.nodeScaling,
  widthPx: 800,
});
