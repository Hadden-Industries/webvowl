import { readFileSync } from "node:fs";
import { canonicalize, decode, edit, encode, profiles } from "vowl";

const options = { profile: profiles.structuralContent };
const source = () => ({
  structural: {
    ontology: { imports: [], annotations: [] },
    subjects: [],
    roles: [],
    expressions: [],
    constructs: [],
    occurrences: [],
  },
});
const insert = (collection, record) => ({ kind: "insert", collection, record });
const blank = () => canonicalize(source(), options);
const named = (id, kind = "class", iri = `urn:${id}`) => [
  insert("subjects", { id: `subject-${id}`, iri }),
  insert("roles", { id, kind, subject: `subject-${id}` }),
];

test("distinct bindings with the same prefix name violate the artifact invariant", async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../conformance/vectors/empty-artifact/source.json",
        import.meta.url,
      ),
    ),
  );
  fixture.visualization.prefixes = [
    { prefix: "ex", iri: "urn:a:" },
    { prefix: "ex", iri: "urn:b:" },
  ];
  await expect(
    canonicalize(fixture, { profile: profiles.artifact }),
  ).rejects.toMatchObject({
    code: "ARTIFACT_INCOMPLETE",
    pointer: "/visualization/prefixes/1/prefix",
  });
});

test.each([false, true])(
  "hidden incidence precedes placement completeness regardless of field insertion order: reversed=%s",
  async (reverse) => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "../conformance/supplemental/conditional/vectors/artifact-all-positionable-per-property-datatype/source.json",
          import.meta.url,
        ),
      ),
    );
    fixture.visualization.hidden = ["generic-p"];
    fixture.visualization.placements = [];
    if (reverse) {
      fixture.visualization = Object.fromEntries(
        Object.entries(fixture.visualization).reverse(),
      );
    }
    const expected = {
      code: "ARTIFACT_INCOMPLETE",
      pointer: "/visualization/hidden",
    };
    await expect(
      canonicalize(fixture, { profile: profiles.artifact }),
    ).rejects.toMatchObject(expected);
    const wire = JSON.parse(
      readFileSync(
        new URL(
          "../conformance/supplemental/conditional/vectors/artifact-all-positionable-per-property-datatype/canonical.json",
          import.meta.url,
        ),
      ),
    );
    wire.visualization.hidden = [
      wire.structural.occurrences.find((record) => record.kind === "class-node")
        .id,
    ];
    wire.visualization.placements = [];
    await expect(
      decode(new TextEncoder().encode(JSON.stringify(wire))),
    ).rejects.toMatchObject(expected);
  },
);

test.each(["subjects", "roles"])(
  "merged %s handles remain reserved for generated endpoint intersections",
  async (collection) => {
    const before = (
      await edit(await blank(), [
        ...named("A"),
        ...named("B"),
        ...named("C"),
        ...named("p", "object-property"),
        insert("constructs", {
          id: "domain",
          kind: "object-domain",
          property: "p",
          target: "A",
        }),
        insert("constructs", {
          id: "range",
          kind: "object-range",
          property: "p",
          target: "B",
        }),
      ])
    ).document;
    const roleFor = (iri) =>
      before.structural.roles.find((role) =>
        before.structural.subjects.some(
          (subject) => subject.id === role.subject && subject.iri === iri,
        ),
      );
    const change = insert("constructs", {
      id: "second-domain",
      kind: "object-domain",
      property: roleFor("urn:p").id,
      target: roleFor("urn:B").id,
    });
    const duplicate =
      collection === "subjects"
        ? { id: "normalized0", iri: "urn:C" }
        : {
            id: "normalized0",
            kind: "class",
            subject: roleFor("urn:C").subject,
          };
    const actual = (await edit(before, [insert(collection, duplicate), change]))
      .document;
    const domain = actual.structural.constructs.find(
      ({ kind }) => kind === "object-domain",
    );
    const intersection = actual.structural.expressions.find(
      ({ id }) => id === domain.target,
    );
    expect(intersection).toMatchObject({ kind: "class-intersection" });
    const members = intersection.members.map((id) => {
      const role = actual.structural.roles.find((record) => record.id === id);
      return actual.structural.subjects.find(
        (record) => record.id === role.subject,
      ).iri;
    });
    expect(members.sort()).toEqual(["urn:A", "urn:B"]);
    expect(encode(actual)).toEqual(
      encode((await edit(before, [change])).document),
    );
  },
);

