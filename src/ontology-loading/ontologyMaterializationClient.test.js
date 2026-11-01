import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import canonicalize from "canonicalize";
import {
  MissingImportError,
  ResourceLimitError,
  UnloadableImportError,
} from "owlapi/io";
import { createOntologyMaterializationClient } from "./ontologyMaterializationClient.js";
import { createCachedOntologySourceAcquisition } from "./cachedOntologySourceAcquisition.js";
import { validateOntologyCacheRecord } from "./ontologyResolutionEvidence.js";
import { ontologyRecordIdentity } from "./ontologySourceIdentity.js";

const fixtures = JSON.parse(
  readFileSync(
    new URL("./contracts/fixtures/protocol-cases.v1.json", import.meta.url),
  ),
);
const example = (id) =>
  structuredClone(
    [...fixtures.schemaExamples, ...fixtures.semanticExamples].find(
      (entry) => entry.id === id,
    ).value,
  );
const origin = fixtures.serviceOrigin;
const source = example("A-resolution").requestedDocumentIri;
const encoder = new TextEncoder();

function harness({
  mutate,
  pointerStatus = 200,
  api,
  artifactText = fixtures.ontologySource.utf8Text,
} = {}) {
  const pointer = example("source-current");
  const resolution = example("A-resolution");
  const records = new Map([
    [
      `${origin}/ontology/cache/provenance/sources/${pointer.sourceKey}.json`,
      pointer,
    ],
    [pointer.currentBinding.resolutionIri, resolution],
    [pointer.currentBinding.versionIri, example("A-version")],
    [pointer.currentBinding.validationIri, example("A-validation")],
    [resolution.loaderPolicyIri, example("loader-policy")],
  ]);
  for (const prefix of ["A304", "B"]) {
    const record = example(`${prefix}-resolution`);
    records.set(
      `${origin}/ontology/cache/resolutions/sha256/${record.resolutionIdentity}.json`,
      record,
    );
    records.set(
      `${origin}/ontology/cache/versions/sha256/${record.sourceVersionIdentity}.json`,
      example(`${prefix}-version`),
    );
    records.set(record.validationIri, example(`${prefix}-validation`));
  }
  mutate?.(records, pointer);
  const response = (value, url, status = 200, headers = {}) => {
    const result = new Response(value, { status, headers });
    Object.defineProperty(result, "url", { value: url });
    return result;
  };
  const fetchImpl = jest.fn(async (url, options = {}) => {
    options.signal?.throwIfAborted();
    if (api && url.includes("/ontology/materializations")) {
      return api({ url, options, response, pointer });
    }
    if (url.includes("/provenance/") && pointerStatus !== 200) {
      return response("", url, pointerStatus);
    }
    if (url === pointer.currentBinding.artifactIri) {
      return response(encoder.encode(artifactText), url, 200, {
        "content-type": "application/octet-stream",
      });
    }
    if (!records.has(url)) {
      throw new Error(`Unexpected protocol fixture request ${url}`);
    }
    return response(JSON.stringify(records.get(url)), url, 200, {
      "content-type": "application/json",
    });
  });
  const options = {
    serviceOrigin: origin,
    approvedPolicyFingerprints: [resolution.loaderProfileFingerprint],
    fetchImpl,
  };
  return {
    client: createOntologyMaterializationClient(options),
    options,
    records,
    fetchImpl,
    pointer,
    response,
  };
}

test("static hit verifies the complete chain, exact bytes and origin parser context", async () => {
  const { client, fetchImpl } = harness();
  const acquired = await client.lookup(source);
  expect(acquired.bytes).toEqual(
    encoder.encode(fixtures.ontologySource.utf8Text),
  );
  expect(acquired.documentIri).toBe(fixtures.ontologySource.parserDocumentIri);
  expect(acquired.documentIri).not.toContain("cache.example.test");
  expect(fetchImpl).toHaveBeenCalledTimes(6);
  for (const [, options] of fetchImpl.mock.calls) {
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
  }
});

async function curatedHarness(mutate, options = {}) {
  const resolution = example("curated-archive-resolution");
  mutate?.(resolution);
  const { resolutionIdentity: previous, ...input } = resolution;
  expect(previous).toBeDefined();
  resolution.resolutionIdentity = await ontologyRecordIdentity(
    "resolution",
    input,
  );
  return harness({
    ...options,
    mutate(records, pointer) {
      records.delete(pointer.currentBinding.resolutionIri);
      pointer.currentBinding.resolutionIdentity = resolution.resolutionIdentity;
      pointer.currentBinding.resolutionIri = `${origin}/ontology/cache/resolutions/sha256/${resolution.resolutionIdentity}.json`;
      for (const field of [
        "acquiredAt",
        "lastSuccessfullyCheckedAt",
        "lastChangedAt",
        "freshUntil",
      ]) {
        if (Object.hasOwn(pointer, field)) {
          pointer[field] = resolution.acquiredAt;
        }
      }
      records.set(pointer.currentBinding.resolutionIri, resolution);
    },
  });
}

