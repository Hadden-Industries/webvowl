import assert from "node:assert/strict";
import { canonicalize, decode, edit, encode, profiles } from "vowl";

const iri = (name) => `urn:f02-review:${name}`;
const insert = (collection, record) => ({ kind: "insert", collection, record });
const entity = (name, kind) => [
  insert("subjects", { id: `${name}:s`, iri: iri(name) }),
  insert("roles", { id: `${name}:r`, kind, subject: `${name}:s` }),
];
const empty = () =>
  canonicalize(
    {
      structural: {
        ontology: { imports: [], annotations: [] },
        subjects: [],
        roles: [],
        expressions: [],
        constructs: [],
        occurrences: [],
      },
    },
    { profile: profiles.structuralContent },
  );
const roleKinds = (document, name) => {
  const subject = document.structural.subjects.find(
    (record) => record.iri === iri(name),
  );
  return document.structural.roles
    .filter((record) => record.subject === subject?.id)
    .map((record) => record.kind)
    .sort();
};
async function stable(document) {
  const bytes = encode(document);
  assert.deepEqual(encode(await decode(bytes)), bytes);
  assert.deepEqual(encode((await edit(document, [])).document), bytes);
  return bytes;
}

test("generic-role indexing preserves unambiguous promotion and generic-only roles", async () => {
  const changes = [
    ...entity("A", "class"),
    insert("roles", { id: "A:generic", kind: "rdf-class", subject: "A:s" }),
    ...entity("B", "rdf-class"),
    ...entity("P", "annotation-property"),
    insert("roles", { id: "P:generic", kind: "rdf-property", subject: "P:s" }),
  ];
  const document = (await edit(await empty(), changes)).document;
  assert.deepEqual(roleKinds(document, "A"), ["class"]);
  assert.deepEqual(roleKinds(document, "B"), ["rdf-class"]);
  assert.deepEqual(roleKinds(document, "P"), ["annotation-property"]);
  return { bytes: await stable(document) };
});

test("generic property promotion still rejects two competing explicit property roles", async () => {
  const changes = [
    ...entity("P", "rdf-property"),
    insert("roles", {
      id: "P:object",
      kind: "object-property",
      subject: "P:s",
    }),
    insert("roles", { id: "P:data", kind: "data-property", subject: "P:s" }),
  ];
  await assert.rejects(edit(await empty(), changes), {
    code: "EDIT_AMBIGUOUS",
    pointer: "/structural/roles",
  });
});

test("batched signature closure preserves repeated nested annotations and datatype roles", async () => {
  const changes = [
    ...entity("Target", "class"),
    ...entity("P", "rdf-property"),
    ...entity("Q", "rdf-property"),
  ];
  for (let i = 0; i < 18; i++) {
    changes.push(
      insert("constructs", {
        id: `a${i}`,
        kind: "annotation-assertion",
        subject: "Target:s",
        predicate: iri(i % 2 ? "P" : "Q"),
        value: {
          kind: "typed",
          lexical: String(i),
          datatype: iri(`D${i % 3}`),
        },
      }),
    );
  }
  changes.push({
    kind: "set-ontology",
    ontology: {
      imports: [],
      annotations: [
        {
          predicate: iri("P"),
          value: { kind: "typed", lexical: "outer", datatype: iri("D1") },
          annotations: [
            {
              predicate: iri("Q"),
              value: { kind: "language", lexical: "nested", language: "EN" },
              annotations: [],
            },
          ],
        },
      ],
    },
  });
  const document = (await edit(await empty(), changes)).document;
  assert.deepEqual(roleKinds(document, "P"), ["annotation-property"]);
  assert.deepEqual(roleKinds(document, "Q"), ["annotation-property"]);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(roleKinds(document, `D${i}`), ["datatype"]);
  }
  assert.equal(
    document.structural.roles.filter((record) => record.kind === "datatype")
      .length,
    4,
  );
  assert.equal(document.structural.constructs.length, 18);
  assert.deepEqual(
    document.structural.constructs.map((record) => record.value.lexical).sort(),
    Array.from({ length: 18 }, (_, i) => String(i)).sort(),
  );
  assert.equal(
    document.structural.ontology.annotations[0].annotations[0].value.language,
    "en",
  );
  assert.equal(
    document.structural.ontology.annotations[0].annotations[0].value.lexical,
    "nested",
  );
  return { bytes: await stable(document) };
});

