import { jest } from "@jest/globals";
import { OWLDocumentFormats } from "owlapi/formats";
import { fromOwl } from "vowl/owl";
import { decode, encode, VowlError } from "vowl";

const bytes = (value) => new TextEncoder().encode(value);
const options = { documentIri: "urn:doc", mediaType: "text/owl-functional" };
const strict =
  "https://haddenindustries.com/ontology/profiles/vowl/owl-mapping/strict/v1";
const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const owl = "http://www.w3.org/2002/07/owl#";
const rdfs = "http://www.w3.org/2000/01/rdf-schema#";
const xsd = "http://www.w3.org/2001/XMLSchema#";
const subclass = "Ontology(SubClassOf(<urn:doc#A> <urn:doc#B>))";
const triples = `<urn:doc#A> <${rdf}type> <${owl}Class> .
<urn:doc#B> <${rdf}type> <${owl}Class> .
<urn:doc#A> <${rdfs}subClassOf> <urn:doc#B> .`;
const syntaxes = [
  ["text/owl-functional", subclass],
  [
    "text/owl-manchester",
    "Ontology:\nClass: <urn:doc#A>\n SubClassOf: <urn:doc#B>\nClass: <urn:doc#B>",
  ],
  [
    "application/owl+xml",
    `<Ontology xmlns="${owl}"><SubClassOf><Class IRI="urn:doc#A"/><Class IRI="urn:doc#B"/></SubClassOf></Ontology>`,
  ],
  ["text/owl-dl", "A ⊑ B"],
  ["text/owl-krss", "(define-primitive-concept A B)"],
  ["text/owl-krss2", "(implies A B)"],
  [
    "application/rdf+xml",
    `<rdf:RDF xmlns:rdf="${rdf}" xmlns:rdfs="${rdfs}" xmlns:owl="${owl}"><owl:Class rdf:about="urn:doc#A"><rdfs:subClassOf rdf:resource="urn:doc#B"/></owl:Class><owl:Class rdf:about="urn:doc#B"/></rdf:RDF>`,
  ],
  ["text/turtle", triples],
  ["application/trig", `{ ${triples} }`],
  ["application/n-triples", triples],
  ["application/n-quads", triples],
  [
    "application/ld+json",
    JSON.stringify([
      {
        "@id": "urn:doc#A",
        "@type": owl + "Class",
        [rdfs + "subClassOf"]: { "@id": "urn:doc#B" },
      },
      { "@id": "urn:doc#B", "@type": owl + "Class" },
    ]),
  ],
];

test("format fixtures cover the owning public media-type catalogue", () => {
  expect(new Set(syntaxes.map(([mediaType]) => mediaType))).toEqual(
    new Set(
      Object.values(OWLDocumentFormats).flatMap(({ mediaTypes }) => mediaTypes),
    ),
  );
});

test.each(syntaxes)(
  "explicit %s preserves the same retained subclass in both mapping profiles",
  async (mediaType, text) => {
    const expected = encode((await fromOwl(bytes(subclass), options)).document);
    for (const mappingProfile of [undefined, strict]) {
      const result = await fromOwl(bytes(text), {
        ...options,
        mediaType,
        mappingProfile,
      });
      expect(encode(result.document)).toEqual(expected);
      expect(result.diagnostics).toEqual([]);
      expect(result.document.structural.ontology).not.toHaveProperty("iri");
    }
  },
);

test("root bytes are owned before suspension and output is deeply immutable", async () => {
  const input = bytes(subclass);
  const pending = fromOwl(input, options);
  input.fill(0);
  const result = await pending;
  expect(result.document.structural.constructs).toHaveLength(1);
  function frozen(value) {
    if (value && typeof value === "object") {
      expect(Object.isFrozen(value)).toBe(true);
      Object.values(value).forEach(frozen);
    }
  }
  frozen(result);
  expect(encode(await decode(encode(result.document)))).toEqual(
    encode(result.document),
  );
  const foreign = await import("../src/index.js?owl-admission-instance");
  expect(() => foreign.encode(result.document)).toThrow(
    expect.objectContaining({ code: "DOCUMENT_NOT_ADMITTED" }),
  );
  expect(foreign.encode(await foreign.decode(encode(result.document)))).toEqual(
    encode(result.document),
  );
});

