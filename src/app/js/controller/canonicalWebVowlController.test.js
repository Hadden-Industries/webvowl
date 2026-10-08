import { jest } from "@jest/globals";
import { ResourceLimitError } from "owlapi/io";
import { createCanonicalWebVowlController } from "./canonicalWebVowlController.js";
import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "./canonicalVowlWorkerOperations.js";
import { createCanonicalVowlSourceAcquisition } from "./canonicalVowlSourceAcquisition.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup() {
  let listener;
  let accepted;
  const runtime = {
    subscribeToRenderedGraphEvents(callback) {
      listener = callback;
      return () => {};
    },
    readVisualizationView: () => ({ language: "en" }),
    readVisualizationViewport: () => ({
      zoomScale: 1,
      translation: { xPx: 0, yPx: 0 },
    }),
    readGraphLayoutSnapshot: () => ({ isPaused: true }),
    dispose() {},
  };
  const session = {
    load: jest.fn(async () => {
      accepted = {
        loadGeneration: (accepted?.loadGeneration ?? 0) + 1,
        documentRevision: 0,
        inspection: { diagnostics: [] },
      };
      return accepted;
    }),
    snapshot: () => accepted,
    identity: () => accepted,
    dispose() {},
    exportCanonicalArtifact: jest.fn(async () => ({ format: "vowl-json" })),
    exportTurtleArtifact: jest.fn(async () => ({ format: "turtle" })),
    exportOriginalSourceArtifact: jest.fn(async () => ({ format: "original" })),
  };
  const acquisition = {
    remote: jest.fn(async (documentIri) => ({ documentIri })),
    resolveImport() {},
  };
  const artifacts = { dispose() {} };
  const controller = createCanonicalWebVowlController({
    renderedGraphRuntime: runtime,
    documentSession: session,
    sourceAcquisition: acquisition,
    visualizationArtifactService: artifacts,
  });
  const load = (documentIri) =>
    controller.loadOntology({
      source: { kind: "ontology-document-iri", documentIri },
    });
  return {
    controller,
    load,
    acquisition,
    session,
    artifacts,
    runtime,
    emit: (event) => listener(event),
  };
}

