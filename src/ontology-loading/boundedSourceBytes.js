/** Stop waiting for an unabortable lazy import; its late completion cannot revive acquisition. */
export function waitForOntologyAcquisition(result, signal) {
  signal?.throwIfAborted();
  if (!signal) {
    return result;
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(result).then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) {
          reject(signal.reason);
        } else {
          resolve(value);
        }
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

/** Read exact decoded bytes with cancellation and a finite allocation bound.
 * The caller supplies its public error constructor so this shared loop stays
 * independent of vendor initialization (including production chunk ordering).
 */
export async function readBoundedBytes(response, limit, signal, LimitError) {
  if (response.body === null) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  const cancel = (reason) => {
    void reader.cancel(reason).catch(() => {});
  };
  const abort = () => cancel(signal.reason);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal?.throwIfAborted();
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > limit) {
        throw new LimitError(
          "The remote ontology document byte limit was exceeded",
          {
            limit,
            observed: length,
            resource: "maxRemoteDocumentBytes",
          },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    cancel(error);
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