test("curated archive lookup verifies exact bytes with the original parser base and no archive or API fetch", async () => {
  const h = await curatedHarness();
  const acquired = await h.client.lookup(source);
  expect(acquired.bytes).toEqual(
    encoder.encode(fixtures.ontologySource.utf8Text),
  );
  expect(acquired.documentIri).toBe(fixtures.ontologySource.parserDocumentIri);
  expect(h.fetchImpl).toHaveBeenCalledTimes(6);
  expect(
    h.fetchImpl.mock.calls.every(([url]) =>
      url.startsWith(origin + "/ontology/cache/"),
    ),
  ).toBe(true);
});

test.each([
  [
    "original parser context",
    (r) => {
      r.archiveCapture.originalDocumentIri =
        "https://other.example.test/root.ttl";
    },
  ],
  [
    "archive used as retrieval context",
    (r) => {
      r.retrievalIri = r.archiveCapture.archiveIri;
    },
  ],
  [
    "new check time",
    (r) => {
      r.checkedAt = "2026-10-01T00:00:00.000Z";
    },
  ],
  [
    "future capture",
    (r) => {
      r.archiveCapture.capturedAt =
        r.acquiredAt =
        r.checkedAt =
          "2099-01-01T00:00:00.000Z";
    },
  ],
  [
    "invalid calendar date",
    (r) => {
      r.archiveCapture.capturedAt =
        r.acquiredAt =
        r.checkedAt =
          "2024-02-30T03:41:07.000Z";
    },
  ],
  [
    "noncanonical original URI",
    (r) => {
      r.archiveCapture.originalDocumentIri =
        "https://origin.example.test/v1/../v1/root.ttl";
    },
  ],
  [
    "original fragment",
    (r) => {
      r.archiveCapture.originalDocumentIri += "#part";
    },
  ],
  [
    "archive IPvFuture IRI",
    (r) => {
      r.archiveCapture.archiveIri = "https://[v1.example]/";
    },
  ],
  [
    "original-context IPvFuture IRI",
    (r) => {
      r.archiveCapture.originalDocumentIri = "https://[v1.example]/";
    },
  ],
  [
    "archive fragment",
    (r) => {
      r.archiveCapture.archiveIri += "#part";
    },
  ],
  [
    "noncanonical archive URI",
    (r) => {
      r.archiveCapture.archiveIri =
        "https://archive.example.test/a/../root.ttl";
    },
  ],
  [
    "provenance byte limit",
    (r) => {
      r.archiveCapture.knownOriginalHeaders.etag = "x".repeat(4096);
      r.archiveCapture.knownOriginalHeaders["last-modified"] = "y".repeat(4096);
    },
  ],
  [
    "header control character",
    (r) => {
      r.archiveCapture.knownOriginalHeaders.etag = "value\n";
    },
  ],
  [
    "media control character",
    (r) => {
      r.archiveCapture.archiveMediaType = "text/turtle\n";
    },
  ],
  [
    "invented request facts",
    (r) => {
      r.requestVariant = example("A-resolution").requestVariant;
    },
  ],
  [
    "automatic disposition with unknown HTTP facts",
    (r) => {
      r.publicationDisposition = "AUTOMATIC_PUBLIC_ARCHIVE";
    },
  ],
])(
  "curated archive rejects rehashed invalid %s before artifact acquisition",
  async (_label, mutate) => {
    const h = await curatedHarness(mutate);
    await expect(h.client.lookup(source)).rejects.toHaveProperty(
      "code",
      "CACHE_PROTOCOL_INVALID",
    );
    expect(
      h.fetchImpl.mock.calls.some(([url]) => url.includes("/artifacts/")),
    ).toBe(false);
  },
);

test("curated archive still rejects changed artifact bytes", async () => {
  const h = await curatedHarness(undefined, { artifactText: "changed" });
  await expect(h.client.lookup(source)).rejects.toHaveProperty(
    "code",
    "CACHE_ARTIFACT_CORRUPT",
  );
});

