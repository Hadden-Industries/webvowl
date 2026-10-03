import { fromOwl } from "vowl/owl";
import { ResourceBudget } from "../src/resourceBudget.js";
import { snapshotBytes } from "../src/snapshot.js";
import { documentContext } from "../src/owl/loading.js";
import { prepareCompatibleView } from "../src/owl/compatibleLoading.js";
import { retainCompatibleEvidence } from "../src/owl/sourceEvidence.js";
import { readmitSourceArchive } from "../src/sourceArchive.js";

const text = new TextEncoder();
const prefix =
  "@prefix owl: <http://www.w3.org/2002/07/owl#>. @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>. @prefix xsd: <http://www.w3.org/2001/XMLSchema#>. ";
const options = { documentIri: "urn:source", mediaType: "text/turtle" };
async function prepare(source, extra = {}) {
  const opts = { ...options, ...extra };
  const budget = new ResourceBudget(opts, performance.now());
  try {
    return await prepareCompatibleView(
      snapshotBytes(text.encode(source), budget),
      documentContext(opts.documentIri, opts.mediaType, budget),
      opts,
      budget,
    );
  } finally {
    budget.dispose();
  }
}

test("compatible property-role choice is retained as owning diagnostics while fromOwl stays preserve-mode", async () => {
  const source =
    prefix +
    "<urn:p> a owl:ObjectProperty, owl:AnnotationProperty; rdfs:domain <urn:C>. <urn:C> a owl:Class.";
  const prepared = await prepare(source);
  expect(
    prepared.diagnostics.some(
      ({ diagnostic }) =>
        diagnostic.code === "RDF_PROPERTY_CATEGORY_PUNNING_UNEVIDENCED" &&
        diagnostic.evidence === "precedence",
    ),
  ).toBe(true);
  expect(prepared.documents[0].parserMetadata).not.toBeNull();
  expect(prepared.retained.evidence.diagnostics).toEqual(prepared.diagnostics);
  expect(prepared.sourceDocuments[0].bytes).toEqual(text.encode(source));
  await expect(fromOwl(text.encode(source), options)).rejects.toMatchObject({
    code: "MAPPING_AMBIGUOUS",
  });
});

test("compatible datatype assessment qualifies xsd:time without discarding its identity", async () => {
  const prepared = await prepare(
    prefix + "<urn:p> a owl:DatatypeProperty; rdfs:range xsd:time.",
  );
  const range = [...prepared.loaded.ontology.getAxioms()].find(
    (axiom) => axiom.kind === "OWLDataPropertyRangeAxiom",
  );
  expect(range.range.iri.value).toBe("http://www.w3.org/2001/XMLSchema#time");
  expect(
    prepared.source.structural.subjects.some(
      ({ iri }) => iri === "http://www.w3.org/2001/XMLSchema#time",
    ),
  ).toBe(true);
  expect(
    prepared.source.structural.constructs.some(
      ({ kind }) => kind === "data-range",
    ),
  ).toBe(true);
  expect(prepared.assessment.status).not.toBe("valid");
  expect(
    [...prepared.assessment.violations, ...prepared.assessment.unverifiedChecks]
      .length,
  ).toBeGreaterThan(0);
});

test("secondary-header imports traverse the same bounded resolver and retain exact source context", async () => {
  const calls = [];
  const imported = prefix + "<urn:Imported> a owl:Class.";
  const source =
    prefix +
    "<urn:one> a owl:Ontology. <urn:two> a owl:Ontology; owl:imports <urn:import>.";
  const prepared = await prepare(source, {
    resolveImport: async (iri, context) => {
      calls.push({ iri, parent: context.importingDocumentIri });
      return {
        bytes: text.encode(imported),
        documentIri: "urn:import-document",
        mediaType: "text/turtle",
      };
    },
  });
  expect(calls).toEqual([{ iri: "urn:import", parent: "urn:source" }]);
  expect(prepared.retained.evidence.imports).toEqual([
    {
      parentDocument: "document:0",
      requestedIri: "urn:import",
      targetDocument: "document:1",
    },
  ]);
  expect(
    prepared.retained.evidence.documents.map(({ documentIri }) => documentIri),
  ).toEqual(["urn:source", "urn:import-document"]);
  expect(prepared.retained.readBytes("document:1")).toEqual(
    text.encode(imported),
  );
  expect(prepared.documents).toHaveLength(2);
  expect(
    prepared.sourceDocuments.map(({ documentIri }) => documentIri),
  ).toEqual(["urn:source", "urn:import-document"]);
  expect(
    prepared.diagnostics.some(
      ({ diagnostic }) => diagnostic.code === "RDF_MULTIPLE_ONTOLOGY_HEADERS",
    ),
  ).toBe(true);
  expect(
    prepared.loaded.importsClosure.some((ontology) =>
      [...ontology.getAxioms()].some(
        (axiom) => axiom.entity?.iri?.value === "urn:Imported",
      ),
    ),
  ).toBe(true);
});

