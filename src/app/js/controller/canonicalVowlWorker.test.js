import { readFileSync } from "node:fs";
import { jest } from "@jest/globals";
import { canonicalize, decode, encode, profiles } from "vowl";
import {
  runCanonicalVowlOperation,
  canonicalWorkerFailure,
} from "./canonicalVowlWorkerOperations.js";
import { createCanonicalVowlWorkerClient } from "./canonicalVowlWorkerClient.js";

const context = { loadGeneration: 7, baseRevision: 3 };
const text = new TextEncoder();
const owlRequest = {
  operation: "owl",
  bytes: text.encode("Ontology(<urn:example> Declaration(Class(<urn:A>)))"),
  documentIri: "urn:source",
  mediaType: "text/owl-functional",
};

test("OWL operation workers retain source bytes across live editing and recovery", async () => {
  const opened = await runCanonicalVowlOperation({
    ...owlRequest,
    operation: "open-owl-model",
    limits: { rdfDeepIterations: 0 },
  });
  expect(opened.inspection.origin.kind).toBe("owl");
  const role = opened.inspection.records.roles.find(
    ({ kind }) => kind === "class",
  );
  const edited = await runCanonicalVowlOperation(
    {
      operation: "edit-model",
      checkpoint: opened.checkpoint,
      changes: [
        { kind: "remove", id: role.id },
        { kind: "remove", id: role.subject },
      ],
      limits: { rdfQuads: 1, rdfDeepIterations: 0 },
    },
    undefined,
    { baseRevision: 0 },
  );
  const recovered = await runCanonicalVowlOperation(
    { operation: "recover-model", checkpoint: edited.checkpoint },
    undefined,
    { baseRevision: 1 },
  );
  expect(recovered.inspection).toEqual(edited.inspection);
  expect(recovered.checkpoint.source.sources[0].bytes).toEqual(
    owlRequest.bytes,
  );
});

