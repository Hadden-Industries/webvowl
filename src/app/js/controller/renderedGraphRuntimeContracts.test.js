import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let RENDERED_GRAPH_EVENT_KINDS;
let RENDERED_GRAPH_RUNTIME_METHOD_NAMES;
let assertRenderedGraphRuntime;
let createContinuousZoomRequest;
let createAppliedVisualizationView;
let createForceLayoutDistancesRequest;
let createVisualizationModesRequest;
let createGraphLayoutPauseRequest;
let createGraphLayoutPauseResult;
let createGraphLayoutSnapshot;
let createOntologyInspectionSnapshot;
let createRenderedGraphEvent;
let createRenderedSvgSnapshot;
let createRenderedSvgSnapshotRequest;
let createVisibleRenderedGraphSnapshot;
let createVisualizationViewApplicationRequest;
let createVisualizationViewApplicationResult;
let createVowlModelReplacementRequest;
let createVowlModelReplacementResult;

const RENDERED_GRAPH_RUNTIME_CONTRACTS_MODULE_URL = new URL(
  "./renderedGraphRuntimeContracts.js",
  import.meta.url,
);
const WEB_VOWL_CONTROLLER_CONTRACTS_MODULE_URL = new URL(
  "./webVowlControllerContracts.js",
  import.meta.url,
);

beforeAll(async () => {
  const webVowlControllerContractsModule = new SourceTextModule(
    readFileSync(
      fileURLToPath(WEB_VOWL_CONTROLLER_CONTRACTS_MODULE_URL),
      "utf8",
    ),
    { identifier: WEB_VOWL_CONTROLLER_CONTRACTS_MODULE_URL.href },
  );
  await webVowlControllerContractsModule.link((specifier) => {
    throw new Error(`Unexpected controller-contract dependency: ${specifier}`);
  });
  await webVowlControllerContractsModule.evaluate();

  const renderedGraphRuntimeContractsModule = new SourceTextModule(
    readFileSync(
      fileURLToPath(RENDERED_GRAPH_RUNTIME_CONTRACTS_MODULE_URL),
      "utf8",
    ),
    { identifier: RENDERED_GRAPH_RUNTIME_CONTRACTS_MODULE_URL.href },
  );
  await renderedGraphRuntimeContractsModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlControllerContractsModule;
    }
    throw new Error(`Unexpected rendered-graph dependency: ${specifier}`);
  });
  await renderedGraphRuntimeContractsModule.evaluate();
  ({
    RENDERED_GRAPH_EVENT_KINDS,
    RENDERED_GRAPH_RUNTIME_METHOD_NAMES,
    assertRenderedGraphRuntime,
    createContinuousZoomRequest,
    createAppliedVisualizationView,
    createForceLayoutDistancesRequest,
    createVisualizationModesRequest,
    createGraphLayoutPauseRequest,
    createGraphLayoutPauseResult,
    createGraphLayoutSnapshot,
    createOntologyInspectionSnapshot,
    createRenderedGraphEvent,
    createRenderedSvgSnapshot,
    createRenderedSvgSnapshotRequest,
    createVisibleRenderedGraphSnapshot,
    createVisualizationViewApplicationRequest,
    createVisualizationViewApplicationResult,
    createVowlModelReplacementRequest,
    createVowlModelReplacementResult,
  } = renderedGraphRuntimeContractsModule.namespace);
});

test("reports the selected document record independently of semantic IRI selection", () => {
  const source = {
    kind: "document-record-selection-changed",
    loadGeneration: 3,
    payload: { recordTarget: { collection: "class", recordId: "a" } },
  };
  const event = createRenderedGraphEvent(source);
  source.payload.recordTarget.recordId = "b";
  expect(event.payload.recordTarget).toEqual({
    collection: "class",
    recordId: "a",
  });
  expect(Object.isFrozen(event.payload.recordTarget)).toBe(true);
  expect(
    createRenderedGraphEvent({ ...source, payload: { recordTarget: null } })
      .payload.recordTarget,
  ).toBeNull();
  expect(() =>
    createRenderedGraphEvent({
      ...source,
      payload: {
        recordTarget: {
          collection: "class",
          recordId: "a",
          iri: "https://example.test/",
        },
      },
    }),
  ).toThrow();
});

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";

// Every element record carries the same descriptive fields; a fixture only
// names the ones a given assertion cares about.
function describedElementFields(overrides = {}) {
  return {
    elementTypeName: null,
    labelRecords: [],
    commentRecords: [],
    descriptionRecords: [],
    annotationRecords: [],
    characteristicNames: [],
    unclassifiedAttributeNames: [],
    ...overrides,
  };
}