test.each(["acquireBinding", "materialize"])(
  "%s shares immutable policy acquisition only within the supplied load context",
  async (method) => {
    const h = harness({
      api({ response, pointer }) {
        return response(
          encoder.encode(fixtures.ontologySource.utf8Text),
          `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
        );
      },
    });
    const target = `${h.pointer.currentBinding.artifactIri}?source=${h.pointer.sourceKey}&binding=${h.pointer.currentBinding.resolutionIdentity}`;
    const acquire = (context) =>
      method === "acquireBinding"
        ? h.client.acquireBinding(source, target, { context })
        : h.client.materialize(source, { context });
    const context = {};
    await Promise.all([acquire(context), acquire(context)]);
    const policyCalls = () =>
      h.fetchImpl.mock.calls.filter(([url]) => url.includes("/policies/"));
    expect(policyCalls()).toHaveLength(1);
    await acquire({});
    expect(policyCalls()).toHaveLength(2);
  },
);

test.each(["heuristic", "unambiguous"])(
  "a %s policy accepts its matching validation and rejects relabelled mapping evidence before artifact fetch",
  async (owlMappingStrategy) => {
    const h = harness();
    const resolution = example("A-resolution");
    const policy = example("loader-policy");
    const validation = example("A-validation");
    if (owlMappingStrategy === "heuristic") {
      policy.policy.validationProfileId =
        "ontology-source-document-heuristic-v1";
      policy.policy.parseMode = "compatible";
    }
    policy.loaderProfileFingerprint = await ontologyRecordIdentity(
      "loader-policy",
      policy.policy,
    );
    validation.identityInputs.loaderProfileFingerprint =
      policy.loaderProfileFingerprint;
    validation.validationProfileId = policy.policy.validationProfileId;
    validation.parseMode = policy.policy.parseMode;
    validation.validationIdentity = await ontologyRecordIdentity(
      "document-validation",
      validation.identityInputs,
    );
    resolution.loaderProfileFingerprint = policy.loaderProfileFingerprint;
    resolution.loaderPolicyIri = `${origin}/ontology/cache/policies/sha256/${policy.loaderProfileFingerprint}.json`;
    resolution.validationIdentity = validation.validationIdentity;
    resolution.validationIri = `${origin}/ontology/cache/validations/sha256/${validation.validationIdentity}.json`;
    const resolutionInput = { ...resolution };
    delete resolutionInput.resolutionIdentity;
    resolution.resolutionIdentity = await ontologyRecordIdentity(
      "resolution",
      resolutionInput,
    );
    const resolutionIri = `${origin}/ontology/cache/resolutions/sha256/${resolution.resolutionIdentity}.json`;
    Object.assign(h.pointer.currentBinding, {
      resolutionIdentity: resolution.resolutionIdentity,
      resolutionIri,
      validationIdentity: validation.validationIdentity,
      validationIri: resolution.validationIri,
    });
    h.records.set(resolutionIri, resolution);
    h.records.set(resolution.loaderPolicyIri, policy);
    h.records.set(resolution.validationIri, validation);
    const client = createOntologyMaterializationClient({
      ...h.options,
      approvedPolicyFingerprints: [policy.loaderProfileFingerprint],
    });
    await expect(client.lookup(source)).resolves.toHaveProperty("bytes");
    validation.validationProfileId =
      owlMappingStrategy === "heuristic"
        ? "ontology-source-document-v1"
        : "ontology-source-document-heuristic-v1";
    validation.parseMode =
      owlMappingStrategy === "heuristic" ? "preserve" : "compatible";
    expect(() =>
      validateOntologyCacheRecord("validation", validation),
    ).not.toThrow();
    h.fetchImpl.mockClear();
    await expect(client.lookup(source)).rejects.toHaveProperty(
      "code",
      "CACHE_PROTOCOL_INVALID",
    );
    expect(
      h.fetchImpl.mock.calls.some(([url]) => url.includes("/artifacts/")),
    ).toBe(false);
  },
);

test.each(["waiter", "owner"])(
  "a cancelled shared-policy %s cannot delay or cancel the other caller",
  async (cancelled) => {
    const h = harness();
    let entered, release;
    const policyStarted = new Promise((resolve) => {
      entered = resolve;
    });
    let firstPolicy = true;
    const client = createOntologyMaterializationClient({
      ...h.options,
      fetchImpl: async (url, options) => {
        if (firstPolicy && url.includes("/policies/")) {
          firstPolicy = false;
          entered();
          await new Promise((resolve, reject) => {
            release = resolve;
            options.signal.addEventListener(
              "abort",
              () => reject(options.signal.reason),
              { once: true },
            );
          });
        }
        return h.fetchImpl(url, options);
      },
    });
    const context = {};
    const owner = new AbortController(),
      waiter = new AbortController();
    const first = client.lookup(source, { context, signal: owner.signal });
    const firstOutcome = Promise.allSettled([first]);
    await policyStarted;
    let secondSettled = false;
    const second = client.lookup(source, { context, signal: waiter.signal });
    const secondOutcome = Promise.allSettled([second]).then((value) => {
      secondSettled = true;
      return value;
    });
    for (let index = 0; index < 20; index++) {
      await new Promise(setImmediate);
    }
    const reason = new Error("cancel this caller");
    (cancelled === "owner" ? owner : waiter).abort(reason);
    try {
      for (let index = 0; index < 50 && !secondSettled; index++) {
        await new Promise(setImmediate);
      }
      expect(secondSettled).toBe(true);
      const [result] = await secondOutcome;
      if (cancelled === "waiter") {
        expect(result).toMatchObject({ status: "rejected", reason });
        release();
        expect((await firstOutcome)[0].status).toBe("fulfilled");
      } else {
        expect(result.status).toBe("fulfilled");
        expect((await firstOutcome)[0]).toMatchObject({
          status: "rejected",
          reason,
        });
      }
    } finally {
      release();
      owner.abort();
      waiter.abort();
      await Promise.all([firstOutcome, secondOutcome]);
    }
  },
);

test("a failed policy read is evicted before a new acquisition in the same load context", async () => {
  const h = harness();
  let fail = true;
  const client = createOntologyMaterializationClient({
    ...h.options,
    fetchImpl: async (url, options) => {
      if (url.includes("/policies/") && fail) {
        fail = false;
        throw new TypeError("transient transport failure");
      }
      return h.fetchImpl(url, options);
    },
  });
  const context = {};
  await expect(client.lookup(source, { context })).rejects.toThrow(
    "transient transport failure",
  );
  const target = `${h.pointer.currentBinding.artifactIri}?source=${h.pointer.sourceKey}&binding=${h.pointer.currentBinding.resolutionIdentity}`;
  await expect(
    client.acquireBinding(source, target, { context }),
  ).resolves.toHaveProperty("bytes");
});

test.each([
  [
    "resolution",
    (record) => {
      record.parserDocumentIri = "https://evil.test/base";
    },
  ],
  [
    "versions",
    (record) => {
      record.sourceKey = "0".repeat(64);
    },
  ],
  [
    "validations",
    (record) => {
      record.identityInputs.observedFormatId = "made-up";
    },
  ],
  [
    "policies",
    (record) => {
      record.policy.remoteJsonLdContexts = true;
    },
  ],
])("a corrupt %s never reaches the artifact", async (kind, mutate) => {
  const { client, fetchImpl } = harness({
    mutate(records) {
      const [, record] = [...records].find(([url]) => url.includes(`/${kind}`));
      mutate(record);
    },
  });
  await expect(client.lookup(source)).rejects.toHaveProperty(
    "code",
    "CACHE_PROTOCOL_INVALID",
  );
  expect(
    fetchImpl.mock.calls.some(([url]) => url.includes("/artifacts/")),
  ).toBe(false);
});

test("artifact digest mismatch is rejected after bounded acquisition", async () => {
  const { client } = harness({
    artifactText: fixtures.ontologySource.utf8Text.replace("Thing", "Other"),
  });
  await expect(client.lookup(source)).rejects.toHaveProperty(
    "code",
    "CACHE_ARTIFACT_CORRUPT",
  );
});

test.each([502, 503, 504])(
  "a redirected artifact HTTP %i is retried once after verifying evidence without repeating admission",
  async (status) => {
    const h = harness({
      api({ response, pointer }) {
        return response(
          "Resource unavailable.",
          `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
          status,
        );
      },
    });
    const result = await h.client.materialize(source);
    expect(result.bytes).toEqual(
      encoder.encode(fixtures.ontologySource.utf8Text),
    );
    expect(
      h.fetchImpl.mock.calls.filter(([, options]) => options.method === "POST"),
    ).toHaveLength(1);
    const reads = h.fetchImpl.mock.calls.filter(
      ([url]) => url === h.pointer.currentBinding.artifactIri,
    );
    expect(reads).toHaveLength(1);
    expect(reads[0][1]).toMatchObject({
      credentials: "omit",
      redirect: "error",
    });
    expect(reads[0][1].headers).toBeUndefined();
  },
);

