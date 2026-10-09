import { readFileSync } from "node:fs";
import { jest } from "@jest/globals";
import { decode, compatibleArtifactProfile } from "vowl";
import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "./canonicalVowlWorkerOperations.js";
import { loadCorpus } from "../../../../packages/vowl/conformance/supplemental/migration/review-cases.mjs";
import { applyCanonicalEditorCommand } from "./canonicalVowlEditorCommands.js";
import { createVisualizationArtifactService } from "./visualizationArtifactService.js";
import { webcrypto } from "node:crypto";
import { canonicalExampleSource } from "../canonicalExamples.js";

const bytes = new Uint8Array(
  readFileSync(
    new URL(
      "../../../../packages/vowl/conformance/vectors/named-pair-artifact/canonical.json",
      import.meta.url,
    ),
  ),
);
const request = () => ({ operation: "open-canonical-model", bytes });

test("fresh loads show exactly 50, explicit zero wins and saved visibility reopens with All", async () => {
  const { session } = setup();
  const source = {
    operation: "open-owl-model",
    documentIri: "urn:collapse",
    mediaType: "text/owl-functional",
    bytes: new TextEncoder().encode(`Ontology(<urn:collapse>
      Declaration(Class(<urn:Hub>))
      ${Array.from({ length: 60 }, (_, i) => `Declaration(Class(<urn:Leaf${i}>)) SubClassOf(<urn:Leaf${i}> <urn:Hub>)`).join("\n")}
    )`),
  };
  try {
    const automatic = await session.load(source);
    expect(automatic.nodesShown).toEqual({ mode: "auto" });
    expect(
      automatic.projection.nodes.filter((node) => !node.hidden),
    ).toHaveLength(50);
    expect(automatic.nodeCountStatus.shownNodeCount).toBe(50);
    const explicit = await session.load(source, {
      initialVisualization: {
        view: { nodesShown: { mode: "exact", requestedCount: 0 } },
      },
    });
    expect(explicit.nodesShown).toEqual({ mode: "exact", requestedCount: 0 });
    expect(
      explicit.projection.nodes.filter((node) => !node.hidden),
    ).toHaveLength(0);
    const saved = await session.capture();
    const restored = await session.load({
      operation: "open-canonical-model",
      bytes: saved,
    });
    expect(restored.visualization.hidden).toHaveLength(
      explicit.visualization.hidden.length,
    );
    expect(
      restored.projection.nodes.filter((node) => !node.hidden),
    ).toHaveLength(0);
    expect(restored.nodesShown).toEqual({ mode: "all" });
    const preset = await session.load(
      { operation: "open-canonical-model", bytes: saved },
      { useAutomaticNodesShown: true },
    );
    expect(preset.nodesShown).toEqual({ mode: "auto" });
    expect(preset.projection.nodes.filter((node) => !node.hidden)).toHaveLength(
      0,
    );
    expect((await session.load(source)).nodeCountStatus.shownNodeCount).toBe(
      50,
    );
    await session.load(source, {
      initialVisualization: {
        view: { nodesShown: { mode: "exact", requestedCount: 37 } },
      },
    });
    const partial = await session.capture();
    const reopened = await session.load({
      operation: "open-canonical-model",
      bytes: partial,
    });
    expect(reopened.nodesShown).toEqual({ mode: "all" });
    expect(reopened.nodeCountStatus).toMatchObject({
      eligibleNodeCount: 37,
      shownNodeCount: 37,
    });
    expect(await session.capture()).toEqual(partial);
  } finally {
    session.dispose();
  }
});

test.each([
  "benchmark",
  "foaf",
  "goodrelations",
  "muto",
  "ontovibe",
  "personasonto",
  "sioc",
])(
  "packaged preset %s automatically selects at most 50 visible nodes before presentation",
  async (name) => {
    const { session } = setup();
    try {
      expect(canonicalExampleSource(name)).toEqual({
        kind: "vowl-json-url",
        url: new URL(
          `../../../canonical-examples/${name}.json`,
          import.meta.url,
        ).href,
      });
      const bytes = new Uint8Array(
        readFileSync(
          new URL(`../../../canonical-examples/${name}.json`, import.meta.url),
        ),
      );
      const accepted = await session.load(
        { operation: "open-canonical-model", bytes },
        { useAutomaticNodesShown: true },
      );
      const visible = accepted.projection.nodes.filter((node) => !node.hidden);
      expect(visible.length).toBeGreaterThan(0);
      expect(visible.length).toBeLessThanOrEqual(50);
      expect(accepted.nodesShown).toEqual({ mode: "auto" });
      expect(visible.length).toBe(
        Math.min(50, accepted.nodeCountStatus.eligibleNodeCount),
      );
    } finally {
      session.dispose();
    }
  },
);

test("identity and source availability queries never clone a checkpoint", async () => {
  const { session } = setup();
  await session.load(request());
  const expected = session.snapshot();
  const clone = jest.spyOn(globalThis, "structuredClone");
  try {
    expect(session.identity()).toEqual({
      loadGeneration: expected.loadGeneration,
      documentRevision: expected.documentRevision,
    });
    const sources = session.originalSources();
    expect(sources.map(({ documentId }) => documentId)).toEqual(
      expected.inspection.documents.map(({ id }) => id),
    );
    expect(Object.isFrozen(sources)).toBe(true);
    expect(clone).not.toHaveBeenCalled();
  } finally {
    clone.mockRestore();
    session.dispose();
  }
});

