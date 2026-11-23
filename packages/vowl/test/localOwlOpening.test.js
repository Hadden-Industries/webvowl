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
  const { source: archive, ...savedState } = checkpoint;
  const corrupt = {
    ...JSON.parse(JSON.stringify(savedState)),
    source: {
      ...archive,
      evidence: JSON.parse(JSON.stringify(archive.evidence)),
    },
  };
  const [root, imported] = corrupt.source.evidence.documents;
  root.documentIri = imported.documentIri;
  imported.documentIri = null;
  await expect(readmitModel(corrupt)).rejects.toMatchObject({
    code: "CHECKPOINT_INVALID",
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
    expect(documents[0]).toMatchObject({
      documentIri: null,
      baseIri: "https://example.org/ontology",
    });
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

test.each([
  ['<owl:Class rdf:about="child/Name"/>', "https://example.org/child/Name"],
  ['<owl:Class rdf:about=""/>', "https://example.org/ontology"],
  [
    '<owl:Class xml:base="sub/" rdf:ID="Name"/>',
    "https://example.org/sub/#Name",
  ],
  [
    '<owl:Class xml:base="//terms.example/" rdf:about="Name"/>',
    "https://terms.example/Name",
  ],
])(
  "RDF/XML resolves %s against an entered base after diagnosis",
  async (body, iri) => {
    const bytes = encode(xml(body));
    await expect(openOwl(bytes, { localSource: true })).rejects.toMatchObject({
      code: "MAPPING_BASE_REQUIRED",
    });
    const { model } = await openOwl(bytes, {
      localSource: true,
      fallbackBaseIri: "https://example.org/ontology",
    });
    expect(inspectModel(model).records.subjects).toContainEqual(
      expect.objectContaining({ iri }),
    );
  },
);

test("RDF/XML without a wrapper uses the owning reader's base rules", async () => {
  const bytes = encode(
    `<owl:Class xmlns:owl="${owlNamespace}" xmlns:rdf="${rdfNamespace}" rdf:about="Name"/>`,
  );
  await expect(openOwl(bytes, { localSource: true })).rejects.toMatchObject({
    code: "MAPPING_BASE_REQUIRED",
  });
});

test("RDF/XML base diagnosis never acquires imports, and retry resolves them normally", async () => {
  const bytes = encode(
    xml(
      '<owl:Ontology rdf:about="urn:source"><owl:imports rdf:resource="child.rdf"/></owl:Ontology>',
    ),
  );
  const requested = [];
  const resolveImport = async (iri) => {
    requested.push(iri);
    return {
      bytes: encode(xml('<owl:Class rdf:about="urn:imported"/>')),
      documentIri: iri,
    };
  };
  await expect(
    openOwl(bytes, { localSource: true, resolveImport }),
  ).rejects.toMatchObject({
    code: "MAPPING_BASE_REQUIRED",
  });
  expect(requested).toEqual([]);
  const { model } = await openOwl(bytes, {
    localSource: true,
    fallbackBaseIri: "https://example.org/parent/",
    resolveImport,
  });
  expect(requested).toEqual(["https://example.org/parent/child.rdf"]);
  expect(inspectModel(model).records.subjects).toContainEqual(
    expect.objectContaining({ iri: "urn:imported" }),
  );
});

test("a bounded RDF/XML diagnostic preserves the owning blank-node limit", async () => {
  const bytes = encode(
    xml(
      '<owl:Class rdf:about="#Name"/>' +
        '<rdf:Description rdf:nodeID="a" rdf:type="urn:kind"/>' +
        '<rdf:Description rdf:nodeID="b" rdf:type="urn:kind"/>',
    ),
  );
  await expect(
    openOwl(bytes, {
      localSource: true,
      limits: { primaryRecords: 1 },
    }),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
});

test.each(["text/turtle", "application/trig"])(
  "%s reports an empty IRI reference as a missing base",
  async (mediaType) => {
    const bytes = encode(`<> a <${owlNamespace}Class> .`);
    await expect(
      openOwl(bytes, { localSource: true, mediaType }),
    ).rejects.toMatchObject({
      code: "MAPPING_BASE_REQUIRED",
    });
  },
);

test("malformed OWL/XML keeps its syntax failure after a relative IRI", async () => {
  const bytes = encode(
    `<Ontology xmlns="${owlNamespace}"><Declaration><Class IRI="#Name"/></Declaration><Invalid/></Ontology>`,
  );
  await expect(openOwl(bytes, { localSource: true })).rejects.toMatchObject({
    code: "MAPPING_SYNTAX_INVALID",
  });
});

test("a JSON-LD context that discards the base cannot silently discard a relative class", async () => {
  const bytes = encode(
    JSON.stringify({
      "@context": { "@base": null },
      "@graph": [
        { "@id": "#Name", "@type": owlNamespace + "Class" },
        { "@id": "urn:absolute", "@type": owlNamespace + "Class" },
      ],
    }),
  );
  for (const fallbackBaseIri of [undefined, "https://example.org/ontology"]) {
    await expect(
      openOwl(bytes, { localSource: true, fallbackBaseIri }),
    ).rejects.toMatchObject({
      code: "MAPPING_SYNTAX_INVALID",
    });
  }
});

test("an unused JSON-LD node reference does not require a base", async () => {
  const bytes = encode(
    JSON.stringify([
      { "@id": "#Orphan" },
      { "@id": "urn:class", "@type": owlNamespace + "Class" },
    ]),
  );
  const { model } = await openOwl(bytes, {
    localSource: true,
    mediaType: "application/ld+json",
  });
  expect(inspectModel(model).records.subjects).toEqual([
    expect.objectContaining({ iri: "urn:class" }),
  ]);
});

test("the JSON-LD diagnostic still applies the RDF statement budget", async () => {
  const bytes = encode(
    JSON.stringify([
      { "@id": "#First", "@type": owlNamespace + "Class" },
      { "@id": "#Second", "@type": owlNamespace + "Class" },
    ]),
  );
  await expect(
    openOwl(bytes, {
      localSource: true,
      limits: { rdfQuads: 1 },
      mediaType: "application/ld+json",
    }),
  ).rejects.toMatchObject({ code: "RDF_RESOURCE_LIMIT" });
});

test("a relative JSON-LD vocabulary resolves independently on each attempt", async () => {
  const bytes = encode(
    JSON.stringify({
      "@context": { "@vocab": "./", type: "@type" },
      "@id": "urn:name",
      type: `${owlNamespace}Class`,
      some: "value",
    }),
  );
  const options = { localSource: true, mediaType: "application/ld+json" };
  await expect(openOwl(bytes, options)).rejects.toMatchObject({
    code: "MAPPING_BASE_REQUIRED",
  });
  for (const fallbackBaseIri of [
    "https://example.org/one/",
    "https://example.org/two/",
  ]) {
    const { model } = await openOwl(bytes, { ...options, fallbackBaseIri });
    expect(inspectModel(model).records.subjects).toContainEqual(
      expect.objectContaining({ iri: `${fallbackBaseIri}some` }),
    );
  }
});

test("the input byte limit applies to acquired JSON-LD bytes", async () => {
  const bytes = encode(
    JSON.stringify({
      "@context": { type: "@type", C: `${owlNamespace}Class` },
      "@graph": ["urn:compact", "urn:another", "urn:last"].map((iri) => ({
        "@id": iri,
        type: "C",
      })),
    }),
  );
  const options = { localSource: true, mediaType: "application/ld+json" };
  await expect(
    openOwl(bytes, { ...options, limits: { inputBytes: bytes.length - 1 } }),
  ).rejects.toMatchObject({
    code: "INPUT_RESOURCE_LIMIT",
  });
  const { model } = await openOwl(bytes, {
    ...options,
    limits: { inputBytes: bytes.length },
  });
  expect(inspectModel(model).records.subjects).toContainEqual(
    expect.objectContaining({ iri: "urn:compact" }),
  );
});

test("a relative TriG graph label requires a base even when its triples are absolute", async () => {
  const bytes = encode(`<#graph> { <urn:term> a <${owlNamespace}Class> . }`);
  const options = { mediaType: "application/trig", localSource: true };
  await expect(openOwl(bytes, options)).rejects.toMatchObject({
    code: "MAPPING_BASE_REQUIRED",
  });
  const { model } = await openOwl(bytes, {
    ...options,
    fallbackBaseIri: "https://example.org/ontology",
  });
  expect(inspectModel(model).records.subjects).toContainEqual(
    expect.objectContaining({ iri: "urn:term" }),
  );
});

test("a relative TriG graph label can resolve to an existing graph", async () => {
  const fallbackBaseIri = "https://example.org/ontology";
  const bytes = encode(
    `<#graph> { <urn:first> a <${owlNamespace}Class> . }` +
      `<${fallbackBaseIri}#graph> { <urn:second> a <${owlNamespace}Class> . }`,
  );
  const options = { mediaType: "application/trig", localSource: true };
  await expect(openOwl(bytes, options)).rejects.toMatchObject({
    code: "MAPPING_BASE_REQUIRED",
  });
  const { model } = await openOwl(bytes, { ...options, fallbackBaseIri });
  expect(
    inspectModel(model)
      .records.subjects.map(({ iri }) => iri)
      .sort(),
  ).toEqual(["urn:first", "urn:second"]);
});

test("an independent TriG graph ambiguity remains ambiguous despite a relative term", async () => {
  const bytes = encode(
    `<urn:graph1> { <#first> a <${owlNamespace}Class> . }` +
      `<urn:graph2> { <urn:second> a <${owlNamespace}Class> . }`,
  );
  await expect(
    openOwl(bytes, {
      localSource: true,
      mediaType: "application/trig",
    }),
  ).rejects.toMatchObject({ code: "MAPPING_AMBIGUOUS" });
});

test.each(["", "_:graph"])(
  "a TriG graph of a different term kind stays ambiguous with a relative graph IRI",
  async (graph) => {
    const bytes = encode(
      `${graph} { <urn:first> a <${owlNamespace}Class> . }` +
        `<#graph> { <urn:second> a <${owlNamespace}Class> . }`,
    );
    await expect(
      openOwl(bytes, {
        localSource: true,
        mediaType: "application/trig",
      }),
    ).rejects.toMatchObject({ code: "MAPPING_AMBIGUOUS" });
  },
);

test("invalid local import targets never reach the acquisition callback", async () => {
  const bytes = encode(
    `<urn:root> a <${owlNamespace}Ontology>; <${owlNamespace}imports> <https://example.org/%x> .`,
  );
  const requested = [];
  for (const fallbackBaseIri of [undefined, "https://example.org/ontology"]) {
    await expect(
      openOwl(bytes, {
        localSource: true,
        fallbackBaseIri,
        mediaType: "text/turtle",
        resolveImport(iri) {
          requested.push(iri);
        },
      }),
    ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
  }
  expect(requested).toEqual([]);
});

test("the fallback cannot select a longer absolute ontology header", async () => {
  const fallbackBaseIri = "https://example.org/long-header";
  const bytes = encode(
    xml(
      `<owl:Ontology rdf:about="urn:main"/><owl:Ontology rdf:about="${fallbackBaseIri}"/>` +
        '<owl:Class rdf:about="#Name"/>',
    ),
  );
  await expect(
    openOwl(bytes, { localSource: true, fallbackBaseIri }),
  ).rejects.toMatchObject({
    code: "MAPPING_AMBIGUOUS",
  });
});

test.each(["application/n-triples", "application/n-quads"])(
  "a relative IRI in %s stays a syntax failure",
  async (mediaType) => {
    const input = `<#Name> <${rdfNamespace}type> <${owlNamespace}Class> .`;
    for (const fallbackBaseIri of [undefined, "https://example.org/ontology"]) {
      await expect(
        openOwl(encode(input), {
          localSource: true,
          mediaType,
          fallbackBaseIri,
        }),
      ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
    }
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

test("a retrieved import cannot reuse the selected file's parser base as its document identity", async () => {
  const bytes = encode(
    xml(
      `<owl:Ontology rdf:about="urn:source"><owl:imports rdf:resource="${childIri}"/></owl:Ontology>` +
        '<owl:Class rdf:about="#Name"/>',
    ),
  );
  const fallbackBaseIri = "https://example.org/base";
  await expect(
    openOwl(bytes, {
      localSource: true,
      fallbackBaseIri,
      resolveImport: async () => ({
        documentIri: fallbackBaseIri,
        bytes: encode(xml('<owl:Class rdf:about="urn:imported"/>')),
      }),
    }),
  ).rejects.toMatchObject({ code: "MAPPING_LOCAL_BASE_COLLISION" });
});
