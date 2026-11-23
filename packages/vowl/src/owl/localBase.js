import { isIri, isIriReference, parseIriReference } from "@hyperjump/uri";
import { fail } from "../errors.js";

const relativeReference = (value) =>
  typeof value === "string" && !isIri(value) && isIriReference(value);

function* iriValues(value, budget, depth = 1) {
  budget.check();
  if (value === null || typeof value !== "object") {
    return;
  }
  budget.bound("depth", depth);
  if (value.kind === "IRI" || value.termType === "NamedNode") {
    yield value.value;
    return;
  }
  for (const child of Array.isArray(value) || value instanceof Set
    ? value
    : Object.values(value)) {
    yield* iriValues(child, budget, depth + 1);
  }
}

function rootDocument(loaded) {
  return loaded.documents.find(({ ontology }) => ontology === loaded.ontology);
}

function rootIriValues(loaded, format, budget) {
  const { ontology } = loaded;
  const identity = ontology.getOntologyID();
  return iriValues(
    [
      identity.ontologyIRI,
      identity.versionIRI,
      ontology.getImportsDeclarations(),
      ontology.getAnnotations(),
      ontology.getAxioms(),
      format?.getOntologyLoaderMetaData()?.getUnparsedTriples(),
      rootDocument(loaded).context.selectedGraph,
    ],
    budget,
  );
}

const probeBase = "https://webvowl.invalid/local-base-check/";

function graphNamesCanCoincide(names) {
  const fragments = new Set();
  const lastSegments = new Set();
  let fixed = 0;
  for (const iri of names) {
    if (!isIriReference(iri)) {
      return false;
    }
    const { scheme, path, fragment } = parseIriReference(iri);
    fragments.add(fragment);
    fixed += Number(scheme !== undefined);
    // The base can change inherited path segments. An authored terminal
    // segment other than a dot segment keeps its spelling after resolution.
    if (path) {
      const segment = path.slice(path.lastIndexOf("/") + 1);
      if (segment !== "." && segment !== "..") {
        lastSegments.add(segment);
      }
    }
  }
  return fixed < 2 && fragments.size < 2 && lastSegments.size < 2;
}

async function rdfXmlNeedsBase(probe, budget) {
  const first = await probe("rdfxml", probeBase);
  if (!first) {
    return false;
  }
  const expected = new Set(rootIriValues(first.loaded, first.format, budget));
  // A different scheme also exposes authority-relative references such as //host/path.
  const second = await probe(
    "rdfxml",
    "http://webvowl-base.invalid/local-base-check/",
  );
  if (!second) {
    return false;
  }
  const observed = new Set(rootIriValues(second.loaded, second.format, budget));
  return (
    expected.size !== observed.size ||
    [...observed].some((iri) => !expected.has(iri))
  );
}

async function n3NeedsBase(text, formatKey, budget, graphAmbiguous) {
  const { StreamParser } = await import("n3");
  budget.check();
  const parser = new StreamParser({
    format: formatKey === "turtle" ? "text/turtle" : "application/trig",
  });
  let relative = false;
  let invalid = false;
  let count = 0;
  const blankNodes = new Set();
  const graphNames = new Set();
  let nonIriGraph = false;
  let relativeGraph = false;
  return new Promise((resolve, reject) => {
    parser.on("error", () => resolve(false));
    parser.on("end", () =>
      resolve(
        relative &&
          !invalid &&
          (!graphAmbiguous ||
            (relativeGraph &&
              !nonIriGraph &&
              graphNamesCanCoincide(graphNames))),
      ),
    );
    parser.on("data", (quad) => {
      try {
        budget.check();
        budget.bound("rdfQuads", ++count);
        for (const term of [
          quad.subject,
          quad.predicate,
          quad.object,
          quad.graph,
        ]) {
          if (term.termType === "BlankNode") {
            blankNodes.add(term.value);
          }
        }
        budget.bound("primaryRecords", blankNodes.size);
        if (graphAmbiguous) {
          const { termType, value } = quad.graph;
          if (termType !== "NamedNode") {
            nonIriGraph = true;
          } else {
            graphNames.add(value);
            relativeGraph ||= relativeReference(value);
          }
        }
        for (const iri of iriValues(quad, budget)) {
          if (!isIri(iri)) {
            if (relativeReference(iri)) {
              relative = true;
            } else {
              invalid = true;
            }
          }
        }
      } catch (reason) {
        reject(reason);
        parser.destroy();
      }
    });
    parser.end(text);
  });
}

