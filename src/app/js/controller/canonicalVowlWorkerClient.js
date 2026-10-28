import {
  canonicalFailureDetails,
  canonicalLoadingMessage,
} from "./canonicalVowlFailure.js";

import {
  APPLICATION_LIMITS,
  MODEL_OPERATION_NAMES,
  MODEL_OPERATION_LIMITS,
} from "./canonicalVowlWorkerPolicy.js";

const DEFAULT_DEADLINE_MS = APPLICATION_LIMITS.deadlineMs;
// The owner-approved desktop allowance covers the entire model lifecycle;
// the same whole-job deadline travels to the package in the worker request.
const MODEL_OPERATION_DEADLINE_MS = MODEL_OPERATION_LIMITS.deadlineMs;
const modelOperations = new Set(MODEL_OPERATION_NAMES);
const DEFAULT_INPUT_BYTES = APPLICATION_LIMITS.inputBytes;
const MAXIMUM_TIMER_DELAY = 2147483647;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
).get;
const byteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
).get;

function failure(code, details) {
  const safeDetails = canonicalFailureDetails(details);
  const error = new Error(
    canonicalLoadingMessage({
      code,
      message: code.replaceAll("_", " ").toLowerCase(),
      details: safeDetails,
    }),
  );
  error.name = "CanonicalVowlOperationError";
  error.code = code;
  error.details = safeDetails;
  return error;
}

function copyBytes(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    !(bytes.buffer instanceof ArrayBuffer)
  ) {
    throw failure("CANONICAL_BYTES_REQUIRED");
  }
  return bytes.slice();
}

function positiveLimit(value, fallback) {
  const result = value ?? fallback;
  if (result !== Infinity && (!Number.isSafeInteger(result) || result < 1)) {
    throw failure("OPTION_INVALID");
  }
  return result;
}

function limitRecord(value) {
  if (value === undefined) {
    return {};
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw failure("OPTION_INVALID");
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string" ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      (descriptor.value !== Infinity &&
        (!Number.isSafeInteger(descriptor.value) || descriptor.value < 0))
    ) {
      throw failure("OPTION_INVALID");
    }
  }
  // Exact per-field minima and known names remain the producer's authority.
  return value;
}

function armDeadline(milliseconds, expire) {
  if (milliseconds === Infinity) {
    return () => {};
  }
  const deadline = performance.now() + milliseconds;
  let timer;
  function arm() {
    const remaining = deadline - performance.now();
    timer = setTimeout(
      () => {
        if (performance.now() < deadline) {
          arm();
        } else {
          expire();
        }
      },
      Math.max(0, Math.min(remaining, MAXIMUM_TIMER_DELAY)),
    );
  }
  arm();
  return () => clearTimeout(timer);
}