function createOntologyInspectionSnapshotSource() {
  const personReference = {
    kind: "class",
    iri: "https://example.test/Person",
  };
  const agentReference = {
    kind: "class",
    iri: "https://example.test/Agent",
  };
  const stringReference = {
    kind: "datatype",
    iri: "http://www.w3.org/2001/XMLSchema#string",
  };
  const nameReference = {
    kind: "property",
    iri: "https://example.test/name",
  };

  return {
    availableLabelLanguages: ["en", "fr"],
    classRecords: [
      {
        ontologyElementReference: personReference,
        ...describedElementFields({
          labelRecords: [
            { languageTag: "en", text: "Person" },
            { languageTag: "fr", text: "Personne" },
          ],
          commentRecords: [{ languageTag: null, text: "A human being" }],
          annotationRecords: [
            {
              localName: "term_status",
              propertyIri: null,
              languageTag: null,
              text: "stable",
              valueKind: "literal",
            },
          ],
        }),
        superclassReferences: [agentReference],
        equivalentClassReferences: [],
        disjointClassReferences: [],
      },
    ],
    datatypeRecords: [
      {
        ontologyElementReference: stringReference,
        ...describedElementFields({
          labelRecords: [{ languageTag: "en", text: "string" }],
        }),
      },
    ],
    importRecords: [
      { importedOntologyIri: "https://example.test/imported-ontology" },
    ],
    individualRecords: [
      {
        ontologyElementReference: {
          kind: "individual",
          loadGeneration: 3,
          localId: "AnonymousIndividual7",
        },
        ...describedElementFields({
          labelRecords: [{ languageTag: null, text: "Anonymous person" }],
        }),
        classReferences: [personReference],
      },
    ],
    loadGeneration: 3,
    namespaceRecords: [{ prefix: "ex", namespaceIri: "https://example.test/" }],
    ontologyHeaderRecord: {
      ontologyIri: "https://example.test/ontology",
      versionInformationText: "Version 1.0",
      titleRecords: [{ languageTag: "en", text: "Example ontology" }],
      descriptionRecords: [
        { languageTag: "en", text: "An ontology used by contract tests" },
      ],
      authorNames: ["Ada Example"],
    },
    propertyRecords: [
      {
        ontologyElementReference: nameReference,
        ...describedElementFields({
          labelRecords: [{ languageTag: "en", text: "name" }],
          characteristicNames: ["functional"],
          unclassifiedAttributeNames: ["external"],
        }),
        cardinalityRecord: { exact: null, minimum: 1, maximum: null },
        domainReferences: [personReference],
        rangeReferences: [stringReference],
        superpropertyReferences: [],
        inversePropertyReferences: [],
        equivalentPropertyReferences: [],
        subpropertyReferences: [],
      },
    ],
  };
}

function expectPlainDataDeeplyFrozen(plainDataValue) {
  if (plainDataValue === null || typeof plainDataValue !== "object") {
    return;
  }
  expect(Object.isFrozen(plainDataValue)).toBe(true);
  if (Array.isArray(plainDataValue)) {
    expect(() => plainDataValue.push(undefined)).toThrow();
  } else {
    const existingFieldName = Object.keys(plainDataValue)[0];
    if (existingFieldName === undefined) {
      expect(() => {
        plainDataValue.unexpectedField = true;
      }).toThrow();
    } else {
      expect(() => {
        plainDataValue[existingFieldName] = undefined;
      }).toThrow();
    }
  }
  for (const nestedValue of Object.values(plainDataValue)) {
    expectPlainDataDeeplyFrozen(nestedValue);
  }
}

function createDetachedSvgRootFixture(marker = "detached-root") {
  return {
    localName: "svg",
    marker,
    namespaceURI: SVG_NAMESPACE_IRI,
    parentNode: null,
    cloneNode(includeDescendants) {
      if (includeDescendants !== true) {
        throw new TypeError("The SVG fixture requires a deep clone.");
      }
      return createDetachedSvgRootFixture(marker);
    },
  };
}

