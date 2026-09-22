import { describe, expect, test } from "@jest/globals";
import { createOntologyInspector } from "../controller/ontologyInspector.js";
import {
  createWebMcpToolDispatch,
  WEB_MCP_TOOL_RESULT_CHARACTER_CEILING,
} from "./webMcpToolContracts.js";

function fixture({ count = 30, iriLength = 40, neighborhood = 0 } = {}) {
  const state = {
    loadGeneration: 1,
    documentRevision: 1,
    view: { language: "en" },
  };
  const references = Array.from({ length: count }, (_, index) => ({
    kind: "class",
    iri: `urn:time:${String(index).padStart(2, "0")}:${"時".repeat(iriLength)}`,
  }));
  const records = references.map((ontologyElementReference) => ({
    ontologyElementReference,
    labelRecords: [{ languageTag: "en", text: "Time" }],
    superclassReferences: Array.from({ length: neighborhood }, (_, index) => ({
      kind: "class",
      iri: `urn:parent:${index}`,
    })),
    equivalentClassReferences: [],
    disjointClassReferences: [],
  }));
  const snapshot = {
    loadGeneration: 1,
    classRecords: records.flatMap((record) => [record, record]),
    datatypeRecords: [],
    propertyRecords: [],
    individualRecords: [],
  };
  const inspector = createOntologyInspector();
  const dispatch = createWebMcpToolDispatch({
    webVowlController: {
      getState: () => state,
      findOntologyElements: (request) =>
        inspector.findOntologyElements({
          ...request,
          ontologyInspectionSnapshot: snapshot,
          visibleRenderedGraphSnapshot: {
            loadGeneration: 1,
            visibleElementReferences: [],
            visibleRelationshipReferences: [],
          },
          language: state.view.language,
        }),
    },
  });
  const call = (input) =>
    dispatch.callWebMcpTool("find_ontology_elements", {
      query: "time",
      limit: 25,
      includeNeighborhood: false,
      ...input,
    });
  return { call, state, references };
}

describe("bounded semantic search traversal", () => {
  test("rejects an edit while the controller read is pending", async () => {
    const state = {
      loadGeneration: 1,
      documentRevision: 1,
      view: { language: "en" },
    };
    const dispatch = createWebMcpToolDispatch({
      webVowlController: {
        getState: () => state,
        findOntologyElements: async () => {
          state.documentRevision++;
          return { matches: [], totalMatchCount: 0, isTruncated: false };
        },
      },
    });
    expect(
      (
        await dispatch.callWebMcpTool("find_ontology_elements", {
          query: "time",
        })
      ).isSuccess,
    ).toBe(false);
  });

  test.each([0, 26, 1.5])("rejects invalid limit %i", async (limit) => {
    expect((await fixture().call({ limit })).isSuccess).toBe(false);
  });

  test("preserves upstream incompleteness on a terminal page", async () => {
    const dispatch = createWebMcpToolDispatch({
      webVowlController: {
        getState: () => ({
          loadGeneration: 1,
          documentRevision: 1,
          view: { language: "en" },
        }),
        findOntologyElements: () => ({
          matches: [],
          totalMatchCount: 0,
          isTruncated: true,
        }),
      },
    });
    expect(
      (
        await dispatch.callWebMcpTool("find_ontology_elements", {
          query: "time",
        })
      ).toolResult,
    ).toMatchObject({ hasMore: false, isTruncated: true });
  });
  test.each([1, 25])(
    "returns every unique identity exactly once with limit %i",
    async (limit) => {
      const { call, references } = fixture();
      let continuation;
      const found = [];
      for (let pageNumber = 0; pageNumber < 40; pageNumber++) {
        const response = await call({
          limit,
          ...(continuation ? { continuation } : {}),
        });
        expect(response.isSuccess).toBe(true);
        expect(JSON.stringify(response).length).toBeLessThanOrEqual(
          WEB_MCP_TOOL_RESULT_CHARACTER_CEILING,
        );
        const page = response.toolResult;
        expect(page.totalMatchCount).toBe(30);
        expect(page.matches.length).toBeGreaterThan(0);
        expect(page.matches.length).toBeLessThanOrEqual(limit);
        found.push(
          ...page.matches.map((match) => match.ontologyElementReference),
        );
        continuation = page.continuation;
        expect(page.hasMore).toBe(continuation !== null);
        if (continuation === null) {
          break;
        }
      }
      expect(continuation).toBeNull();
      expect(found).toEqual(references);
    },
  );

  test("returns an explicit empty terminal page", async () => {
    const result = await fixture({ count: 0 }).call();
    expect(result.toolResult).toMatchObject({
      matches: [],
      totalMatchCount: 0,
      continuation: null,
      hasMore: false,
    });
  });

  test("reports optional fact loss separately from complete traversal", async () => {
    const result = await fixture({ count: 1, neighborhood: 100 }).call({
      includeNeighborhood: true,
    });
    expect(result.isSuccess).toBe(true);
    expect(result.toolResult).toMatchObject({
      hasMore: false,
      continuation: null,
      optionalFactsTruncated: true,
      isTruncated: true,
    });
    expect(result.toolResult.matches).toHaveLength(1);
  });

  test("refuses an oversized identity instead of dropping it", async () => {
    const result = await fixture({ count: 1, iriLength: 2000 }).call();
    expect(result.isSuccess).toBe(false);
    expect(JSON.stringify(result)).toMatch(/identity|fit|budget/i);
  });

  test.each(["loadGeneration", "documentRevision", "language"])(
    "rejects a changed %s",
    async (field) => {
      const { call, state } = fixture();
      const first = await call();
      expect(typeof first.toolResult.continuation).toBe("string");
      if (field === "language") {
        state.view.language = "de";
      } else {
        state[field]++;
      }
      expect(
        (await call({ continuation: first.toolResult.continuation })).isSuccess,
      ).toBe(false);
    },
  );

  test.each([
    { query: "clock" },
    { kinds: ["class"] },
    { limit: 1 },
    { includeNeighborhood: true },
  ])("rejects changed search inputs %j", async (changed) => {
    const { call } = fixture();
    const first = await call();
    expect(
      (await call({ ...changed, continuation: first.toolResult.continuation }))
        .isSuccess,
    ).toBe(false);
  });

  test.each(["unknown", "", 7, {}, "x".repeat(129)])(
    "rejects malformed or unknown continuation %j",
    async (continuation) => {
      expect((await fixture().call({ continuation })).isSuccess).toBe(false);
    },
  );

  test("expires old continuation records with a bounded cache", async () => {
    const { call } = fixture();
    const first = await call();
    for (let index = 0; index < 9; index++) {
      await call();
    }
    expect(
      (await call({ continuation: first.toolResult.continuation })).isSuccess,
    ).toBe(false);
  });
});
