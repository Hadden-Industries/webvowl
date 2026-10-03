import { readFileSync } from "node:fs";
import { canonicalize, edit, encode, decode, profiles } from "vowl";
import { readCorpusArtifact } from "../conformance/storage.mjs";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../conformance/vectors/${name}/source.json`, import.meta.url),
    ),
  );
const options = { profile: profiles.structuralContent };
const corpusRoot = new URL("../conformance/", import.meta.url);
const corpus = {
  vectors: [
    "amended-policy/manifest.json",
    "conditional/manifest.json",
    "conditional/additional-manifest.json",
    "conditional/completion-manifest.json",
    "conditional/scope-manifest.json",
    "field-contract/positive-manifest.json",
    "field-contract/additional-positive-manifest.json",
  ].flatMap(
    (path) =>
      JSON.parse(readFileSync(new URL(`supplemental/${path}`, corpusRoot)))
        .vectors,
  ),
};
const role = (document, iri, kind = "class") =>
  document.structural.roles.find(
    (record) =>
      record.kind === kind &&
      document.structural.subjects.find(
        (subject) => subject.id === record.subject,
      )?.iri === iri,
  );

test("atomic insertion builds signature and occurrences without caller projection code", async () => {
  const before = await canonicalize(fixture("empty-structural"), options);
  const result = await edit(before, [
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
  ]);
  expect(result.document.structural.occurrences).toHaveLength(1);
  expect(result.created).toHaveLength(3);
  expect(result.correspondence).toEqual([]);
  expect(encode(await decode(encode(result.document)))).toEqual(
    encode(result.document),
  );
  expect(before.structural.subjects).toEqual([]);
});

test("explicit semantic deletion retires its occurrence and reports correspondence", async () => {
  const before = await canonicalize(fixture("named-class-structural"), options);
  const r = before.structural.roles[0];
  const result = await edit(before, [
    { kind: "remove", id: r.id },
    { kind: "remove", id: r.subject },
  ]);
  expect(result.document.structural.occurrences).toEqual([]);
  expect(result.correspondence).toHaveLength(3);
  expect(result.correspondence.every((pair) => pair.current === null)).toBe(
    true,
  );
  expect(before.structural.occurrences).toHaveLength(1);
});

test("changing an annotated endpoint preserves annotations and regenerates edges", async () => {
  const source = fixture("matched-inverse");
  source.structural.constructs = source.structural.constructs.filter(
    (record) => record.kind !== "inverse-properties",
  );
  // Establish a public, admitted baseline through insertion into an empty document.
  const blank = await canonicalize(fixture("empty-structural"), options);
  const insert = Object.entries(source.structural)
    .filter(([name]) => ["subjects", "roles", "constructs"].includes(name))
    .flatMap(([collection, records]) =>
      records.map((record) => ({ kind: "insert", collection, record })),
    );
  insert.push({
    kind: "insert",
    collection: "subjects",
    record: { id: "note-subject", iri: "urn:note" },
  });
  insert.push({
    kind: "insert",
    collection: "roles",
    record: {
      id: "note-role",
      subject: "note-subject",
      kind: "annotation-property",
    },
  });
  const annotations = [
    {
      predicate: "urn:note",
      value: { kind: "iri", iri: "urn:preserve-me" },
      annotations: [],
    },
  ];
  insert.push({
    kind: "insert",
    collection: "constructs",
    record: {
      id: "anchor",
      kind: "assertion-anchor",
      assertion: { kind: "object-domain", property: "p", target: "A" },
      annotations,
    },
  });
  const before = (await edit(blank, insert)).document;
  const p = role(before, "https://example.org/o#p", "object-property");
  const b = role(before, "https://example.org/o#B");
  const domain = before.structural.constructs.find(
    (record) => record.kind === "object-domain" && record.property === p.id,
  );
  const result = await edit(before, [
    { kind: "set-endpoint", construct: domain.id, target: b.id },
  ]);
  const anchor = result.document.structural.constructs.find(
    (record) => record.kind === "assertion-anchor",
  );
  expect(anchor.annotations).toEqual(annotations);
  expect(anchor.assertion.target).toBe(
    role(result.document, "https://example.org/o#B").id,
  );
  const edge = result.document.structural.occurrences.find(
    (record) =>
      record.kind === "property-edge" &&
      record.properties.includes(
        role(result.document, "https://example.org/o#p", "object-property").id,
      ),
  );
  expect(edge.from).toBe(edge.to);
  expect(result.correspondence.some((pair) => pair.current === null)).toBe(
    true,
  );
});

test("editing rejects copied documents, unknown requests and dangling destructive changes", async () => {
  const before = await canonicalize(fixture("named-class-structural"), options);
  await expect(edit(structuredClone(before), [])).rejects.toMatchObject({
    code: "DOCUMENT_NOT_ADMITTED",
  });
  await expect(edit(before, [{ kind: "repair" }])).rejects.toMatchObject({
    code: "EDIT_INVALID",
  });
  await expect(edit(before, [{ kind: "constructor" }])).rejects.toMatchObject({
    code: "EDIT_INVALID",
  });
  await expect(
    edit(before, [{ kind: "remove", id: before.structural.subjects[0].id }]),
  ).rejects.toMatchObject({ code: "REFERENCE_DANGLING" });
  expect(encode(await decode(encode(before)))).toEqual(encode(before));
});

test("unchanged editing preserves exact structural bytes and derives artifact correspondence without positions", async () => {
  const structural = await canonicalize(
    fixture("named-class-structural"),
    options,
  );
  expect(encode((await edit(structural, [])).document)).toEqual(
    encode(structural),
  );
  const artifact = await canonicalize(fixture("named-class-artifact"), {
    profile: profiles.artifact,
  });
  const result = await edit(artifact, []);
  expect(result.document.profile).toBe(profiles.structuralContent);
  expect(result.document.visualization).toBeUndefined();
  expect(result.correspondence.every((pair) => pair.current !== null)).toBe(
    true,
  );
  expect(result.created).toEqual([]);
  expect(Object.isFrozen(result.correspondence[0])).toBe(true);
});

test("insertion deduplicates semantic identities and closes annotation signatures", async () => {
  const before = await canonicalize(fixture("named-class-structural"), options);
  const subject = before.structural.subjects[0];
  const r = before.structural.roles[0];
  const result = await edit(before, [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "duplicate-subject", iri: subject.iri },
    },
    {
      kind: "insert",
      collection: "roles",
      record: {
        id: "duplicate-role",
        kind: r.kind,
        subject: "duplicate-subject",
      },
    },
    {
      kind: "insert",
      collection: "constructs",
      record: {
        id: "new-label",
        kind: "annotation-assertion",
        subject: "duplicate-subject",
        predicate: "http://www.w3.org/2000/01/rdf-schema#label",
        value: { kind: "language", language: "EN-GB", lexical: "Label" },
      },
    },
  ]);
  expect(
    result.document.structural.roles.filter(
      (record) => record.kind === "class",
    ),
  ).toHaveLength(1);
  expect(
    result.document.structural.roles.map((record) => record.kind).sort(),
  ).toEqual(["annotation-property", "class", "datatype"]);
  expect(result.document.structural.constructs[0].value.language).toBe("en-gb");
});

test("property insertion supplies only needed builtins and retains sequence repetition", async () => {
  const before = await canonicalize(fixture("empty-structural"), options);
  const result = await edit(before, [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "p-subject", iri: "urn:p" },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: "p-role", kind: "object-property", subject: "p-subject" },
    },
    {
      kind: "insert",
      collection: "constructs",
      record: {
        id: "chain",
        kind: "property-chain",
        members: ["p-role", "p-role"],
        super: "p-role",
      },
    },
  ]);
  expect(
    result.document.structural.subjects.some(
      (record) => record.iri === "http://www.w3.org/2002/07/owl#Thing",
    ),
  ).toBe(true);
  const chain = result.document.structural.constructs.find(
    (record) => record.kind === "property-chain",
  );
  expect(chain.members).toEqual([chain.super, chain.super]);
  expect(
    result.document.structural.occurrences.map((record) => record.kind).sort(),
  ).toEqual(["class-node", "label", "property-edge"]);
});

test.each(
  corpus.vectors.filter(
    (vector) => vector.profile === profiles.structuralContent,
  ),
)(
  "an empty edit preserves independent structural bytes: $id",
  async (vector) => {
    const expected = new Uint8Array(
      readCorpusArtifact(vector.files["canonical.json"].path),
    );
    const before = await decode(expected);
    const result = await edit(before, []);
    expect(encode(result.document)).toEqual(expected);
    expect(result.created).toEqual([]);
    expect(result.correspondence.every((pair) => pair.current !== null)).toBe(
      true,
    );
  },
);

test("editing snapshots its operations before suspension and observes in-flight cancellation", async () => {
  const before = await canonicalize(fixture("empty-structural"), options);
  const changes = [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "s", iri: "urn:original" },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: "r", kind: "class", subject: "s" },
    },
  ];
  const pending = edit(before, changes);
  changes[0].record.iri = "urn:mutated";
  const result = await pending;
  expect(result.document.structural.subjects[0].iri).toBe("urn:original");
  const controller = new AbortController();
  const cancelled = edit(result.document, [], { signal: controller.signal });
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ code: "ABORTED" });
  await expect(
    edit(result.document, [], { limits: { primaryRecords: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  expect(encode(await decode(encode(result.document)))).toEqual(
    encode(result.document),
  );
});

test("an annotated immediate aggregate operand makes endpoint replacement explicitly ambiguous", async () => {
  const vector = corpus.vectors.find(
    (entry) => entry.id === "aggregate-anchor-inner",
  );
  const before = await decode(
    new Uint8Array(
      readFileSync(new URL(vector.files["canonical.json"].path, corpusRoot)),
    ),
  );
  const domain = before.structural.constructs.find(
    (record) => record.kind === "object-domain",
  );
  const target = role(before, "https://example.org/supplement#C").id;
  await expect(
    edit(before, [{ kind: "set-endpoint", construct: domain.id, target }]),
  ).rejects.toMatchObject({ code: "EDIT_AMBIGUOUS" });
  expect(encode(before)).toEqual(
    new Uint8Array(
      readFileSync(new URL(vector.files["canonical.json"].path, corpusRoot)),
    ),
  );
});
