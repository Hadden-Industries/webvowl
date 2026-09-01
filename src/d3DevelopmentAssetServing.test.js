import { readFileSync } from "node:fs";

import { describe, expect, test } from "@jest/globals";

import createViteConfiguration from "../vite.config.mjs";

const D3_DISTRIBUTION_FILE_URL = new URL(
  "../node_modules/d3/dist/d3.min.js",
  import.meta.url,
);

function getD3DistributionPlugin() {
  const viteConfiguration = createViteConfiguration({
    command: "serve",
    isPreview: false,
    isSsrBuild: false,
    mode: "development",
  });

  return viteConfiguration.plugins.find(
    (plugin) => plugin.name === "d3-distribution",
  );
}

function registerDevelopmentServerMiddleware(d3DistributionPlugin) {
  const registeredMiddleware = [];

  d3DistributionPlugin.configureServer({
    config: {
      base: "/",
      server: {
        headers: {
          "X-WebVOWL-Test": "configured-development-header",
        },
      },
    },
    middlewares: {
      use(middleware) {
        registeredMiddleware.push(middleware);
      },
    },
  });

  return registeredMiddleware[0];
}

function createRecordedHttpResponse() {
  const headers = new Map();
  let responseBody;

  return {
    end(body) {
      responseBody = body;
    },
    get body() {
      return responseBody;
    },
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    statusCode: undefined,
    writableEnded: false,
  };
}

describe("D3 development asset serving", () => {
  test("serves the exact external D3 distribution at its browser asset path", () => {
    const d3DistributionPlugin = getD3DistributionPlugin();

    expect(d3DistributionPlugin.configureServer).toEqual(expect.any(Function));

    const serveDevelopmentAsset =
      registerDevelopmentServerMiddleware(d3DistributionPlugin);
    const response = createRecordedHttpResponse();
    let nextCallCount = 0;

    serveDevelopmentAsset(
      { headers: {}, method: "GET", url: "/js/d3.min.js" },
      response,
      () => {
        nextCallCount += 1;
      },
    );

    const expectedD3DistributionBytes = readFileSync(D3_DISTRIBUTION_FILE_URL);

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("etag")).toEqual(
      expect.stringMatching(/^W\//u),
    );
    expect(response.headers.get("x-webvowl-test")).toBe(
      "configured-development-header",
    );
    expect(response.headers.get("content-length")).toBe(
      expectedD3DistributionBytes.byteLength,
    );
    expect(response.body).toEqual(expectedD3DistributionBytes);
    expect(nextCallCount).toBe(0);
  });

  test("answers HEAD requests without transferring the D3 response body", () => {
    const d3DistributionPlugin = getD3DistributionPlugin();
    const serveDevelopmentAsset =
      registerDevelopmentServerMiddleware(d3DistributionPlugin);
    const response = createRecordedHttpResponse();
    let nextCallCount = 0;

    serveDevelopmentAsset(
      { headers: {}, method: "HEAD", url: "/js/d3.min.js" },
      response,
      () => {
        nextCallCount += 1;
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("content-length")).toBe(
      readFileSync(D3_DISTRIBUTION_FILE_URL).byteLength,
    );
    expect(response.body).toBeUndefined();
    expect(nextCallCount).toBe(0);
  });

  test("delegates non-retrieval requests for the D3 browser asset", () => {
    const d3DistributionPlugin = getD3DistributionPlugin();
    const serveDevelopmentAsset =
      registerDevelopmentServerMiddleware(d3DistributionPlugin);
    const response = createRecordedHttpResponse();
    let nextCallCount = 0;

    serveDevelopmentAsset(
      { headers: {}, method: "POST", url: "/js/d3.min.js" },
      response,
      () => {
        nextCallCount += 1;
      },
    );

    expect(nextCallCount).toBe(1);
    expect(response.body).toBeUndefined();
  });

  test("delegates requests outside the D3 browser asset path", () => {
    const d3DistributionPlugin = getD3DistributionPlugin();

    expect(d3DistributionPlugin.configureServer).toEqual(expect.any(Function));

    const serveDevelopmentAsset =
      registerDevelopmentServerMiddleware(d3DistributionPlugin);
    const response = createRecordedHttpResponse();
    let nextCallCount = 0;

    serveDevelopmentAsset(
      { headers: {}, method: "GET", url: "/main.js" },
      response,
      () => {
        nextCallCount += 1;
      },
    );

    expect(nextCallCount).toBe(1);
    expect(response.body).toBeUndefined();
  });
});
