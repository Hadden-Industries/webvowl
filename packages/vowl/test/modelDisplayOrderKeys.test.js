import { jest } from "@jest/globals";
import rdf from "rdf-canonize";
import { readFileSync } from "node:fs";
import { openOwl } from "vowl/owl";
import {
  DISPLAY_ORDER_KEY_PURPOSE,
  readModelDisplayOrderKeys,
  inspectModel,
  checkpointModel,
  editModel,
  openCanonical,
  canonicalize,
  captureModel,
  readModelSource,
  compatibleArtifactProfile,
  encode,
  profiles,
} from "vowl";
import { mapDisplayOrder } from "../src/displayOrderKeys.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const prefix =
  "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. @prefix xsd: <http://www.w3.org/2001/XMLSchema#>. ";
const load = (text) =>
  openOwl(new TextEncoder().encode(prefix + text), {
    documentIri: "urn:display-test",
    mediaType: "text/turtle",
  });
const isNode = ({ kind }) => ["class-node", "datatype-node"].includes(kind);

async function observed(model) {
  const inspection = inspectModel(model);
  const keys = await readModelDisplayOrderKeys(model);
  expect(keys.purpose).toBe(DISPLAY_ORDER_KEY_PURPOSE);
  expect(keys.revision).toBe(inspection.revision);
  expect(Object.isFrozen(keys.correspondence)).toBe(true);
  expect(keys.correspondence.every(Object.isFrozen)).toBe(true);
  const indexed = new Map(
    keys.correspondence.map(({ previous, current }) => [previous, current]),
  );
  const nodes = inspection.occurrences.filter(isNode);
  expect(indexed.size).toBe(nodes.length);
  expect(new Set(indexed.values()).size).toBe(nodes.length);
  expect(nodes.every(({ id }) => indexed.has(id))).toBe(true);
  const records = new Map(
    Object.values(inspection.records)
      .filter(Array.isArray)
      .flat()
      .map((record) => [record.id, record]),
  );
  return {
    keys,
    named: nodes
      .map((node) => ({
        key: indexed.get(node.id),
        kind: node.kind,
        targets: (node.targets ?? [node.target])
          .map((id) => {
            const target = records.get(id);
            return [target.kind, records.get(target.subject)?.iri ?? null];
          })
          .sort(),
      }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

test("finite named-node mapping has independently specified ground terms", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const mapped = mapDisplayOrder(
      {
        subjects: [{ id: "source", iri: "urn:A" }],
        roles: [{ id: "role", kind: "class", subject: "source" }],
        expressions: [],
        constructs: [],
        occurrences: [{ id: "node", kind: "class-node", targets: ["role"] }],
      },
      budget,
    );
    expect(mapped.blankCount).toBe(1);
    expect(
      mapped.dataset.map(({ subject, predicate, object }) => [
        subject.value,
        predicate.value,
        object.termType,
        object.value,
      ]),
    ).toEqual([
      [
        "d0",
        "urn:webvowl:display-order:v1:kind",
        "NamedNode",
        "urn:webvowl:display-order:v1:class-node",
      ],
      [
        "d0",
        "urn:webvowl:display-order:v1:target",
        "Literal",
        '["class","urn:A"]',
      ],
    ]);
    expect(mapped.dataset[1].object.datatype.value).toBe(
      "urn:webvowl:display-order:v1:anchor",
    );
  } finally {
    budget.dispose();
  }
});

test("source order, blank spelling and operator member order preserve display keys", async () => {
  const first = await load(
    "<urn:A> a owl:Class; rdfs:subClassOf _:x. <urn:B> a owl:Class. _:x owl:unionOf (<urn:A> <urn:B>).",
  );
  const second = await load(
    "_:expr owl:unionOf (<urn:B> <urn:A>). <urn:B> a owl:Class. <urn:A> rdfs:subClassOf _:expr; a owl:Class.",
  );
  expect((await observed(first.model)).named).toEqual(
    (await observed(second.model)).named,
  );
});

test("display-irrelevant annotations leave ordering keys unchanged", async () => {
  const first = await load(
    "<urn:A> a owl:Class; rdfs:subClassOf <urn:B>. <urn:B> a owl:Class.",
  );
  const second = await load(
    '<urn:B> a owl:Class; rdfs:comment "extra source detail". <urn:A> a owl:Class; rdfs:label "Different visible label"@en; rdfs:subClassOf <urn:B>.',
  );
  expect((await observed(first.model)).named).toEqual(
    (await observed(second.model)).named,
  );
});

test("punning, equivalence groups and contextual datatypes retain distinct anchors", async () => {
  const { model } = await load(
    "<urn:A> a owl:Class; owl:equivalentClass <urn:B>. <urn:B> a owl:Class. <urn:A> a owl:ObjectProperty; rdfs:domain <urn:A>; rdfs:range <urn:B>. <urn:p> a owl:DatatypeProperty; rdfs:domain <urn:A>; rdfs:range xsd:string. <urn:q> a owl:DatatypeProperty; rdfs:domain <urn:A>; rdfs:range xsd:string.",
  );
  const result = await observed(model);
  const types = result.named.filter(({ kind }) => kind === "datatype-node");
  expect(types).toHaveLength(2);
  expect(types[0].key).not.toBe(types[1].key);
  expect(
    result.named.find(({ kind }) => kind === "class-node").targets,
  ).toEqual([
    ["class", "urn:A"],
    ["class", "urn:B"],
  ]);
  const checkpoint = await checkpointModel(model);
  const budget = new ResourceBudget({}, performance.now());
  try {
    const { dataset } = mapDisplayOrder(checkpoint.structural, budget);
    const anchors = dataset
      .filter(({ object }) => object.termType === "Literal")
      .map(({ object }) => object.value);
    expect(anchors).toContain('["class","urn:A"]');
    expect(anchors).toContain('["object-property","urn:A"]');
    expect(anchors).toContain('["data-property","urn:p"]');
    expect(anchors).toContain('["data-property","urn:q"]');
  } finally {
    budget.dispose();
  }
});

async function canonicalMapping(structural) {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const { dataset } = mapDisplayOrder(structural, budget);
    return await rdf.canonize(dataset, {
      algorithm: "RDFC-1.0",
      maxDeepIterations: 1000,
    });
  } finally {
    budget.dispose();
  }
}

test("restriction scope, exact large cardinality and inverse direction enter the mapping", async () => {
  const { model } = await load(
    '<urn:A> a owl:Class; rdfs:subClassOf [a owl:Restriction; owl:onProperty <urn:p>; owl:minCardinality "9007199254740993"^^xsd:nonNegativeInteger]. <urn:p> a owl:ObjectProperty; rdfs:domain <urn:A>; rdfs:range owl:Thing; owl:inverseOf <urn:q>. <urn:q> a owl:ObjectProperty; rdfs:domain owl:Thing; rdfs:range <urn:A>.',
  );
  await observed(model);
  const { structural } = await checkpointModel(model);
  const original = await canonicalMapping(structural);
  expect(original).toContain("9007199254740993");
  expect(original).toContain("<urn:webvowl:display-order:v1:scope>");
  expect(original).toContain("<urn:webvowl:display-order:v1:forward>");
  expect(original).toContain("<urn:webvowl:display-order:v1:reverse>");
  const changed = structuredClone(structural);
  changed.expressions.find(
    ({ cardinality }) => cardinality !== undefined,
  ).cardinality = "9007199254740994";
  expect(await canonicalMapping(changed)).not.toEqual(original);
  const reversed = structuredClone(structural);
  const edge = reversed.occurrences.find(({ kind }) => kind === "inverse-edge");
  [edge.forward, edge.reverse] = [edge.reverse, edge.forward];
  expect(await canonicalMapping(reversed)).not.toEqual(original);
});

test("symmetric anonymous nodes have unique revision keys and equivalent cross-load results", async () => {
  async function fixture(name) {
    const source = JSON.parse(
      readFileSync(
        new URL(
          `../conformance/vectors/symmetric-anonymous-classes/${name}.json`,
          import.meta.url,
        ),
      ),
    );
    return openCanonical(
      await canonicalize(source, { profile: profiles.structuralContent }),
    );
  }
  const first = await fixture("source");
  const second = await fixture("permuted-source");
  const left = await observed(first.model);
  const right = await observed(second.model);
  expect(left.named).toHaveLength(2);
  expect(left.named).toEqual(right.named);
  await expect(
    readModelDisplayOrderKeys(first.model, {
      limits: { rdfDeepIterations: 0 },
    }),
  ).rejects.toMatchObject({ code: "RDFC_RESOURCE_LIMIT" });
});

test("separate parallel disjoint occurrences and shared anonymous subjects are not collapsed", async () => {
  const structural = {
    subjects: [{ id: "s" }, { id: "t" }],
    roles: [
      { id: "r", kind: "class", subject: "s" },
      { id: "punned", kind: "rdf-class", subject: "s" },
      { id: "other", kind: "class", subject: "t" },
    ],
    expressions: [],
    constructs: [],
    occurrences: [
      { id: "a", kind: "class-node", targets: ["r"] },
      { id: "b", kind: "class-node", targets: ["punned"] },
      { id: "c", kind: "class-node", targets: ["other"] },
      { id: "edge1", kind: "disjoint-edge", ends: ["a", "c"] },
      { id: "edge2", kind: "disjoint-edge", ends: ["a", "c"] },
    ],
  };
  const mapped = await canonicalMapping(structural);
  expect(
    mapped.match(/<urn:webvowl:display-order:v1:disjoint-edge>/g),
  ).toHaveLength(2);
  const single = structuredClone(structural);
  single.occurrences.pop();
  expect(await canonicalMapping(single)).not.toEqual(mapped);
  const unshared = structuredClone(structural);
  unshared.subjects.push({ id: "third" });
  unshared.roles[1].subject = "third";
  expect(await canonicalMapping(unshared)).not.toEqual(mapped);
});

test("display reads preserve canonical capture and explicit saved-view references", async () => {
  const source = JSON.parse(
    readFileSync(
      new URL(
        "../conformance/vectors/named-class-artifact/source.json",
        import.meta.url,
      ),
    ),
  );
  source.visualization.hidden = [source.structural.occurrences[0].id];
  source.visualization.placements[0].position = { x: 317, y: -42 };
  source.visualization.placements[0].pinned = true;
  const document = await canonicalize(source, {
    profile: profiles.artifact,
  });
  const { model, correspondence } = await openCanonical(document);
  const handles = new Map(
    correspondence.map(({ previous, current }) => [previous, current]),
  );
  // Jest structuredClone returns foreign VM prototypes; transport this fixture
  // into the admitting realm, as a browser worker's message transport does.
  const visualization = JSON.parse(JSON.stringify(document.visualization));
  for (const placement of visualization.placements) {
    placement.occurrence = handles.get(placement.occurrence);
  }
  visualization.hidden = visualization.hidden.map((id) => handles.get(id));
  const options = { profile: profiles.artifact, visualization };
  const before = await checkpointModel(model);
  const original = await captureModel(model, options);
  expect(encode(original.document)).toEqual(encode(document));
  await observed(model);
  expect(await checkpointModel(model)).toEqual(before);
  expect(encode((await captureModel(model, options)).document)).toEqual(
    encode(original.document),
  );
});

test("display reads preserve imported source bytes, semantic records and capture qualifications", async () => {
  const root = new TextEncoder().encode(
    prefix +
      "<urn:root> a owl:Ontology; owl:imports <urn:import>. <urn:A> a owl:Class.",
  );
  const imported = new TextEncoder().encode(
    prefix + "<urn:import> a owl:Ontology. <urn:B> a owl:Class.",
  );
  const { model } = await openOwl(root, {
    documentIri: "urn:root",
    mediaType: "text/turtle",
    resolveImport: async () => ({
      bytes: imported,
      documentIri: "urn:import",
      mediaType: "text/turtle",
    }),
  });
  const before = inspectModel(model);
  const checkpoint = await checkpointModel(model);
  const options = {
    profile: compatibleArtifactProfile,
    visualization: {
      placements: before.occurrences.filter(isNode).map(({ id }, i) => ({
        occurrence: id,
        position: { x: i * 100, y: 20 },
        pinned: false,
      })),
      hidden: [],
      camera: { center: { x: 50, y: 20 }, zoom: 0.75 },
      prefixes: [],
      labelSelection: { mode: "iri" },
      display: {
        compactNotation: false,
        nodeScaling: "uniform",
        externalColoring: false,
      },
    },
  };
  const artifact = encode((await captureModel(model, options)).document);
  const sources = await Promise.all(
    before.documents.map(({ id }) => readModelSource(model, id)),
  );
  expect(sources.map(({ bytes }) => bytes)).toEqual([root, imported]);
  expect((await observed(model)).named).toHaveLength(2);
  expect(inspectModel(model)).toBe(before);
  expect(await checkpointModel(model)).toEqual(checkpoint);
  expect(
    await Promise.all(
      before.documents.map(({ id }) => readModelSource(model, id)),
    ),
  ).toEqual(sources);
  expect(encode((await captureModel(model, options)).document)).toEqual(
    artifact,
  );
  await expect(
    captureModel(model, { profile: profiles.structuralContent }),
  ).rejects.toMatchObject({ code: "CAPTURE_QUALIFICATION_UNREPRESENTABLE" });
});

test("revision replacement does not mutate old keys and empty models have no keys", async () => {
  const { model } = await load("<urn:A> a owl:Class.");
  const before = await readModelDisplayOrderKeys(model);
  const inspection = inspectModel(model);
  const role = inspection.records.roles.find(({ kind }) => kind === "class");
  const next = await editModel(model, [
    { kind: "remove", id: role.id },
    { kind: "remove", id: role.subject },
  ]);
  expect(await readModelDisplayOrderKeys(next.model)).toEqual({
    purpose: "display-order-v1",
    revision: 1,
    correspondence: [],
  });
  expect(await readModelDisplayOrderKeys(model)).toEqual(before);
});

test("display reads enforce cancellation during async hashing and native resource caps", async () => {
  await expect(
    readModelDisplayOrderKeys({ revision: 0 }),
  ).rejects.toMatchObject({ code: "MODEL_NOT_ADMITTED" });
  const { model } = await load("<urn:A> a owl:Class.");
  // Each limit fails with its one code, as it does in every other stage.
  for (const [limits, code] of [
    [{ rdfQuads: 1 }, "RDF_RESOURCE_LIMIT"],
    [{ embeddedValues: 1 }, "MODEL_RESOURCE_LIMIT"],
    [{ totalStringBytes: 1 }, "MODEL_RESOURCE_LIMIT"],
  ]) {
    await expect(
      readModelDisplayOrderKeys(model, { limits }),
    ).rejects.toMatchObject({
      code,
      details: { limit: Object.keys(limits)[0] },
    });
  }
  const abort = new AbortController();
  const original = crypto.subtle.digest.bind(crypto.subtle);
  const spy = jest
    .spyOn(crypto.subtle, "digest")
    .mockImplementation(async (...arguments_) => {
      const result = await original(...arguments_);
      abort.abort();
      return result;
    });
  try {
    await expect(
      readModelDisplayOrderKeys(model, { signal: abort.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  } finally {
    spy.mockRestore();
  }
  expect((await observed(model)).named).toHaveLength(1);
});
