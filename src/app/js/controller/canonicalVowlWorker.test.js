import { readFileSync } from "node:fs";
import { jest } from "@jest/globals";
import { canonicalize, decode, encode, profiles, VowlError } from "vowl";
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

test("desktop defaults preserve rejection of malformed caller limit records", async () => {
  const opened = await runCanonicalVowlOperation({
    ...owlRequest,
    operation: "open-owl-model",
  });
  const getter = jest.fn(() => 60000);
  const malformed = [
    { deadlineMs: null },
    { deadlineMs: undefined },
    null,
    [],
    new Date(0),
    { [Symbol("limit")]: 1 },
    Object.defineProperty({}, "deadlineMs", { value: 60000 }),
    Object.defineProperty({}, "deadlineMs", { get: getter, enumerable: true }),
  ];
  for (const limits of malformed) {
    const request = {
      operation: "recover-model",
      checkpoint: opened.checkpoint,
      limits,
    };
    await expect(
      runCanonicalVowlOperation(request, undefined, { baseRevision: 0 }),
    ).rejects.toMatchObject({ code: "OPTION_INVALID" });
    const { workers, client } = harness();
    const run = client.run(request, context);
    if (workers.length) {
      client.dispose();
    }
    await expect(run).rejects.toMatchObject({
      code: "OPTION_INVALID",
    });
    expect(workers).toHaveLength(0);
    client.dispose();
  }
  expect(getter).not.toHaveBeenCalled();
});

test("ordinary large named-class ontologies rank by default while explicit smaller budgets still reject", async () => {
  const request = {
    operation: "open-owl-model",
    documentIri: "urn:ranking-resource-regression",
    mediaType: "text/owl-functional",
    limits: { deadlineMs: 60000 },
    bytes: text.encode(
      `Ontology(<urn:ranking-resource-regression> ${Array.from({ length: 8250 }, (_, i) => `Declaration(Class(<urn:class:${i}>))`).join("\n")})`,
    ),
  };
  await expect(
    runCanonicalVowlOperation({
      ...request,
      limits: { ...request.limits, totalStringBytes: 16777216 },
    }),
  ).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
    details: {
      stage: "node-ranking",
      resource: "totalStringBytes",
      maximum: 16777216,
    },
  });
  const opened = await runCanonicalVowlOperation(request);
  expect(opened.inspection.occurrences).toHaveLength(8250);
  expect(opened.rankingIdentity.correspondence).toHaveLength(8250);
  expect(
    new Set(opened.rankingIdentity.correspondence.map(({ current }) => current))
      .size,
  ).toBe(8250);
}, 60000);

