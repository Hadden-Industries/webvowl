import { readBoundedBytes } from "./boundedSourceBytes.js";
import { ResourceLimitError } from "owlapi/io";
import { parseOntologyCacheJson } from "./ontologyCacheJson.js";
import {
  ontologyCachePaths,
  validateOntologyCacheRecord,
  verifyOntologyResolution,
} from "./ontologyResolutionEvidence.js";
import {
  ontologyServiceOrigin,
  ontologySourceKey,
  ontologySha256,
  OntologyCacheError,
} from "./ontologySourceIdentity.js";

function wait(milliseconds, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Portable credential-free HTTP consumer. Its finite lifetime never includes a human interaction. */
export function createOntologyMaterializationClient({
  serviceOrigin,
  approvedPolicyFingerprints = [],
  fetchImpl = globalThis.fetch,
  maxDocumentBytes = 33554432,
  deadlineMs = 60000,
  now = Date.now,
} = {}) {
  const origin = ontologyServiceOrigin(serviceOrigin);
  const paths = ontologyCachePaths(origin);
  if (
    !Number.isSafeInteger(maxDocumentBytes) ||
    maxDocumentBytes < 0 ||
    !Number.isSafeInteger(deadlineMs) ||
    deadlineMs < 1 ||
    deadlineMs > 60000
  ) {
    throw new TypeError(
      "Cache acquisition requires finite byte and deadline limits.",
    );
  }
  const boundedSignal = (signal) =>
    AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(deadlineMs),
    ]);

  async function request(url, { signal, ...options } = {}) {
    signal?.throwIfAborted();
    const response = await fetchImpl(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      ...options,
      signal,
    });
    signal?.throwIfAborted();
    if (response.url && !response.url.startsWith(`${origin}/ontology/`)) {
      await response.body?.cancel();
      throw new OntologyCacheError();
    }
    return response;
  }
  async function jsonResponse(response, signal, limit = 65536) {
    if (
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      await response.body?.cancel();
      throw new OntologyCacheError();
    }
    return parseOntologyCacheJson(
      await readBoundedBytes(response, limit, signal, ResourceLimitError),
    );
  }
  async function readJson(url, signal, limit = 65536, options) {
    const response = await request(url, { ...options, signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new OntologyCacheError();
    }
    return jsonResponse(response, signal, limit);
  }
  async function evidence(
    requestedDocumentIri,
    resolutionIdentity,
    signal,
    binding,
    context = {},
  ) {
    context.policies ??= new Map();
    return verifyOntologyResolution({
      requestedDocumentIri,
      resolutionIdentity,
      binding,
      paths,
      approvedPolicyFingerprints,
      readJson: (url, limit) => {
        if (!url.startsWith(`${origin}/ontology/cache/policies/`)) {
          return readJson(url, signal, limit);
        }
        if (!context.policies.has(url)) {
          context.policies.set(url, readJson(url, signal, limit));
        }
        return context.policies.get(url);
      },
    });
  }
  async function artifact(resolution, signal, response) {
    response ??= await request(resolution.artifactIri, { signal });
    if (!response.ok || response.status !== 200) {
      await response.body?.cancel();
      throw new OntologyCacheError();
    }
    const bytes = await readBoundedBytes(
      response,
      Math.min(maxDocumentBytes, resolution.artifactByteLength),
      signal,
      ResourceLimitError,
    );
    if (
      bytes.length !== resolution.artifactByteLength ||
      (await ontologySha256(bytes)) !== resolution.artifactSha256
    ) {
      throw new OntologyCacheError("CACHE_ARTIFACT_CORRUPT");
    }
    signal.throwIfAborted();
    return { bytes, documentIri: resolution.parserDocumentIri, resolution };
  }
  async function fromTarget(requestedDocumentIri, target, signal, response) {
    try {
      const url = new URL(target);
      const sourceKey = await ontologySourceKey(requestedDocumentIri);
      const digest = url.pathname.split("/").at(-1);
      const resolutionIdentity = url.searchParams.get("binding");
      if (
        url.origin !== origin ||
        url.pathname !== new URL(paths.artifact(digest)).pathname ||
        url.hash ||
        url.search !== `?source=${sourceKey}&binding=${resolutionIdentity}`
      ) {
        throw new OntologyCacheError();
      }
      const resolution = await evidence(
        requestedDocumentIri,
        resolutionIdentity,
        signal,
      );
      if (resolution.artifactSha256 !== digest) {
        throw new OntologyCacheError();
      }
      return await artifact(resolution, signal, response);
    } catch (error) {
      await response?.body?.cancel().catch(() => {});
      throw error;
    }
  }
  async function post(url, body, signal, background = false) {
    // Serialize once: the body digest covers these exact transmitted UTF-8 bytes.
    const bytes = new TextEncoder().encode(JSON.stringify(body));
    if (bytes.length > 8192) {
      throw new OntologyCacheError();
    }
    const digest = await ontologySha256(bytes);
    signal.throwIfAborted();
    return request(url, {
      signal,
      method: "POST",
      redirect: "follow",
      ...(background ? { priority: "low" } : {}),
      headers: {
        "content-type": "application/json",
        "x-amz-content-sha256": digest,
      },
      body: bytes,
    });
  }
  async function observe(
    response,
    signal,
    expectedUrl,
    kind,
    sourceKey,
    background = false,
    initialState,
  ) {
    const end = now() + deadlineMs;
    let admitted;
    for (let count = 0; count < 20; count++) {
      signal.throwIfAborted();
      if (response.status !== 202) {
        return response;
      }
      const state = validateOntologyCacheRecord(
        kind,
        count === 0 && initialState
          ? initialState
          : await jsonResponse(response, signal),
      );
      if (
        admitted &&
        (state.generation !== admitted.generation ||
          state.admittedAt !== admitted.admittedAt ||
          state.refreshAttemptId !== admitted.refreshAttemptId)
      ) {
        throw new OntologyCacheError();
      }
      admitted ??= state;
      if (
        state.state !== "PENDING" ||
        state.statusIri !== expectedUrl ||
        (kind === "materialization"
          ? state.materializationId
          : state.sourceKey) !== sourceKey
      ) {
        throw new OntologyCacheError();
      }
      const retry = response.headers.get("retry-after");
      const delay = /^\d+$/u.test(retry ?? "")
        ? Number(retry) * 1000
        : Date.parse(retry) - now();
      if (!Number.isFinite(delay) || delay < 0 || now() + delay >= end) {
        throw new OntologyCacheError("CACHE_PENDING");
      }
      if (response.headers.get("location") !== expectedUrl) {
        throw new OntologyCacheError();
      }
      await wait(Math.max(1, delay), signal);
      response = await request(expectedUrl, {
        signal,
        redirect: "follow",
        cache: "no-store",
        ...(background ? { priority: "low" } : {}),
      });
    }
    await response.body?.cancel();
    throw new OntologyCacheError("CACHE_PENDING");
  }
  async function ready(requestedDocumentIri, response, signal) {
    if (
      response.status === 200 &&
      response.url?.startsWith(`${origin}/ontology/cache/artifacts/sha256/`)
    ) {
      return fromTarget(requestedDocumentIri, response.url, signal, response);
    }
    if (!response.ok) {
      const value = validateOntologyCacheRecord(
        "error",
        await jsonResponse(response, signal),
      );
      const code = [
        "SOURCE_WITHDRAWN",
        "SOURCE_QUARANTINED",
        "CONTENT_QUARANTINED",
      ].includes(value.error.code)
        ? value.error.code
        : "CACHE_UNAVAILABLE";
      throw new OntologyCacheError(code);
    }
    await response.body?.cancel();
    throw new OntologyCacheError();
  }

  return Object.freeze({
    origin,
    paths,
    async lookup(requestedDocumentIri, { signal: callerSignal, context } = {}) {
      const signal = boundedSignal(callerSignal);
      const key = await ontologySourceKey(requestedDocumentIri);
      const response = await request(paths.pointer(key), { signal });
      if (response.status === 404) {
        await response.body?.cancel();
        return undefined;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new OntologyCacheError();
      }
      const pointer = validateOntologyCacheRecord(
        "pointer",
        await jsonResponse(response, signal),
      );
      if (pointer.sourceKey !== key) {
        throw new OntologyCacheError();
      }
      if (pointer.accessState !== "ELIGIBLE") {
        throw new OntologyCacheError(pointer.reasonCode);
      }
      if (pointer.requestedDocumentIri !== requestedDocumentIri) {
        throw new OntologyCacheError();
      }
      const resolution = await evidence(
        requestedDocumentIri,
        pointer.currentBinding.resolutionIdentity,
        signal,
        pointer.currentBinding,
        context,
      );
      if (resolution.generation !== pointer.generation) {
        throw new OntologyCacheError();
      }
      return { ...(await artifact(resolution, signal)), pointer };
    },
    async acquireBinding(requestedDocumentIri, target, { signal } = {}) {
      return fromTarget(requestedDocumentIri, target, boundedSignal(signal));
    },
    async materialize(requestedDocumentIri, { signal: callerSignal } = {}) {
      const signal = boundedSignal(callerSignal);
      const key = await ontologySourceKey(requestedDocumentIri);
      const initial = await post(
        `${origin}/ontology/materializations`,
        { requestedDocumentIri },
        signal,
      );
      const pending =
        initial.status === 202
          ? validateOntologyCacheRecord(
              "materialization",
              await jsonResponse(initial, signal),
            )
          : undefined;
      const acquired = await ready(
        requestedDocumentIri,
        await observe(
          initial,
          signal,
          paths.status(key),
          "materialization",
          key,
          false,
          pending,
        ),
        signal,
      );
      if (pending && acquired.resolution.generation < pending.generation) {
        throw new OntologyCacheError();
      }
      return acquired;
    },
    async refresh(
      requestedDocumentIri,
      { signal: callerSignal, mode = "if-due" } = {},
    ) {
      if (!["if-due", "check-now"].includes(mode)) {
        throw new TypeError("Unknown refresh mode.");
      }
      const signal = boundedSignal(callerSignal);
      const key = await ontologySourceKey(requestedDocumentIri);
      const initial = await post(
        `${paths.status(key)}/refreshes`,
        { requestedDocumentIri, mode },
        signal,
        true,
      );
      if (!initial.ok) {
        return ready(requestedDocumentIri, initial, signal);
      }
      if (initial.status !== 202) {
        const result = validateOntologyCacheRecord(
          "refresh",
          await jsonResponse(initial, signal),
        );
        if (result.sourceKey !== key || result.state !== "SKIPPED_FRESH") {
          throw new OntologyCacheError();
        }
        await evidence(
          requestedDocumentIri,
          result.currentBinding.resolutionIdentity,
          signal,
          result.currentBinding,
        );
        return result;
      }
      const pending = validateOntologyCacheRecord(
        "refresh",
        await jsonResponse(initial, signal),
      );
      if (pending.mode !== mode) {
        throw new OntologyCacheError();
      }
      const expected = `${paths.status(key)}/refreshes/${pending.refreshAttemptId}`;
      const response = await observe(
        initial,
        signal,
        expected,
        "refresh",
        key,
        true,
        pending,
      );
      if (!response.ok) {
        return ready(requestedDocumentIri, response, signal);
      }
      const result = validateOntologyCacheRecord(
        "refresh",
        await jsonResponse(response, signal),
      );
      if (
        result.sourceKey !== key ||
        result.refreshAttemptId !== pending.refreshAttemptId ||
        result.state === "PENDING" ||
        result.statusIri !== expected ||
        result.generation !== pending.generation ||
        result.mode !== pending.mode ||
        !Object.keys(pending.baselineBinding).every(
          (key) => result.baselineBinding[key] === pending.baselineBinding[key],
        ) ||
        Date.parse(result.finishedAt) < Date.parse(result.admittedAt) ||
        (result.startedAt !== undefined &&
          (Date.parse(result.startedAt) < Date.parse(result.admittedAt) ||
            Date.parse(result.startedAt) > Date.parse(result.finishedAt))) ||
        (result.state === "CHANGED" &&
          (result.upstreamStatus === 304 ||
            result.resultBinding.sourceVersionIdentity ===
              result.baselineBinding.sourceVersionIdentity)) ||
        (result.state === "UNCHANGED" &&
          result.resultBinding.sourceVersionIdentity !==
            result.baselineBinding.sourceVersionIdentity) ||
        (["FAILED", "SUPERSEDED"].includes(result.state) &&
          result.resultBinding !== undefined)
      ) {
        throw new OntologyCacheError();
      }
      if (
        result.state === "FAILED" &&
        [
          "SOURCE_WITHDRAWN",
          "SOURCE_QUARANTINED",
          "CONTENT_QUARANTINED",
        ].includes(result.error.code)
      ) {
        throw new OntologyCacheError(result.error.code);
      }
      if (result.resultBinding) {
        const resolution = await evidence(
          requestedDocumentIri,
          result.resultBinding.resolutionIdentity,
          signal,
          result.resultBinding,
        );
        if (resolution.generation !== result.generation) {
          throw new OntologyCacheError();
        }
      }
      return result;
    },
    async confirm(
      requestedDocumentIri,
      resolutionIdentity,
      { signal: callerSignal } = {},
    ) {
      const signal = boundedSignal(callerSignal);
      const key = await ontologySourceKey(requestedDocumentIri);
      const acquired = await ready(
        requestedDocumentIri,
        await request(paths.status(key), {
          signal,
          cache: "no-store",
          redirect: "follow",
        }),
        signal,
      );
      if (acquired.resolution.resolutionIdentity !== resolutionIdentity) {
        throw new OntologyCacheError("CACHE_OFFER_SUPERSEDED");
      }
      return acquired;
    },
  });
}
