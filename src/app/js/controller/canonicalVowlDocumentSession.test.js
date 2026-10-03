import { readFileSync } from "node:fs";
import { decode, compatibleArtifactProfile } from "vowl";
import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "./canonicalVowlWorkerOperations.js";

const bytes = new Uint8Array(
  readFileSync(
    new URL(
      "../../../../packages/vowl/conformance/vectors/named-pair-artifact/canonical.json",
      import.meta.url,
    ),
  ),
);
const request = () => ({ operation: "open-canonical-model", bytes });
const plain = (value) => JSON.parse(JSON.stringify(value));
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
  const changed = await session.edit(changes, {
    limits: { rdfQuads: 1, rdfDeepIterations: 0 },
  });
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
  await session.edit(rename(changed.inspection, "urn:again"), {
    limits: { rdfQuads: 1, rdfDeepIterations: 0 },
  });
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

test("mismatched worker revisions are rejected before scene mutation", async () => {
  const { session, control } = setup();
  await session.load(request());
  const initial = session.snapshot();
  control.after = (result) => ({
    ...result,
    inspection: { ...result.inspection, revision: 2 },
  });
  await expect(session.edit(rename(initial.inspection))).rejects.toMatchObject({
    code: "DOCUMENT_WORKER_RESULT_INVALID",
  });
  expect(session.snapshot()).toEqual(initial);
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
