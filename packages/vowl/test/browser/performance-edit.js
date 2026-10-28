import {
  canonicalize,
  compatibleArtifactProfile,
  checkpointModel,
  editModel,
  encode,
  openCanonical,
  profiles,
} from "../../src/index.js";
import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlDocumentSession } from "../../../../src/app/js/controller/canonicalVowlDocumentSession.js";
import isEqual from "lodash/isEqual.js";
import { createRenderedGraphInternals } from "../../../../src/webvowl/js/runtime/renderedGraphInternals.js";
import { createD3RenderedGraphAdapter } from "../../../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js";

// Served only by the local qualification driver. Private inputs never enter
// the checkout, public build or result object; results retain quantities only.
const result = {
  status: "running",
  operations: [],
  checks: [],
  retired: [],
  transport: [],
};
globalThis.canonicalEditQualification = result;
const config = await (await fetch("/configuration.json")).json();
const liveWorkers = new Set();
const limits = {
  primaryRecords: 200000,
  embeddedValues: 4000000,
  totalStringBytes: 67108864,
  deadlineMs: 60000,
};
result.limits = limits;
const check = (condition, name) => {
  if (!condition) {
    throw new Error(name);
  }
  result.checks.push(name);
};
function workerClient() {
  return createCanonicalVowlWorkerClient({
    createWorker() {
      const worker = new Worker(config.worker, { type: "module" });
      const transport = {
        operation: result.operations.at(-1)?.name,
        senderCloneMs: 0,
      };
      const createdAt = performance.now();
      result.transport.push(transport);
      const postMessage = worker.postMessage.bind(worker);
      worker.postMessage = (...args) => {
        const startedAt = performance.now();
        try {
          return postMessage(...args);
        } finally {
          transport.senderCloneMs += performance.now() - startedAt;
        }
      };
      worker.addEventListener("message", ({ data }) => {
        if (data.type === "result" || data.type === "failure") {
          transport.creationToReplyMs = performance.now() - createdAt;
        }
      });
      liveWorkers.add(worker);
      const terminate = worker.terminate.bind(worker);
      worker.terminate = () => {
        liveWorkers.delete(worker);
        result.retired.push(new WeakRef(worker));
        terminate();
      };
      return worker;
    },
  });
}
async function timed(name, action, { diagnostic = false } = {}) {
  const entry = { name, status: "running" };
  result.operations.push(entry);
  const started = performance.now();
  try {
    const value = await action();
    entry.status = "passed";
    if (value?.inspection) {
      entry.revision = value.inspection.revision;
      entry.occurrences = value.inspection.occurrences.length;
      entry.records = Object.fromEntries(
        Object.entries(value.inspection.records).map(([key, rows]) => [
          key,
          Array.isArray(rows) ? rows.length : undefined,
        ]),
      );
    }
    return value;
  } catch (error) {
    entry.status = "failed";
    entry.error = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    if (!diagnostic) {
      throw error;
    }
  } finally {
    entry.wallMs = performance.now() - started;
  }
}
function chainChanges(size) {
  const changes = [];
  for (let i = 0; i < size; i++) {
    changes.push(
      {
        kind: "insert",
        collection: "subjects",
        record: { id: `s${i}`, iri: `urn:chain:${i}` },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: `r${i}`, kind: "class", subject: `s${i}` },
      },
    );
    if (i) {
      changes.push({
        kind: "insert",
        collection: "constructs",
        record: {
          id: `k${i}`,
          kind: "subclass",
          sub: `r${i - 1}`,
          super: `r${i}`,
        },
      });
    }
  }
  return changes;
}
const addition = (prefix) => [
  {
    kind: "insert",
    collection: "subjects",
    record: { id: `${prefix}:s`, iri: `urn:${prefix}` },
  },
  {
    kind: "insert",
    collection: "roles",
    record: { id: `${prefix}:r`, kind: "class", subject: `${prefix}:s` },
  },
];
const bytesAt = async (path) => {
  const response = await fetch(path);
  check(response.ok, "local-input-acquired");
  return new Uint8Array(await response.arrayBuffer());
};
const context = (revision, extra = {}) => ({
  loadGeneration: 1,
  baseRevision: revision,
  ...extra,
});
async function expectCode(action, code, label) {
  let actual;
  try {
    await action();
  } catch (error) {
    actual = error.code;
  }
  check(actual === code, `${label}: expected ${code}, received ${actual}`);
}
async function smallLifecycle(original, cycle) {
  const client = workerClient();
  const session = createCanonicalVowlDocumentSession({ workerClient: client });
  try {
    await session.load({ operation: "open-canonical-model", bytes: original });
    const previous = session.snapshot();
    await session.edit(addition(`cycle${cycle}`));
    const edited = session.snapshot();
    check(
      edited.documentRevision === 1 && previous.documentRevision === 0,
      `atomic-revision:${cycle}`,
    );
    const recovery = await client.run(
      { operation: "recover-model", checkpoint: edited.checkpoint },
      context(1),
    );
    check(
      isEqual(recovery.checkpoint, edited.checkpoint),
      `exact-recovery:${cycle}`,
    );
    const capture = await client.run(
      {
        operation: "capture-model",
        checkpoint: edited.checkpoint,
        profile: profiles.structuralContent,
      },
      context(1),
    );
    check(capture.bytes.length > 0, `capture:${cycle}`);
    await expectCode(
      () =>
        client.run(
          { operation: "recover-model", checkpoint: previous.checkpoint },
          context(1),
        ),
      "MODEL_REVISION_MISMATCH",
      `stale-revision:${cycle}`,
    );
    await expectCode(
      () =>
        client.run(
          {
            operation: "recover-model",
            checkpoint: edited.checkpoint,
            limits: { primaryRecords: 1 },
          },
          context(1),
        ),
      "MODEL_RESOURCE_LIMIT",
      `tight-budget:${cycle}`,
    );
    const abort = new AbortController();
    const pending = client.run(
      { operation: "recover-model", checkpoint: edited.checkpoint },
      context(1, { signal: abort.signal }),
    );
    abort.abort();
    await expectCode(() => pending, "LOAD_ABORTED", `native-cancel:${cycle}`);
    check(
      session.identity().documentRevision === 1,
      `failure-preserves-accepted-revision:${cycle}`,
    );
    result.retired.push(
      new WeakRef(edited.checkpoint),
      new WeakRef(session),
      new WeakRef(client),
    );
  } finally {
    session.dispose();
  }
}

