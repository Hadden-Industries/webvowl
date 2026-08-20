# ADR 0006: Draw restriction edges as a documented departure from VOWL 2

| Metadata    | Value                                                          |
| ----------- | -------------------------------------------------------------- |
| **Status**  | Accepted                                                       |
| **Date**    | 2026-08-20                                                     |
| **Decider** | Repository owner                                               |
| **Amends**  | `docs/adr/0004-vowl-specification-as-correctness-authority.md` |

## Context

`VOWLBuilder` draws an edge for `owl:someValuesFrom` and `owl:allValuesFrom`
restrictions, and the pinned OWL2VOWL 0.3.7 oracle does the same. ADR 0004
assigns `VOWLBuilder` to the VOWL 2.0 specification, so the question is whether
that edge is something the specification defines.

It is not, and the evidence is unambiguous.

The specification's Visual Notation section, in the paragraph following Table 9,
lists `owl:allValuesFrom`, `owl:someValuesFrom`, `owl:hasValue`,
`owl:Restriction` and `owl:onProperty` among elements that are not part of the
VOWL visualization, saying they could be displayed some other way such as a
tooltip or sidebar. That sentence alone is weak evidence, because the same list
contains `rdfs:comment`, `rdfs:seeAlso` and `rdfs:isDefinedBy`, which every
implementation emits into a sidebar rather than discarding. Read in context it
means _not part of the graph_, not _discard_.

The authors' own publication settles it. Section 5.3 of "Visualizing Ontologies
with VOWL" tests VOWL against OntoViBe, an ontology visualization benchmark
built from a comprehensive set of OWL 2 constructs whose elements are named
self-descriptively, and its figure is that benchmark rendered by WebVOWL version
0.4.0 - which the same paragraph calls a complete implementation of VOWL 2. In
that figure the classes named `SomeValuesFromClass`, `AllValuesFromClass`,
`HasValueClass` and `HasSelfClass` appear as isolated circles with no edges at
all, and the surrounding text remarks on the benchmark containing classes not
linked to any other class. The authors then enumerate the omissions they
consider crucial - custom data ranges, named classes defined by set operations,
and the nesting direction of set operations - and restrictions are not among
them, because they are outside VOWL 2's scope rather than missing from it. The
earlier version of the paper reaches the same conclusion against OntoViBe 1, and
is more explicit still, describing custom data ranges as intentionally not
included because VOWL focuses on classes and properties.

So drawing a restriction edge is an extension postdating the 2014
specification, not an interpretation of it.

Two facts bound the decision. The oracle emits 298 restriction edges across the
46 pinned reference outputs - 222 `someValues` and 76 `allValues` - in 19 of
those 46 documents. And in the non-Turtle corpus our restriction edges already
match it almost exactly: 32 against 31, with exact count agreement on 15 of 16
documents.

## Decision

1. **Restriction edges are kept.** Removing them would introduce 298
   differences across 19 of 46 fixtures against the transparency bar, and would
   hide modelling information - `Wine subClassOf (hasDrink only Wine)` is a
   structural relationship between two classes, which is what the diagram exists
   to show. It is recorded as a **departure from VOWL 2**, not as conformance.
2. **Cardinality is a label, not an edge.** VOWL 2 Table 6 draws
   `owl:cardinality`, `owl:minCardinality` and `owl:maxCardinality` as numbers
   near the end of the property's arrow, in the manner of UML multiplicity. A
   cardinality restriction therefore contributes a figure to an edge rather than
   an edge of its own, and where the restricted class and filler are already the
   property's domain and range the figure moves onto that edge and the duplicate
   is dropped.
3. **Quantified restrictions keep their own edge**, even where the endpoints
   coincide with the declared domain and range. VOWL 2 governs nothing about
   that edge, so its shape is settled by the oracle, which draws it separately.
4. **A restriction whose filler has no VOWL node contributes no edge.** A
   nested restriction, an enumeration or a `hasValue` has nothing for an edge to
   point at, and collapsing it to `owl:Thing` would state that all values are
   anything at all.
5. **The governing rule for this whole area** is: follow the specification where
   it speaks, and the oracle where it is silent. Decisions 2 and 3 sit on
   opposite sides of exactly that line.

## Rationale

Decision 1 inverts an argument made earlier in the investigation and worth
recording so it is not made again. It first appeared that the authors' own
implementation extended the specification, and that the extension was therefore
the working notation. The benchmark figure shows the opposite: at version 0.4.0
they drew no such edges. The extension arrived later, in OWL2VOWL and in later
WebVOWL releases. Keeping the edges is therefore a compatibility judgement about
what users of WebVOWL v1.1.7 saw, not a claim about what VOWL 2 requires.

The measurement supports the judgement without overstating it. Restrictions
carry under one percent of the corpus's class-to-class structure - 32 edges
against 3625 - and 11 of 16 documents have none. But 30 class pairs are stated
only by a restriction, and six classes would lose every connection they have.
A class drawn with no edges tells the reader it relates to nothing, which the
ontology does not say.

Decisions 2 and 3 look inconsistent and are not. Cardinality has a defined
representation in VOWL 2 and restrictions do not, so one is settled by the
specification and the other only by the implementation that invented it. An
attempt to apply a single uniform rule - one edge per source, property and
target, with axioms contributing decorations - was implemented and reverted: it
resolved 297 duplicate pairs in `universal_reference-data_20260714` but opened
46 new differences in `iso_31073_ed-1_20260626` and reopened three documents,
because the oracle emits both edges for a quantified restriction and only one
for a cardinality.

## Consequences

- `universal_reference-data_20260714` fell from 297 structural property
  differences to 2, and `iso_31073_ed-1_20260626` from 7 to 6, without
  reopening any document.
- Our output continues to contain a construct the 2014 specification excludes
  from the graph. That is now a recorded decision rather than an oversight, and
  must not be generalised into "the oracle wins where it is convenient".
- If VOWL is ever revised to cover restrictions, this ADR is the first thing to
  revisit.
- `bibo.rdf.xml` still differs by one restriction edge whose filler is an
  anonymous union, which the oracle does not draw. That is a shape question
  inside the extension and is not settled here.

## Verification obligations

- A cardinality restriction coinciding with the declared domain and range
  **MUST** label that edge rather than add one, and the figure **MUST** be the
  weaker bound where several restrictions disagree.
- A quantified restriction coinciding with the declared domain and range
  **MUST** keep its own edge, so the narrowing cannot be widened by accident.
- A restriction whose filler has no VOWL node **MUST** draw no edge.
- The merge **MUST** be shown not to depend on the order axioms are read.

## Implementation map

| Change                      | Location                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| Cardinality label and merge | `src/owl2vowl/js/vowlBuilder.js`                                     |
| Behavioural tests           | `src/owl2vowl/js/vowlBuilder.classExpressions.test.js`               |
| Evidence for the departure  | `docs/owlapi-js/conformance/suites.json`, `corroboratingPublication` |