/** Bound plain checkpoint/request data before transport allocates its copy. */
function measureCheckpointInput(value, maximum, maxDepth) {
  let size = 0;
  const ancestors = new Set();
  function add(bytes) {
    size += bytes;
    if (size > maximum) {
      throw failure("RESOURCE_LIMIT_EXCEEDED");
    }
  }
  function string(value) {
    // Most checkpoint strings are plain ASCII IDs/IRIs. The native linear scan
    // avoids a callback and code-point dispatch per byte without allocating a
    // serialized copy. Escapes, controls and Unicode retain the exact slow path.
    if (!/[^\x20-\x21\x23-\x5b\x5d-\x7e]/u.test(value)) {
      return add(value.length + 2);
    }
    add(2);
    for (let index = 0; index < value.length; index++) {
      const code = value.codePointAt(index);
      add(
        code < 32
          ? [8, 9, 10, 12, 13].includes(code)
            ? 2
            : 6
          : code === 34 || code === 92
            ? 2
            : code >= 0xd800 && code <= 0xdfff
              ? 6
              : code < 128
                ? 1
                : code < 2048
                  ? 2
                  : code < 65536
                    ? 3
                    : 4,
      );
      if (code > 65535) {
        index++;
      }
    }
  }
  function visit(item, depth, sourceStage) {
    if (depth > maxDepth) {
      throw failure("RESOURCE_LIMIT_EXCEEDED");
    }
    if (typeof item === "string") {
      return string(item);
    }
    if (item === null || typeof item === "boolean") {
      return add(5);
    }
    if (
      typeof item === "number" &&
      (Number.isFinite(item) || (sourceStage === 8 && item === Infinity))
    ) {
      return add(String(item).length);
    }
    if (!item || typeof item !== "object" || ancestors.has(item)) {
      throw failure("CHECKPOINT_INVALID");
    }
    if (sourceStage === 6) {
      if (
        !(item instanceof Uint8Array) ||
        Object.getPrototypeOf(item) !== Uint8Array.prototype ||
        !(byteBuffer.call(item) instanceof ArrayBuffer)
      ) {
        throw failure("CHECKPOINT_INVALID");
      }
      // Native byte storage is charged before the structured-clone allocation.
      // Other typed arrays and arbitrary nested byte payloads remain invalid.
      return add(byteLength.call(item));
    }
    const array = Array.isArray(item);
    const prototype = Object.getPrototypeOf(item);
    if (
      array
        ? prototype !== Array.prototype
        : prototype !== Object.prototype && prototype !== null
    ) {
      throw failure("CHECKPOINT_INVALID");
    }
    ancestors.add(item);
    add(2);
    const keys = Reflect.ownKeys(item);
    // Every member needs at least one value byte, even before keys/commas.
    if (keys.length > maximum - size) {
      throw failure("RESOURCE_LIMIT_EXCEEDED");
    }
    let members = 0;
    for (const key of keys) {
      if (array && key === "length") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (
        typeof key !== "string" ||
        !descriptor.enumerable ||
        !("value" in descriptor)
      ) {
        throw failure("CHECKPOINT_INVALID");
      }
      if (members++) {
        add(1);
      }
      if (array) {
        if (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length) {
          throw failure("CHECKPOINT_INVALID");
        }
      } else {
        string(key);
        add(1);
      }
      // Context permits native source bytes and Infinity only at top-level
      // limit-option values, never inside a checkpoint or an aliased object.
      // Avoid allocating a JSON Pointer for each large-checkpoint field.
      const nextSourceStage =
        sourceStage === 1 && key === "limits"
          ? 7
          : sourceStage === 7
            ? 8
            : (sourceStage === 1 && key === "checkpoint") ||
                (sourceStage === 2 && key === "source") ||
                (sourceStage === 3 && key === "sources") ||
                (sourceStage === 4 && /^(0|[1-9][0-9]*)$/.test(key)) ||
                (sourceStage === 5 && key === "bytes")
              ? sourceStage + 1
              : 0;
      visit(descriptor.value, depth + 1, nextSourceStage);
    }
    if (array && members !== item.length) {
      throw failure("CHECKPOINT_INVALID");
    }
    ancestors.delete(item);
  }
  visit(value, 0, 1);
  return size;
}

/**
 * Owns worker lifetime, source-byte transfer and caller-controlled acquisition.
 * Requests carry their exact document generation/revision; the controller must
 * still compare those to its current state before committing a returned result.
 * Injected workers must implement native postMessage's synchronous serialization
 * and independent receiver ownership; retaining the caller's request is invalid.
 */