test("the candidate controller preserves selection through rename and focuses newly revealed elements", async () => {
  const { runtime, artifacts } = setup();
  let emit;
  runtime.subscribeToRenderedGraphEvents = (callback) => {
    emit = callback;
    return () => {};
  };
  let drawing;
  runtime.replaceCanonicalDrawing = async (request) => {
    drawing = request;
  };
  runtime.clearRenderedGraph = () => {};
  const session = createCanonicalVowlDocumentSession({
    workerClient: {
      async run(request, context) {
        const received = JSON.parse(
          JSON.stringify({ ...request, bytes: undefined }),
        );
        if (request.bytes) {
          received.bytes = new Uint8Array(request.bytes);
        }
        if (request.checkpoint?.source) {
          received.checkpoint.source.sources =
            request.checkpoint.source.sources.map(({ document, bytes }) => ({
              document,
              bytes: new Uint8Array(bytes),
            }));
        }
        const result = await runCanonicalVowlOperation(
          received,
          undefined,
          context,
        );
        return {
          ...result,
          loadGeneration: context.loadGeneration,
          baseRevision: context.baseRevision,
        };
      },
      dispose() {},
    },
  });
  const controller = createCanonicalWebVowlController({
    renderedGraphRuntime: runtime,
    visualizationArtifactService: artifacts,
    documentSession: session,
    sourceAcquisition: createCanonicalVowlSourceAcquisition(),
  });
  runtime.applyCanonicalDrawingRevision = (request) => {
    drawing = request;
  };
  runtime.readCanonicalDrawingState = () => {
    const snapshot = session.snapshot();
    return {
      loadGeneration: snapshot.loadGeneration,
      documentRevision: snapshot.documentRevision,
      placements: snapshot.visualization.placements,
      camera: snapshot.visualization.camera,
    };
  };
  runtime.readVisibleRenderedGraphSnapshot = () => ({
    loadGeneration: session.snapshot().loadGeneration,
    visibleElementReferences: drawing.drawing.applicationBindings
      .filter(({ occurrence }) =>
        drawing.drawing.nodes.some(
          (node) => node.occurrence === occurrence && !node.hidden,
        ),
      )
      .flatMap(({ semanticReferences }) => semanticReferences),
    visibleRelationshipReferences: [],
  });
  runtime.applyVisualizationView = jest.fn(async () => {});
  runtime.resizeVisualizationViewport = jest.fn();
  controller.resizeVisualizationViewport({
    widthPx: 800,
    heightPx: 600,
    occludedLeftWidthPx: 0,
    isTouchDevice: false,
  });
  await controller.loadOntology({
    source: {
      kind: "ontology-text",
      text: "Ontology(<urn:test> Declaration(Class(<urn:Class>)))",
      documentIri: "urn:input",
      format: "functional",
      displayName: "input.ofn",
    },
  });
  expect(controller.getState()).toMatchObject({
    status: "ready",
    loadGeneration: 1,
    documentRevision: 0,
  });
  expect(drawing.drawing.nodes).toHaveLength(1);
  expect(drawing.drawing.camera.center).toEqual({ x: 400, y: 300 });
  const initialPosition = drawing.drawing.nodes[0].position;
  expect(Number.isFinite(initialPosition.x)).toBe(true);
  expect(Number.isFinite(initialPosition.y)).toBe(true);
  expect(
    Math.hypot(initialPosition.x - 400, initialPosition.y - 300),
  ).toBeLessThan(10);
  expect(controller.getOntologyEditorView().metadata).toBeDefined();
  expect(controller.resolveOntologyEditorIri("urn:Class")).toBe("urn:Class");
  const reference =
    session.inspectOntology().classRecords[0].ontologyElementReference;
  const target = session.target(
    session.snapshot().inspection.records.roles[0].id,
  );
  emit({
    kind: "rendered-element-selection-changed",
    loadGeneration: 1,
    payload: { selectedOntologyElementReferences: [reference] },
  });
  emit({
    kind: "document-record-selection-changed",
    loadGeneration: 1,
    payload: { recordTarget: target },
  });
  await controller.editOntologyRecord({
    loadGeneration: 1,
    documentRevision: 0,
    recordTarget: target,
    changes: { iri: "urn:Renamed" },
  });
  expect(controller.getState().selection).toEqual([
    { ...reference, iri: "urn:Renamed" },
  ]);
  expect(controller.getState().selectedDocumentRecord).toEqual(target);
  await controller.setVisualizationView({ filters: { minDegree: 1 } });
  expect(
    runtime.readVisibleRenderedGraphSnapshot().visibleElementReferences,
  ).toEqual([]);
  const renamed = controller.getState().selection[0];
  await controller.setVisualizationView({
    filters: { minDegree: 0 },
    focus: [renamed],
  });
  expect(runtime.applyVisualizationView).toHaveBeenLastCalledWith(
    expect.objectContaining({ focus: [renamed] }),
    { signal: undefined },
  );
  await controller.loadOntology({
    source: {
      kind: "ontology-text",
      documentIri: "urn:datatypes",
      format: "functional",
      text: `Ontology(<urn:datatypes>
      Declaration(DataProperty(<urn:p>)) Declaration(DataProperty(<urn:q>))
      DataPropertyRange(<urn:p> <http://www.w3.org/2001/XMLSchema#string>)
      DataPropertyRange(<urn:q> <http://www.w3.org/2001/XMLSchema#string>))`,
    },
  });
  const beforeDatatype = session.snapshot();
  const roleForIri = (inspection, iri) => {
    const subject = inspection.records.subjects.find(
      (record) => record.iri === iri,
    );
    return inspection.records.roles.find(
      (record) => record.subject === subject?.id,
    )?.id;
  };
  const datatypeTarget = session.target(
    roleForIri(
      beforeDatatype.inspection,
      "http://www.w3.org/2001/XMLSchema#string",
    ),
  );
  const datatypeRequest = {
    loadGeneration: beforeDatatype.loadGeneration,
    recordTarget: datatypeTarget,
    changes: { datatypeName: "xsd:integer" },
  };
  await expect(controller.editOntologyRecord(datatypeRequest)).rejects.toThrow(
    /datatype context/,
  );
  const selectedOccurrence = beforeDatatype.inspection.occurrences.find(
    (entry) =>
      entry.kind === "datatype-node" &&
      entry.context.properties.includes(
        roleForIri(beforeDatatype.inspection, "urn:p"),
      ),
  );
  const binding = drawing.drawing.applicationBindings.find(
    (entry) => entry.occurrence === selectedOccurrence.id,
  );
  emit({
    kind: "document-record-selection-changed",
    loadGeneration: beforeDatatype.loadGeneration,
    payload: {
      recordTarget: datatypeTarget,
      occurrence: binding.runtimeReference,
    },
  });
  await expect(
    controller.loadOntology({ source: { kind: "unsupported" } }),
  ).rejects.toThrow();
  await expect(
    controller.loadOntology(
      { source: { kind: "ontology-text", text: "invalid" } },
      { signal: AbortSignal.abort() },
    ),
  ).rejects.toThrow();
  await controller.editOntologyRecord(datatypeRequest);
  const afterDatatype = session.snapshot().inspection;
  for (const [property, datatype] of [
    ["urn:p", "integer"],
    ["urn:q", "string"],
  ]) {
    expect(afterDatatype.records.constructs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "data-range",
          property: roleForIri(afterDatatype, property),
          target: roleForIri(
            afterDatatype,
            `http://www.w3.org/2001/XMLSchema#${datatype}`,
          ),
        }),
      ]),
    );
  }
  controller.dispose();
});

