import { OWLOntologyLoaderConfiguration } from "owlapi/model";
import { loadWithImports as productionLoadWithImports } from "../../../owl2vowl/js/index.js";
import { WebVowlImportResolver } from "../../../owl2vowl/js/importResolver.js";
import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule, SyntheticModule } from "node:vm";

import { OWLDocumentFormats } from "owlapi/formats";
import {
  DocumentLoadError,
  OWLOntologyCreationError,
  OWLParserError,
  ResourceLimitError,
  SecurityPolicyError,
  UnloadableImportError,
  UnparsableOntologyException,
} from "owlapi/io";

let createOntologySourceLoader;

const CONTROLLER_MODULE_URL = new URL(
  "./ontologySourceLoader.js",
  import.meta.url,
);
const CONTROLLER_CONTRACTS_MODULE_URL = new URL(
  "./webVowlControllerContracts.js",
  import.meta.url,
);

const EXPECTED_ONTOLOGY_TEXT_FORMAT_KEYS = Object.freeze([
  "dl",
  "functional",
  "jsonld",
  "krss1",
  "krss2",
  "manchester",
  "nquads",
  "ntriples",
  "owlxml",
  "rdfxml",
  "trig",
  "turtle",
]);

const ONTOLOGY_TEXT_FORMAT_CASES = Object.freeze(
  Object.values(OWLDocumentFormats)
    .map((documentFormat) => [documentFormat.key, documentFormat.mediaTypes[0]])
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
);

const VOWL_COLLECTION_FIELD_NAMES = Object.freeze([
  "namespace",
  "class",
  "classAttribute",
  "datatype",
  "datatypeAttribute",
  "property",
  "propertyAttribute",
]);

const SHA256_HEX_FIXTURE = "a".repeat(64);
const CANONICAL_REMOTE_DOCUMENT_BYTE_LIMIT = 32 * 1024 * 1024;
const CANONICAL_REMOTE_TIMEOUT_MS = 30_000;

function createSyntheticModule(identifier, exportedValues) {
  return new SyntheticModule(
    Object.keys(exportedValues),
    function initializeSyntheticModule() {
      for (const [exportName, exportValue] of Object.entries(exportedValues)) {
        this.setExport(exportName, exportValue);
      }
    },
    { identifier },
  );
}

async function createEvaluatedDependencyFreeModule(moduleUrl) {
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected controller dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule;
}

beforeAll(async () => {
  const controllerContractsModule = await createEvaluatedDependencyFreeModule(
    CONTROLLER_CONTRACTS_MODULE_URL,
  );
  const dependencyModules = new Map([
    [
      "owlapi/formats",
      createSyntheticModule("test:owlapi-formats", { OWLDocumentFormats }),
    ],
    [
      "owlapi/io",
      createSyntheticModule("test:owlapi-io", {
        DocumentLoadError,
        OWLOntologyCreationError,
        OWLParserError,
        ResourceLimitError,
        SecurityPolicyError,
        UnparsableOntologyException,
      }),
    ],
    [
      "owlapi/model",
      createSyntheticModule("test:owlapi-model", {
        OWLOntologyLoaderConfiguration,
      }),
    ],
    [
      "../../../owl2vowl/js/index.js",
      createSyntheticModule("test:owl2vowl-index", {
        loadWithImports: productionLoadWithImports,
      }),
    ],
    [
      "../../../owl2vowl/js/importResolver.js",
      createSyntheticModule("test:webvowl-import-resolver", {
        WebVowlImportResolver,
      }),
    ],
    ["./webVowlControllerContracts.js", controllerContractsModule],
  ]);
  const ontologySourceLoaderModule = new SourceTextModule(
    readFileSync(fileURLToPath(CONTROLLER_MODULE_URL), "utf8"),
    { identifier: CONTROLLER_MODULE_URL.href },
  );
  await ontologySourceLoaderModule.link((specifier) => {
    const dependencyModule = dependencyModules.get(specifier);
    if (dependencyModule === undefined) {
      throw new Error(
        `Unexpected ontology-source-loader dependency: ${specifier}`,
      );
    }
    return dependencyModule;
  });
  await ontologySourceLoaderModule.evaluate();
  ({ createOntologySourceLoader } = ontologySourceLoaderModule.namespace);
});

