import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "@jest/globals";

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
      server: { host: "127.0.0.1", port: 0, strictPort: true },
    });
    await developmentServer.listen();
    const serverAddress = developmentServer.httpServer.address();
    if (typeof serverAddress === "string" || serverAddress === null) {
      throw new TypeError("Vite did not expose a TCP development-server address");
    }
    process.send({ port: serverAddress.port, type: "ready" });
    process.on("message", async (message) => {
      if (message?.type === "close") {
        await developmentServer.close();
        process.exit(0);
      }
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
  developmentServerProcess.stderr.on("data", (chunk) => {
    standardErrorOutput += chunk;
  });

  const port = await new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      developmentServerProcess.kill();
      rejectReady(new Error(`Vite did not start. ${standardErrorOutput}`));
    }, DEVELOPMENT_SERVER_START_TIMEOUT_MILLISECONDS);
    developmentServerProcess.once("error", rejectReady);
    developmentServerProcess.once("exit", (exitCode, signalName) => {
      clearTimeout(timeout);
      rejectReady(
        new Error(
          `Vite exited before becoming ready (code ${exitCode}, signal ${signalName}). ${standardErrorOutput}`,
        ),
      );
    });
    developmentServerProcess.on("message", (message) => {
      if (message?.type === "ready" && Number.isInteger(message.port)) {
        clearTimeout(timeout);
        resolveReady(message.port);
      }
    });
  });
  return { developmentServerProcess, origin: `http://127.0.0.1:${port}` };
}

async function stopConfiguredDevelopmentServer(developmentServerProcess) {
  if (developmentServerProcess.exitCode !== null) {
    return;
  }
  const stopped = new Promise((resolveStopped, rejectStopped) => {
    const timeout = setTimeout(() => {
      developmentServerProcess.kill();
      rejectStopped(new Error("Vite did not stop within the expected time"));
    }, DEVELOPMENT_SERVER_STOP_TIMEOUT_MILLISECONDS);
    developmentServerProcess.once("error", rejectStopped);
    developmentServerProcess.once("exit", () => {
      clearTimeout(timeout);
      resolveStopped();
    });
  });
  developmentServerProcess.send({ type: "close" });
  await stopped;
}

async function expectServedD3EsmGraph({ basePath = "/" } = {}) {
  const { developmentServerProcess, origin } =
    await startConfiguredDevelopmentServer({ basePath });
  try {
    const runtimeModuleUrl = new URL(
      `${basePath}webvowl/js/runtime/renderedGraphInternals.js`,
      origin,
    );
    const runtimeResponse = await fetch(runtimeModuleUrl);
    const runtimeSource = await runtimeResponse.text();
    const d3Specifier = runtimeSource.match(
      /from\s+["']([^"']*\bd3[^"']*)["']/u,
    )?.[1];

    expect(runtimeResponse.status).toBe(200);
    expect(d3Specifier).toEqual(expect.any(String));

    const d3Response = await fetch(new URL(d3Specifier, origin));
    const d3Source = await d3Response.text();
    expect(d3Response.status).toBe(200);
    expect(d3Response.headers.get("content-type")).toContain("javascript");
    expect(d3Source.length).toBeGreaterThan(1_000);
  } finally {
    await stopConfiguredDevelopmentServer(developmentServerProcess);
  }
}

describe("configured Vite development server", () => {
  test("serves the D3 ESM dependency graph at the root base", async () => {
    await expectServedD3EsmGraph();
  }, 45_000);

  test("serves the D3 ESM dependency graph beneath a non-root base", async () => {
    await expectServedD3EsmGraph({ basePath: "/webvowl/" });
  }, 45_000);
});
