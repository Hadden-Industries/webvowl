import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let resolveFetchUrl;

beforeAll(async () => {
  const moduleUrl = new URL("./resolveFetchUrl.js", import.meta.url);
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected fetch-URL dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  ({ resolveFetchUrl } = sourceModule.namespace);
});

describe("fetch URL resolution", () => {
  test("upgrades an absolute HTTP resource under an HTTPS application", () => {
    expect(
      resolveFetchUrl("http://example.test/ontology.json", {
        protocol: "https:",
      }),
    ).toBe("https://example.test/ontology.json");
  });

  test.each([
    ["relative/ontology.json", { protocol: "https:" }],
    ["http://example.test/ontology.json", { protocol: "http:" }],
  ])("preserves the non-mixed-content resource %s", (resourceUrl, baseUrl) => {
    expect(resolveFetchUrl(resourceUrl, baseUrl)).toBe(resourceUrl);
  });
});