test("a second transient artifact failure stops after two GETs", async () => {
  const h = harness();
  const original = h.options.fetchImpl;
  let artifacts = 0;
  h.options.fetchImpl = async (url, options) => {
    if (url === h.pointer.currentBinding.artifactIri) {
      artifacts++;
      return h.response("unavailable", url, 503);
    }
    return original(url, options);
  };
  await expect(
    createOntologyMaterializationClient(h.options).lookup(source),
  ).rejects.toHaveProperty("code", "CACHE_PROTOCOL_INVALID");
  expect(artifacts).toBe(2);
});

test.each([403, 404, 429])(
  "artifact HTTP %i is not retried",
  async (status) => {
    const h = harness();
    const original = h.options.fetchImpl;
    let artifacts = 0;
    h.options.fetchImpl = async (url, options) => {
      if (url === h.pointer.currentBinding.artifactIri) {
        artifacts++;
        return h.response("unavailable", url, status);
      }
      return original(url, options);
    };
    await expect(
      createOntologyMaterializationClient(h.options).lookup(source),
    ).rejects.toThrow();
    expect(artifacts).toBe(1);
  },
);

test("a redirected artifact retry still rejects changed bytes", async () => {
  const h = harness({
    artifactText: "corrupted",
    api({ response, pointer }) {
      return response(
        "unavailable",
        `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
        503,
      );
    },
  });
  await expect(h.client.materialize(source)).rejects.toHaveProperty(
    "code",
    "CACHE_ARTIFACT_CORRUPT",
  );
});

test("a transient artifact response cannot bypass an unsupported loader policy", async () => {
  const h = harness({
    api({ response, pointer }) {
      return response(
        "unavailable",
        `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
        503,
      );
    },
  });
  await expect(
    createOntologyMaterializationClient({
      ...h.options,
      approvedPolicyFingerprints: [],
    }).materialize(source),
  ).rejects.toHaveProperty("code", "CACHE_POLICY_UNSUPPORTED");
  expect(
    h.fetchImpl.mock.calls.some(
      ([url]) => url === h.pointer.currentBinding.artifactIri,
    ),
  ).toBe(false);
});

