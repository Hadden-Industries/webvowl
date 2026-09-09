import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import { OWLDocumentFormats } from "owlapi/formats";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let registerWebMcpTools;

beforeAll(async () => {
  // The contracts module is loaded first so the adapter links against the same
  // instance the assertions below read.
  await loadEsmModuleForTest(
    new URL("./webMcpToolContracts.js", import.meta.url),
    import.meta.url,
    { "owlapi/formats": { OWLDocumentFormats } },
  );
  ({ registerWebMcpTools } = await loadEsmModuleForTest(
    new URL("./webMcpAdapter.js", import.meta.url),
    import.meta.url,
    { "owlapi/formats": { OWLDocumentFormats } },
  ));
});

const EXPECTED_TOOL_NAMES = Object.freeze([
  "load_ontology",
  "get_ontology_summary",
  "find_ontology_elements",
  "set_visualization_view",
  "export_visualization",
  "get_visualization_state",
  "reset_visualization",
  "set_visualization_modes",
  "set_layout_distances",
]);

function createControllerDouble(overrides = {}) {
  return {
    getState: () => ({ loadGeneration: 1, status: "ready" }),
    loadOntology: async () => ({ loadGeneration: 2 }),
    getOntologySummary: () => ({ loadGeneration: 1 }),
    findOntologyElements: () => ({ loadGeneration: 1, matches: [] }),
    setVisualizationView: async () => ({ loadGeneration: 1 }),
    exportVisualization: async () => ({
      loadGeneration: 1,
      filename: "graph.svg",
    }),
    ...overrides,
  };
}

function createRegistrationHost({ registerTool, modelContext } = {}) {
  const registeredToolDefinitions = [];
  const registrationOptions = [];
  const defaultRegisterTool = jest.fn(
    async (toolDefinition, registrationOption) => {
      registeredToolDefinitions.push(toolDefinition);
      registrationOptions.push(registrationOption);
    },
  );
  // `null` means the document has no modelContext at all, which is what an
  // unsupported browser looks like.
  const documentObject =
    modelContext === null
      ? {}
      : {
          modelContext:
            modelContext === undefined
              ? { registerTool: registerTool ?? defaultRegisterTool }
              : modelContext,
        };
  const windowObject = {};
  windowObject.top = windowObject;
  return {
    documentObject,
    registeredToolDefinitions,
    registrationOptions,
    registerTool: registerTool ?? defaultRegisterTool,
    windowObject,
  };
}

async function registerToolsForTest(overrides = {}) {
  const registrationHost = createRegistrationHost(overrides.host ?? {});
  const controller = createControllerDouble(overrides.controller ?? {});
  const consoleWarnings = [];
  const webMcpRegistration = registerWebMcpTools({
    controller,
    consoleObject: { warn: (message) => consoleWarnings.push(message) },
    documentObject: registrationHost.documentObject,
    windowObject: registrationHost.windowObject,
    ...(overrides.registrationOverrides ?? {}),
  });
  await webMcpRegistration.whenRegistered;
  return {
    ...registrationHost,
    consoleWarnings,
    controller,
    webMcpRegistration,
  };
}

