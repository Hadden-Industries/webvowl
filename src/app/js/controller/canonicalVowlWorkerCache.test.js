import {
  runCanonicalVowlOperation,
  canonicalWorkerFailure,
} from "./canonicalVowlWorkerOperations.js";
import { createCanonicalVowlWorkerClient } from "./canonicalVowlWorkerClient.js";
import { jest } from "@jest/globals";
import { createValidatedOwlResultCache } from "./validatedOwlResultCache.js";
import { createOwnedWorkerResult } from "./canonicalVowlWorkerResultOwnership.js";

const clone = structuredClone;
// Node's native clone originates outside Jest's VM. Native browser delivery
// creates plain records in the receiving realm; recreate that boundary here.
function receiverValue(value) {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
    return value;
  }
  if (Array.isArray(value)) {
    return Array.from(value, receiverValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, receiverValue(entry)]),
    );
  }
  return value;
}
beforeEach(() =>
  jest
    .spyOn(globalThis, "structuredClone")
    .mockImplementation((value, options) =>
      receiverValue(clone(value, options)),
    ),
);
afterEach(() => jest.restoreAllMocks());
const encoder = new TextEncoder();
const rootIri = "https://example.test/root";
const childIri = "https://example.test/child";
const source = (name) =>
  encoder.encode(
    "@prefix owl: <http://www.w3.org/2002/07/owl#> . <> a owl:Ontology . <#" +
      name +
      "> a owl:Class .",
  );
const rootBytes = encoder.encode(
  "@prefix owl: <http://www.w3.org/2002/07/owl#> . <> a owl:Ontology; owl:imports <child> . <#RootA> a owl:Class .",
);
const request = () => ({
  operation: "open-owl-model",
  bytes: rootBytes.slice(),
  documentIri: rootIri,
  mediaType: "text/turtle",
  owlMappingStrategy: "heuristic",
});
const imported = () => ({
  documentIri: childIri,
  mediaType: "text/turtle",
  bytes: source("ChildA"),
});

/** Real producer operations behind native synchronous independent message serialization. */
function harness() {
  const workers = [];
  class Worker {
    constructor() {
      this.pending = new Map();
      this.next = 0;
      this.stopped = false;
      this.continueOrdering = undefined;
    }
    emit(data) {
      if (!this.stopped) {
        this.onmessage?.({ data: receiverValue(clone(data)) });
      }
    }
    postMessage(message, transfer = []) {
      const data = receiverValue(clone(message, { transfer }));
      if (data.type === "continue-ordering") {
        this.continueOrdering?.();
        this.continueOrdering = undefined;
        return;
      }
      if (data.type === "import-result") {
        const pending = this.pending.get(data.importId);
        this.pending.delete(data.importId);
        if (data.failure) {
          pending.reject(new Error("Import acquisition failed"));
        } else {
          pending.resolve(data.document);
        }
        return;
      }
      if (data.type !== "run") {
        return;
      }
      const context = {
        requestId: data.requestId,
        loadGeneration: data.loadGeneration,
        baseRevision: data.baseRevision,
      };
      const resolveImport = (iri, { importingDocumentIri }) =>
        new Promise((resolve, reject) => {
          const importId = ++this.next;
          this.pending.set(importId, { resolve, reject });
          this.emit({
            ...context,
            type: "import",
            importId,
            importIri: iri,
            importingDocumentIri,
          });
        });
      const operationContext = {
        ...context,
        ...(data.deferNodeOrdering
          ? {
              publishPreview: (result) =>
                new Promise((resolve) => {
                  this.continueOrdering = resolve;
                  this.emit({ ...context, type: "preview", result });
                }),
            }
          : {}),
      };
      void runCanonicalVowlOperation(
        data.request,
        resolveImport,
        operationContext,
      ).then(
        (result) => this.emit({ ...context, type: "result", result }),
        (error) =>
          this.emit({
            ...context,
            type: "failure",
            failure: canonicalWorkerFailure(error),
          }),
      );
    }
    terminate() {
      this.stopped = true;
      this.continueOrdering?.();
      for (const pending of this.pending.values()) {
        pending.reject(new Error("Terminated"));
      }
      this.pending.clear();
    }
  }
  const client = createCanonicalVowlWorkerClient({
    createWorker() {
      const worker = new Worker();
      workers.push(worker);
      return worker;
    },
  });
  return { client, workers };
}
function run(
  h,
  generation,
  resolveImport = imported,
  input = request(),
  options = {},
) {
  return h.client.run(input, {
    loadGeneration: generation,
    baseRevision: 0,
    resolveImport,
    ...options,
  });
}