describe("rendered graph runtime interface", () => {
  test("declares the exact application-facing runtime method vocabulary", () => {
    expect(RENDERED_GRAPH_RUNTIME_METHOD_NAMES).toEqual([
      "replaceVowlModel",
      "clearRenderedGraph",
      "applyVisualizationView",
      "readVisibleRenderedGraphSnapshot",
      "readGraphLayoutSnapshot",
      "readRenderedArrangement",
      "setRenderedArrangement",
      "selectRenderedOccurrence",
      "setGraphLayoutPaused",
      "setContinuousZoom",
      "setForceLayoutDistances",
      "setVisualizationModes",
      "resetVisualization",
      "createRenderedSvgSnapshot",
      "createRenderedDrawingSnapshot",
      "createTurtleDocumentSnapshot",
      "subscribeToRenderedGraphEvents",
      "dispose",
    ]);
  });

  test("accepts a runtime implementing every required method", () => {
    const renderedGraphRuntime = Object.fromEntries(
      RENDERED_GRAPH_RUNTIME_METHOD_NAMES.map((methodName) => [
        methodName,
        () => undefined,
      ]),
    );

    expect(assertRenderedGraphRuntime(renderedGraphRuntime)).toBe(
      renderedGraphRuntime,
    );
  });

  test("rejects a runtime missing an application-facing method", () => {
    const renderedGraphRuntime = Object.fromEntries(
      RENDERED_GRAPH_RUNTIME_METHOD_NAMES.filter(
        (methodName) => methodName !== "createRenderedSvgSnapshot",
      ).map((methodName) => [methodName, () => undefined]),
    );

    expect(() => assertRenderedGraphRuntime(renderedGraphRuntime)).toThrow(
      "createRenderedSvgSnapshot",
    );
  });

  test("rejects a runtime that still exposes a retired reader", () => {
    // The ontology model is owned by the application, so a runtime offering to
    // read it has reopened a boundary the migration closed. This fails at the
    // contract rather than surviving as a second, renderer-owned source.
    const renderedGraphRuntime = Object.fromEntries(
      [
        ...RENDERED_GRAPH_RUNTIME_METHOD_NAMES,
        "readOntologyInspectionSnapshot",
      ].map((methodName) => [methodName, () => undefined]),
    );

    expect(() => assertRenderedGraphRuntime(renderedGraphRuntime)).toThrow(
      "readOntologyInspectionSnapshot",
    );
  });

  test("no longer declares an ontology-inspection reader", () => {
    expect(RENDERED_GRAPH_RUNTIME_METHOD_NAMES).not.toContain(
      "readOntologyInspectionSnapshot",
    );
    expect(RENDERED_GRAPH_RUNTIME_METHOD_NAMES).toContain(
      "readVisibleRenderedGraphSnapshot",
    );
  });
});

