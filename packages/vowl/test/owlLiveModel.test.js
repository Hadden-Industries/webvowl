import { openOwl } from "vowl/owl";
import {
  inspectModel,
  editModel,
  checkpointModel,
  readmitModel,
  captureModel,
  profiles,
  readModelSource,
  compatibleArtifactProfile,
  openCanonical,
} from "vowl";

const encode = (text) => new TextEncoder().encode(text);
const prefix =
  "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. ";
const options = {
  documentIri: "urn:root",
  mediaType: "text/turtle",
  limits: { rdfDeepIterations: 0 },
};
const insert = [
  {
    kind: "insert",
    collection: "subjects",
    record: { id: "new:s", iri: "urn:New" },
  },
  {
    kind: "insert",
    collection: "roles",
    record: { id: "new:r", subject: "new:s", kind: "class" },
  },
];

test("native automatic OWL selection retains the same root and extensionless import evidence", async () => {
  const root = encode(
    prefix +
      "<urn:root> a owl:Ontology; owl:imports <urn:import>. <urn:A> a owl:Class.",
  );
  const imported = encode(
    prefix + "<urn:import> a owl:Ontology. <urn:B> a owl:Class.",
  );
  const automatic = await openOwl(root, {
    documentIri: "urn:root",
    resolveImport: async () => ({ bytes: imported, documentIri: "urn:import" }),
  });
  const explicit = await openOwl(root, {
    ...options,
    resolveImport: async () => ({
      bytes: imported,
      documentIri: "urn:import",
      mediaType: "text/turtle",
    }),
  });
  expect(inspectModel(automatic.model)).toEqual(inspectModel(explicit.model));
  const checkpoint = await checkpointModel(automatic.model);
  expect(
    checkpoint.source.evidence.documents.map(({ formatKey, mediaType }) => [
      formatKey,
      mediaType,
    ]),
  ).toEqual([
    ["turtle", "text/turtle"],
    ["turtle", "text/turtle"],
  ]);
  expect(checkpoint.source.sources.map(({ bytes }) => bytes)).toEqual([
    root,
    imported,
  ]);
});

