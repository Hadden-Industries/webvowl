import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  MissingImportError,
  ResourceLimitError,
  UnloadableImportError,
} from "owlapi/io";
import { createOntologyMaterializationClient } from "./ontologyMaterializationClient.js";
import { createCachedOntologySourceAcquisition } from "./cachedOntologySourceAcquisition.js";
import { validateOntologyCacheRecord } from "./ontologyResolutionEvidence.js";

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
