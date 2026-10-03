const DEFAULT_DEADLINE_MS = 10000;
const MAXIMUM_DEADLINE_MS = 300000;
const DEFAULT_INPUT_BYTES = 33554432;
const MAXIMUM_INPUT_BYTES = 268435456;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteBuffer = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
).get;
const byteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
).get;

function failure(code) {
  const error = new Error(code.replaceAll("_", " ").toLowerCase());
  error.name = "CanonicalVowlOperationError";
  error.code = code;
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

function positiveLimit(value, fallback, maximum) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw failure("OPTION_INVALID");
  }
  return result;
}

/** Bound plain checkpoint/request data before structuredClone allocates its copy. */
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
  function visit(item, depth, path) {
    if (depth > maxDepth) {
      throw failure("RESOURCE_LIMIT_EXCEEDED");
    }
    if (typeof item === "string") {
      return string(item);
    }
    if (item === null || typeof item === "boolean") {
      return add(5);
    }
    if (typeof item === "number" && Number.isFinite(item)) {
      return add(String(item).length);
    }
    if (!item || typeof item !== "object" || ancestors.has(item)) {
      throw failure("CHECKPOINT_INVALID");
    }
    if (/^\/checkpoint\/source\/sources\/(0|[1-9][0-9]*)\/bytes$/.test(path)) {
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
      visit(descriptor.value, depth + 1, `${path}/${key}`);
    }
    if (array && members !== item.length) {
      throw failure("CHECKPOINT_INVALID");
    }
    ancestors.delete(item);
  }
  visit(value, 0, "");
  return size;
}

/**
 * Owns worker lifetime, source-byte transfer and caller-controlled acquisition.
 * Requests carry their exact document generation/revision; the controller must
 * still compare those to its current state before committing a returned result.
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
      { loadGeneration, baseRevision, signal, resolveImport } = {},
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
      const deadlineMs = positiveLimit(
        request.limits?.deadlineMs,
        DEFAULT_DEADLINE_MS,
        MAXIMUM_DEADLINE_MS,
      );
      const inputLimit = positiveLimit(
        request.limits?.inputBytes,
        DEFAULT_INPUT_BYTES,
        MAXIMUM_INPUT_BYTES,
      );
      // Snapshot before yielding. Transferring our copy must not detach the
      // caller's last accepted document or its source acquisition buffers.
      const checkpointOperation = [
        "recover-model",
        "edit-model",
        "capture-model",
      ].includes(request.operation);
      const bytes = checkpointOperation ? undefined : copyBytes(request.bytes);
      let acquiredBytes = bytes?.byteLength ?? 0;
      let checkpointPayload;
      if (checkpointOperation) {
        const depth = positiveLimit(request.limits?.depth, 128, 512);
        const allowed = [
          "operation",
          "checkpoint",
          "limits",
          ...(request.operation === "edit-model"
            ? ["changes"]
            : request.operation === "capture-model"
              ? ["profile", "visualization"]
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
      const payload = structuredClone(
        checkpointPayload ?? { ...request, bytes },
      );
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
        const timer = setTimeout(
          () => settle(failure("RESOURCE_LIMIT_EXCEEDED")),
          deadlineMs,
        );
        function settle(error, result) {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          acquisition.abort();
          worker.terminate();
          pending.delete(abort);
          if (error) {
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
        worker.onerror = () => settle(failure("CANONICAL_WORKER_FAILED"));
        worker.onmessageerror = () =>
          settle(failure("CANONICAL_WORKER_FAILED"));
        worker.onmessage = async ({ data }) => {
          if (
            finished ||
            !data ||
            Object.keys(context).some((key) => data[key] !== context[key])
          ) {
            return;
          }
          if (data.type === "result") {
            settle(null, data.result);
          } else if (data.type === "failure") {
            const code = data.failure?.code;
            settle(
              failure(
                typeof code === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(code)
                  ? code
                  : "CANONICAL_OPERATION_FAILED",
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
            { type: "run", ...context, request: payload },
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
