import { readFileSync } from "node:fs";
import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";
import { createCanonicalVowlDocumentSession } from "./canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "./canonicalVowlWorkerOperations.js";
import {
  createOntologyInspector,
  boundOntologySearchResult,
  boundOntologyFocusResult,
} from "./ontologyInspector.js";
import { WEB_VOWL_OPERATION_LIMITS } from "./webVowlControllerContracts.js";
import { createCanonicalVowlSemanticReadModel } from "./canonicalVowlSemanticReadModel.js";

function visible(h) {
  return h.double.runtime.readVisibleRenderedGraphSnapshot();
}

test("hidden semantic roles remain ambiguous and expired anonymous references are refused", async () => {
  const h = await canonicalControllerHarness();
  try {
    const snapshot = h.session.readOntologyInspection();
    const exact = h.reference();
    const { roleKind, ...coarse } = exact;
    expect(roleKind).toBe("class");
    const readModel = createCanonicalVowlSemanticReadModel({
      ontologyInspection: Object.freeze({
        ...snapshot,
        classRecords: Object.freeze([
          ...snapshot.classRecords,
          Object.freeze({
            ...snapshot.classRecords[0],
            ontologyElementReference: Object.freeze({
              ...exact,
              roleKind: "rdf-class",
            }),
          }),
        ]),
      }),
    });
    const request = {
      ontologyElementReferences: [coarse],
      visibleRenderedGraphSnapshot: visible(h),
    };
    for (const read of [readModel.describe, readModel.resolveFocusable]) {
      expect(() => read(request)).toThrow(
        expect.objectContaining({ code: "ELEMENT_AMBIGUOUS" }),
      );
    }
    expect(
      readModel.resolveFocusable({
        ...request,
        ontologyElementReferences: [exact],
      }).focusableReferences,
    ).toEqual([exact]);
    await h.controller.loadOntology({
      source: {
        kind: "ontology-text",
        documentIri: "urn:anonymous",
        format: "functional",
        text: "Ontology(<urn:anonymous> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(ObjectProperty(<urn:p>)) SubClassOf(<urn:A> ObjectSomeValuesFrom(<urn:p> <urn:B>)))",
      },
    });
    const anonymous = h.session
      .readOntologyInspection()
      .classRecords.find(
        ({ ontologyElementReference }) =>
          ontologyElementReference.localId !== undefined,
      ).ontologyElementReference;
    const old = h.session.readModel();
    const oldRequest = {
      ontologyElementReferences: [anonymous],
      visibleRenderedGraphSnapshot: visible(h),
    };
    expect(old.describe(oldRequest).elementDescriptions).toHaveLength(1);
    await h.load();
    const next = {
      ontologyElementReferences: [anonymous],
      visibleRenderedGraphSnapshot: visible(h),
    };
    expect(() => h.session.readModel().describe(next)).toThrow();
    expect(() => h.session.readModel().resolveFocusable(next)).toThrow();
    expect(() => h.session.readModel().planNeighborhood([anonymous])).toThrow();
    expect(old.describe(oldRequest).elementDescriptions).toHaveLength(1);
  } finally {
    h.controller.dispose();
  }
});

test("accepted presentation replaces the model; visibility, focus and camera retain semantic preparation", async () => {
  const h = await canonicalControllerHarness();
  try {
    const model = h.session.readModel();
    expect(Object.isFrozen(model)).toBe(true);
    const reference = h.reference();
    const request = {
      ontologyElementReferences: [reference],
      visibleRenderedGraphSnapshot: visible(h),
    };
    const original = model.describe(request);
    expect(original.elementDescriptions[0].displayLabel).toBe("A");
    expect(model.resolveFocusable(request).focusableReferences).toEqual([
      reference,
    ]);
    expect(model.planNeighborhood([reference])).toMatchObject({
      canReveal: true,
      counts: { nodes: 2, edges: 1 },
    });
    await h.controller.setVisualizationView({
      focus: [reference],
      translation: { xPx: 12, yPx: 34 },
    });
    expect(h.session.readModel()).toBe(model);
    await h.controller.setVisualizationView({
      nodesShown: { mode: "exact", requestedCount: 0 },
    });
    expect(h.session.readModel()).toBe(model);
    expect(
      model.resolveFocusable({
        ...request,
        visibleRenderedGraphSnapshot: visible(h),
      }),
    ).toMatchObject({
      focusableReferences: [],
      unresolvedReferences: [reference],
    });
    expect(h.controller.getOntologyElementRevealPlan([reference])).toEqual({
      canReveal: true,
      requestedCount: expect.any(Number),
    });
    const rank = h.controller.getOntologyElementRevealPlan([
      reference,
    ]).requestedCount;
    expect(rank).toBeGreaterThan(0);
    await h.controller.setVisualizationView({ nodesShown: { mode: "all" } });
    expect(
      h.controller.getOntologyElementRevealPlan([reference]).requestedCount,
    ).toBe(2);
    expect(h.session.readModel()).toBe(model);
    h.session.setPrefix({ name: "local", iri: "urn:" });
    const prefixed = h.session.readModel();
    expect(prefixed).not.toBe(model);
    expect(prefixed.describe(request).elementDescriptions[0].displayLabel).toBe(
      "local:A",
    );
    expect(model.describe(request)).toEqual(original);
    expect(original.elementDescriptions[0].displayLabel).toBe("A");
    await h.controller.setVisualizationView({ language: "de" });
    expect(h.session.readModel()).not.toBe(prefixed);
    expect(model.describe(request)).toEqual(original);
  } finally {
    h.controller.dispose();
  }
  expect(() => h.session.readModel()).toThrow(
    expect.objectContaining({ code: "DOCUMENT_SESSION_DISPOSED" }),
  );
});