test("initial visualization is prepared before acceptance and native failure restores prior controls", async () => {
  const { session } = setup();
  const previous = await session.load(request());
  const before = session.snapshot();
  let mounted = {
    loadGeneration: before.loadGeneration,
    documentRevision: 0,
    drawing: previous.projection,
  };
  const calls = [];
  let rejectOnce = true;
  const oldView = {
    focus: [],
    modes: { dynamicLabelWidth: false },
    forceDistances: { classDistancePx: 100 },
  };
  const runtime = {
    readVisualizationView: () => oldView,
    readGraphLayoutSnapshot: () => ({ isPaused: true }),
    readCanonicalDrawingState: () => ({
      loadGeneration: mounted.loadGeneration,
      documentRevision: mounted.documentRevision,
      placements: [...mounted.drawing.nodes, ...mounted.drawing.labels].map(
        (row) => ({
          occurrence: row.occurrence,
          position: row.position,
          pinned: row.pinned,
        }),
      ),
      camera: mounted.drawing.camera,
    }),
    async replaceCanonicalDrawing(candidate) {
      calls.push(candidate);
      mounted = candidate;
      if (rejectOnce) {
        rejectOnce = false;
        throw new Error("initial controls failed");
      }
    },
  };
  const initialVisualization = {
    view: {
      language: "IRI-based",
      nodesShown: { mode: "exact", requestedCount: 0 },
      layout: "resume",
    },
    modes: {
      compactNotation: true,
      nodeScaling: true,
      dynamicLabelWidth: true,
    },
    forceDistances: { classDistancePx: 180 },
  };
  await expect(
    session.load(request(), {
      renderedGraphRuntime: runtime,
      initialVisualization,
    }),
  ).rejects.toThrow("initial controls failed");
  expect(session.snapshot()).toEqual(before);
  expect(calls[0].drawing.nodes.every((node) => node.hidden)).toBe(true);
  expect(calls[0].drawing.labelSelection).toEqual({ mode: "iri" });
  expect(calls[0].drawing.display).toMatchObject({
    compactNotation: true,
    nodeScaling: "direct-membership",
  });
  expect(calls[0].initialVisualization).toEqual({
    view: { layout: "resume" },
    modes: { dynamicLabelWidth: true },
    forceDistances: { classDistancePx: 180 },
  });
  expect(calls[1].initialVisualization).toEqual({
    view: { focus: [] },
    modes: oldView.modes,
    forceDistances: oldView.forceDistances,
  });
  const accepted = await session.load(request(), {
    renderedGraphRuntime: runtime,
    initialVisualization,
  });
  expect(accepted.initialLayout).toBe("resume");
  expect(accepted.retainedHidden).toEqual(before.visualization.hidden);
  expect(accepted.visualization.hidden.length).toBeGreaterThan(0);
  expect(accepted.documentRevision).toBe(0);
});

test("edit visibility is prepared with new occurrences before atomic presentation", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  const changes = [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "new-subject", iri: "urn:new-hidden-class" },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: "new-role", subject: "new-subject", kind: "class" },
    },
  ];
  const visibility = (inspection) =>
    inspection.occurrences
      .filter(({ kind }) => kind === "class-node")
      .map(({ id }) => id);
  await expect(
    session.edit(changes, {
      prepareVisibility: visibility,
      prepareProjection(inspection, visualization) {
        expect(visualization.hidden).toEqual(visibility(inspection));
        throw new Error("projection rejected");
      },
    }),
  ).rejects.toThrow("projection rejected");
  expect(session.snapshot()).toEqual(before);
  const accepted = await session.edit(changes, {
    prepareVisibility: visibility,
  });
  expect(accepted.documentRevision).toBe(before.documentRevision + 1);
  expect(accepted.projection.nodes.every(({ hidden }) => hidden)).toBe(true);
  expect(accepted.visualization.hidden).toEqual(
    visibility(accepted.inspection),
  );
  expect(accepted.visualization.placements.length).toBeGreaterThan(
    before.visualization.placements.length,
  );
});

test("session publishes original bytes separately from the edited Turtle revision", async () => {
  const { session } = setup();
  const original = new TextEncoder().encode(
    "Ontology(<urn:root> Declaration(Class(<urn:A>)))",
  );
  await session.load({
    operation: "open-owl-model",
    bytes: original,
    documentIri: "urn:source",
    mediaType: "text/owl-functional",
  });
  const initial = session.snapshot();
  const subject = initial.inspection.records.subjects.find(
    ({ iri }) => iri === "urn:A",
  );
  await session.edit([
    {
      kind: "replace",
      id: subject.id,
      record: { ...subject, iri: "urn:Edited" },
    },
  ]);
  let blob;
  const service = createVisualizationArtifactService({
    svgSerializer: { serializeRenderedSvgSnapshot() {} },
    webCrypto: webcrypto,
    BlobConstructor: Blob,
    objectUrlApi: {
      createObjectURL(value) {
        blob = value;
        return "blob:source";
      },
      revokeObjectURL() {},
    },
    visualizationArtifactPublicationPort: { publishPageLocalArtifact() {} },
  });
  const common = {
    artifactService: service,
    source: { kind: "ontology-text" },
  };
  const sourceMetadata = await session.exportOriginalSourceArtifact({
    ...common,
    documentId: initial.inspection.documents[0].id,
    filename: "original.ofn",
  });
  expect(sourceMetadata.filename).toBe("original.ofn");
  expect(sourceMetadata.scope.kind).toBe("original-input");
  expect(new Uint8Array(await blob.arrayBuffer())).toEqual(original);
  const turtleMetadata = await session.exportTurtleArtifact({
    ...common,
    filename: "edited",
  });
  expect(turtleMetadata.filename).toBe("edited.ttl");
  expect(turtleMetadata.scope.revision).toBe(1);
  const text = await blob.text();
  expect(text).toContain("<urn:Edited>");
  expect(text).not.toContain("<urn:A>");
  service.dispose();
  session.dispose();
});