test.each([
  [
    { ...options, mediaType: "application/json" },
    "MAPPING_MEDIA_TYPE_UNSUPPORTED",
  ],
  [{ ...options, documentIri: "relative" }, "OPTION_INVALID"],
  [{ ...options, mappingProfile: "strict" }, "OPTION_INVALID"],
  [{ ...options, profile: "artifact" }, "OPTION_INVALID"],
  [{ ...options, resolveImport: true }, "OPTION_INVALID"],
  [
    { ...options, signal: Object.create(AbortSignal.prototype) },
    "OPTION_INVALID",
  ],
])("closed adapter options reject %j", async (value, code) => {
  await expect(fromOwl(bytes(subclass), value)).rejects.toMatchObject({ code });
});

test.each([false, true])(
  "adapter options precede input validation in UTF-16 field order: reversed=%s",
  async (reverse) => {
    const ordered = (value) =>
      Object.fromEntries(
        reverse ? Object.entries(value).reverse() : Object.entries(value),
      );
    for (const [values, code, pointer] of [
      [
        {
          documentIri: "relative",
          mappingProfile: "bad",
          limits: { depth: 0 },
        },
        "OPTION_INVALID",
        "/documentIri",
      ],
      [
        { mappingProfile: "bad", limits: { depth: 0 } },
        "OPTION_INVALID",
        "/limits/depth",
      ],
      [
        { mappingProfile: "bad", mediaType: false },
        "OPTION_INVALID",
        "/mappingProfile",
      ],
      [
        { mediaType: "application/json", resolveImport: true },
        "MAPPING_MEDIA_TYPE_UNSUPPORTED",
        "/mediaType",
      ],
      [
        { resolveImport: true, signal: Object.create(AbortSignal.prototype) },
        "OPTION_INVALID",
        "/resolveImport",
      ],
    ]) {
      await expect(
        fromOwl(null, ordered({ ...options, ...values })),
      ).rejects.toMatchObject({ code, pointer });
    }
    await expect(fromOwl(null, options)).rejects.toMatchObject({
      code: "INPUT_TYPE",
    });
  },
);

test("invalid UTF-8 and exact syntax mismatches do not trigger sniffing", async () => {
  await expect(fromOwl(new Uint8Array([0xff]), options)).rejects.toMatchObject({
    code: "MAPPING_SYNTAX_INVALID",
  });
  await expect(
    fromOwl(bytes(subclass), { ...options, mediaType: "text/turtle" }),
  ).rejects.toMatchObject({ code: "MAPPING_SYNTAX_INVALID" });
});

test("root and import bytes use one aggregate limit and imports retain their authored identity", async () => {
  const root = bytes("Ontology(Import(<https://example.org/authored>))");
  const imported = bytes(subclass);
  const calls = [];
  const resolveImport = async (iri, context) => {
    calls.push({ iri, context });
    expect(Object.keys(context).sort()).toEqual([
      "importingDocumentIri",
      "signal",
    ]);
    expect(Object.isFrozen(context)).toBe(true);
    return {
      bytes: imported,
      documentIri: "urn:actual-import-location",
      mediaType: options.mediaType,
    };
  };
  await expect(
    fromOwl(root, {
      ...options,
      resolveImport,
      limits: { inputBytes: root.length + imported.length - 1 },
    }),
  ).rejects.toMatchObject({
    code: "INPUT_RESOURCE_LIMIT",
    details: { limit: "inputBytes" },
  });
  const result = await fromOwl(root, {
    ...options,
    resolveImport,
    mappingProfile: strict,
    limits: { inputBytes: root.length + imported.length },
  });
  expect(result.document.structural.ontology.imports).toEqual([
    "https://example.org/authored",
  ]);
  expect(result.document.structural.constructs).toHaveLength(1);
  expect(calls).toHaveLength(2);
  expect(
    calls.every(
      ({ iri, context }) =>
        iri === "https://example.org/authored" &&
        context.importingDocumentIri === "urn:doc",
    ),
  ).toBe(true);
});

