import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { admitCompatibleArtifact } from "../src/compatibleArtifact.js";
import { ResourceBudget } from "../src/resourceBudget.js";
import {
  compatibleArtifactProfile,
  compatibleArtifactSchema,
} from "../src/compatibleContract.js";
import {
  canonicalize,
  decode,
  encode,
  openCanonical,
  inspectModel,
  checkpointModel,
  readmitModel,
  edit,
  editModel,
  captureModel,
} from "vowl";
import { openOwl } from "vowl/owl";

const fixture = () =>
  JSON.parse(
    readFileSync(
      new URL(
        "../conformance/vectors/named-class-artifact/source.json",
        import.meta.url,
      ),
    ),
  );
function source() {
  return {
    ...fixture(),
    qualifications: {
      sourceNodes: [],
      sourceStatements: [],
      documents: [
        {
          id: "doc:root",
          root: true,
          headers: "one",
          ontologyIri: "urn:ontology",
        },
      ],
      imports: [],
      entries: [
        {
          id: "qual:scope",
          dimension: "scope",
          code: "SOURCE_ASSOCIATIONS_UNAVAILABLE",
          records: [],
          documents: ["doc:root"],
          rule: "https://haddenindustries.com/ontology/profiles/vowl/compatible-view/v1#original-assessment",
          detail: { kind: "scope" },
        },
      ],
    },
  };
}
async function admit(value, original) {
  const budget = new ResourceBudget({}, performance.now());
  try {
    return await admitCompatibleArtifact(value, budget, original);
  } finally {
    budget.dispose();
  }
}

test("generated compatible schema accepts issued IDs and rejects open qualification payloads", async () => {
  const schema = JSON.parse(
    readFileSync(
      new URL("../schema/compatible-artifact.schema.json", import.meta.url),
    ),
  );
  expect(schema).toEqual(compatibleArtifactSchema());
  const validate = new Ajv2020({
    strict: true,
    validateFormats: false,
  }).compile(schema);
  const { document, bytes } = await admit(source());
  expect(validate(document)).toBe(true);
  for (const change of [
    (value) => {
      value.qualifications.documents[0].id = "local:doc";
    },
    (value) => {
      value.qualifications.entries[0].detail.prose = "untyped evidence";
    },
    (value) => {
      value.qualifications.documents[0].retrievalUrl =
        "https://example.org/private";
    },
  ]) {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    change(value);
    expect(validate(value)).toBe(false);
  }
});

test("compatible artifact identity covers graph, scene and portable qualification without local handles", async () => {
  const first = source();
  const second = source();
  second.qualifications.documents[0].id = "renamed:document";
  second.qualifications.entries[0].documents = ["renamed:document"];
  second.qualifications.entries[0].id = "renamed:qualification";
  const left = await admit(first);
  const right = await admit(second);
  expect(left.bytes).toEqual(right.bytes);
  expect(left.document.profile).toBe(compatibleArtifactProfile);
  expect(left.document.qualifications.documents[0].id).toBe("d0");
  const decoded = JSON.parse(new TextDecoder().decode(left.bytes));
  delete decoded.profile;
  expect((await admit(decoded, left.bytes)).bytes).toEqual(left.bytes);
  for (const change of [
    (value) => {
      value.qualifications.entries[0].code =
        "SOURCE_HEADER_ASSOCIATIONS_UNAVAILABLE";
    },
    (value) => {
      value.visualization.camera.zoom = 2;
    },
    (value) => {
      value.structural.subjects[0].iri = "urn:changed";
    },
  ]) {
    const value = source();
    change(value);
    expect((await admit(value)).bytes).not.toEqual(left.bytes);
  }
});

test("portable qualification admission rejects dangling references, raw buffers and incomplete closure state", async () => {
  for (const change of [
    (value) => {
      value.qualifications.entries[0].documents = ["absent"];
    },
    (value) => {
      value.qualifications.entries[0].records = ["absent"];
    },
    (value) => {
      value.qualifications.documents[0].bytes = [1, 2];
    },
    (value) => {
      value.qualifications.imports = [
        {
          id: "edge",
          parentDocument: "doc:root",
          requestedIri: "urn:import",
          state: "acquired",
        },
      ];
    },
    (value) => {
      value.qualifications.documents[0].root = false;
    },
  ]) {
    const value = source();
    change(value);
    await expect(admit(value)).rejects.toBeDefined();
  }
});