test("session exports admitted canonical bytes through the real artifact service and reloads them", async () => {
  const { session } = setup();
  await session.load(request());
  session.updateView({ display: { compactNotation: true } });
  let publishedBlob;
  const service = createVisualizationArtifactService({
    svgSerializer: { serializeRenderedSvgSnapshot() {} },
    webCrypto: webcrypto,
    BlobConstructor: Blob,
    objectUrlApi: {
      createObjectURL(blob) {
        publishedBlob = blob;
        return "blob:qualification";
      },
      revokeObjectURL() {},
    },
    visualizationArtifactPublicationPort: { publishPageLocalArtifact() {} },
  });
  const metadata = await session.exportCanonicalArtifact({
    artifactService: service,
    filename: "Saved",
    source: { kind: "canonical-vowl" },
  });
  expect(metadata.filename).toBe("Saved.vowl.json");
  expect(metadata.mediaType).toBe("application/json");
  const exported = new Uint8Array(await publishedBlob.arrayBuffer());
  const { session: reload } = setup();
  await reload.load({ operation: "open-canonical-model", bytes: exported });
  expect(reload.snapshot().visualization.display.compactNotation).toBe(true);
  expect(await reload.capture()).toEqual(exported);
  service.dispose();
});

test("a replacing load cancels canonical export during publication", async () => {
  const { session } = setup();
  await session.load(request());
  let entered;
  const publication = new Promise((resolve) => {
    entered = resolve;
  });
  const exporting = session.exportCanonicalArtifact({
    artifactService: {
      async createCanonicalVowlArtifact(_request, { signal }) {
        entered();
        await new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          }),
        );
      },
    },
  });
  const rejected = expect(exporting).rejects.toBeDefined();
  await publication;
  await session.load(request());
  await rejected;
});
const plain = (value) => JSON.parse(JSON.stringify(value));

test.each(["exportTurtleArtifact", "exportOriginalSourceArtifact"])(
  "replacement cancels %s through publication",
  async (method) => {
    const { session } = setup();
    await session.load({
      operation: "open-owl-model",
      bytes: new TextEncoder().encode("Ontology(Declaration(Class(<urn:A>)))"),
      documentIri: "urn:source",
      mediaType: "text/owl-functional",
    });
    let entered;
    const publication = new Promise((resolve) => {
      entered = resolve;
    });
    const exporting = session[method]({
      documentId: session.snapshot().inspection.documents[0].id,
      artifactService: {
        async createSemanticSourceArtifact(_request, { signal }) {
          entered();
          await new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () => reject(signal.reason), {
              once: true,
            }),
          );
        },
      },
    });
    const rejected = expect(exporting).rejects.toBeDefined();
    await publication;
    await session.load(request());
    await rejected;
    session.dispose();
  },
);

function setup() {
  const calls = [];
  const control = { before: async () => {}, after: (value) => value };
  const client = {
    async run(request, context) {
      calls.push({ request, context });
      await control.before(request, context);
      // Model a receiving worker realm. Jest's native structuredClone otherwise
      // creates host-realm prototypes which the package correctly rejects.
      const received = plain({ ...request, bytes: undefined });
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
      return control.after(
        {
          ...result,
          loadGeneration: context.loadGeneration,
          baseRevision: context.baseRevision,
        },
        request,
      );
    },
    dispose() {},
  };
  return {
    session: createCanonicalVowlDocumentSession({ workerClient: client }),
    calls,
    control,
  };
}

test("presentation changes are atomic, retain semantic revisions and survive capture", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  const ref = session.scene().reference(before.inspection.occurrences[0].id);
  const drawingState = {
    loadGeneration: before.loadGeneration,
    documentRevision: before.documentRevision,
    placements: before.visualization.placements,
    camera: before.visualization.camera,
  };
  const runtime = {
    readCanonicalDrawingState: () => drawingState,
    applyCanonicalDrawingRevision() {
      throw new Error("display failure");
    },
  };
  expect(() =>
    session.updateView(
      { display: { compactNotation: true } },
      { renderedGraphRuntime: runtime },
    ),
  ).toThrow("display failure");
  expect(session.snapshot()).toEqual(before);
  const result = session.updateView({
    hidden: [ref],
    display: { compactNotation: true },
    labelSelection: { mode: "language", range: "DE" },
  });
  expect(result.documentRevision).toBe(before.documentRevision);
  expect(result.checkpoint).toEqual(before.checkpoint);
  expect(result.visualization.placements).toEqual(
    before.visualization.placements,
  );
  expect(session.scene().resolve(ref)).toBe(
    before.inspection.occurrences[0].id,
  );
  const artifact = await decode(await session.capture());
  expect(artifact.visualization.display.compactNotation).toBe(true);
  expect(artifact.visualization.labelSelection).toEqual({
    mode: "language",
    range: "de",
  });
  expect(artifact.visualization.hidden).toHaveLength(
    result.visualization.hidden.length,
  );
});

test("prefix changes preserve semantic bytes and retain lexical IRI identity", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  const iri = "https://EXAMPLE.test:443/é/%2F#";
  session.setPrefix({ name: "chosen", iri });
  expect(session.resolveEditorIri("chosen:Local")).toBe(iri + "Local");
  expect(session.resolveEditorIri("urn:chosen:Local")).toBe("urn:chosen:Local");
  expect(() => session.resolveEditorIri("chosen:")).toThrow();
  expect(session.snapshot().documentRevision).toBe(before.documentRevision);
  expect(session.snapshot().checkpoint).toEqual(before.checkpoint);
  const after = session.snapshot();
  expect(() =>
    session.setPrefix({ name: "chosen", iri: "urn:duplicate:" }),
  ).toThrow();
  expect(() => session.setPrefix({ name: "rdf", iri })).toThrow();
  expect(() =>
    session.setPrefix({ name: "bad", iri: "relative/path" }),
  ).toThrow();
  expect(() =>
    session.updateView({
      prefixes: [
        { prefix: "a", iri },
        { prefix: "a", iri },
      ],
    }),
  ).toThrow();
  expect(session.snapshot()).toEqual(after);
  const saved = await decode(await session.capture());
  expect(saved.visualization.prefixes).toContainEqual({
    prefix: "chosen",
    iri,
  });
  session.setPrefix({ previousName: "chosen", name: "renamed", iri });
  expect(session.inspectEditor().prefixes.renamed).toBe(iri);
  session.removePrefix("renamed");
  expect(session.snapshot().visualization.prefixes).toEqual(
    before.visualization.prefixes,
  );
});