test.each([
  [
    () => ({
      bytes: bytes("not OWL"),
      documentIri: "urn:import",
      mediaType: options.mediaType,
    }),
    "MAPPING_SYNTAX_INVALID",
  ],
  [
    () => ({
      bytes: bytes(subclass),
      documentIri: "urn:import",
      mediaType: "unknown/type",
    }),
    "MAPPING_MEDIA_TYPE_UNSUPPORTED",
  ],
  [() => ({}), "INPUT_TYPE"],
  [
    () => {
      throw new VowlError("MODEL_RESOURCE_LIMIT", "bounded resolver");
    },
    "MODEL_RESOURCE_LIMIT",
  ],
])(
  "compatibility never recovers a malformed or resource-failed import response",
  async (resolveImport, code) => {
    await expect(
      fromOwl(bytes("Ontology(Import(<urn:import>))"), {
        ...options,
        resolveImport,
      }),
    ).rejects.toMatchObject({ code });
  },
);

test("resolver accessors are rejected without running their code", async () => {
  let reads = 0;
  await expect(
    fromOwl(bytes("Ontology(Import(<urn:import>))"), {
      ...options,
      resolveImport: async () => ({
        get bytes() {
          reads++;
          return bytes(subclass);
        },
        documentIri: "urn:import",
        mediaType: options.mediaType,
      }),
    }),
  ).rejects.toMatchObject({ code: "OPTION_INVALID" });
  expect(reads).toBe(0);
});

test("cancellation settles an uncooperative resolver without committing its late result", async () => {
  const entered = Promise.withResolvers();
  const response = Promise.withResolvers();
  const controller = new AbortController();
  const pending = fromOwl(bytes("Ontology(Import(<urn:import>))"), {
    ...options,
    signal: controller.signal,
    resolveImport: (_iri, { signal }) => {
      entered.resolve(signal);
      return response.promise;
    },
  });
  const signal = await entered.promise;
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  expect(signal.aborted).toBe(true);
  response.resolve({
    bytes: bytes(subclass),
    documentIri: "urn:import",
    mediaType: options.mediaType,
  });
  await response.promise;
});

test("the adapter deadline includes resolver time before core admission", async () => {
  const spy = jest.spyOn(performance, "now");
  spy.mockReturnValue(0);
  try {
    await expect(
      fromOwl(bytes("Ontology(Import(<urn:import>))"), {
        ...options,
        limits: { deadlineMs: 1000 },
        resolveImport: async () => {
          spy.mockReturnValue(1001);
          return {
            bytes: bytes(subclass),
            documentIri: "urn:import",
            mediaType: options.mediaType,
          };
        },
      }),
    ).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
  } finally {
    spy.mockRestore();
  }
});

test.each([
  [
    "reserved entity",
    `Ontology(Declaration(Class(<${owl}NotReservedForClasses>)))`,
    "RESERVED_ENTITY_IRI",
  ],
  [
    "invalid facet use",
    `Ontology(DataPropertyRange(<urn:p> DatatypeRestriction(<${xsd}string> <${xsd}length> "x")))`,
    "FACET_REQUIRES_NONNEGATIVE_INTEGER",
  ],
])(
  "%s fails both policies without broadening the recovery catalogue",
  async (_name, text, restriction) => {
    for (const mappingProfile of [undefined, strict]) {
      await expect(
        fromOwl(bytes(text), { ...options, mappingProfile }),
      ).rejects.toMatchObject({
        code: "MAPPING_SOURCE_INVALID",
        details: { restriction },
      });
    }
  },
);

