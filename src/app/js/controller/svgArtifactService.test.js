import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let createSvgArtifactService;

const ARTIFACT_SERVICE_MODULE_URL = new URL(
  "./svgArtifactService.js",
  import.meta.url,
);
const SERIALIZER_MODULE_URL = new URL("./svgSerializer.js", import.meta.url);
const RENDERED_GRAPH_CONTRACTS_MODULE_URL = new URL(
  "./renderedGraphRuntimeContracts.js",
  import.meta.url,
);
const WEB_VOWL_CONTRACTS_MODULE_URL = new URL(
  "./webVowlControllerContracts.js",
  import.meta.url,
);

async function createDependencyFreeModule(moduleUrl) {
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(
      `Unexpected SVG artifact contract dependency: ${specifier}`,
    );
  });
  await sourceModule.evaluate();
  return sourceModule;
}

beforeAll(async () => {
  const webVowlContractsModule = await createDependencyFreeModule(
    WEB_VOWL_CONTRACTS_MODULE_URL,
  );
  const renderedGraphContractsModule = new SourceTextModule(
    readFileSync(fileURLToPath(RENDERED_GRAPH_CONTRACTS_MODULE_URL), "utf8"),
    { identifier: RENDERED_GRAPH_CONTRACTS_MODULE_URL.href },
  );
  await renderedGraphContractsModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected rendered-SVG dependency: ${specifier}`);
  });
  await renderedGraphContractsModule.evaluate();

  const serializerModule = new SourceTextModule(
    readFileSync(fileURLToPath(SERIALIZER_MODULE_URL), "utf8"),
    { identifier: SERIALIZER_MODULE_URL.href },
  );
  await serializerModule.link((specifier) => {
    if (specifier === "./renderedGraphRuntimeContracts.js") {
      return renderedGraphContractsModule;
    }
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected SVG serializer dependency: ${specifier}`);
  });
  await serializerModule.evaluate();

  const artifactServiceModule = new SourceTextModule(
    readFileSync(fileURLToPath(ARTIFACT_SERVICE_MODULE_URL), "utf8"),
    { identifier: ARTIFACT_SERVICE_MODULE_URL.href },
  );
  await artifactServiceModule.link((specifier) => {
    if (specifier === "./svgSerializer.js") {
      return serializerModule;
    }
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected SVG artifact service dependency: ${specifier}`);
  });
  await artifactServiceModule.evaluate();
  ({ createSvgArtifactService } = artifactServiceModule.namespace);
});

function createViewRecipe() {
  return {
    source: {
      kind: "ontology-document-iri",
      identity: "https://example.test/ontology.owl",
      sha256Hex: "c".repeat(64),
    },
    loadGeneration: 7,
    appliedVisualizationView: {
      language: "en",
      filters: {
        datatypes: "hide",
        objectProperties: "show",
        subclasses: "show",
        disjointness: "hide",
        setOperators: "show",
        minDegree: 2,
      },
      focus: [{ kind: "class", iri: "https://example.test/ontology#Person" }],
      layout: "preserve",
      viewport: "fit",
    },
    viewportDimensions: { widthPx: 960, heightPx: 640 },
    layoutOutcome: { status: "settled", reason: "stable-frames" },
  };
}

function createRenderedSvgSnapshotStub() {
  return Object.freeze({
    loadGeneration: 7,
    detachedSvgRoot: Object.freeze({ semanticRole: "detached-svg-root" }),
    widthPx: 960,
    heightPx: 640,
  });
}

function expectedSha256Hex(serializedSvgText) {
  return createHash("sha256").update(serializedSvgText, "utf8").digest("hex");
}

describe("page-local SVG artifact ownership", () => {
  let objectUrlApi;
  let publicationOrder;
  let serializedSvgText;
  let svgArtifactPublicationPort;
  let svgSerializer;

  beforeEach(() => {
    serializedSvgText =
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Žluťoučký</text></svg>';
    publicationOrder = [];
    let objectUrlSequence = 0;
    objectUrlApi = {
      createObjectURL: jest.fn((svgBlob) => {
        objectUrlSequence += 1;
        return `blob:webvowl-svg-${objectUrlSequence}-${svgBlob.size}`;
      }),
      revokeObjectURL: jest.fn((objectUrl) => {
        publicationOrder.push(`revoke:${objectUrl}`);
      }),
    };
    svgArtifactPublicationPort = {
      publishPageLocalSvgArtifact: jest.fn(({ metadata, objectUrl }) => {
        publicationOrder.push(`publish:${objectUrl}`);
        expect(metadata).not.toHaveProperty("objectUrl");
      }),
    };
    svgSerializer = {
      serializeRenderedSvgSnapshot: jest.fn(() => serializedSvgText),
    };
  });

  function createArtifactService(dependencyOverrides = {}) {
    return createSvgArtifactService({
      svgSerializer,
      webCrypto: webcrypto,
      BlobConstructor: Blob,
      objectUrlApi,
      svgArtifactPublicationPort,
      ...dependencyOverrides,
    });
  }

  async function createArtifact(svgArtifactService, filename = "report") {
    return svgArtifactService.createSvgArtifact({
      renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
      filename,
      viewRecipe: createViewRecipe(),
    });
  }

  test("publishes a UTF-8 SVG Blob with matching immutable metadata", async () => {
    const svgArtifactService = createArtifactService();

    const metadata = await createArtifact(
      svgArtifactService,
      "../exports/person-organization.SVG.svg",
    );

    expect(metadata).toEqual({
      pageLocalArtifactId: "svg-artifact-7-1",
      filename: "person-organization.svg",
      mediaType: "image/svg+xml",
      byteLength: Buffer.byteLength(serializedSvgText, "utf8"),
      sha256Hex: expectedSha256Hex(serializedSvgText),
      pageLocalViewRecipeId: "svg-view-recipe-7-1",
      viewRecipe: {
        pageLocalViewRecipeId: "svg-view-recipe-7-1",
        ...createViewRecipe(),
      },
    });
    expect(Object.isFrozen(metadata)).toBe(true);
    expect(Object.isFrozen(metadata.viewRecipe)).toBe(true);
    expect(Object.isFrozen(metadata.viewRecipe.source)).toBe(true);
    expect(Object.isFrozen(metadata.viewRecipe.appliedVisualizationView)).toBe(
      true,
    );
    expect(svgSerializer.serializeRenderedSvgSnapshot).toHaveBeenCalledWith(
      {
        renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
        viewRecipe: metadata.viewRecipe,
      },
      { signal: undefined },
    );
    const publishedBlob = objectUrlApi.createObjectURL.mock.calls[0][0];
    expect(publishedBlob.type).toBe("image/svg+xml");
    expect(publishedBlob.size).toBe(metadata.byteLength);
    await expect(publishedBlob.text()).resolves.toBe(serializedSvgText);
    expect(
      svgArtifactPublicationPort.publishPageLocalSvgArtifact,
    ).toHaveBeenCalledWith({
      metadata,
      objectUrl: `blob:webvowl-svg-1-${metadata.byteLength}`,
    });
    expect(JSON.stringify(metadata)).not.toContain("blob:");
  });

  test("assigns monotonic page-local artifact and view-recipe identifiers", async () => {
    const svgArtifactService = createArtifactService();

    const firstMetadata = await createArtifact(svgArtifactService, "first");
    const secondMetadata = await createArtifact(svgArtifactService, "second");

    expect(
      [firstMetadata, secondMetadata].map(
        ({ pageLocalArtifactId }) => pageLocalArtifactId,
      ),
    ).toEqual(["svg-artifact-7-1", "svg-artifact-7-2"]);
    expect(
      [firstMetadata, secondMetadata].map(
        ({ pageLocalViewRecipeId }) => pageLocalViewRecipeId,
      ),
    ).toEqual(["svg-view-recipe-7-1", "svg-view-recipe-7-2"]);
  });

  test("rejects a caller-supplied page-local view-recipe identifier", async () => {
    const svgArtifactService = createArtifactService();

    await expect(
      svgArtifactService.createSvgArtifact({
        renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
        filename: "caller-identified",
        viewRecipe: {
          ...createViewRecipe(),
          pageLocalViewRecipeId: "caller-owned-identifier",
        },
      }),
    ).rejects.toThrow("invalid field set");
    expect(svgSerializer.serializeRenderedSvgSnapshot).not.toHaveBeenCalled();
  });

  test("revokes the replaced object URL only after publishing its replacement", async () => {
    const svgArtifactService = createArtifactService();
    const firstMetadata = await createArtifact(svgArtifactService, "first");
    const firstObjectUrl =
      svgArtifactPublicationPort.publishPageLocalSvgArtifact.mock.calls[0][0]
        .objectUrl;
    publicationOrder = [];

    const secondMetadata = await createArtifact(svgArtifactService, "second");
    const secondObjectUrl =
      svgArtifactPublicationPort.publishPageLocalSvgArtifact.mock.calls[1][0]
        .objectUrl;

    expect(firstMetadata.pageLocalArtifactId).not.toBe(
      secondMetadata.pageLocalArtifactId,
    );
    expect(publicationOrder).toEqual([
      `publish:${secondObjectUrl}`,
      `revoke:${firstObjectUrl}`,
    ]);
  });

  test("disposes the current object URL exactly once", async () => {
    const svgArtifactService = createArtifactService();
    await createArtifact(svgArtifactService);
    const currentObjectUrl =
      svgArtifactPublicationPort.publishPageLocalSvgArtifact.mock.calls[0][0]
        .objectUrl;
    objectUrlApi.revokeObjectURL.mockClear();

    svgArtifactService.dispose();
    svgArtifactService.dispose();

    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(currentObjectUrl);
  });

  test("revokes an unpublished replacement when publication fails and retains the prior artifact", async () => {
    const svgArtifactService = createArtifactService();
    await createArtifact(svgArtifactService, "first");
    const firstObjectUrl =
      svgArtifactPublicationPort.publishPageLocalSvgArtifact.mock.calls[0][0]
        .objectUrl;
    const publicationFailure = new Error("injected publication failure");
    svgArtifactPublicationPort.publishPageLocalSvgArtifact.mockImplementationOnce(
      () => {
        throw publicationFailure;
      },
    );
    objectUrlApi.revokeObjectURL.mockClear();

    await expect(createArtifact(svgArtifactService, "second")).rejects.toBe(
      publicationFailure,
    );

    const unpublishedObjectUrl =
      objectUrlApi.createObjectURL.mock.results[1].value;
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(
      unpublishedObjectUrl,
    );
    svgArtifactService.dispose();
    expect(objectUrlApi.revokeObjectURL).toHaveBeenLastCalledWith(
      firstObjectUrl,
    );
  });

  test("revokes an unpublished object URL when cancellation wins after its creation", async () => {
    const cancellationController = new AbortController();
    const cancellationReason = new Error("cancelled SVG artifact publication");
    objectUrlApi.createObjectURL.mockImplementation((svgBlob) => {
      cancellationController.abort(cancellationReason);
      return `blob:webvowl-svg-cancelled-${svgBlob.size}`;
    });
    const svgArtifactService = createArtifactService();

    await expect(
      svgArtifactService.createSvgArtifact(
        {
          renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
          filename: "cancelled-after-url-creation",
          viewRecipe: createViewRecipe(),
        },
        { signal: cancellationController.signal },
      ),
    ).rejects.toBe(cancellationReason);

    const unpublishedObjectUrl =
      objectUrlApi.createObjectURL.mock.results[0].value;
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(
      unpublishedObjectUrl,
    );
    expect(
      svgArtifactPublicationPort.publishPageLocalSvgArtifact,
    ).not.toHaveBeenCalled();
  });

  test.each([
    ["Blob construction", { BlobConstructor: undefined }, "blob-creation"],
    [
      "page-local object URL creation",
      {
        objectUrlApi: { revokeObjectURL: jest.fn() },
      },
      "object-url-creation",
    ],
    ["Web Crypto SHA-256", { webCrypto: undefined }, "sha256"],
  ])(
    "reports unavailable %s as a bounded EXPORT_FAILED operation error",
    async (_capability, dependencyOverrides, expectedExportStage) => {
      const svgArtifactService = createArtifactService(dependencyOverrides);

      await expect(createArtifact(svgArtifactService)).rejects.toEqual(
        expect.objectContaining({
          code: "EXPORT_FAILED",
          details: { exportStage: expectedExportStage },
          isRetryable: false,
          name: "WebVowlOperationError",
        }),
      );
      expect(
        svgArtifactPublicationPort.publishPageLocalSvgArtifact,
      ).not.toHaveBeenCalled();
    },
  );

  test("does not publish or create an object URL when cancellation wins during hashing", async () => {
    let resolveDigest;
    const digestPromise = new Promise((resolve) => {
      resolveDigest = resolve;
    });
    const controlledWebCrypto = {
      subtle: { digest: jest.fn(() => digestPromise) },
    };
    const svgArtifactService = createArtifactService({
      webCrypto: controlledWebCrypto,
    });
    const cancellationController = new AbortController();
    const cancellationReason = new Error("cancelled SVG artifact creation");

    const artifactPromise = svgArtifactService.createSvgArtifact(
      {
        renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
        filename: "cancelled",
        viewRecipe: createViewRecipe(),
      },
      { signal: cancellationController.signal },
    );
    await Promise.resolve();
    cancellationController.abort(cancellationReason);
    resolveDigest(new Uint8Array(32).buffer);

    await expect(artifactPromise).rejects.toBe(cancellationReason);
    expect(objectUrlApi.createObjectURL).not.toHaveBeenCalled();
    expect(
      svgArtifactPublicationPort.publishPageLocalSvgArtifact,
    ).not.toHaveBeenCalled();
  });

  test("does not publish after disposal wins during hashing", async () => {
    let resolveDigest;
    const digestPromise = new Promise((resolve) => {
      resolveDigest = resolve;
    });
    const controlledWebCrypto = {
      subtle: { digest: jest.fn(() => digestPromise) },
    };
    const svgArtifactService = createArtifactService({
      webCrypto: controlledWebCrypto,
    });

    const artifactPromise = createArtifact(svgArtifactService, "disposed");
    await Promise.resolve();
    svgArtifactService.dispose();
    resolveDigest(new Uint8Array(32).buffer);

    await expect(artifactPromise).rejects.toEqual(
      expect.objectContaining({
        code: "EXPORT_FAILED",
        details: { exportStage: "artifact-lifecycle" },
      }),
    );
    expect(objectUrlApi.createObjectURL).not.toHaveBeenCalled();
    expect(
      svgArtifactPublicationPort.publishPageLocalSvgArtifact,
    ).not.toHaveBeenCalled();
  });

  test("rejects dependencies outside the artifact-service interface", () => {
    expect(() =>
      createSvgArtifactService({
        svgSerializer,
        webCrypto: webcrypto,
        BlobConstructor: Blob,
        objectUrlApi,
        svgArtifactPublicationPort,
        exportMenu: { publish: jest.fn() },
      }),
    ).toThrow("invalid dependency field set");
  });
});