test.each(["subclass", "disjoint", "some", "all", "datatype"])(
  "creation selects normalized %s meaning and preserves the admitted projection",
  async (kind) => {
    const { session } = setup();
    const before = await session.load({
      operation: "open-owl-model",
      documentIri: "urn:root",
      mediaType: "text/owl-functional",
      bytes: new TextEncoder().encode(`Ontology(<urn:root>
        Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>))
        Declaration(ObjectProperty(<urn:p>)) SubClassOf(<urn:A> <urn:B>))`),
    });
    const target = (iri) => {
      const subject = before.inspection.records.subjects.find(
        (row) => row.iri === iri,
      );
      return session.target(
        before.inspection.records.roles.find(
          (row) => row.subject === subject.id,
        ).id,
      );
    };
    const result = await applyCanonicalEditorCommand(session, {
      documentRevision: 0,
      position: { x: 23, y: 47 },
      ...(kind === "datatype"
        ? {
            kind: "insert",
            roleKind: "data-property",
            iri: "urn:data",
            datatypeIri: "http://www.w3.org/2002/07/owl#real",
            domain: target("urn:A"),
          }
        : {
            kind: "insert-relation",
            relation: kind,
            from: target("urn:A"),
            to: target("urn:B"),
            ...(["some", "all"].includes(kind)
              ? { property: target("urn:p") }
              : {}),
          }),
    });
    const selected = session.resolveTarget(result.selectedTarget);
    const edge = result.inspection.occurrences.find(
      (row) => row.construct === selected || row.properties?.includes(selected),
    );
    if (["some", "all"].includes(kind)) {
      const assertion = result.inspection.records.constructs.find(
        (row) => row.id === selected,
      );
      expect(
        result.inspection.records.expressions.find(
          (row) => row.id === assertion.super,
        ).kind,
      ).toBe(`object-${kind}`);
      // These retained restrictions are details-only in the current profile.
      expect(edge).toBeUndefined();
    } else if (kind === "disjoint") {
      expect(edge.kind).toBe("disjoint-edge");
    } else {
      const label = result.inspection.occurrences.find(
        (row) => row.kind === "label" && row.edge === edge.id,
      );
      const endpointPositions = [edge.from, edge.to].map(
        (id) =>
          result.visualization.placements.find(
            (placement) => placement.occurrence === id,
          ).position,
      );
      expect(result.visualization.placements).toContainEqual(
        expect.objectContaining({
          occurrence: label.id,
          position:
            kind === "subclass"
              ? {
                  x: (endpointPositions[0].x + endpointPositions[1].x) / 2,
                  y: (endpointPositions[0].y + endpointPositions[1].y) / 2,
                }
              : { x: 23, y: 47 },
        }),
      );
    }
    expect(result.documentRevision).toBe(1);
  },
);

test("property conversion selects the resulting relation even when it normalizes to an existing assertion", async () => {
  const { session } = setup();
  const before = await session.load({
    operation: "open-owl-model",
    documentIri: "urn:root",
    mediaType: "text/owl-functional",
    bytes: new TextEncoder().encode(`Ontology(<urn:root>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(ObjectProperty(<urn:p>))
    ObjectPropertyDomain(<urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>) SubClassOf(<urn:A> <urn:B>))`),
  });
  const subject = before.inspection.records.subjects.find(
    ({ iri }) => iri === "urn:p",
  );
  const role = before.inspection.records.roles.find(
    (entry) => entry.subject === subject.id,
  );
  const target = session.target(role.id);
  const result = await applyCanonicalEditorCommand(session, {
    kind: "record",
    target,
    documentRevision: before.documentRevision,
    changes: { type: "rdfs:subClassOf" },
  });
  const selectedId = session.resolveTarget(result.selectedTarget);
  expect(
    result.inspection.records.constructs.find(({ id }) => id === selectedId)
      .kind,
  ).toBe("subclass");
  expect(
    result.inspection.records.subjects.some(({ iri }) => iri === "urn:p"),
  ).toBe(false);
  expect(result.created).toEqual([]);
  expect(() => session.resolveTarget(target)).toThrow();
});