test("failed presentation and edit preserve the accepted model; successful edit retires it", async () => {
  const h = await canonicalControllerHarness();
  try {
    const model = h.session.readModel();
    const request = {
      query: "urn:A",
      visibleRenderedGraphSnapshot: visible(h),
    };
    const before = model.find(request);
    expect(before.matches.map(({ iri }) => iri)).toEqual(["urn:A"]);
    h.double.failNextMutation(new Error("reject presentation"));
    await expect(
      h.controller.setVisualizationView({ language: "de" }),
    ).rejects.toThrow("reject presentation");
    expect(h.session.readModel()).toBe(model);
    h.double.failNextMutation(new Error("reject edit"));
    await expect(h.edit()).rejects.toThrow("reject edit");
    expect(h.session.readModel()).toBe(model);
    expect(model.find(request)).toEqual(before);
    await h.edit();
    const successor = h.session.readModel();
    expect(successor).not.toBe(model);
    expect(
      successor.find({ ...request, visibleRenderedGraphSnapshot: visible(h) })
        .matches,
    ).toEqual([]);
    expect(model.find(request)).toEqual(before);
    expect(
      successor.find({
        query: "urn:Renamed",
        visibleRenderedGraphSnapshot: visible(h),
      }).matches,
    ).toHaveLength(1);
  } finally {
    h.controller.dispose();
  }
});

test("presentation changes during a pending worker edit survive without retargeting earlier models", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("edit-model");
  try {
    const initial = h.session.readModel();
    const request = {
      ontologyElementReferences: [h.reference()],
      visibleRenderedGraphSnapshot: visible(h),
    };
    const edit = h.edit();
    await gate.started.promise;
    await h.controller.setVisualizationView({ language: "de" });
    h.session.setPrefix({ name: "local", iri: "urn:" });
    const presentation = h.session.readModel();
    expect(presentation).not.toBe(initial);
    expect(
      presentation.describe(request).elementDescriptions[0].displayLabel,
    ).toBe("local:A");
    gate.resolve();
    await edit;
    const successor = h.session.readModel();
    expect(successor).not.toBe(presentation);
    expect(
      successor.find({
        query: "Renamed",
        visibleRenderedGraphSnapshot: visible(h),
      }).matches[0].displayLabel,
    ).toBe("local:Renamed");
    expect(
      h.session.readOntologyInspection().classRecords[0].canonicalDisplay
        .selection,
    ).toEqual({ mode: "language", range: "de" });
    expect(initial.describe(request).elementDescriptions[0].displayLabel).toBe(
      "A",
    );
    expect(
      presentation.describe(request).elementDescriptions[0].displayLabel,
    ).toBe("local:A");
  } finally {
    gate.resolve();
    h.controller.dispose();
  }
});

test("a superseded worker edit cannot replace the next load's model", async () => {
  const h = await canonicalControllerHarness();
  const gate = h.deferWorker("edit-model");
  try {
    const old = h.session.readModel();
    const oldVisible = visible(h);
    const outcome = h.edit().catch((error) => error);
    await gate.started.promise;
    await h.load("urn:replacement");
    const current = h.session.readModel();
    expect(current).not.toBe(old);
    gate.resolve();
    expect(await outcome).toMatchObject({ code: "EDIT_REJECTED" });
    expect(h.session.readModel()).toBe(current);
    expect(() =>
      current.find({ query: "A", visibleRenderedGraphSnapshot: oldVisible }),
    ).toThrow("share one load generation");
    expect(
      current.find({
        query: "Renamed",
        visibleRenderedGraphSnapshot: visible(h),
      }).matches,
    ).toEqual([]);
    expect(
      old.find({ query: "urn:A", visibleRenderedGraphSnapshot: oldVisible })
        .matches,
    ).toHaveLength(1);
  } finally {
    gate.resolve();
    h.controller.dispose();
  }
});