test("inserted and replacement records consume primary budgets during snapshotting", async () => {
  const before = await blank();
  const changes = named("note", "annotation-property");
  await expect(
    edit(before, changes, { limits: { primaryRecords: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  const inserted = await edit(before, changes, {
    limits: { primaryRecords: 2 },
  });
  const subject = inserted.document.structural.subjects[0];
  await expect(
    edit(
      inserted.document,
      [
        {
          kind: "replace",
          id: subject.id,
          record: { ...subject, iri: "urn:renamed" },
        },
      ],
      { limits: { primaryRecords: 2 } },
    ),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
});

test.each([false, true])(
  "expression-depth rejection is independent of source ordering: reversed=%s",
  async (reverse) => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "../conformance/supplemental/grammar/vectors/data-complement/source.json",
          import.meta.url,
        ),
      ),
    );
    fixture.structural.expressions = Array.from({ length: 12 }, (_, index) => ({
      id: `x${index}`,
      kind: "data-complement",
      operand: index === 0 ? "integer" : `x${index - 1}`,
    }));
    fixture.structural.constructs[0].target = "x11";
    if (reverse) {
      fixture.structural.expressions.reverse();
    }
    await expect(
      canonicalize(fixture, { ...options, limits: { depth: 5 } }),
    ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  },
);

test("invalid occurrence topology waits until required default normalization", async () => {
  const model = source();
  model.structural.subjects = [{ id: "sp", iri: "urn:p" }];
  model.structural.roles = [
    { id: "p", kind: "object-property", subject: "sp" },
  ];
  model.structural.occurrences = [
    {
      id: "edge",
      kind: "property-edge",
      properties: ["p"],
      from: "edge",
      to: "edge",
    },
    { id: "label", kind: "label", edge: "edge", direction: "single" },
  ];
  await expect(canonicalize(model, options)).rejects.toMatchObject({
    code: "NORMALIZATION_INVALID",
  });
});

test("merging nominal identities also merges recursively equal expressions and constructs", async () => {
  const before = (
    await edit(await blank(), [
      ...named("A"),
      ...named("B"),
      ...named("C"),
      insert("expressions", {
        id: "both",
        kind: "class-union",
        members: ["A", "B"],
      }),
      insert("expressions", { id: "one", kind: "class-union", members: ["B"] }),
      insert("expressions", {
        id: "outer-both",
        kind: "class-intersection",
        members: ["both", "one"],
      }),
      insert("expressions", {
        id: "outer-one",
        kind: "class-intersection",
        members: ["one"],
      }),
      insert("constructs", {
        id: "sub-both",
        kind: "subclass",
        sub: "C",
        super: "outer-both",
      }),
      insert("constructs", {
        id: "sub-one",
        kind: "subclass",
        sub: "C",
        super: "outer-one",
      }),
    ])
  ).document;
  const subject = before.structural.subjects.find(
    (record) => record.iri === "urn:A",
  );
  const result = await edit(before, [
    { kind: "replace", id: subject.id, record: { ...subject, iri: "urn:B" } },
  ]);
  expect(result.document.structural.expressions).toHaveLength(2);
  expect(
    result.document.structural.expressions.every(
      (record) => record.members.length === 1,
    ),
  ).toBe(true);
  expect(result.document.structural.constructs).toHaveLength(1);
});

test("projection-required specific roles supersede generic roles on the same subject", async () => {
  const before = (
    await edit(
      await blank(),
      named("generic", "rdf-class", "http://www.w3.org/2002/07/owl#Thing"),
    )
  ).document;
  const result = await edit(before, named("p", "object-property"));
  expect(
    result.document.structural.roles.map((record) => record.kind).sort(),
  ).toEqual(["class", "object-property"]);
  expect(
    result.document.structural.occurrences.map((record) => record.kind).sort(),
  ).toEqual(["class-node", "label", "property-edge"]);
});

test.each(["domain", "range"])(
  "default-role promotion precedes capturing an explicit %s endpoint",
  async (end) => {
    const before = (
      await edit(
        await blank(),
        named("generic", "rdf-class", "http://www.w3.org/2002/07/owl#Thing"),
      )
    ).document;
    const generic = before.structural.roles[0];
    const result = await edit(before, [
      ...named("p", "object-property"),
      insert("constructs", {
        id: "explicit",
        kind: `object-${end}`,
        property: "p",
        target: generic.id,
      }),
    ]);
    const specific = result.document.structural.roles.find(
      (record) => record.kind === "class",
    );
    expect(result.document.structural.roles).toHaveLength(2);
    expect(result.document.structural.constructs[0].target).toBe(specific.id);
    const node = result.document.structural.occurrences.find(
      (record) => record.kind === "class-node",
    );
    expect(node.targets).toEqual([specific.id]);
    expect(node.context.targets).toEqual([specific.id]);
    expect(await decode(encode(result.document))).toEqual(result.document);
  },
);

test("annotation signature closure supersedes a generic property role", async () => {
  const before = (await edit(await blank(), named("p", "rdf-property")))
    .document;
  const result = await edit(before, [
    {
      kind: "set-ontology",
      ontology: {
        imports: [],
        annotations: [
          {
            predicate: "urn:p",
            value: { kind: "iri", iri: "urn:value" },
            annotations: [],
          },
        ],
      },
    },
  ]);
  const p = result.document.structural.subjects.find(
    (record) => record.iri === "urn:p",
  );
  expect(
    result.document.structural.roles
      .filter((record) => record.subject === p.id)
      .map((record) => record.kind),
  ).toEqual(["annotation-property"]);
});

test("many-to-one semantic aliases preserve the merged glyph's correspondence", async () => {
  const before = (
    await edit(await blank(), [
      ...named("A"),
      ...named("B"),
      insert("constructs", {
        id: "equivalent",
        kind: "equivalent-classes",
        members: ["A", "B"],
      }),
    ])
  ).document;
  const subject = before.structural.subjects.find(
    (record) => record.iri === "urn:A",
  );
  const previous = before.structural.occurrences[0].id;
  const result = await edit(before, [
    { kind: "replace", id: subject.id, record: { ...subject, iri: "urn:B" } },
  ]);
  expect(
    result.correspondence.find((pair) => pair.previous === previous).current,
  ).toBe(result.document.structural.occurrences[0].id);
  expect(result.created).toEqual([]);
});

test.each([false, true])(
  "missing normalized defaults precede projection completeness: node=%s",
  async (node) => {
    const model = source();
    model.structural.subjects = [
      { id: "sA", iri: "urn:A" },
      { id: "sp", iri: "urn:p" },
    ];
    model.structural.roles = [
      { id: "A", kind: "class", subject: "sA" },
      { id: "p", kind: "object-property", subject: "sp" },
    ];
    if (node) {
      model.structural.occurrences = [
        { id: "o", kind: "class-node", targets: ["A"] },
      ];
    }
    await expect(canonicalize(model, options)).rejects.toMatchObject({
      code: "NORMALIZATION_INVALID",
    });
  },
);