test("missing imports remain distinct qualifications, while malformed input still fails", async () => {
  const prepared = await prepare(
    prefix + "<urn:one> a owl:Ontology; owl:imports <urn:absent>.",
  );
  expect(
    prepared.diagnostics.some(
      ({ diagnostic }) => diagnostic.code === "MISSING_IMPORT",
    ),
  ).toBe(true);
  await expect(prepare("not turtle")).rejects.toMatchObject({
    code: "MAPPING_SYNTAX_INVALID",
  });
});

test("inverse and characteristic reconstruction reaches ordinary retained constructs", async () => {
  const result = await prepare(
    prefix +
      "<urn:C> a owl:Class. <urn:p> a owl:FunctionalProperty; owl:inverseOf <urn:q>; rdfs:domain <urn:C>; rdfs:range <urn:C>.",
  );
  const kinds = result.source.structural.constructs.map(({ kind }) => kind);
  expect(kinds).toEqual(
    expect.arrayContaining([
      "inverse-properties",
      "object-characteristic",
      "object-domain",
      "object-range",
    ]),
  );
  expect(result.documents[0].parserMetadata.getUnparsedTriples()).toEqual([]);
});

test("non-RDF compatible preparation needs neither RDF metadata nor canonical work", async () => {
  const result = await prepare("Ontology(Declaration(Class(<urn:C>)))", {
    mediaType: "text/owl-functional",
    limits: { rdfQuads: 1, rdfDeepIterations: 0 },
  });
  expect(result.documents[0].parserMetadata).toBeNull();
  expect(result.retained.evidence.documents[0].parserMetadata).toBeNull();
  expect(result.source.structural.occurrences).toHaveLength(1);
});