describe("rendered graph events", () => {
  test("records all applied display and force choices as standing view state", () => {
    const source = {
      language: "default",
      focus: [],
      filters: {
        datatypes: "show",
        objectProperties: "show",
        subclasses: "show",
        disjointness: "hide",
        setOperators: "show",
        minDegree: 0,
      },
      modes: {
        nodeScaling: true,
        compactNotation: false,
        colorExternals: true,
        pickAndPin: false,
        dynamicLabelWidth: true,
        maxLabelWidthPx: 120,
        colorExternalsMode: "same",
      },
      forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
    };
    const applied = createAppliedVisualizationView(source);
    expect(applied).toEqual(source);
    expect(Object.isFrozen(applied.modes)).toBe(true);
    expect(Object.isFrozen(applied.forceDistances)).toBe(true);
  });

  test("matches human slider limits and does not expose internal loop tuning", () => {
    for (const maxLabelWidthPx of [19, 601]) {
      expect(() =>
        createVisualizationModesRequest({ maxLabelWidthPx }),
      ).toThrow();
    }
    for (const classDistancePx of [9, 601]) {
      expect(() =>
        createForceLayoutDistancesRequest({ classDistancePx }),
      ).toThrow();
    }
    expect(() =>
      createForceLayoutDistancesRequest({ loopDistancePx: 100 }),
    ).toThrow();
  });

  test("declares the exact closed event-kind union", () => {
    expect(RENDERED_GRAPH_EVENT_KINDS).toEqual([
      "render-progress-changed",
      "render-warning-raised",
      "rendered-element-selection-changed",
      "document-record-selection-changed",
      "record-label-edit-requested",
      "viewport-changed",
      "visualization-view-changed",
      "degree-filter-range-changed",
      "graph-layout-state-changed",
      "editor-mode-changed",
    ]);
  });

  test("declares the display modes with every field optional", () => {
    expect(createVisualizationModesRequest({ colorExternals: true })).toEqual({
      colorExternals: true,
    });
    expect(createVisualizationModesRequest({ pickAndPin: true })).toEqual({
      pickAndPin: true,
    });
    expect(
      createVisualizationModesRequest({
        compactNotation: false,
        nodeScaling: true,
        dynamicLabelWidth: false,
        maxLabelWidthPx: 180,
      }),
    ).toEqual({
      compactNotation: false,
      nodeScaling: true,
      dynamicLabelWidth: false,
      maxLabelWidthPx: 180,
    });
    expect(() => createVisualizationModesRequest({})).toThrow();
    expect(() =>
      createVisualizationModesRequest({ colorExternals: "yes" }),
    ).toThrow();
    expect(() =>
      createVisualizationModesRequest({ maxLabelWidthPx: 0 }),
    ).toThrow();
    expect(
      createVisualizationModesRequest({ colorExternalsMode: "gradient" }),
    ).toEqual({ colorExternalsMode: "gradient" });
    expect(() =>
      createVisualizationModesRequest({ colorExternalsMode: "rainbow" }),
    ).toThrow();
    // Editor mode is a fact this plan publishes, never one a request sets.
    expect(() =>
      createVisualizationModesRequest({ editorMode: true }),
    ).toThrow();
  });

  test("declares force layout distances in pixels with every field optional", () => {
    expect(createForceLayoutDistancesRequest({ classDistancePx: 240 })).toEqual(
      { classDistancePx: 240 },
    );
    expect(
      createForceLayoutDistancesRequest({
        classDistancePx: 240,
        datatypeDistancePx: 90,
      }),
    ).toEqual({ classDistancePx: 240, datatypeDistancePx: 90 });
    expect(() => createForceLayoutDistancesRequest({})).toThrow();
    expect(() =>
      createForceLayoutDistancesRequest({ classDistancePx: 0 }),
    ).toThrow();
    expect(() =>
      createForceLayoutDistancesRequest({ classDistancePx: 240, charge: -50 }),
    ).toThrow();
  });

  test("declares a continuous zoom request with a closed direction union", () => {
    // A held zoom button reports that a gesture started and that it ended. The
    // renderer owns the animation between those two facts, so the control does
    // not write a magnification on every animation frame.
    for (const zoomDirection of ["in", "out", "none"]) {
      expect(createContinuousZoomRequest({ zoomDirection })).toEqual({
        zoomDirection,
      });
    }
    expect(() =>
      createContinuousZoomRequest({ zoomDirection: "up" }),
    ).toThrow();
    expect(() =>
      createContinuousZoomRequest({ zoomDirection: "in", extra: true }),
    ).toThrow();
  });

  test("accepts a continuous zoom scale in the visualization view", () => {
    // A slider must be able to write a level, not only step, because it also
    // has to follow pinch and wheel gestures performed on the visualization.
    const request = createVisualizationViewApplicationRequest({
      loadGeneration: 2,
      zoomScale: 1.75,
    });

    expect(request.zoomScale).toBe(1.75);
    expect(() =>
      createVisualizationViewApplicationRequest({
        loadGeneration: 2,
        zoomScale: 0,
      }),
    ).toThrow();
    expect(() =>
      createVisualizationViewApplicationRequest({
        loadGeneration: 2,
        zoomScale: "1.5",
      }),
    ).toThrow();
  });

  test("carries editor mode as a fact rather than a renderer query", () => {
    // A presentation module asks controller state what mode the application is
    // in; it never asks the renderer.
    const renderedGraphEvent = createRenderedGraphEvent({
      kind: "editor-mode-changed",
      loadGeneration: 2,
      payload: { isEditorMode: true },
    });

    expect(renderedGraphEvent.payload).toEqual({ isEditorMode: true });
    expect(Object.isFrozen(renderedGraphEvent.payload)).toBe(true);
    expect(() =>
      createRenderedGraphEvent({
        kind: "editor-mode-changed",
        loadGeneration: 2,
        payload: { isEditorMode: "yes" },
      }),
    ).toThrow();
  });

  test("accepts an absolute viewport translation separately from standing view choices", () => {
    const translation = { xPx: -180.5, yPx: 72 };
    const request = createVisualizationViewApplicationRequest({
      loadGeneration: 1,
      translation,
    });
    expect(request.translation).toEqual({ xPx: -180.5, yPx: 72 });
    expect(Object.isFrozen(request.translation)).toBe(true);
    expect(request.translation).not.toBe(translation);
    for (const invalid of [
      { xPx: 1 },
      { xPx: "1", yPx: 2 },
      { xPx: Infinity, yPx: 0 },
      { xPx: 1, yPx: 2, zPx: 3 },
    ]) {
      expect(() =>
        createVisualizationViewApplicationRequest({
          loadGeneration: 1,
          translation: invalid,
        }),
      ).toThrow();
    }
  });

  test("refuses the same out-of-range zoom requests at the shared runtime boundary", () => {
    for (const zoomScale of [0.001, 4.01]) {
      expect(() =>
        createVisualizationViewApplicationRequest({
          loadGeneration: 1,
          zoomScale,
        }),
      ).toThrow();
    }
  });

  test.each([
    [
      "render-progress-changed",
      { completedRenderedElementCount: 4, totalRenderedElementCount: 10 },
    ],
    [
      "render-warning-raised",
      { warningCode: "UNSUPPORTED_AXIOM", message: "Axiom omitted" },
    ],
    [
      "rendered-element-selection-changed",
      {
        selectedOntologyElementReferences: [
          { kind: "class", iri: "https://example.test/Person" },
        ],
      },
    ],
    [
      "viewport-changed",
      { zoomScale: 1.25, translationXPx: 12, translationYPx: -8 },
    ],
    [
      "graph-layout-state-changed",
      { forceAlpha: 0.04, hasEnded: false, isPaused: true },
    ],
  ])("creates an immutable %s event", (kind, payload) => {
    const event = createRenderedGraphEvent({
      kind,
      loadGeneration: 3,
      payload,
    });

    expect(event).toEqual({ kind, loadGeneration: 3, payload });
    expectPlainDataDeeplyFrozen(event);
  });

  test("copies a selection event before freezing it", () => {
    const sourceReference = {
      kind: "class",
      iri: "https://example.test/Person",
    };
    const payload = {
      selectedOntologyElementReferences: [sourceReference],
    };
    const event = createRenderedGraphEvent({
      kind: "rendered-element-selection-changed",
      loadGeneration: 3,
      payload,
    });

    sourceReference.iri = "https://example.test/Mutated";
    payload.selectedOntologyElementReferences.push({
      kind: "class",
      iri: "https://example.test/Other",
    });

    expect(event.payload.selectedOntologyElementReferences).toEqual([
      { kind: "class", iri: "https://example.test/Person" },
    ]);
    expect(event.payload).not.toBe(payload);
  });

  test("rejects an unknown event kind", () => {
    expect(() =>
      createRenderedGraphEvent({
        kind: "d3-tick",
        loadGeneration: 3,
        payload: {},
      }),
    ).toThrow("Unsupported rendered-graph event kind");
  });

  test("requires a positive load generation on every event", () => {
    expect(() =>
      createRenderedGraphEvent({
        kind: "viewport-changed",
        loadGeneration: 0,
        payload: { zoomScale: 1, translationXPx: 0, translationYPx: 0 },
      }),
    ).toThrow("loadGeneration");
  });

  test("rejects a payload belonging to a different event kind", () => {
    expect(() =>
      createRenderedGraphEvent({
        kind: "viewport-changed",
        loadGeneration: 3,
        payload: { forceAlpha: 0.1, hasEnded: false, isPaused: false },
      }),
    ).toThrow("viewport-changed payload");
  });
});

