import { jsonKey } from "./canonicalJson.js";

/** Preserve owning-parser residual RDF as RDF, without reconstructing OWL. */
export function retainSourceStatements(evidence, budget) {
  const sourceNodes = [];
  const sourceStatements = [];
  const seen = new Set();
  const quadsByDocument = new Map();
  for (const { documentIri, diagnostic } of evidence.diagnostics) {
    budget.check();
    if (diagnostic.code === "RDF_UNCONSUMED_TRIPLE") {
      budget.charge("embeddedValues");
      const quads = quadsByDocument.get(documentIri) ?? [];
      quads.push(diagnostic.quad);
      quadsByDocument.set(documentIri, quads);
    }
  }
  for (const document of evidence.documents) {
    const quads = quadsByDocument.get(document.documentIri) ?? [];
    const tripleKey = ({ subject, predicate, object }) =>
      jsonKey({ subject, predicate, object });
    const graphAttributed = new Set(quads.map(tripleKey));
    const statements = [
      ...quads,
      ...(document.parserMetadata?.unparsedTriples ?? []).filter(
        (triple) => !graphAttributed.has(tripleKey(triple)),
      ),
    ];
    const blanks = new Map();
    function resource(term) {
      budget.check();
      if (term.termType === "NamedNode") {
        return { kind: "iri", iri: term.value };
      }
      if (!blanks.has(term.value)) {
        budget.charge("primaryRecords");
        const id = `source:blank:${sourceNodes.length}`;
        blanks.set(term.value, id);
        sourceNodes.push({ id, document: document.id });
      }
      return { kind: "blank", node: blanks.get(term.value) };
    }
    for (const triple of statements) {
      budget.check();
      const term = triple.object;
      const payload = {
        document: document.id,
        graph:
          triple.graph === undefined
            ? { kind: "unavailable" }
            : triple.graph.termType === "DefaultGraph"
              ? { kind: "default" }
              : resource(triple.graph),
        subject: resource(triple.subject),
        predicate: triple.predicate.value,
        object:
          term.termType === "Literal"
            ? {
                kind: "literal",
                value: {
                  lexical: term.value,
                  language: term.language,
                  datatype: term.datatype.value,
                  ...(Object.hasOwn(term, "direction")
                    ? { direction: term.direction }
                    : {}),
                },
              }
            : resource(term),
      };
      const key = jsonKey(payload);
      if (!seen.has(key)) {
        budget.charge("primaryRecords");
        seen.add(key);
        sourceStatements.push({
          id: `source:statement:${sourceStatements.length}`,
          ...payload,
        });
      }
    }
  }
  return { sourceNodes, sourceStatements };
}

export function sourceStatementUncertainty(sourceStatements, budget) {
  const iris = new Set();
  let anonymous = false;
  for (const statement of sourceStatements) {
    budget.check();
    iris.add(statement.predicate);
    for (const term of [statement.subject, statement.object, statement.graph]) {
      if (term.kind === "iri") {
        iris.add(term.iri);
      } else if (term.kind === "blank") {
        anonymous = true;
      } else if (term.kind === "literal") {
        iris.add(term.value.datatype);
      }
    }
  }
  return { iris, anonymous };
}
