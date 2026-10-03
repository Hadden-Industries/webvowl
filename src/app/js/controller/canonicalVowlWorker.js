import {
  runCanonicalVowlOperation,
  canonicalWorkerFailure,
} from "./canonicalVowlWorkerOperations.js";

// A dedicated, single-job worker has no accepted application state to lose on
// termination. Cancellation can interrupt synchronous parser/canonicalizer work.
let activeRequest;
let nextImportId = 0;
const imports = new Map();

export async function handleCanonicalVowlWorkerMessage({ data }) {
  if (data?.type === "import-result") {
    if (
      !activeRequest ||
      data.requestId !== activeRequest.requestId ||
      data.loadGeneration !== activeRequest.loadGeneration ||
      data.baseRevision !== activeRequest.baseRevision
    ) {
      return;
    }
    const pending = imports.get(data.importId);
    if (!pending) {
      return;
    }
    imports.delete(data.importId);
    if (data.failure) {
      pending.reject(new Error("Import acquisition failed."));
    } else {
      pending.resolve(data.document);
    }
    return;
  }
  if (data?.type !== "run" || activeRequest) {
    return;
  }
  const { requestId, loadGeneration, baseRevision } = data;
  activeRequest = { requestId, loadGeneration, baseRevision };
  const context = activeRequest;
  try {
    const result = await runCanonicalVowlOperation(
      data.request,
      (importIri, { importingDocumentIri }) =>
        new Promise((resolve, reject) => {
          const importId = ++nextImportId;
          imports.set(importId, { resolve, reject });
          globalThis.postMessage({
            type: "import",
            ...context,
            importId,
            importIri,
            importingDocumentIri,
          });
        }),
      context,
    );
    globalThis.postMessage(
      { type: "result", ...context, result },
      result.bytes ? [result.bytes.buffer] : [],
    );
  } catch (error) {
    globalThis.postMessage({
      type: "failure",
      ...context,
      failure: canonicalWorkerFailure(error),
    });
  }
}

globalThis.onmessage = handleCanonicalVowlWorkerMessage;