describe("WebMCP tool registration", () => {
  test("registers every tool once on a supported top-level page", async () => {
    const { registeredToolDefinitions, webMcpRegistration } =
      await registerToolsForTest();

    expect(webMcpRegistration.isAvailable).toBe(true);
    expect(webMcpRegistration.availabilityReason).toBe("available");
    expect(
      registeredToolDefinitions.map((toolDefinition) => toolDefinition.name),
    ).toEqual(EXPECTED_TOOL_NAMES);
  });

  test("registers each tool in the host's imperative shape", async () => {
    const { registeredToolDefinitions, registrationOptions } =
      await registerToolsForTest();

    for (const toolDefinition of registeredToolDefinitions) {
      expect(Object.keys(toolDefinition).sort()).toEqual([
        "annotations",
        "description",
        "execute",
        "inputSchema",
        "name",
      ]);
      expect(typeof toolDefinition.execute).toBe("function");
    }
    // Every registration is bound to the page's own lifecycle, so disposing
    // the page withdraws them all.
    for (const registrationOption of registrationOptions) {
      expect(registrationOption.signal.aborted).toBe(false);
    }
  });

  test("reports an unsupported page rather than throwing", async () => {
    const { webMcpRegistration } = await registerToolsForTest({
      host: { modelContext: null },
    });

    expect(webMcpRegistration.isAvailable).toBe(false);
    expect(webMcpRegistration.availabilityReason).toBe("unsupported");
  });

  test("reports an unsupported page when the host cannot register a tool", async () => {
    const { webMcpRegistration } = await registerToolsForTest({
      host: { modelContext: {} },
    });

    expect(webMcpRegistration.isAvailable).toBe(false);
    expect(webMcpRegistration.availabilityReason).toBe("unsupported");
  });

  test("never reads the API on an embedded page", async () => {
    const registrationHost = createRegistrationHost();
    // An embedded page's window is not its own top, and this page does not
    // inspect or proxy the document that embeds it.
    registrationHost.windowObject.top = { different: true };

    const webMcpRegistration = registerWebMcpTools({
      controller: createControllerDouble(),
      documentObject: registrationHost.documentObject,
      windowObject: registrationHost.windowObject,
    });
    await webMcpRegistration.whenRegistered;

    expect(webMcpRegistration.availabilityReason).toBe("not-top-level");
    expect(registrationHost.registeredToolDefinitions).toEqual([]);
  });

  test("leaves the page working when a registration is rejected", async () => {
    const { consoleWarnings, webMcpRegistration } = await registerToolsForTest({
      host: {
        registerTool: async () => {
          throw new Error("The host refused this tool.");
        },
      },
    });

    expect(webMcpRegistration.isAvailable).toBe(false);
    expect(webMcpRegistration.availabilityReason).toBe("registration-failed");
    // One bounded warning, and no retry loop.
    expect(consoleWarnings).toHaveLength(1);
  });

  test("registers once however many times initialization is awaited", async () => {
    const { registeredToolDefinitions, webMcpRegistration } =
      await registerToolsForTest();

    await webMcpRegistration.whenRegistered;
    await webMcpRegistration.whenRegistered;

    expect(registeredToolDefinitions).toHaveLength(EXPECTED_TOOL_NAMES.length);
  });
});

