import { readFileSync } from "node:fs";
import {
  canonicalize,
  profiles,
  encode,
  edit,
  openCanonical,
  inspectModel,
  editModel,
  captureModel,
  checkpointModel,
  readmitModel,
} from "vowl";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../conformance/vectors/${name}/source.json`, import.meta.url),
    ),
  );
const options = { profile: profiles.structuralContent };
// Jest structuredClone returns foreign VM prototypes; transport into this realm.
const transport = (value) => JSON.parse(JSON.stringify(value));
const noRdf = { limits: { rdfQuads: 1, rdfDeepIterations: 0 } };
const insert = [
  {
    kind: "insert",
    collection: "subjects",
    record: { id: "new:subject", iri: "urn:New" },
  },
  {
    kind: "insert",
    collection: "roles",
    record: { id: "new:class", subject: "new:subject", kind: "class" },
  },
];

test("live admission, editing and checkpoint recovery require no RDF work", async () => {
  const document = await canonicalize(fixture("empty-structural"), options);
  const { model } = await openCanonical(document, noRdf);
  const next = await editModel(model, insert, noRdf);
  expect(next.model.revision).toBe(1);
  expect(next.created).toHaveLength(3);
  expect(inspectModel(model).records.subjects).toEqual([]);
  const checkpoint = await checkpointModel(next.model, noRdf);
  const recovered = await readmitModel(transport(checkpoint), noRdf);
  expect(inspectModel(recovered.model)).toEqual(inspectModel(next.model));
  expect(recovered.correspondence).toHaveLength(3);
  expect(
    recovered.correspondence.every(
      ({ previous, current }) => previous === current,
    ),
  ).toBe(true);
  const captured = await captureModel(recovered.model, options);
  expect(encode(captured.document)).toEqual(
    encode((await edit(document, insert)).document),
  );
  expect(inspectModel(model).coverage.basis).toBe("unavailable");
});

test("snapshots and cloned tokens convey neither live nor canonical admission", async () => {
  const document = await canonicalize(
    fixture("named-class-structural"),
    options,
  );
  const { model, correspondence } = await openCanonical(document);
  expect(correspondence).toHaveLength(3);
  expect(new Set(correspondence.map(({ current }) => current)).size).toBe(3);
  const snapshot = inspectModel(model);
  expect(Object.isFrozen(snapshot.records.subjects[0])).toBe(true);
  expect(() => encode(model)).toThrow(
    expect.objectContaining({ code: "DOCUMENT_NOT_ADMITTED" }),
  );
  for (const forged of [transport(model), snapshot, document, {}]) {
    expect(() => inspectModel(forged)).toThrow(
      expect.objectContaining({ code: "MODEL_NOT_ADMITTED" }),
    );
    await expect(editModel(forged, [])).rejects.toMatchObject({
      code: "MODEL_NOT_ADMITTED",
    });
  }
  await expect(openCanonical(transport(document))).rejects.toMatchObject({
    code: "DOCUMENT_NOT_ADMITTED",
  });
});

test("failed capture and failed edits preserve the model and its recoverable checkpoint", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("named-class-structural"), options),
  );
  const before = inspectModel(model);
  const checkpoint = await checkpointModel(model);
  await expect(
    captureModel(model, { ...options, ...noRdf }),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
  await expect(
    editModel(model, [{ kind: "remove", id: before.records.subjects[0].id }]),
  ).rejects.toBeDefined();
  expect(inspectModel(model)).toEqual(before);
  expect(await checkpointModel(model)).toEqual(checkpoint);
  expect(encode((await captureModel(model, options)).document)).toBeInstanceOf(
    Uint8Array,
  );
});

test.each([
  [
    "extra envelope field",
    (value) => {
      value.authority = true;
    },
  ],
  [
    "dangling structural reference",
    (value) => {
      value.structural.roles[0].subject = "missing";
    },
  ],
  [
    "missing occurrence",
    (value) => {
      value.structural.occurrences = [];
    },
  ],
  [
    "duplicate support",
    (value) => {
      value.supports.push(value.supports[0]);
    },
  ],
  [
    "absent support",
    (value) => {
      value.supports.pop();
    },
  ],
  [
    "invented source authority",
    (value) => {
      value.origin.sourceAccess = "available";
    },
  ],
  [
    "invalid digest",
    (value) => {
      value.origin.inputDigest = "made-up";
    },
  ],
  [
    "fractional revision",
    (value) => {
      value.revision = 0.5;
    },
  ],
  [
    "invented support assertion",
    (value) => {
      value.supports[0].assertions = ["imaginary"];
    },
  ],
])(
  "readmission rejects %s rather than trusting checkpoint provenance",
  async (_name, mutate) => {
    const { model } = await openCanonical(
      await canonicalize(fixture("named-class-structural"), options),
    );
    const checkpoint = transport(await checkpointModel(model));
    mutate(checkpoint);
    await expect(readmitModel(checkpoint)).rejects.toBeDefined();
    expect(inspectModel(model).occurrences).toHaveLength(1);
  },
);

test("signature generation never reuses a removed predecessor handle", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("empty-structural"), options),
  );
  const ontology = (datatype) => ({
    imports: [],
    annotations: [
      {
        predicate: "urn:note",
        value: { kind: "typed", lexical: "value", datatype },
        annotations: [],
      },
    ],
  });
  const first = await editModel(model, [
    { kind: "set-ontology", ontology: ontology("urn:datatype:first") },
  ]);
  const snapshot = inspectModel(first.model);
  const subject = snapshot.records.subjects.find(
    ({ iri }) => iri === "urn:datatype:first",
  );
  const role = snapshot.records.roles.find(
    (item) => item.subject === subject.id,
  );
  expect(subject.id).toMatch(/^normalized/);
  const second = await editModel(first.model, [
    { kind: "set-ontology", ontology: ontology("urn:datatype:second") },
    { kind: "remove", id: role.id },
    { kind: "remove", id: subject.id },
  ]);
  expect(
    second.correspondence.find(({ previous }) => previous === subject.id)
      .current,
  ).toBeNull();
  const replacement = inspectModel(second.model).records.subjects.find(
    ({ iri }) => iri === "urn:datatype:second",
  );
  expect(replacement.id).not.toBe(subject.id);
  expect(second.created).toContain(replacement.id);
});

test("support survives occurrence renumbering through explicit correspondence", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("symmetric-anonymous-classes"), options),
  );
  const before = inspectModel(model);
  const removed = before.records.roles[0];
  const kept = before.occurrences.find(
    (record) => !record.targets.includes(removed.id),
  );
  const next = await editModel(model, [
    { kind: "remove", id: removed.id },
    { kind: "remove", id: removed.subject },
  ]);
  const current = next.correspondence.find(
    ({ previous }) => previous === kept.id,
  ).current;
  expect(current).not.toBeNull();
  expect(
    inspectModel(next.model).supports.find(({ record }) => record === current)
      .origin,
  ).toBe("canonical");
});

test("readmission distinguishes unsupported versions and rejects accessors without invoking them", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("empty-structural"), options),
  );
  const checkpoint = transport(await checkpointModel(model));
  await expect(
    readmitModel({ ...checkpoint, version: 2 }),
  ).rejects.toMatchObject({ code: "CHECKPOINT_VERSION_UNSUPPORTED" });
  let invoked = false;
  Object.defineProperty(checkpoint, "revision", {
    enumerable: true,
    get() {
      invoked = true;
      return 0;
    },
  });
  await expect(readmitModel(checkpoint)).rejects.toMatchObject({
    code: "SOURCE_UNSAFE_VALUE",
  });
  expect(invoked).toBe(false);
});

test("options, cancellation and resource bounds apply to live recovery", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("named-class-structural"), options),
  );
  const checkpoint = await checkpointModel(model);
  await expect(readmitModel(checkpoint, { force: true })).rejects.toMatchObject(
    { code: "OPTION_INVALID" },
  );
  await expect(
    readmitModel(checkpoint, { signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ code: "ABORTED" });
  await expect(
    readmitModel(checkpoint, { limits: { primaryRecords: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
});

test("live deletion reports retired records and removes their support", async () => {
  const { model } = await openCanonical(
    await canonicalize(fixture("named-class-structural"), options),
  );
  const role = inspectModel(model).records.roles[0];
  const result = await editModel(model, [
    { kind: "remove", id: role.id },
    { kind: "remove", id: role.subject },
  ]);
  expect(result.correspondence).toHaveLength(3);
  expect(result.correspondence.every(({ current }) => current === null)).toBe(
    true,
  );
  expect(inspectModel(result.model).supports).toEqual([]);
  expect(
    inspectModel(
      (await readmitModel(await checkpointModel(result.model))).model,
    ),
  ).toEqual(inspectModel(result.model));
});

test("artifact capture maps the complete scene and leaves live references stable", async () => {
  const source = fixture("named-class-artifact");
  source.visualization.hidden = [source.structural.occurrences[0].id];
  const artifact = await canonicalize(source, { profile: profiles.artifact });
  const opened = await openCanonical(artifact);
  const map = new Map(
    opened.correspondence.map(({ previous, current }) => [previous, current]),
  );
  const visualization = transport(artifact.visualization);
  for (const placement of visualization.placements) {
    placement.occurrence = map.get(placement.occurrence);
  }
  visualization.hidden = visualization.hidden.map((id) => map.get(id));
  const before = inspectModel(opened.model);
  const result = await captureModel(opened.model, {
    profile: profiles.artifact,
    visualization,
  });
  expect(encode(result.document)).toEqual(encode(artifact));
  expect(inspectModel(opened.model)).toBe(before);
  await expect(
    captureModel(opened.model, {
      profile: profiles.artifact,
      visualization: { ...visualization, placements: [] },
    }),
  ).rejects.toBeDefined();
});

test("a separate package instance requires explicit checkpoint readmission", async () => {
  const other = await import("../src/index.js?live-admission-test");
  const { model } = await openCanonical(
    await canonicalize(fixture("named-class-structural"), options),
  );
  expect(() => other.inspectModel(model)).toThrow(
    expect.objectContaining({ code: "MODEL_NOT_ADMITTED" }),
  );
  const result = await other.readmitModel(await checkpointModel(model));
  expect(other.inspectModel(result.model)).toEqual(inspectModel(model));
  expect(() => inspectModel(result.model)).toThrow(
    expect.objectContaining({ code: "MODEL_NOT_ADMITTED" }),
  );
});

test.each([
  "annotated-class",
  "symmetric-anonymous-classes",
  "repeated-chain",
  "matched-inverse",
  "partial-union-projection",
])("live recovery retains %s and captures identical v1 bytes", async (name) => {
  const canonical = await canonicalize(fixture(name), options);
  const opened = await openCanonical(canonical, noRdf);
  const recovered = await readmitModel(
    transport(await checkpointModel(opened.model, noRdf)),
    noRdf,
  );
  expect(inspectModel(recovered.model)).toEqual(inspectModel(opened.model));
  expect(
    encode((await captureModel(recovered.model, options)).document),
  ).toEqual(encode(canonical));
});