test("an explicitly dual class/datatype subject does not choose a generic range category", async () => {
  const declarations = `<urn:D> a <${rdfs}Class>, <${rdfs}Datatype> .`;
  const config = { ...options, mediaType: "text/turtle" };
  const declared = await fromOwl(bytes(declarations), config);
  expect(
    declared.document.structural.roles.map(({ kind }) => kind).sort(),
  ).toEqual(["datatype", "rdf-class"]);
  await expect(
    fromOwl(
      bytes(
        `${declarations} <urn:p> a <${rdf}Property>; <${rdfs}range> <urn:D> .`,
      ),
      config,
    ),
  ).rejects.toMatchObject({ code: "MAPPING_AMBIGUOUS" });
});

test("excluded unannotated ABox use retains individuals without leaked property roles", async () => {
  const result = await fromOwl(
    bytes("Ontology(ObjectPropertyAssertion(<urn:p> <urn:a> <urn:b>))"),
    options,
  );
  expect(result.document.structural.roles.map(({ kind }) => kind)).toEqual([
    "individual",
    "individual",
  ]);
  expect(
    result.document.structural.subjects.map(({ iri }) => iri).sort(),
  ).toEqual(["urn:a", "urn:b"]);
  expect(result.document.structural.constructs).toEqual([]);
  expect(result.diagnostics).toEqual([
    expect.objectContaining({ code: "MAPPING_EXCLUDED_AXIOM" }),
  ]);
});

test.each([
  ["object-property", "ObjectPropertyAssertion(<urn:p> <urn:a> <urn:b>)"],
  ["data-property", 'DataPropertyAssertion(<urn:p> <urn:a> "value")'],
  [
    "annotation-property",
    'ObjectPropertyAssertion(Annotation(<urn:p> "note") <urn:other> <urn:a> <urn:b>)',
  ],
])(
  "an explicit generic declaration survives %s evidence in an excluded imported axiom",
  async (kind, axiom) => {
    const result = await fromOwl(
      bytes(
        `<urn:ont> a <${owl}Ontology>; <${owl}imports> <urn:import> . <urn:p> a <${rdf}Property> .`,
      ),
      {
        ...options,
        mediaType: "text/turtle",
        resolveImport: async () => ({
          bytes: bytes(`Ontology(${axiom})`),
          documentIri: "urn:import",
          mediaType: options.mediaType,
        }),
      },
    );
    const property = result.document.structural.subjects.find(
      ({ iri }) => iri === "urn:p",
    );
    expect(property).toBeDefined();
    expect(
      result.document.structural.roles
        .filter(({ subject }) => subject === property.id)
        .map(({ kind }) => kind),
    ).toEqual([kind]);
    expect(result.document.structural.constructs).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "MAPPING_EXCLUDED_AXIOM" }),
    ]);
  },
);

test.each([
  "unknown/type",
  "application/json",
  "text/owl-krss1",
  "Text/Turtle",
  "text/turtle; charset=utf-8",
])(
  "unknown %s is rejected at root and import boundaries",
  async (mediaType) => {
    for (const mappingProfile of [undefined, strict]) {
      await expect(
        fromOwl(bytes("not parsed"), { ...options, mediaType, mappingProfile }),
      ).rejects.toMatchObject({
        code: "MAPPING_MEDIA_TYPE_UNSUPPORTED",
        pointer: "/mediaType",
      });
      await expect(
        fromOwl(bytes("Ontology(Import(<urn:import>))"), {
          ...options,
          mappingProfile,
          resolveImport: async () => ({
            bytes: bytes("not parsed"),
            documentIri: "urn:import",
            mediaType,
          }),
        }),
      ).rejects.toMatchObject({
        code: "MAPPING_MEDIA_TYPE_UNSUPPORTED",
        pointer: "/resolveImport/mediaType",
      });
    }
  },
);

