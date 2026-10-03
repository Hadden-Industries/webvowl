import {
  retainSourceStatements,
  sourceStatementUncertainty,
} from "../src/retainedSourceStatements.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const named = (value) => ({ termType: "NamedNode", value });
const blank = (value) => ({ termType: "BlankNode", value });
test("quad diagnostics retain graph context without inventing default-graph duplicates", () => {
  const triple = {
    subject: blank("local"),
    predicate: named("urn:p"),
    object: named("urn:o"),
  };
  const evidence = {
    documents: [
      {
        id: "d1",
        documentIri: "urn:d1",
        parserMetadata: { unparsedTriples: [triple] },
      },
      {
        id: "d2",
        documentIri: "urn:d2",
        parserMetadata: { unparsedTriples: [triple] },
      },
    ],
    diagnostics: [named("urn:g"), blank("local")].map((graph) => ({
      documentIri: "urn:d1",
      diagnostic: { code: "RDF_UNCONSUMED_TRIPLE", quad: { ...triple, graph } },
    })),
  };
  const budget = new ResourceBudget({}, performance.now());
  try {
    const retained = retainSourceStatements(evidence, budget);
    expect(retained.sourceStatements).toHaveLength(3);
    expect(retained.sourceNodes).toHaveLength(2);
    const [namedGraph, anonymousGraph, unknownGraph] =
      retained.sourceStatements;
    expect(namedGraph.graph).toEqual({ kind: "iri", iri: "urn:g" });
    expect(anonymousGraph.graph).toEqual(anonymousGraph.subject);
    expect(unknownGraph.graph).toEqual({ kind: "unavailable" });
    expect(unknownGraph.subject.node).not.toBe(namedGraph.subject.node);
    expect(
      sourceStatementUncertainty(retained.sourceStatements, budget),
    ).toEqual({ iris: new Set(["urn:p", "urn:o", "urn:g"]), anonymous: true });
  } finally {
    budget.dispose();
  }
});
