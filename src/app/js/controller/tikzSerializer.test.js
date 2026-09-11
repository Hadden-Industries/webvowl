import { beforeAll, describe, expect, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let serializeRenderedDrawingAsTikz;
let createRenderedDrawingSnapshot;
beforeAll(async () => {
  ({ createRenderedDrawingSnapshot } = await loadEsmModuleForTest(
    new URL("./renderedDrawingSnapshot.js", import.meta.url),
    import.meta.url,
  ));
  ({ serializeRenderedDrawingAsTikz } = await loadEsmModuleForTest(
    new URL("./tikzSerializer.js", import.meta.url),
    import.meta.url,
  ));
});

function drawing() {
  const appearance = {
    attributes: [],
    textColor: "",
    textLines: [],
    widthPx: 80,
    backgroundColor: "#AACCFF",
  };
  return {
    loadGeneration: 1,
    bounds: { leftPx: 0, topPx: 0, rightPx: 300, bottomPx: 200 },
    compactNotation: false,
    nodes: [
      {
        ...appearance,
        x: 10,
        y: 20,
        label: "Person",
        vowlType: "owl:Class",
        widthPx: 100,
        individualCount: 0,
      },
      {
        ...appearance,
        x: 90,
        y: 80,
        label: "String",
        vowlType: "rdfs:Datatype",
        backgroundColor: "#FFCC33",
        individualCount: 0,
      },
    ],
    propertyLabels: [
      {
        ...appearance,
        x: 50,
        y: 50,
        label: "name",
        vowlType: "owl:DatatypeProperty",
        backgroundColor: "#99CC66",
        inverse: null,
      },
    ],
    links: [
      {
        vowlType: "owl:DatatypeProperty",
        linkType: "dashed",
        isSingle: true,
        isLoop: false,
        points: [
          { x: 10, y: 20 },
          { x: 50, y: 50 },
          { x: 90, y: 80 },
        ],
        marker: null,
        inverseMarker: null,
        cardinalityText: "",
      },
    ],
  };
}

describe("TikZ drawing serialization", () => {
  test("preserves the established class, datatype, link and property output", () => {
    const snapshot = drawing();
    const before = JSON.stringify(snapshot);
    const text = serializeRenderedDrawingAsTikz(snapshot);
    expect(text).toContain("\\clip (0pt , -200pt ) rectangle (300pt , 0pt);");
    expect(text).toContain(
      "\\draw [black, dashed ,line width=2pt] plot [smooth] coordinates {(10pt, -20pt) (50pt, -50pt)  (90pt, -80pt)};",
    );
    expect(text).toContain(
      "\\node[owlClass ,minimum size=100pt , fill=Node1_COLOR  ] at (10pt, -20pt)   (Node1) {Person};",
    );
    expect(text).toContain(
      "\\node[Datatype ,minimum width=80pt , fill=Node2_COLOR  ] at (90pt, -80pt)   (Node2) {String};",
    );
    expect(text).toContain(
      "\\node[owlDatatypeProperty ,minimum width=80pt , fill=property0_COLOR  ] at (50pt, -50pt)   (property0) {name};",
    );
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  test("detaches and freezes renderer measurements", () => {
    const source = drawing();
    const snapshot = createRenderedDrawingSnapshot(source);
    source.nodes[0].x = 999;
    expect(snapshot.nodes[0].x).toBe(10);
    expect(Object.isFrozen(snapshot.nodes[0])).toBe(true);
    expect(() =>
      createRenderedDrawingSnapshot({ ...source, loadGeneration: 0 }),
    ).toThrow();
    source.links[0].points[0].x = NaN;
    expect(() => createRenderedDrawingSnapshot(source)).toThrow(/finite/u);
  });

  test("treats ontology labels, including special TeX characters, as text", () => {
    const snapshot = drawing();
    snapshot.nodes[0].textLines = ["A & B_%\\input{secret}", "$ # ~ ^"];
    const text = serializeRenderedDrawingAsTikz(snapshot);
    expect(text).toContain("A \\& B\\_\\%\\textbackslash{}input\\{secret\\}");
    expect(text).toContain("\\$ \\# \\textasciitilde{} \\textasciicircum{}");
    expect(text).not.toContain("\\input{secret}");
  });

  test.each([
    "owl:unionOf",
    "owl:disjointUnionOf",
    "owl:complementOf",
    "owl:intersectionOf",
  ])("draws one class boundary and label for %s", (vowlType) => {
    const snapshot = drawing();
    snapshot.nodes[0].vowlType = vowlType;
    const text = serializeRenderedDrawingAsTikz(snapshot);
    expect(text.match(/\(Node1\)/gu)).toHaveLength(1);
    expect(text.match(/\{Person\}/gu)).toHaveLength(1);
  });

  test("emits finite arrow and cardinality geometry for a zero-length path", () => {
    const snapshot = drawing();
    snapshot.links[0].marker = {
      start: { x: 10, y: 20 },
      end: { x: 10, y: 20 },
      center: { x: 10, y: 20 },
      cardinalityCenter: { x: 10, y: 20 },
    };
    snapshot.links[0].cardinalityText = "1";
    const text = serializeRenderedDrawingAsTikz(snapshot);
    expect(text).not.toMatch(/NaN|Infinity/u);
    expect(text).toContain("(cardinalityText0) {1}");
  });

  test("rejects a malformed color instead of interpolating it into TeX", () => {
    const snapshot = drawing();
    snapshot.nodes[0].backgroundColor = "#FFFFFF}\\input{secret}";
    expect(() => serializeRenderedDrawingAsTikz(snapshot)).toThrow(/color/u);
  });
});