test("a warm result is privately owned and rechecks every imported byte before reuse", async () => {
  const h = harness();
  let calls = 0;
  const resolve = async () => {
    calls++;
    return imported();
  };
  try {
    const first = await run(h, 1, resolve);
    first.inspection.documents[0].documentIri = "urn:poison";
    first.checkpoint.source.sources[0].bytes.fill(0);
    const second = await run(h, 2, resolve);
    expect(h.workers).toHaveLength(1);
    expect(calls).toBe(2);
    expect(second.reusedValidatedResult).toBe(true);
    expect(second.loadGeneration).toBe(2);
    expect(second.inspection.documents[0].documentIri).toBe(rootIri);
    expect(second.checkpoint.source.sources[0].bytes[0]).toBe(64);
    second.inspection.documents[0].documentIri = "urn:second-poison";
    expect((await run(h, 3, resolve)).inspection.documents[0].documentIri).toBe(
      rootIri,
    );
  } finally {
    h.client.dispose();
  }
});

test("changed root bytes require the real parser even at the same length", async () => {
  const h = harness();
  try {
    await run(h, 1);
    const changed = request();
    changed.bytes = encoder.encode(
      new TextDecoder().decode(rootBytes).replace("RootA", "RootB"),
    );
    const second = await run(h, 2, imported, changed);
    expect(h.workers).toHaveLength(2);
    expect(
      second.inspection.records.subjects.some(
        (subject) => subject.iri === rootIri + "#RootB",
      ),
    ).toBe(true);
  } finally {
    h.client.dispose();
  }
});

test.each(["bytes", "context", "root-context", "mapping"])(
  "changed %s invalidates reuse without duplicate acquisition",
  async (changed) => {
    const h = harness();
    let calls = 0;
    try {
      await run(h, 1, async () => {
        calls++;
        return imported();
      });
      const input = request();
      if (changed === "mapping") {
        input.owlMappingStrategy = "unambiguous";
      }
      if (changed === "root-context") {
        input.documentIri = rootIri + "-redirect";
      }
      const second = await run(
        h,
        2,
        async () => {
          calls++;
          const value = imported();
          if (changed === "bytes") {
            value.bytes = source("ChildB");
          }
          if (changed === "context") {
            value.documentIri = childIri + "-redirect";
          }
          return value;
        },
        input,
      );
      expect(h.workers).toHaveLength(2);
      expect(calls).toBe(2);
      expect(second.reusedValidatedResult).toBeUndefined();
      if (changed === "bytes") {
        expect(
          second.inspection.records.subjects.some(
            (subject) => subject.iri === childIri + "#ChildB",
          ),
        ).toBe(true);
      }
      if (changed === "context") {
        expect(
          second.inspection.documents.some(
            (document) => document.documentIri === childIri + "-redirect",
          ),
        ).toBe(true);
      }
    } finally {
      h.client.dispose();
    }
  },
);

test.each(["accessor", "inherited"])(
  "%s import context takes the owning parser path and reads each field once",
  async (kind) => {
    const h = harness();
    const reads = { bytes: 0, mediaType: 0, documentIri: 0 };
    try {
      await run(h, 1);
      const original = imported();
      const properties = Object.fromEntries(
        Object.keys(reads).map((field) => [
          field,
          {
            enumerable: true,
            get() {
              reads[field]++;
              return original[field];
            },
          },
        ]),
      );
      const context = Object.defineProperties({}, properties);
      const value = kind === "accessor" ? context : Object.create(context);
      const result = await run(h, 2, async () => value);
      expect(h.workers).toHaveLength(2);
      expect(result.reusedValidatedResult).toBeUndefined();
      expect(reads).toEqual({ bytes: 1, mediaType: 1, documentIri: 1 });
    } finally {
      h.client.dispose();
    }
  },
);

test("caller limits are checked rather than borrowed from cached validation", async () => {
  const h = harness();
  try {
    await run(h, 1);
    await expect(
      run(h, 2, imported, { ...request(), limits: { inputBytes: 1 } }),
    ).rejects.toMatchObject({ code: "RESOURCE_LIMIT_EXCEEDED" });
    expect(h.workers).toHaveLength(1);
    await run(h, 3, imported, { ...request(), limits: { deadlineMs: 60000 } });
    expect(h.workers).toHaveLength(2);
  } finally {
    h.client.dispose();
  }
});

test("abort during fresh source verification never accepts a cached result", async () => {
  const h = harness();
  let release, started;
  const waiting = new Promise((resolve) => {
    started = resolve;
  });
  const abort = new AbortController();
  try {
    await run(h, 1);
    const pending = run(
      h,
      2,
      async () => {
        started();
        return new Promise((resolve) => {
          release = resolve;
        });
      },
      request(),
      { signal: abort.signal },
    );
    const rejected = expect(pending).rejects.toMatchObject({
      code: "LOAD_ABORTED",
    });
    await waiting;
    abort.abort();
    await rejected;
    release(imported());
    await Promise.resolve();
    expect(h.workers).toHaveLength(1);
    expect((await run(h, 3)).reusedValidatedResult).toBe(true);
  } finally {
    h.client.dispose();
  }
});