test("extensionless and misleading acquisition names open RDF/XML through the real worker operation", async () => {
  const bytes = text.encode(
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#"><owl:Ontology rdf:about="urn:ontology"/><owl:Class rdf:about="urn:A"/></rdf:RDF>',
  );
  const { createCanonicalVowlSourceAcquisition } =
    await import("./canonicalVowlSourceAcquisition.js");
  const acquisition = createCanonicalVowlSourceAcquisition({ resolver: {} });
  for (const fileName of ["extensionless", "misleading.ttl"]) {
    const request = acquisition.local(bytes, {
      documentIri: "urn:original",
      fileName,
      contentType: "text/turtle",
    });
    const opened = await runCanonicalVowlOperation(request);
    expect(opened.checkpoint.source.evidence.documents[0]).toMatchObject({
      formatKey: "rdfxml",
      mediaType: "application/rdf+xml",
      documentIri: "urn:original",
    });
    expect(opened.checkpoint.source.sources[0].bytes).toEqual(bytes);
    expect(opened.inspection.records.roles).toContainEqual(
      expect.objectContaining({ kind: "class" }),
    );
  }
  await expect(
    runCanonicalVowlOperation(
      acquisition.local(bytes, {
        documentIri: "urn:original",
        format: "turtle",
      }),
    ),
  ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
  await expect(
    runCanonicalVowlOperation({
      operation: "open-owl-model",
      documentIri: "urn:original",
      bytes: text.encode("definitely not an OWL document"),
    }),
  ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
});

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

test("per-operation workers recover live checkpoints and produce separate ranking identity", async () => {
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
      changes: [
        { kind: "remove", id: role.id },
        { kind: "remove", id: role.subject },
      ],
    },
    undefined,
    { baseRevision: 0 },
  );
  expect(changed.rankingIdentity).toEqual({ revision: 1, correspondence: [] });
  expect(changed.inspection.revision).toBe(1);
  expect(changed.inspection.records.roles).toEqual([]);
  expect(checkpoint).toEqual(opened.checkpoint);
  const recovered = await runCanonicalVowlOperation(
    {
      operation: "recover-model",
      checkpoint: changed.checkpoint,
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

test.each(["plain ASCII", 'quotes"and\\slashes', "é😀\n\u0000", "\ud800"])(
  "checkpoint byte accounting preserves the exact boundary for %j",
  async (value) => {
    const request = {
      operation: "recover-model",
      checkpoint: { value: "x".repeat(128) + value },
      limits: { inputBytes: 1000 },
    };
    for (let i = 0; i < 3; i++) {
      request.limits.inputBytes = text.encode(JSON.stringify(request)).length;
    }
    const { client, workers } = harness();
    const pending = client.run(request, context);
    const sent = workers[0].postMessage.mock.calls[0][0];
    workers[0].onmessage({
      data: { ...sent, type: "result", result: { accepted: true } },
    });
    await expect(pending).resolves.toMatchObject({ accepted: true });
    request.limits.inputBytes--;
    await expect(client.run(request, context)).rejects.toMatchObject({
      code: "RESOURCE_LIMIT_EXCEEDED",
    });
    expect(workers).toHaveLength(1);
    client.dispose();
  },
);

test("cancellation wins while a received result waits for consumer processing", async () => {
  const { client, workers } = harness();
  const abort = new AbortController();
  const pending = client.run(
    { operation: "decode", bytes: text.encode("{}") },
    { ...context, signal: abort.signal },
  );
  const sent = workers[0].postMessage.mock.calls[0][0];
  workers[0].onmessage({
    data: { ...sent, type: "result", result: { accepted: true } },
  });
  abort.abort();
  await expect(pending).rejects.toMatchObject({ code: "LOAD_ABORTED" });
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  client.dispose();
});

test("a received result closes peer messages while cancellation remains available", async () => {
  const { client, workers } = harness();
  const resolveImport = jest.fn();
  const pending = client.run(
    { operation: "decode", bytes: text.encode("{}") },
    { ...context, resolveImport },
  );
  const worker = workers[0];
  const sent = worker.postMessage.mock.calls[0][0];
  worker.onmessage({
    data: { ...sent, type: "result", result: { accepted: true } },
  });
  worker.onmessage({
    data: { ...sent, type: "import", importId: 1, importIri: "urn:late" },
  });
  worker.onmessage({
    data: { ...sent, type: "failure", failure: { code: "LATE_FAILURE" } },
  });
  worker.onerror();
  worker.onmessageerror();
  await expect(pending).resolves.toMatchObject({ accepted: true });
  expect(resolveImport).not.toHaveBeenCalled();
  expect(worker.terminate).toHaveBeenCalledTimes(1);
  client.dispose();
});

test("source-byte exemption requires actual nested fields rather than slash-containing keys", async () => {
  const { client, workers } = harness();
  await expect(
    client.run(
      {
        operation: "recover-model",
        checkpoint: {
          "source/sources/0/bytes": new Uint8Array(4),
        },
      },
      context,
    ),
  ).rejects.toMatchObject({ code: "CHECKPOINT_INVALID" });
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

test("OWL opening and artifact operations retain distinct whole-job deadlines", async () => {
  jest.useFakeTimers();
  try {
    const { workers, client } = harness();
    const opening = client.run(
      { ...owlRequest, operation: "open-owl-model" },
      context,
    );
    const assertion = expect(opening).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
    expect(
      workers[0].postMessage.mock.calls[0][0].request.limits.deadlineMs,
    ).toBe(60000);
    jest.advanceTimersByTime(10000);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50000);
    await assertion;
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    const ordinary = client.run(
      { operation: "decode", bytes: Uint8Array.of(1) },
      context,
    );
    const ordinaryAssertion = expect(ordinary).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
    jest.advanceTimersByTime(10000);
    await ordinaryAssertion;
  } finally {
    jest.useRealTimers();
  }
});

test.each([
  "open-owl-model",
  "open-canonical-model",
  "open-legacy-model",
  "recover-model",
  "edit-model",
  "capture-model",
  "read-model-source",
  "export-model-rdf",
])("%s retains the admitted model's whole-job allowance", async (operation) => {
  jest.useFakeTimers();
  try {
    const { workers, client } = harness();
    const pending = client.run(
      {
        operation,
        ...(operation.startsWith("open-")
          ? { bytes: Uint8Array.of(1) }
          : { checkpoint: {} }),
      },
      context,
    );
    const rejection = expect(pending).rejects.toMatchObject({
      code: "DEADLINE_EXCEEDED",
    });
    expect(
      workers[0].postMessage.mock.calls[0][0].request.limits.deadlineMs,
    ).toBe(60000);
    jest.advanceTimersByTime(10000);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50000);
    await rejection;
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    client.dispose();
  } finally {
    jest.useRealTimers();
  }
});

test("the desktop profile admits an ordinary hierarchy without overriding a tighter work limit", async () => {
  const request = {
    operation: "open-owl-model",
    documentIri: "urn:hierarchy-resource-regression",
    mediaType: "text/owl-functional",
    bytes: text.encode(
      `Ontology(<urn:hierarchy-resource-regression> ${Array.from({ length: 5000 }, (_, i) => `Declaration(Class(<urn:hierarchy:C${i}>))${i ? ` SubClassOf(<urn:hierarchy:C${i}> <urn:hierarchy:C${i - 1}>)` : ""}`).join("\n")})`,
    ),
  };
  await expect(
    runCanonicalVowlOperation({
      ...request,
      limits: { embeddedValues: 1500000 },
    }),
  ).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
    details: {
      stage: "node-ranking",
      resource: "embeddedValues",
      maximum: 1500000,
    },
  });
  const opened = await runCanonicalVowlOperation(request);
  expect(opened.inspection.records.roles).toHaveLength(5000);
  expect(opened.rankingIdentity.correspondence).toHaveLength(14998);
}, 60000);

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
      code: "DEADLINE_EXCEEDED",
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

test("producer ranking budget facts survive the worker client and drive its message", async () => {
  const safe = canonicalWorkerFailure(
    new VowlError("RDF_RESOURCE_LIMIT", "private source", {
      details: {
        stage: "node-ranking",
        limit: "totalStringBytes",
        maximum: 16777216,
        actual: 21310464,
      },
    }),
  );
  expect(safe.details).toEqual({
    stage: "node-ranking",
    resource: "totalStringBytes",
    maximum: 16777216,
    actual: 21310464,
  });
  const { workers, client } = harness();
  const pending = client.run(owlRequest, context);
  await workers[0].onmessage({
    data: {
      ...workers[0].postMessage.mock.calls[0][0],
      type: "failure",
      failure: safe,
    },
  });
  await expect(pending).rejects.toMatchObject({
    code: "RDF_RESOURCE_LIMIT",
    message:
      "Node selection exceeded its temporary string-space budget (at least 20.3 MiB requested; 16 MiB allowed). Try a smaller ontology, import closure or edit.",
    details: safe.details,
  });
  client.dispose();
});

test("resource failures retain only safe stage and resource facts across the worker seam", async () => {
  const safe = canonicalWorkerFailure(
    new VowlError("MODEL_RESOURCE_LIMIT", "secret source text", {
      details: {
        stage: "owl-validation",
        resource: "maxWork",
        source: "secret",
      },
    }),
  );
  expect(safe).toEqual({
    code: "MODEL_RESOURCE_LIMIT",
    details: { stage: "owl-validation", resource: "maxWork" },
  });
  const { workers, client } = harness();
  const pending = client.run(owlRequest, context);
  const worker = workers[0];
  await worker.onmessage({
    data: {
      ...worker.postMessage.mock.calls[0][0],
      type: "failure",
      failure: safe,
    },
  });
  await expect(pending).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { stage: "owl-validation", resource: "maxWork" },
  });
});