/** Confirm a missing base using owning syntax evidence from an isolated diagnostic read. */
export async function missingLocalBase(error, text, formatKey, budget, probe) {
  if (error.code === "OWL_SYNTAX_ERROR") {
    if (
      (formatKey === undefined || formatKey === "owlxml") &&
      relativeReference(error.iri) &&
      !Object.hasOwn(error, "abbreviatedIRI") &&
      !Object.hasOwn(error, "baseIRI")
    ) {
      return Boolean(await probe("owlxml", probeBase));
    }
    if (
      (formatKey === undefined || formatKey === "rdfxml") &&
      error.syntax === undefined &&
      Object.hasOwn(error, "parserMessage") &&
      text.trimStart().startsWith("<")
    ) {
      return rdfXmlNeedsBase(probe, budget);
    }
  }
  const n3Format =
    formatKey ?? { Turtle: "turtle", TriG: "trig" }[error.syntax];
  if (
    (n3Format === undefined || n3Format === "turtle" || n3Format === "trig") &&
    (error.code === "AMBIGUOUS_RDF_DATASET" ||
      error instanceof TypeError ||
      (n3Format !== undefined && error.code === "OWL_SYNTAX_ERROR"))
  ) {
    return n3NeedsBase(
      text,
      n3Format,
      budget,
      error.code === "AMBIGUOUS_RDF_DATASET",
    );
  }
  return false;
}

const jsonLdDiscardedTerms = new Set([
  "relative graph reference",
  "relative object reference",
  "relative predicate reference",
  "relative subject reference",
]);
const jsonLdVocabularyErrors = new Set([
  "invalid IRI mapping",
  "invalid type mapping",
  "invalid typed value",
]);

