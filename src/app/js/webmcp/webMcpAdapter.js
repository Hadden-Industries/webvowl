import {
  WEB_MCP_TOOL_DEFINITIONS,
  createWebMcpToolDispatch,
} from "./webMcpToolContracts.js";

// Registers this page's five tools with the host, and withdraws them when the
// page is done. Everything an agent can reach goes through the controller, so
// this module knows nothing about the renderer, the DOM of the visualization,
// or how a graph is drawn.
//
// A page that cannot offer tools is still a working WebVOWL page. Every reason
// it cannot is a local diagnostic for a developer reading the console, never
// something an ontology or an agent can observe.

const WEB_MCP_AVAILABILITY_REASONS = Object.freeze({
  available: "available",
  notTopLevel: "not-top-level",
  registrationFailed: "registration-failed",
  unsupported: "unsupported",
});

function readModelContext(documentObject) {
  const modelContext = documentObject?.modelContext;
  if (
    modelContext === null ||
    typeof modelContext !== "object" ||
    typeof modelContext.registerTool !== "function"
  ) {
    return undefined;
  }
  return modelContext;
}

export function registerWebMcpTools({
  controller,
  consoleObject = globalThis.console,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
  AbortControllerConstructor = globalThis.AbortController,
}) {
  const lifecycleController = new AbortControllerConstructor();
  let isAvailable = false;
  let availabilityReason = WEB_MCP_AVAILABILITY_REASONS.unsupported;

  // An embedded page does not speak for the page that embeds it, so the API is
  // not read at all rather than read and declined.
  if (windowObject?.top !== windowObject) {
    return Object.freeze({
      get isAvailable() {
        return false;
      },
      get availabilityReason() {
        return WEB_MCP_AVAILABILITY_REASONS.notTopLevel;
      },
      whenRegistered: Promise.resolve(),
      dispose() {
        lifecycleController.abort();
      },
    });
  }

  const modelContext = readModelContext(documentObject);
  if (modelContext === undefined) {
    return Object.freeze({
      get isAvailable() {
        return false;
      },
      get availabilityReason() {
        return WEB_MCP_AVAILABILITY_REASONS.unsupported;
      },
      whenRegistered: Promise.resolve(),
      dispose() {
        lifecycleController.abort();
      },
    });
  }

  const { callWebMcpTool } = createWebMcpToolDispatch({
    webVowlController: controller,
  });

  const whenRegistered = (async () => {
    try {
      for (const toolDefinition of WEB_MCP_TOOL_DEFINITIONS) {
        // A page disposed mid-registration wants no more tools. Stopping here
        // leaves the host holding only what it already accepted, which the
        // lifecycle signal then withdraws.
        if (lifecycleController.signal.aborted) {
          break;
        }
        await modelContext.registerTool(
          {
            name: toolDefinition.name,
            description: toolDefinition.description,
            inputSchema: toolDefinition.inputSchema,
            annotations: toolDefinition.annotations,
            // A call's own cancellation reaches the controller; the page's
            // lifecycle signal governs the registration, not the operation.
            execute: async (toolInput, { signal } = {}) =>
              callWebMcpTool(toolDefinition.name, toolInput, { signal }),
          },
          { signal: lifecycleController.signal },
        );
      }
      isAvailable = !lifecycleController.signal.aborted;
      availabilityReason = lifecycleController.signal.aborted
        ? WEB_MCP_AVAILABILITY_REASONS.unsupported
        : WEB_MCP_AVAILABILITY_REASONS.available;
    } catch (registrationError) {
      isAvailable = false;
      availabilityReason = WEB_MCP_AVAILABILITY_REASONS.registrationFailed;
      // One bounded line, and no retry: a host that refused once will refuse
      // again, and a loop would only fill the console.
      consoleObject?.warn?.(
        `WebVOWL could not register its agent tools: ${String(
          registrationError?.message ?? registrationError,
        ).slice(0, 200)}`,
      );
    }
  })();

  return Object.freeze({
    get isAvailable() {
      return isAvailable;
    },
    get availabilityReason() {
      return availabilityReason;
    },
    whenRegistered,
    dispose() {
      lifecycleController.abort();
      isAvailable = false;
    },
  });
}
