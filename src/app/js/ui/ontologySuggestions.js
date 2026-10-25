import { canonicalExampleSource } from "../canonicalExamples.js";

// Curated order is product meaning, not a locale-dependent sort order.
export function createOntologySuggestions(
  resolveExample = canonicalExampleSource,
) {
  const hadden = [
    [
      "H1",
      "ISO/IEC 11179-3:2023 Ontology",
      "Metadata",
      "iso-iec/11179/-3/ed-4/latest",
    ],
    [
      "H2",
      "Hadden Industries Universal Reference Data Ontology",
      "Reference Data",
      "universal/reference-data/latest",
    ],
    [
      "H3",
      "Hadden Industries Universal Core Ontology",
      "Core",
      "universal/core/latest-unstable",
    ],
    [
      "H4",
      "Hadden Industries Universal Extended Ontology",
      "Extended",
      "universal/extended/latest-unstable",
    ],
  ].map(([id, title, category, path]) => ({
    id,
    title,
    category,
    group: "Hadden Industries",
    badge: path.endsWith("latest-unstable") ? "latest-unstable" : "latest",
    url: "https://haddenindustries.com/ontology/" + path,
    provenance: "Published ontology from Hadden Industries",
  }));
  const others = [
    [
      "O1",
      "foaf",
      "Friend of a Friend (FOAF) vocabulary",
      "https://xmlns.com/foaf/spec/index.rdf",
    ],
    [
      "O2",
      "goodrelations",
      "GoodRelations Vocabulary for E-Commerce",
      "http://purl.org/goodrelations/v1.owl",
    ],
    [
      "O3",
      "muto",
      "Modular and Unified Tagging Ontology (MUTO)",
      "https://muto.socialtagging.org/core/v1.rdf",
    ],
    [
      "O4",
      "ontovibe",
      "Ontology Visualization Benchmark (OntoViBe)",
      "http://ontovibe.visualdataweb.org",
    ],
    [
      "O5",
      "personasonto",
      "Personas Ontology (PersonasOnto)",
      "http://blankdots.com/open/personasonto.owl",
    ],
    [
      "O6",
      "sioc",
      "SIOC (Semantically-Interlinked Online Communities) Core Ontology",
      "http://rdfs.org/sioc/ns#",
    ],
  ].map(([id, presetKey, title, publisherUrl]) => ({
    id,
    title,
    presetKey,
    group: "Others",
    category: "Packaged example",
    badge: "Packaged example",
    url: resolveExample(presetKey).url,
    publisherUrl,
    provenance:
      "Transformed Canonical VOWL visualization; not an original OWL document or stable interchange file",
  }));
  return Object.freeze([...hadden, ...others].map(Object.freeze));
}

export const ontologySuggestions = createOntologySuggestions();

// NFKC plus locale-independent Unicode lowercasing. This deliberately does not
// promise full case folding (for example, German sharp s is not expanded to ss).
function matchText(value) {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

export function findOntologySuggestions(
  value,
  catalogue = ontologySuggestions,
) {
  const text = typeof value === "string" ? value.trim() : "";
  const tokens = matchText(text)
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/^https?:\/\//u, ""));
  const matches = catalogue.filter((entry) => {
    const fields = [
      entry.title,
      entry.category,
      entry.group,
      entry.badge,
      entry.url.replace(/^https?:\/\//iu, ""),
      (entry.publisherUrl ?? "").replace(/^https?:\/\//iu, ""),
      entry.presetKey ?? "",
      entry.provenance,
    ].map(matchText);
    return tokens.every((token) =>
      fields.some((field) => field.includes(token)),
    );
  });
  const committed = catalogue.find((entry) => entry.url === text) ?? null;
  // A scheme-bearing value is someone's address, never an invitation to replace
  // it with the first matching suggestion. Empty input has no active option.
  const activeId =
    text && !/^[a-z][a-z\d+.-]*:/i.test(text) ? (matches[0]?.id ?? null) : null;
  return { matches, activeId, committed };
}
