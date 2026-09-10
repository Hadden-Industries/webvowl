import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";

let createVisualizationArtifactService;

const ARTIFACT_SERVICE_MODULE_URL = new URL(
  "./visualizationArtifactService.js",
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

  const drawingModule = await createDependencyFreeModule(
    new URL("./renderedDrawingSnapshot.js", import.meta.url),
  );
  const tikzUrl = new URL("./tikzSerializer.js", import.meta.url);
  const tikzModule = new SourceTextModule(
    readFileSync(fileURLToPath(tikzUrl), "utf8"),
    { identifier: tikzUrl.href },
  );
  await tikzModule.link((specifier) => {
    if (specifier === "./renderedDrawingSnapshot.js") {
      return drawingModule;
    }
    throw new Error(`Unexpected TikZ serializer dependency: ${specifier}`);
  });
  await tikzModule.evaluate();

  const artifactServiceModule = new SourceTextModule(
    readFileSync(fileURLToPath(ARTIFACT_SERVICE_MODULE_URL), "utf8"),
    { identifier: ARTIFACT_SERVICE_MODULE_URL.href },
  );
  await artifactServiceModule.link((specifier) => {
    if (specifier === "./tikzSerializer.js") {
      return tikzModule;
    }
    if (specifier === "./svgSerializer.js") {
      return serializerModule;
    }
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected SVG artifact service dependency: ${specifier}`);
  });
  await artifactServiceModule.evaluate();
  ({ createVisualizationArtifactService } = artifactServiceModule.namespace);
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
      modes: {
        colorExternals: true,
        compactNotation: false,
        nodeScaling: true,
        dynamicLabelWidth: true,
        pickAndPin: false,
        maxLabelWidthPx: 120,
        colorExternalsMode: "same",
      },
      forceDistances: { classDistancePx: 200, datatypeDistancePx: 120 },
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

describe("page-local visualization artifact ownership", () => {
  let objectUrlApi;
  let publicationOrder;
  let serializedSvgText;
  let visualizationArtifactPublicationPort;
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
    visualizationArtifactPublicationPort = {
      publishPageLocalArtifact: jest.fn(({ metadata, objectUrl }) => {
        publicationOrder.push(`publish:${objectUrl}`);
        expect(metadata).not.toHaveProperty("objectUrl");
      }),
    };
    svgSerializer = {
      serializeRenderedSvgSnapshot: jest.fn(() => serializedSvgText),
    };
  });

  function createArtifactService(dependencyOverrides = {}) {
    return createVisualizationArtifactService({
      svgSerializer,
      webCrypto: webcrypto,
      BlobConstructor: Blob,
      objectUrlApi,
      visualizationArtifactPublicationPort,
      ...dependencyOverrides,
    });
  }

  test("publishes actual TikZ bytes through the shared hash and URL owner", async () => {
    const service = createArtifactService();
    const source = { kind: "vowl-json-text", displayName: "people.json" };
    const renderedDrawingSnapshot = {
      loadGeneration: 7,
      bounds: { leftPx: 0, topPx: 0, rightPx: 300, bottomPx: 200 },
      compactNotation: false,
      nodes: [],
      propertyLabels: [],
      links: [],
    };
    const metadata = await service.createVisualizationArtifact({
      format: "latex",
      filename: "People",
      source,
      renderedDrawingSnapshot,
    });
    const blob = objectUrlApi.createObjectURL.mock.calls.at(-1)[0];
    const text = await blob.text();
    expect(text).toContain("\\begin{tikzpicture}");
    expect(text).toContain("\\clip (0pt , -200pt ) rectangle (300pt , 0pt);");
    expect(text).toContain("people.json");
    expect(metadata).toMatchObject({
      format: "latex",
      filename: "People.tex",
      mediaType: "application/x-tex",
      loadGeneration: 7,
      source,
      byteLength: Buffer.byteLength(text),
      sha256Hex: expectedSha256Hex(text),
    });
    expect(svgSerializer.serializeRenderedSvgSnapshot).not.toHaveBeenCalled();
  });

  test("publishes Turtle bytes verbatim without regenerating ontology content", async () => {
    const turtleText =
      "# Existing exporter output\r\n<urn:test:Person> a <http://www.w3.org/2002/07/owl#Class> .\r\n";
    const service = createArtifactService();
    const metadata = await service.createVisualizationArtifact({
      format: "turtle",
      filename: "People",
      source: { kind: "ontology-text", displayName: "people.owl" },
      turtleDocumentSnapshot: { loadGeneration: 3, turtleText },
    });
    const blob = objectUrlApi.createObjectURL.mock.calls.at(-1)[0];
    await expect(blob.text()).resolves.toBe(turtleText);
    expect(metadata).toMatchObject({
      format: "turtle",
      filename: "People.ttl",
      mediaType: "text/turtle",
      loadGeneration: 3,
      byteLength: Buffer.byteLength(turtleText),
      sha256Hex: expectedSha256Hex(turtleText),
    });
    expect(svgSerializer.serializeRenderedSvgSnapshot).not.toHaveBeenCalled();
  });

  test("publishes a VOWL JSON artifact through the same hash and URL owner", async () => {
    const service = createArtifactService();
    const first = await createArtifact(service);
    const firstUrl =
      visualizationArtifactPublicationPort.publishPageLocalArtifact.mock
        .calls[0][0].objectUrl;
    const vowlDocument = {
      loadGeneration: 7,
      source: { kind: "vowl-json-text", displayName: "people.json" },
      vowlModel: {
        header: { title: { en: "People Ω" } },
        class: [],
        settings: { global: { paused: true } },
      },
    };
    const metadata = await service.createVisualizationArtifact({
      format: "vowl-json",
      filename: "../People",
      vowlDocument,
    });
    const blob = objectUrlApi.createObjectURL.mock.calls.at(-1)[0];
    const text = await blob.text();
    expect(JSON.parse(text)).toEqual(vowlDocument.vowlModel);
    expect(metadata).toMatchObject({
      filename: "People.json",
      mediaType: "application/json",
      byteLength: Buffer.byteLength(text),
      sha256Hex: expectedSha256Hex(text),
      loadGeneration: 7,
      source: vowlDocument.source,
    });
    expect(metadata.pageLocalArtifactId).not.toBe(first.pageLocalArtifactId);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(svgSerializer.serializeRenderedSvgSnapshot).toHaveBeenCalledTimes(1);
  });

  test("retains deterministic JSON record and set ordering without mutating source metadata", async () => {
    const model = {
      header: {
        title: { en: "People" },
        description: { en: "Original source" },
      },
      namespace: [
        { prefix: "z", iri: "https://z.test/" },
        { prefix: "a", iri: "https://a.test/" },
      ],
      class: [
        { id: "id1", type: "owl:Class" },
        { id: "id3", type: "owl:Class" },
        { id: "id4", type: "owl:Class" },
        { id: "id2", type: "owl:Class" },
      ],
      classAttribute: [
        { id: "id1", iri: "https://B", attributes: ["deprecated", "abstract"] },
        { id: "id3", iri: "https://A" },
        { id: "id4" },
        { id: "id2" },
      ],
      property: [{ id: "p1", type: "owl:ObjectProperty" }],
      propertyAttribute: [
        {
          id: "p1",
          iri: "https://property",
          domain: "id1",
          range: "id3",
          subproperty: ["sub2", "sub1"],
        },
      ],
      customAnnotation: { retained: true },
    };
    const before = structuredClone(model);
    const service = createArtifactService();
    const exported = [];
    for (const inputModel of [
      model,
      {
        ...model,
        class: [...model.class].reverse(),
        classAttribute: [...model.classAttribute].reverse(),
        namespace: [...model.namespace].reverse(),
      },
    ]) {
      await service.createVisualizationArtifact({
        format: "vowl-json",
        filename: undefined,
        vowlDocument: {
          loadGeneration: 7,
          source: { kind: "vowl-json-text" },
          vowlModel: inputModel,
        },
      });
      exported.push(
        await objectUrlApi.createObjectURL.mock.calls.at(-1)[0].text(),
      );
    }
    expect(exported[1]).toBe(exported[0]);
    const document = JSON.parse(exported[0]);
    expect(document.class.map((record) => record.id)).toEqual([
      "id2",
      "id4",
      "id3",
      "id1",
    ]);
    expect(
      document.classAttribute.find((record) => record.id === "id1").attributes,
    ).toEqual(["abstract", "deprecated"]);
    expect(document.propertyAttribute[0].subproperty).toEqual(["sub1", "sub2"]);
    expect(document.namespace[0].prefix).toBe("a");
    expect(document.customAnnotation).toEqual({ retained: true });
    expect(document.header).toEqual(before.header);
    expect(document).not.toHaveProperty("_comment");
    expect(model).toEqual(before);
  });

  test("exports a local ontology to SVG without inventing a remote identity", async () => {
    const recipe = createViewRecipe();
    recipe.source = {
      kind: "ontology-text",
      displayName: "local.rdf",
      sha256Hex: "b".repeat(64),
    };
    const metadata = await createArtifactService().createVisualizationArtifact({
      filename: "local",
      renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
      viewRecipe: recipe,
    });
    expect(metadata.viewRecipe.source).toEqual(recipe.source);
    expect(metadata.viewRecipe.source).not.toHaveProperty("identity");
  });

  async function createArtifact(
    visualizationArtifactService,
    filename = "report",
  ) {
    return visualizationArtifactService.createVisualizationArtifact({
      renderedSvgSnapshot: createRenderedSvgSnapshotStub(),
      filename,
      viewRecipe: createViewRecipe(),
    });
  }

  test("publishes a UTF-8 SVG Blob with matching immutable metadata", async () => {
    const visualizationArtifactService = createArtifactService();

    const metadata = await createArtifact(
      visualizationArtifactService,
      "../exports/person-organization.SVG.svg",
    );

    expect(metadata).toEqual({
      format: "svg",
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
      visualizationArtifactPublicationPort.publishPageLocalArtifact,
    ).toHaveBeenCalledWith({
      metadata,
      objectUrl: `blob:webvowl-svg-1-${metadata.byteLength}`,
    });
    expect(JSON.stringify(metadata)).not.toContain("blob:");
  });

  test("assigns monotonic page-local artifact and view-recipe identifiers", async () => {
    const visualizationArtifactService = createArtifactService();

    const firstMetadata = await createArtifact(
      visualizationArtifactService,
      "first",
    );
    const secondMetadata = await createArtifact(
      visualizationArtifactService,
      "second",
    );

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
    const visualizationArtifactService = createArtifactService();

    await expect(
      visualizationArtifactService.createVisualizationArtifact({
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
    const visualizationArtifactService = createArtifactService();
    const firstMetadata = await createArtifact(
      visualizationArtifactService,
      "first",
    );
    const firstObjectUrl =
      visualizationArtifactPublicationPort.publishPageLocalArtifact.mock
        .calls[0][0].objectUrl;
    publicationOrder = [];

    const secondMetadata = await createArtifact(
      visualizationArtifactService,
      "second",
    );
    const secondObjectUrl =
      visualizationArtifactPublicationPort.publishPageLocalArtifact.mock
        .calls[1][0].objectUrl;

    expect(firstMetadata.pageLocalArtifactId).not.toBe(
      secondMetadata.pageLocalArtifactId,
    );
    expect(publicationOrder).toEqual([
      `publish:${secondObjectUrl}`,
      `revoke:${firstObjectUrl}`,
    ]);
  });

  test("disposes the current object URL exactly once", async () => {
    const visualizationArtifactService = createArtifactService();
    await createArtifact(visualizationArtifactService);
    const currentObjectUrl =
      visualizationArtifactPublicationPort.publishPageLocalArtifact.mock
        .calls[0][0].objectUrl;
    objectUrlApi.revokeObjectURL.mockClear();

    visualizationArtifactService.dispose();
    visualizationArtifactService.dispose();

    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(currentObjectUrl);
  });

  test("revokes an unpublished replacement when publication fails and retains the prior artifact", async () => {
    const visualizationArtifactService = createArtifactService();
    await createArtifact(visualizationArtifactService, "first");
    const firstObjectUrl =
      visualizationArtifactPublicationPort.publishPageLocalArtifact.mock
        .calls[0][0].objectUrl;
    const publicationFailure = new Error("injected publication failure");
    visualizationArtifactPublicationPort.publishPageLocalArtifact.mockImplementationOnce(
      () => {
        throw publicationFailure;
      },
    );
    objectUrlApi.revokeObjectURL.mockClear();

    await expect(
      createArtifact(visualizationArtifactService, "second"),
    ).rejects.toBe(publicationFailure);

    const unpublishedObjectUrl =
      objectUrlApi.createObjectURL.mock.results[1].value;
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith(
      unpublishedObjectUrl,
    );
    visualizationArtifactService.dispose();
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
    const visualizationArtifactService = createArtifactService();

    await expect(
      visualizationArtifactService.createVisualizationArtifact(
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
      visualizationArtifactPublicationPort.publishPageLocalArtifact,
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
      const visualizationArtifactService =
        createArtifactService(dependencyOverrides);

      await expect(
        createArtifact(visualizationArtifactService),
      ).rejects.toEqual(
        expect.objectContaining({
          code: "EXPORT_FAILED",
          details: { exportStage: expectedExportStage },
          isRetryable: false,
          name: "WebVowlOperationError",
        }),
      );
      expect(
        visualizationArtifactPublicationPort.publishPageLocalArtifact,
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
    const visualizationArtifactService = createArtifactService({
      webCrypto: controlledWebCrypto,
    });
    const cancellationController = new AbortController();
    const cancellationReason = new Error("cancelled SVG artifact creation");

    const artifactPromise =
      visualizationArtifactService.createVisualizationArtifact(
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
      visualizationArtifactPublicationPort.publishPageLocalArtifact,
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
    const visualizationArtifactService = createArtifactService({
      webCrypto: controlledWebCrypto,
    });

    const artifactPromise = createArtifact(
      visualizationArtifactService,
      "disposed",
    );
    await Promise.resolve();
    visualizationArtifactService.dispose();
    resolveDigest(new Uint8Array(32).buffer);

    await expect(artifactPromise).rejects.toEqual(
      expect.objectContaining({
        code: "EXPORT_FAILED",
        details: { exportStage: "artifact-lifecycle" },
      }),
    );
    expect(objectUrlApi.createObjectURL).not.toHaveBeenCalled();
    expect(
      visualizationArtifactPublicationPort.publishPageLocalArtifact,
    ).not.toHaveBeenCalled();
  });

  test("rejects dependencies outside the artifact-service interface", () => {
    expect(() =>
      createVisualizationArtifactService({
        svgSerializer,
        webCrypto: webcrypto,
        BlobConstructor: Blob,
        objectUrlApi,
        visualizationArtifactPublicationPort,
        exportMenu: { publish: jest.fn() },
      }),
    ).toThrow("invalid dependency field set");
  });
});
