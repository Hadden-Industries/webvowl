// B4/B5 display belongs to the application. This module never creates semantic
// facts or occurrences, and its derived strings are not canonical wire fields.
const encoder = new TextEncoder();
import { namespaces } from "vowl";
const { owl: OWL, rdf: RDF, rdfs: RDFS, xsd: XSD } = namespaces;
const builtinNames = new Map([
  [OWL + "Thing", "Thing"],
  [OWL + "Nothing", "Nothing"],
  [RDFS + "Resource", "Resource"],
  [RDFS + "Literal", "Literal"],
]);
const exempt = new Set([
  ..."Thing Nothing topObjectProperty bottomObjectProperty topDataProperty bottomDataProperty real rational versionInfo priorVersion backwardCompatibleWith incompatibleWith deprecated"
    .split(" ")
    .map((name) => OWL + name),
  ..."Resource Class Datatype Literal label comment seeAlso isDefinedBy"
    .split(" ")
    .map((name) => RDFS + name),
  ..."Property type PlainLiteral XMLLiteral langString"
    .split(" ")
    .map((name) => RDF + name),
  ..."anyURI base64Binary boolean byte dateTime dateTimeStamp decimal double float hexBinary int integer language long Name NCName negativeInteger NMTOKEN nonNegativeInteger nonPositiveInteger normalizedString positiveInteger short string token unsignedByte unsignedInt unsignedLong unsignedShort"
    .split(" ")
    .map((name) => XSD + name),
]);
// B4 fixes this set independently of the runtime's Unicode whitespace tables.
const forbiddenSuffix = new Set([
  ...":/#\u0009\u000a\u000b\u000c\u000d\u0020\u0085\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000",
]);