test.each([
  ["text/owl-dl", "A ⊑ B"],
  ["text/owl-krss", "(define-primitive-concept A B)"],
])(
  "explicit imported %s preserves structure and document context",
  async (mediaType, text) => {
    const root = bytes("Ontology(Import(<urn:authored-import>))");
    const load = (importText, importMediaType, mappingProfile) =>
      fromOwl(root, {
        ...options,
        mappingProfile,
        resolveImport: async (iri, context) => {
          expect(iri).toBe("urn:authored-import");
          expect(context.importingDocumentIri).toBe("urn:doc");
          return {
            bytes: bytes(importText),
            documentIri: "urn:resolved-import",
            mediaType: importMediaType,
          };
        },
      });
    for (const mappingProfile of [undefined, strict]) {
      const expected = await load(
        "Ontology(SubClassOf(<urn:resolved-import#A> <urn:resolved-import#B>))",
        options.mediaType,
        mappingProfile,
      );
      const result = await load(text, mediaType, mappingProfile);
      expect(result.diagnostics).toEqual([]);
      expect(result.document.structural.ontology.imports).toEqual([
        "urn:authored-import",
      ]);
      expect(
        result.document.structural.subjects.map(({ iri }) => iri).sort(),
      ).toEqual(["urn:resolved-import#A", "urn:resolved-import#B"]);
      expect(encode(result.document)).toEqual(encode(expected.document));
    }
  },
);

test.each([
  ["0001", "integer"],
  ["9007199254740993", "integer"],
  ["1.00", "double"],
  ["0.10000000000000001", "double"],
])(
  "DL retains exact literal %s through canonical encoding",
  async (lexical, datatype) => {
    const text = `exists age.{${lexical}} ⊑ Adult`;
    const functional = `Ontology(SubClassOf(DataSomeValuesFrom(<urn:doc#age> DataOneOf("${lexical}"^^<${xsd}${datatype}>)) <urn:doc#Adult>))`;
    for (const mappingProfile of [undefined, strict]) {
      for (const imported of [false, true]) {
        const load = (source, mediaType) =>
          imported
            ? fromOwl(bytes("Ontology(Import(<urn:doc>))"), {
                ...options,
                documentIri: "urn:root",
                mappingProfile,
                resolveImport: async () => ({
                  bytes: bytes(source),
                  documentIri: "urn:doc",
                  mediaType,
                }),
              })
            : fromOwl(bytes(source), { ...options, mediaType, mappingProfile });
        const result = await load(text, "text/owl-dl");
        expect(result.diagnostics).toEqual([]);
        const enumeration = result.document.structural.expressions.find(
          ({ kind }) => kind === "data-enumeration",
        );
        expect(enumeration?.members).toEqual([
          { kind: "typed", lexical, datatype: xsd + datatype },
        ]);
        const expected = await load(functional, options.mediaType);
        expect(encode(result.document)).toEqual(encode(expected.document));
      }
    }
  },
);

test.each([
  [
    "(define-primitive-role p q :right-identity r)",
    "MAPPING_UNSUPPORTED_CONSTRUCT",
  ],
  ["(define-primitive-role p q :right-identity)", "MAPPING_SYNTAX_INVALID"],
])(
  "KRSS1 rejects the clause %s without fallback or partial success",
  async (text, code) => {
    for (const mappingProfile of [undefined, strict]) {
      await expect(
        fromOwl(bytes(text), {
          ...options,
          mediaType: "text/owl-krss",
          mappingProfile,
        }),
      ).rejects.toMatchObject({ code });
      await expect(
        fromOwl(bytes("Ontology(Import(<urn:import>))"), {
          ...options,
          mappingProfile,
          resolveImport: async () => ({
            bytes: bytes(text),
            documentIri: "urn:import",
            mediaType: "text/owl-krss",
          }),
        }),
      ).rejects.toMatchObject({ code });
    }
  },
);

