import { describe, expect, test } from "@jest/globals";
import {
  createWebMcpToolDispatch,
  projectWebMcpToolSuccess,
} from "./webMcpToolContracts.js";

function fixture() {
  const state = {
    loadGeneration: 1,
    documentRevision: 1,
    view: { language: "en" },
  };
  const summary = {
    loadGeneration: 1,
    ontologyHeader: {
      ontologyIri: "urn:ontology",
      title: "Example",
      annotationRecords: Array.from({ length: 30 }, (_, i) => ({
        propertyIri: `urn:annotation:${i}`,
        text: '時😀\\"'.repeat(100),
      })),
    },
    elementCounts: { classCount: 7, propertyCount: 3 },
    imports: ["urn:import"],
    isTruncated: false,
  };
  const dispatch = createWebMcpToolDispatch({
    webVowlController: {
      getState: () => state,
      getOntologySummary: () => summary,
    },
  });
  return {
    state,
    summary,
    call: (input = {}) =>
      dispatch.callWebMcpTool("get_ontology_summary", input),
  };
}

describe("useful bounded ontology summary", () => {
  test.each([
    { section: "unknown" },
    { continuation: "x" },
    { section: "imports", continuation: "" },
    { section: "imports", continuation: 1 },
    { section: "imports", continuation: "x".repeat(129) },
  ])("rejects invalid section input %j", async (input) => {
    expect((await fixture().call(input)).isSuccess).toBe(false);
  });

  test("expires old tokens without retaining full summaries", async () => {
    const { call } = fixture();
    const first = await call({ section: "ontologyHeader" });
    for (let i = 0; i < 8; i++) {
      await call({ section: "ontologyHeader" });
    }
    const expired = await call({
      section: "ontologyHeader",
      continuation: first.toolResult.continuation,
    });
    expect(expired.isSuccess).toBe(false);
    expect(expired.error.message).toMatch(/expired/);
  });

  test("preserves upstream incompleteness on small summaries and section pages", async () => {
    const { call, summary } = fixture();
    summary.ontologyHeader = { ontologyIri: "urn:ontology" };
    summary.isTruncated = true;
    expect((await call()).toolResult.isTruncated).toBe(true);
    expect((await call({ section: "imports" })).toolResult.isTruncated).toBe(
      true,
    );
  });

  test("does not shorten a long identity that fits the core budget", async () => {
    const { call, summary } = fixture();
    summary.ontologyHeader.ontologyIri = `urn:${"時".repeat(900)}`;
    expect((await call()).toolResult.ontologyHeader.ontologyIri).toBe(
      summary.ontologyHeader.ontologyIri,
    );
  });

  test("refuses a revision change while reading", async () => {
    const { state, summary } = fixture();
    const dispatch = createWebMcpToolDispatch({
      webVowlController: {
        getState: () => state,
        getOntologySummary: async () => {
          state.documentRevision++;
          return summary;
        },
      },
    });
    expect(
      (await dispatch.callWebMcpTool("get_ontology_summary", {})).isSuccess,
    ).toBe(false);
  });

  test("preserves exact identity and counts under annotation pressure", () => {
    const { summary } = fixture();
    const result = projectWebMcpToolSuccess("get_ontology_summary", summary);
    expect(result.toolResult.ontologyHeader.ontologyIri).toBe("urn:ontology");
    expect(result.toolResult.elementCounts).toEqual({
      classCount: 7,
      propertyCount: 3,
    });
    expect(result.toolResult.availableSections).toContain("ontologyHeader");
    expect(result.toolResult.sectionsOmitted).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
  });

  test("reconstructs complete escaped Unicode optional sections", async () => {
    const { call, summary } = fixture();
    let continuation;
    let text = "";
    do {
      const result = await call({
        section: "ontologyHeader",
        ...(continuation ? { continuation } : {}),
      });
      expect(result.isSuccess).toBe(true);
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
      expect(result.toolResult.offset).toBe(text.length);
      expect(result.toolResult.jsonFragment.length).toBeGreaterThan(0);
      text += result.toolResult.jsonFragment;
      continuation = result.toolResult.continuation;
    } while (continuation);
    expect(JSON.parse(text)).toEqual(summary.ontologyHeader);
  });

  test.each([
    "documentRevision",
    "loadGeneration",
    "language",
    "content",
    "section",
  ])("rejects changed %s", async (change) => {
    const { call, state, summary } = fixture();
    const first = await call({ section: "ontologyHeader" });
    if (change === "language") {
      state.view.language = "de";
    } else if (change === "content") {
      summary.ontologyHeader.title = "Changed";
    } else if (change !== "section") {
      state[change]++;
    }
    const result = await call({
      section: change === "section" ? "imports" : "ontologyHeader",
      continuation: first.toolResult.continuation,
    });
    expect(result.isSuccess).toBe(false);
    expect(result.error.message).toMatch(/restart/i);
  });

  test("fails explicitly when the exact core identity cannot fit", async () => {
    const { call, summary } = fixture();
    summary.ontologyHeader.ontologyIri = `urn:${"x".repeat(2000)}`;
    const result = await call();
    expect(result.isSuccess).toBe(false);
    expect(result.error.message).toMatch(/identity|core/i);
  });
});