test("human endpoint confirmation is exact, cancellable and invalidated by a replacement", async () => {
  const { session } = setup();
  await session.load({
    operation: "open-owl-model",
    bytes: new TextEncoder().encode(`Ontology(<urn:root>
      Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>))
      Declaration(ObjectProperty(<urn:p>)) Declaration(ObjectProperty(<urn:q>))
      ObjectPropertyDomain(Annotation(<urn:note> "keep") <urn:p> <urn:A>)
      InverseObjectProperties(<urn:p> <urn:q>))`),
    documentIri: "urn:root",
    mediaType: "text/owl-functional",
  });
  const before = session.snapshot();
  const target = (iri) => {
    const subject = before.inspection.records.subjects.find(
      (record) => record.iri === iri,
    );
    return session.target(
      before.inspection.records.roles.find(
        (record) => record.subject === subject.id,
      ).id,
    );
  };
  const command = {
    kind: "endpoint",
    documentRevision: 0,
    target: target("urn:p"),
    endpoint: "domain",
    endpointTarget: target("urn:B"),
  };
  await expect(
    applyCanonicalEditorCommand(session, command),
  ).rejects.toMatchObject({
    code: "EDITOR_INVERSE_DETACHMENT_REQUIRES_CONFIRMATION",
  });
  await expect(
    applyCanonicalEditorCommand(session, command, {
      confirmInverseDetachment: async () => false,
    }),
  ).rejects.toMatchObject({ code: "EDITOR_COMMAND_CANCELLED" });
  expect(session.snapshot()).toEqual(before);
  const edited = await applyCanonicalEditorCommand(session, command, {
    confirmInverseDetachment: async (proposal) => {
      expect(proposal.documentRevision).toBe(0);
      expect(proposal.relationships).toHaveLength(1);
      return true;
    },
  });
  expect(edited.documentRevision).toBe(1);
  expect(
    edited.inspection.records.constructs.some(
      ({ kind }) => kind === "inverse-properties",
    ),
  ).toBe(false);
  expect(
    edited.inspection.records.constructs.find(
      ({ kind }) => kind === "assertion-anchor",
    ).annotations[0].value.lexical,
  ).toBe("keep");
  await expect(
    applyCanonicalEditorCommand(session, command),
  ).rejects.toMatchObject({ code: "EDITOR_COMMAND_EXPIRED" });
});

test("a load during human confirmation cannot authorize an edit of the replacement", async () => {
  const { session } = setup();
  await session.load({
    operation: "open-owl-model",
    bytes: new TextEncoder()
      .encode(`Ontology(<urn:root> Declaration(Class(<urn:A>))
      Declaration(ObjectProperty(<urn:p>)) Declaration(ObjectProperty(<urn:q>))
      InverseObjectProperties(<urn:p> <urn:q>))`),
    documentIri: "urn:root",
    mediaType: "text/owl-functional",
  });
  const inspection = session.snapshot().inspection;
  const target = (iri) =>
    session.target(
      inspection.records.roles.find(
        (record) =>
          record.subject ===
          inspection.records.subjects.find((subject) => subject.iri === iri).id,
      ).id,
    );
  const command = {
    kind: "endpoint",
    documentRevision: 0,
    target: target("urn:p"),
    endpoint: "domain",
    endpointTarget: target("urn:A"),
  };
  await expect(
    applyCanonicalEditorCommand(session, command, {
      confirmInverseDetachment: async () => {
        await session.load(request());
        return true;
      },
    }),
  ).rejects.toMatchObject({ code: "EDITOR_COMMAND_EXPIRED" });
  expect(session.snapshot().loadGeneration).toBe(2);
  expect(session.snapshot().documentRevision).toBe(0);
});

test("human insertion selects normalized meaning and confirmed deletion reports actual losses", async () => {
  const { session } = setup();
  await session.load(request());
  const inserted = await applyCanonicalEditorCommand(session, {
    kind: "insert",
    documentRevision: 0,
    roleKind: "class",
    iri: "urn:Created",
    text: "Created",
    position: { x: 0, y: -7 },
  });
  const id = session.resolveTarget(inserted.selectedTarget);
  const occurrence = inserted.inspection.occurrences.find(
    (entry) => entry.kind === "class-node" && entry.targets.includes(id),
  );
  expect(inserted.visualization.placements).toContainEqual({
    occurrence: occurrence.id,
    position: { x: 0, y: -7 },
    pinned: false,
  });
  const again = await applyCanonicalEditorCommand(session, {
    kind: "insert",
    documentRevision: 1,
    roleKind: "class",
    iri: "urn:Created",
    text: "Created",
  });
  expect(again.created).toEqual([]);
  expect(again.selectedTarget).toEqual(inserted.selectedTarget);
  const before = session.snapshot();
  const deletion = {
    kind: "delete",
    documentRevision: 2,
    target: again.selectedTarget,
  };
  await expect(
    applyCanonicalEditorCommand(session, deletion, {
      confirmDeletion: async () => false,
    }),
  ).rejects.toMatchObject({ code: "EDITOR_COMMAND_CANCELLED" });
  expect(session.snapshot()).toEqual(before);
  const result = await applyCanonicalEditorCommand(session, deletion, {
    confirmDeletion: async (proposal) => {
      expect(
        proposal.removedRecords.map(({ record }) => record.kind),
      ).toContain("class");
      expect(proposal.annotationLosses).toHaveLength(1);
      expect(session.snapshot()).toEqual(before);
      return true;
    },
  });
  expect(
    result.inspection.records.subjects.some(({ iri }) => iri === "urn:Created"),
  ).toBe(false);
  expect(() => session.resolveTarget(again.selectedTarget)).toThrow();
});

test("human metadata version text preserves ontology version identity and unrelated annotations", async () => {
  const { session } = setup();
  await session.load({
    operation: "open-owl-model",
    bytes: new TextEncoder().encode(`Ontology(<urn:root> <urn:version>
    Annotation(<urn:note> "keep") Declaration(Class(<urn:A>)))`),
    documentIri: "urn:root",
    mediaType: "text/owl-functional",
  });
  const result = await applyCanonicalEditorCommand(session, {
    kind: "metadata",
    documentRevision: 0,
    changes: {
      version: "Human version",
      title: { language: "default", text: "Title" },
    },
  });
  expect(result.inspection.records.ontology.versionIri).toBe("urn:version");
  expect(result.inspection.records.ontology.annotations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        predicate: "urn:note",
        value: expect.objectContaining({ lexical: "keep" }),
      }),
      expect.objectContaining({
        predicate: "http://www.w3.org/2002/07/owl#versionInfo",
        value: expect.objectContaining({ lexical: "Human version" }),
      }),
    ]),
  );
});

