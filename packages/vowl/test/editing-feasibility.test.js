import { canonicalize, profiles } from "vowl";

const options = { profile: profiles.structuralContent };
const base = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: ["A", "B", "C", "p", "note"].map((id) => ({
      id: `s${id}`,
      iri: `urn:${id}`,
    })),
    roles: [
      ...["A", "B", "C"].map((id) => ({
        id,
        kind: "class",
        subject: `s${id}`,
      })),
      { id: "p", kind: "object-property", subject: "sp" },
      { id: "note", kind: "annotation-property", subject: "snote" },
    ],
    expressions: [],
    constructs: [
      { id: "domain", kind: "object-domain", property: "p", target: "A" },
      { id: "range", kind: "object-range", property: "p", target: "B" },
      {
        id: "anchor",
        kind: "assertion-anchor",
        assertion: { kind: "object-domain", property: "p", target: "A" },
        annotations: [
          {
            predicate: "urn:note",
            value: { kind: "iri", iri: "urn:annotation-preserved" },
            annotations: [],
          },
        ],
      },
    ],
    occurrences: [
      ...["A", "B", "C"].map((id) => ({
        id: `n${id}`,
        kind: "class-node",
        targets: [id],
      })),
      {
        id: "edge",
        kind: "property-edge",
        properties: ["p"],
        from: "nA",
        to: "nB",
      },
      { id: "label", kind: "label", edge: "edge", direction: "single" },
    ],
  },
});

// These are finite, hand-authored experiments, not an application normalization
// implementation. They make the missing ownership decision observable at the API.
test("insertion requires the caller to construct its new complete projection", async () => {
  const source = base();
  await canonicalize(source, options);
  source.structural.subjects.push({ id: "sD", iri: "urn:D" });
  source.structural.roles.push({ id: "D", kind: "class", subject: "sD" });
  await expect(canonicalize(source, options)).rejects.toMatchObject({
    code: "PROJECTION_INVALID",
  });
  source.structural.occurrences.push({
    id: "nD",
    kind: "class-node",
    targets: ["D"],
  });
  const inserted = await canonicalize(source, options);
  expect(
    inserted.structural.roles.filter((role) => role.kind === "class"),
  ).toHaveLength(4);
});

test("deletion requires the caller to remove occurrences that no longer exist", async () => {
  const source = base();
  await canonicalize(source, options);
  source.structural.subjects = source.structural.subjects.filter(
    (record) => record.id !== "sC",
  );
  source.structural.roles = source.structural.roles.filter(
    (record) => record.id !== "C",
  );
  await expect(canonicalize(source, options)).rejects.toMatchObject({
    code: "REFERENCE_DANGLING",
  });
  source.structural.occurrences = source.structural.occurrences.filter(
    (record) => record.id !== "nC",
  );
  const deleted = await canonicalize(source, options);
  expect(
    deleted.structural.roles.filter((role) => role.kind === "class"),
  ).toHaveLength(2);
});

test("annotated endpoint editing needs both assertion support and new occurrence correspondence", async () => {
  const source = base();
  const original = await canonicalize(source, options);
  const annotation = structuredClone(
    source.structural.constructs[2].annotations,
  );
  source.structural.constructs[0].target = "C";
  await expect(canonicalize(source, options)).rejects.toMatchObject({
    code: "ASSERTION_UNSUPPORTED",
  });
  source.structural.constructs[2].assertion.target = "C";
  await expect(canonicalize(source, options)).rejects.toMatchObject({
    code: "PROJECTION_INVALID",
  });
  source.structural.occurrences.find((record) => record.id === "edge").from =
    "nC";
  const edited = await canonicalize(source, options);
  expect(
    edited.structural.constructs.find(
      (record) => record.kind === "assertion-anchor",
    ).annotations,
  ).toEqual(annotation);
  const subjects = new Map(
    edited.structural.subjects.map((subject) => [subject.id, subject.iri]),
  );
  const roles = new Map(
    edited.structural.roles.map((role) => [
      role.id,
      subjects.get(role.subject),
    ]),
  );
  const edge = edited.structural.occurrences.find(
    (record) => record.kind === "property-edge",
  );
  const node = edited.structural.occurrences.find(
    (record) => record.id === edge.from,
  );
  expect(node.targets.map((id) => roles.get(id))).toEqual(["urn:C"]);
  expect(edited).not.toEqual(original);
});
