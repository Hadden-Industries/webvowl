import { expect, test } from "@jest/globals";
import { createWebMcpToolDispatch } from "./webMcpToolContracts.js";

function fixture() {
  const reference = { kind: "class", iri: "urn:Thing" };
  const state = {
    loadGeneration: 1,
    documentRevision: 1,
    view: { language: "en" },
  };
  let text = "A".repeat(2600);
  const description = () => ({
    ontologyElementReference: reference,
    annotationRecords: [{ propertyIri: "urn:definition", text }],
  });
  const dispatch = createWebMcpToolDispatch({
    webVowlController: {
      getState: () => state,
      describeOntologyElements: () => ({
        loadGeneration: state.loadGeneration,
        elementDescriptions: [description()],
      }),
    },
  });
  const call = (input = {}) =>
    dispatch.callWebMcpTool("get_ontology_element_details", {
      reference,
      ...input,
    });
  const next = (page) => ({
    offset: page.nextOffset,
    loadGeneration: page.loadGeneration,
    language: page.language,
    ...(page.continuation ? { continuation: page.continuation } : {}),
  });
  return {
    reference,
    state,
    description,
    call,
    next,
    edit(value) {
      text = value;
      state.documentRevision++;
    },
  };
}

test.each([2600, 2700, 2500])(
  "rejects revision replacement of length %i",
  async (length) => {
    const f = fixture();
    const first = await f.call();
    expect(first.isSuccess).toBe(true);
    f.edit("B".repeat(length));
    const next = await f.call(f.next(first.toolResult));
    expect(next.isSuccess).toBe(false);
    expect(next.error.message).toMatch(/restart/i);
  },
);

test("reconstructs one exact unchanged description", async () => {
  const f = fixture();
  let input = {};
  let text = "";
  do {
    const result = await f.call(input);
    expect(result.isSuccess).toBe(true);
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500);
    expect(result.toolResult.documentRevision).toBe(1);
    expect(result.toolResult.offset).toBe(text.length);
    text += result.toolResult.jsonFragment;
    input =
      result.toolResult.nextOffset === null ? null : f.next(result.toolResult);
  } while (input);
  expect(JSON.parse(text)).toEqual(f.description());
});

test.each([
  "reference",
  "language",
  "loadGeneration",
  "offset",
  "missing",
  "expired",
])("rejects %s continuation", async (change) => {
  const f = fixture();
  const first = await f.call();
  const input = f.next(first.toolResult);
  if (change === "reference") {
    input.reference = { kind: "class", iri: "urn:Other" };
  }
  if (change === "language") {
    f.state.view.language = "de";
  }
  if (change === "loadGeneration") {
    f.state.loadGeneration++;
  }
  if (change === "offset") {
    input.offset++;
  }
  if (change === "missing") {
    delete input.continuation;
  }
  if (change === "expired") {
    for (let i = 0; i < 8; i++) {
      await f.call();
    }
  }
  expect((await f.call(input)).isSuccess).toBe(false);
});

test("refuses state changes during the detail read", async () => {
  const f = fixture();
  const dispatch = createWebMcpToolDispatch({
    webVowlController: {
      getState: () => f.state,
      describeOntologyElements: async () => {
        f.state.documentRevision++;
        return { loadGeneration: 1, elementDescriptions: [f.description()] };
      },
    },
  });
  expect(
    (
      await dispatch.callWebMcpTool("get_ontology_element_details", {
        reference: f.reference,
      })
    ).isSuccess,
  ).toBe(false);
});