test("OWL session save selects the qualified artifact and survives reload and further editing", async () => {
  const { session } = setup();
  const text = "Ontology(<urn:root> Declaration(Class(<urn:A>)))";
  await session.load({
    operation: "open-owl-model",
    bytes: new TextEncoder().encode(text),
    documentIri: "urn:root",
    mediaType: "text/owl-functional",
  });
  const saved = await session.capture();
  const document = await decode(saved);
  expect(document.profile).toBe(compatibleArtifactProfile);
  const reloaded = await session.load({
    operation: "open-canonical-model",
    bytes: saved,
  });
  expect(reloaded.inspection.qualifications.length).toBeGreaterThan(0);
  await session.edit(rename(reloaded.inspection, "urn:RenamedAfterReload"));
  const next = await decode(await session.capture());
  expect(next.profile).toBe(compatibleArtifactProfile);
  expect(
    next.structural.subjects.some(
      ({ iri }) => iri === "urn:RenamedAfterReload",
    ),
  ).toBe(true);
  session.dispose();
});

test("explicit legacy ingress reuses the independent artifact and preserves migration diagnostics", async () => {
  const corpus = await loadCorpus();
  const vector = corpus.runs.find(({ id }) => id === "named-class-artifact");
  const { session } = setup();
  const opened = await session.load({
    operation: "open-legacy-model",
    bytes: new Uint8Array(vector.bytes),
    dialect: vector.dialect,
    profile: vector.profile,
    resolutions: vector.resolutions,
  });
  expect(opened.initialLayout).toBe("pause");
  expect(opened.visualization.camera.center).toEqual({ x: 154, y: 124 });
  expect(opened.diagnostics).toEqual(
    expect.arrayContaining(
      vector.diagnostics.map((diagnostic) =>
        expect.objectContaining(diagnostic),
      ),
    ),
  );
  expect(new TextDecoder().decode(await session.capture())).toBe(
    vector.expected.canonicalBytes.text,
  );
  const before = session.snapshot();
  await expect(
    session.load({
      operation: "open-legacy-model",
      bytes: new Uint8Array(vector.bytes),
      profile: vector.profile,
      resolutions: vector.resolutions,
    }),
  ).rejects.toBeDefined();
  expect(session.snapshot()).toEqual(before);
  await session.edit(rename(before.inspection));
  const edited = await decode(await session.capture());
  expect(
    edited.structural.subjects.some(({ iri }) => iri === "urn:renamed"),
  ).toBe(true);
  session.dispose();
});
function rename(inspection, iri = "urn:renamed") {
  const subject = inspection.records.subjects.find(
    ({ iri }) => iri !== undefined,
  );
  return [{ kind: "replace", id: subject.id, record: { id: subject.id, iri } }];
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("drawing synchronization retains hidden state, captures camera and rejects stale or partial changes atomically", async () => {
  const { session } = setup();
  const loaded = await session.load(request());
  const [visible, hidden] = loaded.visualization.placements;
  session.scene().setVisibility([session.scene().reference(hidden.occurrence)]);
  const camera = { center: { x: -40, y: 70 }, zoom: 0.75 };
  const update = {
    loadGeneration: loaded.loadGeneration,
    documentRevision: loaded.documentRevision,
    placements: [{ ...visible, position: { x: 99, y: -123 }, pinned: true }],
    camera,
  };
  session.synchronizeDrawing(update);
  const saved = await decode(await session.capture());
  expect(saved.visualization.camera).toEqual(camera);
  expect(saved.visualization.placements).toContainEqual(
    expect.objectContaining({
      position: hidden.position,
      pinned: hidden.pinned,
    }),
  );
  expect(saved.visualization.hidden).toHaveLength(1);
  const before = session.snapshot();
  for (const invalid of [
    { ...update, documentRevision: 99 },
    { ...update, loadGeneration: 99 },
    { ...update, camera: { ...camera, zoom: 0 } },
    { ...update, placements: [...update.placements, ...update.placements] },
    {
      ...update,
      placements: [...update.placements, { ...hidden, occurrence: "missing" }],
    },
  ]) {
    expect(() => session.synchronizeDrawing(invalid)).toThrow();
    expect(session.snapshot()).toEqual(before);
  }
  session.dispose();
});

test("session edits live checkpoints, captures complete scenes and remains usable after capture failure", async () => {
  const { session, calls } = setup();
  const loaded = await session.load(request());
  expect(loaded.visualization.placements).toHaveLength(2);
  const scene = session.scene();
  const occurrence = scene.reference(loaded.inspection.occurrences[0].id);
  scene.arrange([
    { reference: occurrence, position: { x: 91, y: 47 }, pinned: true },
  ]);
  scene.setVisibility([occurrence]);
  const changes = rename(loaded.inspection);
  const target = session.target(changes[0].id);
  const changed = await session.edit(changes);
  expect(changed.documentRevision).toBe(1);
  expect(session.resolveTarget(target)).toBe(changes[0].id);
  expect(scene.resolve(occurrence)).toBe(changed.visualization.hidden[0]);
  expect(changed.visualization.placements).toContainEqual(
    expect.objectContaining({ position: { x: 91, y: 47 }, pinned: true }),
  );
  const before = session.snapshot();
  await expect(
    session.capture({ limits: { rdfQuads: 1 } }),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
  expect(session.snapshot()).toEqual(before);
  const artifact = await decode(await session.capture());
  expect(
    artifact.structural.subjects.some(({ iri }) => iri === "urn:renamed"),
  ).toBe(true);
  expect(artifact.visualization.hidden).toHaveLength(1);
  expect(artifact.visualization.placements).toContainEqual(
    expect.objectContaining({ position: { x: 91, y: 47 }, pinned: true }),
  );
  await session.edit(rename(changed.inspection, "urn:again"));
  expect(calls.map(({ request }) => request.operation)).toEqual([
    "open-canonical-model",
    "edit-model",
    "capture-model",
    "capture-model",
    "edit-model",
  ]);
});

test("failed replacement and render preparation preserve the accepted model, scene and targets", async () => {
  const { session } = setup();
  await session.load(request());
  const initial = session.snapshot();
  const target = session.target(initial.inspection.records.subjects[0].id);
  await expect(
    session.load({
      operation: "open-canonical-model",
      bytes: new TextEncoder().encode("invalid"),
    }),
  ).rejects.toBeDefined();
  expect(session.snapshot()).toEqual(initial);
  await expect(
    session.load(request(), {
      prepareProjection() {
        throw new Error("render failed");
      },
    }),
  ).rejects.toThrow("render failed");
  expect(session.snapshot()).toEqual(initial);
  expect(session.resolveTarget(target)).toBe(
    initial.inspection.records.subjects[0].id,
  );
  await expect(
    session.edit(rename(initial.inspection), {
      prepareProjection() {
        throw new Error("render failed");
      },
    }),
  ).rejects.toThrow("render failed");
  expect(session.snapshot()).toEqual(initial);
});

function presentationHarness(session) {
  let mounted;
  const generations = [];
  const control = { beforePaint: async () => {} };
  return {
    control,
    generations,
    runtime: {
      async replaceCanonicalDrawing(candidate) {
        mounted = candidate;
        generations.push(candidate.loadGeneration);
        await control.beforePaint(candidate);
      },
      readCanonicalDrawingState() {
        return {
          loadGeneration: mounted.loadGeneration,
          documentRevision: mounted.documentRevision,
          placements: session.snapshot().visualization.placements,
          camera: session.snapshot().visualization.camera,
        };
      },
      readGraphLayoutSnapshot: () => ({ isPaused: true }),
      clearRenderedGraph() {
        mounted = undefined;
      },
    },
  };
}

test("load presentation failure restores the previous mount without accepting the candidate", async () => {
  const { session } = setup();
  const { runtime, control, generations } = presentationHarness(session);
  await session.load(request(), { renderedGraphRuntime: runtime });
  const before = session.snapshot();
  control.beforePaint = async (candidate) => {
    if (candidate.loadGeneration === 2) {
      expect(session.snapshot()).toEqual(before);
      throw new Error("paint failed");
    }
  };
  await expect(
    session.load(request(), { renderedGraphRuntime: runtime }),
  ).rejects.toThrow("paint failed");
  expect(generations).toEqual([1, 2, 1]);
  expect(session.snapshot()).toEqual(before);
  expect(runtime.readCanonicalDrawingState().loadGeneration).toBe(1);
});

test("obsolete load recovery finishes before the newer load can present", async () => {
  const { session } = setup();
  const { runtime, control, generations } = presentationHarness(session);
  await session.load(request(), { renderedGraphRuntime: runtime });
  const entered = deferred();
  const finish = deferred();
  control.beforePaint = async (candidate) => {
    if (candidate.loadGeneration === 2) {
      entered.resolve();
      await finish.promise;
    }
  };
  const older = session.load(request(), { renderedGraphRuntime: runtime });
  const rejectedOlder = expect(older).rejects.toMatchObject({
    code: "LOAD_ABORTED",
  });
  await entered.promise;
  const newer = session.load(request(), { renderedGraphRuntime: runtime });
  finish.resolve();
  await rejectedOlder;
  const accepted = await newer;
  expect(generations).toEqual([1, 2, 1, 3]);
  expect(accepted.loadGeneration).toBe(3);
  expect(runtime.readCanonicalDrawingState().loadGeneration).toBe(3);
  expect(session.snapshot().loadGeneration).toBe(3);
});

test("failed load recovery reports both failures and preserves the semantic checkpoint", async () => {
  const { session } = setup();
  const { runtime, control } = presentationHarness(session);
  await session.load(request(), { renderedGraphRuntime: runtime });
  const before = session.snapshot();
  control.beforePaint = async () => {
    throw new Error("paint unavailable");
  };
  await expect(
    session.load(request(), { renderedGraphRuntime: runtime }),
  ).rejects.toMatchObject({
    code: "DOCUMENT_PRESENTATION_RECOVERY_FAILED",
    errors: [expect.any(Error), expect.any(Error)],
  });
  expect(session.snapshot()).toEqual(before);
});

test("native revision rejection leaves the model, scene and editable target at the accepted revision", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  const id = before.inspection.records.subjects[0].id;
  const target = session.target(id);
  const renderedGraphRuntime = {
    applyCanonicalDrawingRevision(candidate) {
      expect(candidate.baseRevision).toBe(before.documentRevision);
      expect(candidate.documentRevision).toBe(before.documentRevision + 1);
      expect(session.snapshot()).toEqual(before);
      throw new Error("native drawing failed");
    },
  };
  await expect(
    session.edit(rename(before.inspection), { renderedGraphRuntime }),
  ).rejects.toThrow("native drawing failed");
  expect(session.snapshot()).toEqual(before);
  expect(session.resolveTarget(target)).toBe(id);
  const accepted = await session.edit(rename(before.inspection));
  expect(accepted.documentRevision).toBe(before.documentRevision + 1);
});

test("synchronous presentation excludes reentrant scene mutation and document replacement", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  let replacement;
  const renderedGraphRuntime = {
    applyCanonicalDrawingRevision() {
      expect(() => session.scene().arrange([])).toThrow(
        expect.objectContaining({ code: "SCENE_COMMIT_IN_PROGRESS" }),
      );
      expect(() => session.scene().setVisibility([])).toThrow(
        expect.objectContaining({ code: "SCENE_COMMIT_IN_PROGRESS" }),
      );
      expect(() => session.dispose()).toThrow(
        expect.objectContaining({ code: "DOCUMENT_BUSY" }),
      );
      replacement = session.load(request());
      // Attach rejection handling during the synchronous callback.
      replacement.catch(() => {});
    },
  };
  const accepted = await session.edit(rename(before.inspection), {
    renderedGraphRuntime,
  });
  await expect(replacement).rejects.toMatchObject({ code: "DOCUMENT_BUSY" });
  expect(accepted.documentRevision).toBe(before.documentRevision + 1);
  expect(session.snapshot().inspection).toEqual(accepted.inspection);
});