test("a failed replacement of a pending load restores the last accepted document", async () => {
  const { controller, load, acquisition, session } = setup();
  await load("urn:accepted");
  const pending = deferred();
  acquisition.remote.mockImplementationOnce(() => pending.promise);
  const superseded = load("urn:pending");
  const failure = expect(superseded).rejects.toThrow();
  acquisition.remote.mockRejectedValueOnce(new Error("offline"));
  await expect(load("urn:failed")).rejects.toThrow("offline");
  expect(controller.getState()).toMatchObject({
    status: "error",
    loadGeneration: 1,
    source: { identity: "urn:accepted" },
    error: { code: "LOAD_FAILED" },
  });
  pending.resolve({ documentIri: "urn:pending" });
  await failure;
  expect(session.load).toHaveBeenCalledTimes(1);
  expect(controller.getState().source.identity).toBe("urn:accepted");
});

test("failed initial overlapping loads report an error, never a stranded loading state", async () => {
  const { controller, load, acquisition } = setup();
  const pending = deferred();
  acquisition.remote.mockImplementationOnce(() => pending.promise);
  const first = load("urn:first");
  const failure = expect(first).rejects.toThrow();
  acquisition.remote.mockRejectedValueOnce(new Error("offline"));
  await expect(load("urn:second")).rejects.toThrow("offline");
  expect(controller.getState().status).toBe("error");
  pending.resolve({});
  await failure;
});

test("semantic exports delegate to the accepted session without a legacy model", async () => {
  const { controller, load, session, artifacts, runtime } = setup();
  await load("urn:accepted");
  await controller.exportVisualization({
    format: "turtle",
    filename: "current",
  });
  expect(session.exportTurtleArtifact).toHaveBeenCalledWith(
    expect.objectContaining({
      filename: "current",
      artifactService: artifacts,
      renderedGraphRuntime: runtime,
      source: { kind: "ontology-document-iri", identity: "urn:accepted" },
    }),
  );
  await controller.exportVisualization();
  expect(session.exportCanonicalArtifact).toHaveBeenCalledTimes(1);
  await controller.exportOriginalSource({
    documentId: "source-1",
    filename: "original.owl",
  });
  expect(session.exportOriginalSourceArtifact).toHaveBeenCalledWith(
    expect.objectContaining({
      documentId: "source-1",
      filename: "original.owl",
    }),
  );
});