function scene(inspection) {
  const visualization = fixture().visualization;
  visualization.placements = inspection.occurrences
    .filter(({ kind }) =>
      ["class-node", "datatype-node", "label"].includes(kind),
    )
    .map(({ id }, index) => ({
      occurrence: id,
      position: { x: index * 20, y: 10 },
      pinned: index === 0,
    }));
  visualization.hidden = [];
  return visualization;
}

test("public qualified artifact save/reload retains property choice, header selection and edit guards", async () => {
  const text =
    "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. <urn:a> a owl:Ontology. <urn:b> a owl:Ontology. <urn:p> a owl:ObjectProperty, owl:AnnotationProperty; rdfs:domain <urn:C>. <urn:C> a owl:Class.";
  const opened = await openOwl(new TextEncoder().encode(text), {
    documentIri: "urn:a",
    mediaType: "text/turtle",
  });
  const captured = await captureModel(opened.model, {
    profile: compatibleArtifactProfile,
    visualization: scene(inspectModel(opened.model)),
  });
  const bytes = encode(captured.document);
  const decoded = await decode(bytes);
  expect(encode(decoded)).toEqual(bytes);
  expect(
    decoded.qualifications.entries.some(
      ({ detail }) =>
        detail.kind === "headers" && detail.candidates.length === 2,
    ),
  ).toBe(true);
  expect(
    decoded.qualifications.entries.some(
      ({ detail }) =>
        detail.kind === "property" && detail.evidence === "precedence",
    ),
  ).toBe(true);
  expect(new TextDecoder().decode(bytes)).not.toContain("inputDigest");
  const restored = await openCanonical(decoded);
  const inspection = inspectModel(restored.model);
  expect(
    inspection.documents.every(
      ({ bytesAvailable }) => bytesAvailable === false,
    ),
  ).toBe(true);
  expect(inspection.qualifications.length).toBe(
    decoded.qualifications.entries.length,
  );
  const checkpoint = JSON.parse(
    JSON.stringify(await checkpointModel(restored.model)),
  );
  const recovered = await readmitModel(checkpoint);
  const property = inspectModel(recovered.model).records.subjects.find(
    ({ iri }) => iri === "urn:p",
  );
  await expect(
    editModel(recovered.model, [
      {
        kind: "replace",
        id: property.id,
        record: { ...property, iri: "urn:new-p" },
      },
    ]),
  ).rejects.toMatchObject({ code: "EDIT_SOURCE_DEPENDENCY_UNRESOLVED" });
  await expect(edit(decoded, [])).rejects.toMatchObject({
    code: "CAPTURE_QUALIFICATION_UNREPRESENTABLE",
  });
  const again = await captureModel(recovered.model, {
    profile: compatibleArtifactProfile,
    visualization: scene(inspectModel(recovered.model)),
  });
  expect(again.document.qualifications.entries).toEqual(
    decoded.qualifications.entries,
  );
});

test("public canonicalize retains closed qualifications and rejects altered serialized bytes", async () => {
  const document = await canonicalize(source(), {
    profile: compatibleArtifactProfile,
  });
  const bytes = encode(document);
  await expect(
    decode(new TextEncoder().encode(new TextDecoder().decode(bytes) + "\n")),
  ).rejects.toMatchObject({ code: "NON_CANONICAL_BYTES" });
});