test("public original-source retrieval survives edits and recovery but never invents portable bytes", async () => {
  const bytes = encode(prefix + "<urn:A> a owl:Class.");
  const { model } = await openOwl(bytes, options);
  const documentId = inspectModel(model).documents[0].id;
  const source = await readModelSource(model, documentId);
  expect(source.bytes).toEqual(bytes);
  expect(source.mediaType).toBe("text/turtle");
  source.bytes.fill(0);
  expect((await readModelSource(model, documentId)).bytes).toEqual(bytes);
  const edited = await editModel(model, insert);
  const recovered = await readmitModel(
    transport(await checkpointModel(edited.model)),
  );
  expect((await readModelSource(recovered.model, documentId)).bytes).toEqual(
    bytes,
  );
  await expect(readModelSource(model, "unknown")).rejects.toMatchObject({
    code: "SOURCE_DOCUMENT_UNKNOWN",
  });
  await expect(readModelSource({}, documentId)).rejects.toMatchObject({
    code: "MODEL_NOT_ADMITTED",
  });
  await expect(
    readModelSource(model, documentId, { limits: { inputBytes: 1 } }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  const abort = new AbortController();
  abort.abort();
  await expect(
    readModelSource(model, documentId, { signal: abort.signal }),
  ).rejects.toMatchObject({ code: "ABORTED" });
  const captured = await captureModel(edited.model, {
    profile: compatibleArtifactProfile,
    visualization: {
      placements: inspectModel(edited.model)
        .occurrences.filter(({ kind }) =>
          ["class-node", "datatype-node", "label"].includes(kind),
        )
        .map(({ id }) => ({
          occurrence: id,
          position: { x: 0, y: 0 },
          pinned: false,
        })),
      hidden: [],
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      prefixes: [],
      labelSelection: { mode: "iri" },
      display: {
        compactNotation: false,
        nodeScaling: "uniform",
        externalColoring: false,
      },
    },
  });
  const reopened = await openCanonical(captured.document);
  await expect(
    readModelSource(reopened.model, documentId),
  ).rejects.toMatchObject({ code: "SOURCE_BYTES_UNAVAILABLE" });
});
function transport(checkpoint) {
  const { source, ...plain } = checkpoint;
  return {
    ...JSON.parse(JSON.stringify(plain)),
    source: {
      version: source.version,
      evidence: JSON.parse(JSON.stringify(source.evidence)),
      sources: source.sources.map(({ document, bytes }) => ({
        document,
        bytes: new Uint8Array(bytes),
      })),
    },
  };
}

test("live OWL closure survives editing and checkpoint recovery without RDF canonicalization or reacquisition", async () => {
  let acquisitions = 0;
  const root = encode(
    prefix +
      "<urn:root> a owl:Ontology; owl:imports <urn:import>. <urn:A> a owl:Class.",
  );
  const imported = encode(
    prefix + "<urn:import> a owl:Ontology. <urn:B> a owl:Class.",
  );
  const { model } = await openOwl(root, {
    ...options,
    resolveImport: async () => {
      acquisitions++;
      return {
        bytes: imported,
        documentIri: "urn:import",
        mediaType: "text/turtle",
      };
    },
  });
  const inspection = inspectModel(model);
  expect(inspection.origin.kind).toBe("owl");
  expect(inspection.documents).toHaveLength(2);
  expect(inspection.imports[0].state).toBe("acquired");
  expect(inspection.coverage.basis).toBe("unavailable");
  expect(
    inspection.supports.every(({ origin }) => origin === "generated"),
  ).toBe(true);
  const edited = await editModel(model, insert, { limits: options.limits });
  const checkpoint = await checkpointModel(edited.model);
  const recovered = await readmitModel(transport(checkpoint), {
    limits: options.limits,
  });
  expect(inspectModel(recovered.model)).toEqual(inspectModel(edited.model));
  expect(acquisitions).toBe(1);
  expect(checkpoint.source.sources[0].bytes).toEqual(root);
  checkpoint.source.sources[0].bytes.fill(0);
  expect((await checkpointModel(edited.model)).source.sources[0].bytes).toEqual(
    root,
  );
  await expect(
    captureModel(recovered.model, { profile: profiles.artifact }),
  ).rejects.toMatchObject({ code: "CAPTURE_QUALIFICATION_UNREPRESENTABLE" });
});

test("ambiguous source-dependent edits fail atomically while unrelated edits remain available", async () => {
  const { model } = await openOwl(
    encode(
      prefix +
        "<urn:p> a owl:ObjectProperty, owl:AnnotationProperty; rdfs:domain <urn:C>. <urn:C> a owl:Class.",
    ),
    options,
  );
  const before = inspectModel(model);
  const property = before.records.subjects.find(({ iri }) => iri === "urn:p");
  await expect(
    editModel(model, [
      {
        kind: "replace",
        id: property.id,
        record: { ...property, iri: "urn:renamed" },
      },
    ]),
  ).rejects.toMatchObject({ code: "EDIT_SOURCE_DEPENDENCY_UNRESOLVED" });
  expect(inspectModel(model)).toBe(before);
  await expect(
    editModel(model, [
      {
        kind: "insert",
        collection: "roles",
        record: {
          id: "new:ambiguous-role",
          subject: property.id,
          kind: "class",
        },
      },
    ]),
  ).rejects.toMatchObject({ code: "EDIT_SOURCE_DEPENDENCY_UNRESOLVED" });
  const edited = await editModel(model, insert);
  expect(edited.model.revision).toBe(1);
  const recovered = await readmitModel(
    transport(await checkpointModel(edited.model)),
  );
  const currentProperty = inspectModel(recovered.model).records.subjects.find(
    ({ iri }) => iri === "urn:p",
  );
  await expect(
    editModel(recovered.model, [{ kind: "remove", id: currentProperty.id }]),
  ).rejects.toMatchObject({ code: "EDIT_SOURCE_DEPENDENCY_UNRESOLVED" });
});

test("source evidence and origin are checked at checkpoint recovery", async () => {
  const { model } = await openOwl(
    encode(prefix + "<urn:A> a owl:Class."),
    options,
  );
  const checkpoint = await checkpointModel(model);
  const corrupt = transport(checkpoint);
  corrupt.source.sources[0].bytes[0] = 0;
  await expect(readmitModel(corrupt)).rejects.toMatchObject({
    code: "CHECKPOINT_INVALID",
  });
  const missing = transport(checkpoint);
  delete missing.source;
  await expect(readmitModel(missing)).rejects.toMatchObject({
    code: "CHECKPOINT_INVALID",
  });
  const wrongOrigin = transport(checkpoint);
  wrongOrigin.origin.inputDigest = "0".repeat(64);
  await expect(readmitModel(wrongOrigin)).rejects.toMatchObject({
    code: "CHECKPOINT_INVALID",
  });
});

test("literal invalidity and unavailable datatype validation remain distinct lexical assessments", async () => {
  const { model } = await openOwl(
    encode(
      prefix +
        '<urn:p> a owl:DatatypeProperty. <urn:i> <urn:p> "bad"^^<http://www.w3.org/2001/XMLSchema#integer>, "opaque"^^<urn:customDatatype>.',
    ),
    options,
  );
  const inspection = inspectModel(model);
  expect(inspection.qualifications).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        dimension: "lexical",
        code: "LITERAL_LEXICAL_SPACE",
        rule: expect.stringContaining("-invalid"),
      }),
      expect.objectContaining({
        dimension: "lexical",
        code: "DATATYPE_NOT_IN_SUPPORTED_MAP",
        rule: expect.stringContaining("-unverified"),
      }),
    ]),
  );
});
