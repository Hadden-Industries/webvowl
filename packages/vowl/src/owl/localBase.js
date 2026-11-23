import { isIri, isIriReference } from "@hyperjump/uri";
import { fail } from "../errors.js";

const relativeReference = (value) =>
  typeof value === "string" && !isIri(value) && isIriReference(value);

function containsRelativeIri(value, budget, depth = 1) {
  budget.check();
  if (value === null || typeof value !== "object") {
    return false;
  }
  budget.bound("depth", depth);
  if (value.kind === "IRI" || value.termType === "NamedNode") {
    return relativeReference(value.value);
  }
  for (const child of value instanceof Set ? value : Object.values(value)) {
    if (containsRelativeIri(child, budget, depth + 1)) {
      return true;
    }
  }
  return false;
}

/** Check the RDF/XML syntax reader's unresolved terms without assigning a default base. */
export async function missingLocalBase(error, text, formatKey, budget) {
  if (error.code !== "OWL_SYNTAX_ERROR") {
    return false;
  }
  if (
    (formatKey === undefined || formatKey === "owlxml") &&
    relativeReference(error.iri) &&
    !Object.hasOwn(error, "abbreviatedIRI") &&
    !Object.hasOwn(error, "baseIRI")
  ) {
    return true;
  }
  if (
    (formatKey !== undefined && formatKey !== "rdfxml") ||
    !Object.hasOwn(error, "parserMessage") ||
    !text.trimStart().startsWith("<")
  ) {
    return false;
  }
  const { RdfXmlParser } = await import("rdfxml-streaming-parser");
  budget.check();
  const parser = new RdfXmlParser({ strict: true, validateUri: false });
  let relative = false;
  let invalid = false;
  let count = 0;
  return new Promise((resolve, reject) => {
    parser.on("error", () => resolve(false));
    parser.on("end", () => resolve(relative && !invalid));
    parser.on("data", (quad) => {
      try {
        budget.check();
        budget.bound("rdfQuads", ++count);
        for (const term of [
          quad.subject,
          quad.predicate,
          quad.object,
          quad.object.datatype,
        ]) {
          if (term?.termType === "NamedNode" && !isIri(term.value)) {
            if (relativeReference(term.value)) {
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
    // The owning parser has already checked XML structure and its entity limits.
    parser.end(text);
  });
}

const jsonLdRelativeEvents = new Set([
  "relative @id reference",
  "relative @type reference",
  "relative @vocab reference",
  "relative graph reference",
  "relative object reference",
  "relative predicate reference",
  "relative subject reference",
]);

/** JSON-LD can discard relative RDF terms before OWLAPI's public output. */
async function requireJsonLdBase(text, budget) {
  const { default: jsonld } = await import("jsonld");
  const input = JSON.parse(text);
  async function relativeEvents(base) {
    budget.check();
    const counts = new Map();
    await jsonld.toRDF(input, {
      base,
      produceGeneralizedRdf: false,
      documentLoader() {
        // Match the OWL ingress policy and never acquire from diagnostic input.
        fail("MAPPING_SYNTAX_INVALID");
      },
      eventHandler({ event, next }) {
        budget.check();
        if (jsonLdRelativeEvents.has(event.code)) {
          counts.set(event.code, (counts.get(event.code) ?? 0) + 1);
        }
        next();
      },
    });
    budget.check();
    return counts;
  }
  const withoutBase = await relativeEvents(undefined);
  if (withoutBase.size) {
    // Confirm that external context actually helps. An explicit @base: null
    // can leave the same events regardless of the supplied document base.
    // The probe's triples and base never reach OWL admission or the resolver.
    const withBase = await relativeEvents(
      "https://webvowl.invalid/base-check/",
    );
    for (const [code, count] of withoutBase) {
      if ((withBase.get(code) ?? 0) < count) {
        fail("MAPPING_BASE_REQUIRED");
      }
    }
  }
}

/** Reject unresolved terms from the selected file before model projection. */
export async function requireResolvedLocalSource(
  ontology,
  format,
  text,
  budget,
) {
  const metadata = format?.getOntologyLoaderMetaData();
  const identity = ontology.getOntologyID();
  if (
    containsRelativeIri(
      [
        identity.ontologyIRI,
        identity.versionIRI,
        ontology.getImportsDeclarations(),
        ontology.getAnnotations(),
        ontology.getAxioms(),
        metadata?.getUnparsedTriples(),
      ],
      budget,
    )
  ) {
    fail(
      format?.key === "ntriples" || format?.key === "nquads"
        ? "MAPPING_SYNTAX_INVALID"
        : "MAPPING_BASE_REQUIRED",
    );
  }
  if (format?.key === "jsonld") {
    await requireJsonLdBase(text, budget);
  }
}

/** A parser fallback must not satisfy an import merely by aliasing the local root. */
export function requireUnambiguousLocalBase(loaded, baseIri, budget) {
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
