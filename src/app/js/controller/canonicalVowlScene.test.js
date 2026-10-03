import { fromOwl } from "vowl/owl";
import { edit, canonicalize, profiles } from "vowl";
import { createCanonicalVowlScene } from "./canonicalVowlScene.js";

async function classes() {
  return (
    await fromOwl(
      new TextEncoder().encode(
        "Ontology(<urn:example> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)))",
      ),
      { documentIri: "urn:source", mediaType: "text/owl-functional" },
    )
  ).document;
}
function named(document, iri) {
  const subject = document.structural.subjects.find(
    (record) => record.iri === iri,
  );
  const role = document.structural.roles.find(
    (record) => record.subject === subject.id,
  );
  const occurrence = document.structural.occurrences.find((record) =>
    record.targets?.includes(role.id),
  );
  return { subject, role, occurrence };
}
async function merge(document) {
  const a = named(document, "urn:A");
  const result = await edit(document, [
    {
      kind: "replace",
      id: a.subject.id,
      record: { id: a.subject.id, iri: "urn:B" },
    },
  ]);
  return { ...result, occurrences: result.document.structural.occurrences };
}

test("hidden placements remain complete and can be admitted as an artifact", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 1,
    center: { x: 40, y: 20 },
  });
  const a = named(document, "urn:A").occurrence;
  scene.setVisibility([scene.reference(a.id)]);
  const visualization = scene.snapshot();
  expect(visualization.placements).toHaveLength(2);
  expect(visualization.hidden).toEqual([a.id]);
  await expect(
    canonicalize(
      // Jest's host structuredClone uses another realm. A real worker receives
      // its own ordinary objects; reconstruct that message boundary here.
      {
        structural: document.structural,
        visualization: JSON.parse(JSON.stringify(visualization)),
      },
      { profile: profiles.artifact },
    ),
  ).resolves.toBeDefined();
  scene.setVisibility([]);
  expect(scene.snapshot().placements).toEqual(visualization.placements);
});

test("conflicting semantic merge is unapplied until a specific placement is chosen", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 2,
  });
  const a = scene.reference(named(document, "urn:A").occurrence.id);
  const b = scene.reference(named(document, "urn:B").occurrence.id);
  scene.arrange([{ reference: a, position: { x: 100, y: -20 }, pinned: true }]);
  const prior = scene.snapshot();
  const proposal = scene.prepareEdit(await merge(document));
  expect(proposal.conflicts).toHaveLength(1);
  expect(() => proposal.commit()).toThrow();
  expect(scene.snapshot()).toEqual(prior);
  proposal.commit(new Map([[proposal.conflicts[0].occurrence, a]]));
  expect(scene.snapshot().placements).toEqual([
    {
      occurrence: proposal.conflicts[0].occurrence,
      position: { x: 100, y: -20 },
      pinned: true,
    },
  ]);
  // Only one predecessor runtime handle survives the merge.
  const surviving = scene.reference(proposal.conflicts[0].occurrence);
  expect([a.occurrenceId, b.occurrenceId]).toContain(surviving.occurrenceId);
  const retired = surviving.occurrenceId === a.occurrenceId ? b : a;
  expect(() => scene.resolve(retired)).toThrow();
  expect(() => proposal.commit()).toThrow();
});

test("a drag invalidates a prepared merge instead of discarding the new placement", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 3,
  });
  const a = scene.reference(named(document, "urn:A").occurrence.id);
  const proposal = scene.prepareEdit(await merge(document));
  scene.arrange([{ reference: a, position: { x: 20, y: 30 } }]);
  expect(() => proposal.commit()).toThrow();
  expect(
    scene
      .snapshot()
      .placements.find(({ occurrence }) => occurrence === scene.resolve(a))
      .position,
  ).toEqual({ x: 20, y: 30 });
});

test("runtime references follow edit correspondence even when local IDs are reused", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 4,
  });
  const a = named(document, "urn:A");
  const reference = scene.reference(a.occurrence.id);
  scene.arrange([{ reference, position: { x: 10, y: 50 } }]);
  const result = await edit(document, [
    {
      kind: "replace",
      id: a.subject.id,
      record: { id: a.subject.id, iri: "urn:Z" },
    },
  ]);
  scene
    .prepareEdit({
      ...result,
      occurrences: result.document.structural.occurrences,
    })
    .commit();
  const target = result.correspondence.find(
    ({ previous }) => previous === a.occurrence.id,
  ).current;
  expect(scene.resolve(reference)).toBe(target);
  expect(
    scene.snapshot().placements.find(({ occurrence }) => occurrence === target)
      .position,
  ).toEqual({ x: 10, y: 50 });
  const reloaded = createCanonicalVowlScene(
    result.document.structural.occurrences,
    {
      loadGeneration: 5,
    },
  );
  expect(() => reloaded.resolve(reference)).toThrow();
});

test("missing or repeated correspondence cannot partially replace the scene", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 6,
  });
  const before = scene.snapshot();
  expect(() =>
    scene.prepareEdit({
      occurrences: document.structural.occurrences,
      correspondence: [],
    }),
  ).toThrow();
  const occurrence = document.structural.occurrences[0];
  expect(() =>
    scene.prepareEdit({
      document,
      correspondence: [1, 2].map(() => ({
        previous: occurrence.id,
        current: occurrence.id,
      })),
    }),
  ).toThrow();
  expect(scene.snapshot()).toEqual(before);
});