test("one endpoint graph preserves six independent class and data aggregate groups", async () => {
  const changes = [
    ...["A", "B", "C", "D"].flatMap((name) => entity(name, "class")),
    ...["D0", "D1"].flatMap((name) => entity(name, "datatype")),
    ...entity("p", "object-property"),
    ...entity("q", "object-property"),
    ...entity("dp", "data-property"),
  ];
  const groups = [
    ["object-domain", "p", ["A", "B"]],
    ["object-range", "p", ["C", "D"]],
    ["object-domain", "q", ["B", "C"]],
    ["object-range", "q", ["A", "D"]],
    ["data-domain", "dp", ["A", "C"]],
    ["data-range", "dp", ["D0", "D1"]],
  ];
  for (const [index, [kind, property, targets]] of groups.entries()) {
    targets.forEach((target, offset) =>
      changes.push(
        insert("constructs", {
          id: `k${index}:${offset}`,
          kind,
          property: `${property}:r`,
          target: `${target}:r`,
        }),
      ),
    );
  }
  const document = (await edit(await empty(), changes)).document;
  const records = new Map(
    Object.values(document.structural)
      .filter(Array.isArray)
      .flat()
      .map((record) => [record.id, record]),
  );
  const roleIri = (id) => records.get(records.get(id).subject).iri;
  assert.equal(document.structural.constructs.length, 6);
  assert.equal(document.structural.expressions.length, 6);
  for (const [kind, property, targets] of groups) {
    const construct = document.structural.constructs.find(
      (record) =>
        record.kind === kind && roleIri(record.property) === iri(property),
    );
    const expression = records.get(construct.target);
    assert.equal(
      expression.kind,
      kind === "data-range" ? "data-intersection" : "class-intersection",
    );
    assert.deepEqual(
      expression.members.map(roleIri).sort(),
      targets.map(iri).sort(),
    );
  }
  return { bytes: await stable(document) };
});

async function observeAbort(stage) {
  const n = 256;
  const changes = [];
  for (let i = 0; i < n; i++) {
    changes.push(
      ...entity(`Bulk${i}`, stage === "generic" ? "rdf-class" : "class"),
    );
  }
  if (stage === "signature") {
    changes.push(
      ...entity("Predicate", "annotation-property"),
      ...entity("Datatype", "datatype"),
    );
    for (let i = 0; i < 48; i++) {
      changes.push(
        insert("constructs", {
          id: `note${i}`,
          kind: "annotation-assertion",
          subject: "Bulk0:s",
          predicate: iri("Predicate"),
          value: {
            kind: "typed",
            lexical: String(i),
            datatype: iri("Datatype"),
          },
        }),
      );
    }
  }
  const document = await empty();
  const controller = new AbortController();
  const originalFind = Array.prototype.find;
  const originalGet = Map.prototype.get;
  let identifyingCaller = false;
  const caller = () => {
    // Source-map stack formatters can themselves use Map.get or Array.find.
    // Keep that work outside the instrumentation to avoid recursive probing.
    if (identifyingCaller) {
      return "";
    }
    identifyingCaller = true;
    try {
      return new Error().stack.split("\n")[3] ?? "";
    } finally {
      identifyingCaller = false;
    }
  };
  const observed = {
    stage,
    fired: false,
    visits: 0,
    visitsAfterAbort: 0,
    scanVisits: 0,
    indexVisits: 0,
  };
  const visit = (kind) => {
    observed.visits++;
    observed[kind]++;
    if (observed.fired) {
      observed.visitsAfterAbort++;
    }
    if (observed.visits === 100) {
      observed.fired = true;
      controller.abort();
    }
  };
  // The old scan and new index both reach a real AbortController transition.
  // No private core module or budget is replaced; the wrappers count actual work.
  Array.prototype.find = function (predicate, thisArg) {
    const frame = caller();
    const selected =
      stage === "generic"
        ? frame.includes("at normalizeDraft (") &&
          this.length === n &&
          this[0]?.kind === "rdf-class"
        : frame.includes("at ensureRole (") &&
          this[0]?.id?.startsWith("Bulk0:");
    if (!selected) {
      return originalFind.call(this, predicate, thisArg);
    }
    return originalFind.call(this, (value, index, array) => {
      visit("scanVisits");
      return predicate.call(thisArg, value, index, array);
    });
  };
  Map.prototype.get = function (key) {
    const value = originalGet.call(this, key);
    const frame = caller();
    const selected =
      stage === "generic"
        ? frame.includes("at normalizeDraft (") &&
          value instanceof Map &&
          originalGet.call(value, "rdf-class")?.subject === key
        : frame.includes("at ensureRole (");
    if (selected) {
      visit("indexVisits");
    }
    return value;
  };
  try {
    await assert.rejects(
      edit(document, changes, {
        signal: controller.signal,
        limits: { deadlineMs: 3000 },
      }),
      { code: "ABORTED" },
    );
  } finally {
    Array.prototype.find = originalFind;
    Map.prototype.get = originalGet;
  }
  assert.equal(observed.fired, true, `The ${stage} abort did not fire`);
  assert.ok(observed.visitsAfterAbort <= 1024, JSON.stringify(observed));
  return observed;
}

test("generic-role normalization observes a genuine abort within 1024 further visits", () =>
  observeAbort("generic"));
test("repeated signature closure observes a genuine abort within 1024 further visits", () =>
  observeAbort("signature"));