/** Process local JSON-LD contexts once per base before OWL admission. */
export async function prepareLocalJsonLd(
  text,
  formatKey,
  fallbackBaseIri,
  budget,
) {
  if (
    formatKey !== "jsonld" &&
    (formatKey !== undefined || !["{", "["].includes(text.trimStart()[0]))
  ) {
    return undefined;
  }
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    // The owning reader reports JSON grammar errors and non-JSON inputs.
    return undefined;
  }
  if (input === null || typeof input !== "object") {
    return undefined;
  }
  if (formatKey === undefined) {
    // JSON sources use an explicit reader so plain JSON and other WebVOWL
    // document kinds cannot be interpreted as an empty JSON-LD ontology.
    fail("MAPPING_SYNTAX_INVALID");
  }
  const { default: jsonld } = await import("jsonld");
  async function relativeEvidence(base) {
    budget.check();
    // A resolved context cache can otherwise carry the unbased vocabulary
    // forward into a retry or reuse it with a different supplied base.
    const processor = jsonld();
    let vocab = false;
    let discarded = false;
    let relativeProperty = false;
    const relativeGraphs = new Set();
    const options = {
      base,
      produceGeneralizedRdf: false,
      documentLoader() {
        // Match the OWL ingress policy and never acquire from diagnostic input.
        fail("MAPPING_SYNTAX_INVALID");
      },
      eventHandler({ event, next }) {
        budget.check();
        vocab ||= event.code === "relative @vocab reference";
        discarded ||= jsonLdDiscardedTerms.has(event.code);
        relativeProperty ||=
          event.code === "invalid property" &&
          event.details?.expandedProperty !== event.details?.property &&
          relativeReference(event.details?.expandedProperty);
        if (event.code === "relative graph reference") {
          relativeGraphs.add(event.details.graph);
        }
        next();
      },
    };
    let expanded;
    try {
      expanded = await processor.expand(input, options);
    } catch (error) {
      if (vocab && jsonLdVocabularyErrors.has(error.details?.code)) {
        return { vocab, error };
      }
      throw error;
    }
    const quads = await processor.toRDF(expanded, {
      ...options,
      skipExpansion: true,
    });
    budget.check();
    budget.bound("rdfQuads", quads.length);
    let ambiguous = false;
    if (relativeGraphs.size) {
      for (const { graph } of quads) {
        budget.check();
        if (graph.termType === "NamedNode") {
          relativeGraphs.add(graph.value);
        } else {
          ambiguous = true;
        }
      }
      ambiguous ||= !graphNamesCanCoincide(relativeGraphs);
    }
    return {
      expanded,
      vocab,
      discarded: discarded || (vocab && relativeProperty),
      count: quads.length,
      ambiguous,
    };
  }
  const actual = await relativeEvidence(fallbackBaseIri ?? undefined);
  if (fallbackBaseIri === null && (actual.discarded || actual.vocab)) {
    // Compare RDF output, since an unused relative @id or @vocab need not emit RDF.
    const tested = await relativeEvidence(probeBase);
    if (
      !tested.error &&
      !tested.discarded &&
      (actual.error || tested.count > actual.count)
    ) {
      if (actual.ambiguous) {
        fail("MAPPING_AMBIGUOUS");
      }
      fail("MAPPING_BASE_REQUIRED");
    }
  }
  if (actual.error) {
    throw actual.error;
  }
  if (actual.discarded) {
    fail("MAPPING_SYNTAX_INVALID");
  }
  // The owning OWL reader still admits the graph. Passing expanded JSON-LD
  // keeps author-supplied contexts out of its shared processor cache. Source
  // evidence continues to retain the exact bytes supplied by the caller.
  return JSON.stringify(actual.expanded);
}

/** Reject unresolved terms from the selected file before model projection. */
export function requireResolvedLocalSource(
  loaded,
  format,
  fallbackBaseIri,
  budget,
) {
  for (const iri of rootIriValues(loaded, format, budget)) {
    if (!isIri(iri)) {
      fail(
        fallbackBaseIri === null &&
          format?.key !== "ntriples" &&
          format?.key !== "nquads" &&
          relativeReference(iri)
          ? "MAPPING_BASE_REQUIRED"
          : "MAPPING_SYNTAX_INVALID",
      );
    }
  }
}

/** A parser fallback must not satisfy an import merely by aliasing the local root. */
export function requireUnambiguousLocalBase(loaded, baseIri, budget) {
  for (const diagnostic of rootDocument(loaded).context.diagnostics) {
    budget.check();
    if (
      diagnostic.code === "RDF_MULTIPLE_ONTOLOGY_HEADERS" &&
      diagnostic.selectedOntologyIRI === baseIri &&
      diagnostic.candidateOntologyIRIs.some(
        (iri) =>
          iri.length < baseIri.length ||
          (iri.length === baseIri.length && iri < baseIri),
      )
    ) {
      // The pinned reader prefers a header matching its document IRI. The
      // supplied base carries no evidence that this was the retrieval IRI.
      fail("MAPPING_AMBIGUOUS");
    }
  }
  const rootIdentity = loaded.ontology.getOntologyID();
  if (
    rootIdentity.ontologyIRI?.value === baseIri ||
    rootIdentity.versionIRI?.value === baseIri
  ) {
    return;
  }
  for (const { ontology } of loaded.documents) {
    for (const declaration of ontology.getImportsDeclarations()) {
      budget.check();
      if (declaration.iri.value === baseIri) {
        fail("MAPPING_LOCAL_BASE_COLLISION");
      }
    }
  }
}
