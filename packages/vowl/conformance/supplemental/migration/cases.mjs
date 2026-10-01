// SPDX-License-Identifier: AGPL-3.0-only
// Expected models are manual A2/A4/B2 transcriptions. Historical code supplies
// migration INPUT ONLY. Neither a migration implementation nor its output is read.
import assert from "node:assert/strict";
import { model, projectFixture } from "../mapping-counterexamples/model.mjs";
import { appendArtifactCases } from "./artifact-cases.mjs";
import { historicalTools } from "./historical.mjs";
import { hash, profiles } from "./support.mjs";

export const NS = "https://example.org/legacy#";
export const ROOT = "https://example.org/legacy";
const XSD = "http://www.w3.org/2001/XMLSchema#";
const OWL = "http://www.w3.org/2002/07/owl#";
export const ANNOTATION_POINTER = "/classAttribute/0/annotations/note/0";
const clone = (value) => JSON.parse(JSON.stringify(value));

function manual({
  root,
  namedClass,
  namedClasses = [],
  relation,
  annotation,
  membership,
  ontologyAnnotation,
} = {}) {
  const m = model();
  if (root) m.structural.ontology.iri = root;
  if (namedClass) m.role("class-A", "class", NS + "A");
  for (const name of namedClasses) m.role(`class-${name}`, "class", NS + name);
  if (relation)
    m.fact(
      "named-relation",
      relation,
      relation === "subclass"
        ? { sub: "class-A", super: "class-B" }
        : { members: ["class-A", "class-B"] },
    );
  if (annotation) {
    m.role("note", "annotation-property", annotation.predicate);
    if (annotation.value.kind === "subject")
      m.structural.subjects.push({ id: annotation.value.subject });
    m.fact("note-on-A", "annotation-assertion", {
      subject: "s:class-A",
      predicate: annotation.predicate,
      value: annotation.value,
    });
    if (annotation.annotations?.length) {
      for (const [index, nested] of annotation.annotations.entries())
        m.role(`nested-note-${index}`, "annotation-property", nested.predicate);
      m.fact("anchor-on-note-A", "assertion-anchor", {
        assertion: {
          kind: "annotation-assertion",
          subject: "s:class-A",
          predicate: annotation.predicate,
          value: annotation.value,
        },
        annotations: annotation.annotations,
      });
    }
  }
  if (membership) {
    m.role("individual-i", "individual", NS + "i");
    m.fact("membership-i-A", "class-membership", {
      class: "class-A",
      individual: "individual-i",
    });
  }
  if (ontologyAnnotation) {
    m.role(
      "ontology-note",
      "annotation-property",
      ontologyAnnotation.predicate,
    );
    m.structural.ontology.annotations.push({
      ...ontologyAnnotation,
      annotations: [],
    });
  }
  return projectFixture(m.source);
}

