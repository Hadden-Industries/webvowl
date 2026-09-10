import { createLinkCreator as createLinkCreatorModule } from "../parsing/linkCreator.js";
import { createElementTools as createElementToolsModule } from "../../../shared/js/util/elementTools.js";
import { createNodeMap as createNodePrototypeMapModule } from "../elements/nodes/nodeMap.js";
import { createPropertyMap as createPropertyPrototypeMapModule } from "../elements/properties/propertyMap.js";
import { createOntologyEditingState } from "../../../shared/js/ontologyEditingState.js";
import { createRenderedGraphSettings } from "./renderedGraphSettings.js";
import { RENDERED_GRAPH_CONFIGURATION_DEFAULTS } from "./renderedGraphConfiguration.js";
import { createParser as createVowlParser } from "../parser.js";
import { createClassDragger } from "../classDragger.js";
import { createRangeDragger } from "../rangeDragger.js";
import { createDomainDragger } from "../domainDragger.js";
import { createShadowClone } from "../shadowClone.js";
import { nextContinuousZoomScale } from "../../../shared/js/util/continuousZoomRamp.js";
import { createFocuser } from "../../../shared/js/modules/focuser.js";
import { createPickAndPin } from "../../../shared/js/modules/pickAndPin.js";
import { createColorExternalsSwitch } from "./colorExternalsSwitch.js";
import { createCompactNotationSwitch } from "../../../shared/js/modules/compactNotationSwitch.js";
import { createDatatypeFilter } from "../../../shared/js/modules/datatypeFilter.js";
import { createDisjointFilter } from "../../../shared/js/modules/disjointFilter.js";
import { createEmptyLiteralFilter } from "../../../shared/js/modules/emptyLiteralFilter.js";
import { createNodeDegreeFilter } from "../../../shared/js/modules/nodeDegreeFilter.js";
import { createNodeScalingSwitch } from "../../../shared/js/modules/nodeScalingSwitch.js";
import { createObjectPropertyFilter } from "../../../shared/js/modules/objectPropertyFilter.js";
import { createSetOperatorFilter } from "../../../shared/js/modules/setOperatorFilter.js";
import { createStatistics } from "../../../shared/js/modules/statistics.js";
import { createSubclassFilter } from "../../../shared/js/modules/subclassFilter.js";
import _ from "lodash/core";
import { createMath as createMathModule } from "../../../shared/js/util/math.js";
const math = createMathModule();
const linkCreator = createLinkCreatorModule();
const elementTools = createElementToolsModule();
// add some maps for nodes and properties -- used for object generation
const nodePrototypeMap = createNodePrototypeMapModule();
const propertyPrototypeMap = createPropertyPrototypeMapModule();

function finiteNumber(value) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeZoom(value, minimum, maximum) {
  const zoom = finiteNumber(value);
  const min = finiteNumber(minimum);
  const max = finiteNumber(maximum);
  if (zoom === undefined || zoom <= 0) {
    return undefined;
  }
  if (min !== undefined && zoom < min) {
    return min;
  }
  if (max !== undefined && zoom > max) {
    return max;
  }
  return zoom;
}