export function createCanonicalVowlWorkerClient({
  createWorker = () =>
    new Worker(new URL("./canonicalVowlWorker.js", import.meta.url), {
      type: "module",
    }),
} = {}) {
  let nextRequestId = 0;
  let disposed = false;
  const pending = new Set();

  return Object.freeze({
    async run(
      request,
      {
        loadGeneration,
        baseRevision,
        signal,
        resolveImport,
        deferNodeOrdering = false,
      } = {},
    ) {
      if (disposed) {
        throw failure("CANONICAL_CLIENT_DISPOSED");
      }
      if (
        !Number.isSafeInteger(loadGeneration) ||
        loadGeneration < 1 ||
        !Number.isSafeInteger(baseRevision) ||
        baseRevision < 0
      ) {
        throw failure("CANONICAL_CONTEXT_INVALID");
      }
      if (signal?.aborted) {
        throw failure("LOAD_ABORTED");
      }
      const limits = limitRecord(request.limits);
      const deadlineMs = positiveLimit(
        Object.hasOwn(limits, "deadlineMs")
          ? limits.deadlineMs
          : modelOperations.has(request.operation)
            ? MODEL_OPERATION_DEADLINE_MS
            : DEFAULT_DEADLINE_MS,
        undefined,
      );
      const inputLimit = positiveLimit(limits.inputBytes, DEFAULT_INPUT_BYTES);
      // Serialize before yielding. Only owned source-byte copies are transferred;
      // checkpoint buffers stay owned by the caller and are cloned by transport.
      const checkpointOperation = [
        "recover-model",
        "edit-model",
        "capture-model",
        "read-model-source",
        "export-model-rdf",
      ].includes(request.operation);
      const bytes = checkpointOperation ? undefined : copyBytes(request.bytes);
      let acquiredBytes = bytes?.byteLength ?? 0;
      let checkpointPayload;
      if (checkpointOperation) {
        const depth = positiveLimit(limits.depth, APPLICATION_LIMITS.depth);
        const allowed = [
          "operation",
          "checkpoint",
          "limits",
          ...(request.operation === "edit-model"
            ? ["changes"]
            : request.operation === "capture-model"
              ? ["profile", "visualization"]
              : request.operation === "read-model-source"
                ? ["documentId"]
                : []),
        ];
        checkpointPayload = {};
        for (const key of Reflect.ownKeys(request)) {
          const descriptor = Object.getOwnPropertyDescriptor(request, key);
          if (
            !allowed.includes(key) ||
            !descriptor.enumerable ||
            !("value" in descriptor)
          ) {
            throw failure("OPTION_INVALID");
          }
          if (descriptor.value !== undefined) {
            checkpointPayload[key] = descriptor.value;
          }
        }
        // The transport envelope adds one level outside the package checkpoint.
        acquiredBytes = measureCheckpointInput(
          checkpointPayload,
          inputLimit,
          depth + 1,
        );
      }
      if (acquiredBytes > inputLimit) {
        throw failure("RESOURCE_LIMIT_EXCEEDED");
      }
      const payload =
        checkpointPayload ?? structuredClone({ ...request, bytes });
      if (modelOperations.has(request.operation)) {
        payload.limits = { ...payload.limits, deadlineMs };
      }
      if (nextRequestId === Number.MAX_SAFE_INTEGER) {
        throw failure("CANONICAL_CONTEXT_INVALID");
      }
      const context = {
        requestId: ++nextRequestId,
        loadGeneration,
        baseRevision,
      };
      const worker = createWorker();
      return new Promise((resolve, reject) => {
        const acquisition = new AbortController();
        const importIds = new Set();
        let finished = false;
        let resultTimer;
        let previewTimer;
        let previewDelivered = false;
        let orderingStarted = false;
        let finishOrdering;
        const cancelDeadline = armDeadline(deadlineMs, () =>
          settle(
            failure("DEADLINE_EXCEEDED", {
              stage: "worker",
              resource: "deadlineMs",
            }),
          ),
        );
        function settle(error, result) {
          if (finished) {
            return;
          }
          finished = true;
          cancelDeadline();
          clearTimeout(resultTimer);
          clearTimeout(previewTimer);
          signal?.removeEventListener("abort", abort);
          acquisition.abort();
          worker.terminate();
          pending.delete(abort);
          if (previewDelivered) {
            finishOrdering(error ? { error } : result);
          } else if (error) {
            reject(error);
          } else {
            resolve({ ...context, ...result });
          }
        }
        function abort() {
          settle(failure("LOAD_ABORTED"));
        }
        pending.add(abort);
        signal?.addEventListener("abort", abort, { once: true });
        const peerFailure = () => {
          if (resultTimer === undefined) {
            settle(failure("CANONICAL_WORKER_FAILED"));
          }
        };
        worker.onerror = peerFailure;
        worker.onmessageerror = peerFailure;
        worker.onmessage = async ({ data }) => {
          if (
            finished ||
            resultTimer !== undefined ||
            !data ||
            Object.keys(context).some((key) => data[key] !== context[key])
          ) {
            return;
          }
          if (data.type === "preview") {
            if (
              !deferNodeOrdering ||
              request.operation !== "open-owl-model" ||
              previewTimer !== undefined ||
              previewDelivered
            ) {
              settle(failure("CANONICAL_WORKER_FAILED"));
              return;
            }
            const ready = new Promise((done) => {
              finishOrdering = done;
            });
            previewTimer = setTimeout(() => {
              previewTimer = undefined;
              if (finished) {
                return;
              }
              previewDelivered = true;
              resolve({
                ...context,
                ...data.result,
                nodeOrdering: {
                  ready,
                  start() {
                    if (finished || orderingStarted) {
                      return;
                    }
                    orderingStarted = true;
                    try {
                      worker.postMessage({
                        type: "continue-ordering",
                        ...context,
                      });
                    } catch {
                      settle(failure("CANONICAL_WORKER_FAILED"));
                    }
                  },
                },
              });
            }, 0);
          } else if (data.type === "result") {
            if (
              previewTimer !== undefined ||
              (previewDelivered && !orderingStarted)
            ) {
              settle(failure("CANONICAL_WORKER_FAILED"));
              return;
            }
            // Receiving a large structured clone already uses the main thread.
            // Start consumer processing in another task so input/cancellation
            // can run before scene construction or the next request snapshot.
            if (resultTimer === undefined) {
              resultTimer = setTimeout(() => settle(null, data.result), 0);
            }
          } else if (data.type === "failure") {
            const code = data.failure?.code;
            settle(
              failure(
                typeof code === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(code)
                  ? code
                  : "CANONICAL_OPERATION_FAILED",
                data.failure?.details,
              ),
            );
          } else if (data.type === "import") {
            if (
              !Number.isSafeInteger(data.importId) ||
              data.importId < 1 ||
              importIds.has(data.importId)
            ) {
              settle(failure("CANONICAL_WORKER_FAILED"));
              return;
            }
            importIds.add(data.importId);
            try {
              if (typeof resolveImport !== "function") {
                throw failure("IMPORT_FAILED");
              }
              const imported = await resolveImport(data.importIri, {
                importingDocumentIri: data.importingDocumentIri,
                signal: acquisition.signal,
              });
              if (finished) {
                return;
              }
              const importBytes = copyBytes(imported.bytes);
              acquiredBytes += importBytes.byteLength;
              if (acquiredBytes > inputLimit) {
                settle(failure("RESOURCE_LIMIT_EXCEEDED"));
                return;
              }
              worker.postMessage(
                {
                  type: "import-result",
                  ...context,
                  importId: data.importId,
                  document: {
                    bytes: importBytes,
                    mediaType: imported.mediaType,
                    documentIri: imported.documentIri,
                  },
                },
                [importBytes.buffer],
              );
            } catch {
              if (!finished) {
                worker.postMessage({
                  type: "import-result",
                  ...context,
                  importId: data.importId,
                  failure: true,
                });
              }
            }
          }
        };
        if (signal?.aborted) {
          abort();
          return;
        }
        try {
          worker.postMessage(
            {
              type: "run",
              ...context,
              request: payload,
              ...(deferNodeOrdering ? { deferNodeOrdering: true } : {}),
            },
            bytes ? [payload.bytes.buffer] : [],
          );
        } catch {
          settle(failure("CANONICAL_WORKER_FAILED"));
        }
      });
    },
    dispose() {
      disposed = true;
      for (const abort of pending) {
        abort();
      }
    },
  });
}