test("retained evidence is transferable plain data and owns defensive exact source bytes", async () => {
  const source = prefix + "<urn:one> a owl:Ontology; owl:imports <urn:absent>.";
  const prepared = await prepare(source);
  const { retained } = prepared;
  const digest = await crypto.subtle.digest("SHA-256", text.encode(source));
  expect(retained.evidence.documents[0].digest).toBe(
    [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  );
  expect(JSON.parse(JSON.stringify(retained.evidence))).toEqual(
    retained.evidence,
  );
  expect(retained.evidence.diagnostics[0].diagnostic.importIRI).toEqual({
    kind: "IRI",
    value: "urn:absent",
  });
  expect(
    Object.isFrozen(retained.evidence.diagnostics[0].diagnostic.importIRI),
  ).toBe(true);
  prepared.sourceDocuments[0].bytes.fill(0);
  retained.readBytes("document:0").fill(0);
  expect(retained.readBytes("document:0")).toEqual(text.encode(source));
  expect(retained.evidence.coverage).toEqual({
    basis: "unavailable",
    represented: null,
    qualified: null,
    excluded: null,
    unrepresented: null,
  });
  expect(() => retained.readBytes("missing")).toThrow(
    expect.objectContaining({ code: "SOURCE_DOCUMENT_UNKNOWN" }),
  );
});

test("unparsed lexical evidence and document-local blank labels survive evidence copying", async () => {
  const prepared = await prepare(
    prefix + '_:local <urn:unknown> "01"^^xsd:integer.',
  );
  const metadata = prepared.retained.evidence.documents[0].parserMetadata;
  expect(metadata.unparsedTriples).toEqual(
    prepared.documents[0].parserMetadata.getUnparsedTriples(),
  );
  expect(
    metadata.unparsedTriples.some(({ object }) => object.value === "01"),
  ).toBe(true);
});

test("import evidence distinguishes cycles, redirected acquisition and missing targets", async () => {
  const prepared = await prepare(
    prefix +
      "<urn:root> a owl:Ontology; owl:imports <urn:alias>, <urn:missing>.",
    {
      resolveImport: async (iri) =>
        iri === "urn:alias"
          ? {
              bytes: text.encode(
                prefix + "<urn:other> a owl:Ontology; owl:imports <urn:root>.",
              ),
              documentIri: "urn:actual",
              mediaType: "text/turtle",
            }
          : undefined,
    },
  );
  expect(prepared.retained.evidence.imports).toEqual(
    expect.arrayContaining([
      {
        parentDocument: "document:0",
        requestedIri: "urn:alias",
        targetDocument: "document:1",
      },
      {
        parentDocument: "document:0",
        requestedIri: "urn:missing",
        targetDocument: null,
      },
      {
        parentDocument: "document:1",
        requestedIri: "urn:root",
        targetDocument: "document:0",
      },
    ]),
  );
  expect(prepared.retained.evidence.imports).toHaveLength(3);
});

test("a later matching ontology identity does not rewrite a failed import edge", async () => {
  const prepared = await prepare(
    prefix +
      "<urn:root> a owl:Ontology; owl:imports <urn:missing>, <urn:alias>.",
    {
      resolveImport: async (iri) =>
        iri === "urn:alias"
          ? {
              bytes: text.encode(prefix + "<urn:missing> a owl:Ontology."),
              documentIri: "urn:actual",
              mediaType: "text/turtle",
            }
          : undefined,
    },
  );
  expect(prepared.retained.evidence.imports).toContainEqual({
    parentDocument: "document:0",
    requestedIri: "urn:missing",
    targetDocument: null,
  });
});

test("repeated redirected acquisitions retain the first document bytes actually parsed", async () => {
  const first = prefix + "<urn:First> a owl:Class.";
  let count = 0;
  const prepared = await prepare(
    prefix + "<urn:root> a owl:Ontology; owl:imports <urn:a>, <urn:b>.",
    {
      resolveImport: async () => ({
        bytes: text.encode(
          count++ === 0 ? first : prefix + "<urn:NeverParsed> a owl:Class.",
        ),
        documentIri: "urn:shared-document",
        mediaType: "text/turtle",
      }),
    },
  );
  expect(count).toBe(2);
  expect(prepared.retained.evidence.documents).toHaveLength(2);
  expect(prepared.retained.readBytes("document:1")).toEqual(text.encode(first));
  expect(
    prepared.retained.evidence.imports.map(
      ({ targetDocument }) => targetDocument,
    ),
  ).toEqual(["document:1", "document:1"]);
  expect(
    prepared.source.structural.subjects.some(
      ({ iri }) => iri === "urn:NeverParsed",
    ),
  ).toBe(false);
});

test("evidence copying rejects unexpected executable dependency payloads without invoking them", async () => {
  const prepared = await prepare(prefix + "<urn:C> a owl:Class.");
  let invoked = false;
  const diagnostic = { code: "TEST" };
  Object.defineProperty(diagnostic, "message", {
    enumerable: true,
    get() {
      invoked = true;
      return "unexpected";
    },
  });
  const budget = new ResourceBudget({}, performance.now());
  try {
    await expect(
      retainCompatibleEvidence(
        {
          ...prepared,
          diagnostics: [{ documentIri: "urn:source", diagnostic }],
        },
        budget,
      ),
    ).rejects.toMatchObject({
      code: "DEPENDENCY_FAILURE",
      details: { stage: "owl-evidence" },
    });
    expect(invoked).toBe(false);
  } finally {
    budget.dispose();
  }
});

async function checkpoint(retained) {
  const budget = new ResourceBudget({}, performance.now());
  try {
    return retained.checkpoint(budget);
  } finally {
    budget.dispose();
  }
}
async function recoverArchive(value, limits) {
  const budget = new ResourceBudget({ limits }, performance.now());
  try {
    return await readmitSourceArchive(value, budget);
  } finally {
    budget.dispose();
  }
}
function transportArchive(value) {
  return {
    version: value.version,
    evidence: JSON.parse(JSON.stringify(value.evidence)),
    sources: value.sources.map(({ document, bytes }) => ({
      document,
      bytes: new Uint8Array(bytes),
    })),
  };
}

test("source checkpoints recover exact evidence and bytes without acquisition or RDFC", async () => {
  const source =
    prefix +
    '<urn:root> a owl:Ontology; owl:imports <urn:missing>. _:a <urn:unknown> "01"^^xsd:integer.';
  const { retained } = await prepare(source);
  const saved = await checkpoint(retained);
  const transported = transportArchive(saved);
  const recovering = recoverArchive(transported, {
    rdfQuads: 1,
    rdfDeepIterations: 0,
  });
  transported.sources[0].bytes.fill(0);
  const recovered = await recovering;
  expect(recovered.evidence).toEqual(retained.evidence);
  expect(recovered.readBytes("document:0")).toEqual(text.encode(source));
  saved.sources[0].bytes.fill(0);
  expect(retained.readBytes("document:0")).toEqual(text.encode(source));
  expect(
    Object.isFrozen(
      recovered.evidence.documents[0].parserMetadata.unparsedTriples,
    ),
  ).toBe(true);
});

test("source recovery rejects inconsistent manifests, byte digests and dangling import edges", async () => {
  const { retained } = await prepare(
    prefix + "<urn:root> a owl:Ontology; owl:imports <urn:missing>.",
  );
  const saved = await checkpoint(retained);
  const corruptions = [
    (copy) => {
      copy.sources[0].bytes[0] = 0;
    },
    (copy) => {
      copy.sources[0].document = "unknown";
    },
    (copy) => {
      copy.sources.push(copy.sources[0]);
    },
    (copy) => {
      copy.evidence.imports[0].targetDocument = "unknown";
    },
    (copy) => {
      copy.evidence.documents[0].digest = "wrong";
    },
    (copy) => {
      copy.evidence.documents[0].extra = true;
    },
    (copy) => {
      copy.evidence.coverage.basis = "source";
    },
  ];
  for (const corrupt of corruptions) {
    const copy = transportArchive(saved);
    corrupt(copy);
    await expect(recoverArchive(copy)).rejects.toMatchObject({
      code: "CHECKPOINT_INVALID",
    });
  }
  const incompatible = transportArchive(saved);
  incompatible.version = 2;
  await expect(recoverArchive(incompatible)).rejects.toMatchObject({
    code: "CHECKPOINT_VERSION_UNSUPPORTED",
  });
  await expect(
    recoverArchive(transportArchive(saved), { inputBytes: 1 }),
  ).rejects.toMatchObject({ code: "INPUT_RESOURCE_LIMIT" });
});

test("source recovery never invokes byte-entry accessors", async () => {
  const { retained } = await prepare(prefix + "<urn:C> a owl:Class.");
  const saved = transportArchive(await checkpoint(retained));
  let invoked = false;
  Object.defineProperty(saved.sources[0], "bytes", {
    enumerable: true,
    get() {
      invoked = true;
      return new Uint8Array();
    },
  });
  await expect(recoverArchive(saved)).rejects.toMatchObject({
    code: "OPTION_INVALID",
  });
  expect(invoked).toBe(false);
});

test("compatible preparation obeys cancellation and aggregate import byte limits", async () => {
  await expect(
    prepare(prefix, { signal: AbortSignal.abort() }),
  ).rejects.toMatchObject({ code: "ABORTED" });
  const source = prefix + "<urn:one> a owl:Ontology; owl:imports <urn:other>.";
  await expect(
    prepare(source, {
      limits: { inputBytes: text.encode(source).length + 10 },
      resolveImport: async () => ({
        bytes: text.encode(prefix + "<urn:Imported> a owl:Class."),
        documentIri: "urn:other",
        mediaType: "text/turtle",
      }),
    }),
  ).rejects.toMatchObject({ code: "INPUT_RESOURCE_LIMIT" });
});
