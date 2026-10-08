import { beforeAll } from "@jest/globals";
import { openOwl } from "vowl/owl";
import { inspectModel } from "vowl";
import {
  prepareCanonicalVisibility,
  CANONICAL_VISIBLE_FILTERS,
  canonicalLabelSelection,
  findCanonicalAutomaticMinimumDegree,
} from "./canonicalVowlViewControls.js";

let inspection;
beforeAll(async () => {
  const { model } = await openOwl(
    new TextEncoder().encode(`Ontology(<urn:view>
    Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(Class(<urn:Isolated>))
    Declaration(ObjectProperty(<urn:p>)) Declaration(DataProperty(<urn:data>))
    ObjectPropertyDomain(<urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>)
    DataPropertyDomain(<urn:data> <urn:A>) DataPropertyRange(<urn:data> <http://www.w3.org/2001/XMLSchema#string>)
    SubClassOf(<urn:A> <urn:B>) DisjointClasses(<urn:A> <urn:B>)
    SubClassOf(<urn:B> ObjectUnionOf(<urn:A> <urn:Isolated>))
  )`),
    { documentIri: "urn:view", mediaType: "text/owl-functional" },
  );
  inspection = inspectModel(model);
});

test.each([
  ["datatypes", "datatype-node"],
  ["subclasses", "subclass-edge"],
  ["disjointness", "disjoint-edge"],
])(
  "%s hides its exact occurrences and closes incident edges and labels",
  (filter, kind) => {
    const { hidden } = prepareCanonicalVisibility(inspection, {
      ...CANONICAL_VISIBLE_FILTERS,
      [filter]: "hide",
    });
    const targets = inspection.occurrences.filter(
      (occurrence) => occurrence.kind === kind,
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every(({ id }) => hidden.includes(id))).toBe(true);
    for (const occurrence of inspection.occurrences) {
      const dependencies =
        occurrence.kind === "label"
          ? [occurrence.edge]
          : (occurrence.ends ?? [occurrence.from, occurrence.to]);
      if (dependencies.some((id) => hidden.includes(id))) {
        expect(hidden).toContain(occurrence.id);
      }
    }
  },
);

test("show controls preserve explicitly saved hidden occurrences", () => {
  const node = inspection.occurrences.find(({ kind }) => kind === "class-node");
  const { hidden } = prepareCanonicalVisibility(
    inspection,
    CANONICAL_VISIBLE_FILTERS,
    [node.id],
  );
  expect(hidden).toContain(node.id);
  expect(
    prepareCanonicalVisibility(inspection, CANONICAL_VISIBLE_FILTERS).hidden,
  ).toEqual([]);
});

test("degree filtering does not silently reveal everything when the requested degree excludes all classes", () => {
  const { maximumDegree } = prepareCanonicalVisibility(
    inspection,
    CANONICAL_VISIBLE_FILTERS,
  );
  const { hidden } = prepareCanonicalVisibility(inspection, {
    ...CANONICAL_VISIBLE_FILTERS,
    minDegree: maximumDegree + 1,
  });
  expect(
    inspection.occurrences
      .filter(({ kind }) => kind === "class-node")
      .every(({ id }) => hidden.includes(id)),
  ).toBe(true);
});

test("language controls map explicit label choices to the portable scene", () => {
  expect(canonicalLabelSelection("IRI-based")).toEqual({ mode: "iri" });
  expect(canonicalLabelSelection("undefined")).toEqual({ mode: "untagged" });
  expect(canonicalLabelSelection("de")).toEqual({
    mode: "language",
    range: "de",
  });
});

test("automatic degree retains the 50-node boundary, exclusive maximum and zero fallback", () => {
  function graph(size, kind) {
    const nodes = Array.from({ length: size }, (_, i) => ({
      id: `n${i}`,
      kind: "class-node",
      targets: [],
    }));
    const edges = nodes.slice(1).map((node, i) => ({
      id: `e${i}`,
      kind: "subclass-edge",
      from: node.id,
      to: kind === "star" ? "n0" : nodes[i].id,
    }));
    if (kind === "ring") {
      edges.push({
        id: "closing",
        kind: "subclass-edge",
        from: "n0",
        to: nodes.at(-1).id,
      });
    }
    return {
      occurrences: [...nodes, ...edges],
      records: { roles: [], expressions: [], constructs: [] },
    };
  }
  expect(
    findCanonicalAutomaticMinimumDegree(
      graph(50, "star"),
      CANONICAL_VISIBLE_FILTERS,
    ),
  ).toBe(0);
  expect(
    findCanonicalAutomaticMinimumDegree(
      graph(51, "star"),
      CANONICAL_VISIBLE_FILTERS,
    ),
  ).toBe(2);
  expect(
    findCanonicalAutomaticMinimumDegree(
      graph(51, "ring"),
      CANONICAL_VISIBLE_FILTERS,
    ),
  ).toBe(0);
  const isolated = graph(51, "star");
  isolated.occurrences = isolated.occurrences.filter(
    ({ kind }) => kind === "class-node",
  );
  expect(
    findCanonicalAutomaticMinimumDegree(isolated, CANONICAL_VISIBLE_FILTERS),
  ).toBe(0);
});

test("positive degree excludes datatype links and datatype nodes, and zero restores them", () => {
  const datatypes = inspection.occurrences.filter(
    ({ kind }) => kind === "datatype-node",
  );
  expect(datatypes.length).toBeGreaterThan(0);
  const positive = prepareCanonicalVisibility(inspection, {
    ...CANONICAL_VISIBLE_FILTERS,
    minDegree: 1,
  });
  expect(datatypes.every(({ id }) => positive.hidden.includes(id))).toBe(true);
  expect(
    prepareCanonicalVisibility(inspection, CANONICAL_VISIBLE_FILTERS).hidden,
  ).toEqual([]);
});