test.each(["86400", "not-a-date"])(
  "an unusable artifact Retry-After %s does not cause another read",
  async (hint) => {
    const h = harness();
    const original = h.options.fetchImpl;
    let artifacts = 0;
    h.options.fetchImpl = async (url, options) => {
      if (url === h.pointer.currentBinding.artifactIri) {
        artifacts++;
        return h.response("unavailable", url, 503, { "retry-after": hint });
      }
      return original(url, options);
    };
    await expect(
      createOntologyMaterializationClient(h.options).lookup(source),
    ).rejects.toThrow();
    expect(artifacts).toBe(1);
  },
);

test("cancellation stops the transient artifact retry before another GET", async () => {
  const h = harness();
  const original = h.options.fetchImpl;
  const controller = new AbortController();
  const reason = new Error("cancel artifact recovery");
  let artifacts = 0;
  h.options.fetchImpl = async (url, options) => {
    if (url === h.pointer.currentBinding.artifactIri) {
      artifacts++;
      queueMicrotask(() => controller.abort(reason));
      return h.response("unavailable", url, 503);
    }
    return original(url, options);
  };
  await expect(
    createOntologyMaterializationClient(h.options).lookup(source, {
      signal: controller.signal,
    }),
  ).rejects.toBe(reason);
  expect(artifacts).toBe(1);
});