function createVowlModel({ diagnostics = [], ...overrides } = {}) {
  return {
    header: {
      iri: "https://example.com/ontology",
      imports: [],
      languages: ["en"],
    },
    metrics: {
      classCount: 3,
      datatypeCount: 1,
      individualCount: 2,
      propertyCount: 4,
    },
    class: [],
    classAttribute: [],
    property: [],
    propertyAttribute: [],
    diagnostics,
    ...overrides,
  };
}

function createFetchResponse(
  responseText,
  {
    contentType = "application/octet-stream",
    declaredLength,
    status = 200,
    statusText = "OK",
  } = {},
) {
  return {
    headers: {
      get(headerName) {
        if (headerName.toLowerCase() === "content-type") {
          return contentType;
        }
        if (
          headerName.toLowerCase() === "content-length" &&
          declaredLength !== undefined
        ) {
          return String(declaredLength);
        }
        return null;
      },
    },
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: jest.fn(async () => responseText),
  };
}

function createRealImportResolver(fetchImpl) {
  return new WebVowlImportResolver({
    baseUrl: "https://viewer.example/",
    fetchImpl,
  });
}

function captureRejectedError(promise) {
  return promise.then(
    () => {
      throw new Error("Expected the ontology source load to reject.");
    },
    (error) => error,
  );
}