test("default render preparation receives the reconciled successor scene without mutating its predecessor", async () => {
  const { session } = setup();
  const loaded = await session.load(request());
  expect(loaded.projection.nodes).toHaveLength(2);
  const occurrence = session
    .scene()
    .reference(loaded.inspection.occurrences[0].id);
  session
    .scene()
    .arrange([
      { reference: occurrence, position: { x: 53, y: 97 }, pinned: true },
    ]);
  const before = session.snapshot();
  await expect(
    session.edit(rename(before.inspection), {
      prepareProjection(inspection, scene) {
        expect(inspection.revision).toBe(1);
        expect(
          scene.placements.some(
            ({ position, pinned }) =>
              position.x === 53 && position.y === 97 && pinned,
          ),
        ).toBe(true);
        scene.placements[0].position.x = 999;
        throw new Error("drawing construction failed");
      },
    }),
  ).rejects.toThrow("drawing construction failed");
  expect(session.snapshot()).toEqual(before);
  const accepted = await session.edit(rename(before.inspection));
  expect(
    accepted.projection.nodes.some(
      ({ position, pinned }) =>
        position.x === 53 && position.y === 97 && pinned,
    ),
  ).toBe(true);
  expect(
    accepted.visualization.placements.some(
      ({ position }) => position.x === 999,
    ),
  ).toBe(false);
});