describe("ontology inspection snapshots", () => {
  test("creates the exact semantic ontology projection", () => {
    const source = createOntologyInspectionSnapshotSource();

    const snapshot = createOntologyInspectionSnapshot(source);

    expect(snapshot).toEqual(source);
    expectPlainDataDeeplyFrozen(snapshot);
  });

  test("copies every nested record, collection, and ontology-element reference", () => {
    const source = createOntologyInspectionSnapshotSource();
    const expectedSnapshot = createOntologyInspectionSnapshotSource();

    const snapshot = createOntologyInspectionSnapshot(source);

    source.ontologyHeaderRecord.titleRecords[0].text = "Mutated title";
    source.ontologyHeaderRecord.authorNames.push("Unexpected author");
    source.classRecords[0].ontologyElementReference.iri =
      "https://example.test/Mutated";
    source.classRecords[0].labelRecords.push({
      languageTag: "de",
      text: "Person",
    });
    source.classRecords[0].superclassReferences.length = 0;
    source.propertyRecords[0].domainReferences.length = 0;
    source.datatypeRecords[0].commentRecords.push({
      languageTag: null,
      text: "Unexpected",
    });
    source.individualRecords[0].classReferences.length = 0;
    source.namespaceRecords[0].prefix = "changed";
    source.importRecords[0].importedOntologyIri =
      "https://example.test/changed";
    source.availableLabelLanguages.push("de");

    expect(snapshot).toEqual(expectedSnapshot);
    expect(snapshot.classRecords).not.toBe(source.classRecords);
    expect(snapshot.classRecords[0]).not.toBe(source.classRecords[0]);
    expect(snapshot.classRecords[0].ontologyElementReference).not.toBe(
      source.classRecords[0].ontologyElementReference,
    );
  });

  test("rejects a renderer-shaped value instead of retaining it", () => {
    const source = createOntologyInspectionSnapshotSource();
    source.classRecords[0].rendererSelection = { node: () => ({}) };

    expect(() => createOntologyInspectionSnapshot(source)).toThrow(
      "class record",
    );
  });

  test("rejects a relationship reference with the wrong ontology kind", () => {
    const source = createOntologyInspectionSnapshotSource();
    source.propertyRecords[0].superpropertyReferences = [
      { kind: "class", iri: "https://example.test/NotAProperty" },
    ];

    expect(() => createOntologyInspectionSnapshot(source)).toThrow(
      "superpropertyReferences",
    );
  });
});