test.each([
  ["text/owl-dl", "p(alice, 0001)", "ObjectProperty"],
  ["text/owl-krss", "(define-primitive-role p q)", "DataProperty"],
])(
  "imported %s still participates in full-closure role validation",
  async (mediaType, text, conflictingRole) => {
    const root = bytes(
      `Ontology(Import(<urn:import>) Declaration(${conflictingRole}(<urn:import#p>)))`,
    );
    const settings = {
      ...options,
      resolveImport: async () => ({
        bytes: bytes(text),
        documentIri: "urn:import",
        mediaType,
      }),
    };
    await expect(
      fromOwl(root, { ...settings, mappingProfile: strict }),
    ).rejects.toMatchObject({
      code: "MAPPING_MULTIPLE_ROLES",
    });
    const result = await fromOwl(root, settings);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_MULTIPLE_ROLES" }),
      ]),
    );
    if (mediaType === "text/owl-dl") {
      // The ABox assertion is excluded only after its role collision is checked.
      expect(result.document.structural.constructs).toEqual([]);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "MAPPING_EXCLUDED_AXIOM" }),
        ]),
      );
    }
  },
);

test("a native resolver cancellation is fatal in compatibility mode", async () => {
  await expect(
    fromOwl(bytes("Ontology(Import(<urn:import>))"), {
      ...options,
      resolveImport: async () => {
        throw new DOMException("cancelled", "AbortError");
      },
    }),
  ).rejects.toMatchObject({ code: "ABORTED" });
});

test("a generic declaration retains every independently established property category", async () => {
  const input = bytes(
    `<urn:ont> a <${owl}Ontology>; <${owl}imports> <urn:import> . <urn:p> a <${rdf}Property> .`,
  );
  const settings = {
    ...options,
    mediaType: "text/turtle",
    resolveImport: async () => ({
      bytes: bytes(
        'Ontology(ObjectPropertyAssertion(<urn:p> <urn:a> <urn:b>) DataPropertyAssertion(<urn:p> <urn:a> "value"))',
      ),
      documentIri: "urn:import",
      mediaType: options.mediaType,
    }),
  };
  const result = await fromOwl(input, settings);
  const property = result.document.structural.subjects.find(
    ({ iri }) => iri === "urn:p",
  );
  expect(
    result.document.structural.roles
      .filter(({ subject }) => subject === property.id)
      .map(({ kind }) => kind)
      .sort(),
  ).toEqual(["data-property", "object-property"]);
  await expect(
    fromOwl(input, { ...settings, mappingProfile: strict }),
  ).rejects.toMatchObject({ code: "MAPPING_MULTIPLE_ROLES" });
});

test.each(["someValuesFrom", "allValuesFrom"])(
  "an unsupported RDFS %s domain is omitted as one complete statement",
  async (quantifier) => {
    const input = bytes(`<urn:p> a <${rdf}Property>; <${rdfs}domain> _:r .
    _:r a <${owl}Restriction>; <${owl}onProperties> (<urn:d1> <urn:d2>); <${owl}${quantifier}> <${rdfs}Literal> .
    <urn:d1> a <${owl}DatatypeProperty> . <urn:d2> a <${owl}DatatypeProperty> .`);
    const settings = { ...options, mediaType: "text/turtle" };
    const result = await fromOwl(input, settings);
    expect(result.document.structural.constructs).toEqual([]);
    expect(result.document.structural.expressions).toEqual([]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MAPPING_UNSUPPORTED_CONSTRUCT" }),
      ]),
    );
    await expect(
      fromOwl(input, { ...settings, mappingProfile: strict }),
    ).rejects.toMatchObject({ code: "MAPPING_UNSUPPORTED_CONSTRUCT" });
  },
);

test("named datatype-definition cycles are retained only under the explicit global recovery", async () => {
  const input = bytes(
    "Ontology(DatatypeDefinition(<urn:A> <urn:B>) DatatypeDefinition(<urn:B> <urn:A>))",
  );
  const result = await fromOwl(input, options);
  expect(result.document.structural.constructs).toHaveLength(2);
  expect(
    result.diagnostics.some(
      ({ code, details }) =>
        code === "MAPPING_GLOBAL_RESTRICTION" &&
        details.includes("CYCLIC_DATATYPE_DEFINITION"),
    ),
  ).toBe(true);
  await expect(
    fromOwl(input, { ...options, mappingProfile: strict }),
  ).rejects.toMatchObject({ code: "MAPPING_GLOBAL_RESTRICTION" });
});