test("late worker edit results cannot replace a newer load", async () => {
  const { session, control } = setup();
  await session.load(request());
  const initial = session.snapshot();
  const target = session.target(initial.inspection.records.subjects[0].id);
  const gate = deferred();
  const entered = deferred();
  control.before = async (request) => {
    if (request.operation === "edit-model") {
      entered.resolve();
      await gate.promise;
    }
  };
  const edit = session.edit(rename(initial.inspection)).catch((error) => error);
  await entered.promise;
  await session.load(request());
  const replacement = session.snapshot();
  gate.resolve();
  expect(await edit).toMatchObject({ code: "DOCUMENT_EDIT_SUPERSEDED" });
  expect(session.snapshot()).toEqual(replacement);
  expect(() => session.resolveTarget(target)).toThrow(
    expect.objectContaining({ code: "DOCUMENT_TARGET_EXPIRED" }),
  );
});

test("cancelled merge choices leave both live model and placements unchanged", async () => {
  const { session } = setup();
  await session.load(request());
  const initial = session.snapshot();
  const scene = session.scene();
  const reference = scene.reference(initial.inspection.occurrences[0].id);
  scene.arrange([{ reference, position: { x: 500, y: 400 } }]);
  const [first, second] = initial.inspection.records.subjects;
  const changes = [
    {
      kind: "replace",
      id: first.id,
      record: { id: first.id, iri: second.iri },
    },
  ];
  const before = session.snapshot();
  await expect(
    session.edit(changes, { reconcile: async () => null }),
  ).rejects.toMatchObject({ code: "DOCUMENT_EDIT_CANCELLED" });
  expect(session.snapshot()).toEqual(before);
  const merged = await session.edit(changes, {
    reconcile: async (conflicts) =>
      new Map([[conflicts[0].occurrence, reference]]),
  });
  expect(merged.inspection.occurrences).toHaveLength(1);
  expect(merged.visualization.placements[0].position).toEqual({
    x: 500,
    y: 400,
  });
});

test.each(["inspection", "rankingIdentity"])(
  "mismatched worker %s revisions are rejected before scene mutation",
  async (field) => {
    const { session, control } = setup();
    await session.load(request());
    const initial = session.snapshot();
    control.after = (result) => ({
      ...result,
      [field]: { ...result[field], revision: 2 },
    });
    await expect(
      session.edit(rename(initial.inspection)),
    ).rejects.toMatchObject({
      code: "DOCUMENT_WORKER_RESULT_INVALID",
    });
    expect(session.snapshot()).toEqual(initial);
  },
);

test("bounded resource rejection during edit preserves the accepted checkpoint and scene", async () => {
  const { session } = setup();
  await session.load(request());
  const before = session.snapshot();
  await expect(
    session.edit(rename(before.inspection), { limits: { rdfQuads: 1 } }),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
  expect(session.snapshot()).toEqual(before);
});

test("only one pending capture owns a scene/checkpoint snapshot", async () => {
  const { session, control } = setup();
  await session.load(request());
  const initial = session.snapshot();
  const gate = deferred();
  const entered = deferred();
  control.before = async (request) => {
    if (request.operation === "capture-model") {
      entered.resolve();
      await gate.promise;
    }
  };
  const capture = session.capture();
  await entered.promise;
  await expect(session.capture()).rejects.toMatchObject({
    code: "DOCUMENT_BUSY",
  });
  await expect(session.edit(rename(initial.inspection))).rejects.toMatchObject({
    code: "DOCUMENT_BUSY",
  });
  gate.resolve();
  await expect(capture).resolves.toBeInstanceOf(Uint8Array);
});