test.each(["original", "turtle", "vowl-json"])(
  "%s publication is cancelled as soon as source replacement starts",
  async (format) => {
    const { controller, load, session, acquisition } = setup();
    await load("urn:first");
    const method =
      format === "original"
        ? "exportOriginalSourceArtifact"
        : format === "turtle"
          ? "exportTurtleArtifact"
          : "exportCanonicalArtifact";
    session[method].mockImplementation(
      ({ signal }) =>
        new Promise((resolve, reject) => {
          void resolve;
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const exporting =
      format === "original"
        ? controller.exportOriginalSource({ documentId: "root" })
        : controller.exportVisualization({ format });
    const failure = expect(exporting).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(controller.exportVisualization()).rejects.toMatchObject({
      code: "EXPORT_FAILED",
    });
    const remote = deferred();
    acquisition.remote.mockImplementationOnce(() => remote.promise);
    const loading = load("urn:replacement");
    await failure;
    expect(session.load).toHaveBeenCalledTimes(1);
    remote.resolve({ documentIri: "urn:replacement" });
    await loading;
  },
);

test("explicit layout intent is forwarded with the accepted generation", async () => {
  const { controller, runtime, load } = setup();
  await load("urn:first");
  runtime.setGraphLayoutPaused = jest.fn(() => ({ layoutStatus: "paused" }));
  controller.setGraphLayoutPaused({ isPaused: true });
  expect(runtime.setGraphLayoutPaused).toHaveBeenCalledWith({
    loadGeneration: 1,
    isPaused: true,
  });
  expect(controller.getState().layout.status).toBe("paused");
});

test("cancelled source-format selection restores the accepted document without an error", async () => {
  const { controller, load, acquisition, session } = setup();
  await load("urn:first");
  const before = controller.getState();
  acquisition.remote.mockRejectedValueOnce(
    new DOMException("Cancelled", "AbortError"),
  );
  await expect(load("urn:ambiguous")).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(controller.getState()).toEqual(before);
  expect(session.load).toHaveBeenCalledTimes(1);
});

test("import admission resumes only after a new explicit format choice", async () => {
  const { controller, load, acquisition, session } = setup();
  const choice = deferred();
  const context = {
    resolveImport() {},
    choosePendingFormats: jest.fn(() => choice.promise),
  };
  let requireFormat;
  acquisition.createImportContext = jest.fn((_bytes, { onFormatRequired }) => {
    requireFormat = onFormatRequired;
    return context;
  });
  session.load.mockImplementationOnce(async (_request, { signal }) => {
    requireFormat();
    signal.throwIfAborted();
  });
  const loading = load("urn:root");
  for (let turn = 0; turn < 5; turn++) {
    await Promise.resolve();
  }
  expect(controller.getState().status).toBe("loading");
  expect(session.load).toHaveBeenCalledTimes(1);
  expect(context.choosePendingFormats).toHaveBeenCalledTimes(1);
  choice.resolve(true);
  await loading;
  expect(session.load).toHaveBeenCalledTimes(2);
  expect(controller.getState().status).toBe("ready");
  context.choosePendingFormats.mockClear();
  session.load.mockImplementationOnce(async () => {
    requireFormat();
    throw new Error("Unrelated failure");
  });
  await expect(load("urn:other")).rejects.toThrow("Unrelated failure");
  expect(session.load).toHaveBeenCalledTimes(3);
  expect(context.choosePendingFormats).not.toHaveBeenCalled();
});

test("an import acquisition limit aborts admission as a failure, not a missing-import qualification", async () => {
  const { controller, load, acquisition, session } = setup();
  await load("urn:retained");
  let fail;
  acquisition.createImportContext = (_bytes, { onFailure }) => {
    fail = onFailure;
    return { resolveImport() {}, choosePendingFormats: jest.fn() };
  };
  const failure = Object.assign(new RangeError("Import byte limit"), {
    code: "RESOURCE_LIMIT_EXCEEDED",
  });
  session.load.mockImplementationOnce(async (_request, { signal }) => {
    fail(failure);
    signal.throwIfAborted();
  });
  await expect(load("urn:too-large")).rejects.toBe(failure);
  expect(controller.getState()).toMatchObject({
    status: "error",
    source: { identity: "urn:retained" },
    error: { details: { reason: "RESOURCE_LIMIT_EXCEEDED" } },
  });
});

test("worker expiry preserves the accepted document and exposes a useful bounded cause", async () => {
  const { controller, load, session } = setup();
  await load("urn:retained");
  const before = controller.getState();
  session.load.mockRejectedValueOnce(
    Object.assign(new Error("deadline exceeded"), {
      code: "DEADLINE_EXCEEDED",
      details: { stage: "worker", resource: "deadlineMs", source: "secret" },
    }),
  );
  await expect(load("urn:expired")).rejects.toMatchObject({
    code: "DEADLINE_EXCEEDED",
  });
  expect(controller.getState()).toMatchObject({
    source: before.source,
    loadGeneration: before.loadGeneration,
    documentRevision: before.documentRevision,
    error: {
      code: "LOAD_FAILED",
      message: expect.stringContaining("took too long"),
      details: {
        reason: "DEADLINE_EXCEEDED",
        stage: "worker",
        resource: "deadlineMs",
      },
    },
  });
  expect(controller.getState().error.details).not.toHaveProperty("source");
});

test.each([
  ["timeoutMs", "took too long"],
  ["maxRemoteDocumentBytes", "size limit"],
])(
  "remote %s failures preserve their owning resource and accepted source",
  async (resource, message) => {
    const { controller, load, acquisition } = setup();
    await load("urn:retained");
    acquisition.remote.mockRejectedValueOnce(
      new ResourceLimitError("Remote acquisition failed", {
        resource,
        source: "secret",
      }),
    );
    await expect(load("urn:failed")).rejects.toMatchObject({ resource });
    const state = controller.getState();
    expect(state).toMatchObject({
      source: { identity: "urn:retained" },
      error: {
        message: expect.stringContaining(message),
        details: { reason: "RESOURCE_LIMIT_EXCEEDED", resource },
      },
    });
    expect(state.error.details).not.toHaveProperty("source");
  },
);

test("remote syntax guidance does not offer an unavailable format interaction", async () => {
  const { controller, load, acquisition } = setup();
  acquisition.remote.mockRejectedValueOnce(
    Object.assign(new Error("mapping syntax invalid"), {
      code: "MAPPING_SYNTAX_INVALID",
    }),
  );
  await expect(load("urn:failed")).rejects.toMatchObject({
    code: "MAPPING_SYNTAX_INVALID",
  });
  expect(controller.getState().error.message).toContain("Check its syntax");
  expect(controller.getState().error.message).not.toContain(
    "choose its format",
  );
});

test("prefix commands validate the caller generation and strip only the application envelope", async () => {
  const { controller, load, session, runtime } = setup();
  await load("urn:first");
  session.setPrefix = jest.fn(() => session.snapshot());
  controller.setOntologyPrefix({
    loadGeneration: 1,
    name: "example",
    iri: "urn:example:",
  });
  expect(session.setPrefix).toHaveBeenCalledWith(
    { name: "example", iri: "urn:example:" },
    { renderedGraphRuntime: runtime },
  );
  await load("urn:second");
  expect(() =>
    controller.setOntologyPrefix({
      loadGeneration: 1,
      name: "stale",
      iri: "urn:stale:",
    }),
  ).toThrow("retired");
  expect(() =>
    controller.editOntologyMetadata({
      loadGeneration: 1,
      changes: { iri: "urn:stale" },
    }),
  ).toThrow("retired");
  expect(session.setPrefix).toHaveBeenCalledTimes(1);
});
