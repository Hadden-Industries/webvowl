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

test("fresh nodes have distinct deterministic positions translated around the camera center", () => {
  const occurrences = Array.from({ length: 700 }, (_, index) => ({
    id: `node-${index}`,
    kind: index % 2 ? "datatype-node" : "class-node",
  }));
  const create = (center) =>
    createCanonicalVowlScene(occurrences, {
      loadGeneration: 1,
      center,
    }).snapshot().placements;
  const placements = create({ x: 0, y: 0 });
  expect(
    new Set(placements.map(({ position }) => JSON.stringify(position))).size,
  ).toBe(occurrences.length);
  expect(create({ x: 0, y: 0 })).toEqual(placements);
  const translated = create({ x: 40, y: -20 });
  translated.forEach(({ position, pinned }, index) => {
    expect(position.x).toBeCloseTo(placements[index].position.x + 40);
    expect(position.y).toBeCloseTo(placements[index].position.y - 20);
    expect(pinned).toBe(false);
    expect(Math.hypot(position.x - 40, position.y + 20)).toBeLessThan(300);
  });
});

test("labels and operators retain incidence-based placement among distributed nodes", () => {
  // Put dependents first to exercise recursive placement independent of inventory order.
  const occurrences = [
    { id: "label", kind: "label", edge: "property" },
    { id: "operator", kind: "class-node" },
    { id: "operand-a", kind: "operator-edge", from: "operator", to: "a" },
    { id: "operand-b", kind: "operator-edge", from: "operator", to: "b" },
    { id: "property", kind: "property-edge", from: "a", to: "datatype" },
    { id: "a", kind: "class-node" },
    { id: "b", kind: "class-node" },
    { id: "datatype", kind: "datatype-node" },
  ];
  const placements = new Map(
    createCanonicalVowlScene(occurrences, { loadGeneration: 1 })
      .snapshot()
      .placements.map(({ occurrence, position }) => [occurrence, position]),
  );
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  expect(placements.get("a")).not.toEqual(placements.get("b"));
  expect(placements.get("operator")).toEqual(
    midpoint(placements.get("a"), placements.get("b")),
  );
  expect(placements.get("label")).toEqual(
    midpoint(placements.get("a"), placements.get("datatype")),
  );
});

test("saved scenes, supplied positions and retained pins survive fresh-node initialization", () => {
  const occurrences = [
    { id: "a", kind: "class-node" },
    { id: "b", kind: "datatype-node" },
  ];
  const scene = createCanonicalVowlScene(occurrences, {
    loadGeneration: 1,
    suppliedPositions: new Map([["a", { x: 123, y: -456 }]]),
  });
  scene.arrange([
    {
      reference: scene.reference("a"),
      position: { x: 12, y: 34 },
      pinned: true,
    },
  ]);
  const saved = scene.snapshot();
  expect(
    createCanonicalVowlScene(occurrences, {
      loadGeneration: 2,
      visualization: saved,
      center: { x: 900, y: 900 },
    }).snapshot(),
  ).toEqual(saved);
  const additions = [
    ...occurrences,
    { id: "c", kind: "class-node" },
    { id: "d", kind: "datatype-node" },
  ];
  scene
    .prepareEdit({
      occurrences: additions,
      correspondence: occurrences.map(({ id }) => ({
        previous: id,
        current: id,
      })),
    })
    .commit();
  const updated = scene.snapshot().placements;
  expect(updated.slice(0, 2)).toEqual(saved.placements);
  expect(updated[2].position).not.toEqual(updated[3].position);
  expect(updated[2].position).not.toEqual(saved.placements[1].position);
  expect(
    createCanonicalVowlScene(occurrences, {
      loadGeneration: 3,
      suppliedPositions: new Map([["a", { x: 123, y: -456 }]]),
    })
      .snapshot()
      .placements.find(({ occurrence }) => occurrence === "a").position,
  ).toEqual({ x: 123, y: -456 });
});

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

test("presentation proposals preserve hidden placements and expire after a live arrangement", async () => {
  const document = await classes();
  const scene = createCanonicalVowlScene(document.structural.occurrences, {
    loadGeneration: 1,
  });
  const ref = scene.reference(named(document, "urn:A").occurrence.id);
  const before = scene.snapshot();
  const proposal = scene.prepareView({
    hidden: [ref],
    labelSelection: { mode: "language", range: "DE" },
    display: { compactNotation: true },
  });
  expect(proposal.preview().labelSelection).toEqual({
    mode: "language",
    range: "de",
  });
  expect(() =>
    proposal.commit({
      beforeCommit() {
        throw new Error("drawing failed");
      },
    }),
  ).toThrow("drawing failed");
  expect(scene.snapshot()).toEqual(before);
  proposal.commit();
  expect(scene.snapshot().placements).toEqual(before.placements);
  expect(scene.reference(scene.resolve(ref))).toEqual(ref);
  const stale = scene.prepareView({ hidden: [] });
  scene.arrange([{ reference: ref, position: { x: 17, y: 23 } }]);
  expect(() => stale.commit()).toThrow(
    expect.objectContaining({ code: "SCENE_PREVIEW_EXPIRED" }),
  );
  const accepted = scene.snapshot();
  expect(() =>
    scene.prepareView({ labelSelection: { mode: "language", range: "en-*" } }),
  ).toThrow();
  expect(() =>
    scene.prepareView({ display: { externalColoring: "false" } }),
  ).toThrow();
  expect(scene.snapshot()).toEqual(accepted);
});