test("a fresh import failure cannot return the previous complete closure", async () => {
  const h = harness();
  try {
    await run(h, 1);
    const result = await run(h, 2, async () => {
      throw new Error("Withdrawn");
    }).then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    expect(h.workers).toHaveLength(2);
    if (result.value) {
      expect(result.value.reusedValidatedResult).toBeUndefined();
      expect(result.value.inspection.documents.length).toBeLessThan(2);
    } else {
      expect(result.error).toBeInstanceOf(Error);
    }
  } finally {
    h.client.dispose();
  }
});

test("a caller-mutated preview cannot poison a later reusable result", async () => {
  const h = harness();
  try {
    const preview = await run(h, 1, imported, request(), {
      deferNodeOrdering: true,
    });
    preview.inspection.documents[0].documentIri = "urn:poison";
    preview.checkpoint.source.sources[0].bytes.fill(0);
    preview.nodeOrdering.start();
    await preview.nodeOrdering.ready;
    const second = await run(h, 2);
    expect(h.workers).toHaveLength(1);
    expect(second.inspection.documents[0].documentIri).toBe(rootIri);
    expect(second.checkpoint.source.sources[0].bytes[0]).toBe(64);
  } finally {
    h.client.dispose();
  }
});

test("retaining a native preview does not allocate another complete transport copy", async () => {
  const h = harness();
  try {
    const preview = await run(h, 1, imported, request(), {
      deferNodeOrdering: true,
    });
    const completeCopies = structuredClone.mock.calls.filter(
      ([value]) => value?.inspection && value?.checkpoint,
    );
    expect(completeCopies.length).toBe(0);
    preview.nodeOrdering.start();
    await preview.nodeOrdering.ready;
    const next = await run(h, 2);
    expect(h.workers).toHaveLength(1);
    expect(next.inspection.documents[0].documentIri).toBe(rootIri);
  } finally {
    h.client.dispose();
  }
});

test("an explicit fresh load always invokes the owning parser", async () => {
  const h = harness();
  try {
    await run(h, 1);
    const second = await run(h, 2, imported, request(), {
      reuseValidatedResult: false,
    });
    expect(h.workers).toHaveLength(2);
    expect(second.reusedValidatedResult).toBeUndefined();
  } finally {
    h.client.dispose();
  }
});

test("limits in the owned worker payload cannot be bypassed by a changing request accessor", async () => {
  const h = harness();
  try {
    await run(h, 1);
    const input = request();
    let reads = 0;
    Object.defineProperty(input, "limits", {
      enumerable: true,
      get() {
        reads++;
        return reads === 2 ? { primaryRecords: 1 } : undefined;
      },
    });
    await expect(run(h, 2, imported, input)).rejects.toMatchObject({
      code: "MODEL_RESOURCE_LIMIT",
    });
    expect(h.workers).toHaveLength(2);
  } finally {
    h.client.dispose();
  }
});

test.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  "private preview accounting respects remaining retention capacity (full=%s, transferred=%s)",
  async (full, transferred) => {
    const h = harness();
    try {
      const result = await run(h, 1);
      const { displayOrderKeys, ...previewInput } = result;
      const completion = { displayOrderKeys };
      const maximum = 33554432;
      const previewSize = full ? maximum - 2 : 100;
      const measure = jest.fn((value, limit) => {
        const size = value === previewInput ? previewSize : 3;
        if (size > limit) {
          throw new RangeError("Retention capacity");
        }
        return size;
      });
      const cache = createValidatedOwlResultCache({ measure });
      const scope = {
        explicitLimits: false,
        deadlineMs: 60000,
        inputLimit: maximum,
      };
      const preview = cache.capture(
        request(),
        scope,
        transferred ? createOwnedWorkerResult(previewInput, {}) : previewInput,
      );
      expect(measure).toHaveBeenCalledTimes(transferred ? 0 : 1);
      cache.remember(
        request(),
        scope,
        [
          {
            importIri: childIri,
            importingDocumentIri: rootIri,
            documentIri: childIri,
            mediaType: "text/turtle",
          },
        ],
        completion,
        preview,
      );
      expect(measure).toHaveBeenCalledTimes(2);
      expect(measure.mock.calls[1][0] === completion).toBe(true);
      expect(measure.mock.calls[1][1]).toBe(maximum - previewSize);
      expect(Boolean(cache.candidate(request(), scope))).toBe(!full);
    } finally {
      h.client.dispose();
    }
  },
);
