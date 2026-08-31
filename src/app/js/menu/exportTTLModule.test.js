import { beforeEach, describe, expect, test } from "@jest/globals";
import exportTTLModuleFactory from "./exportTTLModule.js";

describe("exportTTLModule", () => {
  let exportTTLModule;
  let mockGraph;
  let mockNodes;
  let mockProps;
  let prefixListMock;

  beforeEach(() => {
    prefixListMock = {
      owl: "http://www.w3.org/2002/07/owl#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      ex: "http://example.org/ns#",
    };

    mockNodes = [
      {
        id: () => "node1",
        iri: () => "https://example.tech/ontology#Item",
        type: () => "owl:Class",
        label: () => "Item",
        labelForCurrentLanguage: () => "Item",
        commentForCurrentLanguage: () => "",
        annotations: () => null,
        attributes: () => [],
        equivalents: () => [
          {
            iri: () => "https://another.cloud/ns#EquivalentItem",
          },
        ],
        disjointWith: () => [],
        union: () => [],
        disjointUnion: () => ["node2"],
        individuals: () => [],
        indications: () => [],
      },
      {
        id: () => "node2",
        iri: () => "http://example.org/ns#PrefixedClass",
        type: () => "owl:Class",
        label: () => "PrefixedClass",
        labelForCurrentLanguage: () => "PrefixedClass",
        commentForCurrentLanguage: () => "",
        annotations: () => null,
        attributes: () => [],
        equivalents: () => [],
        disjointWith: () => [],
        union: () => [],
        disjointUnion: () => [],
        individuals: () => [],
        indications: () => [],
      },
    ];

    mockProps = [
      {
        id: () => "prop1",
        iri: () => "https://example.tech/ontology#hasPart",
        type: () => "owl:ObjectProperty",
        label: () => "hasPart",
        labelForCurrentLanguage: () => "hasPart",
        commentForCurrentLanguage: () => "",
        annotations: () => null,
        attributes: () => [],
        domain: () => mockNodes[0],
        range: () => mockNodes[1],
        equivalents: () => [],
        inverse: () => null,
        superproperties: () => null,
        subproperties: () => null,
        disjointWith: () => [],
        individuals: () => [],
        indications: () => [],
      },
    ];

    mockGraph = {
      options: () => ({
        prefixList: () => prefixListMock,
        getGeneralMetaObjectProperty: (prop) => {
          if (prop === "iri") {
            return "http://example.org/ontology#";
          }
          if (prop === "title") {
            return "Test Ontology";
          }
          if (prop === "version") {
            return "1.0";
          }
          return undefined;
        },
      }),
      getClassDataForTtlExport: () => mockNodes,
      getPropertyDataForTtlExport: () => mockProps,
      getUnfilteredData: () => ({
        nodes: mockNodes,
        properties: mockProps,
      }),
    };

    exportTTLModule = exportTTLModuleFactory(mockGraph);
  });

  test("properly formats modern TLD absolute IRIs with <...> and prefixed IRIs without brackets in TTL", () => {
    const success = exportTTLModule.requestExport();
    expect(success).toBe(true);

    const ttlContent = exportTTLModule.resultingTTL_Content();

    // Node 1 has IRI https://example.tech/ontology#Item (no prefix defined for example.tech)
    // It must be formatted with angle brackets <https://example.tech/ontology#Item>
    expect(ttlContent).toContain("<https://example.tech/ontology#Item>");
    expect(ttlContent).not.toMatch(
      /(?:^|\s)https:\/\/example\.tech\/ontology#Item(?:\s|$)/,
    );

    // Equivalent class
    expect(ttlContent).toContain(
      "owl:equivalentClass <https://another.cloud/ns#EquivalentItem>",
    );

    // Disjoint union
    expect(ttlContent).toContain("owl:disjointUnionOf");

    // Property IRI
    expect(ttlContent).toContain("<https://example.tech/ontology#hasPart>");

    // Node 2 has IRI http://example.org/ns#PrefixedClass matching prefix 'ex'
    // It must be formatted as ex:PrefixedClass without angle brackets
    expect(ttlContent).toContain("ex:PrefixedClass");
    expect(ttlContent).not.toContain("<ex:PrefixedClass>");
  });
});
