import { jest } from "@jest/globals";
import { canonicalControllerHarness } from "../../test/canonicalControllerHarness.js";

function inspectionCopyCount(clone) {
  return clone.mock.calls.filter(
    ([value]) =>
      (value?.classRecords && value?.propertyRecords) ||
      (value?.records && value?.occurrences),
  ).length;
}

test.each([
  "summary",
  "description",
  "focus",
  "focus application",
  "arrangement",
])(
  "%s preserves the two-class result without copying the whole inspection",
  async (operation) => {
    const h = await canonicalControllerHarness();
    const reference = h.reference();
    await h.controller.setVisualizationView({ focus: [reference] });
    const clone = jest.spyOn(globalThis, "structuredClone");
    try {
      // Positive control: the external owned-copy API must remain observable.
      const owned = h.session.inspectOntology();
      expect(owned.classRecords).toHaveLength(2);
      expect(inspectionCopyCount(clone)).toBe(1);
      clone.mockClear();

      if (operation === "summary") {
        expect(h.controller.getOntologySummary()).toMatchObject({
          ontologyHeader: { ontologyIri: "urn:lifecycle" },
          elementCounts: { classCount: 2, individualCount: 0 },
          visibleGraphCounts: { visibleNodeCount: 2 },
        });
      } else if (operation === "description") {
        expect(
          h.controller.describeOntologyElements({
            ontologyElementReferences: [reference],
          }).elementDescriptions,
        ).toEqual([
          expect.objectContaining({
            iri: "urn:A",
            displayLabel: "A",
            superclassElements: [
              expect.objectContaining({ iri: "urn:B", displayLabel: "B" }),
            ],
          }),
        ]);
      } else if (operation === "focus") {
        expect(h.controller.getVisualizationFocus()).toEqual({
          focus: [reference],
          focusableElementCount: 1,
        });
      } else if (operation === "focus application") {
        await h.controller.setVisualizationView({ focus: [reference] });
        expect(h.controller.getVisualizationFocus()).toEqual({
          focus: [reference],
          focusableElementCount: 1,
        });
      } else {
        expect(
          h.controller.getVisualizationArrangement({
            ontologyElementReference: { kind: "class", iri: "urn:A" },
          }),
        ).toMatchObject({
          occurrenceCount: 1,
          nextOffset: null,
          occurrences: [
            { kind: "node", ontologyElementReferences: [reference] },
          ],
        });
      }
      expect(inspectionCopyCount(clone)).toBe(0);
    } finally {
      clone.mockRestore();
      h.controller.dispose();
    }
  },
);

test("shared summary and description values cannot mutate the accepted document", async () => {
  const h = await canonicalControllerHarness();
  try {
    const reference = h.reference();
    const summary = h.controller.getOntologySummary();
    const description = h.controller.describeOntologyElements({
      ontologyElementReferences: [reference],
    }).elementDescriptions[0];
    const mutationError = expect.objectContaining({ name: "TypeError" });
    expect(() => summary.namespaces.push({ prefix: "corrupt" })).toThrow(
      mutationError,
    );
    expect(() => summary.imports.push({ iri: "urn:corrupt" })).toThrow(
      mutationError,
    );
    expect(() => summary.availableLabelLanguages.push("corrupt")).toThrow(
      mutationError,
    );
    expect(() => {
      description.ontologyElementReference.iri = "urn:corrupt";
    }).toThrow(mutationError);
    expect(() =>
      description.annotationRecords.push({ text: "corrupt" }),
    ).toThrow(mutationError);
    expect(() => {
      description.superclassElements[0].ontologyElementReference.iri =
        "urn:corrupt";
    }).toThrow(mutationError);
    expect(h.reference()).toEqual(reference);
    expect(h.controller.getOntologySummary()).toEqual(summary);
    expect(
      h.controller.describeOntologyElements({
        ontologyElementReferences: [reference],
      }).elementDescriptions[0],
    ).toEqual(description);
  } finally {
    h.controller.dispose();
  }
});

function expectDeeplyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectDeeplyFrozen(child, seen);
  }
}

test("borrowed inspections include frozen retained facts while external copies remain independently mutable", async () => {
  const h = await canonicalControllerHarness();
  try {
    const borrowed = h.session.readOntologyInspection();
    const expected = h.session.inspectOntology();
    expect(
      borrowed.retainedFacts.records.subjects.map(({ iri }) => iri),
    ).toEqual(["urn:A", "urn:B"]);
    expectDeeplyFrozen(borrowed);
    const clone = jest.spyOn(globalThis, "structuredClone");
    try {
      expect(h.session.readOntologyInspection()).toBe(borrowed);
      expect(clone).not.toHaveBeenCalled();
    } finally {
      clone.mockRestore();
    }
    const owned = h.session.inspectOntology();
    expect(owned).toEqual(borrowed);
    expect(owned).not.toBe(borrowed);
    owned.retainedFacts.records.subjects[0].iri = "urn:owned-change";
    owned.classRecords[0].ontologyElementReference.iri = "urn:owned-change";
    owned.classRecords.push({});
    expect(borrowed).toEqual(expected);
    expect(h.session.inspectOntology()).toEqual(expected);
    expect(() => {
      borrowed.retainedFacts.records.subjects[0].iri = "urn:corrupt";
    }).toThrow(expect.objectContaining({ name: "TypeError" }));
  } finally {
    h.controller.dispose();
  }
  expect(() => h.session.readOntologyInspection()).toThrow(
    expect.objectContaining({ code: "DOCUMENT_SESSION_DISPOSED" }),
  );
});

test("reads follow accepted revisions and presentation while retained earlier values stay immutable", async () => {
  const h = await canonicalControllerHarness();
  try {
    const initial = h.session.readOntologyInspection();
    const initialValue = h.session.inspectOntology();
    await h.controller.setVisualizationView({
      nodesShown: { mode: "exact", requestedCount: 0 },
    });
    expect(h.session.readOntologyInspection()).toBe(initial);
    expect(h.controller.getVisualizationArrangement().occurrenceCount).toBe(0);
    await h.controller.setVisualizationView({ language: "en" });
    const presentation = h.session.readOntologyInspection();
    expect(presentation).not.toBe(initial);
    expect(presentation.classRecords[0].canonicalDisplay.selection).toEqual({
      mode: "language",
      range: "en",
    });
    expectDeeplyFrozen(presentation);
    expect(initial).toEqual(initialValue);
    await h.edit();
    const edited = h.session.readOntologyInspection();
    expect(edited.retainedFacts.revision).toBe(1);
    expect(
      edited.classRecords.map(
        ({ ontologyElementReference }) => ontologyElementReference.iri,
      ),
    ).toContain("urn:Renamed");
    expectDeeplyFrozen(edited);
    expect(initial).toEqual(initialValue);
    await h.load("urn:next");
    const reloaded = h.session.readOntologyInspection();
    expect(reloaded.loadGeneration).toBe(2);
    expect(reloaded.retainedFacts.revision).toBe(0);
    expect(reloaded.ontologyHeaderRecord.ontologyIri).toBe("urn:next");
    expectDeeplyFrozen(reloaded);
    expect(edited.retainedFacts.revision).toBe(1);
  } finally {
    h.controller.dispose();
  }
});