test("internal reads remain complete while public search and focus preserve their bounds", async () => {
  const h = await canonicalControllerHarness();
  try {
    const count = WEB_VOWL_OPERATION_LIMITS.maxFocusReferences + 6;
    const longLabel = "Z".repeat(
      WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters + 20,
    );
    await h.controller.loadOntology({
      source: {
        kind: "ontology-text",
        documentIri: "urn:complete",
        format: "functional",
        text: `Ontology(<urn:complete>
      ${Array.from({ length: count }, (_, i) => `Declaration(Class(<urn:C${i}>))`).join("\n")}
      EquivalentClasses(${Array.from({ length: count }, (_, i) => `<urn:C${i}>`).join(" ")})
      AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <urn:C0> "${longLabel}"@en))`,
      },
    });
    const model = h.session.readModel();
    const request = {
      query: "urn:C",
      limit: 1,
      includeNeighborhood: true,
      language: "en",
      visibleRenderedGraphSnapshot: visible(h),
    };
    const complete = model.find(request);
    expect(complete.matches).toHaveLength(count);
    expect(complete.isTruncated).toBe(false);
    const first = complete.matches.find(({ iri }) => iri === "urn:C0");
    expect(first.displayLabel).toBe(longLabel);
    expect(first.neighborhoodFacts.equivalentClassReferences).toHaveLength(
      count - 1,
    );
    const bounded = h.controller.findOntologyElements(request);
    expect(bounded.matches).toHaveLength(1);
    expect(bounded.totalMatchCount).toBe(count);
    expect(bounded.isTruncated).toBe(true);
    expect(bounded.optionalFactsTruncated).toBe(true);
    expect(
      bounded.matches[0].neighborhoodFacts.equivalentClassReferences,
    ).toHaveLength(25);
    const refs = complete.matches.map(
      ({ ontologyElementReference }) => ontologyElementReference,
    );
    const resolved = model.resolveFocusable({
      ontologyElementReferences: refs,
      visibleRenderedGraphSnapshot: visible(h),
    });
    expect(resolved.focusableReferences).toHaveLength(count);
    expect(resolved.isTruncated).toBe(false);
    expect(boundOntologyFocusResult(resolved)).toMatchObject({
      focusableReferences: expect.any(Array),
      isTruncated: true,
    });
    expect(boundOntologyFocusResult(resolved).focusableReferences).toHaveLength(
      25,
    );
    first.ontologyElementReference.iri = "urn:corrupt";
    first.neighborhoodFacts.equivalentClassReferences[0].iri = "urn:corrupt";
    expect(
      model.find(request).matches.some(({ iri }) => iri === "urn:corrupt"),
    ).toBe(false);
    expect(
      model
        .find(request)
        .matches[0].neighborhoodFacts.equivalentClassReferences.some(
          ({ iri }) => iri === "urn:corrupt",
        ),
    ).toBe(false);
  } finally {
    h.controller.dispose();
  }
});

test.each(["foaf", "goodrelations", "benchmark"])(
  "prepared queries preserve direct inspection on the shipped %s corpus",
  async (name) => {
    const session = createCanonicalVowlDocumentSession({
      workerClient: {
        async run(request, context) {
          return {
            ...(await runCanonicalVowlOperation(request, undefined, context)),
            loadGeneration: context.loadGeneration,
            baseRevision: context.baseRevision,
          };
        },
        dispose() {},
      },
    });
    try {
      await session.load({
        operation: "open-canonical-model",
        bytes: new Uint8Array(
          readFileSync(
            new URL(
              `../../../canonical-examples/${name}.json`,
              import.meta.url,
            ),
          ),
        ),
      });
      const snapshot = session.readOntologyInspection();
      const references = [
        snapshot.classRecords,
        snapshot.propertyRecords,
        snapshot.datatypeRecords,
        snapshot.individualRecords,
      ].flatMap((rows) =>
        rows.map(({ ontologyElementReference }) => ontologyElementReference),
      );
      expect(references.length).toBeGreaterThan(20);
      const model = session.readModel();
      const inspector = createOntologyInspector();
      for (const visibleReferences of [
        references,
        references.filter((_, i) => i % 2),
        [],
      ]) {
        const visibleRenderedGraphSnapshot = {
          loadGeneration: snapshot.loadGeneration,
          visibleElementReferences: visibleReferences,
          visibleRelationshipReferences: [],
        };
        for (const language of [null, "en", "de"]) {
          const request = {
            ontologyElementReferences: references,
            visibleRenderedGraphSnapshot,
            language,
          };
          expect(model.describe(request)).toEqual(
            inspector.describeOntologyElements({
              ...request,
              ontologyInspectionSnapshot: snapshot,
            }),
          );
          expect(
            boundOntologyFocusResult(model.resolveFocusable(request)),
          ).toEqual(
            inspector.resolveFocusableOntologyElementReferences({
              ...request,
              ontologyInspectionSnapshot: snapshot,
            }),
          );
          for (const query of ["a", "http", "Thing", "missing"]) {
            const search = {
              ...request,
              query,
              limit: 7,
              offset: 2,
              includeNeighborhood: true,
            };
            expect(
              boundOntologySearchResult(model.find(search), search),
            ).toEqual(
              inspector.findOntologyElements({
                ...search,
                ontologyInspectionSnapshot: snapshot,
              }),
            );
          }
        }
      }
    } finally {
      session.dispose();
    }
  },
);
