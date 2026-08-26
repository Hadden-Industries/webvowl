const {
  installD3V3CollectionAdapter,
} = require("../test/d3V3CollectionAdapter");

const restoreD3 = installD3V3CollectionAdapter();
afterAll(restoreD3);

const createParser = require("./parser");

describe("Parser Inverse Property Type Matching Unit Tests", () => {
  let mockGraph;

  beforeEach(() => {
    mockGraph = {
      options: () => ({
        filterMenu: () => ({
          setCheckBoxValue: () => {},
          setDegreeSliderValue: () => {},
          updateSettings: () => {},
        }),
        modeMenu: () => ({
          setCheckBoxValue: () => {},
          setColorSwitchState: () => {},
          updateSettings: () => {},
        }),
        pausedMenu: () => ({ setPauseValue: () => {} }),
        gravityMenu: () => ({ reset: () => {} }),
        pickAndPinModule: () => ({ addPinnedElement: () => {} }),
        datatypeDistance: () => 120,
        classDistance: () => 200,
      }),
      setZoom: () => {},
      setTranslation: () => {},
      updateStyle: () => {},
    };
  });

  test("correctly pairs inverse properties by type (ObjectProperty vs someValuesFrom) when IRIs/labels overlap", () => {
    const ontologyData = {
      class: [
        { id: "1", type: "owl:Class" },
        { id: "2", type: "owl:Class" },
      ],
      classAttribute: [
        { id: "1", iri: "http://example.org/ClassA", label: { en: "ClassA" } },
        { id: "2", iri: "http://example.org/ClassB", label: { en: "ClassB" } },
      ],
      property: [
        { id: "70", type: "owl:ObjectProperty" },
        { id: "107", type: "owl:ObjectProperty" },
        { id: "169", type: "owl:someValuesFrom" },
        { id: "170", type: "owl:someValuesFrom" },
      ],
      propertyAttribute: [
        {
          id: "70",
          iri: "http://example.org/influences",
          domain: "1",
          range: "2",
          inverse: "170",
        },
        {
          id: "107",
          iri: "http://example.org/influencedBy",
          domain: "2",
          range: "1",
          inverse: "70",
        },
        {
          id: "169",
          iri: "http://example.org/influences",
          domain: "1",
          range: "2",
        },
        {
          id: "170",
          iri: "http://example.org/influencedBy",
          domain: "2",
          range: "1",
          inverse: "70",
        },
      ],
    };

    const parser = createParser(mockGraph);
    parser.parse(ontologyData);

    const properties = parser.properties();
    const p70 = properties.find((p) => p.id() === "70");
    const p107 = properties.find((p) => p.id() === "107");
    const p169 = properties.find((p) => p.id() === "169");
    const p170 = properties.find((p) => p.id() === "170");

    // ObjectProperty pair
    expect(p70.inverse()).toBe(p107);
    expect(p107.inverse()).toBe(p70);

    // someValuesFrom pair
    expect(p169.inverse()).toBe(p170);
    expect(p170.inverse()).toBe(p169);
  });
});