test("residual RDF survives compatible save, reopen and unrelated edits without becoming OWL", async () => {
  const input =
    '@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix xsd: <http://www.w3.org/2001/XMLSchema#>. <urn:root> a owl:Ontology. <urn:C> a owl:Class. _:local <urn:unknown> "01"^^xsd:integer.';
  const opened = await openOwl(new TextEncoder().encode(input), {
    documentIri: "urn:root",
    mediaType: "text/turtle",
  });
  const initial = inspectModel(opened.model);
  expect(initial.sourceStatements.length).toBeGreaterThan(0);
  expect(
    initial.sourceStatements.some(
      ({ object }) =>
        object.kind === "literal" && object.value.lexical === "01",
    ),
  ).toBe(true);
  const captured = await captureModel(opened.model, {
    profile: compatibleArtifactProfile,
    visualization: scene(initial),
  });
  const bytes = encode(captured.document);
  expect(new TextDecoder().decode(bytes)).not.toContain("_:local");
  const reopened = await openCanonical(await decode(bytes));
  const inspection = inspectModel(reopened.model);
  expect(inspection.sourceStatements).toEqual(
    captured.document.qualifications.sourceStatements,
  );
  expect(inspection.sourceNodes).toEqual(
    captured.document.qualifications.sourceNodes,
  );
  await expect(
    editModel(reopened.model, [
      {
        kind: "insert",
        collection: "subjects",
        record: { id: "new:uncertain", iri: "urn:unknown" },
      },
    ]),
  ).rejects.toMatchObject({ code: "EDIT_SOURCE_DEPENDENCY_UNRESOLVED" });
  const edited = await editModel(reopened.model, [
    {
      kind: "insert",
      collection: "subjects",
      record: { id: "new:s", iri: "urn:Unrelated" },
    },
    {
      kind: "insert",
      collection: "roles",
      record: { id: "new:r", kind: "class", subject: "new:s" },
    },
  ]);
  const next = await captureModel(edited.model, {
    profile: compatibleArtifactProfile,
    visualization: scene(inspectModel(edited.model)),
  });
  expect(
    next.document.qualifications.sourceStatements.some(
      ({ object }) =>
        object.kind === "literal" && object.value.lexical === "01",
    ),
  ).toBe(true);
});

test("source blank identity is document scoped, renamed invariant and closed against dangling references", async () => {
  const first = source();
  first.qualifications.documents.push({
    id: "doc:other",
    root: false,
    headers: "none",
  });
  first.qualifications.sourceNodes = [
    { id: "blank:a", document: "doc:root" },
    { id: "blank:b", document: "doc:other" },
  ];
  first.qualifications.sourceStatements = first.qualifications.sourceNodes.map(
    ({ id, document }, index) => ({
      id: `statement:${index}`,
      document,
      graph: { kind: "default" },
      subject: { kind: "blank", node: id },
      predicate: "urn:unknown",
      object: {
        kind: "literal",
        value: {
          lexical: "01",
          datatype: "http://www.w3.org/2001/XMLSchema#integer",
          language: "",
          direction: "",
        },
      },
    }),
  );
  const canonical = await admit(first);
  const second = source();
  second.qualifications = JSON.parse(JSON.stringify(first.qualifications));
  second.qualifications.sourceNodes.reverse();
  second.qualifications.sourceStatements.reverse();
  for (const node of second.qualifications.sourceNodes) {
    node.id += ":renamed";
  }
  for (const statement of second.qualifications.sourceStatements) {
    statement.id += ":renamed";
    statement.subject.node += ":renamed";
  }
  expect((await admit(second)).bytes).toEqual(canonical.bytes);
  expect(canonical.document.qualifications.sourceNodes).toHaveLength(2);
  const invalid = JSON.parse(JSON.stringify(second));
  invalid.qualifications.sourceStatements[0].subject.node =
    invalid.qualifications.sourceNodes[1].id;
  await expect(admit(invalid)).rejects.toMatchObject({
    code: "REFERENCE_INVALID",
  });
  invalid.qualifications.sourceStatements[0].subject.node = "missing";
  await expect(admit(invalid)).rejects.toMatchObject({
    code: "REFERENCE_INVALID",
  });
});

test("residual literal identity retains lexical, datatype, language and direction distinctions", async () => {
  const make = () => {
    const value = source();
    value.qualifications.sourceStatements.push({
      id: "source:statement",
      document: "doc:root",
      graph: { kind: "default" },
      subject: { kind: "iri", iri: "urn:source" },
      predicate: "urn:predicate",
      object: {
        kind: "literal",
        value: {
          lexical: "01",
          datatype: "http://www.w3.org/2001/XMLSchema#integer",
          language: "",
        },
      },
    });
    return value;
  };
  const baseline = (await admit(make())).bytes;
  for (const change of [
    (statement) => {
      statement.subject.iri = "urn:other";
    },
    (statement) => {
      statement.predicate = "urn:other";
    },
    (statement) => {
      statement.object.value.lexical = "1";
    },
    (statement) => {
      statement.object.value.datatype =
        "http://www.w3.org/2001/XMLSchema#string";
    },
    (statement) => {
      statement.object.value.language = "en";
    },
    (statement) => {
      statement.object.value.direction = "ltr";
    },
  ]) {
    const value = make();
    change(value.qualifications.sourceStatements[0]);
    expect((await admit(value)).bytes).not.toEqual(baseline);
  }
});