export async function migrationCases() {
  const h = await historicalTools();
  const f = new h.OWLDataFactory();
  const iri = (text) => h.IRI.create(text);
  const A = f.getOWLClass(iri(NS + "A"));
  const B = f.getOWLClass(iri(NS + "B"));
  const C = f.getOWLClass(iri(NS + "C"));
  const p = f.getOWLObjectProperty(iri(NS + "p"));
  const q = f.getOWLObjectProperty(iri(NS + "q"));
  const declare = (entity) => f.getOWLDeclarationAxiom(entity);
  const build = (axioms, root = ROOT) =>
    new h.VOWLBuilder().build(
      new h.OWLOntology({
        axioms,
        ...(root ? { ontologyID: f.getOWLOntologyID(iri(root)) } : {}),
      }),
    );
  const exports = {
    empty: build([], undefined),
    named: build([declare(A)]),
    subclass: build([declare(A), declare(B), f.getOWLSubClassOfAxiom(A, B)]),
    equivalent: build([
      declare(A),
      declare(B),
      f.getOWLEquivalentClassesAxiom([A, B]),
    ]),
    disjoint: build([
      declare(A),
      declare(B),
      f.getOWLDisjointClassesAxiom([A, B]),
    ]),
    equivalentChain: build([
      f.getOWLEquivalentClassesAxiom([A, B]),
      f.getOWLEquivalentClassesAxiom([B, C]),
    ]),
    membership: build([
      declare(A),
      f.getOWLClassAssertionAxiom(A, f.getOWLNamedIndividual(iri(NS + "i"))),
    ]),
    iriAnnotation: build([
      declare(A),
      f.getOWLAnnotationAssertionAxiom(
        f.getOWLAnnotationProperty(iri(NS + "%6Eote")),
        iri(NS + "A"),
        iri("urn:legacy:value:kept"),
      ),
    ]),
    typedAnnotation: build([
      declare(A),
      f.getOWLAnnotationAssertionAxiom(
        f.getOWLAnnotationProperty(iri(NS + "note")),
        iri(NS + "A"),
        f.getOWLLiteral("007", f.getOWLDatatype(iri(XSD + "integer"))),
      ),
    ]),
    languageAnnotation: build([
      declare(A),
      f.getOWLAnnotationAssertionAxiom(
        f.getOWLAnnotationProperty(iri(NS + "note")),
        iri(NS + "A"),
        f.getOWLLiteral("Café", "fr"),
      ),
    ]),
    fullIriAnnotation: build([
      declare(A),
      f.getOWLAnnotationAssertionAxiom(
        f.getOWLAnnotationProperty(iri(NS + "ending/")),
        iri(NS + "A"),
        iri("urn:legacy:value:kept"),
      ),
    ]),
    propertyDefault: build([declare(p)]),
    propertyExplicitTop: build([
      declare(p),
      f.getOWLObjectPropertyDomainAxiom(p, f.getOWLClass(iri(OWL + "Thing"))),
      f.getOWLObjectPropertyRangeAxiom(p, f.getOWLClass(iri(OWL + "Thing"))),
    ]),
    inverseDerived: build([
      declare(A),
      declare(B),
      f.getOWLObjectPropertyDomainAxiom(p, A),
      f.getOWLObjectPropertyRangeAxiom(p, B),
      f.getOWLInverseObjectPropertiesAxiom(p, q),
    ]),
    restriction: build([
      declare(A),
      f.getOWLSubClassOfAxiom(A, f.getOWLObjectMinCardinality(2, p)),
    ]),
    operator: build([
      f.getOWLSubClassOfAxiom(A, f.getOWLObjectUnionOf([B, C])),
    ]),
    datatype: build([
      f.getOWLDataPropertyRangeAxiom(
        f.getOWLDataProperty(iri(NS + "age")),
        f.getOWLDatatype(iri(XSD + "integer")),
      ),
    ]),
  };
  // The default parameter above is intentionally bypassed for true anonymity.
  exports.empty = new h.VOWLBuilder().build(new h.OWLOntology());
  assert.equal(exports.empty.header.iri, "No IRI set");
  assert.equal(
    h.serializeVowlJson(exports.propertyDefault),
    h.serializeVowlJson(exports.propertyExplicitTop),
    "The pinned exporter cannot distinguish default from asserted top endpoints",
  );
  assert.equal(
    exports.iriAnnotation.classAttribute[0].annotations.note[0].identifier,
    "note",
  );
  assert.equal(
    exports.typedAnnotation.classAttribute[0].annotations.note[0].language,
    "undefined",
  );
  assert(
    !Object.hasOwn(
      exports.typedAnnotation.classAttribute[0].annotations.note[0],
      "datatype",
    ),
  );
  const collisions = [];
  for (const [name, method] of [
    ["equivalence", "getOWLEquivalentClassesAxiom"],
    ["disjointness", "getOWLDisjointClassesAxiom"],
  ]) {
    const nary = build([f[method]([A, B, C])]);
    const binary = build(
      [
        [A, B],
        [A, C],
        [B, C],
      ].map((members) => f[method](members)),
    );
    const naryText = h.serializeVowlJson(nary);
    const binaryText = h.serializeVowlJson(binary);
    assert.equal(
      naryText,
      binaryText,
      `${name}: historical grouping-loss witness`,
    );
    exports[`${name}GroupingLost`] = nary;
    collisions.push({
      kind: name,
      distinctInputs:
        "One three-member axiom versus all three two-member axioms",
      equalSerializedBytes: true,
      outputSha256: hash(naryText),
      byteLength: new TextEncoder().encode(naryText).length,
    });
  }
  const cases = [];
  const add = (id, input, specification) => {
    cases.push({
      id,
      inputText: h.serializeVowlJson(input),
      input,
      profile: profiles.structural,
      resolutions: [],
      origin:
        "independently authored mutation of pinned-builder output, serialized by pinned function",
      ...specification,
    });
  };
  const success = (id, input, expectedSource, rationale, resolutions = []) =>
    add(id, input, {
      expectedSource,
      resolutions,
      outcome: "success",
      diagnostics: [
        { code: "MIGRATION_DROPPED_FIELD", sourcePointer: "/_comment" },
        { code: "MIGRATION_DROPPED_FIELD", sourcePointer: "/metrics" },
      ],
      rules: ["A9.3", "A2", "B2.1"],
      rationale,
      origin:
        "actual pinned VOWLBuilder plus serializeVowlJson functions; public constructor dependency separately recorded",
    });
  const reject = (id, input, rationale, extra = {}) =>
    add(id, input, {
      outcome: "error",
      errorCode: "MIGRATION_AMBIGUOUS",
      rules: ["A9.3", "SLICE-004"],
      rationale,
      ...extra,
    });
  success(
    "empty-anonymous-structural",
    exports.empty,
    manual(),
    "The exact documented No IRI set placeholder represents an anonymous root. All empty semantic collections stay empty; no subject, role or occurrence is fabricated.",
  );
  success(
    "named-class-structural",
    exports.named,
    manual({ root: ROOT, namedClass: true }),
    "The complete unique class/attribute join and full IRI recover one class role and its canonical singleton occurrence. IRI-based is a generated presentation label, not an rdfs:label assertion.",
  );
  success(
    "resolved-iri-annotation",
    exports.iriAnnotation,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "%6Eote",
        value: { kind: "iri", iri: "urn:legacy:value:kept" },
      },
    }),
    "The exact per-item annotation-predicate resolution restores the percent-encoded predicate IRI. type:iri and the absolute lexical value preserve the IRI branch without inventing a literal datatype.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: ANNOTATION_POINTER,
        iri: NS + "%6Eote",
      },
    ],
  );
  success(
    "resolved-alternative-lexical-predicate",
    exports.iriAnnotation,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "note",
        value: { kind: "iri", iri: "urn:legacy:value:kept" },
      },
    }),
    "Identical historical bytes permit more than one lexical predicate. The explicit item resolution chooses a different retained IRI and therefore different canonical bytes.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: ANNOTATION_POINTER,
        iri: NS + "note",
      },
    ],
  );
  success(
    "resolved-language-annotation",
    exports.languageAnnotation,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "note",
        value: { kind: "language", lexical: "Café", language: "fr" },
      },
    }),
    "An explicit nonempty language tag retains the language-literal branch and lexical spelling; the exact predicate is supplied at the item location.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: ANNOTATION_POINTER,
        iri: NS + "note",
      },
    ],
  );
  success(
    "exact-full-iri-annotation-fallback",
    exports.fullIriAnnotation,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "ending/",
        value: { kind: "iri", iri: "urn:legacy:value:kept" },
      },
    }),
    "For an empty suffix the pinned localName returns the complete lexical IRI and namespaceIri returns an empty string, so this particular fallback is reversible without a resolution.",
  );
  const anonymousValue = clone(exports.iriAnnotation);
  anonymousValue.classAttribute[0].annotations.note[0].value = "_:one";
  success(
    "anonymous-annotation-value",
    anonymousValue,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "%6Eote",
        value: { kind: "subject", subject: "anonymous-value-one" },
      },
    }),
    "A nonempty legacy blank token is retained as an anonymous subject reference, without treating _:one as an IRI or inventing an individual role.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: ANNOTATION_POINTER,
        iri: NS + "%6Eote",
      },
    ],
  );
  cases.at(-1).origin =
    "Independently authored blank-value mutation using the exact annotationItem blank-token branch";
  const nested = clone(exports.iriAnnotation);
  nested.classAttribute[0].annotations.note[0].annotations = {
    [NS + "ending/"]: [
      {
        identifier: NS + "ending/",
        predicateNs: "",
        type: "iri",
        value: "urn:annotation:review",
      },
    ],
  };
  success(
    "nested-annotation-assertion-anchor",
    nested,
    manual({
      root: ROOT,
      namedClass: true,
      annotation: {
        predicate: NS + "%6Eote",
        value: { kind: "iri", iri: "urn:legacy:value:kept" },
        annotations: [
          {
            predicate: NS + "ending/",
            value: { kind: "iri", iri: "urn:annotation:review" },
            annotations: [],
          },
        ],
      },
    }),
    "The represented nested item annotates the exact annotation assertion. Preserve it in an assertion anchor instead of attaching it to the class or dropping it.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: ANNOTATION_POINTER,
        iri: NS + "%6Eote",
      },
    ],
  );
  cases.at(-1).origin =
    "Independently authored nested item using pinned addAnnotationItem/nestedAnnotations field shapes";
  for (const [seed, relation] of [
    ["subclass", "subclass"],
    ["equivalent", "equivalent-classes"],
    ["disjoint", "disjoint-classes"],
  ])
    success(
      `named-${seed}-structural`,
      exports[seed],
      manual({ root: ROOT, namedClass: true, namedClasses: ["B"], relation }),
      "The named classes and exact named relation are represented explicitly; traversal identifiers and the redundant presentation flags do not create extra ontology facts.",
    );
  const chain = manual({
    root: ROOT,
    namedClass: true,
    namedClasses: ["B", "C"],
  });
  chain.structural.constructs.push(
    {
      id: "pair-A-B",
      kind: "equivalent-classes",
      members: ["class-A", "class-B"],
    },
    {
      id: "pair-B-C",
      kind: "equivalent-classes",
      members: ["class-B", "class-C"],
    },
  );
  success(
    "triangle-free-equivalence-chain",
    exports.equivalentChain,
    projectFixture(chain),
    "A triangle-free A-B/B-C graph can only represent the two binary links. Preserve two separate assertions; canonical occurrence grouping may group all three classes without inventing a three-member assertion.",
  );
  success(
    "named-direct-class-membership",
    exports.membership,
    manual({ root: ROOT, namedClass: true, membership: true }),
    "A named individual in the explicit individuals array identifies a retained individual role and direct class membership; the unrelated zero instances count is not used as a membership list.",
  );
  const title = clone(exports.named);
  title.header.title = { fr: "Titre conservé" };
  success(
    "resolved-language-title-summary",
    title,
    manual({
      root: ROOT,
      namedClass: true,
      ontologyAnnotation: {
        predicate: NS + "title",
        value: { kind: "language", lexical: "Titre conservé", language: "fr" },
      },
    }),
    "An independently edited language-tagged summary retains its literal branch, but needs its own exact predicate resolution. It becomes an ontology annotation, not an entity assertion.",
    [
      {
        kind: "annotation-predicate",
        sourcePointer: "/header/title/fr",
        iri: NS + "title",
      },
    ],
  );
  cases.at(-1).origin =
    "Independently authored language-tagged edit to pinned builder header";
  for (const absent of ["omitted", "empty"]) {
    const input = clone(exports.named);
    if (absent === "omitted") delete input.header.iri;
    else input.header.iri = "";
    success(
      `${absent}-root-explicitly-resolved`,
      input,
      manual({ root: "urn:resolved-legacy-root", namedClass: true }),
      "Omitted or empty root identity is unresolved rather than known anonymous. The exact ontology-iri resolution supplies it without consulting an acquisition URL.",
      [
        {
          kind: "ontology-iri",
          sourcePointer: "/header/iri",
          iri: "urn:resolved-legacy-root",
        },
      ],
    );
    cases.at(-1).origin =
      "independently authored mutation of the pinned named-class input";
    reject(
      `${absent}-root-unresolved`,
      input,
      "An omitted or empty ontology IRI is not the documented No IRI set placeholder and cannot be silently interpreted as anonymous.",
    );
  }
  reject(
    "annotation-predicate-missing",
    exports.iriAnnotation,
    "Percent-decoding loses whether the original predicate used note, %6Eote or another equivalent lexical encoding. predicateNs plus the decoded local name is not an inverse mapping.",
  );
  reject(
    "annotation-datatype-lost-after-predicate-resolution",
    exports.typedAnnotation,
    "The untagged literal no longer records its datatype. A predicate resolution cannot distinguish typed integer 007 from string 007, and A9.3 has no datatype resolution kind.",
    {
      resolutions: [
        {
          kind: "annotation-predicate",
          sourcePointer: ANNOTATION_POINTER,
          iri: NS + "note",
        },
      ],
    },
  );
  for (const [id, input, rationale] of [
    [
      "default-property-endpoints",
      exports.propertyDefault,
      "Default endpoints and explicit owl:Thing domain/range produce byte-identical historical exports. Neither interpretation is recoverable.",
    ],
    [
      "explicit-top-property-endpoints",
      exports.propertyExplicitTop,
      "An authored top domain/range cannot be distinguished from a default endpoint; identical bytes must receive identical admission.",
    ],
    [
      "inverse-derived-property-endpoints",
      exports.inverseDerived,
      "Inverse-derived endpoints omit their private explicit provenance. Migration must not invent domain/range constructs.",
    ],
    [
      "datatype-with-ambiguous-property-endpoints",
      exports.datatype,
      "The datatype role is visible, but its complete exported document also contains a property with an unrecoverable default domain. A recoverable node does not authorize partial success.",
    ],
    [
      "restriction-scope-lost",
      exports.restriction,
      "An unqualified minimum restriction is written on the global property's cardinality field, losing the restriction's subclass scope. The three permitted resolutions cannot repair that loss.",
    ],
    [
      "operator-completeness-unattested",
      exports.operator,
      "The historical operator branch can discard operands before export. The remaining list does not attest a complete original expression, so the qualified ingress contract rejects this branch.",
    ],
    [
      "equivalence-triangle-grouping-lost",
      exports.equivalenceGroupingLost,
      "One n-ary equivalence axiom and three binary axioms have byte-identical pinned output. Their retained assertion groupings differ, so neither is selected.",
    ],
    [
      "disjointness-triangle-grouping-lost",
      exports.disjointnessGroupingLost,
      "One n-ary disjointness axiom and three binary axioms have byte-identical pinned output. Their retained assertion groupings differ, so neither is selected.",
    ],
  ])
    reject(id, input, rationale, {
      origin: "actual pinned builder plus serializer output",
    });

  function mutate(id, change, rationale, extra) {
    const input = clone(exports.named);
    change(input);
    reject(id, input, rationale, extra);
  }
  mutate(
    "duplicate-class-id",
    (input) => input.class.push(clone(input.class[0])),
    "SLICE-004 rejects duplicate IDs before removing traversal IDs.",
  );
  mutate(
    "duplicate-attribute-id",
    (input) => input.classAttribute.push(clone(input.classAttribute[0])),
    "A duplicated attribute partner makes the join ambiguous, even when both records are equal.",
  );
  mutate(
    "missing-attribute-partner",
    (input) => {
      input.classAttribute = [];
    },
    "A class with no attribute partner has no recoverable full IRI and must not receive invented identity.",
  );
  mutate(
    "dangling-attribute-partner",
    (input) => {
      input.classAttribute[0].id = "missing";
    },
    "The attribute references no class record; both unmatched sides must be rejected.",
  );
  mutate(
    "conflicting-record-attribute-iri",
    (input) => {
      input.class[0].iri = NS + "Different";
    },
    "The exporter can pass record fields through, but two conflicting IRIs at a join have no priority rule authorizing silent choice.",
  );
  mutate(
    "unknown-retained-field",
    (input) => {
      input.unexplainedOntologyFact = "retained?";
    },
    "A pass-through field with no known meaning cannot be relabeled a disposable session field.",
  );
  mutate(
    "edited-header-summary-without-original",
    (input) => {
      input.header.title = { en: "Independently edited title" };
    },
    "Header summaries may be edited independently. No retained annotation establishes the predicate or literal branch of this text.",
  );
  mutate(
    "nonzero-instance-count-without-members",
    (input) => {
      input.classAttribute[0].instances = 2;
    },
    "A numeric instance count cannot identify the missing class-membership assertions or individuals.",
  );
  const validResolution = {
    kind: "annotation-predicate",
    sourcePointer: ANNOTATION_POINTER,
    iri: NS + "%6Eote",
  };
  for (const [id, resolutions, input, rationale] of [
    [
      "unused-predicate-resolution",
      [validResolution],
      exports.named,
      "The pointer identifies no unresolved item in this source.",
    ],
    [
      "wrong-annotation-bucket-pointer",
      [
        {
          ...validResolution,
          sourcePointer: "/classAttribute/0/annotations/note",
        },
      ],
      exports.iriAnnotation,
      "An array bucket is not the exact unresolved annotation item.",
    ],
    [
      "duplicate-resolution-key",
      [validResolution, clone(validResolution)],
      exports.iriAnnotation,
      "Resolution records are unique by kind and sourcePointer, even when their values agree.",
    ],
    [
      "conflicting-resolution-key",
      [validResolution, { ...validResolution, iri: NS + "other" }],
      exports.iriAnnotation,
      "Two IRIs for one resolution key conflict.",
    ],
    [
      "unsupported-datatype-resolution",
      [
        {
          kind: "literal-datatype",
          sourcePointer: ANNOTATION_POINTER,
          iri: XSD + "integer",
        },
      ],
      exports.typedAnnotation,
      "A9.3 closes the resolution kind vocabulary; missing datatype information cannot be supplied by an invented fourth kind.",
    ],
    [
      "known-ontology-iri-override",
      [
        {
          kind: "ontology-iri",
          sourcePointer: "/header/iri",
          iri: "urn:replacement",
        },
      ],
      exports.named,
      "A known lexical ontology IRI is not unresolved. A contradictory ontology resolution cannot override it.",
    ],
    [
      "known-anonymous-root-override",
      [
        {
          kind: "ontology-iri",
          sourcePointer: "/header/iri",
          iri: "urn:replacement",
        },
      ],
      exports.empty,
      "The documented anonymous-root placeholder is already resolved absence, so an ontology resolution cannot change its identity.",
    ],
  ])
    reject(id, input, rationale, {
      errorCode: "MIGRATION_RESOLUTION_INVALID",
      resolutions,
    });
  reject(
    "artifact-without-state",
    exports.named,
    "Artifact migration requires complete recoverable placements, display state and camera; it cannot run a layout or choose omitted values.",
    { profile: profiles.artifact },
  );
  reject(
    "unknown-explicit-dialect",
    exports.named,
    "Migration has one explicitly named dialect and performs no exporter-comment or shape-based automatic detection.",
    {
      dialect: "webvowl-legacy-unqualified",
      errorCode: "MIGRATION_DIALECT_UNKNOWN",
    },
  );
  appendArtifactCases({ cases, exports, success, reject, manual, root: ROOT });
  return {
    cases,
    exports,
    evidence: { ...h.evidence, groupingCollisions: collisions },
  };
}