describe("canonical ontology source loading", () => {
  test("loads a remote ontology document through the canonical resolver and parser policies", async () => {
    const ontologyText = "@prefix : <https://example.com/> .";
    const fetchImpl = jest.fn(async () =>
      createFetchResponse(ontologyText, {
        contentType: "text/turtle; charset=utf-8",
      }),
    );
    const importResolver = createRealImportResolver(fetchImpl);
    const resolverLoad = jest.spyOn(importResolver, "load");
    const createImportResolver = jest.fn(() => importResolver);
    const parserDiagnostic = {
      code: "MISSING_IMPORT",
      documentIRI: "https://example.com/missing-import",
      message: "An optional import was unavailable.",
      severity: "warning",
    };
    const parsedVowlModel = createVowlModel({
      diagnostics: [parserDiagnostic],
    });
    const loadWithImports = jest.fn(async () => parsedVowlModel);
    const computeSha256Hex = jest.fn(async () => SHA256_HEX_FIXTURE);
    const onPhaseChange = jest.fn();
    const callerController = new AbortController();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex,
      createImportResolver,
      loadWithImports,
    });

    const result = await ontologySourceLoader.loadOntologySource(
      {
        source: {
          documentIri: "https://example.com/ontologies/model%20one.ttl",
          kind: "ontology-document-iri",
        },
      },
      { onPhaseChange, signal: callerController.signal },
    );

    expect(createImportResolver).toHaveBeenCalledTimes(1);
    expect(resolverLoad).toHaveBeenCalledWith(
      "https://example.com/ontologies/model%20one.ttl",
      {
        config: expect.objectContaining({
          maxRedirects: 0,
          maxRemoteDocumentBytes: CANONICAL_REMOTE_DOCUMENT_BYTE_LIMIT,
          timeoutMs: CANONICAL_REMOTE_TIMEOUT_MS,
        }),
        signal: expect.any(AbortSignal),
      },
    );
    expect(resolverLoad.mock.calls[0][1].config).toBeInstanceOf(
      OWLOntologyLoaderConfiguration,
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/ontologies/model%20one.ttl",
      {
        credentials: "omit",
        redirect: "error",
        signal: expect.any(AbortSignal),
      },
    );
    const [parsedText, parserOptions] = loadWithImports.mock.calls[0];
    expect(parsedText).toBe(ontologyText);
    expect(parserOptions).toMatchObject({
      contentType: "text/turtle; charset=utf-8",
      documentIRI: "https://example.com/ontologies/model%20one.ttl",
      fileName: "model one.ttl",
    });
    expect(parserOptions.configuration).toMatchObject({
      maxImportCount: 256,
      maxImportDepth: 32,
    });
    expect(parserOptions.configuration.signal).toBe(
      resolverLoad.mock.calls[0][1].signal,
    );
    expect(Array.from(computeSha256Hex.mock.calls[0][0])).toEqual(
      Array.from(new TextEncoder().encode(ontologyText)),
    );
    expect(onPhaseChange.mock.calls.map(([phase]) => phase)).toEqual([
      "loading",
      "parsing",
    ]);
    expect(result).toEqual({
      vowlModel: expect.not.objectContaining({
        diagnostics: expect.anything(),
      }),
      diagnostics: [
        {
          code: "MISSING_IMPORT",
          documentIri: "https://example.com/missing-import",
          message: "An optional import was unavailable.",
          severity: "warning",
        },
      ],
      sourceProvenance: {
        identity: "https://example.com/ontologies/model%20one.ttl",
        kind: "ontology-document-iri",
        sha256Hex: SHA256_HEX_FIXTURE,
      },
      structuralCounts: {
        classes: 3,
        datatypes: 1,
        individuals: 2,
        properties: 4,
      },
    });
    expect(result.vowlModel).not.toBe(parsedVowlModel);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.diagnostics)).toBe(true);
    expect(Object.isFrozen(result.diagnostics[0])).toBe(true);
    expect(Object.isFrozen(result.sourceProvenance)).toBe(true);
    expect(Object.isFrozen(result.structuralCounts)).toBe(true);
  });

  test("loads a remote VOWL JSON document without invoking OWL conversion", async () => {
    const serializedVowlModel = JSON.stringify(createVowlModel());
    const fetchImpl = jest.fn(async () =>
      createFetchResponse(serializedVowlModel, {
        contentType: "application/json",
      }),
    );
    const loadWithImports = jest.fn(() => {
      throw new Error("OWL conversion must not run for VOWL JSON.");
    });
    const onPhaseChange = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: async () => SHA256_HEX_FIXTURE,
      createImportResolver: () => createRealImportResolver(fetchImpl),
      loadWithImports,
    });

    const result = await ontologySourceLoader.loadOntologySource(
      {
        source: {
          kind: "vowl-json-url",
          url: "https://example.com/model.json",
        },
      },
      { onPhaseChange },
    );

    expect(loadWithImports).not.toHaveBeenCalled();
    expect(onPhaseChange.mock.calls.map(([phase]) => phase)).toEqual([
      "loading",
      "parsing",
    ]);
    expect(result.sourceProvenance).toEqual({
      identity: "https://example.com/model.json",
      kind: "vowl-json-url",
      sha256Hex: SHA256_HEX_FIXTURE,
    });
    expect(result.structuralCounts).toEqual({
      classes: 3,
      datatypes: 1,
      individuals: 2,
      properties: 4,
    });
  });

  test("takes the exact ontology-text format vocabulary from OWLDocumentFormats", () => {
    expect(ONTOLOGY_TEXT_FORMAT_CASES.map(([formatKey]) => formatKey)).toEqual(
      EXPECTED_ONTOLOGY_TEXT_FORMAT_KEYS,
    );
  });

  test.each(ONTOLOGY_TEXT_FORMAT_CASES)(
    "maps ontology-text format %s to primary media type %s",
    async (formatKey, primaryMediaType) => {
      const loadWithImports = jest.fn(async () => createVowlModel());
      const ontologySourceLoader = createOntologySourceLoader({
        computeSha256Hex: async () => SHA256_HEX_FIXTURE,
        createImportResolver: () => {
          throw new Error(
            "Inline ontology text must not perform a root fetch.",
          );
        },
        loadWithImports,
      });

      const result = await ontologySourceLoader.loadOntologySource({
        source: {
          format: formatKey,
          kind: "ontology-text",
          text: "Ontology(<https://example.com/ontology>)",
        },
      });

      expect(loadWithImports).toHaveBeenCalledWith(
        "Ontology(<https://example.com/ontology>)",
        expect.objectContaining({
          contentType: primaryMediaType,
          fileName: undefined,
        }),
      );
      expect(result.sourceProvenance).toEqual({
        kind: "ontology-text",
        sha256Hex: SHA256_HEX_FIXTURE,
      });
    },
  );

  test("passes a real display name to canonical syntax detection for file text", async () => {
    const loadWithImports = jest.fn(async () => createVowlModel());
    const onPhaseChange = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: async () => SHA256_HEX_FIXTURE,
      createImportResolver: () => {
        throw new Error("File text must not perform a root fetch.");
      },
      loadWithImports,
    });

    const result = await ontologySourceLoader.loadOntologySource(
      {
        source: {
          displayName: "selected-model.ttl",
          kind: "ontology-text",
          text: "@prefix : <https://example.com/> .",
        },
      },
      { onPhaseChange },
    );

    expect(loadWithImports).toHaveBeenCalledWith(
      "@prefix : <https://example.com/> .",
      expect.objectContaining({
        contentType: undefined,
        fileName: "selected-model.ttl",
      }),
    );
    expect(onPhaseChange).toHaveBeenCalledTimes(1);
    expect(onPhaseChange).toHaveBeenCalledWith("parsing");
    expect(result.sourceProvenance).toEqual({
      displayName: "selected-model.ttl",
      kind: "ontology-text",
      sha256Hex: SHA256_HEX_FIXTURE,
    });
  });

  test("uses one validated ontology-text snapshot throughout an asynchronous load", async () => {
    const validatedOntologyText = "@prefix : <https://example.com/> .";
    const callerOwnedSource = {
      displayName: "selected-model.ttl",
      format: "turtle",
      kind: "ontology-text",
      text: validatedOntologyText,
    };
    const loadWithImports = jest.fn(async () => createVowlModel());
    const computeSha256Hex = jest.fn(async () => SHA256_HEX_FIXTURE);
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex,
      createImportResolver: jest.fn(),
      loadWithImports,
    });

    const result = await ontologySourceLoader.loadOntologySource(
      { source: callerOwnedSource },
      {
        onPhaseChange(phase) {
          if (phase === "parsing") {
            callerOwnedSource.displayName = "mutated.rdf";
            callerOwnedSource.format = "rdfxml";
            callerOwnedSource.kind = "vowl-model";
            callerOwnedSource.text = "x".repeat(1024 * 1024 + 1);
          }
        },
      },
    );

    const [parsedOntologyText, parserOptions] = loadWithImports.mock.calls[0];
    expect(parsedOntologyText).toHaveLength(validatedOntologyText.length);
    expect(parsedOntologyText).toBe(validatedOntologyText);
    expect(parserOptions).toMatchObject({
      contentType: "text/turtle",
      fileName: "selected-model.ttl",
    });
    expect(Array.from(computeSha256Hex.mock.calls[0][0])).toEqual(
      Array.from(new TextEncoder().encode(validatedOntologyText)),
    );
    expect(result.sourceProvenance).toEqual({
      displayName: "selected-model.ttl",
      kind: "ontology-text",
      sha256Hex: SHA256_HEX_FIXTURE,
    });
  });

  test("clones and validates a first-class parsed VOWL model", async () => {
    const callerOwnedModel = createVowlModel({
      header: {
        iri: "https://example.com/cached",
        title: { en: "Cached ontology" },
      },
    });
    const loadWithImports = jest.fn();
    const computeSha256Hex = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex,
      createImportResolver: jest.fn(),
      loadWithImports,
    });

    const result = await ontologySourceLoader.loadOntologySource({
      source: {
        displayName: "cached.json",
        kind: "vowl-model",
        model: callerOwnedModel,
      },
    });

    expect(loadWithImports).not.toHaveBeenCalled();
    expect(computeSha256Hex).not.toHaveBeenCalled();
    expect(result.vowlModel).not.toBe(callerOwnedModel);
    expect(result.vowlModel.header).not.toBe(callerOwnedModel.header);
    expect(result.sourceProvenance).toEqual({
      displayName: "cached.json",
      kind: "vowl-model",
    });

    callerOwnedModel.header.title.en = "Changed by caller";
    callerOwnedModel.class.push({ id: "caller-owned" });
    expect(result.vowlModel.header.title.en).toBe("Cached ontology");
    expect(result.vowlModel.class).toEqual([]);
  });

  test.each(VOWL_COLLECTION_FIELD_NAMES)(
    "rejects a non-array %s collection before returning a VOWL model",
    async (collectionFieldName) => {
      const ontologySourceLoader = createOntologySourceLoader({
        computeSha256Hex: jest.fn(),
        createImportResolver: jest.fn(),
        loadWithImports: jest.fn(),
      });

      await expect(
        ontologySourceLoader.loadOntologySource({
          source: {
            kind: "vowl-model",
            model: createVowlModel({ [collectionFieldName]: {} }),
          },
        }),
      ).rejects.toMatchObject({
        code: "PARSE_FAILED",
        details: { sourceKind: "vowl-model" },
      });
    },
  );

  test("derives absent structural metrics from base records and unique individual IRIs", async () => {
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: jest.fn(),
      loadWithImports: jest.fn(),
    });
    const result = await ontologySourceLoader.loadOntologySource({
      source: {
        kind: "vowl-model",
        model: createVowlModel({
          class: [
            { id: "class-1", type: "owl:Class" },
            { id: "class-2", type: "owl:Class" },
            { id: "datatype-current", type: "rdfs:Datatype" },
            { id: "union", type: "owl:unionOf" },
          ],
          classAttribute: [
            {
              id: "class-1",
              individuals: [
                { iri: "https://example.com/individual-1" },
                { iri: "https://example.com/shared-individual" },
              ],
            },
            {
              id: "class-2",
              individuals: [{ iri: "https://example.com/shared-individual" }],
            },
          ],
          datatype: [
            { id: "datatype-legacy", type: "rdfs:Datatype" },
            { id: "literal", type: "rdfs:Literal" },
          ],
          metrics: {},
          property: [
            { id: "property-1", type: "owl:objectProperty" },
            { id: "property-2", type: "owl:datatypeProperty" },
          ],
          propertyAttribute: [{ id: "property-1" }],
        }),
      },
    });

    expect(result.structuralCounts).toEqual({
      classes: 2,
      datatypes: 2,
      individuals: 2,
      properties: 2,
    });
  });

  test.each([
    [
      "a relative ontology document location",
      {
        documentIri: "../model.owl",
        kind: "ontology-document-iri",
      },
    ],
    [
      "a file URL",
      { kind: "vowl-json-url", url: "file:///private/model.json" },
    ],
    [
      "a JavaScript URL",
      {
        documentIri: "javascript:alert(1)",
        kind: "ontology-document-iri",
      },
    ],
    [
      "credentials in a remote URL",
      {
        kind: "vowl-json-url",
        url: "https://user:secret@example.com/model.json",
      },
    ],
    [
      "a remote location over 2,048 characters",
      {
        documentIri: `https://example.com/${"x".repeat(2_048)}`,
        kind: "ontology-document-iri",
      },
    ],
  ])("rejects %s before remote loading", async (_scenario, source) => {
    const createImportResolver = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver,
      loadWithImports: jest.fn(),
    });

    await expect(
      ontologySourceLoader.loadOntologySource({ source }),
    ).rejects.toMatchObject({
      code: "SOURCE_REJECTED",
      details: { sourceKind: source.kind },
      isRetryable: false,
      name: "WebVowlOperationError",
    });
    expect(createImportResolver).not.toHaveBeenCalled();
  });

  test("rejects inline ontology content over the UTF-8 byte limit", async () => {
    const oversizedMultibyteText = "€".repeat(
      Math.floor((1024 * 1024) / 3) + 1,
    );
    const loadWithImports = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: jest.fn(),
      loadWithImports,
    });

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          format: "turtle",
          kind: "ontology-text",
          text: oversizedMultibyteText,
        },
      }),
    ).rejects.toMatchObject({ code: "SOURCE_REJECTED" });
    expect(loadWithImports).not.toHaveBeenCalled();
  });

  test.each([
    [
      "an unknown ontology-text format",
      {
        format: "guess",
        kind: "ontology-text",
        text: "Ontology(<https://example.com/ontology>)",
      },
    ],
    [
      "a serialized value in the parsed-model branch",
      {
        displayName: "cached.json",
        kind: "vowl-model",
        model: '{"header":{}}',
      },
    ],
  ])("rejects %s as an invalid source request", async (_scenario, source) => {
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: jest.fn(),
      loadWithImports: jest.fn(),
    });

    await expect(
      ontologySourceLoader.loadOntologySource({ source }),
    ).rejects.toMatchObject({
      code: "SOURCE_REJECTED",
      details: { sourceKind: source.kind },
    });
  });

  test.each([
    ["invalid JSON syntax", "{not-json"],
    ["a non-object JSON value", "[]"],
  ])("maps %s in remote VOWL JSON to PARSE_FAILED", async (_scenario, body) => {
    const fetchImpl = jest.fn(async () =>
      createFetchResponse(body, { contentType: "application/json" }),
    );
    const computeSha256Hex = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex,
      createImportResolver: () => createRealImportResolver(fetchImpl),
      loadWithImports: jest.fn(),
    });

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          kind: "vowl-json-url",
          url: "https://example.com/model.json",
        },
      }),
    ).rejects.toMatchObject({
      code: "PARSE_FAILED",
      details: { sourceKind: "vowl-json-url" },
    });
    expect(computeSha256Hex).not.toHaveBeenCalled();
  });

  test("lets OWLAPI classify malformed ontology text", async () => {
    const ontologySourceLoader = createOntologySourceLoader();

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          format: "turtle",
          kind: "ontology-text",
          text: "this is not valid Turtle {",
        },
      }),
    ).rejects.toMatchObject({
      code: "PARSE_FAILED",
      details: { sourceKind: "ontology-text" },
    });
  });

  test("maps an OWLAPI ontology-creation failure caused by parsed source data to PARSE_FAILED", async () => {
    const ontologySourceLoader = createOntologySourceLoader();
    const ambiguousNamedGraphOntologyText = [
      "<https://example.com/ontology> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Ontology> <https://example.com/graph-1> .",
      "<https://example.com/Class> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2002/07/owl#Class> <https://example.com/graph-2> .",
    ].join("\n");

    const error = await captureRejectedError(
      ontologySourceLoader.loadOntologySource({
        source: {
          format: "nquads",
          kind: "ontology-text",
          text: ambiguousNamedGraphOntologyText,
        },
      }),
    );

    expect(error).toMatchObject({
      code: "PARSE_FAILED",
      details: { sourceKind: "ontology-text" },
    });
    expect(error.cause).toBeInstanceOf(OWLOntologyCreationError);
  });

  test("uses OWLAPI and native Web Crypto defaults for valid ontology text", async () => {
    const ontologySourceLoader = createOntologySourceLoader();
    const ontologyText = [
      "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
      "@prefix ex: <https://example.com/model#> .",
      "<https://example.com/model> a owl:Ontology .",
      "ex:Person a owl:Class .",
    ].join("\n");

    const result = await ontologySourceLoader.loadOntologySource({
      source: { format: "turtle", kind: "ontology-text", text: ontologyText },
    });

    expect(result.vowlModel.header.iri).toBe("https://example.com/model");
    expect(result.structuralCounts.classes).toBe(1);
    expect(result.sourceProvenance.sha256Hex).toBe(
      createHash("sha256").update(ontologyText, "utf8").digest("hex"),
    );
  });

  test("maps a browser Fetch TypeError to FETCH_FAILED", async () => {
    const fetchFailure = new TypeError("Failed to fetch");
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: () =>
        createRealImportResolver(async () => {
          throw fetchFailure;
        }),
      loadWithImports: jest.fn(),
    });

    const error = await captureRejectedError(
      ontologySourceLoader.loadOntologySource({
        source: {
          documentIri: "https://cors.example/model.owl",
          kind: "ontology-document-iri",
        },
      }),
    );

    expect(error).toMatchObject({
      code: "FETCH_FAILED",
      isRetryable: true,
    });
    expect(error.cause).toBeInstanceOf(DocumentLoadError);
    expect(error.cause.cause).toBe(fetchFailure);
  });

  test("maps a Fetch response-body TypeError to FETCH_FAILED", async () => {
    const responseBodyFailure = new TypeError(
      "The network connection was terminated while reading the body",
    );
    const response = createFetchResponse("");
    response.text.mockRejectedValueOnce(responseBodyFailure);
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: () =>
        createRealImportResolver(async () => response),
      loadWithImports: jest.fn(),
    });

    const error = await captureRejectedError(
      ontologySourceLoader.loadOntologySource({
        source: {
          kind: "vowl-json-url",
          url: "https://example.com/interrupted-model.json",
        },
      }),
    );

    expect(error).toMatchObject({
      code: "FETCH_FAILED",
      isRetryable: true,
    });
    expect(error.cause).toBeInstanceOf(DocumentLoadError);
    expect(error.cause).toMatchObject({ code: "MISSING_IMPORT" });
    expect(error.cause.cause).toBe(responseBodyFailure);
  });

  test("maps a failed HTTP response to FETCH_FAILED", async () => {
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: () =>
        createRealImportResolver(async () =>
          createFetchResponse("Service unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          }),
        ),
      loadWithImports: jest.fn(),
    });

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          kind: "vowl-json-url",
          url: "https://example.com/model.json",
        },
      }),
    ).rejects.toMatchObject({
      code: "FETCH_FAILED",
      details: { sourceKind: "vowl-json-url" },
      isRetryable: true,
    });
  });

  test("maps caller cancellation to LOAD_ABORTED and preserves its reason", async () => {
    const callerController = new AbortController();
    const cancellationReason = new TypeError("Cancelled by caller");
    const fetchImpl = jest.fn(
      async (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const loadWithImports = jest.fn();
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: () => createRealImportResolver(fetchImpl),
      loadWithImports,
    });

    const pendingLoad = ontologySourceLoader.loadOntologySource(
      {
        source: {
          documentIri: "https://example.com/model.owl",
          kind: "ontology-document-iri",
        },
      },
      { signal: callerController.signal },
    );
    callerController.abort(cancellationReason);
    const error = await captureRejectedError(pendingLoad);

    expect(error).toMatchObject({
      code: "LOAD_ABORTED",
      isRetryable: true,
    });
    expect(error.cause).toBe(cancellationReason);
    expect(loadWithImports).not.toHaveBeenCalled();
  });

  test("maps the canonical remote byte ceiling to SOURCE_REJECTED", async () => {
    const oversizedResponse = createFetchResponse("body must not be read", {
      declaredLength: CANONICAL_REMOTE_DOCUMENT_BYTE_LIMIT + 1,
    });
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: () =>
        createRealImportResolver(async () => oversizedResponse),
      loadWithImports: jest.fn(),
    });

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          documentIri: "https://example.com/oversized.owl",
          kind: "ontology-document-iri",
        },
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_REJECTED",
      details: { sourceKind: "ontology-document-iri" },
    });
    expect(oversizedResponse.text).not.toHaveBeenCalled();
  });

  test("bounds parser and missing-import diagnostics without invalidating the root", async () => {
    const overlongMessage = "x".repeat(300);
    const diagnostics = Array.from({ length: 12 }, (_, index) => ({
      code: index === 0 ? "MISSING_IMPORT" : `RECOVERY_${index}`,
      documentIRI: `https://example.com/import-${index}`,
      message: index === 0 ? overlongMessage : `Recovery ${index}`,
      severity: "warning",
    }));
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: async () => SHA256_HEX_FIXTURE,
      createImportResolver: jest.fn(),
      loadWithImports: async () => createVowlModel({ diagnostics }),
    });

    const result = await ontologySourceLoader.loadOntologySource({
      source: {
        format: "turtle",
        kind: "ontology-text",
        text: "@prefix : <https://example.com/> .",
      },
    });

    expect(result.diagnostics).toHaveLength(10);
    expect(result.diagnostics[0]).toMatchObject({
      code: "MISSING_IMPORT",
      documentIri: "https://example.com/import-0",
      severity: "warning",
    });
    expect(result.diagnostics[0].message).toHaveLength(256);
    expect(result.vowlModel).not.toHaveProperty("diagnostics");
  });

  test("keeps a parsed load usable when source hashing is unavailable", async () => {
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: async () => {
        throw new TypeError("Web Crypto is unavailable");
      },
      createImportResolver: jest.fn(),
      loadWithImports: async () => createVowlModel(),
    });

    const result = await ontologySourceLoader.loadOntologySource({
      source: {
        format: "turtle",
        kind: "ontology-text",
        text: "@prefix : <https://example.com/> .",
      },
    });

    expect(result.sourceProvenance).not.toHaveProperty("sha256Hex");
    expect(result.diagnostics).toContainEqual({
      code: "SOURCE_SHA256_UNAVAILABLE",
      message: "A SHA-256 source fingerprint is unavailable in this browser.",
      severity: "warning",
    });
  });

  test("maps a root-invalidating import failure to IMPORT_FAILED", async () => {
    const importFailure = new UnloadableImportError(
      "The required import closure could not be loaded",
    );
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: jest.fn(),
      loadWithImports: async () => {
        throw importFailure;
      },
    });

    const error = await captureRejectedError(
      ontologySourceLoader.loadOntologySource({
        source: {
          format: "turtle",
          kind: "ontology-text",
          text: "@prefix : <https://example.com/> .",
        },
      }),
    );

    expect(error).toMatchObject({
      code: "IMPORT_FAILED",
      details: { sourceKind: "ontology-text" },
      isRetryable: true,
    });
    expect(error.cause).toBe(importFailure);
  });

  test("does not disguise an unexpected parser collaborator defect", async () => {
    const collaboratorDefect = new Error("Unexpected parser defect");
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: jest.fn(),
      createImportResolver: jest.fn(),
      loadWithImports: async () => {
        throw collaboratorDefect;
      },
    });

    await expect(
      ontologySourceLoader.loadOntologySource({
        source: {
          format: "turtle",
          kind: "ontology-text",
          text: "@prefix : <https://example.com/> .",
        },
      }),
    ).rejects.toBe(collaboratorDefect);
  });
});

describe("mixed-content retrieval", () => {
  test("retrieves an http location over https from an https page", async () => {
    const requestedUrls = [];
    const fetchImpl = jest.fn(async (requestedUrl) => {
      requestedUrls.push(String(requestedUrl));
      return new Response(JSON.stringify(createVowlModel()), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });
    const ontologySourceLoader = createOntologySourceLoader({
      computeSha256Hex: async () => SHA256_HEX_FIXTURE,
      createImportResolver: () => createRealImportResolver(fetchImpl),
      loadWithImports: async () => createVowlModel(),
    });
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { href: "https://viewer.example/", protocol: "https:" },
    });

    try {
      await ontologySourceLoader.loadOntologySource({
        source: { kind: "vowl-json-url", url: "http://example.com/model.json" },
      });
    } finally {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: originalLocation,
      });
    }

    // The page is https, so the browser would block the http retrieval.
    expect(requestedUrls).toEqual(["https://example.com/model.json"]);
  });
});