test.each(["recover-model", "read-model-source", "export-model-rdf"])(
  "%s transport bounds and copies source buffers before starting a worker",
  async (operation) => {
    const opened = await runCanonicalVowlOperation({
      ...owlRequest,
      operation: "open-owl-model",
    });
    const { workers, client } = harness();
    await expect(
      client.run(
        {
          operation,
          checkpoint: opened.checkpoint,
          limits: { inputBytes: 10 },
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "RESOURCE_LIMIT_EXCEEDED" });
    expect(workers).toHaveLength(0);
    const promise = client.run(
      { operation, checkpoint: opened.checkpoint },
      context,
    );
    const sent = workers[0].postMessage.mock.calls[0][0];
    opened.checkpoint.source.sources[0].bytes.fill(0);
    expect(sent.request.checkpoint.source.sources[0].bytes).toEqual(
      owlRequest.bytes,
    );
    await workers[0].onmessage({
      data: { ...sent, type: "result", result: {} },
    });
    await promise;
    client.dispose();
  },
);

test("per-operation workers recover and edit live checkpoints without canonicalization", async () => {
  const loaded = await runCanonicalVowlOperation(owlRequest);
  const opened = await runCanonicalVowlOperation({
    operation: "open-canonical-model",
    bytes: loaded.bytes,
  });
  const checkpoint = JSON.parse(JSON.stringify(opened.checkpoint));
  const role = opened.inspection.records.roles.find(
    (record) => record.kind === "class",
  );
  const changed = await runCanonicalVowlOperation(
    {
      operation: "edit-model",
      checkpoint,
      limits: { rdfQuads: 1, rdfDeepIterations: 0 },
      changes: [
        { kind: "remove", id: role.id },
        { kind: "remove", id: role.subject },
      ],
    },
    undefined,
    { baseRevision: 0 },
  );
  expect(changed.inspection.revision).toBe(1);
  expect(changed.inspection.records.roles).toEqual([]);
  expect(checkpoint).toEqual(opened.checkpoint);
  const recovered = await runCanonicalVowlOperation(
    {
      operation: "recover-model",
      checkpoint: changed.checkpoint,
      limits: { rdfQuads: 1 },
    },
    undefined,
    { baseRevision: 1 },
  );
  expect(recovered.inspection).toEqual(changed.inspection);
  const captured = await runCanonicalVowlOperation(
    {
      operation: "capture-model",
      checkpoint: recovered.checkpoint,
      profile: profiles.structuralContent,
    },
    undefined,
    { baseRevision: 1 },
  );
  expect(encode(await decode(captured.bytes))).toEqual(captured.bytes);
  expect(recovered.checkpoint.revision).toBe(1);
});

test("worker artifact open preserves complete scene through live capture", async () => {
  const source = JSON.parse(
    readFileSync(
      new URL(
        "../../../../packages/vowl/conformance/vectors/named-class-artifact/source.json",
        import.meta.url,
      ),
    ),
  );
  source.visualization.hidden = [source.structural.occurrences[0].id];
  const artifact = await canonicalize(source, { profile: profiles.artifact });
  const opened = await runCanonicalVowlOperation({
    operation: "open-canonical-model",
    bytes: encode(artifact),
  });
  const recovered = await runCanonicalVowlOperation(
    {
      operation: "capture-model",
      checkpoint: opened.checkpoint,
      visualization: JSON.parse(JSON.stringify(opened.visualization)),
      profile: profiles.artifact,
    },
    undefined,
    { baseRevision: 0 },
  );
  expect(recovered.bytes).toEqual(encode(artifact));
  expect(opened.visualization.hidden).toEqual([
    opened.inspection.occurrences[0].id,
  ]);
});

test.each(["edit-model", "capture-model", "recover-model"])(
  "%s rejects a stale checkpoint even when request labels are current",
  async (operation) => {
    const loaded = await runCanonicalVowlOperation(owlRequest);
    const opened = await runCanonicalVowlOperation({
      operation: "open-canonical-model",
      bytes: loaded.bytes,
    });
    await expect(
      runCanonicalVowlOperation(
        {
          operation,
          checkpoint: opened.checkpoint,
          changes: [],
          profile: profiles.structuralContent,
        },
        undefined,
        { baseRevision: 1 },
      ),
    ).rejects.toMatchObject({ code: "MODEL_REVISION_MISMATCH" });
  },
);

test("worker owns admission across OWL load, edit and exact canonical reload", async () => {
  const loaded = await runCanonicalVowlOperation(owlRequest);
  const role = loaded.document.structural.roles.find(
    (record) => record.kind === "class",
  );
  const changed = await runCanonicalVowlOperation({
    operation: "edit",
    bytes: loaded.bytes,
    changes: [
      { kind: "remove", id: role.id },
      { kind: "remove", id: role.subject },
    ],
  });
  expect(changed.document.structural.roles).toEqual([]);
  expect(changed.correspondence.every(({ current }) => current === null)).toBe(
    true,
  );
  expect(encode(await decode(loaded.bytes))).toEqual(loaded.bytes);
  expect(
    (
      await runCanonicalVowlOperation({
        operation: "decode",
        bytes: changed.bytes,
      })
    ).bytes,
  ).toEqual(changed.bytes);
});

test("capture rejects missing placements without changing accepted bytes", async () => {
  const loaded = await runCanonicalVowlOperation(owlRequest);
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../../../../packages/vowl/conformance/vectors/named-class-artifact/source.json",
        import.meta.url,
      ),
    ),
  );
  const before = loaded.bytes.slice();
  await expect(
    runCanonicalVowlOperation({
      operation: "capture",
      bytes: loaded.bytes,
      visualization: { ...fixture.visualization, placements: [] },
    }),
  ).rejects.toMatchObject({ name: "VowlError" });
  expect(loaded.bytes).toEqual(before);
});

function harness() {
  const workers = [];
  const client = createCanonicalVowlWorkerClient({
    createWorker: () => {
      const worker = { postMessage: jest.fn(), terminate: jest.fn() };
      workers.push(worker);
      return worker;
    },
  });
  return { workers, client };
}

test("checkpoint requests are copied and cancellation leaves the accepted recovery state intact", async () => {
  const { client, workers } = harness();
  const checkpoint = {
    revision: 3,
    structural: { subjects: [{ id: "original" }] },
  };
  const abort = new AbortController();
  const pending = client.run(
    { operation: "recover-model", checkpoint },
    { ...context, signal: abort.signal },
  );
  const worker = workers[0];
  const sent = worker.postMessage.mock.calls[0][0];
  expect(worker.postMessage.mock.calls[0][1]).toEqual([]);
  checkpoint.structural.subjects[0].id = "changed-after-request";
  expect(sent.request.checkpoint.structural.subjects[0].id).toBe("original");
  abort.abort();
  await expect(pending).rejects.toMatchObject({ code: "LOAD_ABORTED" });
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  expect(checkpoint.revision).toBe(3);
  client.dispose();
});

