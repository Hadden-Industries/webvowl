import {
  checkpointModel,
  inspectModel,
  readmitModel,
  readModelSource,
} from "vowl";
import { openOwl } from "vowl/owl";

const encode = (value) => new TextEncoder().encode(value);
const owlNamespace = "http://www.w3.org/2002/07/owl#";
const rdfNamespace = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const owlXml = (iri) =>
  `<Ontology xmlns="${owlNamespace}"><Declaration><Class IRI="${iri}"/></Declaration></Ontology>`;
const xml = (body) =>
  `<rdf:RDF xmlns:rdf="${rdfNamespace}" xmlns:owl="${owlNamespace}">${body}</rdf:RDF>`;
const childIri = "https://example.org/child.rdf";

test("a local root opens directly, imports its absolute child and retains its original bytes", async () => {
  const bytes = encode(
    xml(
      `<owl:Ontology rdf:about="https://example.org/ontology"><owl:imports rdf:resource="${childIri}"/></owl:Ontology>` +
        '<owl:Class xml:base="https://example.org/terms/" rdf:about="#Root"/>',
    ),
  );
  const child = encode(
    xml('<owl:Class rdf:about="https://example.org/imported"/>'),
  );
  const requests = [];
  const { model } = await openOwl(bytes, {
    localSource: true,
    async resolveImport(iri, request) {
      requests.push([iri, request.importingDocumentIri]);
      return {
        bytes: child,
        documentIri: childIri,
        mediaType: "application/rdf+xml",
      };
    },
  });
  const before = inspectModel(model);
  const { documents, imports } = before;
  expect(requests).toEqual([[childIri, null]]);
  expect(documents.map(({ documentIri }) => documentIri)).toEqual([
    null,
    childIri,
  ]);
  expect(imports).toMatchObject([
    {
      parentDocument: documents[0].id,
      requestedIri: childIri,
      targetDocument: documents[1].id,
      state: "acquired",
    },
  ]);
  const checkpoint = await checkpointModel(model);
  const { model: reopened } = await readmitModel(checkpoint);
  expect(inspectModel(reopened)).toEqual(before);
  await expect(
    readModelSource(reopened, documents[0].id),
  ).resolves.toMatchObject({
    bytes,
    documentIri: null,
  });
});

test.each([
  ["application/rdf+xml", xml('<owl:Class rdf:about="#Name"/>')],
  ["text/turtle", `<#Name> a <${owlNamespace}Class> .`],
  ["application/trig", `{ <#Name> a <${owlNamespace}Class> . }`],
  ["application/owl+xml", owlXml("#Name")],
  [
    "application/ld+json",
    JSON.stringify({ "@id": "#Name", "@type": owlNamespace + "Class" }),
  ],
])(
  "%s requires a base for a relative class and retries with the given base",
  async (mediaType, input) => {
    const bytes = encode(input);
    const options = { localSource: true, mediaType };
    await expect(openOwl(bytes, options)).rejects.toMatchObject({
      code: "MAPPING_BASE_REQUIRED",
    });
    const { model } = await openOwl(bytes, {
      ...options,
      fallbackBaseIri: "https://example.org/ontology",
    });
    const { documents, records } = inspectModel(model);
    expect(documents[0].documentIri).toBeNull();
    expect(records.subjects).toEqual([
      expect.objectContaining({ iri: "https://example.org/ontology#Name" }),
    ]);
    await expect(
      readModelSource(model, documents[0].id),
    ).resolves.toMatchObject({
      bytes,
      documentIri: null,
    });
  },
);

test.each(["application/n-triples", "application/n-quads"])(
  "a relative IRI in %s stays a syntax failure",
  async (mediaType) => {
    const input = `<#Name> <${rdfNamespace}type> <${owlNamespace}Class> .`;
    await expect(
      openOwl(encode(input), {
        localSource: true,
        mediaType,
      }),
    ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
  },
);

const absoluteClass = "https://example.org/terms/Name";
test.each([
  ["text/owl-functional", `Ontology(Declaration(Class(<${absoluteClass}>)))`],
  ["text/owl-manchester", `Ontology: <urn:source>\nClass: <${absoluteClass}>`],
  [
    "application/n-triples",
    `<${absoluteClass}> <${rdfNamespace}type> <${owlNamespace}Class> .`,
  ],
  [
    "application/n-quads",
    `<${absoluteClass}> <${rdfNamespace}type> <${owlNamespace}Class> .`,
  ],
  [
    "application/ld+json",
    JSON.stringify({
      "@context": { "@base": "https://example.org/terms/" },
      "@id": "Name",
      "@type": owlNamespace + "Class",
    }),
  ],
])(
  "%s opens a self-contained local class without a fallback",
  async (mediaType, input) => {
    const { model } = await openOwl(encode(input), {
      localSource: true,
      mediaType,
    });
    expect(inspectModel(model).records.subjects).toContainEqual(
      expect.objectContaining({ iri: absoluteClass }),
    );
  },
);

test("an entered base cannot stand in for an import of the same address", async () => {
  const bytes = encode(
    xml(
      `<owl:Ontology rdf:about="urn:source"><owl:imports rdf:resource="${childIri}"/></owl:Ontology>` +
        '<owl:Class rdf:about="#Name"/>',
    ),
  );
  await expect(
    openOwl(bytes, { localSource: true, fallbackBaseIri: childIri }),
  ).rejects.toMatchObject({ code: "MAPPING_LOCAL_BASE_COLLISION" });
});
