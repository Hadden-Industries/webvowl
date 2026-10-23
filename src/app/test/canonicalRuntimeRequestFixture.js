/** Independent canonical occurrence fixture for seam tests, not a legacy-model conversion. */
export function canonicalRuntimeRequestFixture(loadGeneration) {
  const members = [
    {
      record: "person",
      kind: "class",
      iri: "https://example.test/Person",
      name: "Person",
      externalStyle: false,
    },
    {
      record: "anonymous",
      kind: "class",
      name: "Anonymous",
      externalStyle: false,
    },
    {
      record: "knows",
      kind: "object-property",
      iri: "https://example.test/knows",
      name: "knows",
      externalStyle: false,
    },
  ];
  const references = [
    { kind: "class", iri: "https://example.test/Person" },
    { kind: "class", loadGeneration, localId: "AnonymousClass1" },
    { kind: "property", iri: "https://example.test/knows" },
  ];
  return {
    loadGeneration,
    documentRevision: 0,
    layout: "resume",
    drawing: {
      nodes: ["Person", "AnonymousClass1"].map((occurrence, index) => ({
        occurrence,
        targets: [members[index].record],
        principal: members[index],
        aliases: [],
        position: { x: 30 + index * 7, y: 41 - index * 5 },
        pinned: false,
        radiusFactor: 1,
        hidden: false,
      })),
      edges: [
        {
          occurrence: "edge:knows",
          kind: "object-edge",
          from: "Person",
          to: "AnonymousClass1",
          records: ["knows"],
          hidden: false,
        },
      ],
      labels: [
        {
          occurrence: "knows",
          edge: "edge:knows",
          direction: "forward",
          principal: members[2],
          name: "knows",
          aliases: [],
          records: ["knows"],
          characteristics: [],
          position: { x: 44, y: 29 },
          pinned: false,
          hidden: false,
        },
      ],
      display: {
        compactNotation: false,
        nodeScaling: "direct-membership",
        externalColoring: true,
      },
      camera: { center: { x: 400, y: 300 }, zoom: 1 },
      labelSelection: { mode: "language", range: "default" },
      applicationBindings: [
        "Person",
        "AnonymousClass1",
        "knows",
        "edge:knows",
      ].map((occurrence, index) => ({
        occurrence,
        positionable: index < 3,
        runtimeReference: {
          loadGeneration,
          occurrenceId: `occurrence-${index + 1}`,
        },
        semanticReferences: index < 3 ? [references[index]] : [],
        recordTargets: [
          { loadGeneration, recordToken: Math.min(index + 1, 3) },
        ],
      })),
    },
  };
}