async function renderedEdit(name, request, resolveImport) {
  const container = document.createElement("div");
  container.style.cssText = "width:800px;height:600px";
  document.body.append(container);
  const graph = createRenderedGraphInternals(container, {
    widthPx: 800,
    heightPx: 600,
  });
  const { renderedGraphRuntime: runtime } = createD3RenderedGraphAdapter({
    graphContainerElement: container,
    renderedGraphConfiguration: undefined,
    createRenderer: () => graph,
    observeNextPaint: () =>
      new Promise((resolve) => requestAnimationFrame(resolve)),
  });
  const session = createCanonicalVowlDocumentSession({
    workerClient: workerClient(),
  });
  const paint = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  try {
    runtime.resizeVisualizationViewport({ widthPx: 800, heightPx: 600 });
    const startedAt = performance.now();
    const loaded = await session.load(request, {
      resolveImport,
      renderedGraphRuntime: runtime,
      useAutomaticNodesShown: true,
      initialVisualization: { view: { layout: "pause" } },
    });
    await paint();
    const firstAcceptedPaintMs = performance.now() - startedAt;
    check(
      runtime.readVisibleRenderedGraphSnapshot().visibleElementReferences
        .length > 0,
      `${name}:visible-accepted-svg`,
    );
    const parent = loaded.inspection.records.roles.find(
      ({ kind }) => kind === "class",
    );
    const editStartedAt = performance.now();
    await session.edit(
      [
        ...addition(`${name}Ui`),
        {
          kind: "insert",
          collection: "constructs",
          record: {
            id: `${name}:k`,
            kind: "subclass",
            sub: `${name}Ui:r`,
            super: parent.id,
          },
        },
      ],
      { renderedGraphRuntime: runtime, limits },
    );
    await paint();
    const editToAcceptedPaintMs = performance.now() - editStartedAt;
    check(
      session.identity().documentRevision === 1,
      `${name}:rendered-edit-is-current`,
    );
    check(
      runtime.readVisibleRenderedGraphSnapshot().visibleElementReferences
        .length > 0,
      `${name}:edited-svg-visible`,
    );
    (result.frames ??= []).push({
      name,
      firstAcceptedPaintMs,
      editToAcceptedPaintMs,
      viewport: { widthPx: 800, heightPx: 600 },
      automaticNodesShown: true,
    });
    if (config.capture) {
      // Match the application's export route: capture the actual accepted drawing.
      session.synchronizeDrawing(runtime.readCanonicalDrawingState());
      const quantities = { negativeZero: 0, nonFinite: 0 };
      const count = (value) => {
        if (typeof value === "number") {
          if (Object.is(value, -0)) {
            quantities.negativeZero++;
          }
          if (!Number.isFinite(value)) {
            quantities.nonFinite++;
          }
        } else if (value && typeof value === "object") {
          Object.values(value).forEach(count);
        }
      };
      count(session.scene().snapshot());
      (result.sceneNumbers ??= []).push({ name, ...quantities });
      const bytes = await timed(
        `${name}:full-artifact-capture`,
        () => session.capture({ limits }),
        { diagnostic: true },
      );
      if (bytes) {
        const client = workerClient();
        try {
          const reopened = await timed(`${name}:captured-artifact-reload`, () =>
            client.run(
              { operation: "open-canonical-model", bytes, limits },
              context(0),
            ),
          );
          const captured = await timed(`${name}:artifact-recapture`, () =>
            client.run(
              {
                operation: "capture-model",
                checkpoint: reopened.checkpoint,
                visualization: reopened.visualization,
                profile: compatibleArtifactProfile,
                limits,
              },
              context(0),
            ),
          );
          check(
            bytes.length === captured.bytes.length &&
              bytes.every((byte, index) => byte === captured.bytes[index]),
            `${name}:canonical-artifact-byte-roundtrip`,
          );
        } finally {
          client.dispose();
        }
      }
    }
  } finally {
    session.dispose();
    runtime.dispose();
    container.remove();
    result.retired.push(
      new WeakRef(session),
      new WeakRef(runtime),
      new WeakRef(graph),
    );
  }
}
async function renderCases() {
  const declarations = Array.from(
    { length: 10000 },
    (_, i) => `Declaration(Class(<urn:ui-chain:${i}>))`,
  );
  const edges = Array.from(
    { length: 9999 },
    (_, i) => `SubClassOf(<urn:ui-chain:${i}> <urn:ui-chain:${i + 1}>)`,
  );
  if (config.case !== "urd") {
    await timed("chain:rendered-session-edit", () =>
      renderedEdit("chain", {
        operation: "open-owl-model",
        bytes: new TextEncoder().encode(
          `Ontology(<urn:ui-chain> ${declarations.join(" ")} ${edges.join(" ")})`,
        ),
        documentIri: "urn:ui-chain",
        mediaType: "text/owl-functional",
        limits,
      }),
    );
  }
  if (config.case === "chain") {
    return;
  }
  const root = config.documents[0];
  const bytes = await bytesAt(root.url);
  const resolveImport = async (iri) => {
    const entry = config.documents.find(
      ({ documentIri }) => documentIri === iri,
    );
    check(entry, "render-import-is-bound");
    return {
      bytes: await bytesAt(entry.url),
      documentIri: entry.documentIri,
      mediaType: entry.mediaType,
    };
  };
  await timed("urd:rendered-session-edit", () =>
    renderedEdit(
      "urd",
      {
        operation: "open-owl-model",
        bytes,
        documentIri: root.documentIri,
        mediaType: root.mediaType,
        limits,
      },
      resolveImport,
    ),
  );
}
try {
  if (!config.renderOnly) {
    const empty = await (await fetch("/empty.json")).json();
    const admitted = await canonicalize(empty, {
      profile: profiles.structuralContent,
    });
    const original = encode(admitted);
    for (let cycle = 0; cycle < 10; cycle++) {
      await timed(`lifecycle:${cycle}`, () => smallLifecycle(original, cycle));
      check(liveWorkers.size === 0, `worker-teardown:${cycle}`);
    }
    const opened = await openCanonical(admitted, { limits });
    const chain = await timed("chain:core-setup", () =>
      editModel(opened.model, chainChanges(10000), { limits }),
    );
    let checkpoint = await checkpointModel(chain.model, { limits });
    result.chainOccurrences = checkpoint.structural?.occurrences?.length;
    const client = workerClient();
    try {
      const edited = await timed(
        "chain:production-worker-edit",
        () =>
          client.run(
            {
              operation: "edit-model",
              checkpoint,
              changes: [
                ...addition("chainExtra"),
                {
                  kind: "insert",
                  collection: "constructs",
                  record: {
                    id: "chainExtra:k",
                    kind: "subclass",
                    sub: "chainExtra:r",
                    super: checkpoint.structural.roles.find(
                      ({ kind }) => kind === "class",
                    ).id,
                  },
                },
              ],
              limits,
            },
            context(1),
          ),
        { diagnostic: true },
      );
      if (edited) {
        check(edited.inspection.revision === 2, "chain-edit-revision");
        check(edited.created.length === 6, "chain-full-semantic-insertion");
        const recovered = await timed(
          "chain:production-worker-recovery",
          () =>
            client.run(
              {
                operation: "recover-model",
                checkpoint: edited.checkpoint,
                limits,
              },
              context(2),
            ),
          { diagnostic: true },
        );
        if (recovered) {
          check(
            isEqual(recovered.checkpoint, edited.checkpoint),
            "chain-exact-recovery",
          );
        }
      }
      checkpoint = null;
      const root = config.documents[0];
      const rootBytes = await bytesAt(root.url);
      const resolveImport = async (iri) => {
        const entry = config.documents.find((item) => item.documentIri === iri);
        if (!entry) {
          throw new Error("Unbound private import");
        }
        return {
          bytes: await bytesAt(entry.url),
          documentIri: entry.documentIri,
          mediaType: entry.mediaType,
        };
      };
      const urd = await timed(
        "urd:production-worker-open",
        () =>
          client.run(
            {
              operation: "open-owl-model",
              bytes: rootBytes,
              documentIri: root.documentIri,
              mediaType: root.mediaType,
              limits,
            },
            context(0, { resolveImport }),
          ),
        { diagnostic: true },
      );
      if (urd) {
        check(
          urd.inspection.documents.length === config.documents.length,
          "urd-complete-import-closure",
        );
        const edited = await timed(
          "urd:production-worker-edit",
          () =>
            client.run(
              {
                operation: "edit-model",
                checkpoint: urd.checkpoint,
                changes: [
                  ...addition("urdExtra"),
                  {
                    kind: "insert",
                    collection: "constructs",
                    record: {
                      id: "urdExtra:k",
                      kind: "subclass",
                      sub: "urdExtra:r",
                      super: urd.inspection.records.roles.find(
                        ({ kind }) => kind === "class",
                      ).id,
                    },
                  },
                ],
                limits,
              },
              context(0),
            ),
          { diagnostic: true },
        );
        if (edited) {
          check(edited.inspection.revision === 1, "urd-edited-revision");
          check(edited.created.length === 6, "urd-full-semantic-insertion");
          for (const document of edited.inspection.documents) {
            const expected = config.documents.find(
              ({ documentIri }) => documentIri === document.documentIri,
            );
            check(expected, "urd-source-identity-bound");
            const original = await bytesAt(expected.url);
            const source = await timed("urd:original-source", () =>
              client.run(
                {
                  operation: "read-model-source",
                  checkpoint: edited.checkpoint,
                  documentId: document.id,
                  limits,
                },
                context(1),
              ),
            );
            check(
              source.bytes.length === original.length &&
                source.bytes.every((byte, index) => byte === original[index]),
              "urd-source-byte-fidelity-after-edit",
            );
          }
          const recovered = await timed(
            "urd:production-worker-recovery",
            () =>
              client.run(
                {
                  operation: "recover-model",
                  checkpoint: edited.checkpoint,
                  limits,
                },
                context(1),
              ),
            { diagnostic: true },
          );
          if (recovered) {
            check(
              isEqual(recovered.checkpoint, edited.checkpoint),
              "urd-exact-recovery",
            );
          }
        }
      }
    } finally {
      client.dispose();
    }
  }
  await renderCases();
  check(liveWorkers.size === 0, "all-workers-terminated");
  result.status = result.operations.some(({ status }) => status === "failed")
    ? "completed-with-limitations"
    : "passed";
} catch (error) {
  result.status = "failed";
  result.error = {
    code: error.code,
    message: error.message,
    stack: error.stack,
  };
}
result.finishedAt = new Date().toISOString();
result.liveWorkers = liveWorkers.size;
