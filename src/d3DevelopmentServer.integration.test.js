import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "@jest/globals";

const D3_DISTRIBUTION_FILE_URL = new URL(
  "../node_modules/d3/dist/d3.min.js",
  import.meta.url,
);
const PROJECT_ROOT_DIRECTORY_PATH = fileURLToPath(
  new URL("../", import.meta.url),
);
const VITE_CONFIGURATION_FILE_PATH = fileURLToPath(
  new URL("../vite.config.mjs", import.meta.url),
);
const DEVELOPMENT_SERVER_START_TIMEOUT_MILLISECONDS = 30_000;
const DEVELOPMENT_SERVER_STOP_TIMEOUT_MILLISECONDS = 10_000;

function createDevelopmentServerProcessSource(basePath) {
  const baseConfigurationSource =
    basePath === undefined ? "" : `base: ${JSON.stringify(basePath)},`;

  return `
    import { createServer } from "vite";

    const developmentServer = await createServer({
      ${baseConfigurationSource}
      configFile: ${JSON.stringify(VITE_CONFIGURATION_FILE_PATH)},
      logLevel: "silent",
      server: {
        headers: {
          "X-WebVOWL-Test": "configured-development-header",
        },
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
      },
    });

    await developmentServer.listen();

    const serverAddress = developmentServer.httpServer.address();

    if (typeof serverAddress === "string" || serverAddress === null) {
      throw new TypeError("Vite did not expose a TCP development-server address");
    }

    process.send({ port: serverAddress.port, type: "ready" });
    process.on("message", async (message) => {
      if (message?.type !== "close") {
        return;
      }

      await developmentServer.close();
      process.exit(0);
    });
  `;
}

async function startConfiguredDevelopmentServer({ basePath } = {}) {
  const developmentServerProcess = spawn(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      createDevelopmentServerProcessSource(basePath),
    ],
    {
      cwd: PROJECT_ROOT_DIRECTORY_PATH,
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      windowsHide: true,
    },
  );
  let standardErrorOutput = "";

  developmentServerProcess.stderr.setEncoding("utf8");
  developmentServerProcess.stderr.on("data", (outputChunk) => {
    standardErrorOutput += outputChunk;
  });

  const port = await new Promise((resolveReady, rejectReady) => {
    const startTimeout = setTimeout(() => {
      removeReadinessListeners();
      developmentServerProcess.kill();
      rejectReady(
        new Error(
          `Vite did not start within ${DEVELOPMENT_SERVER_START_TIMEOUT_MILLISECONDS} ms. ${standardErrorOutput}`,
        ),
      );
    }, DEVELOPMENT_SERVER_START_TIMEOUT_MILLISECONDS);

    function removeReadinessListeners() {
      clearTimeout(startTimeout);
      developmentServerProcess.off("error", handleStartError);
      developmentServerProcess.off("exit", handlePrematureExit);
      developmentServerProcess.off("message", handleReadyMessage);
    }

    function handleStartError(error) {
      removeReadinessListeners();
      rejectReady(error);
    }

    function handlePrematureExit(exitCode, signalName) {
      removeReadinessListeners();
      rejectReady(
        new Error(
          `Vite exited before becoming ready (code ${exitCode}, signal ${signalName}). ${standardErrorOutput}`,
        ),
      );
    }

    function handleReadyMessage(message) {
      if (message?.type !== "ready" || !Number.isInteger(message.port)) {
        return;
      }

      removeReadinessListeners();
      resolveReady(message.port);
    }

    developmentServerProcess.once("error", handleStartError);
    developmentServerProcess.once("exit", handlePrematureExit);
    developmentServerProcess.on("message", handleReadyMessage);
  });

  return {
    developmentServerProcess,
    origin: `http://127.0.0.1:${port}`,
  };
}

async function stopConfiguredDevelopmentServer(developmentServerProcess) {
  if (developmentServerProcess.exitCode !== null) {
    return;
  }

  const stopped = new Promise((resolveStopped, rejectStopped) => {
    const stopTimeout = setTimeout(() => {
      developmentServerProcess.kill();
      rejectStopped(
        new Error(
          `Vite did not stop within ${DEVELOPMENT_SERVER_STOP_TIMEOUT_MILLISECONDS} ms`,
        ),
      );
    }, DEVELOPMENT_SERVER_STOP_TIMEOUT_MILLISECONDS);

    developmentServerProcess.once("error", (error) => {
      clearTimeout(stopTimeout);
      rejectStopped(error);
    });
    developmentServerProcess.once("exit", () => {
      clearTimeout(stopTimeout);
      resolveStopped();
    });
  });

  developmentServerProcess.send({ type: "close" });
  await stopped;
}

describe("configured Vite development server", () => {
  test("serves D3 through the real plugin lifecycle with standard response semantics", async () => {
    const { developmentServerProcess, origin } =
      await startConfiguredDevelopmentServer();

    try {
      const response = await fetch(`${origin}/js/d3.min.js`);
      const responseBytes = Buffer.from(await response.arrayBuffer());
      const expectedD3DistributionBytes = readFileSync(
        D3_DISTRIBUTION_FILE_URL,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/javascript");
      expect(response.headers.get("content-length")).toBe(
        String(expectedD3DistributionBytes.byteLength),
      );
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(response.headers.get("etag")).toEqual(
        expect.stringMatching(/^W\//u),
      );
      expect(response.headers.get("x-webvowl-test")).toBe(
        "configured-development-header",
      );
      expect(responseBytes).toEqual(expectedD3DistributionBytes);

      const headResponse = await fetch(`${origin}/js/d3.min.js`, {
        method: "HEAD",
      });

      expect(headResponse.status).toBe(200);
      expect(headResponse.headers.get("content-length")).toBe(
        String(expectedD3DistributionBytes.byteLength),
      );
      expect((await headResponse.arrayBuffer()).byteLength).toBe(0);

      const conditionalResponse = await fetch(`${origin}/js/d3.min.js`, {
        headers: { "If-None-Match": response.headers.get("etag") },
      });

      expect(conditionalResponse.status).toBe(304);
      expect((await conditionalResponse.arrayBuffer()).byteLength).toBe(0);
    } finally {
      await stopConfiguredDevelopmentServer(developmentServerProcess);
    }
  }, 45_000);

  test("serves D3 beneath a configured non-root development base", async () => {
    const { developmentServerProcess, origin } =
      await startConfiguredDevelopmentServer({ basePath: "/webvowl/" });

    try {
      const response = await fetch(`${origin}/webvowl/js/d3.min.js`);
      const responseBytes = Buffer.from(await response.arrayBuffer());
      const expectedD3DistributionBytes = readFileSync(
        D3_DISTRIBUTION_FILE_URL,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/javascript");
      expect(responseBytes).toEqual(expectedD3DistributionBytes);
    } finally {
      await stopConfiguredDevelopmentServer(developmentServerProcess);
    }
  }, 45_000);
});