describe("WebMCP tool execution", () => {
  async function executeRegisteredTool(toolName, toolInput, executeOptions) {
    const registration = await registerToolsForTest();
    const toolDefinition = registration.registeredToolDefinitions.find(
      (candidateDefinition) => candidateDefinition.name === toolName,
    );
    const toolCallResult =
      executeOptions === undefined
        ? await toolDefinition.execute(toolInput)
        : await toolDefinition.execute(toolInput, executeOptions);
    return { registration, toolCallResult };
  }

  test("answers a call with the projected success envelope", async () => {
    const { toolCallResult } = await executeRegisteredTool(
      "get_ontology_summary",
      {},
    );

    expect(toolCallResult).toEqual({
      isSuccess: true,
      toolResult: {
        operation: "get_ontology_summary",
        loadGeneration: 1,
        isTruncated: false,
      },
    });
  });

  test("executes when the caller omits the options object entirely", async () => {
    const { toolCallResult } = await executeRegisteredTool(
      "find_ontology_elements",
      { query: "Person" },
      undefined,
    );

    expect(toolCallResult.isSuccess).toBe(true);
  });

  test("forwards the call's cancellation signal to the controller", async () => {
    const observedSignals = [];
    const registration = await registerToolsForTest({
      controller: {
        setVisualizationView: async (request, { signal } = {}) => {
          observedSignals.push(signal);
          return { loadGeneration: 1 };
        },
      },
    });
    const abortController = new AbortController();
    const toolDefinition = registration.registeredToolDefinitions.find(
      (candidateDefinition) =>
        candidateDefinition.name === "set_visualization_view",
    );

    await toolDefinition.execute(
      { layout: "resume" },
      { signal: abortController.signal },
    );

    expect(observedSignals).toEqual([abortController.signal]);
  });

  test("reports that no ontology is loaded rather than withdrawing the tool", async () => {
    const registration = await registerToolsForTest({
      controller: {
        getState: () => ({ loadGeneration: 0, status: "idle" }),
        getOntologySummary: () => {
          throw Object.assign(new Error("No ontology is currently loaded."), {
            code: "NO_ONTOLOGY",
            isRetryable: false,
          });
        },
      },
    });
    const toolDefinition = registration.registeredToolDefinitions.find(
      (candidateDefinition) =>
        candidateDefinition.name === "get_ontology_summary",
    );

    const toolCallResult = await toolDefinition.execute({});

    expect(toolCallResult).toEqual({
      isSuccess: false,
      error: {
        operation: "get_ontology_summary",
        code: "NO_ONTOLOGY",
        message: "No ontology is currently loaded.",
        isRetryable: false,
      },
    });
    // The surface a caller sees does not change with what is loaded.
    expect(registration.registeredToolDefinitions).toHaveLength(
      EXPECTED_TOOL_NAMES.length,
    );
  });

  test("projects a controller failure without its internals", async () => {
    const registration = await registerToolsForTest({
      controller: {
        exportVisualization: async () => {
          throw new TypeError("Cannot read /srv/app/token=abc123");
        },
      },
    });
    const toolDefinition = registration.registeredToolDefinitions.find(
      (candidateDefinition) =>
        candidateDefinition.name === "export_visualization",
    );

    const toolCallResult = await toolDefinition.execute({});

    expect(toolCallResult.error.code).toBe("TOOL_FAILED");
    expect(JSON.stringify(toolCallResult)).not.toContain("token=abc123");
  });
});

describe("WebMCP registration lifetime", () => {
  test("withdraws every registration when the page disposes it", async () => {
    const { registrationOptions, webMcpRegistration } =
      await registerToolsForTest();

    webMcpRegistration.dispose();

    for (const registrationOption of registrationOptions) {
      expect(registrationOption.signal.aborted).toBe(true);
    }
  });

  test("disposes the same however many times it is called", async () => {
    const { webMcpRegistration } = await registerToolsForTest();

    expect(() => {
      webMcpRegistration.dispose();
      webMcpRegistration.dispose();
    }).not.toThrow();
  });

  test("aborts a pending registration when the page disposes first", async () => {
    const pendingRegistrationResolvers = [];
    const registrationHost = createRegistrationHost({
      registerTool: () =>
        new Promise((resolve) => {
          pendingRegistrationResolvers.push(resolve);
        }),
    });
    const webMcpRegistration = registerWebMcpTools({
      controller: createControllerDouble(),
      documentObject: registrationHost.documentObject,
      windowObject: registrationHost.windowObject,
    });

    webMcpRegistration.dispose();
    // Settle whatever the host still holds, including registrations the
    // adapter starts after the first resolves.
    for (let settleRound = 0; settleRound < 10; settleRound += 1) {
      pendingRegistrationResolvers.splice(0).forEach((resolve) => resolve());
      await Promise.resolve();
    }
    await webMcpRegistration.whenRegistered;

    expect(webMcpRegistration.isAvailable).toBe(false);
  });

  test("never cancels a controller operation of its own accord", async () => {
    const observedSignals = [];
    const registration = await registerToolsForTest({
      controller: {
        loadOntology: async (request, { signal } = {}) => {
          observedSignals.push(signal?.aborted ?? null);
          return { loadGeneration: 2 };
        },
      },
    });
    const toolDefinition = registration.registeredToolDefinitions.find(
      (candidateDefinition) => candidateDefinition.name === "load_ontology",
    );

    await toolDefinition.execute({
      source: { kind: "vowl-json-url", url: "https://example.test/m.json" },
    });

    // A call the page did not cancel arrives at the controller uncancelled;
    // the lifecycle signal governs registrations, not operations.
    expect(observedSignals).toEqual([null]);
  });
});