function compareUtf8(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

// Admitted literals have closed scalar fields. Sorting their field names by
// UTF-16 gives their complete RFC 8785 spelling for B4's byte comparison.
function literalSpelling(literal) {
  return JSON.stringify(literal, Object.keys(literal).sort());
}

function leastLiteral(candidates) {
  return candidates.reduce(
    (least, candidate) =>
      least === undefined ||
      compareUtf8(literalSpelling(candidate), literalSpelling(least)) < 0
        ? candidate
        : least,
    undefined,
  )?.lexical;
}

function fallbackName(iri, unnamedKind, prefixes) {
  if (!iri) {
    return unnamedKind;
  }
  if (builtinNames.has(iri)) {
    return builtinNames.get(iri);
  }
  const matches = prefixes
    .filter((binding) => {
      const suffix = iri.slice(binding.iri.length);
      return (
        iri.startsWith(binding.iri) &&
        suffix.length > 0 &&
        ![...suffix].some((character) => forbiddenSuffix.has(character))
      );
    })
    .sort(
      (a, b) =>
        [...b.iri].length - [...a.iri].length ||
        compareUtf8(a.prefix, b.prefix),
    );
  if (matches.length) {
    return `${matches[0].prefix}:${iri.slice(matches[0].iri.length)}`;
  }
  const separator = Math.max(
    iri.lastIndexOf("#"),
    iri.lastIndexOf("/"),
    iri.lastIndexOf(":"),
  );
  return iri.slice(separator + 1) || iri;
}

/** Select only qualifying retained annotation-assertion values, never anchors. */
export function labelCandidates(structural, subject) {
  return indexVowlLabelCandidates(structural).get(subject) ?? [];
}

export function indexVowlLabelCandidates(structural) {
  const index = new Map();
  for (const record of structural.constructs) {
    if (
      record.kind !== "annotation-assertion" ||
      record.predicate !== RDFS + "label"
    ) {
      continue;
    }
    const value = record.value;
    if (
      value.kind === "language" ||
      (value.kind === "typed" && value.datatype === XSD + "string")
    ) {
      const candidates = index.get(record.subject) ?? [];
      candidates.push(value);
      index.set(record.subject, candidates);
    }
  }
  return index;
}

export function selectVowlLabel({
  iri,
  unnamedKind,
  selection,
  candidates,
  prefixes,
}) {
  if (selection.mode === "iri") {
    return iri || unnamedKind;
  }
  const eligible = candidates.filter(
    (value) =>
      value.kind === "language" ||
      (value.kind === "typed" && value.datatype === XSD + "string"),
  );
  if (selection.mode === "language" && selection.range !== "*") {
    let range = selection.range;
    while (range) {
      const selected = leastLiteral(
        eligible.filter(
          (value) => value.kind === "language" && value.language === range,
        ),
      );
      if (selected !== undefined) {
        return selected;
      }
      const parts = range.split("-");
      parts.pop();
      if (parts.at(-1)?.length === 1) {
        parts.pop();
      }
      range = parts.join("-");
    }
  }
  return (
    leastLiteral(eligible.filter((value) => value.kind === "typed")) ??
    fallbackName(iri, unnamedKind, prefixes)
  );
}

function namespaceKey(iri, isRoot) {
  // Validated IRIs enter here. URL would normalize case, ports and escapes and
  // therefore cannot implement B5's deliberately lexical classification.
  // Delimiter scans have bounded linear work even for rejected input. An
  // optional authority followed by a greedy path permits regex backtracking.
  const schemeEnd = iri.indexOf(":") + 1;
  const fragmentStart = iri.indexOf("#", schemeEnd);
  const contentEnd = fragmentStart < 0 ? iri.length : fragmentStart;
  const question = iri.indexOf("?", schemeEnd);
  const pathEnd =
    question >= 0 && question < contentEnd ? question : contentEnd;
  const fragment = fragmentStart < 0 ? undefined : iri.slice(fragmentStart);
  if (
    schemeEnd < 2 ||
    (fragment !== undefined && /[\n\r\u2028\u2029]/u.test(fragment))
  ) {
    throw new TypeError("Display requires an absolute admitted IRI.");
  }
  const scheme = iri.slice(0, schemeEnd);
  let pathStart = schemeEnd;
  if (iri.startsWith("//", schemeEnd)) {
    const slash = iri.indexOf("/", schemeEnd + 2);
    pathStart = slash >= 0 && slash < pathEnd ? slash : pathEnd;
  }
  const authority = iri.slice(schemeEnd, pathStart);
  const query = iri.slice(pathEnd, contentEnd);
  let path = iri.slice(pathStart, pathEnd);
  if (!isRoot && fragment === undefined) {
    let separator = path.lastIndexOf("/");
    if (separator < 0 && authority === "") {
      separator = path.lastIndexOf(":");
    }
    if (separator >= 0) {
      path = path.slice(0, separator);
    }
  }
  if (path.endsWith("/") || path.endsWith(":")) {
    path = path.slice(0, -1);
  }
  return scheme + authority + path + query;
}

export function isVowlExternal({ rootOntologyIri, subjectIri }) {
  return Boolean(
    rootOntologyIri &&
    subjectIri &&
    rootOntologyIri !== subjectIri &&
    !exempt.has(subjectIri) &&
    namespaceKey(rootOntologyIri, true) !== namespaceKey(subjectIri, false),
  );
}

export function selectVowlPrincipal({ rootOntologyIri, members }) {
  const named = members.filter((member) => member.iri);
  const lexical = (a, b) =>
    compareUtf8(a.iri, b.iri) || compareUtf8(a.kind, b.kind);
  const sorted = [...named].sort(
    (a, b) =>
      Number(isVowlExternal({ rootOntologyIri, subjectIri: a.iri })) -
        Number(isVowlExternal({ rootOntologyIri, subjectIri: b.iri })) ||
      lexical(a, b),
  );
  return { principal: sorted[0], aliases: sorted.slice(1).sort(lexical) };
}

export function vowlRadiusFactor({
  generic,
  nodeScaling,
  directDistinctIndividualCount,
}) {
  if (generic) {
    return 0.6;
  }
  return nodeScaling === "uniform"
    ? 1
    : 1 + Math.min(3, Math.log2(1 + directDistinctIndividualCount) / 4);
}

export function directMembershipCount(targets, memberships) {
  return countIndexedDirectMemberships(
    targets,
    indexDirectMemberships(memberships),
  );
}

export function indexDirectMemberships(memberships) {
  const index = new Map();
  for (const [target, individual] of memberships) {
    const individuals = index.get(target) ?? new Set();
    individuals.add(individual);
    index.set(target, individuals);
  }
  return index;
}

export function countIndexedDirectMemberships(targets, memberships) {
  const individuals = new Set();
  for (const target of targets) {
    for (const individual of memberships.get(target) ?? []) {
      individuals.add(individual);
    }
  }
  return individuals.size;
}

export function cardinalityText({ kind, cardinality }) {
  if (kind.endsWith("min-cardinality")) {
    return `${cardinality}..*`;
  }
  if (kind.endsWith("max-cardinality")) {
    return `0..${cardinality}`;
  }
  return cardinality;
}

export function projectCanvasPoint({ viewport, center, zoom, point }) {
  return {
    x: viewport.width / 2 + zoom * (point.x - center.x),
    y: viewport.height / 2 + zoom * (point.y - center.y),
  };
}

export function cameraCenter({ viewport, translation, zoom }) {
  return {
    x: (viewport.width / 2 - translation.x) / zoom,
    y: (viewport.height / 2 - translation.y) / zoom,
  };
}

export function compactVowlNotation({
  compactNotation,
  selectedName,
  aliases,
  cardinality,
  subclassPhrase,
  characteristicOnlyIndication,
}) {
  return {
    selectedName,
    aliases,
    cardinality,
    subclassPhrase: compactNotation ? "" : subclassPhrase,
    characteristicOnlyIndication,
    occurrenceTopologyChanged: false,
    placementsStillRequired: true,
  };
}
