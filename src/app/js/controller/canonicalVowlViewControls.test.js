import { beforeAll } from "@jest/globals";
import { openOwl } from "vowl/owl";
import { inspectModel, readModelRankingIdentity } from "vowl";
import { closeVowlVisibility } from "./canonicalVowlScene.js";
import {
  prepareCanonicalVisibility,
  CANONICAL_VISIBLE_FILTERS,
  canonicalLabelSelection,
  createCanonicalNodeSelector,
} from "./canonicalVowlViewControls.js";

let inspection;
let rankingIdentity;
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
  rankingIdentity = await readModelRankingIdentity(model);
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

test("language controls map explicit label choices to the portable scene", () => {
  expect(canonicalLabelSelection("IRI-based")).toEqual({ mode: "iri" });
  expect(canonicalLabelSelection("undefined")).toEqual({ mode: "untagged" });
  expect(canonicalLabelSelection("de")).toEqual({
    mode: "language",
    range: "de",
  });
});

test("obsolete degree options are rejected even beside valid filters", () => {
  expect(() =>
    prepareCanonicalVisibility(inspection, {
      ...CANONICAL_VISIBLE_FILTERS,
      minDegree: 0,
    }),
  ).toThrow("nodesShown");
});

test("count deltas preserve full incidence closure with labels, disjoint edges and upstream filtering", () => {
  const label = inspection.occurrences.find(({ kind }) => kind === "label");
  for (const filters of [
    CANONICAL_VISIBLE_FILTERS,
    { ...CANONICAL_VISIBLE_FILTERS, objectProperties: "hide" },
  ]) {
    const retained = [label.id];
    const upstream = prepareCanonicalVisibility(
      inspection,
      filters,
      retained,
    ).hidden;
    const select = createCanonicalNodeSelector(inspection, rankingIdentity);
    const all = select(filters, { mode: "all" }, retained);
    const count = all.rankedNodeOccurrenceIds.length;
    const sequence = [
      ...Array.from({ length: count + 1 }, (_, i) => i),
      ...Array.from({ length: count + 1 }, (_, i) => count - i),
      count,
      2,
      0,
    ];
    for (const requestedCount of sequence) {
      const actual = select(
        filters,
        { mode: "exact", requestedCount },
        retained,
      );
      const expected = closeVowlVisibility(inspection.occurrences, [
        ...upstream,
        ...all.rankedNodeOccurrenceIds.slice(Math.min(requestedCount, count)),
      ]);
      expect([...actual.hidden].sort()).toEqual([...expected].sort());
    }
  }
});