test("unsupported policy never downloads an artifact", async () => {
  const { options, fetchImpl } = harness();
  const client = createOntologyMaterializationClient({
    ...options,
    approvedPolicyFingerprints: [],
  });
  await expect(client.lookup(source)).rejects.toHaveProperty(
    "code",
    "CACHE_POLICY_UNSUPPORTED",
  );
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test("a tombstone prohibits direct acquisition and remains observed", async () => {
  const { options, fetchImpl } = harness({
    mutate(records, pointer) {
      records.set(
        `${origin}/ontology/cache/provenance/sources/${pointer.sourceKey}.json`,
        example("source-withdrawn"),
      );
    },
  });
  const resolver = {
    loadBytes: jest.fn(),
    getDocumentIRI: (iri) => ({ value: iri }),
  };
  const acquisition = createCachedOntologySourceAcquisition({
    ...options,
    resolver,
  });
  await expect(acquisition.acquire(source)).rejects.toHaveProperty(
    "code",
    "SOURCE_WITHDRAWN",
  );
  await expect(acquisition.acquire(source)).rejects.toHaveProperty(
    "code",
    "SOURCE_WITHDRAWN",
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(resolver.loadBytes).not.toHaveBeenCalled();
});

test.each(["SOURCE_WITHDRAWN", "SOURCE_QUARANTINED", "CONTENT_QUARANTINED"])(
  "materialization containment remains observed on a fresh open: %s",
  async (code) => {
    const { options, fetchImpl } = harness({
      pointerStatus: 404,
      api({ url, response }) {
        return response(
          JSON.stringify({
            schemaVersion: 1,
            kind: "error",
            requestId: "withdrawal-test",
            error: { code, message: "Source unavailable", retryable: false },
          }),
          url,
          403,
          { "content-type": "application/json" },
        );
      },
    });
    const resolver = {
      getDocumentIRI: (iri) => ({ value: iri }),
      loadBytes: jest
        .fn()
        .mockRejectedValueOnce(
          new MissingImportError("CORS", {
            cause: new TypeError("Failed to fetch"),
          }),
        )
        .mockResolvedValue({ bytes: Uint8Array.of(42), documentIri: source }),
    };
    const acquisition = createCachedOntologySourceAcquisition({
      ...options,
      resolver,
    });
    await expect(acquisition.acquire(source)).rejects.toHaveProperty(
      "code",
      code,
    );
    const requests = fetchImpl.mock.calls.length;
    await expect(acquisition.acquire(source)).rejects.toHaveProperty(
      "code",
      "SOURCE_WITHDRAWN",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(requests);
    expect(resolver.loadBytes).toHaveBeenCalledTimes(1);
  },
);

test("corrupt discovery can degrade to a direct success with a bounded diagnostic", async () => {
  const { options } = harness({
    mutate(records) {
      for (const value of records.values()) {
        value.schemaVersion = 999;
      }
    },
  });
  const onDiagnostic = jest.fn();
  const bytes = new Uint8Array([42]);
  const resolver = {
    getDocumentIRI: (iri) => ({ value: iri }),
    loadBytes: jest.fn(async () => ({ bytes, documentIri: source })),
  };
  const acquired = await createCachedOntologySourceAcquisition({
    ...options,
    resolver,
    onDiagnostic,
  }).acquire(source);
  expect(acquired.bytes).toEqual(bytes);
  expect(onDiagnostic).toHaveBeenCalledWith({ code: "CACHE_PROTOCOL_INVALID" });
});

test.each([
  new MissingImportError("readable missing", { status: 404 }),
  new UnloadableImportError("readable failure", { status: 500 }),
  new ResourceLimitError("too large", { resource: "maxRemoteDocumentBytes" }),
  Object.assign(new Error("host exhaustion"), { code: "HOST_RESOURCE_LIMIT" }),
  new DOMException("cancelled", "AbortError"),
])(
  "readable HTTP, host, size and abort failures never materialize: $name",
  async (error) => {
    const { options, fetchImpl } = harness({ pointerStatus: 404 });
    const resolver = {
      getDocumentIRI: (iri) => ({ value: iri }),
      loadBytes: async () => {
        throw error;
      },
    };
    await expect(
      createCachedOntologySourceAcquisition({ ...options, resolver }).acquire(
        source,
      ),
    ).rejects.toBe(error);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  },
);

test("one network-only fallback hashes its exact body and verifies the automatic 303 target", async () => {
  const { options, fetchImpl } = harness({
    pointerStatus: 404,
    api({ options, response, pointer }) {
      expect(options.method).toBe("POST");
      expect(options.headers["x-amz-content-sha256"]).toBe(
        createHash("sha256").update(options.body).digest("hex"),
      );
      expect(JSON.parse(new TextDecoder().decode(options.body))).toEqual({
        requestedDocumentIri: source,
      });
      return response(
        encoder.encode(fixtures.ontologySource.utf8Text),
        `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
      );
    },
  });
  const resolver = {
    getDocumentIRI: (iri) => ({ value: iri }),
    loadBytes: async () => {
      throw new MissingImportError("CORS", {
        cause: new TypeError("Failed to fetch"),
      });
    },
  };
  const acquired = await createCachedOntologySourceAcquisition({
    ...options,
    resolver,
  }).acquire(source);
  expect(acquired.documentIri).toBe(fixtures.ontologySource.parserDocumentIri);
  expect(
    fetchImpl.mock.calls.filter(([, init]) => init.method === "POST"),
  ).toHaveLength(1);
});

test("cancelled metadata reads stop before artifacts or new work", async () => {
  const abort = new AbortController();
  const { options, fetchImpl } = harness();
  const original = options.fetchImpl;
  options.fetchImpl = async (...args) => {
    const response = await original(...args);
    abort.abort();
    return response;
  };
  await expect(
    createOntologyMaterializationClient(options).lookup(source, {
      signal: abort.signal,
    }),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("generated native schemas enforce closed immutable records and major versions", () => {
  expect(() =>
    validateOntologyCacheRecord("resolution", example("A-resolution")),
  ).not.toThrow();
  expect(() =>
    validateOntologyCacheRecord("resolution", {
      ...example("A-resolution"),
      extra: true,
    }),
  ).toThrow();
  expect(() =>
    validateOntologyCacheRecord("pointer", example("reject-wire-major")),
  ).toThrow();
});

test.each(["refresh-changed", "refresh-unchanged", "refresh-failed"])(
  "bounded refresh follows its exact attempt: %s",
  async (id) => {
    const pending = example("refresh-pending");
    const { client, fetchImpl } = harness({
      api({ url, options, response }) {
        const value = options.method === "POST" ? pending : example(id);
        return response(
          JSON.stringify(value),
          url,
          options.method === "POST" ? 202 : 200,
          {
            "content-type": "application/json",
            location: pending.statusIri,
            "retry-after": "0",
          },
        );
      },
    });
    const result = await client.refresh(source);
    expect(result.state).toBe(example(id).state);
    expect(
      fetchImpl.mock.calls.filter(([, options]) => options.method === "POST"),
    ).toHaveLength(1);
    expect(
      fetchImpl.mock.calls.filter(
        ([url, options]) => url.includes("/refreshes/") && !options.method,
      ),
    ).toHaveLength(1);
    expect(
      fetchImpl.mock.calls.some(([url]) => url.includes("/artifacts/")),
    ).toBe(false);
  },
);

test.each(["reject-changed-304", "reject-time-reversal"])(
  "structurally valid semantic rejection is effective: %s",
  async (id) => {
    const pending = example("refresh-pending");
    const { client } = harness({
      api({ url, options, response }) {
        return response(
          JSON.stringify(options.method === "POST" ? pending : example(id)),
          url,
          options.method === "POST" ? 202 : 200,
          {
            "content-type": "application/json",
            location: pending.statusIri,
            "retry-after": "0",
          },
        );
      },
    });
    await expect(client.refresh(source)).rejects.toHaveProperty(
      "code",
      "CACHE_PROTOCOL_INVALID",
    );
  },
);

test("first caller polls one admitted generation and never submits it again", async () => {
  const pending = example("pending-materialization");
  const { client, fetchImpl } = harness({
    api({ url, options, response, pointer }) {
      if (options.method === "POST") {
        return response(JSON.stringify(pending), url, 202, {
          "content-type": "application/json",
          location: pending.statusIri,
          "retry-after": "0",
        });
      }
      return response(
        encoder.encode(fixtures.ontologySource.utf8Text),
        `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
      );
    },
  });
  expect((await client.materialize(source)).documentIri).toBe(
    fixtures.ontologySource.parserDocumentIri,
  );
  expect(
    fetchImpl.mock.calls.filter(([, options]) => options.method === "POST"),
  ).toHaveLength(1);
});

test.each([
  [0, 6],
  [2, 6],
  [0, 20],
])(
  "pending polling honors hint %i and accepts completion on GET %i",
  async (hint, terminalPoll) => {
    const pending = example("pending-materialization");
    const originalTimer = globalThis.setTimeout;
    const delays = [];
    const timer = jest
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((callback, milliseconds) => {
        delays.push(milliseconds);
        return originalTimer(callback, 0);
      });
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    let polls = 0;
    try {
      const { client, fetchImpl } = harness({
        api({ url, options, response, pointer }) {
          if (options.method !== "POST" && ++polls === terminalPoll) {
            return response(
              encoder.encode(fixtures.ontologySource.utf8Text),
              `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
            );
          }
          return response(JSON.stringify(pending), url, 202, {
            "content-type": "application/json",
            location: pending.statusIri,
            "retry-after": String(hint),
          });
        },
      });
      await client.materialize(source);
      expect(delays).toEqual(
        hint === 0
          ? [
              100,
              200,
              400,
              800,
              1600,
              3200,
              ...Array(terminalPoll - 6).fill(4000),
            ]
          : [2000, 2000, 2000, 2000, 2000, 3200],
      );
      expect(
        fetchImpl.mock.calls.filter(([, options]) => options.method === "POST"),
      ).toHaveLength(1);
    } finally {
      timer.mockRestore();
      random.mockRestore();
    }
  },
);

test("a pending observation never schedules a wait beyond its remaining deadline", async () => {
  const pending = example("pending-materialization");
  const { options, fetchImpl } = harness({
    api({ url, response }) {
      return response(JSON.stringify(pending), url, 202, {
        "content-type": "application/json",
        location: pending.statusIri,
        "retry-after": "0",
      });
    },
  });
  const client = createOntologyMaterializationClient({
    ...options,
    deadlineMs: 50,
  });
  await expect(client.materialize(source)).rejects.toHaveProperty(
    "code",
    "CACHE_PENDING",
  );
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test("slow work completing after thirty-six seconds remains observable within the deadline and request ceiling", async () => {
  const originalTimer = globalThis.setTimeout;
  let elapsed = 0;
  const timer = jest
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((callback, milliseconds) => {
      elapsed += milliseconds;
      return originalTimer(callback, 0);
    });
  const random = jest.spyOn(Math, "random").mockReturnValue(0);
  try {
    const pending = example("pending-materialization");
    const { options, fetchImpl } = harness({
      api({ url, response, pointer }) {
        if (elapsed >= 36000) {
          return response(
            encoder.encode(fixtures.ontologySource.utf8Text),
            `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
          );
        }
        return response(JSON.stringify(pending), url, 202, {
          "content-type": "application/json",
          location: pending.statusIri,
          "retry-after": "0",
        });
      },
    });
    const client = createOntologyMaterializationClient({
      ...options,
      now: () => elapsed,
    });
    expect((await client.materialize(source)).bytes).toEqual(
      encoder.encode(fixtures.ontologySource.utf8Text),
    );
    expect(elapsed).toBeLessThan(60000);
    expect(
      fetchImpl.mock.calls.filter(
        ([url, options]) =>
          url.includes("/materializations/") && options.method !== "POST",
      ).length,
    ).toBeLessThanOrEqual(20);
    expect(
      fetchImpl.mock.calls.filter(([, options]) => options.method === "POST"),
    ).toHaveLength(1);
  } finally {
    timer.mockRestore();
    random.mockRestore();
  }
});

test("perpetually pending work stops after twenty bounded observations", async () => {
  const originalTimer = globalThis.setTimeout;
  const timer = jest
    .spyOn(globalThis, "setTimeout")
    .mockImplementation((callback) => originalTimer(callback, 0));
  try {
    const pending = example("pending-materialization");
    const { client, fetchImpl } = harness({
      api({ url, response }) {
        return response(JSON.stringify(pending), url, 202, {
          "content-type": "application/json",
          location: pending.statusIri,
          "retry-after": "0",
        });
      },
    });
    await expect(client.materialize(source)).rejects.toHaveProperty(
      "code",
      "CACHE_PENDING",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(21);
  } finally {
    timer.mockRestore();
  }
});

test("cancellation interrupts polling before another status request", async () => {
  const abort = new AbortController();
  const pending = example("pending-materialization");
  const { client, fetchImpl } = harness({
    api({ url, response, options }) {
      if (options.method !== "POST") {
        abort.abort();
      }
      return response(JSON.stringify(pending), url, 202, {
        "content-type": "application/json",
        location: pending.statusIri,
        "retry-after": "0",
      });
    },
  });
  await expect(
    client.materialize(source, { signal: abort.signal }),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

test.each(["valid", "count", "mode", "bytes", "invalid-iri", "throwing-iri"])(
  "direct-import hints %s are checked before artifact acquisition",
  async (variant) => {
    const { client, fetchImpl } = harness({
      mutate(records, pointer) {
        const oldIri = pointer.currentBinding.resolutionIri;
        const resolution = records.get(oldIri);
        const iri =
          variant === "invalid-iri"
            ? "https://example.test/space here"
            : variant === "throwing-iri"
              ? "https://[v1.a]/child"
              : fixtures.ontologySource.expectedResolvedImportIri;
        resolution.declaredImports = {
          owlMappingStrategy: variant === "mode" ? "heuristic" : "unambiguous",
          iris: variant === "count" ? [] : [iri],
          iriByteLength:
            variant === "bytes" ? 0 : encoder.encode(iri).byteLength,
        };
        const { resolutionIdentity: ignored, ...input } = resolution;
        expect(ignored).toBeDefined();
        resolution.resolutionIdentity = createHash("sha256")
          .update("hadden-ontology-cache/resolution/v1\n" + canonicalize(input))
          .digest("hex");
        pointer.currentBinding.resolutionIdentity =
          resolution.resolutionIdentity;
        pointer.currentBinding.resolutionIri = `${origin}/ontology/cache/resolutions/sha256/${resolution.resolutionIdentity}.json`;
        records.delete(oldIri);
        records.set(pointer.currentBinding.resolutionIri, resolution);
      },
    });
    if (variant === "valid") {
      expect(
        (await client.lookup(source)).resolution.declaredImports.iris,
      ).toEqual([fixtures.ontologySource.expectedResolvedImportIri]);
    } else {
      await expect(client.lookup(source)).rejects.toHaveProperty(
        "code",
        "CACHE_PROTOCOL_INVALID",
      );
      expect(
        fetchImpl.mock.calls.some(([url]) => url.includes("/artifacts/")),
      ).toBe(false);
    }
  },
);

test("uncached apply confirmation rejects a superseded candidate and preserves the offered identity", async () => {
  const { client, fetchImpl } = harness({
    api({ response, pointer }) {
      return response(
        encoder.encode(fixtures.ontologySource.utf8Text),
        `${pointer.currentBinding.artifactIri}?source=${pointer.sourceKey}&binding=${pointer.currentBinding.resolutionIdentity}`,
      );
    },
  });
  await expect(
    client.confirm(source, example("B-resolution").resolutionIdentity),
  ).rejects.toHaveProperty("code", "CACHE_OFFER_SUPERSEDED");
  expect(fetchImpl.mock.calls[0][1].cache).toBe("no-store");
});

test("per-load acquisition coalesces exact sources while a fresh open consults discovery again", async () => {
  const { options, fetchImpl } = harness();
  const resolver = {
    getDocumentIRI: (iri) => ({ value: iri }),
    loadBytes: jest.fn(),
  };
  const acquisition = createCachedOntologySourceAcquisition({
    ...options,
    resolver,
  });
  const context = {};
  const first = await acquisition.acquire(source, { context });
  const second = await acquisition.acquire(source, { context });
  expect(second.bytes).toEqual(first.bytes);
  expect(second.bytes).not.toBe(first.bytes);
  expect(fetchImpl).toHaveBeenCalledTimes(6);
  await acquisition.acquire(source, { context: {} });
  expect(fetchImpl).toHaveBeenCalledTimes(12);
});