describe("visible rendered graph snapshots", () => {
  test("creates immutable stable references and matching visible counts", () => {
    const source = {
      loadGeneration: 3,
      visibleElementReferences: [
        { kind: "class", iri: "https://example.test/Person" },
      ],
      visibleRelationshipReferences: [
        { kind: "property", iri: "https://example.test/name" },
      ],
      visibleGraphCounts: {
        visibleNodeCount: 1,
        visiblePropertyCount: 1,
      },
    };

    const snapshot = createVisibleRenderedGraphSnapshot(source);

    source.visibleElementReferences[0].iri = "https://example.test/Mutated";
    expect(snapshot).toEqual({
      loadGeneration: 3,
      visibleElementReferences: [
        { kind: "class", iri: "https://example.test/Person" },
      ],
      visibleRelationshipReferences: [
        { kind: "property", iri: "https://example.test/name" },
      ],
      visibleGraphCounts: {
        visibleNodeCount: 1,
        visiblePropertyCount: 1,
      },
    });
    expectPlainDataDeeplyFrozen(snapshot);
  });

  test("rejects visible counts that disagree with the projected references", () => {
    expect(() =>
      createVisibleRenderedGraphSnapshot({
        loadGeneration: 3,
        visibleElementReferences: [],
        visibleRelationshipReferences: [],
        visibleGraphCounts: {
          visibleNodeCount: 1,
          visiblePropertyCount: 0,
        },
      }),
    ).toThrow("visibleNodeCount");
  });
});

describe("graph layout snapshots", () => {
  test("copies and freezes generation-scoped layout coordinates", () => {
    const sourcePosition = {
      stableLayoutElementKey: "class:https://example.test/Person",
      x: 10.5,
      y: -2,
    };
    const source = {
      forceAlpha: 0.004,
      hasEnded: false,
      heightPx: 720,
      isPaused: false,
      layoutElementPositions: [sourcePosition],
      loadGeneration: 3,
      observedAtMs: 250.5,
      widthPx: 1280,
    };

    const snapshot = createGraphLayoutSnapshot(source);

    sourcePosition.x = 999;
    expect(snapshot).toEqual({
      forceAlpha: 0.004,
      hasEnded: false,
      heightPx: 720,
      isPaused: false,
      layoutElementPositions: [
        {
          stableLayoutElementKey: "class:https://example.test/Person",
          x: 10.5,
          y: -2,
        },
      ],
      loadGeneration: 3,
      observedAtMs: 250.5,
      widthPx: 1280,
    });
    expectPlainDataDeeplyFrozen(snapshot);
  });

  test("rejects duplicate stable layout-element keys", () => {
    expect(() =>
      createGraphLayoutSnapshot({
        forceAlpha: 0.2,
        hasEnded: false,
        heightPx: 600,
        isPaused: false,
        layoutElementPositions: [
          { stableLayoutElementKey: "class:person", x: 1, y: 2 },
          { stableLayoutElementKey: "class:person", x: 3, y: 4 },
        ],
        loadGeneration: 3,
        observedAtMs: 100,
        widthPx: 800,
      }),
    ).toThrow("stableLayoutElementKey");
  });
});