function normalizeTranslation(value) {
  if (
    !value ||
    typeof value === "string" ||
    typeof value.length !== "number" ||
    value.length < 2
  ) {
    return undefined;
  }
  const x = finiteNumber(value[0]);
  const y = finiteNumber(value[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function normalizeViewport(zoom, translation, minimum, maximum) {
  const normalizedZoom = normalizeZoom(zoom, minimum, maximum);
  const normalizedTranslation = normalizeTranslation(translation);
  if (normalizedZoom === undefined || normalizedTranslation === undefined) {
    return undefined;
  }
  return { zoom: normalizedZoom, translation: normalizedTranslation };
}

function toSvgTransform(zoom, translation) {
  const viewport = normalizeViewport(zoom, translation);
  if (!viewport) {
    return undefined;
  }
  return (
    "translate(" +
    viewport.translation[0] +
    "," +
    viewport.translation[1] +
    ")scale(" +
    viewport.zoom +
    ")"
  );
}

const viewportTransform = Object.freeze({
  finiteNumber,
  normalizeTranslation,
  normalizeViewport,
  normalizeZoom,
  toSvgTransform,
});

function isFinitePoint(point) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
}

const svgRenderingGuard = Object.freeze({
  isFinitePoint,
  setTransform(element, point, offset) {
    if (!isFinitePoint(point) || (offset && !isFinitePoint(offset))) {
      return false;
    }

    const offsetX = offset ? offset.x : 0;
    const offsetY = offset ? offset.y : 0;
    const x = point.x + offsetX;
    const y = point.y + offsetY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false;
    }

    element.setAttribute("transform", "translate(" + x + "," + y + ")");
    return true;
  },
  setCurvePath(element, points, tension) {
    const path = math.tryCalculateCurvePath(points, tension);
    if (path === undefined) {
      return false;
    }

    element.setAttribute("d", path);
    return true;
  },
});

function createInvalidGeometryReporter(raiseRenderWarning) {
  let episodeActive = false;

  return function (skippedUpdates) {
    if (skippedUpdates === 0) {
      episodeActive = false;
      return;
    }
    if (episodeActive) {
      return;
    }

    episodeActive = true;
    raiseRenderWarning(
      "NON_FINITE_GEOMETRY",
      `Skipped ${skippedUpdates} update${
        skippedUpdates === 1 ? "" : "s"
      } with non-finite geometry.`,
    );
  };
}

function measureViewportElement(element, fallbackWidth, fallbackHeight) {
  const normalizedFallbackWidth = finiteNumber(fallbackWidth);
  const normalizedFallbackHeight = finiteNumber(fallbackHeight);
  const fallback = {
    width: normalizedFallbackWidth > 0 ? normalizedFallbackWidth : 0,
    height: normalizedFallbackHeight > 0 ? normalizedFallbackHeight : 0,
  };
  if (!element) {
    return fallback;
  }

  const elementRect =
    typeof element.getBoundingClientRect === "function"
      ? element.getBoundingClientRect()
      : {};
  const clientWidth = finiteNumber(element.clientWidth);
  const clientHeight = finiteNumber(element.clientHeight);
  const rectWidth = finiteNumber(elementRect.width);
  const rectHeight = finiteNumber(elementRect.height);

  return {
    width:
      clientWidth > 0
        ? clientWidth
        : rectWidth > 0
          ? rectWidth
          : fallback.width,
    height:
      clientHeight > 0
        ? clientHeight
        : rectHeight > 0
          ? rectHeight
          : fallback.height,
  };
}

function createGraph(
  graphContainerElement,
  configuration = RENDERED_GRAPH_CONFIGURATION_DEFAULTS,
) {
  const graph = new EventTarget();
  const reportInvalidGeometry = createInvalidGeometryReporter(
    (warningCode, message) => graph.raiseRenderWarning(warningCode, message),
  );
  const CARDINALITY_HDISTANCE = 20;
  const CARDINALITY_VDISTANCE = 10;
  const renderedGraphSettings = createRenderedGraphSettings();
  for (const [name, value] of Object.entries(configuration)) {
    renderedGraphSettings[
      name === "widthPx" ? "width" : name === "heightPx" ? "height" : name
    ](value);
  }
  const filterModules = [
    ["literalFilter", createEmptyLiteralFilter()],
    [null, createStatistics()],
    ["nodeDegreeFilter", createNodeDegreeFilter()],
    ["datatypeFilter", createDatatypeFilter()],
    ["objectPropertyFilter", createObjectPropertyFilter()],
    ["subclassFilter", createSubclassFilter()],
    ["disjointPropertyFilter", createDisjointFilter()],
    ["setOperatorFilter", createSetOperatorFilter()],
    ["nodeScalingModule", createNodeScalingSwitch(graph)],
    ["compactNotationModule", createCompactNotationSwitch(graph)],
    ["colorExternalsModule", createColorExternalsSwitch(graph)],
  ];
  for (const [setting, module] of filterModules) {
    renderedGraphSettings.filterModules().push(module);
    if (setting !== null) {
      renderedGraphSettings[setting](module);
    }
  }
  // Focus and pinning last only as long as this mount, so the renderer builds
  // them rather than accepting them from the application. The selection they
  // respond to is published as a fact and reaches the interface through
  // controller state.
  const focuser = createFocuser(graph);
  const pickAndPin = createPickAndPin();
  renderedGraphSettings.focuserModule(focuser);
  renderedGraphSettings.pickAndPinModule(pickAndPin);
  graph.addEventListener("elementfocused", (focusEvent) =>
    focuser.handle(focusEvent.detail.element),
  );
  const ontologyEditingState = createOntologyEditingState();
  const parser = createVowlParser(graph);
  let language = "default";
  let paused = false;
  // Container for visual elements
  let graphContainer;
  let nodeContainer;
  let labelContainer;
  let cardinalityContainer;
  let linkContainer;
  // Visual elements
  let nodeElements;
  let initialLoad = true;
  let updateRenderingDuringSimulation = false;
  let labelGroupElements;
  let linkGroups;
  let linkPathElements;
  let cardinalityElements;
  // Internal data
  let classNodes;
  let labelNodes;
  let links;
  let properties;
  let unfilteredData;
  // Graph behaviour
  let force;
  let forceLink;
  let dragBehaviour;
  let renderInteractionEpoch = 0;
  let hasActiveRenderInteractions = true;
  let activeMouseDrag;
  let activeMousePan;
  let zoomFactor = 1.0;
  let centerGraphViewOnLoad = false;
  let transformAnimation = false;
  let graphTranslation = [0, 0];
  let pulseNodeIds = [];
  // The element ids the runtime last reported as highlighted.
  let highlightedElementIds = [];
  let nodeArrayForPulse = [];
  let nodeMap = [];
  let locationId = 0;
  let defaultZoom = 1.0;
  const defaultTargetZoom = 0.8;
  let touchDevice = false;
  let occludedLeftWidthPx = 0;
  let hasMeasuredViewport = false;
  let last_canvas_touch_time = 0;
  let last_element_tap_time = 0;
  let originalD3_dblClickFunction = null;
  let originalD3_touchZoomFunction = null;

  // editing elements
  let deleteGroupElement;
  let addDataPropertyGroupElement;
  let editContainer;
  let draggerLayer = null;
  const draggerObjectsArray = [];
  let delayedHider;
  let hoveredNodeElement = null;
  let hoveredPropertyElement = null;
  let draggingStarted = false;
  let frozenDomainForPropertyDragger;
  let frozenRangeForPropertyDragger;

  let eP = 0; // id for new properties
  let eN = 0; // id for new Nodes
  let editMode = ontologyEditingState.initialConfig().editorMode === "true";
  let finishedLoadingSequence = false;

  let ignoreOtherHoverEvents = false;
  let forceNotZooming = false;
  let now;
  let then; // used for fps computation
  let showFPS = false;
  let seenEditorHint = false;

  let zoom;
  let pendingViewportTransitionCount = 0;
  //var prefixModule=require("../prefixRepresentationModule")(graph);
  let renderedGraphEventPort = {
    // Nothing is renderable until a model has been placed. This replaces the
    // former question to the loading presentation about whether a load
    // succeeded, which the renderer must not ask.
    isOntologyRenderable: () => renderedGraphSettings.data() !== undefined,
    hasMissingImports: () => false,
    publishRenderProgress: () => undefined,
    publishRenderWarning: () => undefined,
    publishRenderedElementSelection: () => undefined,
    publishViewportChange: () => undefined,
    publishEditorModeChange: () => undefined,
    publishRecordLabelEdit: () => undefined,
  };

  // Several animated zoom paths set the transform through a d3 transition and
  // never pass through updateViewportState, so every one of them reports here.
  // A duplicate fact costs nothing: the presentation compares by value.
  function reportViewportChanged() {
    renderedGraphEventPort.publishViewportChange(
      zoomFactor,
      graphTranslation[0],
      graphTranslation[1],
    );
  }

  function syncZoomState() {
    const svgNode =
      graphContainer && graphContainer.node()
        ? graphContainer.node().parentNode
        : null;
    if (svgNode) {
      svgNode.__zoom = d3.zoomIdentity
        .translate(graphTranslation[0], graphTranslation[1])
        .scale(zoomFactor);
    }
  }

  function updateViewportState(translation, scale, synchronize = true) {
    const normalized = viewportTransform.normalizeViewport(
      scale,
      translation,
      renderedGraphSettings.minMagnification(),
      renderedGraphSettings.maxMagnification(),
    );
    if (!normalized) {
      return false;
    }
    graphTranslation = normalized.translation;
    zoomFactor = normalized.zoom;
    if (synchronize) {
      syncZoomState();
    }
    // Every viewport change passes through here, whether a control asked for
    // it or the reader panned and zoomed on the visualization itself, so this
    // is the one place the fact is reported.
    renderedGraphEventPort.publishViewportChange(
      zoomFactor,
      graphTranslation[0],
      graphTranslation[1],
    );
    return true;
  }

  function viewportTransformString() {
    return (
      viewportTransform.toSvgTransform(zoomFactor, graphTranslation) ||
      "translate(0,0)scale(1)"
    );
  }
  const NodePrototypeMap = createLowerCasePrototypeMap(nodePrototypeMap);
  const PropertyPrototypeMap =
    createLowerCasePrototypeMap(propertyPrototypeMap);
  const classDragger = createClassDragger(graph);
  const rangeDragger = createRangeDragger(graph);
  const domainDragger = createDomainDragger(graph);
  const shadowClone = createShadowClone(graph);

  graph.math = function () {
    return math;
  };
  /** --------------------------------------------------------- **/
  /** -- getter and setter definitions                       -- **/
  /** --------------------------------------------------------- **/
  graph.isEditorMode = function () {
    return editMode;
  };

  graph.ontologyEditingState = function () {
    return ontologyEditingState;
  };

  graph.scaleFactor = function () {
    return zoomFactor;
  };
  graph.translation = function () {
    return graphTranslation;
  };

  // Returns the visible nodes
  graph.graphNodeElements = function () {
    return nodeElements;
  };
  // Returns the visible Label Nodes
  graph.graphLabelElements = function () {
    return labelNodes;
  };

  graph.graphLinkElements = function () {
    return links;
  };

  // A held zoom control reports a direction and, later, that the gesture
  // ended. The ramp lives here because the viewport is renderer-owned; the
  // control used to run this loop itself and write a magnification across the
  // seam on every animation frame.
  const NOMINAL_FRAME_DURATION_MS = 1000 / 60;
  const MAXIMUM_FRAME_DURATION_MS = 100;
  let continuousZoomDirection = 0;
  let continuousZoomFrame;
  let continuousZoomPreviousFrameTime;

  function stepContinuousZoom(elapsedFrames) {
    const minimumMagnification = renderedGraphSettings.minMagnification();
    const maximumMagnification = renderedGraphSettings.maxMagnification();
    const { zoomScale: nextZoom, hasReachedBoundary } = nextContinuousZoomScale(
      {
        zoomScale: zoomFactor,
        zoomDirection: continuousZoomDirection,
        elapsedFrames,
        minimumMagnification,
        maximumMagnification,
      },
    );
    const centerX = renderedGraphSettings.width() / 2;
    const centerY = renderedGraphSettings.height() / 2;
    const worldCenter = getWorldPosFromScreen(
      centerX,
      centerY,
      graphTranslation,
      zoomFactor,
    );
    graph.setViewportTransform(nextZoom, [
      centerX - worldCenter.x * nextZoom,
      centerY - worldCenter.y * nextZoom,
    ]);
    return !hasReachedBoundary;
  }

  function advanceContinuousZoom(frameTimestamp) {
    continuousZoomFrame = undefined;
    if (continuousZoomDirection === 0) {
      return;
    }
    const elapsedMs = Math.min(
      MAXIMUM_FRAME_DURATION_MS,
      Math.max(0, frameTimestamp - continuousZoomPreviousFrameTime),
    );
    continuousZoomPreviousFrameTime = frameTimestamp;
    if (stepContinuousZoom(elapsedMs / NOMINAL_FRAME_DURATION_MS)) {
      continuousZoomFrame = requestAnimationFrame(advanceContinuousZoom);
    } else {
      continuousZoomDirection = 0;
    }
  }

  graph.startContinuousZoom = function (zoomDirection) {
    if (continuousZoomDirection !== 0) {
      return false;
    }
    continuousZoomDirection = zoomDirection > 0 ? 1 : -1;
    continuousZoomPreviousFrameTime = performance.now();
    if (stepContinuousZoom(1)) {
      continuousZoomFrame = requestAnimationFrame(advanceContinuousZoom);
      return true;
    }
    continuousZoomDirection = 0;
    return false;
  };

  graph.stopContinuousZoom = function () {
    if (continuousZoomFrame !== undefined) {
      cancelAnimationFrame(continuousZoomFrame);
      continuousZoomFrame = undefined;
    }
    continuousZoomDirection = 0;
    continuousZoomPreviousFrameTime = undefined;
  };

  // D3 owns transition completion, including interruption by another gesture.
  // Automatic framing also uses these commands without awaiting a result.
  function completeViewportTransition(transition, signal) {
    pendingViewportTransitionCount += 1;
    const interruptTransition = () => transition.selection().interrupt();
    signal?.addEventListener("abort", interruptTransition, { once: true });
    const completion = transition.end().then(
      () => true,
      () => false,
    );
    if (signal?.aborted) {
      interruptTransition();
    }
    return completion.finally(() => {
      pendingViewportTransitionCount -= 1;
      signal?.removeEventListener("abort", interruptTransition);
    });
  }

  graph.setSliderZoom = function (val, { signal } = {}) {
    const targetZoom = viewportTransform.normalizeZoom(
      val,
      renderedGraphSettings.minMagnification(),
      renderedGraphSettings.maxMagnification(),
    );
    if (targetZoom === undefined || !graphContainer) {
      return false;
    }
    const cx = 0.5 * renderedGraphSettings.width();
    const cy = 0.5 * renderedGraphSettings.height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, renderedGraphSettings.height() / zoomFactor];
    const eP = [cp.x, cp.y, renderedGraphSettings.height() / targetZoom];
    const pos_intp = d3.interpolateZoom(sP, eP);

    const transition = graphContainer
      .interrupt()
      .attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(1)
      .attrTween("transform", function () {
        return function (t) {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", function () {
        graphContainer.attr("transform", viewportTransformString());
        syncZoomState();
        reportViewportChanged();
      });
    return completeViewportTransition(transition, signal);
  };

  graph.setViewportTransform = function (scale, translation) {
    if (!updateViewportState(translation, scale)) {
      return false;
    }
    graphContainer?.interrupt().attr("transform", viewportTransformString());
    updateHaloRadius();
    return true;
  };

  graph.panViewport = function ({ xPx, yPx }) {
    if (!graphContainer || !updateViewportState([xPx, yPx], zoomFactor)) {
      return false;
    }
    graphContainer.interrupt().attr("transform", viewportTransformString());
    updateHaloRadius();
    return true;
  };

  graph.options = function () {
    return renderedGraphSettings;
  };

  // Renderer-owned presentation channel. The rendered graph runtime turns these
  // into RenderedGraphEvent values; the renderer never reaches a presentation
  // module directly.
  graph.setRenderedGraphEventPort = function (nextPort) {
    renderedGraphEventPort = { ...renderedGraphEventPort, ...nextPort };
  };

  // Observation comes from the simulation drawing this mount. Node and label
  // occurrence identities are separate from the ontology entities they depict.
  graph.readLayoutState = function () {
    const layoutElementPositions = [
      ...(classNodes ?? []).map((node) => ({
        stableLayoutElementKey: `node:${node.id()}`,
        x: node.x,
        y: node.y,
      })),
      ...(labelNodes ?? []).map((label) => ({
        stableLayoutElementKey: `label:${label.property().id()}`,
        x: label.x,
        y: label.y,
      })),
    ];
    return {
      forceAlpha: force.alpha(),
      hasEnded:
        layoutElementPositions.length === 0 || force.alpha() < force.alphaMin(),
      isPaused: paused,
      observedAtMs: performance.now(),
      widthPx: renderedGraphSettings.width(),
      heightPx: renderedGraphSettings.height(),
      layoutElementPositions,
    };
  };

  graph.readVisibleElementIds = function () {
    return {
      nodeIds: (classNodes ?? []).map((node) => String(node.id())),
      propertyIds: (properties ?? []).map((property) => String(property.id())),
    };
  };

  function arrangedElements() {
    return [
      ...(classNodes ?? []).map((node) => ({
        rendererKey: `node:${node.id()}`,
        element: node,
        position: node,
        kind: "node",
        canMove: true,
        canPin: true,
        rendererElementIds: [String(node.id())],
      })),
      ...(labelNodes ?? []).map((label) => {
        const property = label.property();
        const hasParallelLinks =
          property
            .domain()
            .links()
            .filter((link) => property.range().links().includes(link)).length >
          1;
        return {
          rendererKey: `label:${property.id()}`,
          element: property,
          position: label,
          kind: "property-label",
          canMove: !isSolitaryLabel(label),
          canPin: hasParallelLinks,
          rendererElementIds: [
            String(property.id()),
            ...(property.inverse() ? [String(property.inverse().id())] : []),
          ],
        };
      }),
    ];
  }

  graph.readArrangement = function () {
    return arrangedElements().map(({ element, position, ...description }) => ({
      ...description,
      xPx: position.x,
      yPx: position.y,
      isPinned: element.pinned() === true,
    }));
  };

  graph.applyArrangement = function (changes) {
    const elements = arrangedElements();
    const resolved = changes.map((change) => {
      const occurrence = elements.find(
        (entry) => entry.rendererKey === change.rendererKey,
      );
      if (
        !occurrence ||
        (change.xPx !== undefined && !occurrence.canMove) ||
        (change.isPinned === true && !occurrence.canPin)
      ) {
        throw new RangeError(
          "The drawn occurrence cannot accept this arrangement change.",
        );
      }
      return { change, ...occurrence };
    });
    for (const { change, element, position } of resolved) {
      if (change.xPx !== undefined) {
        position.x = change.xPx;
        position.y = change.yPx;
        position.px = position.x;
        position.py = position.y;
        position.vx = 0;
        position.vy = 0;
      }
      if (
        change.isPinned !== undefined &&
        change.isPinned !== element.pinned()
      ) {
        if (change.isPinned) {
          element.drawPin();
          pickAndPin.addPinnedElement(element);
        } else {
          element.removePin();
        }
      }
      if (element.pinned() || paused) {
        position.fx = position.x;
        position.fy = position.y;
      } else {
        position.fx = null;
        position.fy = null;
      }
    }
    recalculatePositions();
    if (paused) {
      force.stop();
    } else {
      force.alpha(1).restart();
    }
  };

  graph.selectOccurrence = function (rendererKey, { editLabel = false } = {}) {
    const occurrence =
      rendererKey === null
        ? null
        : arrangedElements().find((entry) => entry.rendererKey === rendererKey);
    if (rendererKey !== null && !occurrence) {
      throw new RangeError("The selected occurrence is no longer drawn.");
    }
    focuser.reset();
    if (occurrence) {
      focuser.handle(undefined, occurrence.element, true);
      if (editLabel && editMode) {
        occurrence.element.enableEditing(true);
      }
    } else {
      graph.reportRenderedElementSelection([]);
      graph.removeEditElements();
    }
  };

  graph.isReadyForPaint = function () {
    return Boolean(
      graphContainer &&
      !graphContainer.classed("is-render-pending") &&
      pendingViewportTransitionCount === 0,
    );
  };

  graph.retireRenderGeneration = function () {
    hasActiveRenderInteractions = false;
    renderInteractionEpoch++;
    releaseOwnedMouseGesture(activeMouseDrag);
    releaseOwnedMouseGesture(activeMousePan);
    activeMouseDrag = undefined;
    activeMousePan = undefined;
    force.on("tick.runtimeLayout", null).on("end.runtimeLayout", null).stop();
    graph.stopContinuousZoom();
    const svgRoot = graphContainer?.node()?.parentNode;
    if (svgRoot) {
      d3.select(svgRoot).interrupt().on(".zoom", null);
      d3.select(svgRoot).selectAll("*").on(".drag", null);
    }
    graphContainer?.interrupt();
    graphContainer?.selectAll("*").interrupt();
    clearTimeout(delayedHider);
  };

  graph.clearRenderedGraph = function () {
    renderedGraphSettings.data(undefined);
    unfilteredData = { nodes: [], properties: [] };
    classNodes = [];
    labelNodes = [];
    properties = [];
    force.nodes([]);
    forceLink.links([]);
    graphContainer?.selectAll("*").remove();
    graphContainer?.classed("is-render-pending", false);
  };

  graph.dispose = function () {
    graph.retireRenderGeneration();
  };

  // Renderer-owned warning channel. Element modules raise a bounded code and
  // message here instead of reaching into a presentation module; the rendered
  // graph runtime turns this into a render-warning-raised event.
  graph.raiseRenderWarning = function (warningCode, message) {
    renderedGraphEventPort.publishRenderWarning(warningCode, message);
  };

  // Renderer-owned selection channel. An element reports which drawn nodes are
  // selected using the renderer's own ids; the runtime turns those into
  // ontology element references for the controller.
  graph.reportRenderedElementSelection = function (selectedElementIds) {
    renderedGraphEventPort.publishRenderedElementSelection(
      Array.isArray(selectedElementIds) ? selectedElementIds : [],
    );
  };
  graph.currentRenderInteractionEpoch = function () {
    return renderInteractionEpoch;
  };
  graph.requestRecordLabelEdit = function (
    recordId,
    text,
    deriveIriFromLabel,
    interactionEpoch,
  ) {
    if (
      !hasActiveRenderInteractions ||
      interactionEpoch !== renderInteractionEpoch
    ) {
      return false;
    }
    return renderedGraphEventPort.publishRecordLabelEdit(
      String(recordId),
      text,
      deriveIriFromLabel,
    );
  };
  // search functionality

  graph.language = function (newLanguage) {
    if (!arguments.length) {
      return language;
    }

    // Just update if the language changes
    if (language !== newLanguage) {
      language = newLanguage || "default";
      redrawContent();
      recalculatePositions();

      graph.resetSearchHighlight();
    }
    return graph;
  };

  /** --------------------------------------------------------- **/
  /** graph / rendering  related functions                      **/
  /** --------------------------------------------------------- **/

  let lastExecutedElement = null;
  let lastExecutedTime = 0;
  function executeModules(selectedElement, event, forced) {
    const now = performance.now();
    if (
      lastExecutedElement === selectedElement &&
      now - lastExecutedTime < 300
    ) {
      return;
    }
    lastExecutedElement = selectedElement;
    lastExecutedTime = now;

    focuser.handle(event, selectedElement, forced);
    pickAndPin.handle(event, selectedElement, forced);
  }

  function isSolitaryLabel(d) {
    if (!d) {
      return false;
    }
    let link;
    if (elementTools.isLabel(d) || elementTools.isProperty(d)) {
      link = d.link();
    }
    if (
      link &&
      typeof link.layers === "function" &&
      link.layers() &&
      link.layers().length === 1 &&
      !link.loops()
    ) {
      return true;
    }
    return false;
  }

  function captureMouseGesture(event, namespace) {
    if (event.sourceEvent?.type !== "mousedown") {
      return undefined;
    }
    const view = event.sourceEvent.view;
    const selection = d3.select(view);
    return {
      view,
      namespace,
      move: selection.on(`mousemove.${namespace}`),
      end: selection.on(`mouseup.${namespace}`),
    };
  }

  function releaseOwnedMouseGesture(gesture) {
    if (!gesture) {
      return;
    }
    const { view, namespace, move, end } = gesture;
    const selection = d3.select(view);
    // A different widget may have begun a gesture on this window since ours.
    if (
      selection.on(`mousemove.${namespace}`) === move &&
      selection.on(`mouseup.${namespace}`) === end
    ) {
      selection.on(`mousemove.${namespace} mouseup.${namespace}`, null);
      d3.dragEnable(view);
    }
  }

  function createInteractionBehaviours() {
    let moved = false;
    const interactionEpoch = renderInteractionEpoch;
    const isCurrentInteraction = (element) =>
      hasActiveRenderInteractions &&
      interactionEpoch === renderInteractionEpoch &&
      Boolean(
        graphContainer &&
        (element === graphContainer.node()?.parentNode ||
          graphContainer.node()?.contains(element)),
      );

    dragBehaviour = d3
      .drag()
      .filter(function (event) {
        return isCurrentInteraction(this) && !event.ctrlKey && !event.button;
      })
      .subject(function (d) {
        return d;
      })
      .on("start", function (event, d) {
        if (!isCurrentInteraction(this)) {
          return;
        }
        activeMouseDrag = captureMouseGesture(event, "drag") ?? activeMouseDrag;
        if (isSolitaryLabel(d)) {
          return;
        }
        clearAllHover();
        event.sourceEvent.stopPropagation(); // Prevent panning
        graph.ignoreOtherHoverEvents(true);
        if (d.type && d.type() === "Class_dragger") {
          classDragger.mouseButtonPressed = true;
          clearTimeout(delayedHider);
          classDragger.selectedViaTouch(true);
          d.parentNode().locked(true);
          draggingStarted = true;
        } else if (d.type && d.type() === "Range_dragger") {
          graph.ignoreOtherHoverEvents(true);
          clearTimeout(delayedHider);
          frozenDomainForPropertyDragger = shadowClone.parentNode().domain();
          frozenRangeForPropertyDragger = shadowClone.parentNode().range();
          shadowClone.setInitialPosition();
          shadowClone.hideClone(false);
          shadowClone.hideParentProperty(true);
          shadowClone.updateElement();
          deleteGroupElement.classed("hidden", true);
          addDataPropertyGroupElement.classed("hidden", true);
          frozenDomainForPropertyDragger.frozen(true);
          frozenDomainForPropertyDragger.locked(true);
          frozenRangeForPropertyDragger.frozen(true);
          frozenRangeForPropertyDragger.locked(true);
          domainDragger.updateElement();
          domainDragger.mouseButtonPressed = true;
          rangeDragger.updateElement();
          rangeDragger.mouseButtonPressed = true;
          //  shadowClone.setPosition(d.x, d.y);
        } else if (d.type && d.type() === "Domain_dragger") {
          graph.ignoreOtherHoverEvents(true);
          clearTimeout(delayedHider);
          frozenDomainForPropertyDragger = shadowClone.parentNode().domain();
          frozenRangeForPropertyDragger = shadowClone.parentNode().range();
          shadowClone.setInitialPosition();
          shadowClone.hideClone(false);
          shadowClone.hideParentProperty(true);
          shadowClone.updateElement();
          deleteGroupElement.classed("hidden", true);
          addDataPropertyGroupElement.classed("hidden", true);

          frozenDomainForPropertyDragger.frozen(true);
          frozenDomainForPropertyDragger.locked(true);
          frozenRangeForPropertyDragger.frozen(true);
          frozenRangeForPropertyDragger.locked(true);
          domainDragger.updateElement();
          domainDragger.mouseButtonPressed = true;
          rangeDragger.updateElement();
          rangeDragger.mouseButtonPressed = true;
        } else {
          d.locked(true);
          moved = false;
        }
      })
      .on("drag", function (event, d) {
        if (!isCurrentInteraction(this)) {
          return;
        }
        if (isSolitaryLabel(d)) {
          return;
        }

        if (d.type && d.type() === "Class_dragger") {
          clearTimeout(delayedHider);
          classDragger.setPosition(event.x, event.y);
        } else if (d.type && d.type() === "Range_dragger") {
          clearTimeout(delayedHider);
          rangeDragger.setPosition(event.x, event.y);
          shadowClone.setPosition(event.x, event.y);
          domainDragger.updateElementViaRangeDragger(event.x, event.y);
        } else if (d.type && d.type() === "Domain_dragger") {
          clearTimeout(delayedHider);
          domainDragger.setPosition(event.x, event.y);
          shadowClone.setPositionDomain(event.x, event.y);
          rangeDragger.updateElementViaDomainDragger(event.x, event.y);
        } else {
          d.px = event.x;
          d.py = event.y;
          d.x = event.x;
          d.y = event.y;
          d.fx = event.x;
          d.fy = event.y;
          if (graph.paused() === false) {
            force.alpha(0.3).restart();
          } else {
            recalculatePositions();
          }
          updateHaloRadius();
          moved = true;
          if (d.renderType && d.renderType() === "round") {
            classDragger.setParentNode(d);
            setDeleteHoverElementPosition(d);
            setAddDataPropertyHoverElementPosition(d);
          }
        }
      })
      .on("end", function (event, d) {
        if (!isCurrentInteraction(this)) {
          return;
        }
        if (event.sourceEvent?.type === "mouseup") {
          activeMouseDrag = undefined;
        }
        if (isSolitaryLabel(d)) {
          graph.ignoreOtherHoverEvents(false);
          return;
        }
        graph.ignoreOtherHoverEvents(false);
        if (moved === true) {
          clearAllHover();
        }
        if (d.type && d.type() === "Class_dragger") {
          const nX = classDragger.x;
          const nY = classDragger.y;
          clearTimeout(delayedHider);
          classDragger.mouseButtonPressed = false;
          classDragger.selectedViaTouch(false);
          d.setParentNode(d.parentNode());

          const draggerEndPos = [nX, nY];
          const targetNode = graph.getTargetNode(draggerEndPos);
          if (targetNode) {
            createNewObjectProperty(d.parentNode(), targetNode, draggerEndPos);
          }
          if (touchDevice === false) {
            editElementHoverOut();
          }
          draggingStarted = false;
        } else if (d.type && d.type() === "Range_dragger") {
          graph.ignoreOtherHoverEvents(false);
          frozenDomainForPropertyDragger.frozen(false);
          frozenDomainForPropertyDragger.locked(false);
          frozenRangeForPropertyDragger.frozen(false);
          frozenRangeForPropertyDragger.locked(false);
          rangeDragger.mouseButtonPressed = false;
          domainDragger.mouseButtonPressed = false;
          domainDragger.updateElement();
          rangeDragger.updateElement();
          shadowClone.hideClone(true);
          const rX = rangeDragger.x;
          const rY = rangeDragger.y;
          const rangeDraggerEndPos = [rX, rY];
          let targetRangeNode = graph.getTargetNode(rangeDraggerEndPos);
          if (elementTools.isDatatype(targetRangeNode) === true) {
            targetRangeNode = null;
            console.warn(
              "---------------TARGET NODE IS A DATATYPE/ LITERAL ------------",
            );
          }

          if (targetRangeNode === null) {
            d.reDrawEverthing();
            shadowClone.hideParentProperty(false);
          } else {
            d.updateRange(targetRangeNode);
            graph.update();
            shadowClone.hideParentProperty(false);
          }
        } else if (d.type && d.type() === "Domain_dragger") {
          graph.ignoreOtherHoverEvents(false);
          frozenDomainForPropertyDragger.frozen(false);
          frozenDomainForPropertyDragger.locked(false);
          frozenRangeForPropertyDragger.frozen(false);
          frozenRangeForPropertyDragger.locked(false);
          rangeDragger.mouseButtonPressed = false;
          domainDragger.mouseButtonPressed = false;
          domainDragger.updateElement();
          rangeDragger.updateElement();
          shadowClone.hideClone(true);

          const dX = domainDragger.x;
          const dY = domainDragger.y;
          const domainDraggerEndPos = [dX, dY];
          let targetDomainNode = graph.getTargetNode(domainDraggerEndPos);
          if (elementTools.isDatatype(targetDomainNode) === true) {
            targetDomainNode = null;
            console.warn(
              "---------------TARGET NODE IS A DATATYPE/ LITERAL ------------",
            );
          }
          shadowClone.hideClone(true);
          if (targetDomainNode === null) {
            d.reDrawEverthing();
            shadowClone.hideParentProperty(false);
          } else {
            d.updateDomain(targetDomainNode);
            graph.update();
            shadowClone.hideParentProperty(false);
          }
        } else {
          d.locked(false);
          const pnp = renderedGraphSettings.pickAndPinModule();
          if (moved === true) {
            if (pnp.enabled() === true) {
              if (d.id) {
                // node
                pnp.handle(event, d, true);
              }
              if (d.property) {
                pnp.handle(event, d.property(), true);
              }
            } else {
              d.fx = null;
              d.fy = null;
              if (d.property) {
                d.property().fx = null;
                d.property().fy = null;
                if (d.property().inverse()) {
                  d.property().inverse().fx = null;
                  d.property().inverse().fy = null;
                }
              }
            }
          } else if (moved === false) {
            if (d.id) {
              executeModules(d, event, true);
            }
          }
        }
      });

    // Apply the zooming factor.
    zoom = d3
      .zoom()
      .filter(function (event) {
        return (
          isCurrentInteraction(this) &&
          (!event.ctrlKey || event.type === "wheel") &&
          !event.button
        );
      })
      .scaleExtent([
        renderedGraphSettings.minMagnification(),
        renderedGraphSettings.maxMagnification(),
      ])
      .on("start", function (event) {
        if (!isCurrentInteraction(this)) {
          return;
        }
        activeMousePan = captureMouseGesture(event, "zoom") ?? activeMousePan;
        clearAllHover();
      })
      .on("zoom", function (event) {
        if (isCurrentInteraction(this)) {
          zoomed(event);
        }
      })
      .on("end", function (event) {
        if (
          isCurrentInteraction(this) &&
          event.sourceEvent?.type === "mouseup"
        ) {
          activeMousePan = undefined;
        }
      });
  }

  // Initializes the graph and its first set of native interaction behaviours.
  function initializeGraph() {
    renderedGraphSettings.graphContainerElement(graphContainerElement);
    force = d3.forceSimulation().on("tick", hiddenRecalculatePositions);
    forceLink = d3.forceLink();
    createInteractionBehaviours();
    draggerObjectsArray.push(classDragger);
    draggerObjectsArray.push(rangeDragger);
    draggerObjectsArray.push(domainDragger);
    draggerObjectsArray.push(shadowClone);
    force.stop();
  }

  graph.lazyRefresh = function () {
    redrawContent();
    recalculatePositions();
  };

  function hiddenRecalculatePositions() {
    finishedLoadingSequence = false;
    if (renderedGraphEventPort.isOntologyRenderable() === false) {
      force.stop();
      graph.updateProgressBarMode();
      renderedGraphEventPort.publishRenderWarning(
        "RENDER_POSITIONS_UNAVAILABLE",
        "The rendered graph could not recalculate element positions.",
      );
      return;
    }
    if (updateRenderingDuringSimulation === false) {
      const progress = Math.max(0, Math.min(1, 1.0 - force.alpha()));
      const percentValue = Math.min(100, Math.max(0, parseInt(200 * progress)));
      renderedGraphEventPort.publishRenderProgress(percentValue);

      if (progress >= 0.5) {
        updateRenderingDuringSimulation = true;
        // show graph container;
        if (graphContainer) {
          graphContainer.classed("is-render-pending", false);
          renderedGraphEventPort.publishRenderProgress(100);
        }

        if (initialLoad) {
          if (graph.paused() === false) {
            force.alpha(0.3).restart();
          } // resume force
          initialLoad = false;
        }

        finishedLoadingSequence = true;
        if (showFPS === true) {
          force.on("tick", recalculatePositionsWithFPS);
          recalculatePositionsWithFPS();
        } else {
          force.on("tick", recalculatePositions);
          recalculatePositions();
        }

        if (centerGraphViewOnLoad === true && force.nodes().length > 0) {
          if (force.nodes().length < 10) {
            graph.zoomAndCenterGraph(true);
          } // uses dynamic zoomer;
          else {
            graph.zoomAndCenterGraph();
          }
          centerGraphViewOnLoad = false;
          // console.log("--------------------------------------")
        }

        graph.showEditorHintIfNeeded();

        if (renderedGraphEventPort.hasMissingImports()) {
          renderedGraphEventPort.publishRenderWarning(
            "MISSING_IMPORTS",
            "The ontology was rendered with unresolved imports.",
          );
        }
        renderedGraphEventPort.publishRenderProgress(100);
      }
    }
  }

  graph.showEditorHintIfNeeded = function () {
    if (seenEditorHint === false && editMode === true) {
      seenEditorHint = true;
      renderedGraphEventPort.publishRenderWarning(
        "EDITOR_MODE_HINT",
        "Editor mode is active.",
      );
    }
  };

  graph.setRenderingDiagnosticsEnabled = function (enabled) {
    showFPS = enabled;
    then = Date.now();
    if (force && finishedLoadingSequence === true) {
      force.on(
        "tick",
        enabled ? recalculatePositionsWithFPS : recalculatePositions,
      );
    }
  };
  function recalculatePositionsWithFPS() {
    // compute the fps

    recalculatePositions();
    now = Date.now();
    const diff = now - then;
    const fps = diff > 0 ? Number((1000 / diff).toFixed(2)) : 0;
    renderedGraphEventPort.publishRenderingStatistics({
      framesPerSecond: fps,
      nodeCount: force.nodes().length,
      linkCount: forceLink.links().length,
    });
    then = Date.now();
  }

  function recalculatePositions() {
    let skippedUpdates = 0;

    // Set node positions

    // add switch for edit mode to make this faster;
    if (!editMode) {
      nodeElements.each(function (node) {
        if (!svgRenderingGuard.setTransform(this, node)) {
          skippedUpdates++;
        }
      });

      // Set label group positions
      labelGroupElements.each(function (label) {
        let position;

        // force centered positions on single-layered links
        const link = label.link();
        if (link.layers().length === 1 && !link.loops()) {
          if (
            !svgRenderingGuard.isFinitePoint(link.domain()) ||
            !svgRenderingGuard.isFinitePoint(link.range())
          ) {
            skippedUpdates++;
            return;
          }
          const linkDomainIntersection = math.calculateIntersection(
            link.range(),
            link.domain(),
            0,
          );
          const linkRangeIntersection = math.calculateIntersection(
            link.domain(),
            link.range(),
            0,
          );
          position = math.calculateCenter(
            linkDomainIntersection,
            linkRangeIntersection,
          );
          if (!svgRenderingGuard.isFinitePoint(position)) {
            skippedUpdates++;
            return;
          }
          label.x = position.x;
          label.y = position.y;
        }
        if (!svgRenderingGuard.setTransform(this, label)) {
          skippedUpdates++;
        }
      });
      // Set link paths and calculate additional information
      linkPathElements.each(function (l) {
        const curvePoint = l.label();
        if (l.isLoop()) {
          if (
            !svgRenderingGuard.isFinitePoint(l.domain()) ||
            !svgRenderingGuard.isFinitePoint(curvePoint)
          ) {
            skippedUpdates++;
            return;
          }
          const loopPoints = math.getLoopPoints(l);
          if (
            !svgRenderingGuard.setCurvePath(
              this,
              [loopPoints[0], curvePoint, loopPoints[1]],
              -1,
            )
          ) {
            skippedUpdates++;
          }
          return;
        }
        if (
          !svgRenderingGuard.isFinitePoint(curvePoint) ||
          !svgRenderingGuard.isFinitePoint(l.domain()) ||
          !svgRenderingGuard.isFinitePoint(l.range())
        ) {
          skippedUpdates++;
          return;
        }
        const pathStart = math.calculateIntersection(curvePoint, l.domain(), 1);
        const pathEnd = math.calculateIntersection(curvePoint, l.range(), 1);

        if (
          !svgRenderingGuard.setCurvePath(this, [
            pathStart,
            curvePoint,
            pathEnd,
          ])
        ) {
          skippedUpdates++;
        }
      });

      // Set cardinality positions
      cardinalityElements.each(function (property) {
        const label = property.link().label(),
          range = property.range();
        if (
          !svgRenderingGuard.isFinitePoint(label) ||
          !svgRenderingGuard.isFinitePoint(range)
        ) {
          skippedUpdates++;
          return;
        }
        const pos = math.calculateIntersection(
            label,
            range,
            CARDINALITY_HDISTANCE,
          ),
          normalV = math.calculateNormalVector(
            label,
            range,
            CARDINALITY_VDISTANCE,
          );

        if (!svgRenderingGuard.setTransform(this, pos, normalV)) {
          skippedUpdates++;
        }
      });

      reportInvalidGeometry(skippedUpdates);
      updateHaloRadius();
      return;
    }

    // TODO: this is Editor redraw function // we need to make this faster!!

    nodeElements.each(function (node) {
      if (!svgRenderingGuard.setTransform(this, node)) {
        skippedUpdates++;
      }
    });

    // Set label group positions
    labelGroupElements.each(function (label) {
      let position;

      // force centered positions on single-layered links
      const link = label.link();
      if (link.layers().length === 1 && !link.loops()) {
        if (
          !svgRenderingGuard.isFinitePoint(link.domain()) ||
          !svgRenderingGuard.isFinitePoint(link.range())
        ) {
          skippedUpdates++;
          return;
        }
        const linkDomainIntersection = math.calculateIntersection(
          link.range(),
          link.domain(),
          0,
        );
        const linkRangeIntersection = math.calculateIntersection(
          link.domain(),
          link.range(),
          0,
        );
        position = math.calculateCenter(
          linkDomainIntersection,
          linkRangeIntersection,
        );
        if (
          !svgRenderingGuard.isFinitePoint(linkDomainIntersection) ||
          !svgRenderingGuard.isFinitePoint(linkRangeIntersection) ||
          !svgRenderingGuard.isFinitePoint(position)
        ) {
          skippedUpdates++;
          return;
        }
        label.x = position.x;
        label.y = position.y;
        label.linkRangeIntersection = linkRangeIntersection;
        label.linkDomainIntersection = linkDomainIntersection;
      } else {
        if (
          !svgRenderingGuard.isFinitePoint(label) ||
          !svgRenderingGuard.isFinitePoint(link.domain()) ||
          !svgRenderingGuard.isFinitePoint(link.range())
        ) {
          skippedUpdates++;
          return;
        }
        const linkDomainIntersection = math.calculateIntersection(
          link.label(),
          link.domain(),
          0,
        );
        const linkRangeIntersection = math.calculateIntersection(
          link.label(),
          link.range(),
          0,
        );
        if (
          !svgRenderingGuard.isFinitePoint(linkDomainIntersection) ||
          !svgRenderingGuard.isFinitePoint(linkRangeIntersection)
        ) {
          skippedUpdates++;
          return;
        }
        label.linkDomainIntersection = linkDomainIntersection;
        label.linkRangeIntersection = linkRangeIntersection;
      }
      if (
        link.property().focused() === true ||
        link.property() === hoveredPropertyElement
      ) {
        rangeDragger.updateElement();
        domainDragger.updateElement();
        // shadowClone.setPosition(link.property().range().x,link.property().range().y);
        // shadowClone.setPositionDomain(link.property().domain().x,link.property().domain().y);
      }
      if (!svgRenderingGuard.setTransform(this, label)) {
        skippedUpdates++;
      }
    });
    // Set link paths and calculate additional information
    linkPathElements.each(function (l) {
      const curvePoint = l.label();
      if (l.isLoop()) {
        if (
          !svgRenderingGuard.isFinitePoint(l.domain()) ||
          !svgRenderingGuard.isFinitePoint(curvePoint)
        ) {
          skippedUpdates++;
          return;
        }
        const ptrAr = math.getLoopPoints(l);
        if (
          !svgRenderingGuard.setCurvePath(
            this,
            [ptrAr[0], curvePoint, ptrAr[1]],
            -1,
          )
        ) {
          skippedUpdates++;
          return;
        }
        l.label().linkRangeIntersection = ptrAr[1];
        l.label().linkDomainIntersection = ptrAr[0];

        if (
          l.property().focused() === true ||
          l.property() === hoveredPropertyElement
        ) {
          rangeDragger.updateElement();
          domainDragger.updateElement();
        }
        return;
      }
      if (
        !svgRenderingGuard.isFinitePoint(curvePoint) ||
        !svgRenderingGuard.isFinitePoint(l.domain()) ||
        !svgRenderingGuard.isFinitePoint(l.range())
      ) {
        skippedUpdates++;
        return;
      }
      const pathStart = math.calculateIntersection(curvePoint, l.domain(), 1);
      const pathEnd = math.calculateIntersection(curvePoint, l.range(), 1);
      if (
        !svgRenderingGuard.setCurvePath(this, [pathStart, curvePoint, pathEnd])
      ) {
        skippedUpdates++;
        return;
      }
      l.linkRangeIntersection = pathStart;
      l.linkDomainIntersection = pathEnd;
      if (
        l.property().focused() === true ||
        l.property() === hoveredPropertyElement
      ) {
        domainDragger.updateElement();
        rangeDragger.updateElement();
        // shadowClone.setPosition(l.property().range().x,l.property().range().y);
        // shadowClone.setPositionDomain(l.property().domain().x,l.property().domain().y);
      }
    });

    // Set cardinality positions
    cardinalityElements.each(function (property) {
      const label = property.link().label(),
        range = property.range();
      if (
        !svgRenderingGuard.isFinitePoint(label) ||
        !svgRenderingGuard.isFinitePoint(range)
      ) {
        skippedUpdates++;
        return;
      }
      const pos = math.calculateIntersection(
          label,
          range,
          CARDINALITY_HDISTANCE,
        ),
        normalV = math.calculateNormalVector(
          label,
          range,
          CARDINALITY_VDISTANCE,
        );

      if (!svgRenderingGuard.setTransform(this, pos, normalV)) {
        skippedUpdates++;
      }
    });

    if (hoveredNodeElement) {
      setDeleteHoverElementPosition(hoveredNodeElement);
      setAddDataPropertyHoverElementPosition(hoveredNodeElement);
      if (draggingStarted === false) {
        classDragger.setParentNode(hoveredNodeElement);
      }
    }
    if (hoveredPropertyElement) {
      setDeleteHoverElementPositionProperty(hoveredPropertyElement);
    }

    reportInvalidGeometry(skippedUpdates);
    updateHaloRadius();
  }

  function addClickEvents() {
    nodeElements.on("click", function (event, clickedNode) {
      executeModules(clickedNode, event);

      // manual double clicker // helper for iphone 6 etc...
      if (touchDevice === true && doubletap(event) === true) {
        event.stopPropagation();
        if (editMode === true) {
          clickedNode.raiseDoubleClickEdit(defaultIriValue(clickedNode));
        }
      }
    });

    nodeElements.on("dblclick", function (event, clickedNode) {
      event.stopPropagation();
      if (editMode === true) {
        clickedNode.raiseDoubleClickEdit(defaultIriValue(clickedNode));
      }
    });

    labelGroupElements
      .selectAll(".label")
      .on("click", function (event, clickedProperty) {
        executeModules(clickedProperty, event);

        // this is for enviroments that do not define dblClick function;
        if (touchDevice === true && doubletap(event) === true) {
          event.stopPropagation();
          if (editMode === true) {
            clickedProperty.raiseDoubleClickEdit(
              defaultIriValue(clickedProperty),
            );
          }
        }

        // currently removed the selection of an element to invoke the dragger
        // if (editMode===true && clickedProperty.editingTextElement!==true) {
        //     return;
        //      // We say that Datatype properties are not allowed to have domain range draggers
        //      if (clickedProperty.focused() && clickedProperty.type() !== "owl:DatatypeProperty") {
        //          shadowClone.setParentProperty(clickedProperty);
        //          rangeDragger.setParentProperty(clickedProperty);
        //          rangeDragger.hideDragger(false);
        //          rangeDragger.addMouseEvents();
        //          domainDragger.setParentProperty(clickedProperty);
        //          domainDragger.hideDragger(false);
        //          domainDragger.addMouseEvents();
        //
        //          if (clickedProperty.domain()===clickedProperty.range()){
        //              clickedProperty.labelObject().increasedLoopAngle=true;
        //              recalculatePositions();
        //
        //          }
        //
        //      } else if (clickedProperty.focused() && clickedProperty.type() === "owl:DatatypeProperty") {
        //          shadowClone.setParentProperty(clickedProperty);
        //          rangeDragger.setParentProperty(clickedProperty);
        //          rangeDragger.hideDragger(true);
        //          rangeDragger.addMouseEvents();
        //          domainDragger.setParentProperty(clickedProperty);
        //          domainDragger.hideDragger(false);
        //          domainDragger.addMouseEvents();
        //
        //      }
        //      else {
        //          rangeDragger.hideDragger(true);
        //          domainDragger.hideDragger(true);
        //          if (clickedProperty.domain()===clickedProperty.range()){
        //              clickedProperty.labelObject().increasedLoopAngle=false;
        //              recalculatePositions();
        //
        //          }
        //      }
        //  }
      });
    labelGroupElements
      .selectAll(".label")
      .on("dblclick", function (event, clickedProperty) {
        event.stopPropagation();
        if (editMode === true) {
          clickedProperty.raiseDoubleClickEdit(
            defaultIriValue(clickedProperty),
          );
        }
      });
  }

  function defaultIriValue(element) {
    // get the iri of that element;
    if (ontologyEditingState.getGeneralMetaObject().iri) {
      const str2Compare =
        ontologyEditingState.getGeneralMetaObject().iri + element.id();
      return element.iri() === str2Compare;
    }
    return false;
  }

  /** Adjusts the containers current scale and position. */
  function zoomed(event) {
    if (forceNotZooming === true) {
      syncZoomState();
      return;
    }

    let zoomEventByMWheel = false;
    if (event.sourceEvent) {
      if (event.sourceEvent.deltaY) {
        zoomEventByMWheel = true;
      }
    }
    if (zoomEventByMWheel === false) {
      if (transformAnimation === true) {
        return;
      }
      if (
        !event.transform ||
        !updateViewportState(
          [event.transform.x, event.transform.y],
          event.transform.k,
          false,
        )
      ) {
        syncZoomState();
        return;
      }
      graphContainer.attr("transform", viewportTransformString());
      updateHaloRadius();
      reportViewportChanged();
      return;
    }
    /** animate the transition **/
    if (
      !event.transform ||
      !updateViewportState(
        [event.transform.x, event.transform.y],
        event.transform.k,
        false,
      )
    ) {
      syncZoomState();
      return;
    }
    graphContainer
      .transition()
      .tween("attr.translate", function () {
        return function (t) {
          transformAnimation = true;
          const svgNode = graphContainer.node()
            ? graphContainer.node().parentNode
            : null;
          if (svgNode && svgNode.__zoom) {
            updateViewportState(
              [svgNode.__zoom.x, svgNode.__zoom.y],
              svgNode.__zoom.k,
              false,
            );
          } else {
            // fallback: parse from attribute
            const transformAttr = graphContainer.attr("transform") || "";
            const matchTranslate = transformAttr.match(
              /translate\(([^,)]+)[,\s]+([^)]+)\)/,
            );
            const matchScale = transformAttr.match(/scale\(([^)]+)\)/);
            if (matchTranslate) {
              const parsedScale = matchScale
                ? parseFloat(matchScale[1])
                : zoomFactor;
              updateViewportState(
                [parseFloat(matchTranslate[1]), parseFloat(matchTranslate[2])],
                parsedScale,
                false,
              );
            }
          }
          updateHaloRadius();
          reportViewportChanged();
        };
      })
      .on("end interrupt cancel", function () {
        transformAnimation = false;
      })
      .attr("transform", viewportTransformString())
      .ease(d3.easeLinear)
      .duration(250);
  } // end of zoomed function

  function redrawGraph() {
    remove();

    graphContainer = d3
      .select(renderedGraphSettings.graphContainerElement())
      .append("svg")
      .classed("vowlGraph", true)
      .attr("width", renderedGraphSettings.width())
      .attr("height", renderedGraphSettings.height())
      .append("g");
    bindViewportInteractions();
  }

  function bindViewportInteractions() {
    const svgGraph = d3.select(graphContainer.node().parentNode).call(zoom);
    svgGraph.on("mouseleave", clearAllHover);
    svgGraph.on("pointerleave", clearAllHover);
    originalD3_dblClickFunction = svgGraph.on("dblclick.zoom");
    originalD3_touchZoomFunction = svgGraph.on("touchstart.zoom");
    if (originalD3_touchZoomFunction) {
      svgGraph.on("touchstart.zoom", touchzoomed);
    }
    if (editMode === true) {
      svgGraph.on("dblclick.zoom", graph.modified_dblClickFunction);
    } else {
      svgGraph.on("dblclick.zoom", originalD3_dblClickFunction);
    }
  }

  function generateEditElements() {
    addDataPropertyGroupElement = editContainer
      .append("g")
      .classed("hidden-in-export", true)
      .classed("hidden", true)
      .classed("addDataPropertyElement", true)
      .attr("transform", "translate(" + 0 + "," + 0 + ")");

    addDataPropertyGroupElement
      .append("circle")
      // .classed("deleteElement", true)
      .attr("r", 12)
      .attr("cx", 0)
      .attr("cy", 0)
      .append("title")
      .text("Add Datatype Property");

    addDataPropertyGroupElement
      .append("line")
      // .classed("deleteElementIcon ",true)
      .attr("x1", -8)
      .attr("y1", 0)
      .attr("x2", 8)
      .attr("y2", 0)
      .append("title")
      .text("Add Datatype Property");

    addDataPropertyGroupElement
      .append("line")
      // .classed("deleteElementIcon",true)
      .attr("x1", 0)
      .attr("y1", -8)
      .attr("x2", 0)
      .attr("y2", 8)
      .append("title")
      .text("Add Datatype Property");

    if (renderedGraphSettings.useAccuracyHelper()) {
      addDataPropertyGroupElement
        .append("circle")
        .attr("r", 15)
        .attr("cx", -7)
        .attr("cy", 7)
        .classed("superHiddenElement", true)
        .classed(
          "superOpacityElement",
          !renderedGraphSettings.showDraggerObject(),
        );
    }

    deleteGroupElement = editContainer
      .append("g")
      .classed("hidden-in-export", true)
      .classed("hidden", true)
      .classed("deleteParentElement", true)
      .attr("transform", "translate(" + 0 + "," + 0 + ")");

    deleteGroupElement
      .append("circle")
      .attr("r", 12)
      .attr("cx", 0)
      .attr("cy", 0)
      .append("title")
      .text("Delete This Node");

    const crossLen = 5;
    deleteGroupElement
      .append("line")
      .attr("x1", -crossLen)
      .attr("y1", -crossLen)
      .attr("x2", crossLen)
      .attr("y2", crossLen)
      .append("title")
      .text("Delete This Node");

    deleteGroupElement
      .append("line")
      .attr("x1", crossLen)
      .attr("y1", -crossLen)
      .attr("x2", -crossLen)
      .attr("y2", crossLen)
      .append("title")
      .text("Delete This Node");

    if (renderedGraphSettings.useAccuracyHelper()) {
      deleteGroupElement
        .append("circle")
        .attr("r", 15)
        .attr("cx", 7)
        .attr("cy", -7)
        .classed("superHiddenElement", true)
        .classed(
          "superOpacityElement",
          !renderedGraphSettings.showDraggerObject(),
        );
    }
  }

  graph.getPropertyDataForTtlExport = function () {
    const propertyData = [];
    const allProperties = unfilteredData.properties;
    for (let i = 0; i < allProperties.length; i++) {
      // currently using only the object properties
      if (
        allProperties[i].type() === "owl:ObjectProperty" ||
        allProperties[i].type() === "owl:DatatypeProperty" ||
        allProperties[i].type() === "owl:ObjectProperty"
      ) {
        propertyData.push(allProperties[i]);
      } else {
        if (allProperties[i].type() === "rdfs:subClassOf") {
          allProperties[i].baseIri("http://www.w3.org/2000/01/rdf-schema#");
          allProperties[i].iri(
            "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          );
        }
        if (allProperties[i].type() === "owl:disjointWith") {
          allProperties[i].baseIri("http://www.w3.org/2002/07/owl#");
          allProperties[i].iri("http://www.w3.org/2002/07/owl#disjointWith");
        }
      }
    }
    return propertyData;
  };

  graph.getUnfilteredData = function () {
    return unfilteredData;
  };

  graph.getClassDataForTtlExport = function () {
    const allNodes = unfilteredData.nodes;
    const nodeData = [];
    for (let i = 0; i < allNodes.length; i++) {
      if (
        allNodes[i].type() !== "rdfs:Literal" &&
        allNodes[i].type() !== "rdfs:Datatype" &&
        allNodes[i].type() !== "owl:Thing"
      ) {
        nodeData.push(allNodes[i]);
      }
    }
    return nodeData;
  };

  function redrawContent() {
    let markerContainer;

    if (!graphContainer) {
      return;
    }

    // Empty the graph container
    graphContainer.selectAll("*").remove();

    // Last container -> elements of this container overlap others
    linkContainer = graphContainer.append("g").classed("linkContainer", true);
    cardinalityContainer = graphContainer
      .append("g")
      .classed("cardinalityContainer", true);
    labelContainer = graphContainer.append("g").classed("labelContainer", true);
    nodeContainer = graphContainer.append("g").classed("nodeContainer", true);

    // adding editing Elements
    const draggerPathLayer = graphContainer
      .append("g")
      .classed("linkContainer", true);
    draggerLayer = graphContainer.append("g").classed("editContainer", true);
    editContainer = graphContainer.append("g").classed("editContainer", true);

    draggerPathLayer.classed("hidden-in-export", true);
    editContainer.classed("hidden-in-export", true);
    draggerLayer.classed("hidden-in-export", true);

    // Add an extra container for all markers
    markerContainer = linkContainer.append("defs");
    const drElement = draggerLayer
      .selectAll(".node")
      .data(draggerObjectsArray)
      .enter()
      .append("g")
      .classed("node", true)
      .classed("hidden-in-export", true)
      .attr("id", function (d) {
        return d.id();
      })
      .call(dragBehaviour);
    drElement.each(function (node) {
      node.svgRoot(d3.select(this));
      node.svgPathLayer(draggerPathLayer);
      if (node.type() === "shadowClone") {
        node.drawClone();
        node.hideClone(true);
      } else {
        node.drawNode();
        node.hideDragger(true);
      }
    });
    generateEditElements();

    // Add an extra container for all markers
    markerContainer = linkContainer.append("defs");

    // Draw nodes

    if (classNodes === undefined) {
      classNodes = [];
    }

    nodeElements = nodeContainer
      .selectAll(".node")
      .data(classNodes)
      .enter()
      .append("g")
      .classed("node", true)
      .attr("id", function (d) {
        return d.id();
      })
      .call(dragBehaviour);
    nodeElements.each(function (node) {
      node.draw(d3.select(this));
    });

    if (labelNodes === undefined) {
      labelNodes = [];
    }

    // Draw label groups (property + inverse)
    labelGroupElements = labelContainer
      .selectAll(".labelGroup")
      .data(labelNodes)
      .enter()
      .append("g")
      .classed("labelGroup", true)
      .call(dragBehaviour);

    labelGroupElements.each(function (label) {
      const success = label.draw(d3.select(this));
      label.property().labelObject(label);
      // Remove empty groups without a label.
      if (!success) {
        d3.select(this).remove();
      }
    });
    // Place subclass label groups on the bottom of all labels
    labelGroupElements.each(function (label) {
      // the label might be hidden e.g. in compact notation
      if (!this.parentNode) {
        return;
      }

      if (elementTools.isRdfsSubClassOf(label.property())) {
        const parentNode = this.parentNode;
        parentNode.insertBefore(this, parentNode.firstChild);
      }
    });
    if (properties === undefined) {
      properties = [];
    }
    // Draw cardinality elements
    cardinalityElements = cardinalityContainer
      .selectAll(".cardinality")
      .data(properties)
      .enter()
      .append("g")
      .classed("cardinality", true);

    cardinalityElements.each(function (property) {
      const success = property.drawCardinality(d3.select(this));

      // Remove empty groups without a label.
      if (!success) {
        d3.select(this).remove();
      }
    });
    // Draw links
    if (links === undefined) {
      links = [];
    }
    linkGroups = linkContainer
      .selectAll(".link")
      .data(links)
      .enter()
      .append("g")
      .classed("link", true);

    linkGroups.each(function (link) {
      link.draw(d3.select(this), markerContainer);
    });
    linkPathElements = linkGroups.selectAll("path");
    // Select the path for direct access to receive a better performance
    addClickEvents();
  }

  function remove() {
    if (graphContainer) {
      // Select the parent element because the graph container is a group (e.g. for zooming)
      d3.select(graphContainer.node().parentNode).remove();
    }
  }

  initializeGraph(); // << call the initialization function

  graph.resizeViewport = function (viewport) {
    renderedGraphSettings.width(viewport.widthPx);
    renderedGraphSettings.height(viewport.heightPx);
    occludedLeftWidthPx = viewport.occludedLeftWidthPx;
    touchDevice = viewport.isTouchDevice;
    if (!hasMeasuredViewport && viewport.widthPx > 0 && viewport.heightPx > 0) {
      defaultZoom = Math.min(viewport.widthPx, viewport.heightPx) / 1000;
      hasMeasuredViewport = true;
    }
    if (graphContainer?.node()) {
      const svgElement = d3.select(graphContainer.node().parentNode);
      svgElement.attr("width", renderedGraphSettings.width());
      svgElement.attr("height", renderedGraphSettings.height());
      graphContainer.attr("transform", viewportTransformString());
      graph.updateStyle();
    }

    return {
      width: renderedGraphSettings.width(),
      height: renderedGraphSettings.height(),
    };
  };

  graph.initializeSvgRoot = function () {
    force.stop();
    redrawGraph();
  };

  // The charge a force simulation needs is derived from the distances it is
  // laying out, so the derivation lives here rather than in the control that
  // asks for a distance. The control states a distance; the renderer decides
  // what that means for the simulation.
  const DEFAULT_FORCE_LAYOUT_CHARGE = renderedGraphSettings.charge();
  const DEFAULT_CLASS_DISTANCE_PX = renderedGraphSettings.classDistance();

  graph.setForceLayoutDistances = function (requestedDistances) {
    if (requestedDistances.classDistancePx !== undefined) {
      renderedGraphSettings.classDistance(requestedDistances.classDistancePx);
    }
    if (requestedDistances.datatypeDistancePx !== undefined) {
      renderedGraphSettings.datatypeDistance(
        requestedDistances.datatypeDistancePx,
      );
    }
    if (requestedDistances.loopDistancePx !== undefined) {
      renderedGraphSettings.loopDistance(requestedDistances.loopDistancePx);
    }
    const greatestDistance = Math.max(
      renderedGraphSettings.classDistance(),
      renderedGraphSettings.datatypeDistance(),
    );
    renderedGraphSettings.charge(
      (DEFAULT_FORCE_LAYOUT_CHARGE * greatestDistance) /
        DEFAULT_CLASS_DISTANCE_PX,
    );
    graph.updateStyle();
  };

  // A reader asking for a reset states an intent; deciding what the
  // visualization returns to is the renderer's business, which is why the
  // charge, gravity and link strength appear here and in no request shape.
  graph.resetVisualization = function () {
    graph.resetSearchHighlight();
    focuser.reset();
    renderedGraphSettings.charge(RENDERED_GRAPH_CONFIGURATION_DEFAULTS.charge);
    renderedGraphSettings.gravity(
      RENDERED_GRAPH_CONFIGURATION_DEFAULTS.gravity,
    );
    renderedGraphSettings.linkStrength(
      RENDERED_GRAPH_CONFIGURATION_DEFAULTS.linkStrength,
    );
    // The runtime applies shared distance defaults after this native reset.
    graph.reset();
  };

  graph.updateStyle = function () {
    refreshGraphStyle();
    if (
      renderedGraphEventPort.isOntologyRenderable() === false ||
      paused === true
    ) {
      force.stop();
    } else {
      force.alpha(1).restart();
    }
  };

  graph.load = function (
    loadGeneration,
    { language: initialLanguage, isPaused, centerViewport = true } = {},
  ) {
    if (initialLanguage !== undefined) {
      language = initialLanguage;
    }
    if (isPaused !== undefined) {
      paused = isPaused;
    }
    // Native drag/zoom closures retain active gesture bookkeeping. Each mount
    // owns fresh behaviours after the previous mount released its listeners.
    hasActiveRenderInteractions = true;
    createInteractionBehaviours();
    redrawGraph();
    const publishLayoutState = () =>
      renderedGraphEventPort.publishGraphLayoutState(
        loadGeneration,
        graph.readLayoutState(),
      );
    force
      .on("tick.runtimeLayout", publishLayoutState)
      .on("end.runtimeLayout", publishLayoutState);
    force.stop();
    loadGraphData(false, centerViewport);
    refreshGraphData();
    for (let i = 0; i < labelNodes.length; i++) {
      const label = labelNodes[i];
      if (label.property().x && label.property().y) {
        label.x = label.property().x;
        label.y = label.property().y;
        // also set the prev position of the label
        label.px = label.x;
        label.py = label.y;
      }
    }
    graph.update();
    if (paused) {
      // Pausing retains the arrangement; the new SVG can be drawn without
      // waiting for an optimization tick that the reader has stopped.
      updateRenderingDuringSimulation = true;
      initialLoad = false;
      finishedLoadingSequence = true;
      graphContainer.classed("is-render-pending", false);
      force.on(
        "tick",
        showFPS ? recalculatePositionsWithFPS : recalculatePositions,
      );
      renderedGraphEventPort.publishRenderProgress(100);
      if (centerGraphViewOnLoad && force.nodes().length > 0) {
        centerGraphViewOnLoad = false;
        graph.zoomAndCenterGraph();
      }
    }
  };

  graph.applyVowlModelRevision = function (vowlModel) {
    // Keep the mounted viewport and load generation. Parsing a document
    // revision must not enter the initial loading/centering sequence.
    const previousNodeIds = new Set(
      unfilteredData.nodes.map((node) => node.id()),
    );
    const previousPropertyIds = new Set(
      unfilteredData.properties.map((property) => property.id()),
    );
    const visibleNodeIds = new Set(classNodes.map((node) => node.id()));
    const visiblePropertyIds = new Set(
      properties.map((property) => property.id()),
    );
    parser.parse(vowlModel);
    // Old inputs and gestures belong to retired elements, even though the
    // ontology load and its viewport remain current.
    renderInteractionEpoch++;
    releaseOwnedMouseGesture(activeMouseDrag);
    releaseOwnedMouseGesture(activeMousePan);
    activeMouseDrag = undefined;
    activeMousePan = undefined;
    createInteractionBehaviours();
    bindViewportInteractions();
    clearAllHover();
    removeEditElements();
    renderedGraphSettings.data(vowlModel);
    unfilteredData = { nodes: parser.nodes(), properties: parser.properties() };
    refreshOntologyMetadata();
    renderedGraphSettings
      .nodeDegreeFilter()
      .minDegree(renderedGraphSettings.nodeDegreeFilter().minDegree());
    let initializationData = _.clone(unfilteredData);
    renderedGraphSettings.filterModules().forEach(function (module) {
      initializationData = filterFunction(module, initializationData, true);
    });
    generateDictionary(unfilteredData);
    // Existing editing adds new elements directly to the visible drawing.
    // Reapplying source-load filters here would immediately hide an isolated
    // Thing or any new class while a positive collapsing degree is selected.
    classNodes = unfilteredData.nodes.filter(
      (node) =>
        visibleNodeIds.has(node.id()) || !previousNodeIds.has(node.id()),
    );
    properties = unfilteredData.properties.filter(
      (property) =>
        visiblePropertyIds.has(property.id()) ||
        !previousPropertyIds.has(property.id()),
    );
    refreshLinksAndLabels();
    drawCurrentGraphData();
  };

  function updateNodeMap() {
    nodeMap = [];
    let node;
    for (let j = 0; j < force.nodes().length; j++) {
      node = force.nodes()[j];
      if (node.id) {
        nodeMap[node.id()] = j;
        // check for equivalents
        const eqs = node.equivalents();
        if (eqs.length > 0) {
          for (let e = 0; e < eqs.length; e++) {
            const eqObject = eqs[e];
            nodeMap[eqObject.id()] = j;
          }
        }
      }
      if (node.property) {
        nodeMap[node.property().id()] = j;
        const inverse = node.inverse();
        if (inverse) {
          nodeMap[inverse.id()] = j;
        }
      }
    }
  }

  function updateHaloStyles() {
    let haloElement;
    let halo;
    let node;
    for (let j = 0; j < force.nodes().length; j++) {
      node = force.nodes()[j];
      if (node.id) {
        haloElement = node.getHalos();
        if (haloElement) {
          halo = haloElement.selectAll(".searchResultA");
          halo.classed("searchResultA", false);
          halo.classed("searchResultB", true);
        }
      }

      if (node.property) {
        haloElement = node.property().getHalos();
        if (haloElement) {
          halo = haloElement.selectAll(".searchResultA");
          halo.classed("searchResultA", false);
          halo.classed("searchResultB", true);
        }
      }
    }
  }

  // Updates the graphs displayed data and style.
  graph.update = function (init) {
    clearAllHover();
    const validOntology = renderedGraphEventPort.isOntologyRenderable();
    if (validOntology === false && init && init === true) {
      return;
    }
    if (validOntology === false) {
      return;
    }

    refreshGraphData();
    drawCurrentGraphData();
  };

  function drawCurrentGraphData() {
    // update node map
    updateNodeMap();

    force.alpha(1).restart();
    redrawContent();
    graph.updatePulseIds(nodeArrayForPulse);
    refreshGraphStyle();
    updateHaloStyles();
    // Rebuilding the SVG must draw the current arrangement immediately. A
    // paused graph has no future force tick to position its new elements.
    recalculatePositions();
    if (paused) {
      force.stop();
    }
  }

  graph.paused = function (p) {
    if (!arguments.length) {
      return paused;
    }
    paused = p;
    // Resuming re-energises the layout on purpose. A reader who drags an
    // element while the graph is paused expects it to relax back into place
    // when they resume, which needs alpha, not merely a restarted timer.
    graph.updateStyle();
    return graph;
  };
  graph.reset = function () {
    // window size
    const w = 0.5 * renderedGraphSettings.width();
    const h = 0.5 * renderedGraphSettings.height();
    // computing initial translation for the graph due tue the dynamic default zoom level
    const tx = w - defaultZoom * w;
    const ty = h - defaultZoom * h;
    updateViewportState([tx, ty], defaultZoom);
    graphContainer
      ?.interrupt()
      .attr(
        "transform",
        viewportTransform.toSvgTransform(defaultZoom, [tx, ty]),
      );
  };

  /** --------------------------------------------------------- **/
  /** -- data related handling                               -- **/
  /** --------------------------------------------------------- **/

  // removes data when data could not be loaded
  graph.clearGraphData = function () {
    force.stop();

    if (graphContainer) {
      redrawGraph();
    }
  };

  function generateDictionary(data) {
    let i;
    const originalDictionary = [];
    const nodes = data.nodes;
    for (i = 0; i < nodes.length; i++) {
      // check if node has a label
      if (nodes[i].labelForCurrentLanguage() !== undefined) {
        originalDictionary.push(nodes[i]);
      }
    }
    const props = data.properties;
    for (i = 0; i < props.length; i++) {
      if (props[i].labelForCurrentLanguage() !== undefined) {
        originalDictionary.push(props[i]);
      }
    }
    parser.setDictionary(originalDictionary);

    const literFilter = renderedGraphSettings.literalFilter();
    const idsToRemove = literFilter.removedNodes();
    const originalDict = parser.getDictionary();
    const newDict = [];

    // go through the dictionary and remove the ids;
    for (i = 0; i < originalDict.length; i++) {
      const dictElement = originalDict[i];
      let dictElementId;
      if (dictElement.property) {
        dictElementId = dictElement.property().id();
      } else {
        dictElementId = dictElement.id();
      }
      // compare against the removed ids;
      let addToDictionary = true;
      for (let j = 0; j < idsToRemove.length; j++) {
        const currentId = idsToRemove[j];
        if (currentId === dictElementId) {
          addToDictionary = false;
        }
      }
      if (addToDictionary === true) {
        newDict.push(dictElement);
      }
    }
    // tell the parser that the dictionary is updated
    parser.setDictionary(newDict);
  }

  graph.updateProgressBarMode = function () {
    // Progress presentation is controller-owned; the renderer only reports
    // progress through its event port.
  };

  function loadGraphData(init, centerViewport = true) {
    // reset the locate button and previously selected locations and other variables

    force.stop();

    force.nodes([]);
    forceLink.links([]);
    force.force("link", forceLink);
    nodeArrayForPulse = [];
    pulseNodeIds = [];
    locationId = 0;

    graph.clearGraphData();

    if (init) {
      force.stop();
      return;
    }

    seenEditorHint = false;
    parser.parse(renderedGraphSettings.data());
    unfilteredData = {
      nodes: parser.nodes(),
      properties: parser.properties(),
    };
    // fixing class and property id counter for the editor
    eN = unfilteredData.nodes.length + 1;
    eP = unfilteredData.properties.length + 1;

    // using the ids of elements if to ensure that loaded elements will not get the same id;
    for (let p = 0; p < unfilteredData.properties.length; p++) {
      const currentId = unfilteredData.properties[p].id();
      if (currentId.indexOf("objectProperty") !== -1) {
        // could be ours;
        const idStr = currentId.split("objectProperty");
        if (idStr[0].length === 0) {
          const idInt = parseInt(idStr[1]);
          if (eP < idInt) {
            eP = idInt + 1;
          }
        }
      }
    }
    // using the ids of elements if to ensure that loaded elements will not get the same id;
    for (let n = 0; n < unfilteredData.nodes.length; n++) {
      const currentId_Nodes = unfilteredData.nodes[n].id();
      if (currentId_Nodes.indexOf("Class") !== -1) {
        // could be ours;
        const idStr_Nodes = currentId_Nodes.split("Class");
        if (idStr_Nodes[0].length === 0) {
          const idInt_Nodes = parseInt(idStr_Nodes[1]);
          if (eN < idInt_Nodes) {
            eN = idInt_Nodes + 1;
          }
        }
      }
    }

    initialLoad = true;

    // loading handler
    updateRenderingDuringSimulation = true;
    const validOntology = renderedGraphEventPort.isOntologyRenderable();
    if (graphContainer && validOntology === true) {
      updateRenderingDuringSimulation = false;
      renderedGraphEventPort.publishRenderProgress(0);

      if (unfilteredData.nodes.length > 0) {
        graphContainer.classed("is-render-pending", true);
        force.on("tick", hiddenRecalculatePositions);
      } else {
        graphContainer.classed("is-render-pending", false);
        if (showFPS === true) {
          force.on("tick", recalculatePositionsWithFPS);
        } else {
          force.on("tick", recalculatePositions);
        }
        renderedGraphEventPort.publishRenderProgress(100);
        if (renderedGraphEventPort.hasMissingImports()) {
          renderedGraphEventPort.publishRenderWarning(
            "MISSING_IMPORTS",
            "The ontology was rendered with unresolved imports.",
          );
        }
      }

      force.alpha(1).restart();
    } else {
      force.stop();
      renderedGraphEventPort.publishRenderWarning(
        "RENDER_FAILED",
        "The ontology could not be rendered.",
      );
    }
    refreshOntologyMetadata();
    // Initialize filters with data to replicate consecutive filtering.
    let initializationData = _.clone(unfilteredData);
    renderedGraphSettings.filterModules().forEach(function (module) {
      initializationData = filterFunction(module, initializationData, true);
    });
    generateDictionary(unfilteredData);
    centerGraphViewOnLoad = centerViewport;
  }

  function refreshOntologyMetadata() {
    ontologyEditingState.clearMetaObject();
    ontologyEditingState.clearGeneralMetaObject();
    if (renderedGraphSettings.data() !== undefined) {
      const header = renderedGraphSettings.data().header;
      if (header) {
        if (header.iri) {
          ontologyEditingState.addOrUpdateGeneralObjectEntry("iri", header.iri);
        }
        if (header.title) {
          ontologyEditingState.addOrUpdateGeneralObjectEntry(
            "title",
            header.title,
          );
        }
        if (header.author) {
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry("author", header.author);
        }
        if (header.version) {
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry("version", header.version);
        }
        if (header.description) {
          graph
            .ontologyEditingState()
            .addOrUpdateGeneralObjectEntry("description", header.description);
        }
        if (header.prefixList) {
          const pL = header.prefixList;
          for (const pr in pL) {
            if (Object.prototype.hasOwnProperty.call(pL, pr)) {
              const val = pL[pr];
              ontologyEditingState.addPrefix(pr, val);
            }
          }
        }
        // get other metadata;
        if (header.other) {
          const otherObjects = header.other;
          for (const name in otherObjects) {
            if (Object.prototype.hasOwnProperty.call(otherObjects, name)) {
              const otherObj = otherObjects[name];
              if (
                Object.prototype.hasOwnProperty.call(otherObj, "identifier") &&
                Object.prototype.hasOwnProperty.call(otherObj, "value")
              ) {
                graph
                  .ontologyEditingState()
                  .addOrUpdateMetaObjectEntry(
                    otherObj.identfier,
                    otherObj.value,
                  );
              }
            }
          }
        }
      }
    }
  }

  //Applies the data of the graph options object and parses it. The graph is not redrawn.
  function refreshGraphData() {
    const shouldExecuteEmptyFilter = renderedGraphSettings
      .literalFilter()
      .enabled();
    graph.executeEmptyLiteralFilter();
    renderedGraphSettings.literalFilter().enabled(shouldExecuteEmptyFilter);

    let preprocessedData = _.clone(unfilteredData);

    // Filter the data
    renderedGraphSettings.filterModules().forEach(function (module) {
      preprocessedData = filterFunction(module, preprocessedData);
    });
    renderedGraphSettings.focuserModule().handle(null, undefined, true);
    classNodes = preprocessedData.nodes;
    properties = preprocessedData.properties;
    refreshLinksAndLabels();
  }

  function refreshLinksAndLabels() {
    links = linkCreator.createLinks(properties);
    labelNodes = links.map(function (link) {
      return link.label();
    });
    storeLinksOnNodes(classNodes, links);
    setForceLayoutData(classNodes, labelNodes, links);
    // for (var i = 0; i < classNodes.length; i++) {
    //     if (classNodes[i].setRectangularRepresentation)
    //         classNodes[i].setRectangularRepresentation(renderedGraphSettings.rectangularRepresentation());
    // }
  }

  function filterFunction(module, data, initializing) {
    links = linkCreator.createLinks(data.properties);
    storeLinksOnNodes(data.nodes, links);

    if (initializing) {
      if (module.initialize) {
        module.initialize(data.nodes, data.properties);
      }
    }
    module.filter(data.nodes, data.properties);
    return {
      nodes: module.filteredNodes(),
      properties: module.filteredProperties(),
    };
  }

  /** --------------------------------------------------------- **/
  /** -- force-layout related functions                      -- **/
  /** --------------------------------------------------------- **/
  function storeLinksOnNodes(nodes, links) {
    for (let i = 0, nodesLength = nodes.length; i < nodesLength; i++) {
      const node = nodes[i],
        connectedLinks = [];

      // look for properties where this node is the domain or range
      for (let j = 0, linksLength = links.length; j < linksLength; j++) {
        const link = links[j];

        if (link.domain() === node || link.range() === node) {
          connectedLinks.push(link);
        }
      }
      node.links(connectedLinks);
    }
  }

  function setForceLayoutData(classNodes, labelNodes, links) {
    let d3Links = [];
    links.forEach(function (link) {
      d3Links = d3Links.concat(link.linkParts());
    });

    const d3Nodes = [].concat(classNodes).concat(labelNodes);
    setPositionOfOldLabelsOnNewLabels(force.nodes(), labelNodes);

    force.nodes(d3Nodes);
    forceLink.links(d3Links);
    force.force("link", forceLink);
  }

  // The label nodes are positioned randomly, because they are created from scratch if the data changes and lose
  // their position information. With this hack the position of old labels is copied to the new labels.
  function setPositionOfOldLabelsOnNewLabels(oldLabelNodes, labelNodes) {
    labelNodes.forEach(function (labelNode) {
      if (Number.isFinite(labelNode.x) && Number.isFinite(labelNode.y)) {
        return;
      }
      for (let i = 0; i < oldLabelNodes.length; i++) {
        const oldNode = oldLabelNodes[i];
        if (oldNode.equals(labelNode)) {
          labelNode.x = oldNode.x;
          labelNode.y = oldNode.y;
          labelNode.px = oldNode.px;
          labelNode.py = oldNode.py;
          break;
        }
      }
    });
  }

  // Applies all options that don't change the graph data.
  function refreshGraphStyle() {
    zoom = zoom.scaleExtent([
      renderedGraphSettings.minMagnification(),
      renderedGraphSettings.maxMagnification(),
    ]);
    if (graphContainer) {
      const svgNode = graphContainer.node()
        ? graphContainer.node().parentNode
        : null;
      if (svgNode) {
        d3.select(svgNode).call(
          zoom.transform,
          d3.zoomIdentity
            .translate(graphTranslation[0], graphTranslation[1])
            .scale(zoomFactor),
        );
      }
    }

    force
      .force(
        "charge",
        d3.forceManyBody().strength(function (element) {
          let charge = renderedGraphSettings.charge();
          if (elementTools.isLabel(element)) {
            charge *= 0.8;
          }
          return charge;
        }),
      )
      .force(
        "center",
        d3.forceCenter(
          renderedGraphSettings.width() / 2,
          renderedGraphSettings.height() / 2,
        ),
      )
      .force(
        "x",
        d3
          .forceX(renderedGraphSettings.width() / 2)
          .strength(renderedGraphSettings.gravity()),
      )
      .force(
        "y",
        d3
          .forceY(renderedGraphSettings.height() / 2)
          .strength(renderedGraphSettings.gravity()),
      );

    forceLink
      .distance(calculateLinkPartDistance)
      .strength(renderedGraphSettings.linkStrength()); // Flexibility of links

    force.nodes().forEach(function (n) {
      n.frozen(paused);
    });
  }

  function calculateLinkPartDistance(linkPart) {
    const link = linkPart.link();

    if (link.isLoop()) {
      return renderedGraphSettings.loopDistance();
    }

    // divide by 2 to receive the length for a single link part
    let linkPartDistance = getVisibleLinkDistance(link) / 2;
    linkPartDistance += linkPart.domain().actualRadius();
    linkPartDistance += linkPart.range().actualRadius();
    return linkPartDistance;
  }

  function getVisibleLinkDistance(link) {
    if (
      elementTools.isDatatype(link.domain()) ||
      elementTools.isDatatype(link.range())
    ) {
      return renderedGraphSettings.datatypeDistance();
    } else {
      return renderedGraphSettings.classDistance();
    }
  }

  /** --------------------------------------------------------- **/
  /** -- animation functions for the nodes --                   **/
  /** --------------------------------------------------------- **/

  /** --------------------------------------------------------- **/
  /** -- halo and localization functions --                     **/
  /** --------------------------------------------------------- **/
  function updateHaloRadius() {
    if (pulseNodeIds && pulseNodeIds.length > 0) {
      const forceNodes = force.nodes();
      for (let i = 0; i < pulseNodeIds.length; i++) {
        const node = forceNodes[pulseNodeIds[i]];
        if (node) {
          if (node.property) {
            // match search strings with property label
            if (node.property().inverse) {
              // The halo belongs on whichever of the property and its inverse
              // the reader actually selected. The runtime reports that set, so
              // membership answers it exactly rather than by matching text.
              if (highlightedElementIds.includes(node.property().id())) {
                computeDistanceToCenter(node);
              } else {
                node.property().removeHalo();
                if (node.property().inverse()) {
                  if (!node.property().inverse().getHalos()) {
                    node.property().inverse().drawHalo();
                  }
                  computeDistanceToCenter(node, true);
                }
                if (node.property().equivalents()) {
                  const eq = node.property().equivalents();
                  for (let e = 0; e < eq.length; e++) {
                    if (!eq[e].getHalos()) {
                      eq[e].drawHalo();
                    }
                  }
                  if (!node.property().getHalos()) {
                    node.property().drawHalo();
                  }
                  computeDistanceToCenter(node, false);
                }
              }
            }
          }
          computeDistanceToCenter(node);
        }
      }
    }
  }

  function getScreenCoords(x, y, translate, scale) {
    const xn = translate[0] + x * scale;
    const yn = translate[1] + y * scale;
    return { x: xn, y: yn };
  }

  function getClickedScreenCoords(x, y, translate, scale) {
    const xn = (x - translate[0]) / scale;
    const yn = (y - translate[1]) / scale;
    return { x: xn, y: yn };
  }

  function computeDistanceToCenter(node, inverse) {
    let container = node;
    const w = renderedGraphSettings.width();
    const h = renderedGraphSettings.height();
    let posXY = getScreenCoords(node.x, node.y, graphTranslation, zoomFactor);

    let highlightOfInv = false;

    if (inverse && inverse === true) {
      highlightOfInv = true;
      posXY = getScreenCoords(
        node.x,
        node.y + 20,
        graphTranslation,
        zoomFactor,
      );
    }
    const x = posXY.x;
    const y = posXY.y;
    let nodeIsRect = false;
    let halo;
    let roundHalo;
    let rectHalo;
    let borderPoint_x = 0;
    let borderPoint_y = 0;
    let defaultRadius;
    const offset = 15;
    let radius;

    if (node.property && highlightOfInv === true) {
      if (node.property().inverse()) {
        rectHalo = node.property().inverse().getHalos().select("rect");
      } else {
        if (node.property().getHalos()) {
          rectHalo = node.property().getHalos().select("rect");
        } else {
          node.property().drawHalo();
          rectHalo = node.property().getHalos().select("rect");
        }
      }
      rectHalo.classed("hidden", true);
      if (node.property().inverse()) {
        if (node.property().inverse().getHalos()) {
          roundHalo = node.property().inverse().getHalos().select("circle");
        }
      } else {
        roundHalo = node.property().getHalos().select("circle");
      }
      if (roundHalo.node() === null) {
        radius = node.property().inverse().width() + 15;

        roundHalo = node
          .property()
          .inverse()
          .getHalos()
          .append("circle")
          .classed("searchResultB", true)
          .classed("searchResultA", false)
          .attr("r", radius + 15);
      }
      halo = roundHalo; // swap the halo to be round
      nodeIsRect = true;
      container = node.property().inverse();
    }

    if (node.id) {
      if (!node.getHalos()) {
        return;
      } // something went wrong before
      halo = node.getHalos().select("rect");
      if (halo.node() === null) {
        // this is a round node
        nodeIsRect = false;
        roundHalo = node.getHalos().select("circle");
        defaultRadius = node.actualRadius() + offset;
        roundHalo.attr("r", defaultRadius + offset);
        halo = roundHalo;
      } else {
        // this is a rect node
        nodeIsRect = true;
        rectHalo = node.getHalos().select("rect");
        rectHalo.classed("hidden", true);
        roundHalo = node.getHalos().select("circle");
        if (roundHalo.node() === null) {
          radius = node.width();
          roundHalo = node
            .getHalos()
            .append("circle")
            .classed("searchResultB", true)
            .classed("searchResultA", false)
            .attr("r", radius + offset);
        }
        halo = roundHalo;
      }
    }
    if (node.property && !inverse) {
      if (!node.property().getHalos()) {
        return;
      } // something went wrong before
      rectHalo = node.property().getHalos().select("rect");
      rectHalo.classed("hidden", true);

      roundHalo = node.property().getHalos().select("circle");
      if (roundHalo.node() === null) {
        radius = node.property().width();

        roundHalo = node
          .property()
          .getHalos()
          .append("circle")
          .classed("searchResultB", true)
          .classed("searchResultA", false)
          .attr("r", radius + 15);
      }
      halo = roundHalo; // swap the halo to be round
      nodeIsRect = true;
      container = node.property();
    }

    if (x < 0 || x > w || y < 0 || y > h) {
      // node outside viewport;
      // check for quadrant and get the correct boarder point (intersection with viewport)
      if (x < 0 && y < 0) {
        borderPoint_x = 0;
        borderPoint_y = 0;
      } else if (x > 0 && x < w && y < 0) {
        borderPoint_x = x;
        borderPoint_y = 0;
      } else if (x > w && y < 0) {
        borderPoint_x = w;
        borderPoint_y = 0;
      } else if (x > w && y > 0 && y < h) {
        borderPoint_x = w;
        borderPoint_y = y;
      } else if (x > w && y > h) {
        borderPoint_x = w;
        borderPoint_y = h;
      } else if (x > 0 && x < w && y > h) {
        borderPoint_x = x;
        borderPoint_y = h;
      } else if (x < 0 && y > h) {
        borderPoint_x = 0;
        borderPoint_y = h;
      } else if (x < 0 && y > 0 && y < h) {
        borderPoint_x = 0;
        borderPoint_y = y;
      }
      // kill all pulses of nodes that are outside the viewport
      container.getHalos().select("rect").classed("searchResultA", false);
      container.getHalos().select("circle").classed("searchResultA", false);
      container.getHalos().select("rect").classed("searchResultB", true);
      container.getHalos().select("circle").classed("searchResultB", true);
      halo.classed("hidden", false);
      // compute in pixel coordinates length of difference vector
      const borderRadius_x = borderPoint_x - x;
      const borderRadius_y = borderPoint_y - y;

      let len =
        borderRadius_x * borderRadius_x + borderRadius_y * borderRadius_y;
      len = Math.sqrt(len);

      const normedX = borderRadius_x / len;
      const normedY = borderRadius_y / len;

      len = len + 20; // add 20 px;

      // re-normalized vector
      const newVectorX = normedX * len + x;
      const newVectorY = normedY * len + y;
      // compute world coordinates of this point
      const wX = (newVectorX - graphTranslation[0]) / zoomFactor;
      const wY = (newVectorY - graphTranslation[1]) / zoomFactor;

      // compute distance in world coordinates
      const dx = wX - node.x;
      let dy = wY - node.y;
      if (highlightOfInv === true) {
        dy = wY - node.y - 20;
      }

      if (
        highlightOfInv === false &&
        node.property &&
        node.property().inverse()
      ) {
        dy = wY - node.y + 20;
      }

      let newRadius = Math.sqrt(dx * dx + dy * dy);
      halo = container.getHalos().select("circle");
      // sanity checks and setting new halo radius
      if (!nodeIsRect) {
        defaultRadius = node.actualRadius() + offset;
        if (newRadius < defaultRadius) {
          newRadius = defaultRadius;
        }
        halo.attr("r", newRadius);
      } else {
        defaultRadius = 0.5 * container.width();
        if (newRadius < defaultRadius) {
          newRadius = defaultRadius;
        }
        halo.attr("r", newRadius);
      }
    } else {
      // node is in viewport , render original;
      // reset the halo to original radius
      defaultRadius = node.actualRadius() + 15;
      if (!nodeIsRect) {
        halo.attr("r", defaultRadius);
      } else {
        // this is rectangular node render as such
        halo = container.getHalos().select("rect");
        halo.classed("hidden", false);
        //halo.classed("searchResultB", true);
        //halo.classed("searchResultA", false);
        const aCircHalo = container.getHalos().select("circle");
        aCircHalo.classed("hidden", true);

        container.getHalos().select("rect").classed("hidden", false);
        container.getHalos().select("circle").classed("hidden", true);
      }
    }
  }

  function transform(p, cx, cy) {
    // one iteration step for the locate target animation
    if (
      !p ||
      p.length < 3 ||
      !Number.isFinite(p[0]) ||
      !Number.isFinite(p[1]) ||
      !Number.isFinite(p[2]) ||
      p[2] <= 0 ||
      !Number.isFinite(cx) ||
      !Number.isFinite(cy)
    ) {
      return viewportTransformString();
    }
    const nextZoom = viewportTransform.normalizeZoom(
      renderedGraphSettings.height() / p[2],
      renderedGraphSettings.minMagnification(),
      renderedGraphSettings.maxMagnification(),
    );
    if (nextZoom === undefined) {
      return viewportTransformString();
    }
    const nextTranslation = [cx - p[0] * nextZoom, cy - p[1] * nextZoom];
    if (!updateViewportState(nextTranslation, nextZoom)) {
      return viewportTransformString();
    }
    updateHaloRadius();
    reportViewportChanged();
    return viewportTransformString();
  }

  function targetLocationZoom(target, { signal } = {}) {
    if (
      !target ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !graphContainer
    ) {
      return;
    }
    // store the original information
    const cx = 0.5 * renderedGraphSettings.width();
    const cy = 0.5 * renderedGraphSettings.height();
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);
    const sP = [cp.x, cp.y, renderedGraphSettings.height() / zoomFactor];

    const zoomLevel = Math.max(
      defaultZoom + 0.5 * defaultZoom,
      defaultTargetZoom,
    );
    const eP = [target.x, target.y, renderedGraphSettings.height() / zoomLevel];
    const pos_intp = d3.interpolateZoom(sP, eP);

    let lenAnimation = pos_intp.duration;
    if (lenAnimation > 2500) {
      lenAnimation = 2500;
    }

    const transition = graphContainer
      .interrupt()
      .attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(lenAnimation)
      .attrTween("transform", function () {
        return function (t) {
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", function () {
        graphContainer.attr("transform", viewportTransformString());
        syncZoomState();
        updateHaloRadius();
      });
    return completeViewportTransition(transition, signal);
  }

  function getWorldPosFromScreen(x, y, translate, scale) {
    const normalizedScale = viewportTransform.normalizeZoom(scale);
    const normalizedTranslation =
      viewportTransform.normalizeTranslation(translate);
    if (
      normalizedScale === undefined ||
      !normalizedTranslation ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return { x: 0, y: 0 };
    }
    return {
      x: (x - normalizedTranslation[0]) / normalizedScale,
      y: (y - normalizedTranslation[1]) / normalizedScale,
    };
  }

  graph.locateSearchResult = function (options) {
    if (pulseNodeIds && pulseNodeIds.length > 0) {
      // move the center of the viewport to this location
      if (transformAnimation === true) {
        return;
      } // << prevents incrementing the location id if we are in an animation
      const node = force.nodes()[pulseNodeIds[locationId]];
      locationId++;
      locationId = locationId % pulseNodeIds.length;
      if (node.id) {
        node.foreground();
      }
      if (node.property) {
        node.property().foreground();
      }

      return targetLocationZoom(node, options);
    }
  };

  graph.resetSearchHighlight = function () {
    // get all nodes (handle also already filtered nodes )
    pulseNodeIds = [];
    nodeArrayForPulse = [];
    highlightedElementIds = [];
    if (
      !unfilteredData ||
      !unfilteredData.nodes ||
      !unfilteredData.properties
    ) {
      return;
    }
    // clear from stored nodes
    const nodes = unfilteredData.nodes;
    const props = unfilteredData.properties;
    let j;
    for (j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      if (node && node.removeHalo) {
        node.removeHalo();
      }
    }
    for (j = 0; j < props.length; j++) {
      const prop = props[j];
      if (prop && prop.removeHalo) {
        prop.removeHalo();
      }
    }
  };

  graph.updatePulseIds = function (nodeIdArray) {
    pulseNodeIds = [];
    for (let i = 0; i < nodeIdArray.length; i++) {
      const selectedId = nodeIdArray[i];
      const forceId = nodeMap[selectedId];
      if (forceId !== undefined) {
        const le_node = force.nodes()[forceId];
        if (le_node.id) {
          if (pulseNodeIds.indexOf(forceId) === -1) {
            pulseNodeIds.push(forceId);
          }
        }
        if (le_node.property) {
          if (pulseNodeIds.indexOf(forceId) === -1) {
            pulseNodeIds.push(forceId);
          }
        }
      }
    }
    locationId = 0;
  };

  graph.highLightNodes = function (nodeIdArray) {
    if (
      !nodeIdArray ||
      nodeIdArray.length === 0 ||
      !unfilteredData ||
      !unfilteredData.nodes ||
      !unfilteredData.properties
    ) {
      return; // nothing to highlight
    }
    pulseNodeIds = [];
    nodeArrayForPulse = nodeIdArray;
    highlightedElementIds = nodeIdArray;
    const missedIds = [];

    // identify the force id to highlight
    for (let i = 0; i < nodeIdArray.length; i++) {
      const selectedId = nodeIdArray[i];
      const forceId = nodeMap[selectedId];
      if (forceId !== undefined) {
        const le_node = force.nodes()[forceId];
        if (le_node.id) {
          if (pulseNodeIds.indexOf(forceId) === -1) {
            pulseNodeIds.push(forceId);
            le_node.foreground();
            le_node.drawHalo();
          }
        }
        if (le_node.property) {
          if (pulseNodeIds.indexOf(forceId) === -1) {
            pulseNodeIds.push(forceId);
            le_node.property().foreground();
            le_node.property().drawHalo();
          }
        }
      } else {
        missedIds.push(selectedId);
      }
    }
    // store the highlight on the missed nodes;
    const s_nodes = unfilteredData.nodes;
    const s_props = unfilteredData.properties;
    for (let i = 0; i < missedIds.length; i++) {
      const missedId = missedIds[i];
      // search for this in the nodes;
      for (let n = 0; n < s_nodes.length; n++) {
        const nodeId = s_nodes[n].id();
        if (nodeId === missedId) {
          s_nodes[n].drawHalo();
        }
      }
      for (let p = 0; p < s_props.length; p++) {
        const propId = s_props[p].id();
        if (propId === missedId) {
          s_props[p].drawHalo();
        }
      }
    }
    locationId = 0;
    updateHaloRadius();
  };

  graph.hideHalos = function () {
    const haloElements = d3.selectAll(".searchResultA,.searchResultB");
    haloElements.classed("hidden", true);
    return haloElements;
  };

  const updateTargetElement = function () {
    const bbox = graphContainer.node().getBoundingClientRect();

    // get the graph coordinates
    const bboxOffset = 50; // default radius of a node;
    const topLeft = getWorldPosFromScreen(
      bbox.left,
      bbox.top,
      graphTranslation,
      zoomFactor,
    );
    const botRight = getWorldPosFromScreen(
      bbox.right,
      bbox.bottom,
      graphTranslation,
      zoomFactor,
    );

    let w = renderedGraphSettings.width();
    w -= occludedLeftWidthPx;
    const h = renderedGraphSettings.height();
    topLeft.x += bboxOffset;
    topLeft.y -= bboxOffset;
    botRight.x -= bboxOffset;
    botRight.y += bboxOffset;

    const g_w = botRight.x - topLeft.x;
    const g_h = botRight.y - topLeft.y;

    // endpoint position calculations
    const posX = 0.5 * (topLeft.x + botRight.x);
    const posY = 0.5 * (topLeft.y + botRight.y);
    let cx = 0.5 * w;
    const cy = 0.5 * h;

    cx += occludedLeftWidthPx;
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);

    // zoom factor calculations and fail safes;
    let newZoomFactor; // fail save if graph and window are squares
    //get the smaller one
    const a = w / g_w;
    const b = h / g_h;
    if (a < b) {
      newZoomFactor = a;
    } else {
      newZoomFactor = b;
    }

    // fail saves
    if (newZoomFactor > zoom.scaleExtent()[1]) {
      newZoomFactor = zoom.scaleExtent()[1];
    }
    if (newZoomFactor < zoom.scaleExtent()[0]) {
      newZoomFactor = zoom.scaleExtent()[0];
    }

    // apply Zooming
    const sP = [cp.x, cp.y, h / zoomFactor];
    const eP = [posX, posY, h / newZoomFactor];

    const pos_intp = d3.interpolateZoom(sP, eP);
    return [pos_intp, cx, cy];
  };

  graph.zoomAndCenterGraph = function (dynamic, { signal } = {}) {
    if (!graphContainer || !graphContainer.node()) {
      return;
    }
    // we need to kill the halo to determine the bounding box;
    const halos = graph.hideHalos();
    const bbox = graphContainer.node().getBoundingClientRect();
    halos.classed("hidden", false);

    // get the graph coordinates
    const bboxOffset = 50; // default radius of a node;
    const topLeft = getWorldPosFromScreen(
      bbox.left,
      bbox.top,
      graphTranslation,
      zoomFactor,
    );
    const botRight = getWorldPosFromScreen(
      bbox.right,
      bbox.bottom,
      graphTranslation,
      zoomFactor,
    );

    let w = renderedGraphSettings.width();
    w -= occludedLeftWidthPx;
    const h = renderedGraphSettings.height();
    topLeft.x += bboxOffset;
    topLeft.y -= bboxOffset;
    botRight.x -= bboxOffset;
    botRight.y += bboxOffset;

    const g_w = botRight.x - topLeft.x;
    const g_h = botRight.y - topLeft.y;
    if (
      !Number.isFinite(g_w) ||
      !Number.isFinite(g_h) ||
      g_w <= 0 ||
      g_h <= 0 ||
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w <= 0 ||
      h <= 0
    ) {
      return;
    }

    // endpoint position calculations
    const posX = 0.5 * (topLeft.x + botRight.x);
    const posY = 0.5 * (topLeft.y + botRight.y);
    let cx = 0.5 * w;
    const cy = 0.5 * h;

    cx += occludedLeftWidthPx;
    const cp = getWorldPosFromScreen(cx, cy, graphTranslation, zoomFactor);

    // zoom factor calculations and fail safes;
    let newZoomFactor; // fail save if graph and window are squares
    //get the smaller one
    const a = w / g_w;
    const b = h / g_h;
    if (a < b) {
      newZoomFactor = a;
    } else {
      newZoomFactor = b;
    }

    // fail saves
    if (newZoomFactor > zoom.scaleExtent()[1]) {
      newZoomFactor = zoom.scaleExtent()[1];
    }
    if (newZoomFactor < zoom.scaleExtent()[0]) {
      newZoomFactor = zoom.scaleExtent()[0];
    }

    // apply Zooming
    const sP = [cp.x, cp.y, h / zoomFactor];
    const eP = [posX, posY, h / newZoomFactor];

    const pos_intp = d3.interpolateZoom(sP, eP);
    let lenAnimation = pos_intp.duration;
    if (lenAnimation > 2500) {
      lenAnimation = 2500;
    }
    const transition = graphContainer
      .interrupt()
      .attr("transform", transform(sP, cx, cy))
      .transition()
      .duration(lenAnimation)
      .attrTween("transform", function () {
        return function (t) {
          if (dynamic) {
            const param = updateTargetElement();
            const nV = param[0](t);
            return transform(nV, cx, cy);
          }
          return transform(pos_intp(t), cx, cy);
        };
      })
      .on("end", function () {
        if (dynamic) {
          return;
        }

        graphContainer.attr("transform", viewportTransformString());
        syncZoomState();
        reportViewportChanged();
      });
    return completeViewportTransition(transition, signal);
  };

  graph.isADraggerActive = function () {
    if (
      classDragger.mouseButtonPressed === true ||
      domainDragger.mouseButtonPressed === true ||
      rangeDragger.mouseButtonPressed === true
    ) {
      return true;
    }
    return false;
  };

  /** --------------------------------------------------------- **/
  /** -- VOWL EDITOR  create/ edit /delete functions --         **/
  /** --------------------------------------------------------- **/

  graph.removeEditElements = function () {
    // just added to be called form outside
    removeEditElements();
  };

  function removeEditElements() {
    rangeDragger.hideDragger(true);
    domainDragger.hideDragger(true);
    shadowClone.hideClone(true);

    classDragger.hideDragger(true);
    if (addDataPropertyGroupElement) {
      addDataPropertyGroupElement.classed("hidden", true);
    }
    if (deleteGroupElement) {
      deleteGroupElement.classed("hidden", true);
    }

    if (hoveredNodeElement) {
      if (hoveredNodeElement.pinned() === false) {
        hoveredNodeElement.locked(graph.paused());
        hoveredNodeElement.frozen(graph.paused());
      }
    }
    if (hoveredPropertyElement) {
      if (hoveredPropertyElement.pinned() === false) {
        hoveredPropertyElement.locked(graph.paused());
        hoveredPropertyElement.frozen(graph.paused());
      }
    }
  }

  graph.editorMode = function (val) {
    if (!arguments.length) {
      return editMode;
    }

    editMode = Boolean(val);
    renderedGraphEventPort.publishEditorModeChange(editMode);
    ontologyEditingState.setEditorModeForDefaultObject(editMode);
    if (editMode === false) {
      seenEditorHint = false;
      renderedGraphSettings.compactNotationModule().enabled(false);
      renderedGraphSettings.literalFilter().enabled(false);
      graph.executeCompactNotationModule();
      graph.executeEmptyLiteralFilter();
      graph.lazyRefresh();
    }

    const svgGraph = d3.selectAll(".vowlGraph");

    if (editMode === true) {
      svgGraph.on("dblclick.zoom", graph.modified_dblClickFunction);
    } else {
      svgGraph.on("dblclick.zoom", originalD3_dblClickFunction);
      // hide hovered edit elements
      removeEditElements();
    }
  };

  function createLowerCasePrototypeMap(prototypeMap) {
    return new Map(
      Array.from(prototypeMap.values()).map(function (Prototype) {
        return [new Prototype().type().toLowerCase(), Prototype];
      }),
    );
  }

  function createNewNodeAtPosition(pos) {
    const typeToCreate = ontologyEditingState.defaultClass();
    const prototype = NodePrototypeMap.get(typeToCreate.toLowerCase());
    const aNode = new prototype(graph);
    let autoEditElement = false;
    if (typeToCreate === "owl:Thing") {
      aNode.label("Thing");
    } else {
      aNode.label("NewClass");
      autoEditElement = true;
    }
    aNode.x = pos.x;
    aNode.y = pos.y;
    aNode.px = aNode.x;
    aNode.py = aNode.y;
    aNode.id(nextCanvasRecordId("Class"));
    // aNode.paused(true);

    aNode.baseIri(ontologyEditingState.baseIri());
    aNode.iri(aNode.baseIri() + aNode.id());
    publishCreatedElements(
      [{ element: aNode, collection: "class", pos: [pos.x, pos.y] }],
      aNode.id(),
      autoEditElement,
    );
  }

  function publishCreatedElements(elements, selectedId, editLabel) {
    const records = elements.map(({ element, collection, pos }) => ({
      collection,
      id: String(element.id()),
      type: element.type(),
      label: element.labelForCurrentLanguage(),
      iri: element.iri(),
      baseIri: element.baseIri(),
      pos,
      ...(collection === "property"
        ? {
            domain: String(element.domain().id()),
            range: String(element.range().id()),
          }
        : {}),
    }));
    const selected = records.find((record) => record.id === selectedId);
    renderedGraphEventPort.publishRecordCreation({
      records,
      selectedRecord: selected
        ? { collection: selected.collection, recordId: selected.id }
        : null,
      editLabel,
    });
  }

  function nextCanvasRecordId(prefix, isProperty = false) {
    const ids = new Set(
      [
        ...(unfilteredData.nodes ?? []),
        ...(unfilteredData.properties ?? []),
      ].map((element) => String(element.id())),
    );
    let id;
    do {
      id = prefix + (isProperty ? eP++ : eN++);
    } while (ids.has(id));
    return id;
  }

  graph.requestPropertyEndpointEdit = function (
    property,
    endpoint,
    node,
    labelPosition,
  ) {
    if (!canEditCurrentElements(property, node)) {
      return false;
    }
    renderedGraphEventPort.publishRecordEndpointEdit(
      String(property.id()),
      endpoint,
      String(node.id()),
      labelPosition,
    );
  };

  function canEditCurrentElements(...elements) {
    return (
      hasActiveRenderInteractions &&
      editMode &&
      elements.every(
        (element) =>
          unfilteredData.nodes.includes(element) ||
          unfilteredData.properties.includes(element),
      )
    );
  }

  graph.getTargetNode = function (position) {
    const dx = position[0];
    const dy = position[1];
    let tN = null;
    let minDist = 1000000000000;
    // This is a bit OVERKILL for the computation of one node >> TODO: KD-TREE SEARCH
    unfilteredData.nodes.forEach(function (el) {
      const cDist = Math.sqrt(
        (el.x - dx) * (el.x - dx) + (el.y - dy) * (el.y - dy),
      );
      if (cDist < minDist) {
        minDist = cDist;
        tN = el;
      }
    });
    if (hoveredNodeElement) {
      const offsetDist = hoveredNodeElement.actualRadius() + 30;
      if (minDist > offsetDist) {
        return null;
      }
      if (tN.renderType() === "rect") {
        return null;
      }
      if (
        tN === hoveredNodeElement &&
        minDist <= hoveredNodeElement.actualRadius()
      ) {
        return tN;
      } else if (
        tN === hoveredNodeElement &&
        minDist > hoveredNodeElement.actualRadius()
      ) {
        return null;
      }
      return tN;
    } else {
      if (minDist > tN.actualRadius() + 30) {
        return null;
      } else {
        return tN;
      }
    }
  };

  graph.genericPropertySanityCheck = function (
    domain,
    range,
    typeString,
    header,
    action,
  ) {
    if (domain === range && typeString === "rdfs:subClassOf") {
      renderedGraphEventPort.publishRenderWarning(
        "SUBCLASS_LOOP_REJECTED",
        "rdfs:subClassOf can not be created as loops (domain == range)",
      );
      return false;
    }
    if (domain === range && typeString === "owl:disjointWith") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:disjointWith  can not be created as loops (domain == range)",
      );
      return false;
    }
    // allProps[i].type()==="owl:allValuesFrom"  ||
    // allProps[i].type()==="owl:someValuesFrom"
    if (domain.type() === "owl:Thing" && typeString === "owl:allValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:allValuesFrom can not originate from owl:Thing",
      );
      return false;
    }
    if (domain.type() === "owl:Thing" && typeString === "owl:someValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:someValuesFrom can not originate from owl:Thing",
      );
      return false;
    }

    if (range.type() === "owl:Thing" && typeString === "owl:allValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:allValuesFrom can not be connected to owl:Thing",
      );
      return false;
    }
    if (range.type() === "owl:Thing" && typeString === "owl:someValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:someValuesFrom can not be connected to owl:Thing",
      );
      return false;
    }

    return true; // we can Change the domain or range
  };

  graph.propertyCheckExistenceChecker = function (property, domain, range) {
    const allProps = unfilteredData.properties;
    let i;
    if (
      property.type() === "rdfs:subClassOf" ||
      property.type() === "owl:disjointWith"
    ) {
      for (i = 0; i < allProps.length; i++) {
        if (allProps[i] === property) {
          continue;
        }
        if (
          allProps[i].domain() === domain &&
          allProps[i].range() === range &&
          allProps[i].type() === property.type()
        ) {
          renderedGraphEventPort.publishRenderWarning(
            "GRAPH_EDIT_REJECTED",
            "This triple already exist!",
          );
          return false;
        }
        if (
          allProps[i].domain() === range &&
          allProps[i].range() === domain &&
          allProps[i].type() === property.type()
        ) {
          renderedGraphEventPort.publishRenderWarning(
            "GRAPH_EDIT_REJECTED",
            "Inverse assignment already exist! ",
          );
          return false;
        }
      }
      return true;
    }
    return true;
  };

  // graph.checkForTripleDuplicate=function(property){
  //     var domain=property.domain();
  //     var range=property.range();
  //     console.log("checking for duplicates");
  //     var b1= domain.isPropertyAssignedToThisElement(property);
  //     var b2= range.isPropertyAssignedToThisElement(property);
  //
  //     console.log("test domain results in "+ b1);
  //     console.log("test range results in "+ b1);
  //
  //     if (b1  && b2 ){
  //         renderedGraphEventPort.publishRenderWarning(
  //             "GRAPH_EDIT_REJECTED",
  //             "This triple already exist!",
  //         );
  //         return false;
  //     }
  //     return true;
  // };

  graph.sanityCheckProperty = function (domain, range, typeString) {
    // check for duplicate triple in the element;

    if (
      typeString === "owl:objectProperty" &&
      renderedGraphSettings.objectPropertyFilter().enabled() === true
    ) {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "Object properties are filtered out in the visualization!",
      );
      return false;
    }

    if (
      typeString === "owl:disjointWith" &&
      renderedGraphSettings.disjointPropertyFilter().enabled() === true
    ) {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:disjointWith properties are filtered out in the visualization!",
      );
      return false;
    }

    if (domain === range && typeString === "rdfs:subClassOf") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "rdfs:subClassOf can not be created as loops (domain == range)",
      );
      return false;
    }
    if (domain === range && typeString === "owl:disjointWith") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:disjointWith  can not be created as loops (domain == range)",
      );
      return false;
    }

    if (domain.type() === "owl:Thing" && typeString === "owl:someValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:someValuesFrom can not originate from owl:Thing",
      );
      return false;
    }
    if (domain.type() === "owl:Thing" && typeString === "owl:allValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:allValuesFrom can not originate from owl:Thing",
      );
      return false;
    }

    if (range.type() === "owl:Thing" && typeString === "owl:allValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:allValuesFrom can not be connected to owl:Thing",
      );
      return false;
    }
    if (range.type() === "owl:Thing" && typeString === "owl:someValuesFrom") {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "owl:someValuesFrom can not be connected to owl:Thing",
      );
      return false;
    }
    return true; // we can create a property
  };

  function createNewObjectProperty(domain, range, draggerEndposition) {
    if (!canEditCurrentElements(domain, range)) {
      return false;
    }
    // check type of the property that we want to create;

    const defaultPropertyName = ontologyEditingState.defaultProperty();

    // check if we are allow to create that property
    if (
      graph.sanityCheckProperty(domain, range, defaultPropertyName) === false
    ) {
      return false;
    }

    const propPrototype = PropertyPrototypeMap.get(
      defaultPropertyName.toLowerCase(),
    );
    const aProp = new propPrototype(graph);
    aProp.id(nextCanvasRecordId("objectProperty", true));
    aProp.domain(domain);
    aProp.range(range);
    aProp.label("newObjectProperty");
    aProp.baseIri(ontologyEditingState.baseIri());
    aProp.iri(aProp.baseIri() + aProp.id());

    // check for duplicate;
    if (graph.propertyCheckExistenceChecker(aProp, domain, range) === false) {
      // delete aProp;
      // hope for garbage collection here -.-
      return false;
    }

    let autoEditElement = false;

    if (defaultPropertyName === "owl:objectProperty") {
      autoEditElement = true;
    }
    let pX = 0.49 * (domain.x + range.x);
    let pY = 0.49 * (domain.y + range.y);

    if (domain === range) {
      // we use the dragger endposition to determine an angle to put the loop there;
      const dirD_x = draggerEndposition[0] - domain.x;
      const dirD_y = draggerEndposition[1] - domain.y;

      // normalize;
      const len = Math.sqrt(dirD_x * dirD_x + dirD_y * dirD_y);
      // it should be very hard to set the position on the same sport but why not handling this
      let nx = dirD_x / len;
      let ny = dirD_y / len;
      // is Nan in javascript like in c len==len returns false when it is not a number?
      if (isNaN(len)) {
        nx = 0;
        ny = -1;
      }

      // get domain actual raidus
      const offset = 2 * domain.actualRadius() + 50;
      pX = domain.x + offset * nx;
      pY = domain.y + offset * ny;
    }

    publishCreatedElements(
      [{ element: aProp, collection: "property", pos: [pX, pY] }],
      aProp.id(),
      autoEditElement,
    );
  }

  graph.createDataTypeProperty = function (node) {
    if (!canEditCurrentElements(node)) {
      return;
    }
    // random postion issues;
    // tells user when element is filtered out
    if (renderedGraphSettings.datatypeFilter().enabled() === true) {
      renderedGraphEventPort.publishRenderWarning(
        "GRAPH_EDIT_REJECTED",
        "Datatype properties are filtered out in the visualization!",
      );
      return;
    }

    let aNode, prototype;

    // create a default datatype Node >> HERE LITERAL;
    const defaultDatatypeName = ontologyEditingState.defaultDatatype();
    if (defaultDatatypeName === "rdfs:Literal") {
      prototype = NodePrototypeMap.get("rdfs:literal");
      aNode = new prototype(graph);
      aNode.label("Literal");
      aNode.iri("http://www.w3.org/2000/01/rdf-schema#Literal");
      aNode.baseIri("http://www.w3.org/2000/01/rdf-schema#");
    } else {
      prototype = NodePrototypeMap.get("rdfs:datatype");
      aNode = new prototype(graph);
      let identifier;
      if (defaultDatatypeName === "undefined") {
        identifier = "undefined";

        aNode.label(identifier);
        // TODO : HANDLER FOR UNDEFINED DATATYPES!!<<<>>>>>>>>>>>..
        aNode.iri("http://www.undefinedDatatype.org/#" + identifier);
        aNode.baseIri("http://www.undefinedDatatype.org/#");
        aNode.dType(defaultDatatypeName);
      } else {
        identifier = defaultDatatypeName.split(":")[1];
        aNode.label(identifier);
        aNode.dType(defaultDatatypeName);
        aNode.iri("http://www.w3.org/2001/XMLSchema#" + identifier);
        aNode.baseIri("http://www.w3.org/2001/XMLSchema#");
      }
    }

    const nX = node.x - node.actualRadius() - 100;
    const nY = node.y + node.actualRadius() + 100;

    aNode.x = nX;
    aNode.y = nY;
    aNode.px = aNode.x;
    aNode.py = aNode.y;
    aNode.id(nextCanvasRecordId("NodeId"));
    // add also the datatype Property to it
    const propPrototype = PropertyPrototypeMap.get("owl:datatypeproperty");
    const aProp = new propPrototype(graph);
    aProp.id(nextCanvasRecordId("datatypeProperty", true));

    // create the connection
    aProp.domain(node);
    aProp.range(aNode);
    aProp.label("newDatatypeProperty");

    // TODO: change its base IRI to proper value
    const ontoIri = ontologyEditingState.baseIri();
    aProp.baseIri(ontoIri);
    aProp.iri(ontoIri + aProp.id());
    publishCreatedElements(
      [
        { element: aNode, collection: "class", pos: [nX, nY] },
        {
          element: aProp,
          collection: "property",
          pos: [0.49 * (node.x + nX), 0.49 * (node.y + nY)],
        },
      ],
      null,
      false,
    );
  };

  graph.removeNodeViaEditor = function (node) {
    if (!canEditCurrentElements(node)) {
      return;
    }
    renderedGraphEventPort.publishRecordDeletion(String(node.id()));
  };

  graph.removePropertyViaEditor = function (property) {
    if (!canEditCurrentElements(property)) {
      return;
    }
    renderedGraphEventPort.publishRecordDeletion(String(property.id()));
  };

  graph.executeColorExternalsModule = function () {
    if (unfilteredData) {
      renderedGraphSettings
        .colorExternalsModule()
        .filter(unfilteredData.nodes, unfilteredData.properties);
    }
  };

  graph.executeCompactNotationModule = function () {
    if (unfilteredData) {
      renderedGraphSettings
        .compactNotationModule()
        .filter(unfilteredData.nodes, unfilteredData.properties);
    }
  };

  graph.executeNodeScalingModule = function () {
    if (unfilteredData) {
      renderedGraphSettings
        .nodeScalingModule()
        .filter(unfilteredData.nodes, unfilteredData.properties);
    }
  };
  graph.executeEmptyLiteralFilter = function () {
    if (unfilteredData && unfilteredData.nodes.length > 1) {
      renderedGraphSettings
        .literalFilter()
        .filter(unfilteredData.nodes, unfilteredData.properties);
      unfilteredData.nodes = renderedGraphSettings
        .literalFilter()
        .filteredNodes();
      unfilteredData.properties = renderedGraphSettings
        .literalFilter()
        .filteredProperties();
    }
  };

  /** --------------------------------------------------------- **/
  /** -- animation functions for the nodes --                   **/
  /** --------------------------------------------------------- **/

  graph.animateDynamicLabelWidth = async function ({ signal } = {}) {
    signal?.throwIfAborted();
    const wantedWidth = renderedGraphSettings.dynamicLabelWidth();
    const animationRoot = graphContainer;
    const interrupt = () => animationRoot?.selectAll("*").interrupt();
    signal?.addEventListener("abort", interrupt, { once: true });
    const animations = [];
    try {
      let i;
      for (i = 0; i < classNodes.length; i++) {
        const nodeElement = classNodes[i];
        if (elementTools.isDatatype(nodeElement)) {
          animations.push(nodeElement.animateDynamicLabelWidth(wantedWidth));
        }
      }
      for (i = 0; i < properties.length; i++) {
        animations.push(properties[i].animateDynamicLabelWidth(wantedWidth));
      }
      const outcomes = await Promise.all(animations);
      return !signal?.aborted && outcomes.every((outcome) => outcome !== false);
    } finally {
      signal?.removeEventListener("abort", interrupt);
    }
  };

  /** --------------------------------------------------------- **/
  /** -- Touch behaviour functions --                   **/
  /** --------------------------------------------------------- **/

  graph.isTouchDevice = function () {
    return touchDevice;
  };

  graph.modified_dblClickFunction = function (event) {
    if (!isCurrentCanvasCreationEvent(event)) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    // get position where we want to add the node;
    const grPos = getClickedScreenCoords(
      event.clientX,
      event.clientY,
      graph.translation(),
      graph.scaleFactor(),
    );
    createNewNodeAtPosition(grPos);
  };

  function doubletap(event) {
    const touch_time = event ? event.timeStamp : 0;
    let numTouchers = 1;
    if (event && event.touches && event.touches.length) {
      numTouchers = event.touches.length;
    }

    if (
      last_element_tap_time > 0 &&
      touch_time - last_element_tap_time < 300 &&
      numTouchers === 1
    ) {
      if (event.stopPropagation) {
        event.stopPropagation();
      }
      if (editMode === true) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        last_element_tap_time = 0;
        return true;
      }
    }
    last_element_tap_time = touch_time;
    return false;
  }

  function touchzoomed(event, d) {
    forceNotZooming = true;

    const touch_time = event ? event.timeStamp : 0;
    const numTouches = event && event.touches ? event.touches.length : 0;
    if (
      last_canvas_touch_time > 0 &&
      touch_time - last_canvas_touch_time < 300 &&
      numTouches === 1
    ) {
      if (event.stopPropagation) {
        event.stopPropagation();
      }

      if (editMode === true) {
        if (event.preventDefault) {
          event.preventDefault();
        }
        syncZoomState();
        graph.modified_dblTouchFunction(event);
      } else {
        forceNotZooming = false;
        if (originalD3_touchZoomFunction) {
          originalD3_touchZoomFunction.call(this, event, d);
        }
      }
      last_canvas_touch_time = 0;
      return;
    }
    forceNotZooming = false;
    last_canvas_touch_time = touch_time;
    if (originalD3_touchZoomFunction) {
      originalD3_touchZoomFunction.call(this, event, d);
    }
  }

  graph.modified_dblTouchFunction = function (event) {
    if (!isCurrentCanvasCreationEvent(event)) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    let xy;
    if (editMode === true) {
      xy = d3.pointers(event, d3.selectAll(".vowlGraph").node());
    }
    const grPos = getClickedScreenCoords(
      xy[0][0],
      xy[0][1],
      graph.translation(),
      graph.scaleFactor(),
    );
    createNewNodeAtPosition(grPos);
  };

  function isCurrentCanvasCreationEvent(event) {
    const svgRoot = graphContainer?.node()?.parentNode;
    return (
      hasActiveRenderInteractions &&
      editMode &&
      svgRoot &&
      (event.currentTarget === svgRoot ||
        event.target === svgRoot ||
        svgRoot.contains(event.target))
    );
  }

  /** --------------------------------------------------------- **/
  /** -- Hover and Selection functions, adding edit elements --  **/
  /** --------------------------------------------------------- **/

  graph.ignoreOtherHoverEvents = function (val) {
    if (!arguments.length) {
      return ignoreOtherHoverEvents;
    } else {
      ignoreOtherHoverEvents = val;
    }
  };

  function clearAllHover() {
    d3.selectAll(
      ".hovered, .hoveredForEditing, .indirect-highlighting, .classDraggerNodeHovered, .hovered-MathSymbol",
    )
      .classed("hovered", false)
      .classed("hoveredForEditing", false)
      .classed("indirect-highlighting", false)
      .classed("classDraggerNodeHovered", false)
      .classed("hovered-MathSymbol", false);

    if (hoveredNodeElement) {
      if (typeof hoveredNodeElement.setHoverHighlighting === "function") {
        hoveredNodeElement.setHoverHighlighting(false);
      }
      if (typeof hoveredNodeElement.mouseEntered === "function") {
        hoveredNodeElement.mouseEntered(false);
      }
      hoveredNodeElement = undefined;
    }
    if (hoveredPropertyElement) {
      if (typeof hoveredPropertyElement.setHighlighting === "function") {
        hoveredPropertyElement.setHighlighting(false);
      }
      if (typeof hoveredPropertyElement.mouseEntered === "function") {
        hoveredPropertyElement.mouseEntered(false);
      }
      hoveredPropertyElement = undefined;
    }
  }

  function delayedHiddingHoverElements(tbh) {
    if (tbh === true) {
      return;
    }
    if (hoveredNodeElement) {
      if (hoveredNodeElement.editingTextElement === true) {
        return;
      }
      delayedHider = setTimeout(function () {
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if (
          hoveredNodeElement &&
          hoveredNodeElement.pinned() === false &&
          graph.paused() === false &&
          hoveredNodeElement.editingTextElement === false
        ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }, 1000);
    }
    if (hoveredPropertyElement) {
      if (hoveredPropertyElement.editingTextElement === true) {
        return;
      }
      delayedHider = setTimeout(function () {
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        rangeDragger.hideDragger(true);
        domainDragger.hideDragger(true);
        shadowClone.hideClone(true);
        if (
          hoveredPropertyElement &&
          hoveredPropertyElement.focused() === true &&
          renderedGraphSettings.drawPropertyDraggerOnHover() === true
        ) {
          hoveredPropertyElement.labelObject().increasedLoopAngle = false;
          // lazy update
          recalculatePositions();
        }

        if (
          hoveredPropertyElement &&
          hoveredPropertyElement.pinned() === false &&
          graph.paused() === false &&
          hoveredPropertyElement.editingTextElement === false
        ) {
          hoveredPropertyElement.frozen(false);
          hoveredPropertyElement.locked(false);
        }
      }, 1000);
    }
  }

  function editElementHoverOnHidden() {
    classDragger.nodeElement.classed("classDraggerNodeHovered", true);
    classDragger.nodeElement.classed("classDraggerNode", false);
    editElementHoverOn();
  }

  function editElementHoverOutHidden() {
    classDragger.nodeElement.classed("classDraggerNodeHovered", false);
    classDragger.nodeElement.classed("classDraggerNode", true);
    editElementHoverOut();
  }

  function editElementHoverOn(touch) {
    if (touch === true) {
      return;
    }
    clearTimeout(delayedHider); // ignore touch behaviour
  }

  graph.killDelayedTimer = function () {
    clearTimeout(delayedHider);
  };

  function editElementHoverOut(tbh) {
    if (hoveredNodeElement) {
      if (
        graph.ignoreOtherHoverEvents() === true ||
        tbh === true ||
        hoveredNodeElement.editingTextElement === true
      ) {
        return;
      }
      delayedHider = setTimeout(function () {
        if (graph.isADraggerActive() === true) {
          return;
        }
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if (
          hoveredNodeElement &&
          hoveredNodeElement.pinned() === false &&
          graph.paused() === false
        ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }, 1000);
    }
    if (hoveredPropertyElement) {
      if (
        graph.ignoreOtherHoverEvents() === true ||
        tbh === true ||
        hoveredPropertyElement.editingTextElement === true
      ) {
        return;
      }
      delayedHider = setTimeout(function () {
        if (graph.isADraggerActive() === true) {
          return;
        }
        deleteGroupElement.classed("hidden", true);
        addDataPropertyGroupElement.classed("hidden", true);
        classDragger.hideDragger(true);
        if (
          hoveredPropertyElement &&
          hoveredPropertyElement.pinned() === false &&
          graph.paused() === false
        ) {
          hoveredPropertyElement.frozen(false);
          hoveredPropertyElement.locked(false);
        }
      }, 1000);
    }
  }

  graph.activateHoverElementsForProperties = function (
    val,
    property,
    inversed,
    touchBehaviour,
  ) {
    if (editMode === false) {
      return;
    } // nothing to do;

    if (touchBehaviour === undefined) {
      touchBehaviour = false;
    }

    if (val === true) {
      clearTimeout(delayedHider);
      if (hoveredPropertyElement && hoveredPropertyElement !== property) {
        if (
          hoveredPropertyElement.domain() === hoveredPropertyElement.range()
        ) {
          hoveredPropertyElement.labelObject().increasedLoopAngle = false;
          recalculatePositions();
        }
        if (typeof hoveredPropertyElement.setHighlighting === "function") {
          hoveredPropertyElement.setHighlighting(false);
        }
        if (typeof hoveredPropertyElement.mouseEntered === "function") {
          hoveredPropertyElement.mouseEntered(false);
        }
      }

      hoveredPropertyElement = property;
      if (renderedGraphSettings.drawPropertyDraggerOnHover() === true) {
        if (property.type() !== "owl:DatatypeProperty") {
          if (property.domain() === property.range()) {
            property.labelObject().increasedLoopAngle = true;
            recalculatePositions();
          }
          shadowClone.setParentProperty(property, inversed);
          shadowClone.hideClone(true);
          rangeDragger.setParentProperty(property, inversed);
          rangeDragger.hideDragger(false);
          rangeDragger.addMouseEvents();
          domainDragger.setParentProperty(property, inversed);
          domainDragger.hideDragger(false);
          domainDragger.addMouseEvents();
        } else if (property.type() === "owl:DatatypeProperty") {
          shadowClone.setParentProperty(property, inversed);
          shadowClone.hideClone(true);
          rangeDragger.setParentProperty(property, inversed);
          rangeDragger.hideDragger(true);
          rangeDragger.addMouseEvents();
          domainDragger.setParentProperty(property, inversed);
          domainDragger.hideDragger(false);
          domainDragger.addMouseEvents();
        }
      } else {
        // hide when we dont want that option
        if (renderedGraphSettings.drawPropertyDraggerOnHover() === true) {
          rangeDragger.hideDragger(true);
          domainDragger.hideDragger(true);
          shadowClone.hideClone(true);
          if (property.domain() === property.range()) {
            property.labelObject().increasedLoopAngle = false;
            recalculatePositions();
          }
        }
      }

      if (hoveredNodeElement) {
        if (
          hoveredNodeElement &&
          hoveredNodeElement.pinned() === false &&
          graph.paused() === false
        ) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }
      hoveredNodeElement = undefined;
      deleteGroupElement.classed("hidden", false);
      setDeleteHoverElementPositionProperty(property, inversed);
      deleteGroupElement.selectAll("*").on("click", function (event) {
        if (touchBehaviour && property.focused() === false) {
          renderedGraphSettings.focuserModule().handle(null, property);
          return;
        }
        graph.removePropertyViaEditor(property);
        event.stopPropagation();
      });
      classDragger.hideDragger(true);
      addDataPropertyGroupElement.classed("hidden", true);
    } else {
      delayedHiddingHoverElements();
    }
  };

  graph.updateDraggerElements = function () {
    // set opacity style for all elements

    rangeDragger.draggerObject.classed(
      "superOpacityElement",
      !renderedGraphSettings.showDraggerObject(),
    );
    domainDragger.draggerObject.classed(
      "superOpacityElement",
      !renderedGraphSettings.showDraggerObject(),
    );
    classDragger.draggerObject.classed(
      "superOpacityElement",
      !renderedGraphSettings.showDraggerObject(),
    );

    nodeContainer
      .selectAll(".superHiddenElement")
      .classed(
        "superOpacityElement",
        !renderedGraphSettings.showDraggerObject(),
      );
    labelContainer
      .selectAll(".superHiddenElement")
      .classed(
        "superOpacityElement",
        !renderedGraphSettings.showDraggerObject(),
      );

    deleteGroupElement
      .selectAll(".superHiddenElement")
      .classed(
        "superOpacityElement",
        !renderedGraphSettings.showDraggerObject(),
      );
    addDataPropertyGroupElement
      .selectAll(".superHiddenElement")
      .classed(
        "superOpacityElement",
        !renderedGraphSettings.showDraggerObject(),
      );
  };

  function setAddDataPropertyHoverElementPosition(node) {
    if (node.renderType() === "round") {
      const scale = 0.5 * Math.sqrt(2.0);
      const oX = scale * node.actualRadius();
      const oY = scale * node.actualRadius();
      const delX = node.x - oX;
      const delY = node.y + oY;
      addDataPropertyGroupElement.attr(
        "transform",
        "translate(" + delX + "," + delY + ")",
      );
    }
  }

  function setDeleteHoverElementPosition(node) {
    let delX;
    let delY;
    if (node.renderType() === "round") {
      const scale = 0.5 * Math.sqrt(2.0);
      const oX = scale * node.actualRadius();
      const oY = scale * node.actualRadius();
      delX = node.x + oX;
      delY = node.y - oY;
    } else {
      delX = node.x + 0.5 * node.width() + 6;
      delY = node.y - 0.5 * node.height() - 6;
    }
    deleteGroupElement.attr(
      "transform",
      "translate(" + delX + "," + delY + ")",
    );
  }

  function setDeleteHoverElementPositionProperty(property, inversed) {
    if (property && property.labelElement()) {
      const pos = [property.labelObject().x, property.labelObject().y];
      const widthElement = parseFloat(property.getShapeElement().attr("width"));
      const heightElement = parseFloat(
        property.getShapeElement().attr("height"),
      );
      const delX = pos[0] + 0.5 * widthElement + 6;
      let delY = pos[1] - 0.5 * heightElement - 6;
      // this is the lower element
      if (property.labelElement().attr("transform") === "translate(0,15)") {
        delY += 15;
      }
      // this is upper element
      if (property.labelElement().attr("transform") === "translate(0,-15)") {
        delY -= 15;
      }
      deleteGroupElement.attr(
        "transform",
        "translate(" + delX + "," + delY + ")",
      );
    } else {
      deleteGroupElement.classed("hidden", true); // hide when there is no property
    }
  }

  graph.activateHoverElements = function (val, node, touchBehaviour) {
    if (editMode === false) {
      return; // nothing to do;
    }
    if (touchBehaviour === undefined) {
      touchBehaviour = false;
    }
    if (val === true) {
      if (renderedGraphSettings.drawPropertyDraggerOnHover() === true) {
        rangeDragger.hideDragger(true);
        domainDragger.hideDragger(true);
        shadowClone.hideClone(true);
      }
      // make them visible
      clearTimeout(delayedHider);
      if (hoveredPropertyElement) {
        if (typeof hoveredPropertyElement.setHighlighting === "function") {
          hoveredPropertyElement.setHighlighting(false);
        }
        if (typeof hoveredPropertyElement.mouseEntered === "function") {
          hoveredPropertyElement.mouseEntered(false);
        }
        if (hoveredPropertyElement.focused() === false) {
          hoveredPropertyElement.labelObject().increasedLoopAngle = false;
          recalculatePositions();
          // update the loopAngles;
        }
      }
      hoveredPropertyElement = undefined;
      if (hoveredNodeElement && hoveredNodeElement !== node) {
        if (typeof hoveredNodeElement.setHoverHighlighting === "function") {
          hoveredNodeElement.setHoverHighlighting(false);
        }
        if (typeof hoveredNodeElement.mouseEntered === "function") {
          hoveredNodeElement.mouseEntered(false);
        }
        if (hoveredNodeElement.pinned() === false && graph.paused() === false) {
          hoveredNodeElement.frozen(false);
          hoveredNodeElement.locked(false);
        }
      }
      hoveredNodeElement = node;
      deleteGroupElement.classed("hidden", false);
      setDeleteHoverElementPosition(node);

      deleteGroupElement
        .selectAll("*")
        .on("click", function (event) {
          if (touchBehaviour && node.focused() === false) {
            renderedGraphSettings.focuserModule().handle(null, node);
            return;
          }
          graph.removeNodeViaEditor(node);
          event.stopPropagation();
        })
        .on("mouseover", function () {
          editElementHoverOn(node, touchBehaviour);
        })
        .on("mouseout", function () {
          editElementHoverOut(node, touchBehaviour);
        });

      addDataPropertyGroupElement.classed("hidden", true);
      classDragger.nodeElement
        .on("mouseover", editElementHoverOn)
        .on("mouseout", editElementHoverOut);
      classDragger.draggerObject
        .on("mouseover", editElementHoverOnHidden)
        .on("mouseout", editElementHoverOutHidden);

      // add the dragger element;
      if (node.renderType() === "round") {
        classDragger.svgRoot(draggerLayer);
        classDragger.setParentNode(node);
        classDragger.hideDragger(false);
        addDataPropertyGroupElement.classed("hidden", false);
        setAddDataPropertyHoverElementPosition(node);
        addDataPropertyGroupElement
          .selectAll("*")
          .on("click", function (event) {
            if (touchBehaviour && node.focused() === false) {
              renderedGraphSettings.focuserModule().handle(null, node);
              return;
            }
            graph.createDataTypeProperty(node);
            event.stopPropagation();
          })
          .on("mouseover", function () {
            editElementHoverOn(node, touchBehaviour);
          })
          .on("mouseout", function () {
            editElementHoverOut(node, touchBehaviour);
          });
      } else {
        classDragger.hideDragger(true);
      }
    } else {
      delayedHiddingHoverElements(node, touchBehaviour);
    }
  };

  return graph;
}

export {
  createInvalidGeometryReporter,
  createGraph as createRenderedGraphInternals,
  measureViewportElement,
  svgRenderingGuard,
  viewportTransform,
};
