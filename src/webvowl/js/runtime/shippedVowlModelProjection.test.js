import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

// The adapter's unit tests drive it with a hand-written VOWL model. A fixture
// written to match the code cannot show that the code matches real data, so
// this exercises the projection against an ontology the application ships.
const SHIPPED_VOWL_MODEL = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../app/data/foaf.json", import.meta.url)),
    "utf8",
  ),
);

let createD3RenderedGraphAdapter;

beforeAll(async () => {
  ({ createD3RenderedGraphAdapter } = await loadEsmModuleForTest(
    new URL("./d3RenderedGraphAdapter.js", import.meta.url),
    import.meta.url,
  ));
});

function createRendererStandIn(graphContainerElement) {
  return {
    options: () => ({ data() {} }),
    start() {
      graphContainerElement.replaceChildren();
    },
    load() {},
    paused() {},
    setRenderedGraphEventPort() {},
  };
}

describe("projection of a shipped VOWL model", () => {
  test("recovers identity and labels the model keeps in its attribute lists", async () => {
    const graphContainerElement = {
      children: [],
      replaceChildren(...nextChildren) {
        this.children = nextChildren;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    const { renderedGraphRuntime } = createD3RenderedGraphAdapter({
      d3: {
        forceSimulation: () => ({
          nodes: () => undefined,
          on: () => undefined,
          alpha: () => ({ restart: () => undefined }),
          stop: () => undefined,
          restart: () => undefined,
        }),
      },
      renderedGraphInternals: createRendererStandIn(graphContainerElement),
      graphContainerElement,
      observeNextPaint: () => Promise.resolve(),
      renderedGraphConfiguration: undefined,
    });

    await renderedGraphRuntime.replaceVowlModel({
      displayName: "foaf.json",
      loadGeneration: 1,
      vowlModel: SHIPPED_VOWL_MODEL,
    });
    const snapshot = renderedGraphRuntime.readOntologyInspectionSnapshot();

    // The expectation comes from the shipped model itself rather than a
    // number chosen to match the code.
    const expectedClassIriCount = SHIPPED_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) => typeof attributeRecord.iri === "string",
    ).length;
    const expectedLabelledClassCount = SHIPPED_VOWL_MODEL.classAttribute.filter(
      (attributeRecord) =>
        attributeRecord.label !== undefined &&
        Object.keys(attributeRecord.label).length > 0,
    ).length;
    const expectedLabelledPropertyCount =
      SHIPPED_VOWL_MODEL.propertyAttribute.filter(
        (attributeRecord) =>
          attributeRecord.label !== undefined &&
          Object.keys(attributeRecord.label).length > 0,
      ).length;

    expect(snapshot.classRecords.length).toBe(SHIPPED_VOWL_MODEL.class.length);
    expect(
      snapshot.classRecords.filter(
        (classRecord) =>
          typeof classRecord.ontologyElementReference.iri === "string",
      ).length,
    ).toBe(expectedClassIriCount);
    expect(
      snapshot.classRecords.filter(
        (classRecord) => classRecord.labelRecords.length > 0,
      ).length,
    ).toBe(expectedLabelledClassCount);
    expect(
      snapshot.propertyRecords.filter(
        (propertyRecord) => propertyRecord.labelRecords.length > 0,
      ).length,
    ).toBe(expectedLabelledPropertyCount);
  });
});