describe("rendered SVG snapshots", () => {
  test("owns a deep detached SVG clone without retaining the supplied DOM node", () => {
    const sourceRoot = createDetachedSvgRootFixture();

    const snapshot = createRenderedSvgSnapshot({
      detachedSvgRoot: sourceRoot,
      heightPx: 720,
      loadGeneration: 3,
      widthPx: 1280,
    });

    expect(snapshot).toEqual({
      detachedSvgRoot: expect.objectContaining({
        localName: "svg",
        marker: "detached-root",
        namespaceURI: SVG_NAMESPACE_IRI,
        parentNode: null,
      }),
      heightPx: 720,
      loadGeneration: 3,
      widthPx: 1280,
    });
    expect(snapshot.detachedSvgRoot).not.toBe(sourceRoot);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  test("rejects a live SVG root", () => {
    const sourceRoot = createDetachedSvgRootFixture();
    sourceRoot.parentNode = { localName: "main" };

    expect(() =>
      createRenderedSvgSnapshot({
        detachedSvgRoot: sourceRoot,
        heightPx: 720,
        loadGeneration: 3,
        widthPx: 1280,
      }),
    ).toThrow("detachedSvgRoot");
  });

  test("rejects a D3 selection instead of treating it as an SVG root", () => {
    expect(() =>
      createRenderedSvgSnapshot({
        detachedSvgRoot: { node: () => createDetachedSvgRootFixture() },
        heightPx: 720,
        loadGeneration: 3,
        widthPx: 1280,
      }),
    ).toThrow("detachedSvgRoot");
  });
});

describe("rendered graph requests and results", () => {
  test("publishes an immutable degree range with its automatic collapse minimum", () => {
    const event = createRenderedGraphEvent({
      kind: "degree-filter-range-changed",
      loadGeneration: 4,
      payload: { maximumDegree: 125, automaticMinimumDegree: 2 },
    });
    expect(event.payload).toEqual({
      maximumDegree: 125,
      automaticMinimumDegree: 2,
    });
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(() =>
      createRenderedGraphEvent({
        kind: "degree-filter-range-changed",
        loadGeneration: 4,
        payload: { maximumDegree: 1, automaticMinimumDegree: 2 },
      }),
    ).toThrow();
  });

  test("validates and owns initial visualization choices before replacement", () => {
    const initialVisualization = {
      view: {
        layout: "pause",
        zoomScale: 0.5,
        translation: { xPx: 0, yPx: -20 },
        filters: { minDegree: 0 },
      },
      modes: { dynamicLabelWidth: false },
      forceDistances: { classDistancePx: 300 },
    };
    const request = createVowlModelReplacementRequest({
      loadGeneration: 3,
      vowlModel: { header: {} },
      initialVisualization,
    });
    initialVisualization.view.translation.xPx = 900;
    expect(request.initialVisualization.view.translation).toEqual({
      xPx: 0,
      yPx: -20,
    });
    expectPlainDataDeeplyFrozen(request);
    expect(() =>
      createVowlModelReplacementRequest({
        loadGeneration: 4,
        vowlModel: {},
        initialVisualization: { view: { zoomScale: 8 } },
      }),
    ).toThrow(/zoomScale/);
  });

  test("copies and freezes an opaque VOWL model replacement request", () => {
    const vowlModel = {
      class: [{ id: "1", type: "owl:Class" }],
      header: { iri: "https://example.test/ontology" },
    };

    const request = createVowlModelReplacementRequest({
      loadGeneration: 3,
      vowlModel,
    });

    vowlModel.class[0].id = "mutated";
    expect(request).toEqual({
      loadGeneration: 3,
      vowlModel: {
        class: [{ id: "1", type: "owl:Class" }],
        header: { iri: "https://example.test/ontology" },
      },
    });
    expectPlainDataDeeplyFrozen(request);
  });

  test("creates a replacement result only for its completed generation", () => {
    expect(createVowlModelReplacementResult({ loadGeneration: 3 })).toEqual({
      loadGeneration: 3,
    });
  });

  test("accepts advancing the viewport to the next focused element", () => {
    const request = createVisualizationViewApplicationRequest({
      focus: [{ kind: "class", iri: "https://example.test/Person" }],
      loadGeneration: 3,
      viewport: "focus-next",
    });

    // Locating a search result brings one focused element into view at a
    // time, which fitting the whole graph cannot express.
    expect(request.viewport).toBe("focus-next");
  });

  test("rejects an unknown viewport directive", () => {
    expect(() =>
      createVisualizationViewApplicationRequest({
        loadGeneration: 3,
        viewport: "locate",
      }),
    ).toThrow();
  });

  test("creates an exact partial visualization-view application request", () => {
    const request = createVisualizationViewApplicationRequest({
      filters: { datatypes: "hide", minDegree: 2 },
      focus: [{ kind: "class", iri: "https://example.test/Person" }],
      language: "en",
      layout: "resume",
      loadGeneration: 3,
      viewport: "zoom-and-center",
    });

    expect(request).toEqual({
      filters: { datatypes: "hide", minDegree: 2 },
      focus: [{ kind: "class", iri: "https://example.test/Person" }],
      language: "en",
      layout: "resume",
      loadGeneration: 3,
      viewport: "zoom-and-center",
    });
    expectPlainDataDeeplyFrozen(request);
  });

  test.each([
    { layout: "preserve" },
    { viewport: "preserve" },
    { viewport: "fit" },
    { zoomScale: null },
  ])("rejects redundant or misleading view directives: %j", (directive) => {
    expect(() =>
      createVisualizationViewApplicationRequest({
        loadGeneration: 3,
        ...directive,
      }),
    ).toThrow();
  });

  test("omission requests no layout or viewport action", () => {
    expect(
      createVisualizationViewApplicationRequest({ loadGeneration: 3 }),
    ).toEqual({ loadGeneration: 3 });
  });

  test("accepts the human slider's minimum degree above 100", () => {
    expect(
      createVisualizationViewApplicationRequest({
        filters: { minDegree: 125 },
        loadGeneration: 3,
      }).filters.minDegree,
    ).toBe(125);
  });

  test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    "rejects an invalid visualization minimum degree %s",
    (minDegree) => {
      expect(() =>
        createVisualizationViewApplicationRequest({
          filters: { minDegree },
          loadGeneration: 3,
        }),
      ).toThrow("minDegree");
    },
  );

  test("returns the applied view with its visible rendered graph snapshot", () => {
    const result = createVisualizationViewApplicationResult({
      appliedVisualizationView: {
        filters: {
          datatypes: "hide",
          disjointness: "show",
          minDegree: 2,
          objectProperties: "show",
          setOperators: "show",
          subclasses: "show",
        },
        focus: [{ kind: "class", iri: "https://example.test/Person" }],
        language: "en",
        modes: {
          colorExternals: true,
          compactNotation: false,
          nodeScaling: true,
          dynamicLabelWidth: true,
          pickAndPin: false,
          maxLabelWidthPx: 120,
          colorExternalsMode: "same",
        },
        forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
      },
      loadGeneration: 3,
      visibleRenderedGraphSnapshot: {
        loadGeneration: 3,
        visibleElementReferences: [
          { kind: "class", iri: "https://example.test/Person" },
        ],
        visibleRelationshipReferences: [],
        visibleGraphCounts: {
          visibleNodeCount: 1,
          visiblePropertyCount: 0,
        },
      },
    });

    expect(result.loadGeneration).toBe(3);
    expect(result.appliedVisualizationView.language).toBe("en");
    expect(Object.keys(result.appliedVisualizationView).sort()).toEqual([
      "filters",
      "focus",
      "forceDistances",
      "language",
      "modes",
    ]);
    expect(result.visibleRenderedGraphSnapshot.visibleGraphCounts).toEqual({
      visibleNodeCount: 1,
      visiblePropertyCount: 0,
    });
    expectPlainDataDeeplyFrozen(result);
  });

  test("rejects a result whose visible snapshot belongs to another generation", () => {
    expect(() =>
      createVisualizationViewApplicationResult({
        appliedVisualizationView: {
          filters: {
            datatypes: "show",
            disjointness: "show",
            minDegree: 0,
            objectProperties: "show",
            setOperators: "show",
            subclasses: "show",
          },
          focus: [],
          language: "en",
          modes: {
            colorExternals: true,
            compactNotation: false,
            nodeScaling: true,
            dynamicLabelWidth: true,
            pickAndPin: false,
            maxLabelWidthPx: 120,
            colorExternalsMode: "same",
          },
          forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
        },
        loadGeneration: 3,
        visibleRenderedGraphSnapshot: {
          loadGeneration: 2,
          visibleElementReferences: [],
          visibleRelationshipReferences: [],
          visibleGraphCounts: {
            visibleNodeCount: 0,
            visiblePropertyCount: 0,
          },
        },
      }),
    ).toThrow("loadGeneration");
  });

  test("creates exact graph-layout pause request and result values", () => {
    expect(
      createGraphLayoutPauseRequest({ isPaused: true, loadGeneration: 3 }),
    ).toEqual({ isPaused: true, loadGeneration: 3 });
    expect(
      createGraphLayoutPauseResult({
        isPaused: true,
        layoutStatus: "paused",
        loadGeneration: 3,
      }),
    ).toEqual({
      isPaused: true,
      layoutStatus: "paused",
      loadGeneration: 3,
    });
  });

  test("creates an exact generation-scoped SVG-snapshot request", () => {
    expect(createRenderedSvgSnapshotRequest({ loadGeneration: 3 })).toEqual({
      loadGeneration: 3,
    });
  });

  test("rejects unknown fields on a runtime request", () => {
    expect(() =>
      createRenderedSvgSnapshotRequest({
        graph: { nodes: [] },
        loadGeneration: 3,
      }),
    ).toThrow("rendered SVG snapshot request");
  });
});