test("client rejects oversized and accessor checkpoints before creating a worker", async () => {
  const { client, workers } = harness();
  await expect(
    client.run(
      {
        operation: "recover-model",
        checkpoint: { payload: "x".repeat(200) },
        limits: { inputBytes: 100 },
      },
      context,
    ),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT_EXCEEDED" });
  let invoked = false;
  const checkpoint = {};
  Object.defineProperty(checkpoint, "revision", {
    enumerable: true,
    get() {
      invoked = true;
      return 0;
    },
  });
  await expect(
    client.run({ operation: "recover-model", checkpoint }, context),
  ).rejects.toMatchObject({ code: "CHECKPOINT_INVALID" });
  expect(invoked).toBe(false);
  expect(workers).toHaveLength(0);
  client.dispose();
});

test("checkpoint input accounting covers profile and rejects extra payload fields", async () => {
  const { client, workers } = harness();
  await expect(
    client.run(
      {
        operation: "capture-model",
        checkpoint: {},
        profile: "x".repeat(200),
        limits: { inputBytes: 100 },
      },
      context,
    ),
  ).rejects.toMatchObject({ code: "RESOURCE_LIMIT_EXCEEDED" });
  await expect(
    client.run(
      {
        operation: "recover-model",
        checkpoint: {},
        bytes: new Uint8Array(200),
      },
      context,
    ),
  ).rejects.toMatchObject({ code: "OPTION_INVALID" });
  expect(workers).toHaveLength(0);
  client.dispose();
});

test("worker requests snapshot input, ignore stale revisions and terminate after success", async () => {
  const { workers, client } = harness();
  const bytes = Uint8Array.of(1, 2);
  const promise = client.run({ operation: "decode", bytes }, context);
  const worker = workers[0];
  const sent = worker.postMessage.mock.calls[0][0];
  bytes[0] = 9;
  expect(sent.request.bytes).toEqual(Uint8Array.of(1, 2));
  await worker.onmessage({
    data: { ...sent, type: "result", baseRevision: 2, result: {} },
  });
  expect(worker.terminate).not.toHaveBeenCalled();
  await worker.onmessage({
    data: { ...sent, type: "result", result: { bytes: Uint8Array.of(3) } },
  });
  await expect(promise).resolves.toMatchObject({
    ...context,
    bytes: Uint8Array.of(3),
  });
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test("cancellation terminates work and aborts an in-flight import acquisition", async () => {
  const { workers, client } = harness();
  const abort = new AbortController();
  let acquisitionSignal;
  let completeImport;
  const promise = client.run(owlRequest, {
    ...context,
    signal: abort.signal,
    resolveImport: (_iri, { signal }) => {
      acquisitionSignal = signal;
      return new Promise((resolve) => {
        completeImport = resolve;
      });
    },
  });
  const worker = workers[0];
  const sent = worker.postMessage.mock.calls[0][0];
  const importWait = worker.onmessage({
    data: {
      ...sent,
      type: "import",
      importId: 1,
      importIri: "urn:import",
      importingDocumentIri: "urn:source",
    },
  });
  const assertion = expect(promise).rejects.toMatchObject({
    code: "LOAD_ABORTED",
  });
  abort.abort();
  await assertion;
  expect(acquisitionSignal.aborted).toBe(true);
  completeImport({
    bytes: text.encode("late"),
    documentIri: "urn:import",
    mediaType: "text/owl-functional",
  });
  await importWait;
  expect(worker.postMessage).toHaveBeenCalledTimes(1);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test("aggregate acquisition counts root plus every imported document", async () => {
  const { workers, client } = harness();
  const promise = client.run(
    { operation: "owl", bytes: Uint8Array.of(1, 2), limits: { inputBytes: 3 } },
    {
      ...context,
      resolveImport: async () => ({
        bytes: Uint8Array.of(3, 4),
        documentIri: "urn:i",
        mediaType: "text/turtle",
      }),
    },
  );
  const assertion = expect(promise).rejects.toMatchObject({
    code: "RESOURCE_LIMIT_EXCEEDED",
  });
  const worker = workers[0];
  await worker.onmessage({
    data: {
      ...worker.postMessage.mock.calls[0][0],
      type: "import",
      importId: 1,
      importIri: "urn:i",
    },
  });
  await assertion;
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test("whole-job deadline terminates an unresponsive worker", async () => {
  jest.useFakeTimers();
  try {
    const { workers, client } = harness();
    const promise = client.run(
      {
        operation: "decode",
        bytes: Uint8Array.of(1),
        limits: { deadlineMs: 5 },
      },
      context,
    );
    const assertion = expect(promise).rejects.toMatchObject({
      code: "RESOURCE_LIMIT_EXCEEDED",
    });
    jest.advanceTimersByTime(5);
    await assertion;
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

test("unexpected exception text never crosses the worker boundary", () => {
  expect(canonicalWorkerFailure(new Error("secret source text"))).toEqual({
    code: "CANONICAL_OPERATION_FAILED",
  });
});
